/**
 * Media Controller
 * Handles music generation (Suno/Udio), video generation (HeyGen), and voice synthesis (ElevenLabs)
 */

const Lyrics = require('../models/Lyrics');
const ApiKey = require('../models/ApiKey');
const config = require('../config/config');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const fetch = require('node-fetch');

// ======================= MUSIC GENERATION (SUNO) =======================

/**
 * @desc    Generate music from lyrics using Suno API
 * @route   POST /api/v1/media/:lyricsId/music
 * @access  Private
 */
const generateMusic = asyncHandler(async (req, res, next) => {
  const lyrics = await Lyrics.findById(req.params.lyricsId);

  if (!lyrics) {
    return next(new AppError('Lyrics not found', 404, 'LYRICS_NOT_FOUND'));
  }
  if (lyrics.user.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized', 403, 'FORBIDDEN'));
  }

  const { platform = 'suno', tempo, genre, instrumental } = req.body;
  const sunoKey = await ApiKey.getKeyForService('suno');
  const udioKey = await ApiKey.getKeyForService('udio');

  let result = null;

  if (platform === 'suno' && sunoKey) {
    try {
      const response = await fetch('https://api.suno.ai/v1/songs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sunoKey}`
        },
        body: JSON.stringify({
          prompt: lyrics.content.substring(0, 3000),
          title: lyrics.title,
          tags: `${lyrics.style}, telugu, ${lyrics.dialect}, ${tempo || 'medium tempo'}`,
          make_instrumental: instrumental || false
        })
      });

      if (response.ok) {
        const data = await response.json();
        result = {
          platform: 'suno',
          id: data.id || data.song_id,
          url: data.audio_url || data.url || null,
          status: data.status || 'processing',
          data: data
        };

        // Record usage
        const apiKeyDoc = await ApiKey.findOne({ service: 'suno' });
        if (apiKeyDoc) await apiKeyDoc.recordUsage();
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || `Suno API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Suno API error:', error.message);
      result = { platform: 'suno', status: 'error', message: error.message };
    }
  } else if (platform === 'udio' && udioKey) {
    try {
      const response = await fetch('https://api.udio.com/v1/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${udioKey}`
        },
        body: JSON.stringify({
          lyrics: lyrics.content.substring(0, 3000),
          title: lyrics.title,
          genre: genre || lyrics.style,
          language: 'Telugu'
        })
      });

      if (response.ok) {
        const data = await response.json();
        result = {
          platform: 'udio',
          id: data.id || data.track_id,
          url: data.audio_url || data.url || null,
          status: data.status || 'processing',
          data: data
        };

        const apiKeyDoc = await ApiKey.findOne({ service: 'udio' });
        if (apiKeyDoc) await apiKeyDoc.recordUsage();
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || `Udio API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Udio API error:', error.message);
      result = { platform: 'udio', status: 'error', message: error.message };
    }
  } else {
    // Demo mode
    result = {
      platform: platform,
      status: 'demo',
      message: `${platform} API key not configured. Go to Admin > API Keys to add your ${platform} key.`,
      demo: true
    };
  }

  // Save music info to lyrics if successful
  if (result && result.url) {
    lyrics.musicGenerated = {
      platform: result.platform,
      url: result.url,
      generatedAt: new Date()
    };
    await lyrics.save();
  }

  res.status(200).json({
    success: true,
    message: result.demo ? 'Demo mode - configure API key' : 'Music generation initiated',
    data: result
  });
});

// ======================= VIDEO GENERATION (HEYGEN) =======================

/**
 * @desc    Generate video from lyrics using HeyGen API
 * @route   POST /api/v1/media/:lyricsId/video
 * @access  Private
 */
const generateVideo = asyncHandler(async (req, res, next) => {
  const lyrics = await Lyrics.findById(req.params.lyricsId);

  if (!lyrics) {
    return next(new AppError('Lyrics not found', 404, 'LYRICS_NOT_FOUND'));
  }
  if (lyrics.user.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized', 403, 'FORBIDDEN'));
  }

  const { avatarId, voiceId, background } = req.body;
  const heygenKey = await ApiKey.getKeyForService('heygen');

  let result = null;

  if (heygenKey) {
    try {
      // Step 1: Create video
      const response = await fetch('https://api.heygen.com/v2/video/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': heygenKey
        },
        body: JSON.stringify({
          video_inputs: [{
            character: {
              type: 'avatar',
              avatar_id: avatarId || 'af78fd01567347b3a6859ea1e4a46410',
              avatar_style: 'normal'
            },
            voice: {
              type: 'text',
              input_text: lyrics.content.substring(0, 1500),
              voice_id: voiceId || 'te-IN-MohanNeural'
            },
            background: {
              type: 'color',
              value: background || '#1a1a2e'
            }
          }],
          dimension: { width: 1280, height: 720 },
          title: lyrics.title
        })
      });

      if (response.ok) {
        const data = await response.json();
        result = {
          platform: 'heygen',
          videoId: data.data?.video_id || data.video_id,
          status: data.data?.status || 'processing',
          message: 'Video generation started. It may take a few minutes to complete.',
          data: data
        };

        const apiKeyDoc = await ApiKey.findOne({ service: 'heygen' });
        if (apiKeyDoc) await apiKeyDoc.recordUsage();
      } else {
        const errData = await response.json().catch(() => ({}));
        const errMsg = typeof errData.error === 'string' ? errData.error : errData.message || errData.error?.message || JSON.stringify(errData) || `HeyGen API error: ${response.status}`;
        throw new Error(errMsg);
      }
    } catch (error) {
      console.error('HeyGen API error:', error.message);
      result = { platform: 'heygen', status: 'error', message: error.message };
    }
  } else {
    result = {
      platform: 'heygen',
      status: 'demo',
      message: 'HeyGen API key not configured. Go to Admin > API Keys to add your HeyGen key.',
      demo: true
    };
  }

  // Save video info if we got a video ID
  if (result && result.videoId) {
    lyrics.videoGenerated = {
      platform: 'heygen',
      url: result.videoId,
      generatedAt: new Date()
    };
    await lyrics.save();
  }

  res.status(200).json({
    success: true,
    message: result.demo ? 'Demo mode - configure API key' : 'Video generation initiated',
    data: result
  });
});

/**
 * @desc    Check HeyGen video status
 * @route   GET /api/v1/media/video/:videoId/status
 * @access  Private
 */
const checkVideoStatus = asyncHandler(async (req, res, next) => {
  const heygenKey = await ApiKey.getKeyForService('heygen');

  if (!heygenKey) {
    return next(new AppError('HeyGen API key not configured', 400, 'NO_API_KEY'));
  }

  try {
    const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${req.params.videoId}`, {
      headers: { 'X-Api-Key': heygenKey }
    });

    const data = await response.json();

    res.status(200).json({
      success: true,
      data: {
        videoId: req.params.videoId,
        status: data.data?.status || data.status,
        videoUrl: data.data?.video_url || null,
        thumbnailUrl: data.data?.thumbnail_url || null,
        duration: data.data?.duration || null
      }
    });
  } catch (error) {
    return next(new AppError('Failed to check video status: ' + error.message, 500));
  }
});

