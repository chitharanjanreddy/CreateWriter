/**
 * Lyrics Controller
 * Handles Telugu lyrics generation, CRUD operations, and AI integration
 */

const Lyrics = require('../models/Lyrics');
const ApiKey = require('../models/ApiKey');
const User = require('../models/User');
const config = require('../config/config');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const fetch = require('node-fetch');

// ======================= LYRICS GENERATION =======================

/**
 * @desc    Generate Telugu lyrics using AI
 * @route   POST /api/v1/lyrics/generate
 * @access  Private
 */
const generateLyrics = asyncHandler(async (req, res, next) => {
  const { theme, customLines, style, dialect, poetryForm, saveResult } = req.body;

  if (!theme && !customLines) {
    return next(new AppError('Please provide a theme or custom lines', 400, 'MISSING_INPUT'));
  }

  // Get Anthropic API key
  const anthropicKey = await ApiKey.getKeyForService('anthropic');

  // Build the prompt
  const prompt = buildLyricsPrompt({
    theme: theme || '',
    customLines: customLines || '',
    style: style || config.lyrics.defaultStyle,
    dialect: dialect || config.lyrics.defaultDialect,
    poetryForm: poetryForm || config.lyrics.defaultPoetryForm
  });

  let generatedContent = '';
  let generationParams = {};

  if (anthropicKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: config.apis.anthropic.model,
          max_tokens: config.lyrics.maxTokens,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      generatedContent = data.content
        .map(item => item.type === 'text' ? item.text : '')
        .filter(Boolean)
        .join('\n');

      generationParams = {
        model: config.apis.anthropic.model,
        maxTokens: config.lyrics.maxTokens,
        promptVersion: '1.0'
      };

      // Record API usage
      const apiKeyDoc = await ApiKey.findOne({ service: 'anthropic' });
      if (apiKeyDoc) {
        await apiKeyDoc.recordUsage();
      }
    } catch (error) {
      console.error('Anthropic API error:', error);
      // Fall back to sample lyrics
      generatedContent = generateSampleLyrics(theme, style, dialect);
      generationParams = { model: 'demo', note: 'API unavailable' };
    }
  } else {
    // No API key - use sample lyrics
    generatedContent = generateSampleLyrics(theme, style, dialect);
    generationParams = { model: 'demo', note: 'No API key configured' };
  }

  // Save to database if requested
  let savedLyrics = null;
  if (saveResult !== false && req.user) {
    savedLyrics = await Lyrics.create({
      user: req.user._id,
      title: theme || 'Untitled',
      content: generatedContent,
      theme,
      customLines,
      style: style || config.lyrics.defaultStyle,
      dialect: dialect || config.lyrics.defaultDialect,
      poetryForm: poetryForm || config.lyrics.defaultPoetryForm,
      generationParams
    });

    // Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.lyricsGenerated': 1 }
    });
  }

  res.status(200).json({
    success: true,
    message: 'Lyrics generated successfully',
    data: {
      content: generatedContent,
      metadata: {
        style,
        dialect,
        poetryForm,
        wordCount: generatedContent.split(/\s+/).filter(w => w).length,
        lineCount: generatedContent.split('\n').filter(l => l.trim()).length
      },
      saved: savedLyrics ? {
        id: savedLyrics._id,
        title: savedLyrics.title
      } : null,
      generationInfo: {
        model: generationParams.model,
        isDemo: generationParams.model === 'demo'
      }
    }
  });
});

/**
 * Build prompt for lyrics generation
 */
