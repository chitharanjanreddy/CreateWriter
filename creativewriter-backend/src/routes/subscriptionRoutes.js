/**
 * Subscription Routes
 * Routes for subscription management, payments, and admin operations
 */

const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');

const {
  getPlans,
  webhook,
  getMySubscription,
  getMyUsage,
  validatePromo,
  createOrder,
  verifyPayment,
  cancelSubscription,
  adminGetPlans,
  adminCreatePlan,
  adminUpdatePlan,
  adminTogglePlan,
  adminAddOffer,
  adminRemoveOffer,
  adminOverrideSubscription,
  adminGetSubscriptions,
  adminGetAnalytics
} = require('../controllers/subscriptionController');

// Public routes
router.get('/plans', getPlans);
router.post('/webhook', webhook);

// User routes (protected)
router.get('/my', protect, getMySubscription);
router.get('/my/usage', protect, getMyUsage);
router.post('/validate-promo', protect, validatePromo);
router.post('/create-order', protect, createOrder);
router.post('/verify-payment', protect, verifyPayment);
router.post('/cancel', protect, cancelSubscription);

// Admin routes
router.get('/admin/plans', protect, adminOnly, adminGetPlans);
router.post('/admin/plans', protect, adminOnly, adminCreatePlan);
router.put('/admin/plans/:id', protect, adminOnly, adminUpdatePlan);
router.patch('/admin/plans/:id/toggle', protect, adminOnly, adminTogglePlan);
router.post('/admin/plans/:id/offers', protect, adminOnly, adminAddOffer);
router.delete('/admin/plans/:planId/offers/:offerId', protect, adminOnly, adminRemoveOffer);
router.post('/admin/users/:userId/override', protect, adminOnly, adminOverrideSubscription);
router.get('/admin/subscriptions', protect, adminOnly, adminGetSubscriptions);
router.get('/admin/analytics', protect, adminOnly, adminGetAnalytics);

module.exports = router;
