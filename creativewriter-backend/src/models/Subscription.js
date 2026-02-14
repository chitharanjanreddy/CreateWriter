/**
 * Subscription Model
 * Tracks user subscriptions, usage, payments, and admin overrides
 */

const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema({
  razorpayPaymentId: String,
  amount: Number,
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['captured', 'failed', 'refunded'], default: 'captured' },
  paidAt: { type: Date, default: Date.now }
});

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'trial', 'past_due'],
    default: 'active'
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly', 'none'],
    default: 'none'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  renewalDate: {
    type: Date
  },
  razorpay: {
    customerId: String,
    subscriptionId: String,
    paymentId: String,
    orderId: String
  },
  usage: {
    lyricsGenerated: { type: Number, default: 0 },
    musicGenerated: { type: Number, default: 0 },
    videoGenerated: { type: Number, default: 0 },
    voiceGenerated: { type: Number, default: 0 },
    periodStart: { type: Date, default: Date.now },
    periodEnd: {
      type: Date,
      default: function() {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d;
      }
    }
  },
  adminOverride: {
    isOverridden: { type: Boolean, default: false },
    overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    previousPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' }
  },
  appliedPromo: {
    code: String,
    discountPercentage: Number
  },
  paymentHistory: [paymentHistorySchema]
}, {
  timestamps: true
});

/**
 * Check if usage period has expired and reset if needed
 */
subscriptionSchema.methods.checkAndResetUsage = function() {
  const now = new Date();
  if (now > this.usage.periodEnd) {
    this.usage.lyricsGenerated = 0;
    this.usage.musicGenerated = 0;
    this.usage.videoGenerated = 0;
    this.usage.voiceGenerated = 0;
    this.usage.periodStart = now;
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    this.usage.periodEnd = periodEnd;
    return true;
  }
  return false;
};

/**
 * Check if a specific usage type is within limits
 * @param {string} type - 'lyrics', 'music', 'video', or 'voice'
 * @param {object} planLimits - The plan's limits object
 * @returns {object} { allowed, current, limit, remaining }
 */
subscriptionSchema.methods.checkLimit = function(type, planLimits) {
  const mapping = {
    lyrics: { usage: 'lyricsGenerated', limit: 'lyricsPerMonth' },
    music: { usage: 'musicGenerated', limit: 'musicGenerations' },
    video: { usage: 'videoGenerated', limit: 'videoGenerations' },
    voice: { usage: 'voiceGenerated', limit: 'voiceGenerations' }
  };

  const map = mapping[type];
  if (!map) return { allowed: false, current: 0, limit: 0, remaining: 0 };

  const limit = planLimits[map.limit];
  const current = this.usage[map.usage];

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, current, limit: -1, remaining: -1 };
  }

  // 0 means not available on this plan
  if (limit === 0) {
    return { allowed: false, current, limit: 0, remaining: 0 };
  }

  return {
    allowed: current < limit,
    current,
    limit,
    remaining: Math.max(0, limit - current)
  };
};

/**
 * Increment usage counter
 */
subscriptionSchema.methods.incrementUsage = async function(type) {
  const mapping = {
    lyrics: 'lyricsGenerated',
    music: 'musicGenerated',
    video: 'videoGenerated',
    voice: 'voiceGenerated'
  };

  const field = mapping[type];
  if (!field) return;

  this.usage[field] += 1;
  await this.save();
};

/**
 * Get subscription with populated plan for a user
 */
subscriptionSchema.statics.getForUser = async function(userId) {
  let subscription = await this.findOne({ user: userId }).populate('plan');

  if (subscription) {
    // Check if usage period needs reset
    const wasReset = subscription.checkAndResetUsage();
    if (wasReset) {
      await subscription.save();
    }

    // Check if subscription has expired
    if (subscription.endDate && new Date() > subscription.endDate && subscription.status === 'active') {
      // Revert to free plan
      const SubscriptionPlan = mongoose.model('SubscriptionPlan');
      const freePlan = await SubscriptionPlan.findOne({ tier: 'free' });
      if (freePlan) {
        subscription.plan = freePlan._id;
        subscription.status = 'expired';
        subscription.billingCycle = 'none';
        await subscription.save();
        subscription = await this.findOne({ user: userId }).populate('plan');
      }
    }
  }

  return subscription;
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
