/**
 * Subscription Controller
 * Handles subscription management, payments, and admin operations
 */

const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const razorpay = require('../utils/razorpay');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// ======================= PUBLIC =======================

/**
 * @desc    Get all active subscription plans
 * @route   GET /api/v1/subscriptions/plans
 * @access  Public
 */
const getPlans = asyncHandler(async (req, res) => {
  const plans = await SubscriptionPlan.find({ isActive: true })
    .select('-offers')
    .sort({ displayOrder: 1 });

  res.status(200).json({
    success: true,
    count: plans.length,
    data: plans
  });
});

/**
 * @desc    Razorpay webhook handler
 * @route   POST /api/v1/subscriptions/webhook
 * @access  Public (signature verified)
 */
const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];

  if (!signature || !razorpay.verifyWebhookSignature(req.body, signature)) {
    return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
  }

  const event = req.body.event;
  const payload = req.body.payload;

  switch (event) {
    case 'payment.captured': {
      const payment = payload.payment?.entity;
      if (payment) {
        const subscription = await Subscription.findOne({
          'razorpay.orderId': payment.order_id
        });
        if (subscription) {
          subscription.razorpay.paymentId = payment.id;
          subscription.status = 'active';
          subscription.paymentHistory.push({
            razorpayPaymentId: payment.id,
            amount: payment.amount / 100,
            currency: payment.currency,
            status: 'captured',
            paidAt: new Date()
          });
          await subscription.save();
        }
      }
      break;
    }
    case 'payment.failed': {
      const payment = payload.payment?.entity;
      if (payment) {
        const subscription = await Subscription.findOne({
          'razorpay.orderId': payment.order_id
        });
        if (subscription) {
          subscription.status = 'past_due';
          subscription.paymentHistory.push({
            razorpayPaymentId: payment.id,
            amount: payment.amount / 100,
            currency: payment.currency,
            status: 'failed',
            paidAt: new Date()
          });
          await subscription.save();
        }
      }
      break;
    }
  }

  res.status(200).json({ success: true, message: 'Webhook processed' });
});

// ======================= USER =======================

/**
 * @desc    Get current user's subscription
 * @route   GET /api/v1/subscriptions/my
 * @access  Private
 */
const getMySubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.getForUser(req.user._id);

  if (!subscription) {
    return res.status(404).json({
      success: false,
      error: 'No subscription found',
      code: 'NO_SUBSCRIPTION'
    });
  }

  res.status(200).json({
    success: true,
    data: subscription
  });
});

/**
 * @desc    Get current user's usage stats
 * @route   GET /api/v1/subscriptions/my/usage
 * @access  Private
 */
const getMyUsage = asyncHandler(async (req, res) => {
  const subscription = await Subscription.getForUser(req.user._id);

  if (!subscription) {
    return res.status(404).json({
      success: false,
      error: 'No subscription found',
      code: 'NO_SUBSCRIPTION'
    });
  }

  const plan = subscription.plan;
  const usage = {
    lyrics: subscription.checkLimit('lyrics', plan.limits),
    music: subscription.checkLimit('music', plan.limits),
    video: subscription.checkLimit('video', plan.limits),
    voice: subscription.checkLimit('voice', plan.limits),
    periodStart: subscription.usage.periodStart,
    periodEnd: subscription.usage.periodEnd
  };

  res.status(200).json({
    success: true,
    data: {
      plan: { name: plan.name, tier: plan.tier },
      usage
    }
  });
});

/**
 * @desc    Validate a promo code
 * @route   POST /api/v1/subscriptions/validate-promo
 * @access  Private
 */
const validatePromo = asyncHandler(async (req, res, next) => {
  const { code, planId } = req.body;

  if (!code || !planId) {
    return next(new AppError('Please provide a promo code and plan ID', 400, 'MISSING_INPUT'));
  }

  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    return next(new AppError('Plan not found', 404, 'PLAN_NOT_FOUND'));
  }

  const offer = plan.offers.find(o =>
    o.code === code.toUpperCase() &&
    o.isActive &&
    new Date() >= o.validFrom &&
    new Date() <= o.validUntil &&
    (o.maxRedemptions === -1 || o.currentRedemptions < o.maxRedemptions)
  );

  if (!offer) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or expired promo code',
      code: 'INVALID_PROMO'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      code: offer.code,
      discountPercentage: offer.discountPercentage,
      validUntil: offer.validUntil
    }
  });
});

/**
 * @desc    Create Razorpay order for subscription
 * @route   POST /api/v1/subscriptions/create-order
 * @access  Private
 */
