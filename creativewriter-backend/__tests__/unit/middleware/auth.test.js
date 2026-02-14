const jwt = require('jsonwebtoken');
const { createMockReq, createMockRes, createMockNext } = require('../../helpers/mockExpress');

jest.mock('jsonwebtoken');
jest.mock('../../../src/models/User');

const User = require('../../../src/models/User');
const { protect, optionalAuth, authorize, adminOnly } = require('../../../src/middleware/auth');

describe('auth middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== protect ====================
  describe('protect', () => {
    it('should return 401 if no token is provided', async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NO_TOKEN' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should ignore Authorization header and require cookie', async () => {
      const req = createMockReq({
        headers: { authorization: 'Bearer valid-token' }
      });
      const res = createMockRes();
      const next = createMockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NO_TOKEN' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should extract token from cookies', async () => {
      const mockUser = {
        _id: 'user123',
        isActive: true,
        stats: { lastActive: null },
        save: jest.fn().mockResolvedValue(true)
      };
      jwt.verify.mockReturnValue({ id: 'user123' });
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = createMockReq({
        cookies: { token: 'cookie-token' }
      });
      const res = createMockRes();
      const next = createMockNext();

      await protect(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('cookie-token', 'test-jwt-secret-key');
      expect(req.user).toBe(mockUser);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should return 401 if user not found', async () => {
      jwt.verify.mockReturnValue({ id: 'nonexistent' });
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      const req = createMockReq({
        cookies: { token: 'valid-token' }
      });
      const res = createMockRes();
      const next = createMockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'USER_NOT_FOUND' })
      );
    });

    it('should return 401 if user is deactivated', async () => {
      const mockUser = { _id: 'user123', isActive: false };
      jwt.verify.mockReturnValue({ id: 'user123' });
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = createMockReq({
        cookies: { token: 'valid-token' }
      });
      const res = createMockRes();
      const next = createMockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ACCOUNT_DEACTIVATED' })
      );
    });

    it('should update lastActive timestamp', async () => {
      const mockUser = {
        _id: 'user123',
        isActive: true,
        stats: { lastActive: null },
        save: jest.fn().mockResolvedValue(true)
      };
      jwt.verify.mockReturnValue({ id: 'user123' });
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = createMockReq({
        cookies: { token: 'valid-token' }
      });
      const res = createMockRes();
      const next = createMockNext();

      await protect(req, res, next);

      expect(mockUser.stats.lastActive).toBeInstanceOf(Date);
      expect(mockUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
    });

    it('should return 401 with TOKEN_EXPIRED for expired tokens', async () => {
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => { throw err; });

      const req = createMockReq({
        cookies: { token: 'expired-token' }
      });
      const res = createMockRes();
      const next = createMockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'TOKEN_EXPIRED' })
      );
    });

    it('should return 401 with INVALID_TOKEN for malformed tokens', async () => {
      const err = new Error('jwt malformed');
      err.name = 'JsonWebTokenError';
      jwt.verify.mockImplementation(() => { throw err; });

      const req = createMockReq({
        cookies: { token: 'bad-token' }
      });
      const res = createMockRes();
      const next = createMockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_TOKEN' })
      );
    });

    it('should return 401 with AUTH_FAILED for other errors', async () => {
      jwt.verify.mockImplementation(() => { throw new Error('unknown error'); });

      const req = createMockReq({
        cookies: { token: 'some-token' }
      });
      const res = createMockRes();
      const next = createMockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'AUTH_FAILED' })
      );
    });
  });

  // ==================== optionalAuth ====================
  describe('optionalAuth', () => {
    it('should call next without setting user when no token', async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should attach user when valid cookie token is provided', async () => {
      const mockUser = { _id: 'user123', isActive: true };
      jwt.verify.mockReturnValue({ id: 'user123' });
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = createMockReq({
        cookies: { token: 'valid-token' }
      });
      const res = createMockRes();
      const next = createMockNext();

      await optionalAuth(req, res, next);

      expect(req.user).toBe(mockUser);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should ignore Authorization header in optionalAuth', async () => {
      const req = createMockReq({
        headers: { authorization: 'Bearer valid-token' }
      });
      const res = createMockRes();
      const next = createMockNext();

      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should not attach user if user is inactive', async () => {
      const mockUser = { _id: 'user123', isActive: false };
      jwt.verify.mockReturnValue({ id: 'user123' });
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = createMockReq({
        cookies: { token: 'valid-token' }
      });
      const res = createMockRes();
      const next = createMockNext();

      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should call next even when token is invalid', async () => {
      jwt.verify.mockImplementation(() => { throw new Error('invalid'); });

      const req = createMockReq({
        cookies: { token: 'bad-token' }
      });
      const res = createMockRes();
      const next = createMockNext();

      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should read token from cookies', async () => {
      const mockUser = { _id: 'user123', isActive: true };
      jwt.verify.mockReturnValue({ id: 'user123' });
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = createMockReq({
        cookies: { token: 'cookie-token' }
      });
      const res = createMockRes();
      const next = createMockNext();

      await optionalAuth(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('cookie-token', 'test-jwt-secret-key');
      expect(req.user).toBe(mockUser);
    });
  });

  // ==================== authorize ====================
  describe('authorize', () => {
    it('should return 401 if no user on request', () => {
      const middleware = authorize('admin');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NO_USER' })
      );
    });

    it('should return 403 if user role is not authorized', () => {
      const middleware = authorize('admin');
      const req = createMockReq({ user: { role: 'user' } });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN' })
      );
    });

    it('should call next when user role is authorized', () => {
      const middleware = authorize('admin', 'user');
      const req = createMockReq({ user: { role: 'admin' } });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should accept multiple roles', () => {
      const middleware = authorize('admin', 'user');
      const req = createMockReq({ user: { role: 'user' } });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== adminOnly ====================
  describe('adminOnly', () => {
    it('should return 401 if no user on request', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NO_USER' })
      );
    });

    it('should return 403 if user is not admin', () => {
      const req = createMockReq({ user: { role: 'user' } });
      const res = createMockRes();
      const next = createMockNext();

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ADMIN_REQUIRED' })
      );
    });

    it('should call next when user is admin', () => {
      const req = createMockReq({ user: { role: 'admin' } });
      const res = createMockRes();
      const next = createMockNext();

      adminOnly(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
