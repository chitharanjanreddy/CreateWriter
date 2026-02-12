/**
 * Lyrics Model
 * Stores generated Telugu lyrics with metadata
 */

const mongoose = require('mongoose');

const lyricsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
    default: 'Untitled'
  },
  content: {
    type: String,
    required: [true, 'Lyrics content is required']
  },
  theme: {
    type: String,
    trim: true,
    default: ''
  },
  customLines: {
    type: String,
    default: ''
  },
  style: {
    type: String,
    enum: ['devotional', 'folk', 'romantic', 'patriotic', 'lullaby', 'celebration', 'philosophical', 'cinematic'],
    default: 'romantic'
  },
  dialect: {
    type: String,
    enum: ['telangana', 'rayalaseema', 'coastal', 'uttarandhra'],
    default: 'coastal'
  },
  poetryForm: {
    type: String,
    enum: ['padyam', 'geeyam', 'janapada', 'keertana', 'modern'],
    default: 'geeyam'
  },
  language: {
    type: String,
    enum: ['te', 'te-en'], // Telugu only or Telugu with English transliteration
    default: 'te-en'
  },
  generationParams: {
    model: String,
    temperature: Number,
    maxTokens: Number,
    promptVersion: String
  },
  metadata: {
    wordCount: {
      type: Number,
      default: 0
    },
    lineCount: {
      type: Number,
      default: 0
    },
    hasTransliteration: {
      type: Boolean,
      default: true
    },
    suggestedTempo: {
      type: String,
      default: '80-100 BPM'
    },
    suggestedRaga: String,
    suggestedTala: String
  },
  tags: [{
    type: String,
    trim: true
  }],
  isFavorite: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  musicGenerated: {
    platform: String,
    url: String,
    generatedAt: Date
  },
  videoGenerated: {
    platform: String,
    url: String,
    generatedAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
lyricsSchema.index({ user: 1, createdAt: -1 });
lyricsSchema.index({ style: 1 });
lyricsSchema.index({ dialect: 1 });
lyricsSchema.index({ tags: 1 });
lyricsSchema.index({ isPublic: 1 });

// Pre-save middleware to calculate metadata
lyricsSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    this.metadata.wordCount = this.content.split(/\s+/).filter(w => w).length;
    this.metadata.lineCount = this.content.split('\n').filter(l => l.trim()).length;
    this.metadata.hasTransliteration = /[a-zA-Z]/.test(this.content);
  }
  next();
});

// Virtual for excerpt
lyricsSchema.virtual('excerpt').get(function() {
  return this.content.substring(0, 200) + (this.content.length > 200 ? '...' : '');
});

// Virtual for style display name
lyricsSchema.virtual('styleDisplay').get(function() {
  const styleNames = {
    devotional: 'భక్తి గీతం',
    folk: 'జానపద గీతం',
    romantic: 'ప్రేమ గీతం',
    patriotic: 'దేశభక్తి గీతం',
    lullaby: 'జోల పాట',
    celebration: 'పండుగ పాట',
    philosophical: 'తత్వ గీతం',
    cinematic: 'సినిమా పాట'
  };
  return styleNames[this.style] || this.style;
});

// Virtual for dialect display name
lyricsSchema.virtual('dialectDisplay').get(function() {
  const dialectNames = {
    telangana: 'తెలంగాణ',
    rayalaseema: 'రాయలసీమ',
    coastal: 'కోస్తాంధ్ర',
    uttarandhra: 'ఉత్తరాంధ్ర'
  };
  return dialectNames[this.dialect] || this.dialect;
});

// Static method to get user's lyrics stats
lyricsSchema.statics.getUserStats = async function(userId) {
  const mongoose = require('mongoose');
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const stats = await this.aggregate([
    { $match: { user: userObjectId } },
    {
      $group: {
        _id: null,
        totalLyrics: { $sum: 1 },
        totalWords: { $sum: '$metadata.wordCount' },
        byStyle: { $push: '$style' },
        byDialect: { $push: '$dialect' },
        favorites: { $sum: { $cond: ['$isFavorite', 1, 0] } }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalLyrics: 0,
      totalWords: 0,
      favorites: 0,
      styleBreakdown: {},
      dialectBreakdown: {}
    };
  }

  const result = stats[0];
  
  // Count occurrences
  const countOccurrences = (arr) => arr.reduce((acc, val) => {
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});

  return {
    totalLyrics: result.totalLyrics,
    totalWords: result.totalWords,
    favorites: result.favorites,
    styleBreakdown: countOccurrences(result.byStyle),
    dialectBreakdown: countOccurrences(result.byDialect)
  };
};

// Static method to get popular public lyrics
lyricsSchema.statics.getPopular = async function(limit = 10) {
  return this.find({ isPublic: true })
    .sort({ rating: -1, createdAt: -1 })
    .limit(limit)
    .populate('user', 'name')
    .select('title excerpt style dialect rating createdAt user');
};

const Lyrics = mongoose.model('Lyrics', lyricsSchema);

module.exports = Lyrics;
