/**
 * ApiKey Model
 * Stores and manages external API keys (admin only)
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

// Encryption key (should be in env in production)
const ENCRYPTION_KEY = process.env.API_ENCRYPTION_KEY || 'default-32-byte-key-for-dev-only!';
const IV_LENGTH = 16;

// Encrypt function
const encrypt = (text) => {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

// Decrypt function
const decrypt = (text) => {
  if (!text) return '';
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption error:', error.message);
    return '';
  }
};

const apiKeySchema = new mongoose.Schema({
  service: {
    type: String,
    required: true,
    enum: ['anthropic', 'suno', 'udio', 'heygen', 'elevenlabs'],
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  encryptedKey: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastTested: {
    type: Date,
    default: null
  },
  lastTestResult: {
    type: String,
    enum: ['success', 'failed', 'pending', null],
    default: null
  },
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: {
    type: Date,
    default: null
  },
  metadata: {
    baseUrl: String,
    model: String,
    rateLimit: Number,
    notes: String
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Virtual to check if key is configured
apiKeySchema.virtual('isConfigured').get(function() {
  return !!this.encryptedKey;
});

// Method to set API key (encrypts before saving)
apiKeySchema.methods.setKey = function(plainKey) {
  this.encryptedKey = encrypt(plainKey);
};

// Method to get decrypted API key
apiKeySchema.methods.getKey = function() {
  return decrypt(this.encryptedKey);
};

// Method to get masked key for display
apiKeySchema.methods.getMaskedKey = function() {
  const key = this.getKey();
  if (!key) return '';
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
};

// Method to increment usage
apiKeySchema.methods.recordUsage = async function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  await this.save();
};

// Static method to get all keys with status
apiKeySchema.statics.getAllWithStatus = async function() {
  const keys = await this.find().select('-encryptedKey').lean();
  return keys.map(key => ({
    ...key,
    isConfigured: !!key.encryptedKey,
    maskedKey: key.encryptedKey ? '****configured****' : ''
  }));
};

// Static method to get key for a service
apiKeySchema.statics.getKeyForService = async function(service) {
  const apiKey = await this.findOne({ service, isActive: true });
  if (!apiKey) return null;
  return apiKey.getKey();
};

// Static method to initialize default API key entries
apiKeySchema.statics.initializeDefaults = async function() {
  const defaults = [
    {
      service: 'anthropic',
      name: 'Anthropic (Claude)',
      description: 'AI Lyrics Generation using Claude',
      metadata: {
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-sonnet-4-20250514'
      }
    },
    {
      service: 'suno',
      name: 'Suno AI',
      description: 'AI Music Generation',
      metadata: {
        baseUrl: 'https://api.suno.ai/v1'
      }
    },
    {
      service: 'udio',
      name: 'Udio',
      description: 'AI Music Generation',
      metadata: {
        baseUrl: 'https://api.udio.com/v1'
      }
    },
    {
      service: 'heygen',
      name: 'HeyGen',
      description: 'AI Video Generation',
      metadata: {
        baseUrl: 'https://api.heygen.com/v2'
      }
    },
    {
      service: 'elevenlabs',
      name: 'ElevenLabs',
      description: 'AI Voice & Music',
      metadata: {
        baseUrl: 'https://api.elevenlabs.io/v1'
      }
    }
  ];

  for (const def of defaults) {
    await this.findOneAndUpdate(
      { service: def.service },
      { $setOnInsert: def },
      { upsert: true, new: true }
    );
  }

  console.log('✅ API Keys initialized');
};

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

module.exports = ApiKey;
