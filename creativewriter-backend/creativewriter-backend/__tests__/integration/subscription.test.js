const crypto = require('crypto');

jest.mock('../../src/models/SubscriptionPlan');
jest.mock('../../src/models/Subscription');
jest.mock('../../src/models/User');
jest.mock('../../src/utils/razorpay');

const SubscriptionPlan = require('../../src/models/SubscriptionPlan');
const Subscription = require('../../src/models/Subscription');
const User = require('../../src/models/User');
const razorpay = require('../../src/utils/razorpay');
const config = require('../../src/config/config');
const { createMockReq, createMockRes, createMockNext, flushPromises } = require('../helpers/mockExpress');

const {
  getPlans,
  createOrder,
  verifyPayment,
  cancelSubscription,
  webhook,
  validatePromo
} = require('../../src/controllers/subscriptionController');

describe('Subscription Controller (Integration)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== getPlans ====================
  describe('GET /subscriptions/plans', () => {
    it('should return all active plans', async () => {
      const mockPlans = [
        { name: 'Free', tier: 'free', pricing: { monthly: 0 } },
        { name: 'Pro', tier: 'pro', pricing: { monthly: 299 } }
      ];

      SubscriptionPlan.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockPlans)
        })
      });

      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      getPlans(req, res, next);
      await flushPromises();

      expect(SubscriptionPlan.find).toHaveBeenCalledWith({ isActive: true });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          count: 2,
          data: mockPlans
        })
      );
    });

    it('should return empty array when no plans exist', async () => {
      SubscriptionPlan.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([])
        })
      });

      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      getPlans(req, res, next);
      await flushPromises();

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ count: 0, data: [] })
      );
    });
  });

  // ==================== createOrder ====================
  describe('POST /subscriptions/create-order', () => {
    it('should create a Razorpay order', async () => {
      const mockPlan = {
        _id: 'plan_pro',
        name: 'Pro',
        tier: 'pro',
        isActive: true,
        pricing: { monthly: 299, yearly: 2999, currency: 'INR' },
        offers: []
      };
      SubscriptionPlan.findById.mockResolvedValue(mockPlan);

      razorpay.createOrder.mockResolvedValue({
        id: 'order_123',
        amount: 29900,
        currency: 'INR'
      });

      const req = createMockReq({
        user: { _id: { toString: () => 'user123' } },
        body: { planId: 'plan_pro', billingCycle: 'monthly' }
      });
      const res = createMockRes();
      const next = createMockNext();

      createOrder(req, res, next);
      await flushPromises();

      expect(razorpay.createOrder).toHaveBeenCalledWith(
        299,
        'INR',
        expect.stringContaining('sub_'),
        expect.objectContaining({ planId: 'plan_pro' })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ orderId: 'order_123' })
        })
      );
    });

    it('should return error when planId or billingCycle missing', async () => {
      const req = createMockReq({
        user: { _id: 'user123' },
        body: {}
      });
      const res = createMockRes();
      const next = createMockNext();

      createOrder(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('MISSING_INPUT');
    });

    it('should return error for non-existent plan', async () => {
      SubscriptionPlan.findById.mockResolvedValue(null);

      const req = createMockReq({
        user: { _id: 'user123' },
        body: { planId: 'nonexistent', billingCycle: 'monthly' }
      });
      const res = createMockRes();
      const next = createMockNext();

      createOrder(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('PLAN_NOT_FOUND');
    });

    it('should return error for free plan', async () => {
      SubscriptionPlan.findById.mockResolvedValue({
        _id: 'plan_free',
        tier: 'free',
        isActive: true
      });

      const req = createMockReq({
        user: { _id: 'user123' },
        body: { planId: 'plan_free', billingCycle: 'monthly' }
      });
      const res = createMockRes();
      const next = createMockNext();

      createOrder(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('FREE_PLAN');
    });

    it('should use yearly pricing for yearly billing cycle', async () => {
      const mockPlan = {
        _id: 'plan_pro',
        name: 'Pro',
        tier: 'pro',
        isActive: true,
        pricing: { monthly: 299, yearly: 2999, currency: 'INR' },
        offers: []
      };
      SubscriptionPlan.findById.mockResolvedValue(mockPlan);
      razorpay.createOrder.mockResolvedValue({
        id: 'order_456',
        amount: 299900,
        currency: 'INR'
      });

      const req = createMockReq({
        user: { _id: { toString: () => 'user123' } },
        body: { planId: 'plan_pro', billingCycle: 'yearly' }
      });
      const res = createMockRes();
      const next = createMockNext();

      createOrder(req, res, next);
      await flushPromises();

      expect(razorpay.createOrder).toHaveBeenCalledWith(
        2999,
        'INR',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should apply promo code discount', async () => {
      const now = new Date();
      const future = new Date(now);
      future.setMonth(future.getMonth() + 1);
      const past = new Date(now);
      past.setMonth(past.getMonth() - 1);

      const mockPlan = {
        _id: { toString: () => 'plan_pro' },
        name: 'Pro',
        tier: 'pro',
        isActive: true,
        pricing: { monthly: 1000, yearly: 10000, currency: 'INR' },
        offers: [
          {
            code: 'SAVE20',
            discountPercentage: 20,
            isActive: true,
            validFrom: past,
            validUntil: future,
            maxRedemptions: -1,
            currentRedemptions: 0
          }
        ]
      };
      SubscriptionPlan.findById.mockResolvedValue(mockPlan);
      razorpay.createOrder.mockResolvedValue({
        id: 'order_promo',
        amount: 80000,
        currency: 'INR'
      });

      const req = createMockReq({
        user: { _id: { toString: () => 'user123' } },
        body: { planId: 'plan_pro', billingCycle: 'monthly', promoCode: 'save20' }
      });
      const res = createMockRes();
      const next = createMockNext();

      createOrder(req, res, next);
      await flushPromises();

      // 1000 * (1 - 20/100) = 800
      expect(razorpay.createOrder).toHaveBeenCalledWith(
        800,
        'INR',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  // ==================== verifyPayment ====================
  describe('POST /subscriptions/verify-payment', () => {
    it('should verify payment and update existing subscription', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(true);
      razorpay.fetchPayment.mockResolvedValue({ amount: 29900 });

      const mockPlan = {
        _id: 'plan_pro',
        name: 'Pro',
        tier: 'pro',
        pricing: { monthly: 299, currency: 'INR' },
        offers: [],
        save: jest.fn().mockResolvedValue(true)
      };
      SubscriptionPlan.findById.mockResolvedValue(mockPlan);

      const mockPaymentHistory = [];
      const mockSub = {
        _id: 'sub_123',
        plan: 'old_plan',
        status: 'pending',
        billingCycle: 'none',
        startDate: null,
        endDate: null,
        renewalDate: null,
        razorpay: {},
        usage: {
          lyricsGenerated: 5,
          musicGenerated: 2,
          videoGenerated: 1,
          voiceGenerated: 0,
          periodStart: null,
          periodEnd: null
        },
        appliedPromo: {},
        paymentHistory: mockPaymentHistory,
        save: jest.fn().mockResolvedValue(true)
      };
      // First call for findOne({ user: ... })
      Subscription.findOne.mockResolvedValue(mockSub);
      // findById().populate() for the final response
      Subscription.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: 'sub_123',
          plan: mockPlan,
          status: 'active'
        })
      });

      const req = createMockReq({
        user: { _id: 'user123' },
        body: {
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_456',
          razorpay_signature: 'valid_sig',
          planId: 'plan_pro',
          billingCycle: 'monthly'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      verifyPayment(req, res, next);
      await flushPromises();

      expect(razorpay.verifyPaymentSignature).toHaveBeenCalledWith('order_123', 'pay_456', 'valid_sig');
      expect(mockSub.plan).toBe('plan_pro');
      expect(mockSub.status).toBe('active');
      expect(mockSub.usage.lyricsGenerated).toBe(0);
      expect(mockSub.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return error when payment details are missing', async () => {
      const req = createMockReq({
        user: { _id: 'user123' },
        body: {}
      });
      const res = createMockRes();
      const next = createMockNext();

      verifyPayment(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('MISSING_PAYMENT_DETAILS');
    });

    it('should return error for invalid signature', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(false);

      const req = createMockReq({
        user: { _id: 'user123' },
        body: {
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_456',
          razorpay_signature: 'invalid_sig',
          planId: 'plan_pro',
          billingCycle: 'monthly'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      verifyPayment(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('INVALID_SIGNATURE');
    });

    it('should return error when plan not found', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(true);
      SubscriptionPlan.findById.mockResolvedValue(null);

      const req = createMockReq({
        user: { _id: 'user123' },
        body: {
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_456',
          razorpay_signature: 'valid_sig',
          planId: 'nonexistent',
          billingCycle: 'monthly'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      verifyPayment(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('PLAN_NOT_FOUND');
    });

    it('should create new subscription if none exists', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(true);
      razorpay.fetchPayment.mockResolvedValue({ amount: 29900 });

      const mockPlan = {
        _id: 'plan_pro',
        name: 'Pro',
        pricing: { monthly: 299, currency: 'INR' },
        offers: [],
        save: jest.fn()
      };
      SubscriptionPlan.findById.mockResolvedValue(mockPlan);
      Subscription.findOne.mockResolvedValue(null);

      const createdSub = { _id: 'new_sub' };
      Subscription.create.mockResolvedValue(createdSub);
      Subscription.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: 'new_sub',
          plan: mockPlan,
          status: 'active'
        })
      });

      const req = createMockReq({
        user: { _id: 'user123' },
        body: {
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_456',
          razorpay_signature: 'valid_sig',
          planId: 'plan_pro',
          billingCycle: 'monthly'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      verifyPayment(req, res, next);
      await flushPromises();

      expect(Subscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'user123',
          plan: 'plan_pro',
          status: 'active',
          billingCycle: 'monthly'
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== cancelSubscription ====================
  describe('POST /subscriptions/cancel', () => {
    it('should cancel an active subscription', async () => {
      const mockSub = {
        _id: 'sub_123',
        plan: { tier: 'pro', name: 'Pro' },
        status: 'active',
        endDate: new Date('2025-03-01'),
        save: jest.fn().mockResolvedValue(true)
      };
      Subscription.getForUser.mockResolvedValue(mockSub);

      const req = createMockReq({ user: { _id: 'user123' } });
      const res = createMockRes();
      const next = createMockNext();

      cancelSubscription(req, res, next);
      await flushPromises();

      expect(mockSub.status).toBe('cancelled');
      expect(mockSub.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return error when no subscription found', async () => {
      Subscription.getForUser.mockResolvedValue(null);

      const req = createMockReq({ user: { _id: 'user123' } });
      const res = createMockRes();
      const next = createMockNext();

      cancelSubscription(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('NO_SUBSCRIPTION');
    });

    it('should return error when trying to cancel free plan', async () => {
      const mockSub = {
        _id: 'sub_123',
        plan: { tier: 'free', name: 'Free' },
        status: 'active'
      };
      Subscription.getForUser.mockResolvedValue(mockSub);

      const req = createMockReq({ user: { _id: 'user123' } });
      const res = createMockRes();
      const next = createMockNext();

      cancelSubscription(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('CANNOT_CANCEL_FREE');
    });
  });

  // ==================== webhook ====================
  describe('POST /subscriptions/webhook', () => {
    it('should process payment.captured event', async () => {
      const body = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_123',
              order_id: 'order_456',
              amount: 29900,
              currency: 'INR'
            }
          }
        }
      };

      razorpay.verifyWebhookSignature.mockReturnValue(true);

      const mockSub = {
        _id: 'sub_123',
        razorpay: { orderId: 'order_456' },
        status: 'pending',
        paymentHistory: [],
        save: jest.fn().mockResolvedValue(true)
      };
      Subscription.findOne.mockResolvedValue(mockSub);

      const req = createMockReq({
        headers: { 'x-razorpay-signature': 'valid_sig' },
        body: body
      });
      const res = createMockRes();
      const next = createMockNext();

      webhook(req, res, next);
      await flushPromises();

      expect(mockSub.razorpay.paymentId).toBe('pay_123');
      expect(mockSub.status).toBe('active');
      expect(mockSub.paymentHistory).toHaveLength(1);
      expect(mockSub.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should process payment.failed event', async () => {
      const body = {
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_fail',
              order_id: 'order_789',
              amount: 29900,
              currency: 'INR'
            }
          }
        }
      };

      razorpay.verifyWebhookSignature.mockReturnValue(true);

      const mockSub = {
        _id: 'sub_123',
        razorpay: { orderId: 'order_789' },
        status: 'active',
        paymentHistory: [],
        save: jest.fn().mockResolvedValue(true)
      };
      Subscription.findOne.mockResolvedValue(mockSub);

      const req = createMockReq({
        headers: { 'x-razorpay-signature': 'valid_sig' },
        body: body
      });
      const res = createMockRes();
      const next = createMockNext();

      webhook(req, res, next);
      await flushPromises();

      expect(mockSub.status).toBe('past_due');
      expect(mockSub.paymentHistory).toHaveLength(1);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 for missing signature', async () => {
      const req = createMockReq({
        headers: {},
        body: { event: 'payment.captured' }
      });
      const res = createMockRes();
      const next = createMockNext();

      webhook(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid signature', async () => {
      razorpay.verifyWebhookSignature.mockReturnValue(false);

      const req = createMockReq({
        headers: { 'x-razorpay-signature': 'invalid' },
        body: { event: 'payment.captured' }
      });
      const res = createMockRes();
      const next = createMockNext();

      webhook(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it('should return 200 for unhandled event types', async () => {
      razorpay.verifyWebhookSignature.mockReturnValue(true);

      const req = createMockReq({
        headers: { 'x-razorpay-signature': 'valid_sig' },
        body: { event: 'refund.processed', payload: {} }
      });
      const res = createMockRes();
      const next = createMockNext();

      webhook(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  // ==================== validatePromo ====================
  describe('POST /subscriptions/validate-promo', () => {
    it('should validate a valid promo code', async () => {
      const now = new Date();
      const future = new Date(now);
      future.setMonth(future.getMonth() + 1);
      const past = new Date(now);
      past.setMonth(past.getMonth() - 1);

      const mockPlan = {
        _id: 'plan_pro',
        offers: [
          {
            code: 'SAVE20',
            discountPercentage: 20,
            isActive: true,
            validFrom: past,
            validUntil: future,
            maxRedemptions: -1,
            currentRedemptions: 0
          }
        ]
      };
      SubscriptionPlan.findById.mockResolvedValue(mockPlan);

      const req = createMockReq({
        user: { _id: 'user123' },
        body: { code: 'SAVE20', planId: 'plan_pro' }
      });
      const res = createMockRes();
      const next = createMockNext();

      validatePromo(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            code: 'SAVE20',
            discountPercentage: 20
          })
        })
      );
    });

    it('should return error when code or planId is missing', async () => {
      const req = createMockReq({
        user: { _id: 'user123' },
        body: {}
      });
      const res = createMockRes();
      const next = createMockNext();

      validatePromo(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('MISSING_INPUT');
    });

    it('should return error for non-existent plan', async () => {
      SubscriptionPlan.findById.mockResolvedValue(null);

      const req = createMockReq({
        user: { _id: 'user123' },
        body: { code: 'SAVE20', planId: 'bad_plan' }
      });
      const res = createMockRes();
      const next = createMockNext();

      validatePromo(req, res, next);
      await flushPromises();

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('PLAN_NOT_FOUND');
    });

    it('should return 400 for invalid/expired promo code', async () => {
      const past = new Date();
      past.setMonth(past.getMonth() - 2);
      const pastEnd = new Date(past);
      pastEnd.setMonth(pastEnd.getMonth() + 1);

      const mockPlan = {
        _id: 'plan_pro',
        offers: [
          {
            code: 'EXPIRED',
            discountPercentage: 10,
            isActive: true,
            validFrom: past,
            validUntil: pastEnd,
            maxRedemptions: -1,
            currentRedemptions: 0
          }
        ]
      };
      SubscriptionPlan.findById.mockResolvedValue(mockPlan);

      const req = createMockReq({
        user: { _id: 'user123' },
        body: { code: 'EXPIRED', planId: 'plan_pro' }
      });
      const res = createMockRes();
      const next = createMockNext();

      validatePromo(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_PROMO' })
      );
    });

    it('should reject promo code that has reached max redemptions', async () => {
      const now = new Date();
      const future = new Date(now);
      future.setMonth(future.getMonth() + 1);
      const past = new Date(now);
      past.setMonth(past.getMonth() - 1);

      const mockPlan = {
        _id: 'plan_pro',
        offers: [
          {
            code: 'LIMITED',
            discountPercentage: 50,
            isActive: true,
            validFrom: past,
            validUntil: future,
            maxRedemptions: 10,
            currentRedemptions: 10
          }
        ]
      };
      SubscriptionPlan.findById.mockResolvedValue(mockPlan);

      const req = createMockReq({
        user: { _id: 'user123' },
        body: { code: 'LIMITED', planId: 'plan_pro' }
      });
      const res = createMockRes();
      const next = createMockNext();

      validatePromo(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_PROMO' })
      );
    });

    it('should reject inactive promo code', async () => {
      const now = new Date();
      const future = new Date(now);
      future.setMonth(future.getMonth() + 1);
      const past = new Date(now);
      past.setMonth(past.getMonth() - 1);

      const mockPlan = {
        _id: 'plan_pro',
        offers: [
          {
            code: 'INACTIVE',
            discountPercentage: 30,
            isActive: false,
            validFrom: past,
            validUntil: future,
            maxRedemptions: -1,
            currentRedemptions: 0
          }
        ]
      };
      SubscriptionPlan.findById.mockResolvedValue(mockPlan);

      const req = createMockReq({
        user: { _id: 'user123' },
        body: { code: 'INACTIVE', planId: 'plan_pro' }
      });
      const res = createMockRes();
      const next = createMockNext();

      validatePromo(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
