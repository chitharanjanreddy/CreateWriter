/**
 * Admin Routes
 * Protected routes for admin operations
 */

const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');

const {
  getDashboard,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  toggleUserRole,
  toggleUserStatus,
  getApiKeys,
  updateApiKey,
  testApiKey,
  deleteApiKey
} = require('../controllers/adminController');

// All routes require authentication and admin role
router.use(protect);
router.use(adminOnly);

// Dashboard
router.get('/dashboard', getDashboard);

// User Management
router.route('/users')
  .get(getUsers);

router.route('/users/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

router.patch('/users/:id/role', toggleUserRole);
router.patch('/users/:id/status', toggleUserStatus);

// API Key Management
router.route('/apikeys')
  .get(getApiKeys);

router.route('/apikeys/:service')
  .put(updateApiKey)
  .delete(deleteApiKey);

router.post('/apikeys/:service/test', testApiKey);

module.exports = router;
