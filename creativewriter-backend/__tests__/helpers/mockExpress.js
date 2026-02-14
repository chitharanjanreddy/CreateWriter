/**
 * Mock Express req/res/next factories for unit testing
 */

const createMockReq = (overrides = {}) => ({
  headers: {},
  cookies: {},
  body: {},
  params: {},
  query: {},
  user: null,
  originalUrl: '/test',
  method: 'GET',
  ...overrides
});

const createMockRes = () => {
  const res = {
    statusCode: 200,
    _json: null,
    _cookie: null
  };

  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });

  res.json = jest.fn((data) => {
    res._json = data;
    return res;
  });

  res.cookie = jest.fn((name, value, options) => {
    res._cookie = { name, value, options };
    return res;
  });

  res.send = jest.fn((data) => {
    res._data = data;
    return res;
  });

  return res;
};

const createMockNext = () => jest.fn();

/**
 * Flush pending microtasks/promises.
 * Needed because asyncHandler doesn't return its internal promise,
 * so `await controller(req, res, next)` completes before async work finishes.
 */
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

module.exports = { createMockReq, createMockRes, createMockNext, flushPromises };
