const crypto = require('crypto');

jest.mock('../../src/models/User');
jest.mock('../../src/models/SubscriptionPlan');
jest.mock('../../src/models/Subscription');

const User = require('../../src/models/User');
const SubscriptionPlan = require('../../src/models/SubscriptionPlan');
const Subscription = require('../../src/models/Subscription');
const { createMockReq, createMockRes, createMockNext, flushPromises } = require('../helpers/mockExpress');

const {
  register,
  login,
  logout,
  getMe,
  updatePassword,
  forgotPassword,
  resetPassword
} = require('../../src/controllers/authController');

describe('Auth Controller (Integration)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== register ====================
  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        _id: 'user123',
        name: 'Test User',
        email: 'test@test.com',
        role: 'user',
        toObject: jest.fn().mockReturnValue({
          _id: 'user123',
          name: 'Test User',
          email: 'test@test.com',
          role: 'user'
        }),
        getSignedJwtToken: jest.fn().mockReturnValue('mock-jwt-token')
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);
      SubscriptionPlan.findOne.mockResolvedValue({ _id: 'plan_free' });
      Subscription.create.mockResolvedValue({});

      const req = createMockReq({
        body: { name: 'Test User', email: 'test@test.com', password: 'Password123' }
      });
      const res = createMockRes();
      const next = createMockNext();

      register(req, res, next);
      await flushPromises();

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@test.com' });
      expect(User.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.cookie).toHaveBeenCalledWith('token', 'mock-jwt-token', expect.objectContaining({
        httpOnly: true
      }));
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true
        })
      );
      // Token must NOT be in response body (httpOnly cookie only)
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.token).toBeUndefined();
    });

    it('should return error if email already exists', async () => {
      User.findOne.mockResolvedValue({ _id: 'existing', email: 'test@test.com' });

      const req = createMockReq({
        body: { name: 'Test', email: 'test@test.com', password: 'Password123' }
      });
      const res = createMockRes();
      const next = createMockNext();

      register(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err.message).toBe('Email already registered');
      expect(err.statusCode).toBe(400);
    });

    it('should create free subscription for new user', async () => {
      const mockUser = {
        _id: 'user123',
        name: 'Test',
        email: 'test@test.com',
        toObject: jest.fn().mockReturnValue({ _id: 'user123' }),
        getSignedJwtToken: jest.fn().mockReturnValue('token')
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);
      SubscriptionPlan.findOne.mockResolvedValue({ _id: 'free_plan_id' });
      Subscription.create.mockResolvedValue({});

      const req = createMockReq({
        body: { name: 'Test', email: 'test@test.com', password: 'Pass123' }
      });
      const res = createMockRes();
      const next = createMockNext();

      register(req, res, next);
      await flushPromises();

      expect(SubscriptionPlan.findOne).toHaveBeenCalledWith({ tier: 'free' });
      expect(Subscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'user123',
          plan: 'free_plan_id',
          status: 'active'
        })
      );
    });

    it('should still succeed if free subscription creation fails', async () => {
      const mockUser = {
        _id: 'user123',
        toObject: jest.fn().mockReturnValue({ _id: 'user123' }),
        getSignedJwtToken: jest.fn().mockReturnValue('token')
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);
      SubscriptionPlan.findOne.mockResolvedValue({ _id: 'plan_free' });
      Subscription.create.mockRejectedValue(new Error('DB error'));

      const req = createMockReq({
        body: { name: 'Test', email: 'test@test.com', password: 'Pass123' }
      });
      const res = createMockRes();
      const next = createMockNext();

      register(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should lowercase the email before saving', async () => {
      const mockUser = {
        _id: 'user123',
        toObject: jest.fn().mockReturnValue({ _id: 'user123' }),
        getSignedJwtToken: jest.fn().mockReturnValue('token')
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);
      SubscriptionPlan.findOne.mockResolvedValue(null);

      const req = createMockReq({
        body: { name: 'Test', email: 'TEST@TEST.COM', password: 'Pass123' }
      });
      const res = createMockRes();
      const next = createMockNext();

      register(req, res, next);
      await flushPromises();

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@test.com' });
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@test.com' })
      );
    });
  });

  // ==================== login ====================
  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@test.com',
        isActive: true,
        stats: { lastActive: null },
        matchPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ _id: 'user123', email: 'test@test.com' }),
        getSignedJwtToken: jest.fn().mockReturnValue('jwt-token')
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = createMockReq({
        body: { email: 'test@test.com', password: 'Password123' }
      });
      const res = createMockRes();
      const next = createMockNext();

      login(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.cookie).toHaveBeenCalledWith('token', 'jwt-token', expect.objectContaining({
        httpOnly: true
      }));
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Login successful'
        })
      );
      // Token must NOT be in response body (httpOnly cookie only)
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.token).toBeUndefined();
    });

    it('should return error when email or password missing', async () => {
      const req = createMockReq({ body: { email: '', password: '' } });
      const res = createMockRes();
      const next = createMockNext();

      login(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('MISSING_CREDENTIALS');
    });

    it('should return error when user not found', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      const req = createMockReq({
        body: { email: 'notfound@test.com', password: 'Pass123' }
      });
      const res = createMockRes();
      const next = createMockNext();

      login(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return error when account is deactivated', async () => {
      const mockUser = { _id: 'user123', isActive: false, matchPassword: jest.fn() };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = createMockReq({
        body: { email: 'test@test.com', password: 'Pass123' }
      });
      const res = createMockRes();
      const next = createMockNext();

      login(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('ACCOUNT_DEACTIVATED');
    });

    it('should return error when password is wrong', async () => {
      const mockUser = { _id: 'user123', isActive: true, matchPassword: jest.fn().mockResolvedValue(false) };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = createMockReq({
        body: { email: 'test@test.com', password: 'WrongPass' }
      });
      const res = createMockRes();
      const next = createMockNext();

      login(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('INVALID_CREDENTIALS');
    });

    it('should update lastActive on successful login', async () => {
      const mockUser = {
        _id: 'user123',
        isActive: true,
        stats: { lastActive: null },
        matchPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ _id: 'user123' }),
        getSignedJwtToken: jest.fn().mockReturnValue('token')
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = createMockReq({
        body: { email: 'test@test.com', password: 'Pass123' }
      });
      const res = createMockRes();
      const next = createMockNext();

      login(req, res, next);
      await flushPromises();

      expect(mockUser.stats.lastActive).toBeInstanceOf(Date);
      expect(mockUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
    });
  });

  // ==================== logout ====================
  describe('POST /auth/logout', () => {
    it('should clear token cookie and return success', async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      logout(req, res, next);
      await flushPromises();

      expect(res.cookie).toHaveBeenCalledWith('token', 'none', expect.objectContaining({
        httpOnly: true
      }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Logged out successfully'
        })
      );
    });
  });

  // ==================== getMe ====================
  describe('GET /auth/me', () => {
    it('should return current user with subscription info', async () => {
      const mockUser = {
        _id: 'user123',
        name: 'Test',
        toObject: jest.fn().mockReturnValue({ _id: 'user123', name: 'Test' })
      };
      const mockSubscription = {
        plan: { name: 'Pro', tier: 'pro' },
        status: 'active',
        usage: { lyricsGenerated: 5 },
        endDate: new Date()
      };

      User.findById.mockResolvedValue(mockUser);
      Subscription.getForUser.mockResolvedValue(mockSubscription);

      const req = createMockReq({ user: { id: 'user123', _id: 'user123' } });
      const res = createMockRes();
      const next = createMockNext();

      getMe(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.subscription).toBeDefined();
      expect(response.data.subscription.plan.name).toBe('Pro');
    });

    it('should return user without subscription if none exists', async () => {
      const mockUser = {
        _id: 'user123',
        name: 'Test',
        toObject: jest.fn().mockReturnValue({ _id: 'user123', name: 'Test' })
      };

      User.findById.mockResolvedValue(mockUser);
      Subscription.getForUser.mockResolvedValue(null);

      const req = createMockReq({ user: { id: 'user123' } });
      const res = createMockRes();
      const next = createMockNext();

      getMe(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.data.subscription).toBeUndefined();
    });
  });

  // ==================== updatePassword ====================
  describe('PUT /auth/updatepassword', () => {
    it('should update password successfully', async () => {
      const mockUser = {
        _id: 'user123',
        matchPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ _id: 'user123' }),
        getSignedJwtToken: jest.fn().mockReturnValue('new-token')
      };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = createMockReq({
        user: { id: 'user123' },
        body: { currentPassword: 'OldPass123', newPassword: 'NewPass123' }
      });
      const res = createMockRes();
      const next = createMockNext();

      updatePassword(req, res, next);
      await flushPromises();

      expect(mockUser.password).toBe('NewPass123');
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return error when passwords are missing', async () => {
      const req = createMockReq({
        user: { id: 'user123' },
        body: {}
      });
      const res = createMockRes();
      const next = createMockNext();

      updatePassword(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('MISSING_PASSWORDS');
    });

    it('should return error when current password is wrong', async () => {
      const mockUser = {
        _id: 'user123',
        matchPassword: jest.fn().mockResolvedValue(false)
      };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = createMockReq({
        user: { id: 'user123' },
        body: { currentPassword: 'WrongPass', newPassword: 'NewPass123' }
      });
      const res = createMockRes();
      const next = createMockNext();

      updatePassword(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('INVALID_PASSWORD');
    });

    it('should return error when new password is too short', async () => {
      const mockUser = {
        _id: 'user123',
        matchPassword: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = createMockReq({
        user: { id: 'user123' },
        body: { currentPassword: 'OldPass', newPassword: 'short' }
      });
      const res = createMockRes();
      const next = createMockNext();

      updatePassword(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('PASSWORD_TOO_SHORT');
    });
  });

  // ==================== forgotPassword ====================
  describe('POST /auth/forgotpassword', () => {
    it('should generate reset token for valid email', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@test.com',
        getResetPasswordToken: jest.fn().mockReturnValue('reset-token-123'),
        save: jest.fn().mockResolvedValue(true)
      };
      User.findOne.mockResolvedValue(mockUser);

      const req = createMockReq({ body: { email: 'test@test.com' } });
      const res = createMockRes();
      const next = createMockNext();

      forgotPassword(req, res, next);
      await flushPromises();

      expect(mockUser.getResetPasswordToken).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ resetToken: 'reset-token-123' })
        })
      );
    });

    it('should return error for non-existent email', async () => {
      User.findOne.mockResolvedValue(null);

      const req = createMockReq({ body: { email: 'noone@test.com' } });
      const res = createMockRes();
      const next = createMockNext();

      forgotPassword(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('USER_NOT_FOUND');
    });
  });

  // ==================== resetPassword ====================
  describe('PUT /auth/resetpassword/:resettoken', () => {
    it('should reset password with valid token', async () => {
      const resetToken = 'abc123';
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      const mockUser = {
        _id: 'user123',
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ _id: 'user123' }),
        getSignedJwtToken: jest.fn().mockReturnValue('new-jwt')
      };
      User.findOne.mockResolvedValue(mockUser);

      const req = createMockReq({
        params: { resettoken: resetToken },
        body: { password: 'NewPassword123' }
      });
      const res = createMockRes();
      const next = createMockNext();

      resetPassword(req, res, next);
      await flushPromises();

      expect(User.findOne).toHaveBeenCalledWith({
        passwordResetToken: hashedToken,
        passwordResetExpire: { $gt: expect.any(Number) }
      });
      expect(mockUser.password).toBe('NewPassword123');
      expect(mockUser.passwordResetToken).toBeUndefined();
      expect(mockUser.passwordResetExpire).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return error for invalid/expired token', async () => {
      User.findOne.mockResolvedValue(null);

      const req = createMockReq({
        params: { resettoken: 'expired-token' },
        body: { password: 'NewPassword123' }
      });
      const res = createMockRes();
      const next = createMockNext();

      resetPassword(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('INVALID_TOKEN');
      expect(err.statusCode).toBe(400);
    });
  });
});
