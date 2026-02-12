/**
 * Application Configuration
 * Centralized configuration management
 */

require('dotenv').config();

const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  apiVersion: process.env.API_VERSION || 'v1',

  // Database
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/creativewriter',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  },

  // JWT - IMPORTANT: Set JWT_SECRET in environment variables for production
  jwt: {
    secret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'dev-secret-only'),
    expire: process.env.JWT_EXPIRE || '7d',
    cookieExpire: parseInt(process.env.JWT_COOKIE_EXPIRE, 10) || 7
  },

  // Bcrypt
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',') 
      : ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
  },

  // External APIs
  apis: {
    anthropic: {
      key: process.env.ANTHROPIC_API_KEY || '',
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-sonnet-4-20250514'
    },
    suno: {
      key: process.env.SUNO_API_KEY || '',
      baseUrl: 'https://api.suno.ai/v1'
    },
    udio: {
      key: process.env.UDIO_API_KEY || '',
      baseUrl: 'https://api.udio.com/v1'
    },
    heygen: {
      key: process.env.HEYGEN_API_KEY || '',
      baseUrl: 'https://api.heygen.com/v2'
    },
    elevenlabs: {
      key: process.env.ELEVENLABS_API_KEY || '',
      baseUrl: 'https://api.elevenlabs.io/v1'
    }
  },

  // Default Admin - IMPORTANT: Set these in environment variables for production
  defaultAdmin: {
    email: process.env.ADMIN_EMAIL || 'admin@akashinnotech.com',
    password: process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? undefined : 'DevAdmin@123'),
    name: process.env.ADMIN_NAME || 'Admin User'
  },

  // Lyrics Generation
  lyrics: {
    maxTokens: 2500,
    defaultDialect: 'coastal',
    defaultStyle: 'romantic',
    defaultPoetryForm: 'geeyam'
  }
};

// Validate required configuration
const validateConfig = () => {
  const errors = [];

  if (config.env === 'production') {
    if (!config.jwt.secret) {
      errors.push('JWT_SECRET must be set in production');
    }
    if (!config.defaultAdmin.password) {
      errors.push('ADMIN_PASSWORD must be set in production');
    }
    if (!config.mongodb.uri.includes('mongodb+srv')) {
      console.warn('Warning: Using local MongoDB in production');
    }
  }

  if (errors.length > 0) {
    console.error('Configuration Errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }
};

validateConfig();

module.exports = config;
