const { Client } = require('@elastic/elasticsearch');
const logger = require('./logger');
const config = require('./config');
const metrics = require('./metrics');
const eventManager = require('./eventManager');

class SearchManager {
  constructor() {
    this.client = null;
    this.indices = {
      penduduk: 'penduduk',
      surat: 'surat_requests',
      bantuan: 'bantuan_sosial',
      apbdes: 'apbdes'
    };
    this.initialize();
  }

  // Initialize Elasticsearch client
  initialize() {
    try {
      this.client = new Client({
        node: config.get('elasticsearch.url') || 'http://localhost:9200',
        auth: {
          username: config.get('elasticsearch.username'),
          password: config.get('elasticsearch.password')
        },
        maxRetries: 3,
        requestTimeout: 10000
      });

      this.setupIndices();
      logger.info('Search manager initialized successfully');
    } catch (error) {
      logger.error('Search manager initialization error:', error);
      throw error;
    }
  }

  // Setup search indices
  async setupIndices() {
    try {
      for (const [key, index] of Object.entries(this.indices)) {
        const exists = await this.client.indices.exists({ index });
        
        if (!exists) {
          await this.createIndex(index, this.getIndexMapping(key));
          logger.info(`Created search index: ${index}`);
        }
      }
    } catch (error) {
      logger.error('Error setting up indices:', error);
      throw error;
    }
  }

