const i18next = require('i18next');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./loggerManager');
const config = require('./configManager');
const cache = require('./cacheManager');
const metrics = require('./metricsManager');

class I18nManager {
  constructor() {
    this.i18n = i18next;
    this.defaultLocale = 'id';
    this.fallbackLocale = 'en';
    this.supportedLocales = ['id', 'en'];
    this.translations = new Map();
    this.initialize();
  }

  // Initialize i18n manager
  initialize() {
    try {
      this.setupI18next();
      this.loadTranslations();
      logger.info('I18n manager initialized successfully');
    } catch (error) {
      logger.error('I18n manager initialization error:', error);
      throw error;
    }
  }

  /**
   * I18n Setup
   */

  // Setup i18next
  async setupI18next() {
    const i18nConfig = config.get('i18n', {});

    await this.i18n.init({
      lng: this.defaultLocale,
      fallbackLng: this.fallbackLocale,
      supportedLngs: this.supportedLocales,
      ns: ['common', 'validation', 'errors'],
      defaultNS: 'common',
      interpolation: {
        escapeValue: false
      },
      ...i18nConfig
    });
  }

  // Load translations
  async loadTranslations() {
    try {
      const localesPath = path.join(__dirname, '../locales');
      
      for (const locale of this.supportedLocales) {
        const translations = await this.loadLocaleTranslations(locale, localesPath);
        this.translations.set(locale, translations);
        
        this.i18n.addResourceBundle(
          locale,
          'common',
          translations.common,
          true,
          true
        );
      }

      logger.info('Translations loaded successfully');
    } catch (error) {
      logger.error('Error loading translations:', error);
      throw error;
    }
  }

  /**
   * Translation Management
   */

