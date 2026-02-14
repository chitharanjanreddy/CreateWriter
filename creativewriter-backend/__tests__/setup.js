// Set test environment variables before anything loads
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_EXPIRE = '1h';
process.env.JWT_COOKIE_EXPIRE = '1';
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_test_secret';

// Suppress console output during tests
const noop = () => {};
global.console = {
  ...console,
  log: noop,
  error: noop,
  warn: noop,
  info: noop,
  debug: noop
};
