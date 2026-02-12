/**
 * Lyrics Routes
 * Routes for lyrics generation and management
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, optionalAuth } = require('../middleware/auth');

const {
  generateLyrics,
  getLyrics,
  getLyricsById,
  updateLyrics,
  deleteLyrics,
  toggleFavorite,
  getStats,
  getPublicLyrics
} = require('../controllers/lyricsController');

// Validation rules
const generateValidation = [
  body('style')
    .optional()
    .isIn(['devotional', 'folk', 'romantic', 'patriotic', 'lullaby', 'celebration', 'philosophical', 'cinematic'])
    .withMessage('Invalid style'),
  body('dialect')
    .optional()
    .isIn(['telangana', 'rayalaseema', 'coastal', 'uttarandhra'])
    .withMessage('Invalid dialect'),
  body('poetryForm')
    .optional()
    .isIn(['padyam', 'geeyam', 'janapada', 'keertana', 'modern'])
    .withMessage('Invalid poetry form')
];

// Public routes
router.get('/public', optionalAuth, getPublicLyrics);

// Protected routes
router.use(protect);

// Generate lyrics
router.post('/generate', generateValidation, validate, generateLyrics);

// Stats
router.get('/stats', getStats);

// CRUD
router.route('/')
  .get(getLyrics);

router.route('/:id')
  .get(getLyricsById)
  .put(updateLyrics)
  .delete(deleteLyrics);

router.patch('/:id/favorite', toggleFavorite);

module.exports = router;
