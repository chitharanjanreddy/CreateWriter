const { createMockReq, createMockRes, createMockNext } = require('../../helpers/mockExpress');

jest.mock('../../../src/models/Subscription');

const Subscription = require('../../../src/models/Subscription');
const { checkUsageLimit, incrementUsage } = require('../../../src/middleware/usageLimit');

describe('usageLimit middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== checkUsageLimit ====================
  describe('checkUsageLimit', () => {
    it('should call next with AppError if no user on request', async () => {
      const middleware = checkUsageLimit('lyrics');
      const req = createMockReq({ user: null });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err.message).toBe('Authentication required');
      expect(err.statusCode).toBe(401);
    });

    it('should call next with AppError if no subscription found', async () => {
      Subscription.getForUser.mockResolvedValue(null);

      const middleware = checkUsageLimit('lyrics');
      const req = createMockReq({ user: { _id: 'user123' } });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('NO_SUBSCRIPTION');
      expect(err.statusCode).toBe(403);
    });

    it('should call next with AppError if subscription has no plan', async () => {
      Subscription.getForUser.mockResolvedValue({ status: 'active', plan: null });

      const middleware = checkUsageLimit('lyrics');
      const req = createMockReq({ user: { _id: 'user123' } });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('NO_SUBSCRIPTION');
    });

    it('should call next with AppError if subscription is inactive', async () => {
      Subscription.getForUser.mockResolvedValue({
        status: 'cancelled',
        plan: { name: 'Pro' }
      });

      const middleware = checkUsageLimit('lyrics');
      const req = createMockReq({ user: { _id: 'user123' } });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('SUBSCRIPTION_INACTIVE');
      expect(err.statusCode).toBe(403);
    });

    it('should allow active subscription status', async () => {
      const mockSub = {
        status: 'active',
        plan: { name: 'Pro', limits: { lyricsPerMonth: 30 } },
        checkLimit: jest.fn().mockReturnValue({ allowed: true, current: 5, limit: 30, remaining: 25 }),
        usage: { periodEnd: new Date() }
      };
      Subscription.getForUser.mockResolvedValue(mockSub);

      const middleware = checkUsageLimit('lyrics');
      const req = createMockReq({ user: { _id: 'user123' } });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.subscription).toBe(mockSub);
    });

    it('should allow trial subscription status', async () => {
      const mockSub = {
        status: 'trial',
        plan: { name: 'Pro', limits: { lyricsPerMonth: 30 } },
        checkLimit: jest.fn().mockReturnValue({ allowed: true, current: 0, limit: 30, remaining: 30 }),
        usage: { periodEnd: new Date() }
      };
      Subscription.getForUser.mockResolvedValue(mockSub);

      const middleware = checkUsageLimit('lyrics');
      const req = createMockReq({ user: { _id: 'user123' } });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should return 403 FEATURE_NOT_AVAILABLE when limit is 0', async () => {
      const mockSub = {
        status: 'active',
        plan: { name: 'Free', limits: { musicGenerations: 0 } },
        checkLimit: jest.fn().mockReturnValue({ allowed: false, current: 0, limit: 0, remaining: 0 }),
        usage: { periodEnd: new Date() }
      };
      Subscription.getForUser.mockResolvedValue(mockSub);

      const middleware = checkUsageLimit('music');
      const req = createMockReq({ user: { _id: 'user123' } });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FEATURE_NOT_AVAILABLE' })
      );
    });

    it('should return 429 USAGE_LIMIT_REACHED when limit exceeded', async () => {
      const mockSub = {
        status: 'active',
        plan: { name: 'Free', limits: { lyricsPerMonth: 5 } },
        checkLimit: jest.fn().mockReturnValue({ allowed: false, current: 5, limit: 5, remaining: 0 }),
        usage: { periodEnd: new Date('2025-02-01') }
      };
      Subscription.getForUser.mockResolvedValue(mockSub);

      const middleware = checkUsageLimit('lyrics');
      const req = createMockReq({ user: { _id: 'user123' } });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'USAGE_LIMIT_REACHED',
          data: expect.objectContaining({
            current: 5,
            limit: 5,
            remaining: 0
          })
        })
      );
    });

    it('should attach subscription to req on success', async () => {
      const mockSub = {
        status: 'active',
        plan: { name: 'Pro', limits: {} },
        checkLimit: jest.fn().mockReturnValue({ allowed: true, current: 1, limit: 30, remaining: 29 }),
        usage: { periodEnd: new Date() }
      };
      Subscription.getForUser.mockResolvedValue(mockSub);

      const middleware = checkUsageLimit('lyrics');
      const req = createMockReq({ user: { _id: 'user123' } });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(req.subscription).toBe(mockSub);
    });

    it('should call next() without error when an exception occurs (fail-open)', async () => {
      Subscription.getForUser.mockRejectedValue(new Error('DB error'));

      const middleware = checkUsageLimit('lyrics');
      const req = createMockReq({ user: { _id: 'user123' } });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      // Should fail open - call next without error argument
      expect(next).toHaveBeenCalledWith();
    });
  });

  // ==================== incrementUsage ====================
  describe('incrementUsage', () => {
    it('should increment usage on subscription', async () => {
      const mockSub = {
        incrementUsage: jest.fn().mockResolvedValue(true)
      };
      Subscription.getForUser.mockResolvedValue(mockSub);

      await incrementUsage('lyrics', 'user123');

      expect(Subscription.getForUser).toHaveBeenCalledWith('user123');
      expect(mockSub.incrementUsage).toHaveBeenCalledWith('lyrics');
    });

    it('should not throw when no subscription found', async () => {
      Subscription.getForUser.mockResolvedValue(null);

      await expect(incrementUsage('lyrics', 'user123')).resolves.toBeUndefined();
    });

    it('should not throw on error', async () => {
      Subscription.getForUser.mockRejectedValue(new Error('DB error'));

      await expect(incrementUsage('lyrics', 'user123')).resolves.toBeUndefined();
    });
  });
});