const createOrder = asyncHandler(async (req, res, next) => {
  const { planId, billingCycle, promoCode } = req.body;

  if (!planId || !billingCycle) {
    return next(new AppError('Please provide plan ID and billing cycle', 400, 'MISSING_INPUT'));
  }

  const plan = await SubscriptionPlan.findById(planId);
  if (!plan || !plan.isActive) {
    return next(new AppError('Plan not found or inactive', 404, 'PLAN_NOT_FOUND'));
  }

  if (plan.tier === 'free') {
    return next(new AppError('Free plan does not require payment', 400, 'FREE_PLAN'));
  }

  let amount = billingCycle === 'yearly' ? plan.pricing.yearly : plan.pricing.monthly;
  let appliedPromo = null;

  // Apply promo code if provided
  if (promoCode) {
    const offer = plan.offers.find(o =>
      o.code === promoCode.toUpperCase() &&
      o.isActive &&
      new Date() >= o.validFrom &&
      new Date() <= o.validUntil &&
      (o.maxRedemptions === -1 || o.currentRedemptions < o.maxRedemptions)
    );

    if (offer) {
      amount = Math.round(amount * (1 - offer.discountPercentage / 100));
      appliedPromo = { code: offer.code, discountPercentage: offer.discountPercentage };
    }
  }

  const order = await razorpay.createOrder(
    amount,
    plan.pricing.currency,
    `sub_${req.user._id}_${Date.now()}`,
    {
      userId: req.user._id.toString(),
      planId: plan._id.toString(),
      billingCycle,
      promoCode: appliedPromo?.code || ''
    }
  );

  res.status(200).json({
    success: true,
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: require('../config/config').razorpay.keyId,
      plan: { name: plan.name, tier: plan.tier },
      appliedPromo
    }
  });
});

/**
 * @desc    Verify payment and activate subscription
 * @route   POST /api/v1/subscriptions/verify-payment
 * @access  Private
 */
const verifyPayment = asyncHandler(async (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, billingCycle, promoCode } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return next(new AppError('Missing payment details', 400, 'MISSING_PAYMENT_DETAILS'));
  }

  // Verify signature
  const isValid = razorpay.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!isValid) {
    return next(new AppError('Invalid payment signature', 400, 'INVALID_SIGNATURE'));
  }

  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    return next(new AppError('Plan not found', 404, 'PLAN_NOT_FOUND'));
  }

  // Calculate dates
  const now = new Date();
  const endDate = new Date(now);
  if (billingCycle === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  // Handle promo code redemption
  let appliedPromo = {};
  if (promoCode) {
    const offer = plan.offers.find(o => o.code === promoCode.toUpperCase());
    if (offer) {
      offer.currentRedemptions += 1;
      await plan.save();
      appliedPromo = { code: offer.code, discountPercentage: offer.discountPercentage };
    }
  }

  // Fetch payment amount
  let paymentAmount = 0;
  try {
    const paymentDetails = await razorpay.fetchPayment(razorpay_payment_id);
    paymentAmount = paymentDetails.amount / 100;
  } catch {
    paymentAmount = billingCycle === 'yearly' ? plan.pricing.yearly : plan.pricing.monthly;
  }

  // Update or create subscription
  let subscription = await Subscription.findOne({ user: req.user._id });

  if (subscription) {
    subscription.plan = plan._id;
    subscription.status = 'active';
    subscription.billingCycle = billingCycle;
    subscription.startDate = now;
    subscription.endDate = endDate;
    subscription.renewalDate = endDate;
    subscription.razorpay.orderId = razorpay_order_id;
    subscription.razorpay.paymentId = razorpay_payment_id;
    subscription.appliedPromo = appliedPromo;
    // Reset usage for new plan
    subscription.usage.lyricsGenerated = 0;
    subscription.usage.musicGenerated = 0;
    subscription.usage.videoGenerated = 0;
    subscription.usage.voiceGenerated = 0;
    subscription.usage.periodStart = now;
    subscription.usage.periodEnd = endDate;
    subscription.paymentHistory.push({
      razorpayPaymentId: razorpay_payment_id,
      amount: paymentAmount,
      currency: plan.pricing.currency,
      status: 'captured',
      paidAt: now
    });
    await subscription.save();
  } else {
    subscription = await Subscription.create({
      user: req.user._id,
      plan: plan._id,
      status: 'active',
      billingCycle,
      startDate: now,
      endDate,
      renewalDate: endDate,
      razorpay: {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id
      },
      usage: {
        periodStart: now,
        periodEnd: endDate
      },
      appliedPromo,
      paymentHistory: [{
        razorpayPaymentId: razorpay_payment_id,
        amount: paymentAmount,
        currency: plan.pricing.currency,
        status: 'captured',
        paidAt: now
      }]
    });
  }

  // Populate plan before returning
  subscription = await Subscription.findById(subscription._id).populate('plan');

  res.status(200).json({
    success: true,
    message: 'Payment verified and subscription activated',
    data: subscription
  });
});

