const { Op } = require('sequelize');
const logger = require('./logger');

class QueryHandler {
  constructor() {
    this.defaultOptions = {
      page: 1,
      limit: 10,
      maxLimit: 100,
      sortField: 'createdAt',
      sortOrder: 'DESC'
    };
  }

  // Parse pagination parameters
  parsePagination(query) {
    const page = Math.max(1, parseInt(query.page) || this.defaultOptions.page);
    const limit = Math.min(
      this.defaultOptions.maxLimit,
      Math.max(1, parseInt(query.limit) || this.defaultOptions.limit)
    );
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  // Parse sorting parameters
  parseSort(query, allowedFields) {
    let sortField = query.sort || this.defaultOptions.sortField;
    let sortOrder = query.order || this.defaultOptions.sortOrder;

    // Remove any potential SQL injection
    sortField = sortField.replace(/[^a-zA-Z0-9_]/g, '');
    sortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Validate sort field if allowedFields is provided
    if (allowedFields && !allowedFields.includes(sortField)) {
      sortField = this.defaultOptions.sortField;
    }

    return [[sortField, sortOrder]];
  }

  // Parse filtering parameters
  parseFilters(query, filterConfig) {
    const filters = {};

    if (!filterConfig) {
      return filters;
    }

    Object.entries(filterConfig).forEach(([field, config]) => {
      const value = query[field];
      if (value !== undefined && value !== '') {
        switch (config.type) {
          case 'string':
            filters[field] = this.handleStringFilter(value, config);
            break;
          case 'number':
            filters[field] = this.handleNumberFilter(value, config);
            break;
          case 'boolean':
            filters[field] = this.handleBooleanFilter(value);
            break;
          case 'date':
            filters[field] = this.handleDateFilter(value, config);
            break;
          case 'array':
            filters[field] = this.handleArrayFilter(value, config);
            break;
          default:
            filters[field] = value;
        }
      }
    });

    return filters;
  }

  // Handle string filters
  handleStringFilter(value, config) {
    if (config.exact) {
      return value;
    }
    return { [Op.iLike]: `%${value}%` };
  }

  // Handle number filters
  handleNumberFilter(value, config) {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return undefined;
    }

    if (config.range) {
      const [min, max] = value.split(',').map(v => parseFloat(v));
      return {
        [Op.between]: [
          isNaN(min) ? -Infinity : min,
          isNaN(max) ? Infinity : max
        ]
      };
    }

    return num;
  }

  // Handle boolean filters
  handleBooleanFilter(value) {
    return value === 'true' || value === '1';
  }

  // Handle date filters
  handleDateFilter(value, config) {
    if (config.range) {
      const [start, end] = value.split(',');
      return {
        [Op.between]: [
          start ? new Date(start) : new Date(0),
          end ? new Date(end) : new Date()
        ]
      };
    }
    return new Date(value);
  }

  // Handle array filters
  handleArrayFilter(value, config) {
    const values = Array.isArray(value) ? value : value.split(',');
    return { [Op.in]: values };
  }

  // Build search conditions
  buildSearchCondition(searchTerm, searchFields) {
    if (!searchTerm || !searchFields || !searchFields.length) {
      return {};
    }

    return {
      [Op.or]: searchFields.map(field => ({
        [field]: { [Op.iLike]: `%${searchTerm}%` }
      }))
    };
  }

  // Build complete query options
  buildQueryOptions({
    query,
    filterConfig,
    searchFields,
    allowedSortFields,
    include = [],
    attributes = null
  }) {
    try {
      const { page, limit, offset } = this.parsePagination(query);
      const order = this.parseSort(query, allowedSortFields);
      const where = {
        ...this.parseFilters(query, filterConfig),
        ...this.buildSearchCondition(query.search, searchFields)
      };

      const options = {
        where,
        order,
        limit,
        offset,
        include
      };

      if (attributes) {
        options.attributes = attributes;
      }

      return {
        options,
        pagination: { page, limit }
      };
    } catch (error) {
      logger.error('Error building query options:', error);
      throw error;
    }
  }

  // Format response with pagination
  formatPaginatedResponse(data, total, { page, limit }) {
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  }

  // Example filter configurations
  static filterConfigs = {
    penduduk: {
      nik: { type: 'string', exact: true },
      nama: { type: 'string' },
      jenisKelamin: { type: 'string', exact: true },
      tanggalLahir: { type: 'date', range: true },
      status: { type: 'string', exact: true }
    },
    suratRequest: {
      nomorSurat: { type: 'string', exact: true },
      jenisSurat: { type: 'string', exact: true },
      status: { type: 'string', exact: true },
      tanggalPengajuan: { type: 'date', range: true }
    },
    bantuanSosial: {
      namaProgram: { type: 'string' },
      jenisProgram: { type: 'string', exact: true },
      tahunAnggaran: { type: 'number', exact: true },
      status: { type: 'string', exact: true },
      nilaiManfaat: { type: 'number', range: true }
    },
    apbdes: {
      tahunAnggaran: { type: 'number', exact: true },
      jenis: { type: 'string', exact: true },
      kategori: { type: 'string', exact: true },
      status: { type: 'string', exact: true },
      nilaiAnggaran: { type: 'number', range: true }
    }
  };
}

// Create singleton instance
const queryHandler = new QueryHandler();

// Export instance
module.exports = queryHandler;
