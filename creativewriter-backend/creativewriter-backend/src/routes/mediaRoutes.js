/**
 * Media Routes
 * Routes for music, video, and voice generation from lyrics
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkUsageLimit } = require('../middleware/usageLimit');

const {
  generateMusic,
  generateVideo,
  checkVideoStatus,
  checkMusicStatus,
  sunoCallback,
  audioProxy,
  generateVoice,
  getVoices,
  getAvatars
} = require('../controllers/mediaController');

// Suno callback (public - no auth needed)
router.post('/callback/suno', sunoCallback);

// All remaining routes require authentication
router.use(protect);

// Available resources
router.get('/voices', getVoices);
router.get('/avatars', getAvatars);
router.get('/audio-proxy', audioProxy);

// Generation endpoints (per lyrics) - with usage limit checks
router.post('/:lyricsId/music', checkUsageLimit('music'), generateMusic);
router.post('/:lyricsId/video', checkUsageLimit('video'), generateVideo);
router.post('/:lyricsId/voice', checkUsageLimit('voice'), generateVoice);

// Status checks
router.get('/video/:videoId/status', checkVideoStatus);
router.get('/music/:taskId/status', checkMusicStatus);

module.exports = router;
