// src/config/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';
import settings from './settings';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Crevy platform API Documentation',
      version: '2.0.0',
      description: 'API documentation for the Crevy platform backend services.',
      contact: {
        name: 'Crevy Support',
        url: 'https://crevy.io',
      },
    },
    servers: [
      {
        url: `http://localhost:${settings.APP_PORT}/api/${settings.API_VERSION}`,
        description: 'Local development server',
      },
      {
        url: `https://crevy-backend.onrender.com/api/${settings.API_VERSION}`,
        description: 'Staging server',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token', // Correct name for Better Auth cookies
        },
      },
    },
    security: [
      {
        cookieAuth: [],
      },
    ],
  },
  // Path to the API docs
  apis: ['./src/v2/**/*.route.ts', './src/v2/**/*.schema.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