  // Create search index
  async createIndex(index, mapping) {
    try {
      await this.client.indices.create({
        index,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1,
            analysis: {
              analyzer: {
                indonesian_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'indonesian_stop', 'indonesian_stemmer']
                }
              },
              filter: {
                indonesian_stop: {
                  type: 'stop',
                  stopwords: '_indonesian_'
                },
                indonesian_stemmer: {
                  type: 'stemmer',
                  language: 'indonesian'
                }
              }
            }
          },
          mappings: mapping
        }
      });
    } catch (error) {
      logger.error(`Error creating index ${index}:`, error);
      throw error;
    }
  }

  // Get index mapping based on type
  getIndexMapping(type) {
    const mappings = {
      penduduk: {
        properties: {
          nik: { type: 'keyword' },
          nama: {
            type: 'text',
            analyzer: 'indonesian_analyzer',
            fields: { keyword: { type: 'keyword' } }
          },
          tempatLahir: { type: 'text', analyzer: 'indonesian_analyzer' },
          tanggalLahir: { type: 'date' },
          jenisKelamin: { type: 'keyword' },
          alamat: { type: 'text', analyzer: 'indonesian_analyzer' },
          rt: { type: 'keyword' },
          rw: { type: 'keyword' },
          status: { type: 'keyword' }
        }
      },
      surat: {
        properties: {
          nomorSurat: { type: 'keyword' },
          jenisSurat: { type: 'keyword' },
          pemohon: {
            type: 'text',
            analyzer: 'indonesian_analyzer',
            fields: { keyword: { type: 'keyword' } }
          },
          keperluan: { type: 'text', analyzer: 'indonesian_analyzer' },
          status: { type: 'keyword' },
          tanggalPengajuan: { type: 'date' }
        }
      },
      bantuan: {
        properties: {
          namaProgram: {
            type: 'text',
            analyzer: 'indonesian_analyzer',
            fields: { keyword: { type: 'keyword' } }
          },
          jenisProgram: { type: 'keyword' },
          deskripsi: { type: 'text', analyzer: 'indonesian_analyzer' },
          tahunAnggaran: { type: 'integer' },
          status: { type: 'keyword' }
        }
      },
      apbdes: {
        properties: {
          tahunAnggaran: { type: 'integer' },
          jenis: { type: 'keyword' },
          kategori: { type: 'keyword' },
          uraian: { type: 'text', analyzer: 'indonesian_analyzer' },
          nilaiAnggaran: { type: 'float' }
        }
      }
    };

    return mappings[type] || {};
  }

  // Index document
  async indexDocument(index, document) {
    try {
      const startTime = process.hrtime();

      const result = await this.client.index({
        index: this.indices[index] || index,
        id: document.id.toString(),
        body: document
      });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      metrics.trackSearchOperation('index', duration);

      eventManager.emitEvent('search:indexed', { index, id: document.id });

      return result;
    } catch (error) {
      logger.error(`Error indexing document in ${index}:`, error);
      throw error;
    }
  }

  // Bulk index documents
  async bulkIndex(index, documents) {
    try {
      const startTime = process.hrtime();

      const operations = documents.flatMap(doc => [
        { index: { _index: this.indices[index] || index, _id: doc.id.toString() } },
        doc
      ]);

      const result = await this.client.bulk({ body: operations });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      metrics.trackSearchOperation('bulkIndex', duration);

      return result;
    } catch (error) {
      logger.error(`Error bulk indexing documents in ${index}:`, error);
      throw error;
    }
  }

  // Update document
  async updateDocument(index, id, document) {
    try {
      const result = await this.client.update({
        index: this.indices[index] || index,
        id: id.toString(),
        body: { doc: document }
      });

      eventManager.emitEvent('search:updated', { index, id });

      return result;
    } catch (error) {
      logger.error(`Error updating document in ${index}:`, error);
      throw error;
    }
  }

  // Delete document
  async deleteDocument(index, id) {
    try {
      const result = await this.client.delete({
        index: this.indices[index] || index,
        id: id.toString()
      });

      eventManager.emitEvent('search:deleted', { index, id });

      return result;
    } catch (error) {
      logger.error(`Error deleting document from ${index}:`, error);
      throw error;
    }
  }

  // Search documents
  async search(index, query) {
    try {
      const startTime = process.hrtime();

      const result = await this.client.search({
        index: this.indices[index] || index,
        body: this.buildSearchQuery(query)
      });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      metrics.trackSearchOperation('search', duration);

      return this.formatSearchResults(result);
    } catch (error) {
      logger.error(`Error searching in ${index}:`, error);
      throw error;
    }
  }

  // Build search query
  buildSearchQuery(query) {
    const {
      term,
      filters = {},
      sort = {},
      page = 1,
      limit = 10
    } = query;

    const searchQuery = {
      query: {
        bool: {
          must: [],
          filter: []
        }
      },
      from: (page - 1) * limit,
      size: limit,
      sort: []
    };

    // Add search term
    if (term) {
      searchQuery.query.bool.must.push({
        multi_match: {
          query: term,
          fields: ['*'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      });
    }

    // Add filters
    Object.entries(filters).forEach(([field, value]) => {
      if (Array.isArray(value)) {
        searchQuery.query.bool.filter.push({
          terms: { [field]: value }
        });
      } else {
        searchQuery.query.bool.filter.push({
          term: { [field]: value }
        });
      }
    });

    // Add sorting
    Object.entries(sort).forEach(([field, order]) => {
      searchQuery.sort.push({ [field]: order });
    });

    return searchQuery;
  }

  // Format search results
  formatSearchResults(result) {
    return {
      total: result.hits.total.value,
      hits: result.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...hit._source
      }))
    };
  }

  // Reindex all documents
  async reindex(index, documents) {
    try {
      // Delete existing index
      await this.client.indices.delete({
        index: this.indices[index] || index,
        ignore_unavailable: true
      });

      // Create new index
      await this.createIndex(this.indices[index] || index, this.getIndexMapping(index));

      // Bulk index documents
      await this.bulkIndex(index, documents);

      logger.info(`Reindexed ${documents.length} documents in ${index}`);
    } catch (error) {
      logger.error(`Error reindexing ${index}:`, error);
      throw error;
    }
  }

  // Check health
  async checkHealth() {
    try {
      const health = await this.client.cluster.health();
      return health.status === 'green' || health.status === 'yellow';
    } catch (error) {
      logger.error('Error checking Elasticsearch health:', error);
      return false;
    }
  }
}

// Create singleton instance
const searchManager = new SearchManager();

// Export instance
module.exports = searchManager;
