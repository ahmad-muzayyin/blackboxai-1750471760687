const logger = require('./loggerManager');
const i18n = require('./i18nManager');
const metrics = require('./metricsManager');

class ResponseFormatter {
  constructor() {
    this.defaultLocale = 'id';
    this.initialize();
  }

  // Initialize response formatter
  initialize() {
    try {
      logger.info('Response formatter initialized successfully');
    } catch (error) {
      logger.error('Response formatter initialization error:', error);
      throw error;
    }
  }

  /**
   * Success Responses
   */

  // Format success response
  success(data = null, message = null, meta = {}) {
    const startTime = process.hrtime();
    
    try {
      const response = {
        success: true,
        message: message ? this.translateMessage(message) : null,
        data: data,
        ...this.formatMeta(meta)
      };

      this.trackFormatting('success', startTime);
      return response;
    } catch (error) {
      this.trackFormatting('error', startTime);
      logger.error('Error formatting success response:', error);
      throw error;
    }
  }

  // Format paginated response
  paginated(data, page, limit, total, meta = {}) {
    return this.success(data, null, {
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total),
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1
      },
      ...meta
    });
  }

  // Format created response
  created(data = null, message = 'responses.created', meta = {}) {
    return this.success(data, message, {
      statusCode: 201,
      ...meta
    });
  }

  // Format updated response
  updated(data = null, message = 'responses.updated', meta = {}) {
    return this.success(data, message, meta);
  }

  // Format deleted response
  deleted(message = 'responses.deleted', meta = {}) {
    return this.success(null, message, meta);
  }

  /**
   * Error Responses
   */

  // Format error response
  error(error, meta = {}) {
    const startTime = process.hrtime();

    try {
      const response = {
        success: false,
        error: {
          code: error.code || 'INTERNAL_SERVER_ERROR',
          message: this.translateMessage(error.message),
          details: error.details || null,
          ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
        },
        meta: {
          timestamp: new Date(),
          ...meta
        }
      };

      this.trackFormatting('error', startTime);
      return response;
    } catch (formatError) {
      logger.error('Error formatting error response:', formatError);
      throw formatError;
    }
  }

  // Format validation error response
  validationError(errors, message = 'responses.validation_error', meta = {}) {
    return this.error({
      code: 'VALIDATION_ERROR',
      message,
      details: this.formatValidationErrors(errors)
    }, meta);
  }

  // Format not found response
  notFound(resource = 'resource', message = 'responses.not_found', meta = {}) {
    return this.error({
      code: 'NOT_FOUND',
      message,
      details: { resource }
    }, meta);
  }

  // Format unauthorized response
  unauthorized(message = 'responses.unauthorized', meta = {}) {
    return this.error({
      code: 'UNAUTHORIZED',
      message
    }, meta);
  }

  // Format forbidden response
  forbidden(message = 'responses.forbidden', meta = {}) {
    return this.error({
      code: 'FORBIDDEN',
      message
    }, meta);
  }

  /**
   * Special Responses
   */

  // Format file response
  file(url, meta = {}) {
    return this.success({
      url,
      type: this.getFileType(url)
    }, null, meta);
  }

  // Format stream response
  stream(data, meta = {}) {
    return this.success({
      stream: data,
      type: 'stream'
    }, null, meta);
  }

  // Format bulk operation response
  bulk(results, meta = {}) {
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

    return this.success(results, null, {
      summary,
      ...meta
    });
  }

  /**
   * Response Transformation
   */

  // Transform response for API versioning
  transformForVersion(response, version) {
    // Implementation depends on your API versioning strategy
    return response;
  }

  // Transform response for specific format
  transformToFormat(response, format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return response;
      case 'xml':
        return this.convertToXML(response);
      case 'csv':
        return this.convertToCSV(response);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Utility Methods
   */

  // Translate message
  translateMessage(message, data = {}) {
    try {
      return i18n.translate(message, {
        defaultValue: message,
        ...data
      });
    } catch (error) {
      logger.error('Error translating message:', error);
      return message;
    }
  }

  // Format validation errors
  formatValidationErrors(errors) {
    if (typeof errors !== 'object') return errors;

    const formatted = {};
    for (const [field, message] of Object.entries(errors)) {
      formatted[field] = this.translateMessage(message);
    }
    return formatted;
  }

  // Get file type from URL
  getFileType(url) {
    const extension = url.split('.').pop().toLowerCase();
    const mimeTypes = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  // Convert response to XML
  convertToXML(data) {
    // Implementation for XML conversion
    return data;
  }

  // Convert response to CSV
  convertToCSV(data) {
    // Implementation for CSV conversion
    return data;
  }

  /**
   * Response Tracking
   */

  // Track formatting metrics
  trackFormatting(type, startTime) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;

    metrics.observeHistogram('response_formatting_duration_seconds', duration, {
      type
    });

    metrics.incrementCounter('responses_formatted_total', {
      type
    });
  }

  /**
   * Response Caching
   */

  // Generate cache key
  generateCacheKey(req) {
    return `response:${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
  }

  // Get cache TTL
  getCacheTTL(response) {
    // Implementation depends on your caching strategy
    return 3600; // 1 hour default
  }
}

// Create singleton instance
const responseFormatter = new ResponseFormatter();

// Export instance
module.exports = responseFormatter;
