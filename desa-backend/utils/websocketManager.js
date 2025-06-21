const WebSocket = require('ws');
const logger = require('./loggerManager');
const config = require('./configManager');
const metrics = require('./metricsManager');
const eventManager = require('./eventManager');
const { ValidationError } = require('./errorManager');

class WebSocketManager {
  constructor() {
    this.server = null;
    this.clients = new Map();
    this.channels = new Map();
    this.handlers = new Map();
    this.initialize();
  }

  // Initialize WebSocket manager
  initialize() {
    try {
      this.setupEventHandlers();
      logger.info('WebSocket manager initialized successfully');
    } catch (error) {
      logger.error('WebSocket manager initialization error:', error);
      throw error;
    }
  }

  /**
   * Server Setup
   */

  // Setup WebSocket server
  setupServer(server) {
    const wsConfig = config.get('websocket', {
      path: '/ws'
    });

    this.server = new WebSocket.Server({
      server,
      path: wsConfig.path,
      clientTracking: true
    });

    this.server.on('connection', this.handleConnection.bind(this));
    this.server.on('error', this.handleServerError.bind(this));

    logger.info('WebSocket server setup completed');
  }

  // Setup event handlers
  setupEventHandlers() {
    // User events
    this.registerHandler('user:status', this.handleUserStatus.bind(this));
    this.registerHandler('user:typing', this.handleUserTyping.bind(this));

    // Chat events
    this.registerHandler('chat:message', this.handleChatMessage.bind(this));
    this.registerHandler('chat:join', this.handleChatJoin.bind(this));
    this.registerHandler('chat:leave', this.handleChatLeave.bind(this));

    // Notification events
    this.registerHandler('notification:read', this.handleNotificationRead.bind(this));
    this.registerHandler('notification:clear', this.handleNotificationClear.bind(this));

    // System events
    this.registerHandler('system:ping', this.handlePing.bind(this));
  }

  /**
   * Connection Management
   */

  // Handle new connection
  handleConnection(ws, req) {
    try {
      const clientId = this.generateClientId();
      const client = {
        id: clientId,
        ws,
        ip: req.socket.remoteAddress,
        connectedAt: new Date(),
        channels: new Set()
      };

      this.clients.set(clientId, client);
      this.setupClientEventListeners(client);
      
      this.sendWelcomeMessage(client);
      this.trackConnection('connected');
      
      logger.info(`Client connected: ${clientId}`);
    } catch (error) {
      logger.error('Error handling connection:', error);
      ws.close();
    }
  }

  // Setup client event listeners
  setupClientEventListeners(client) {
    const { ws, id } = client;

    ws.on('message', (data) => this.handleMessage(client, data));
    ws.on('close', () => this.handleDisconnection(client));
    ws.on('error', (error) => this.handleClientError(client, error));
    ws.on('pong', () => this.handlePong(client));
  }

  // Handle client disconnection
  handleDisconnection(client) {
    try {
      // Remove from channels
      client.channels.forEach(channel => {
        this.leaveChannel(client, channel);
      });

      // Remove client
      this.clients.delete(client.id);
      this.trackConnection('disconnected');

      logger.info(`Client disconnected: ${client.id}`);
    } catch (error) {
      logger.error(`Error handling disconnection for client ${client.id}:`, error);
    }
  }

  /**
   * Message Handling
   */

  // Handle incoming message
  async handleMessage(client, data) {
    const startTime = process.hrtime();

    try {
      const message = JSON.parse(data);
      
      if (!message.type || !message.data) {
        throw new ValidationError('Invalid message format');
      }

      const handler = this.handlers.get(message.type);
      if (!handler) {
        throw new ValidationError(`Unknown message type: ${message.type}`);
      }

      await handler(client, message.data);
      this.trackMessage('received', message.type, startTime);
    } catch (error) {
      this.trackMessage('error', 'parse_error');
      this.sendError(client, error);
    }
  }

