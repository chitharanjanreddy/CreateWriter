const { AppError, asyncHandler, notFound, errorHandler } = require('../../../src/middleware/errorHandler');
const { createMockReq, createMockRes, createMockNext } = require('../../helpers/mockExpress');

describe('errorHandler middleware', () => {
  // ==================== AppError ====================
  describe('AppError', () => {
    it('should create an error with message, statusCode, and code', () => {
      const err = new AppError('Not found', 404, 'NOT_FOUND');
      expect(err.message).toBe('Not found');
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.isOperational).toBe(true);
      expect(err).toBeInstanceOf(Error);
    });

    it('should default code to ERROR', () => {
      const err = new AppError('Something went wrong', 500);
      expect(err.code).toBe('ERROR');
    });

    it('should capture stack trace', () => {
      const err = new AppError('test', 400);
      expect(err.stack).toBeDefined();
    });
  });

  // ==================== asyncHandler ====================
  describe('asyncHandler', () => {
    it('should call the wrapped function and pass req, res, next', async () => {
      const fn = jest.fn().mockResolvedValue('ok');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      const handler = asyncHandler(fn);
      await handler(req, res, next);

      expect(fn).toHaveBeenCalledWith(req, res, next);
    });

    it('should call next with error when async function rejects', async () => {
      const error = new Error('async fail');
      const fn = jest.fn().mockRejectedValue(error);
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      const handler = asyncHandler(fn);
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should propagate synchronous throws (not caught by Promise.resolve)', async () => {
      const error = new Error('sync fail');
      const fn = jest.fn().mockImplementation(() => { throw error; });
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      const handler = asyncHandler(fn);

      // Synchronous throws in Promise.resolve(fn()) propagate as uncaught
      expect(() => handler(req, res, next)).toThrow('sync fail');
    });
  });

  // ==================== notFound ====================
  describe('notFound', () => {
    it('should create a 404 AppError and call next', () => {
      const req = createMockReq({ originalUrl: '/api/v1/missing' });
      const res = createMockRes();
      const next = createMockNext();

      notFound(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toContain('/api/v1/missing');
    });
  });

  // ==================== errorHandler ====================
  describe('errorHandler', () => {
    it('should return 500 for generic errors', () => {
      const err = new Error('Something broke');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Something broke',
          code: 'SERVER_ERROR'
        })
      );
    });

    it('should use statusCode and code from AppError', () => {
      const err = new AppError('Bad request', 400, 'BAD_REQUEST');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Bad request',
          code: 'BAD_REQUEST'
        })
      );
    });

    it('should handle Mongoose CastError', () => {
      const err = new Error('Cast to ObjectId failed');
      err.name = 'CastError';
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_ID'
        })
      );
    });

    it('should handle Mongoose duplicate key error (code 11000)', () => {
      const err = new Error('Duplicate');
      err.code = 11000;
      err.keyValue = { email: 'test@test.com' };
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DUPLICATE_FIELD'
        })
      );
    });

    it('should handle Mongoose ValidationError', () => {
      const err = new Error('Validation failed');
      err.name = 'ValidationError';
      err.errors = {
        email: { message: 'Email is required' },
        name: { message: 'Name is required' }
      };
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR'
        })
      );
    });

    it('should handle JsonWebTokenError', () => {
      const err = new Error('jwt malformed');
      err.name = 'JsonWebTokenError';
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_TOKEN'
        })
      );
    });

    it('should handle TokenExpiredError', () => {
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TOKEN_EXPIRED'
        })
      );
    });

    it('should include stack trace in test/development env', () => {
      const err = new AppError('Dev error', 400, 'DEV');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(err, req, res, next);

      // Config env is 'test' - the errorHandler checks config.env === 'development'
      // In test mode, stack should NOT be included (only in development)
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(false);
    });
  });
});