  // Load locale translations
  async loadLocaleTranslations(locale, basePath) {
    const translations = {};
    const localePath = path.join(basePath, locale);

    try {
      const files = await fs.readdir(localePath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const namespace = path.basename(file, '.json');
          const content = await fs.readFile(path.join(localePath, file), 'utf8');
          translations[namespace] = JSON.parse(content);
        }
      }

      return translations;
    } catch (error) {
      logger.error(`Error loading translations for locale ${locale}:`, error);
      throw error;
    }
  }

  // Add translation
  async addTranslation(locale, namespace, key, value) {
    try {
      if (!this.supportedLocales.includes(locale)) {
        throw new Error(`Unsupported locale: ${locale}`);
      }

      this.i18n.addResource(locale, namespace, key, value);
      
      const localeTranslations = this.translations.get(locale) || {};
      localeTranslations[namespace] = localeTranslations[namespace] || {};
      localeTranslations[namespace][key] = value;
      
      this.translations.set(locale, localeTranslations);
      await this.saveTranslations(locale);

      return true;
    } catch (error) {
      logger.error('Error adding translation:', error);
      throw error;
    }
  }

  // Remove translation
  async removeTranslation(locale, namespace, key) {
    try {
      if (!this.supportedLocales.includes(locale)) {
        throw new Error(`Unsupported locale: ${locale}`);
      }

      this.i18n.removeResource(locale, namespace, key);
      
      const localeTranslations = this.translations.get(locale);
      if (localeTranslations?.[namespace]) {
        delete localeTranslations[namespace][key];
        await this.saveTranslations(locale);
      }

      return true;
    } catch (error) {
      logger.error('Error removing translation:', error);
      throw error;
    }
  }

  /**
   * Translation Operations
   */

  // Translate text
  translate(key, options = {}) {
    const startTime = process.hrtime();
    
    try {
      const { locale = this.getCurrentLocale(), ...rest } = options;
      const translation = this.i18n.t(key, { lng: locale, ...rest });
      
      this.trackTranslation('success', startTime);
      return translation;
    } catch (error) {
      this.trackTranslation('error', startTime);
      logger.error(`Translation error for key ${key}:`, error);
      return key;
    }
  }

  // Translate array of keys
  translateBatch(keys, options = {}) {
    return keys.map(key => this.translate(key, options));
  }

  // Check if key exists
  hasTranslation(key, locale = this.getCurrentLocale()) {
    return this.i18n.exists(key, { lng: locale });
  }

  /**
   * Locale Management
   */

  // Set current locale
  setLocale(locale) {
    if (!this.supportedLocales.includes(locale)) {
      throw new Error(`Unsupported locale: ${locale}`);
    }

    this.i18n.changeLanguage(locale);
    return true;
  }

  // Get current locale
  getCurrentLocale() {
    return this.i18n.language || this.defaultLocale;
  }

  // Add supported locale
  async addLocale(locale, translations = {}) {
    try {
      if (this.supportedLocales.includes(locale)) {
        throw new Error(`Locale ${locale} already supported`);
      }

      this.supportedLocales.push(locale);
      this.translations.set(locale, translations);

      for (const [namespace, content] of Object.entries(translations)) {
        this.i18n.addResourceBundle(locale, namespace, content, true, true);
      }

      await this.saveTranslations(locale);
      return true;
    } catch (error) {
      logger.error(`Error adding locale ${locale}:`, error);
      throw error;
    }
  }

  // Remove supported locale
  async removeLocale(locale) {
    try {
      if (locale === this.defaultLocale || locale === this.fallbackLocale) {
        throw new Error('Cannot remove default or fallback locale');
      }

      const index = this.supportedLocales.indexOf(locale);
      if (index > -1) {
        this.supportedLocales.splice(index, 1);
        this.translations.delete(locale);
        await this.deleteTranslations(locale);
      }

      return true;
    } catch (error) {
      logger.error(`Error removing locale ${locale}:`, error);
      throw error;
    }
  }

  /**
   * File Operations
   */

  // Save translations to file
  async saveTranslations(locale) {
    try {
      const localeTranslations = this.translations.get(locale);
      if (!localeTranslations) return;

      const localesPath = path.join(__dirname, '../locales', locale);
      await fs.mkdir(localesPath, { recursive: true });

      for (const [namespace, content] of Object.entries(localeTranslations)) {
        const filePath = path.join(localesPath, `${namespace}.json`);
        await fs.writeFile(filePath, JSON.stringify(content, null, 2));
      }
    } catch (error) {
      logger.error(`Error saving translations for locale ${locale}:`, error);
      throw error;
    }
  }

  // Delete translations file
  async deleteTranslations(locale) {
    try {
      const localePath = path.join(__dirname, '../locales', locale);
      await fs.rm(localePath, { recursive: true, force: true });
    } catch (error) {
      logger.error(`Error deleting translations for locale ${locale}:`, error);
      throw error;
    }
  }

  /**
   * Cache Management
   */

  // Get cached translation
  async getCachedTranslation(key, locale) {
    const cacheKey = `i18n:${locale}:${key}`;
    return await cache.get(cacheKey);
  }

  // Set cached translation
  async setCachedTranslation(key, locale, value) {
    const cacheKey = `i18n:${locale}:${key}`;
    await cache.set(cacheKey, value, 3600); // Cache for 1 hour
  }

  // Clear translation cache
  async clearCache() {
    const pattern = 'i18n:*';
    await cache.deleteByPattern(pattern);
  }

  /**
   * Metrics Tracking
   */

  // Track translation metrics
  trackTranslation(status, startTime) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;

    metrics.observeHistogram('translation_duration_seconds', duration, {
      status
    });

    metrics.incrementCounter('translations_total', {
      status
    });
  }

  /**
   * Utility Methods
   */

  // Format date
  formatDate(date, options = {}) {
    const locale = options.locale || this.getCurrentLocale();
    return new Date(date).toLocaleDateString(locale, options);
  }

  // Format number
  formatNumber(number, options = {}) {
    const locale = options.locale || this.getCurrentLocale();
    return new Intl.NumberFormat(locale, options).format(number);
  }

  // Format currency
  formatCurrency(amount, currency = 'IDR', options = {}) {
    const locale = options.locale || this.getCurrentLocale();
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...options
    }).format(amount);
  }

  /**
   * Status Information
   */

  // Get i18n status
  getStatus() {
    return {
      currentLocale: this.getCurrentLocale(),
      defaultLocale: this.defaultLocale,
      fallbackLocale: this.fallbackLocale,
      supportedLocales: this.supportedLocales,
      loadedNamespaces: this.i18n.options.ns,
      resourceCount: Object.keys(this.i18n.store.data).length
    };
  }
}

// Create singleton instance
const i18nManager = new I18nManager();

// Export instance
module.exports = i18nManager;
