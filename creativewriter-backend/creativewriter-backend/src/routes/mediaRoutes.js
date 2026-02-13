/**
 * Media Routes
 * Routes for music, video, and voice generation from lyrics
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

const {
  generateMusic,
  generateVideo,
  checkVideoStatus,
  checkMusicStatus,
  sunoCallback,
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

// Generation endpoints (per lyrics)
router.post('/:lyricsId/music', generateMusic);
router.post('/:lyricsId/video', generateVideo);
router.post('/:lyricsId/voice', generateVoice);

// Status checks
router.get('/video/:videoId/status', checkVideoStatus);
router.get('/music/:taskId/status', checkMusicStatus);

module.exports = router;