const buildLyricsPrompt = ({ theme, customLines, style, dialect, poetryForm }) => {
  const styleNames = {
    devotional: 'భక్తి గీతం (Devotional)',
    folk: 'జానపద గీతం (Folk)',
    romantic: 'ప్రేమ గీతం (Romantic)',
    patriotic: 'దేశభక్తి గీతం (Patriotic)',
    lullaby: 'జోల పాట (Lullaby)',
    celebration: 'పండుగ పాట (Celebration)',
    philosophical: 'తత్వ గీతం (Philosophical)',
    cinematic: 'సినిమా పాట (Cinematic)'
  };

  const dialectInfo = {
    telangana: {
      name: 'తెలంగాణ (Telangana)',
      features: 'గావు/గాదు endings, మస్తు, లగువ, బువ్వ vocabulary',
      references: 'Bathukamma, Bonalu, Charminar, Tank Bund'
    },
    rayalaseema: {
      name: 'రాయలసీమ (Rayalaseema)', 
      features: 'ళ్ళ/ణ్ణ pronunciations, ఏందిరా, అట్లనే, పోరడు vocabulary',
      references: 'Penna River, Tirupati, Annamayya keertanas'
    },
    coastal: {
      name: 'కోస్తాంధ్ర (Coastal Andhra)',
      features: 'Standard literary Telugu, softer pronunciations',
      references: 'Godavari, Krishna rivers, Pushkarams'
    },
    uttarandhra: {
      name: 'ఉత్తరాంధ్ర (North Andhra)',
      features: 'గిట్ల, అట్ల, రావాలె vocabulary, Odiya influence',
      references: 'Simhachalam, Visakhapatnam, Srikakulam'
    }
  };

  const poetryForms = {
    padyam: 'పద్యం - Classical verse with strict meter (Kandam, Seesam, Utpalamala)',
    geeyam: 'గేయం - Lyrical poetry for singing (Pallavi-Charanam structure)',
    janapada: 'జానపద - Folk poetry (Gobbilla Paata, Bathukamma Paata)',
    keertana: 'కీర్తన - Devotional composition (Annamayya, Tyagaraja style)',
    modern: 'ఆధునిక - Contemporary free verse'
  };

  const dialectData = dialectInfo[dialect] || dialectInfo.coastal;
  const poetryData = poetryForms[poetryForm] || poetryForms.geeyam;

  return `You are a master Telugu lyricist and poet. Generate beautiful, authentic Telugu song lyrics.

**INPUT:**
- Theme: ${theme || 'Not specified - create based on style'}
- User's lines to incorporate: ${customLines || 'None'}
- Style: ${styleNames[style] || styleNames.romantic}
- Regional Dialect: ${dialectData.name}
- Poetry Form: ${poetryData}

**DIALECT REQUIREMENTS:**
Use ${dialectData.name} dialect characteristics:
- Features: ${dialectData.features}
- Cultural references: ${dialectData.references}

**STRUCTURAL REQUIREMENTS:**
1. Follow traditional Telugu song structure:
   - పల్లవి (Pallavi) - Main refrain/chorus
   - అనుపల్లవి (Anupallavi) - Secondary refrain (optional)
   - చరణం 1, 2 (Charanam) - Verses

2. Apply Telugu poetic devices:
   - అనుప్రాస (Anuprasa) - Alliteration
   - యమకం (Yamakam) - Same word, different meanings
   - ప్రాస (Praasa) - End rhyme
   - ఛందస్సు (Chandassu) - Metrical rhythm

3. Include:
   - Telugu script (primary)
   - Romanized transliteration (in parentheses)
   - Make it singable and melodious

**OUTPUT FORMAT:**
【పల్లవి - Pallavi】
[Telugu lyrics]
(Transliteration)

【చరణం 1 - Charanam 1】
[Telugu lyrics]
(Transliteration)

【చరణం 2 - Charanam 2】
[Telugu lyrics]
(Transliteration)

---
🗣️ మాండలికం: ${dialectData.name}
🎶 Theme: ${theme || 'Universal'}
⏱️ Suggested Tempo: [appropriate tempo]

Generate the complete lyrics now:`;
};

/**
 * Generate sample lyrics for demo mode
 */
const generateSampleLyrics = (theme, style, dialect) => {
  const dialectNames = {
    telangana: 'తెలంగాణ',
    rayalaseema: 'రాయలసీమ',
    coastal: 'కోస్తాంధ్ర',
    uttarandhra: 'ఉత్తరాంధ్ర'
  };

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

  return `🎵 ${styleNames[style] || 'గీతం'} - ${dialectNames[dialect] || 'తెలుగు'} శైలి

【పల్లవి - Pallavi】
${theme || 'మనసు నిండా ప్రేమ భావం'}
హృదయం పాడే మధుర గీతం
ఆత్మ స్పర్శతో రాసిన కవితం
తెలుగు భాష మా గర్వం

(Manasu nindaa prema bhaavam
Hrudayam paade madhura geetam
Aatma sparshato raasina kavitam
Telugu bhaasha maa garvam)

【చరణం 1 - Charanam 1】
వెన్నెల రేయిలో మనసు మెరిసింది
చందమామ చూసి హృదయం పొంగింది
ప్రకృతి అందాలు మనల్ని పిలిచాయి
కలల లోకంలో మనం విహరించాం

(Vennela reyilo manasu merisindi
Chandamama choosi hrudayam pongindi
Prakruti andaalu manalni pilichaayi
Kalala lokamlo manam viharinchaam)

【చరణం 2 - Charanam 2】
తెలుగు నేల మా తల్లి భూమి
సాహిత్యం మా సంపద ధనం
కవిత్వం మా ఆత్మ స్వరం
సంగీతం మా జీవన గమనం

(Telugu nela maa talli bhoomi
Saahityam maa sampada dhanam
Kavitvam maa aatma svaram
Sangeetam maa jeevana gamanam)

---
🗣️ మాండలికం: ${dialectNames[dialect] || 'కోస్తాంధ్ర'}
🎶 Theme: ${theme || 'Universal'}
⏱️ Suggested Tempo: 80-100 BPM
📝 Demo Mode - Configure API for AI generation`;
};

