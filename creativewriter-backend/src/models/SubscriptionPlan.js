/**
 * Subscription Plan Model
 * Defines available subscription tiers with pricing, limits, and features
 */

const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: 1,
    max: 100
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  maxRedemptions: {
    type: Number,
    default: -1 // -1 = unlimited
  },
  currentRedemptions: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  tier: {
    type: String,
    required: true,
    enum: ['free', 'pro', 'premium', 'enterprise'],
    unique: true
  },
  description: {
    type: String,
    default: ''
  },
  highlights: [{
    type: String
  }],
  pricing: {
    monthly: { type: Number, default: 0 },
    yearly: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' }
  },
  limits: {
    lyricsPerMonth: { type: Number, default: 5 },    // -1 = unlimited
    musicGenerations: { type: Number, default: 0 },
    videoGenerations: { type: Number, default: 0 },
    voiceGenerations: { type: Number, default: 0 }
  },
  features: {
    aiModel: { type: String, default: 'basic' },
    maxLyricsLength: { type: Number, default: 2000 },
    prioritySupport: { type: Boolean, default: false },
    customDialects: { type: Boolean, default: false },
    exportFormats: [{ type: String }]
  },
  offers: [offerSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

/**
 * Initialize default subscription plans
 */
subscriptionPlanSchema.statics.initializeDefaults = async function() {
  const defaults = [
    {
      name: 'Free',
      slug: 'free',
      tier: 'free',
      description: 'Get started with basic lyrics generation',
      highlights: ['5 lyrics per month', 'Basic AI model', 'Standard export'],
      pricing: { monthly: 0, yearly: 0, currency: 'INR' },
      limits: { lyricsPerMonth: 5, musicGenerations: 0, videoGenerations: 0, voiceGenerations: 0 },
      features: { aiModel: 'basic', maxLyricsLength: 2000, prioritySupport: false, customDialects: false, exportFormats: ['text'] },
      displayOrder: 1
    },
    {
      name: 'Pro',
      slug: 'pro',
      tier: 'pro',
      description: 'For serious lyricists who need more power',
      highlights: ['30 lyrics per month', '5 music generations', '3 voice generations', 'Standard AI model'],
      pricing: { monthly: 299, yearly: 2999, currency: 'INR' },
      limits: { lyricsPerMonth: 30, musicGenerations: 5, videoGenerations: 0, voiceGenerations: 3 },
      features: { aiModel: 'standard', maxLyricsLength: 4000, prioritySupport: false, customDialects: true, exportFormats: ['text', 'pdf'] },
      displayOrder: 2
    },
    {
      name: 'Premium',
      slug: 'premium',
      tier: 'premium',
      description: 'Full creative suite for professionals',
      highlights: ['100 lyrics per month', '20 music generations', '10 video generations', '10 voice generations', 'Premium AI model'],
      pricing: { monthly: 799, yearly: 7999, currency: 'INR' },
      limits: { lyricsPerMonth: 100, musicGenerations: 20, videoGenerations: 10, voiceGenerations: 10 },
      features: { aiModel: 'premium', maxLyricsLength: 8000, prioritySupport: true, customDialects: true, exportFormats: ['text', 'pdf', 'docx'] },
      displayOrder: 3
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      tier: 'enterprise',
      description: 'Unlimited access for teams and studios',
      highlights: ['Unlimited lyrics', 'Unlimited music', 'Unlimited video', 'Unlimited voice', 'Priority support', 'Premium AI model'],
      pricing: { monthly: 2499, yearly: 24999, currency: 'INR' },
      limits: { lyricsPerMonth: -1, musicGenerations: -1, videoGenerations: -1, voiceGenerations: -1 },
      features: { aiModel: 'premium', maxLyricsLength: 16000, prioritySupport: true, customDialects: true, exportFormats: ['text', 'pdf', 'docx', 'srt'] },
      displayOrder: 4
    }
  ];

  for (const plan of defaults) {
    const existing = await this.findOne({ tier: plan.tier });
    if (!existing) {
      await this.create(plan);
    }
  }

  console.log('Subscription plans initialized');
};

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
