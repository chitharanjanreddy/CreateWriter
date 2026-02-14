/**
 * Mock config - replaces src/config/config.js in tests
 * No dotenv, no process.exit, safe defaults
 */
module.exports = {
  env: 'test',
  port: 5000,
  apiVersion: 'v1',
  mongodb: {
    uri: 'mongodb://localhost:27017/test',
    options: {}
  },
  jwt: {
    secret: 'test-jwt-secret-key',
    expire: '1h',
    cookieExpire: 1
  },
  bcrypt: {
    saltRounds: 4
  },
  cors: {
    origin: ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  rateLimit: {
    windowMs: 900000,
    max: 1000
  },
  apis: {
    anthropic: { key: 'test-key', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514' },
    suno: { key: '', baseUrl: '' },
    udio: { key: '', baseUrl: '' },
    heygen: { key: '', baseUrl: '' },
    elevenlabs: { key: '', baseUrl: '' }
  },
  defaultAdmin: {
    email: 'admin@test.com',
    password: 'TestAdmin@123',
    name: 'Test Admin'
  },
  razorpay: {
    keyId: 'rzp_test_key',
    keySecret: 'rzp_test_secret',
    webhookSecret: 'webhook_test_secret'
  },
  lyrics: {
    maxTokens: 2500,
    defaultDialect: 'coastal',
    defaultStyle: 'romantic',
    defaultPoetryForm: 'geeyam'
  }
};