  // Send message to client
  sendMessage(client, type, data) {
    const startTime = process.hrtime();

    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({ type, data });
        client.ws.send(message);
        this.trackMessage('sent', type, startTime);
      }
    } catch (error) {
      this.trackMessage('error', 'send_error');
      logger.error(`Error sending message to client ${client.id}:`, error);
    }
  }

  // Broadcast message to all clients
  broadcast(type, data, filter = null) {
    this.clients.forEach(client => {
      if (!filter || filter(client)) {
        this.sendMessage(client, type, data);
      }
    });
  }

  /**
   * Channel Management
   */

  // Join channel
  joinChannel(client, channelName) {
    try {
      let channel = this.channels.get(channelName);
      if (!channel) {
        channel = new Set();
        this.channels.set(channelName, channel);
      }

      channel.add(client.id);
      client.channels.add(channelName);

      this.broadcastToChannel(channelName, 'channel:joined', {
        clientId: client.id,
        channel: channelName
      });

      logger.debug(`Client ${client.id} joined channel ${channelName}`);
    } catch (error) {
      logger.error(`Error joining channel ${channelName}:`, error);
      throw error;
    }
  }

  // Leave channel
  leaveChannel(client, channelName) {
    try {
      const channel = this.channels.get(channelName);
      if (channel) {
        channel.delete(client.id);
        if (channel.size === 0) {
          this.channels.delete(channelName);
        }
      }

      client.channels.delete(channelName);

      this.broadcastToChannel(channelName, 'channel:left', {
        clientId: client.id,
        channel: channelName
      });

      logger.debug(`Client ${client.id} left channel ${channelName}`);
    } catch (error) {
      logger.error(`Error leaving channel ${channelName}:`, error);
      throw error;
    }
  }

  // Broadcast to channel
  broadcastToChannel(channelName, type, data) {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.forEach(clientId => {
        const client = this.clients.get(clientId);
        if (client) {
          this.sendMessage(client, type, data);
        }
      });
    }
  }

  /**
   * Event Handlers
   */

  // Handle user status
  async handleUserStatus(client, data) {
    this.broadcast('user:status_changed', {
      userId: data.userId,
      status: data.status
    });
  }

  // Handle user typing
  async handleUserTyping(client, data) {
    this.broadcastToChannel(data.channel, 'user:typing', {
      userId: data.userId,
      channel: data.channel
    });
  }

  // Handle chat message
  async handleChatMessage(client, data) {
    this.broadcastToChannel(data.channel, 'chat:message', {
      userId: data.userId,
      channel: data.channel,
      message: data.message,
      timestamp: new Date()
    });
  }

  // Handle chat join
  async handleChatJoin(client, data) {
    await this.joinChannel(client, data.channel);
  }

  // Handle chat leave
  async handleChatLeave(client, data) {
    await this.leaveChannel(client, data.channel);
  }

  // Handle notification read
  async handleNotificationRead(client, data) {
    this.sendMessage(client, 'notification:read_confirmed', {
      notificationId: data.notificationId
    });
  }

  // Handle notification clear
  async handleNotificationClear(client, data) {
    this.sendMessage(client, 'notification:clear_confirmed', {
      userId: data.userId
    });
  }

  // Handle ping
  async handlePing(client) {
    this.sendMessage(client, 'system:pong', {
      timestamp: Date.now()
    });
  }

  /**
   * Error Handling
   */

  // Handle server error
  handleServerError(error) {
    logger.error('WebSocket server error:', error);
    metrics.incrementCounter('websocket_errors_total', {
      type: 'server'
    });
  }

  // Handle client error
  handleClientError(client, error) {
    logger.error(`WebSocket client error (${client.id}):`, error);
    metrics.incrementCounter('websocket_errors_total', {
      type: 'client'
    });
  }

  // Send error to client
  sendError(client, error) {
    this.sendMessage(client, 'error', {
      message: error.message,
      code: error.code
    });
  }

  /**
   * Utility Methods
   */

  // Generate client ID
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Send welcome message
  sendWelcomeMessage(client) {
    this.sendMessage(client, 'system:welcome', {
      clientId: client.id,
      timestamp: new Date()
    });
  }

  // Register message handler
  registerHandler(type, handler) {
    this.handlers.set(type, handler);
  }

  /**
   * Metrics Tracking
   */

  // Track connection metrics
  trackConnection(status) {
    metrics.incrementCounter('websocket_connections_total', {
      status
    });

    metrics.setGauge('websocket_connections_active', this.clients.size);
  }

  // Track message metrics
  trackMessage(status, type, startTime = null) {
    if (startTime) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;

      metrics.observeHistogram('websocket_message_duration_seconds', duration, {
        type,
        status
      });
    }

    metrics.incrementCounter('websocket_messages_total', {
      type,
      status
    });
  }

  /**
   * Health Check
   */

  // Get WebSocket server status
  getStatus() {
    return {
      isRunning: this.server?.readyState === WebSocket.OPEN,
      clientCount: this.clients.size,
      channelCount: this.channels.size,
      channels: Array.from(this.channels.keys()),
      handlers: Array.from(this.handlers.keys())
    };
  }
}

// Create singleton instance
const websocketManager = new WebSocketManager();

// Export instance
module.exports = websocketManager;