// ======================= LYRICS CRUD =======================

/**
 * @desc    Get user's lyrics
 * @route   GET /api/v1/lyrics
 * @access  Private
 */
const getLyrics = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const filter = { user: req.user._id };
  if (req.query.style) filter.style = req.query.style;
  if (req.query.dialect) filter.dialect = req.query.dialect;
  if (req.query.isFavorite === 'true') filter.isFavorite = true;

  const lyrics = await Lyrics.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Lyrics.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: lyrics.length,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    data: lyrics
  });
});

/**
 * @desc    Get single lyrics
 * @route   GET /api/v1/lyrics/:id
 * @access  Private
 */
const getLyricsById = asyncHandler(async (req, res, next) => {
  const lyrics = await Lyrics.findById(req.params.id);

  if (!lyrics) {
    return next(new AppError('Lyrics not found', 404, 'LYRICS_NOT_FOUND'));
  }

  // Check ownership (unless public)
  if (lyrics.user.toString() !== req.user._id.toString() && !lyrics.isPublic) {
    return next(new AppError('Not authorized to access this lyrics', 403, 'FORBIDDEN'));
  }

  res.status(200).json({
    success: true,
    data: lyrics
  });
});

/**
 * @desc    Update lyrics
 * @route   PUT /api/v1/lyrics/:id
 * @access  Private
 */
const updateLyrics = asyncHandler(async (req, res, next) => {
  let lyrics = await Lyrics.findById(req.params.id);

  if (!lyrics) {
    return next(new AppError('Lyrics not found', 404, 'LYRICS_NOT_FOUND'));
  }

  if (lyrics.user.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized to update this lyrics', 403, 'FORBIDDEN'));
  }

  const { title, content, isFavorite, isPublic, rating, tags } = req.body;

  if (title !== undefined) lyrics.title = title;
  if (content !== undefined) lyrics.content = content;
  if (isFavorite !== undefined) lyrics.isFavorite = isFavorite;
  if (isPublic !== undefined) lyrics.isPublic = isPublic;
  if (rating !== undefined) lyrics.rating = rating;
  if (tags !== undefined) lyrics.tags = tags;

  await lyrics.save();

  res.status(200).json({
    success: true,
    message: 'Lyrics updated successfully',
    data: lyrics
  });
});

/**
 * @desc    Delete lyrics
 * @route   DELETE /api/v1/lyrics/:id
 * @access  Private
 */
const deleteLyrics = asyncHandler(async (req, res, next) => {
  const lyrics = await Lyrics.findById(req.params.id);

  if (!lyrics) {
    return next(new AppError('Lyrics not found', 404, 'LYRICS_NOT_FOUND'));
  }

  if (lyrics.user.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized to delete this lyrics', 403, 'FORBIDDEN'));
  }

  await lyrics.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Lyrics deleted successfully',
    data: {}
  });
});

/**
 * @desc    Toggle favorite status
 * @route   PATCH /api/v1/lyrics/:id/favorite
 * @access  Private
 */
const toggleFavorite = asyncHandler(async (req, res, next) => {
  const lyrics = await Lyrics.findById(req.params.id);

  if (!lyrics) {
    return next(new AppError('Lyrics not found', 404, 'LYRICS_NOT_FOUND'));
  }

  if (lyrics.user.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized', 403, 'FORBIDDEN'));
  }

  lyrics.isFavorite = !lyrics.isFavorite;
  await lyrics.save();

  res.status(200).json({
    success: true,
    data: { isFavorite: lyrics.isFavorite }
  });
});

/**
 * @desc    Get user's lyrics stats
 * @route   GET /api/v1/lyrics/stats
 * @access  Private
 */
const getStats = asyncHandler(async (req, res, next) => {
  const stats = await Lyrics.getUserStats(req.user._id);

  res.status(200).json({
    success: true,
    data: stats
  });
});

/**
 * @desc    Get public/popular lyrics
 * @route   GET /api/v1/lyrics/public
 * @access  Public
 */
const getPublicLyrics = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const lyrics = await Lyrics.getPopular(limit);

  res.status(200).json({
    success: true,
    count: lyrics.length,
    data: lyrics
  });
});

module.exports = {
  generateLyrics,
  getLyrics,
  getLyricsById,
  updateLyrics,
  deleteLyrics,
  toggleFavorite,
  getStats,
  getPublicLyrics
};
