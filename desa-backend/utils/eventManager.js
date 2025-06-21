const EventEmitter = require('events');

class EventManager extends EventEmitter {
  constructor() {
    super();
    this.eventHistory = new Map();
    this.eventHandlers = new Map();
    this.maxHistorySize = 1000;
    this.initialize();
  }

  // Initialize event manager
  initialize() {
    try {
      this.setupDefaultHandlers();
      console.log('Event manager initialized successfully');
    } catch (error) {
      console.error('Event manager initialization error:', error);
      throw error;
    }
  }

  /**
   * Event Management
   */

  // Setup default event handlers
  setupDefaultHandlers() {
    // User events
    this.registerHandler('user:created', this.handleUserCreated.bind(this));
    this.registerHandler('user:updated', this.handleUserUpdated.bind(this));
    this.registerHandler('user:deleted', this.handleUserDeleted.bind(this));
    this.registerHandler('user:login', this.handleUserLogin.bind(this));
    this.registerHandler('user:logout', this.handleUserLogout.bind(this));

    // Surat events
    this.registerHandler('surat:created', this.handleSuratCreated.bind(this));
    this.registerHandler('surat:updated', this.handleSuratUpdated.bind(this));
    this.registerHandler('surat:status_changed', this.handleSuratStatusChanged.bind(this));

    // Bantuan events
    this.registerHandler('bantuan:created', this.handleBantuanCreated.bind(this));
    this.registerHandler('bantuan:updated', this.handleBantuanUpdated.bind(this));
    this.registerHandler('bantuan:distributed', this.handleBantuanDistributed.bind(this));

    // System events
    this.registerHandler('system:error', this.handleSystemError.bind(this));
    this.registerHandler('system:warning', this.handleSystemWarning.bind(this));
    this.registerHandler('system:backup', this.handleSystemBackup.bind(this));
  }

  /**
   * Event Registration
   */

  // Register event handler
  registerHandler(eventName, handler, options = {}) {
    try {
      if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
      }

      const wrappedHandler = this.wrapHandler(eventName, handler);
      this.eventHandlers.set(eventName, {
        handler: wrappedHandler,
        options
      });

      this.on(eventName, wrappedHandler);
      console.debug(`Event handler registered: ${eventName}`);
    } catch (error) {
      console.error(`Error registering handler for ${eventName}:`, error);
      throw error;
    }
  }

  // Unregister event handler
  unregisterHandler(eventName) {
    try {
      const handlerInfo = this.eventHandlers.get(eventName);
      if (handlerInfo) {
        this.removeListener(eventName, handlerInfo.handler);
        this.eventHandlers.delete(eventName);
        console.debug(`Event handler unregistered: ${eventName}`);
      }
    } catch (error) {
      console.error(`Error unregistering handler for ${eventName}:`, error);
      throw error;
    }
  }

  /**
   * Event Emission
   */

  // Emit event with tracking
  async emitEvent(eventName, data = {}, options = {}) {
    const startTime = process.hrtime();

    try {
      // Add metadata
      const eventData = {
        ...data,
        timestamp: new Date(),
        eventId: this.generateEventId()
      };

      // Store in history if enabled
      if (!options.skipHistory) {
        this.storeEventHistory(eventName, eventData);
      }

      // Emit event
      this.emit(eventName, eventData);

      console.debug(`Event emitted: ${eventName}`, { eventId: eventData.eventId });
      return eventData;
    } catch (error) {
      console.error(`Error emitting event ${eventName}:`, error);
      throw error;
    }
  }

  // Emit event and wait for handlers
  async emitEventAndWait(eventName, data = {}, options = {}) {
    const listeners = this.listeners(eventName);
    const results = await Promise.allSettled(
      listeners.map(listener => listener(data))
    );

    return this.processEventResults(results);
  }

  /**
   * Event History
   */

  // Store event in history
  storeEventHistory(eventName, data) {
    try {
      const events = this.eventHistory.get(eventName) || [];
      events.unshift({
        timestamp: new Date(),
        data
      });

      // Limit history size
      if (events.length > this.maxHistorySize) {
        events.pop();
      }

      this.eventHistory.set(eventName, events);
    } catch (error) {
      console.error(`Error storing event history for ${eventName}:`, error);
    }
  }

  // Get event history
  getEventHistory(eventName, limit = 10) {
    const events = this.eventHistory.get(eventName) || [];
    return events.slice(0, limit);
  }

  // Clear event history
  clearEventHistory(eventName) {
    if (eventName) {
      this.eventHistory.delete(eventName);
    } else {
      this.eventHistory.clear();
    }
  }

  /**
   * Event Handlers
   */

  // Handle user created
  async handleUserCreated(data) {
    console.info('User created:', data);
  }

  // Handle user updated
  async handleUserUpdated(data) {
    console.info('User updated:', data);
  }

  // Handle user deleted
  async handleUserDeleted(data) {
    console.info('User deleted:', data);
  }

  // Handle user login
  async handleUserLogin(data) {
    console.info('User login:', data);
  }

  // Handle user logout
  async handleUserLogout(data) {
    console.info('User logout:', data);
  }

  // Handle surat created
  async handleSuratCreated(data) {
    console.info('Surat created:', data);
  }

  // Handle surat updated
  async handleSuratUpdated(data) {
    console.info('Surat updated:', data);
  }

  // Handle surat status changed
  async handleSuratStatusChanged(data) {
    console.info('Surat status changed:', data);
  }

  // Handle bantuan created
  async handleBantuanCreated(data) {
    console.info('Bantuan created:', data);
  }

  // Handle bantuan updated
  async handleBantuanUpdated(data) {
    console.info('Bantuan updated:', data);
  }

  // Handle bantuan distributed
  async handleBantuanDistributed(data) {
    console.info('Bantuan distributed:', data);
  }

  // Handle system error
  async handleSystemError(data) {
    console.error('System error:', data);
  }

  // Handle system warning
  async handleSystemWarning(data) {
    console.warn('System warning:', data);
  }

  // Handle system backup
  async handleSystemBackup(data) {
    console.info('System backup:', data);
  }

  /**
   * Utility Methods
   */

  // Wrap event handler with error handling
  wrapHandler(eventName, handler) {
    return async (...args) => {
      const startTime = process.hrtime();

      try {
        await handler(...args);
      } catch (error) {
        console.error(`Error in event handler ${eventName}:`, error);
        throw error;
      }
    };
  }

  // Generate unique event ID
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Process event results
  processEventResults(results) {
    return {
      successful: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      total: results.length,
      errors: results
        .filter(r => r.status === 'rejected')
        .map(r => r.reason)
    };
  }

  /**
   * Health Check
   */

  // Get event manager status
  getStatus() {
    return {
      registeredEvents: Array.from(this.eventHandlers.keys()),
      historySize: this.eventHistory.size,
      listenerCounts: this.eventNames().reduce((acc, event) => {
        acc[event] = this.listenerCount(event);
        return acc;
      }, {})
    };
  }
}

// Create singleton instance
const eventManager = new EventManager();

// Export instance
module.exports = eventManager;
