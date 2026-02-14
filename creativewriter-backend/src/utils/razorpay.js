/**
 * Razorpay SDK Wrapper
 * Handles order creation, payment verification, and webhook validation
 */

const crypto = require('crypto');
const config = require('../config/config');

let Razorpay;
let razorpayInstance;

/**
 * Get or create Razorpay instance
 */
const getInstance = () => {
  if (razorpayInstance) return razorpayInstance;

  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    return null;
  }

  try {
    if (!Razorpay) {
      Razorpay = require('razorpay');
    }
    razorpayInstance = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret
    });
    return razorpayInstance;
  } catch (error) {
    console.warn('Razorpay SDK not available:', error.message);
    return null;
  }
};

/**
 * Create a Razorpay order
 * @param {number} amount - Amount in INR (will be converted to paise)
 * @param {string} currency - Currency code
 * @param {string} receipt - Receipt ID
 * @param {object} notes - Additional notes
 * @returns {object} Razorpay order
 */
const createOrder = async (amount, currency = 'INR', receipt = '', notes = {}) => {
  const instance = getInstance();
  if (!instance) {
    throw new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.');
  }

  const options = {
    amount: Math.round(amount * 100), // Convert to paise
    currency,
    receipt,
    notes
  };

  return await instance.orders.create(options);
};

/**
 * Verify Razorpay payment signature
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay signature
 * @returns {boolean} Whether the signature is valid
 */
const verifyPaymentSignature = (orderId, paymentId, signature) => {
  const secret = config.razorpay.keySecret;
  if (!secret) return false;

  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
};

/**
 * Verify Razorpay webhook signature
 * @param {string|Buffer} body - Raw request body
 * @param {string} signature - X-Razorpay-Signature header
 * @returns {boolean} Whether the webhook signature is valid
 */
const verifyWebhookSignature = (body, signature) => {
  const secret = config.razorpay.webhookSecret;
  if (!secret) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(typeof body === 'string' ? body : JSON.stringify(body))
    .digest('hex');

  return expectedSignature === signature;
};

/**
 * Fetch payment details from Razorpay
 * @param {string} paymentId - Razorpay payment ID
 * @returns {object} Payment details
 */
const fetchPayment = async (paymentId) => {
  const instance = getInstance();
  if (!instance) {
    throw new Error('Razorpay is not configured');
  }

  return await instance.payments.fetch(paymentId);
};

module.exports = {
  getInstance,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPayment
};
