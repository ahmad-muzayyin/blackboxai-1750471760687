const i18next = require('i18next');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const config = require('./config');

class I18nManager {
  constructor() {
    this.defaultLanguage = config.get('app.defaultLanguage') || 'id';
    this.fallbackLanguage = 'id';
    this.supportedLanguages = ['id', 'en'];
    this.namespaces = ['common', 'validation', 'errors', 'auth', 'penduduk', 'surat', 'bantuan', 'apbdes'];
    this.initialize();
  }

  // Initialize i18next
  async initialize() {
    try {
      const resources = await this.loadTranslations();

      await i18next.init({
        resources,
        lng: this.defaultLanguage,
        fallbackLng: this.fallbackLanguage,
        ns: this.namespaces,
        defaultNS: 'common',
        interpolation: {
          escapeValue: false
        },
        parseMissingKeyHandler: (key) => {
          logger.warn(`Missing translation key: ${key}`);
          return key;
        }
      });

      logger.info('i18n initialized successfully');
    } catch (error) {
      logger.error('i18n initialization error:', error);
      throw error;
    }
  }

  // Load translation files
  async loadTranslations() {
    const resources = {};

    try {
      for (const lang of this.supportedLanguages) {
        resources[lang] = {};
        
        for (const namespace of this.namespaces) {
          const filePath = path.join(__dirname, `../locales/${lang}/${namespace}.json`);
          if (fs.existsSync(filePath)) {
            const content = await fs.promises.readFile(filePath, 'utf8');
            resources[lang][namespace] = JSON.parse(content);
          }
        }
      }

      return resources;
    } catch (error) {
      logger.error('Error loading translations:', error);
      throw error;
    }
  }

  // Translate text
  translate(key, options = {}) {
    return i18next.t(key, options);
  }

  // Change language
  changeLanguage(lang) {
    if (this.supportedLanguages.includes(lang)) {
      i18next.changeLanguage(lang);
      return true;
    }
    return false;
  }

  // Get current language
  getCurrentLanguage() {
    return i18next.language;
  }

  // Check if language is supported
  isLanguageSupported(lang) {
    return this.supportedLanguages.includes(lang);
  }

  // Get all supported languages
  getSupportedLanguages() {
    return this.supportedLanguages;
  }

  // Get translation for specific namespace
  getNamespace(namespace) {
    return i18next.getResourceBundle(this.getCurrentLanguage(), namespace);
  }

  // Add translation
  addTranslation(lang, namespace, key, value) {
    try {
      i18next.addResourceBundle(lang, namespace, { [key]: value }, true, true);
      return true;
    } catch (error) {
      logger.error('Error adding translation:', error);
      return false;
    }
  }

  // Remove translation
  removeTranslation(lang, namespace, key) {
    try {
      i18next.removeResourceBundle(lang, namespace, key);
      return true;
    } catch (error) {
      logger.error('Error removing translation:', error);
      return false;
    }
  }

  // Express middleware for handling language
  middleware() {
    return (req, res, next) => {
      // Get language from header or query parameter
      let lang = req.headers['accept-language'] || req.query.lang || this.defaultLanguage;
      
      // Extract primary language code
      lang = lang.split(',')[0].split('-')[0];

      // Check if language is supported
      if (!this.isLanguageSupported(lang)) {
        lang = this.defaultLanguage;
      }

      // Set language for the request
      req.language = lang;
      this.changeLanguage(lang);

      // Add translation helper to response locals
      res.locals.t = (key, options = {}) => this.translate(key, { ...options, lng: lang });

      next();
    };
  }

  // Format date according to locale
  formatDate(date, format = 'long') {
    const options = {
      short: {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      },
      long: {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      },
      time: {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }
    };

    return new Date(date).toLocaleDateString(
      this.getCurrentLanguage(),
      options[format] || options.long
    );
  }

  // Format number according to locale
  formatNumber(number, options = {}) {
    return new Intl.NumberFormat(this.getCurrentLanguage(), options).format(number);
  }

  // Format currency according to locale
  formatCurrency(amount, currency = 'IDR') {
    return new Intl.NumberFormat(this.getCurrentLanguage(), {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  // Get plural form
  getPlural(count, singular, plural) {
    return i18next.t(count === 1 ? singular : plural, { count });
  }
}

// Create singleton instance
const i18nManager = new I18nManager();

// Export instance
module.exports = i18nManager;

// Example translation files structure:
/*
locales/
├── id/
│   ├── common.json
│   ├── validation.json
│   ├── errors.json
│   ├── auth.json
│   ├── penduduk.json
│   ├── surat.json
│   ├── bantuan.json
│   └── apbdes.json
└── en/
    ├── common.json
    ├── validation.json
    ├── errors.json
    ├── auth.json
    ├── penduduk.json
    ├── surat.json
    ├── bantuan.json
    └── apbdes.json
*/
