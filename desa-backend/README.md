# Desa Digital Backend

Backend service for the Desa Digital application, providing API endpoints for village administration management.

## Features

- User Authentication & Authorization
- Resident (Penduduk) Management
- Letter Request Management
- Social Assistance Program Management
- Village Budget (APBDes) Management
- Role-based Access Control
- File Upload Management
- Audit Logging
- API Documentation

## Prerequisites

- Node.js (>= 14.0.0)
- MySQL (>= 5.7)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/desa-digital.git
cd desa-digital/desa-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a .env file:
```bash
cp .env.example .env
```

4. Update the .env file with your configuration.

5. Initialize the database:
```bash
npm run init-db
```

## Development

Start the development server:
```bash
npm run dev
```

The server will start on http://localhost:5000 (or the port specified in your .env file).

## Testing

Run tests:
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## API Documentation

API documentation is available at http://localhost:5000/api/docs when the server is running.

## Project Structure

```
desa-backend/
├── config/             # Configuration files
├── controllers/        # Route controllers
├── middleware/         # Custom middleware
├── models/            # Database models
├── routes/            # Route definitions
├── scripts/           # Utility scripts
├── tests/             # Test files
├── uploads/           # File uploads
└── utils/             # Utility functions
```

## API Endpoints

### Authentication
- POST /api/auth/register - Register new user
- POST /api/auth/login - User login
- GET /api/auth/profile - Get user profile
- PUT /api/auth/profile - Update user profile

### Penduduk (Residents)
- GET /api/penduduk - Get all residents
- GET /api/penduduk/:id - Get resident by ID
- POST /api/penduduk - Create new resident
- PUT /api/penduduk/:id - Update resident
- DELETE /api/penduduk/:id - Delete resident

### Surat (Letters)
- GET /api/surat - Get all letter requests
- GET /api/surat/:id - Get letter request by ID
- POST /api/surat - Create new letter request
- PUT /api/surat/:id/status - Update letter status

### Bantuan Sosial (Social Assistance)
- GET /api/bantuan-sosial - Get all programs
- GET /api/bantuan-sosial/:id - Get program by ID
- POST /api/bantuan-sosial - Create new program
- PUT /api/bantuan-sosial/:id - Update program
- POST /api/bantuan-sosial/:id/penerima - Add recipient

### APBDes (Village Budget)
- GET /api/apbdes - Get all budget entries
- GET /api/apbdes/:id - Get budget entry by ID
- POST /api/apbdes - Create new budget entry
- PUT /api/apbdes/:id - Update budget entry
- PUT /api/apbdes/:id/realisasi - Update realization

## Error Handling

The API uses the following error status codes:

- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Support

For support, email support@desadigital.com or create an issue in the repository.
