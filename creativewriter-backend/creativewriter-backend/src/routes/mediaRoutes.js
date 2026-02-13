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
  generateVoice,
  getVoices,
  getAvatars
} = require('../controllers/mediaController');

// All routes require authentication
router.use(protect);

// Available resources
router.get('/voices', getVoices);
router.get('/avatars', getAvatars);

// Generation endpoints (per lyrics)
router.post('/:lyricsId/music', generateMusic);
router.post('/:lyricsId/video', generateVideo);
router.post('/:lyricsId/voice', generateVoice);

// Status check
router.get('/video/:videoId/status', checkVideoStatus);

module.exports = router;