// ======================= VOICE SYNTHESIS (ELEVENLABS) =======================

/**
 * @desc    Generate voice/speech from lyrics using ElevenLabs
 * @route   POST /api/v1/media/:lyricsId/voice
 * @access  Private
 */
const generateVoice = asyncHandler(async (req, res, next) => {
  const lyrics = await Lyrics.findById(req.params.lyricsId);

  if (!lyrics) {
    return next(new AppError('Lyrics not found', 404, 'LYRICS_NOT_FOUND'));
  }
  if (lyrics.user.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized', 403, 'FORBIDDEN'));
  }

  const { voiceId, modelId, stability, similarityBoost } = req.body;
  const elevenLabsKey = await ApiKey.getKeyForService('elevenlabs');

  let result = null;

  if (elevenLabsKey) {
    try {
      const selectedVoice = voiceId || '21m00Tcm4TlvDq8ikWAM'; // Default: Rachel

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsKey
        },
        body: JSON.stringify({
          text: lyrics.content.substring(0, 5000),
          model_id: modelId || 'eleven_multilingual_v2',
          voice_settings: {
            stability: stability || 0.5,
            similarity_boost: similarityBoost || 0.75
          }
        })
      });

      if (response.ok) {
        // ElevenLabs returns audio binary - convert to base64
        const buffer = await response.buffer();
        const base64Audio = buffer.toString('base64');

        result = {
          platform: 'elevenlabs',
          status: 'completed',
          audioBase64: base64Audio,
          contentType: response.headers.get('content-type') || 'audio/mpeg',
          message: 'Voice generated successfully'
        };

        const apiKeyDoc = await ApiKey.findOne({ service: 'elevenlabs' });
        if (apiKeyDoc) await apiKeyDoc.recordUsage();
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail?.message || errData.message || `ElevenLabs API error: ${response.status}`);
      }
    } catch (error) {
      console.error('ElevenLabs API error:', error.message);
      result = { platform: 'elevenlabs', status: 'error', message: error.message };
    }
  } else {
    result = {
      platform: 'elevenlabs',
      status: 'demo',
      message: 'ElevenLabs API key not configured. Go to Admin > API Keys to add your ElevenLabs key.',
      demo: true
    };
  }

  res.status(200).json({
    success: true,
    message: result.demo ? 'Demo mode - configure API key' : 'Voice generation completed',
    data: result
  });
});

