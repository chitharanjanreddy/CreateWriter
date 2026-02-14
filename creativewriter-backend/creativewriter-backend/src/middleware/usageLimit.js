/**
 * Usage Limit Middleware
 * Checks subscription limits before allowing lyrics/media generation
 */

const Subscription = require('../models/Subscription');
const { AppError } = require('./errorHandler');

/**
 * Middleware factory to check usage limits
 * @param {string} type - 'lyrics', 'music', 'video', or 'voice'
 * @returns {function} Express middleware
 */
const checkUsageLimit = (type) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401, 'NO_USER'));
      }

      const subscription = await Subscription.getForUser(req.user._id);

      if (!subscription || !subscription.plan) {
        return next(new AppError('No active subscription found. Please subscribe to a plan.', 403, 'NO_SUBSCRIPTION'));
      }

      if (subscription.status !== 'active' && subscription.status !== 'trial') {
        return next(new AppError('Your subscription is not active. Please renew your plan.', 403, 'SUBSCRIPTION_INACTIVE'));
      }

      const limitCheck = subscription.checkLimit(type, subscription.plan.limits);

      if (!limitCheck.allowed) {
        if (limitCheck.limit === 0) {
          return res.status(403).json({
            success: false,
            error: `${type} generation is not available on your current plan (${subscription.plan.name}). Please upgrade.`,
            code: 'FEATURE_NOT_AVAILABLE',
            data: {
              currentPlan: subscription.plan.name,
              type,
              limit: 0
            }
          });
        }

        return res.status(429).json({
          success: false,
          error: `You have reached your ${type} generation limit for this period (${limitCheck.current}/${limitCheck.limit}). Please upgrade your plan.`,
          code: 'USAGE_LIMIT_REACHED',
          data: {
            currentPlan: subscription.plan.name,
            type,
            current: limitCheck.current,
            limit: limitCheck.limit,
            remaining: 0,
            periodEnd: subscription.usage.periodEnd
          }
        });
      }

      // Attach subscription to request for later use
      req.subscription = subscription;
      next();
    } catch (error) {
      console.error('Usage limit check error:', error.message);
      // Don't block the request if there's an error checking limits
      next();
    }
  };
};

/**
 * Helper to increment usage after successful generation
 * @param {string} type - 'lyrics', 'music', 'video', or 'voice'
 * @param {string} userId - User ID
 */
const incrementUsage = async (type, userId) => {
  try {
    const subscription = await Subscription.getForUser(userId);
    if (subscription) {
      await subscription.incrementUsage(type);
    }
  } catch (error) {
    console.error('Usage increment error:', error.message);
  }
};

module.exports = {
  checkUsageLimit,
  incrementUsage
};