/**
 * @desc    Cancel subscription
 * @route   POST /api/v1/subscriptions/cancel
 * @access  Private
 */
const cancelSubscription = asyncHandler(async (req, res, next) => {
  const subscription = await Subscription.getForUser(req.user._id);

  if (!subscription) {
    return next(new AppError('No subscription found', 404, 'NO_SUBSCRIPTION'));
  }

  if (subscription.plan.tier === 'free') {
    return next(new AppError('Cannot cancel free plan', 400, 'CANNOT_CANCEL_FREE'));
  }

  subscription.status = 'cancelled';
  // Keep access until end date
  await subscription.save();

  res.status(200).json({
    success: true,
    message: `Subscription cancelled. Access continues until ${subscription.endDate?.toLocaleDateString() || 'end of period'}.`,
    data: subscription
  });
});

// ======================= ADMIN =======================

/**
 * @desc    Get all plans (including inactive) for admin
 * @route   GET /api/v1/subscriptions/admin/plans
 * @access  Admin
 */
const adminGetPlans = asyncHandler(async (req, res) => {
  const plans = await SubscriptionPlan.find().sort({ displayOrder: 1 });

  res.status(200).json({
    success: true,
    count: plans.length,
    data: plans
  });
});

/**
 * @desc    Create a new subscription plan
 * @route   POST /api/v1/subscriptions/admin/plans
 * @access  Admin
 */
const adminCreatePlan = asyncHandler(async (req, res, next) => {
  const { name, slug, tier, description, highlights, pricing, limits, features, displayOrder } = req.body;

  if (!name || !slug || !tier) {
    return next(new AppError('Name, slug, and tier are required', 400, 'MISSING_INPUT'));
  }

  const plan = await SubscriptionPlan.create({
    name, slug, tier, description, highlights, pricing, limits, features, displayOrder
  });

  res.status(201).json({
    success: true,
    message: 'Plan created successfully',
    data: plan
  });
});

/**
 * @desc    Update a subscription plan
 * @route   PUT /api/v1/subscriptions/admin/plans/:id
 * @access  Admin
 */
const adminUpdatePlan = asyncHandler(async (req, res, next) => {
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) {
    return next(new AppError('Plan not found', 404, 'PLAN_NOT_FOUND'));
  }

  const { name, description, highlights, pricing, limits, features, displayOrder } = req.body;

  if (name !== undefined) plan.name = name;
  if (description !== undefined) plan.description = description;
  if (highlights !== undefined) plan.highlights = highlights;
  if (pricing !== undefined) Object.assign(plan.pricing, pricing);
  if (limits !== undefined) Object.assign(plan.limits, limits);
  if (features !== undefined) Object.assign(plan.features, features);
  if (displayOrder !== undefined) plan.displayOrder = displayOrder;

  await plan.save();

  res.status(200).json({
    success: true,
    message: 'Plan updated successfully',
    data: plan
  });
});

/**
 * @desc    Toggle plan active status
 * @route   PATCH /api/v1/subscriptions/admin/plans/:id/toggle
 * @access  Admin
 */
const adminTogglePlan = asyncHandler(async (req, res, next) => {
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) {
    return next(new AppError('Plan not found', 404, 'PLAN_NOT_FOUND'));
  }

  plan.isActive = !plan.isActive;
  await plan.save();

  res.status(200).json({
    success: true,
    message: `Plan ${plan.isActive ? 'activated' : 'deactivated'}`,
    data: plan
  });
});

/**
 * @desc    Add offer/promo to a plan
 * @route   POST /api/v1/subscriptions/admin/plans/:id/offers
 * @access  Admin
 */
const adminAddOffer = asyncHandler(async (req, res, next) => {
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) {
    return next(new AppError('Plan not found', 404, 'PLAN_NOT_FOUND'));
  }

  const { code, discountPercentage, validFrom, validUntil, maxRedemptions } = req.body;

  if (!code || !discountPercentage || !validUntil) {
    return next(new AppError('Code, discount percentage, and valid until date are required', 400, 'MISSING_INPUT'));
  }

  // Check if code already exists on this plan
  if (plan.offers.some(o => o.code === code.toUpperCase())) {
    return next(new AppError('Promo code already exists on this plan', 400, 'DUPLICATE_CODE'));
  }

  plan.offers.push({
    code: code.toUpperCase(),
    discountPercentage,
    validFrom: validFrom || new Date(),
    validUntil,
    maxRedemptions: maxRedemptions || -1,
    isActive: true
  });

  await plan.save();

  res.status(201).json({
    success: true,
    message: 'Offer added successfully',
    data: plan
  });
});