/**
 * @desc    Get available ElevenLabs voices
 * @route   GET /api/v1/media/voices
 * @access  Private
 */
const getVoices = asyncHandler(async (req, res, next) => {
  const elevenLabsKey = await ApiKey.getKeyForService('elevenlabs');

  if (!elevenLabsKey) {
    // Return default voice list
    return res.status(200).json({
      success: true,
      data: [
        { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', language: 'Multi' },
        { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', language: 'Multi' },
        { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', language: 'Multi' },
        { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', language: 'Multi' },
        { voice_id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', language: 'Multi' },
        { voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', language: 'Multi' },
        { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', language: 'Multi' },
        { voice_id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', language: 'Multi' }
      ],
      source: 'defaults'
    });
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': elevenLabsKey }
    });

    if (response.ok) {
      const data = await response.json();
      const voices = data.voices.map(v => ({
        voice_id: v.voice_id,
        name: v.name,
        language: v.labels?.language || 'Multi',
        category: v.category
      }));
      return res.status(200).json({ success: true, data: voices, source: 'api' });
    }
    throw new Error(`API error: ${response.status}`);
  } catch (error) {
    // Fallback to defaults on API error
    return res.status(200).json({
      success: true,
      data: [
        { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', language: 'Multi' },
        { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', language: 'Multi' },
        { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', language: 'Multi' },
        { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', language: 'Multi' },
        { voice_id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', language: 'Multi' },
        { voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', language: 'Multi' },
        { voice_id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', language: 'Multi' }
      ],
      source: 'defaults',
      warning: 'Could not fetch from API: ' + error.message
    });
  }
});

/**
 * @desc    Get available HeyGen avatars
 * @route   GET /api/v1/media/avatars
 * @access  Private
 */
const getAvatars = asyncHandler(async (req, res, next) => {
  const heygenKey = await ApiKey.getKeyForService('heygen');

  if (!heygenKey) {
    return res.status(200).json({
      success: true,
      data: [
        { avatar_id: 'af78fd01567347b3a6859ea1e4a46410', name: 'Chitharanjan Reddy Padigapati' },
        { avatar_id: 'a2e70cb3b3a64aec82c22e77683bb25f', name: 'Chitharanjan Reddy Padigapati (2)' },
        { avatar_id: 'b82c983a812c45fca8b8d5ba864cc26d', name: 'Chitharanjan Reddy Padigapati (3)' },
        { avatar_id: 'd76ce97ba1c647f4915bc6a99fdfb8e8', name: 'Chitharanjan Reddy Padigapati (4)' }
      ],
      source: 'defaults'
    });
  }

  try {
    const response = await fetch('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': heygenKey }
    });

    if (response.ok) {
      const data = await response.json();
      const avatars = (data.data?.avatars || []).map(a => ({
        avatar_id: a.avatar_id,
        name: a.avatar_name,
        preview: a.preview_image_url
      }));
      return res.status(200).json({ success: true, data: avatars, source: 'api' });
    }
    throw new Error(`API error: ${response.status}`);
  } catch (error) {
    return next(new AppError('Failed to fetch avatars: ' + error.message, 500));
  }
});

module.exports = {
  generateMusic,
  generateVideo,
  checkVideoStatus,
  generateVoice,
  getVoices,
  getAvatars
};
