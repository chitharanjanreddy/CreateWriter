const crypto = require('crypto');
const config = require('../../../src/config/config');

// Create shared mock instance that Razorpay constructor will return
const mockOrdersCreate = jest.fn();
const mockPaymentsFetch = jest.fn();
const mockRazorpayInstance = {
  orders: { create: mockOrdersCreate },
  payments: { fetch: mockPaymentsFetch }
};

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => mockRazorpayInstance);
});

// Must require AFTER mock setup
const razorpayUtils = require('../../../src/utils/razorpay');

describe('razorpay utility', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== verifyPaymentSignature ====================
  describe('verifyPaymentSignature', () => {
    it('should return true for valid signature', () => {
      const orderId = 'order_123';
      const paymentId = 'pay_456';
      const body = orderId + '|' + paymentId;
      const expectedSig = crypto
        .createHmac('sha256', config.razorpay.keySecret)
        .update(body)
        .digest('hex');

      const result = razorpayUtils.verifyPaymentSignature(orderId, paymentId, expectedSig);
      expect(result).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const result = razorpayUtils.verifyPaymentSignature('order_123', 'pay_456', 'invalid_signature');
      expect(result).toBe(false);
    });

    it('should return false when keySecret is empty', () => {
      const originalSecret = config.razorpay.keySecret;
      config.razorpay.keySecret = '';

      const result = razorpayUtils.verifyPaymentSignature('order_123', 'pay_456', 'any_sig');
      expect(result).toBe(false);

      config.razorpay.keySecret = originalSecret;
    });

    it('should use orderId|paymentId as HMAC body', () => {
      const orderId = 'order_abc';
      const paymentId = 'pay_xyz';
      const body = 'order_abc|pay_xyz';
      const expectedSig = crypto
        .createHmac('sha256', config.razorpay.keySecret)
        .update(body)
        .digest('hex');

      expect(razorpayUtils.verifyPaymentSignature(orderId, paymentId, expectedSig)).toBe(true);
    });
  });

  // ==================== verifyWebhookSignature ====================
  describe('verifyWebhookSignature', () => {
    it('should return true for valid webhook signature with string body', () => {
      const body = '{"event":"payment.captured"}';
      const expectedSig = crypto
        .createHmac('sha256', config.razorpay.webhookSecret)
        .update(body)
        .digest('hex');

      const result = razorpayUtils.verifyWebhookSignature(body, expectedSig);
      expect(result).toBe(true);
    });

    it('should return true for valid webhook signature with object body', () => {
      const bodyObj = { event: 'payment.captured' };
      const bodyStr = JSON.stringify(bodyObj);
      const expectedSig = crypto
        .createHmac('sha256', config.razorpay.webhookSecret)
        .update(bodyStr)
        .digest('hex');

      const result = razorpayUtils.verifyWebhookSignature(bodyObj, expectedSig);
      expect(result).toBe(true);
    });

    it('should return false for invalid webhook signature', () => {
      const result = razorpayUtils.verifyWebhookSignature('body', 'wrong_sig');
      expect(result).toBe(false);
    });

    it('should return false when webhookSecret is empty', () => {
      const originalSecret = config.razorpay.webhookSecret;
      config.razorpay.webhookSecret = '';

      const result = razorpayUtils.verifyWebhookSignature('body', 'any_sig');
      expect(result).toBe(false);

      config.razorpay.webhookSecret = originalSecret;
    });
  });

  // ==================== createOrder ====================
  describe('createOrder', () => {
    it('should create an order with amount in paise', async () => {
      mockOrdersCreate.mockResolvedValue({
        id: 'order_test',
        amount: 29900,
        currency: 'INR'
      });

      const result = await razorpayUtils.createOrder(299, 'INR', 'receipt_1', { userId: 'u1' });

      expect(mockOrdersCreate).toHaveBeenCalledWith({
        amount: 29900,
        currency: 'INR',
        receipt: 'receipt_1',
        notes: { userId: 'u1' }
      });
      expect(result.id).toBe('order_test');
    });

    it('should convert amount to paise (multiply by 100)', async () => {
      mockOrdersCreate.mockResolvedValue({ id: 'order_1', amount: 79900 });

      await razorpayUtils.createOrder(799, 'INR', 'receipt_2');

      expect(mockOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 79900 })
      );
    });

    it('should round paise to avoid floating point issues', async () => {
      mockOrdersCreate.mockResolvedValue({ id: 'order_round' });

      await razorpayUtils.createOrder(299.99, 'INR', 'receipt_3');

      expect(mockOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 29999 })
      );
    });

    it('should default to INR currency and empty receipt/notes', async () => {
      mockOrdersCreate.mockResolvedValue({ id: 'order_default' });

      await razorpayUtils.createOrder(100);

      expect(mockOrdersCreate).toHaveBeenCalledWith({
        amount: 10000,
        currency: 'INR',
        receipt: '',
        notes: {}
      });
    });
  });

  // ==================== getInstance ====================
  describe('getInstance', () => {
    it('should return an instance when keys are configured', () => {
      const instance = razorpayUtils.getInstance();
      expect(instance).toBeDefined();
      expect(instance).toBe(mockRazorpayInstance);
    });
  });

  // ==================== fetchPayment ====================
  describe('fetchPayment', () => {
    it('should fetch payment details', async () => {
      mockPaymentsFetch.mockResolvedValue({
        id: 'pay_123',
        amount: 29900,
        currency: 'INR',
        status: 'captured'
      });

      const result = await razorpayUtils.fetchPayment('pay_123');

      expect(mockPaymentsFetch).toHaveBeenCalledWith('pay_123');
      expect(result.id).toBe('pay_123');
      expect(result.status).toBe('captured');
    });
  });
});