/**
 * @desc    Remove offer from a plan
 * @route   DELETE /api/v1/subscriptions/admin/plans/:planId/offers/:offerId
 * @access  Admin
 */
const adminRemoveOffer = asyncHandler(async (req, res, next) => {
  const plan = await SubscriptionPlan.findById(req.params.planId);
  if (!plan) {
    return next(new AppError('Plan not found', 404, 'PLAN_NOT_FOUND'));
  }

  plan.offers = plan.offers.filter(o => o._id.toString() !== req.params.offerId);
  await plan.save();

  res.status(200).json({
    success: true,
    message: 'Offer removed successfully',
    data: plan
  });
});

/**
 * @desc    Override a user's subscription plan (admin)
 * @route   POST /api/v1/subscriptions/admin/users/:userId/override
 * @access  Admin
 */
const adminOverrideSubscription = asyncHandler(async (req, res, next) => {
  const { planId, reason } = req.body;

  if (!planId) {
    return next(new AppError('Plan ID is required', 400, 'MISSING_INPUT'));
  }

  const user = await User.findById(req.params.userId);
  if (!user) {
    return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));
  }

  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    return next(new AppError('Plan not found', 404, 'PLAN_NOT_FOUND'));
  }

  let subscription = await Subscription.findOne({ user: req.params.userId });

  if (subscription) {
    subscription.adminOverride = {
      isOverridden: true,
      overriddenBy: req.user._id,
      reason: reason || 'Admin override',
      previousPlan: subscription.plan
    };
    subscription.plan = plan._id;
    subscription.status = 'active';
    subscription.billingCycle = 'none';
    // Reset usage
    subscription.usage.lyricsGenerated = 0;
    subscription.usage.musicGenerated = 0;
    subscription.usage.videoGenerated = 0;
    subscription.usage.voiceGenerated = 0;
    const now = new Date();
    subscription.usage.periodStart = now;
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    subscription.usage.periodEnd = periodEnd;
    await subscription.save();
  } else {
    subscription = await Subscription.create({
      user: req.params.userId,
      plan: plan._id,
      status: 'active',
      billingCycle: 'none',
      adminOverride: {
        isOverridden: true,
        overriddenBy: req.user._id,
        reason: reason || 'Admin override'
      }
    });
  }

  subscription = await Subscription.findById(subscription._id)
    .populate('plan')
    .populate('user', 'name email');

  res.status(200).json({
    success: true,
    message: `User subscription overridden to ${plan.name}`,
    data: subscription
  });
});

/**
 * @desc    Get all subscriptions (admin)
 * @route   GET /api/v1/subscriptions/admin/subscriptions
 * @access  Admin
 */
const adminGetSubscriptions = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.plan) filter.plan = req.query.plan;

  const subscriptions = await Subscription.find(filter)
    .populate('plan', 'name tier')
    .populate('user', 'name email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Subscription.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: subscriptions.length,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    data: subscriptions
  });
});

/**
 * @desc    Get subscription analytics (admin)
 * @route   GET /api/v1/subscriptions/admin/analytics
 * @access  Admin
 */
const adminGetAnalytics = asyncHandler(async (req, res) => {
  const [
    totalSubscribers,
    activeSubscribers,
    tierBreakdown,
    revenueData
  ] = await Promise.all([
    Subscription.countDocuments(),
    Subscription.countDocuments({ status: 'active' }),
    Subscription.aggregate([
      { $lookup: { from: 'subscriptionplans', localField: 'plan', foreignField: '_id', as: 'planData' } },
      { $unwind: '$planData' },
      { $group: { _id: '$planData.tier', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Subscription.aggregate([
      { $unwind: '$paymentHistory' },
      { $match: { 'paymentHistory.status': 'captured' } },
      { $group: {
        _id: null,
        totalRevenue: { $sum: '$paymentHistory.amount' },
        totalPayments: { $sum: 1 }
      }}
    ])
  ]);

  const revenue = revenueData[0] || { totalRevenue: 0, totalPayments: 0 };

  res.status(200).json({
    success: true,
    data: {
      totalSubscribers,
      activeSubscribers,
      tierBreakdown: tierBreakdown.reduce((acc, t) => { acc[t._id] = t.count; return acc; }, {}),
      totalRevenue: revenue.totalRevenue,
      totalPayments: revenue.totalPayments
    }
  });
});

module.exports = {
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
};
