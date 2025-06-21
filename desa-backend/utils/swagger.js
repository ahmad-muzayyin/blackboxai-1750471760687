const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const packageJson = require('../package.json');

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Desa Digital API Documentation',
    version: packageJson.version,
    description: 'API documentation for Desa Digital application',
    license: {
      name: 'ISC',
      url: 'https://opensource.org/licenses/ISC',
    },
    contact: {
      name: 'Desa Digital Support',
      url: 'https://desadigital.com',
      email: 'support@desadigital.com',
    },
  },
  servers: [
    {
      url: process.env.API_URL || 'http://localhost:5000',
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            example: 'Error message',
          },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string',
                  example: 'email',
                },
                message: {
                  type: 'string',
                  example: 'Invalid email format',
                },
              },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
          },
          username: {
            type: 'string',
            example: 'johndoe',
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'john@example.com',
          },
          role: {
            type: 'string',
            enum: ['admin_desa', 'perangkat_desa', 'warga'],
            example: 'warga',
          },
          isActive: {
            type: 'boolean',
            example: true,
          },
        },
      },
      Penduduk: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
          },
          nik: {
            type: 'string',
            example: '1234567890123456',
          },
          nama: {
            type: 'string',
            example: 'John Doe',
          },
          tempatLahir: {
            type: 'string',
            example: 'Jakarta',
          },
          tanggalLahir: {
            type: 'string',
            format: 'date',
            example: '1990-01-01',
          },
          jenisKelamin: {
            type: 'string',
            enum: ['L', 'P'],
            example: 'L',
          },
        },
      },
      SuratRequest: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
          },
          nomorSurat: {
            type: 'string',
            example: 'SURAT/2023/001',
          },
          jenisSurat: {
            type: 'string',
            enum: [
              'SURAT_KETERANGAN_DOMISILI',
              'SURAT_KETERANGAN_USAHA',
              'SURAT_KETERANGAN_TIDAK_MAMPU',
            ],
            example: 'SURAT_KETERANGAN_DOMISILI',
          },
          status: {
            type: 'string',
            enum: ['PENDING', 'VERIFIED', 'APPROVED', 'REJECTED', 'COMPLETED'],
            example: 'PENDING',
          },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication information is missing or invalid',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
    },
  },
  security: [{
    BearerAuth: [],
  }],
};

// Options for the swagger docs
const options = {
  // Import swaggerDefinitions
  swaggerDefinition,
  // Path to the API docs
  apis: [
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../models/*.js'),
    path.join(__dirname, '../controllers/*.js'),
  ],
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(options);

// Swagger setup function
const setupSwagger = (app) => {
  // Swagger page
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Desa Digital API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      deepLinking: true,
    },
  }));

  // Docs in JSON format
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('Swagger documentation initialized at /api/docs');
};

module.exports = {
  setupSwagger,
  swaggerSpec,
};

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication endpoints
 *   - name: Users
 *     description: User management endpoints
 *   - name: Penduduk
 *     description: Resident management endpoints
 *   - name: Surat
 *     description: Letter request management endpoints
 *   - name: BantuanSosial
 *     description: Social assistance management endpoints
 *   - name: APBDes
 *     description: Village budget management endpoints
 * 
 * components:
 *   parameters:
 *     pageParam:
 *       in: query
 *       name: page
 *       schema:
 *         type: integer
 *         minimum: 1
 *         default: 1
 *       description: Page number for pagination
 *     limitParam:
 *       in: query
 *       name: limit
 *       schema:
 *         type: integer
 *         minimum: 1
 *         maximum: 100
 *         default: 10
 *       description: Number of items per page
 *     searchParam:
 *       in: query
 *       name: search
 *       schema:
 *         type: string
 *       description: Search term for filtering results
 *     sortParam:
 *       in: query
 *       name: sort
 *       schema:
 *         type: string
 *       description: Sort field and direction (e.g., "createdAt:desc")
 */
