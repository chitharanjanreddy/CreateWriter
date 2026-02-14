/**
 * Admin Controller
 * Handles admin-only operations: user management, API keys, system settings
 */

const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const Lyrics = require('../models/Lyrics');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// ======================= DASHBOARD =======================

/**
 * @desc    Get admin dashboard stats
 * @route   GET /api/v1/admin/dashboard
 * @access  Admin
 */
const getDashboard = asyncHandler(async (req, res, next) => {
  // User stats
  const userStats = await User.getStats();

  // Lyrics stats
  const totalLyrics = await Lyrics.countDocuments();
  const lyricsToday = await Lyrics.countDocuments({
    createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
  });

  // API Keys status
  const apiKeys = await ApiKey.find().select('service name isActive encryptedKey lastTested lastTestResult');
  const configuredApis = apiKeys.filter(k => k.encryptedKey).length;

  // Recent activity
  const recentUsers = await User.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select('name email role createdAt');

  const recentLyrics = await Lyrics.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('user', 'name')
    .select('title style dialect createdAt user');

  res.status(200).json({
    success: true,
    data: {
      stats: {
        users: userStats,
        lyrics: {
          total: totalLyrics,
          today: lyricsToday
        },
        apis: {
          total: apiKeys.length,
          configured: configuredApis
        }
      },
      recent: {
        users: recentUsers,
        lyrics: recentLyrics
      },
      apiStatus: apiKeys.map(k => ({
        service: k.service,
        name: k.name,
        isActive: k.isActive,
        isConfigured: !!k.encryptedKey,
        lastTested: k.lastTested,
        lastTestResult: k.lastTestResult
      }))
    }
  });
});

// ======================= USER MANAGEMENT =======================

/**
 * @desc    Get all users
 * @route   GET /api/v1/admin/users
 * @access  Admin
 */
const getUsers = asyncHandler(async (req, res, next) => {
  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  // Filtering
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  // Sorting
  const sort = {};
  if (req.query.sortBy) {
    const parts = req.query.sortBy.split(':');
    sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
  } else {
    sort.createdAt = -1;
  }

  const users = await User.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .select('-password');

  const total = await User.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: users.length,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    data: users
  });
});

/**
 * @desc    Get single user
 * @route   GET /api/v1/admin/users/:id
 * @access  Admin
 */
const getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user) {
    return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));
  }

  // Get user's lyrics stats
  const lyricsStats = await Lyrics.getUserStats(user._id);

  res.status(200).json({
    success: true,
    data: {
      user,
      stats: lyricsStats
    }
  });
});

/**
 * @desc    Update user
 * @route   PUT /api/v1/admin/users/:id
 * @access  Admin
 */
const updateUser = asyncHandler(async (req, res, next) => {
  const { name, email, role, isActive, phone, organization } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));
  }

  // Prevent admin from changing their own role
  if (req.params.id === req.user.id && role && role !== req.user.role) {
    return next(new AppError('You cannot change your own role', 400, 'CANNOT_CHANGE_OWN_ROLE'));
  }

  // Update fields
  if (name) user.name = name;
  if (email) user.email = email.toLowerCase();
  if (role) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  if (phone !== undefined) user.profile.phone = phone;
  if (organization !== undefined) user.profile.organization = organization;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: user
  });
});

/**
 * @desc    Delete user
 * @route   DELETE /api/v1/admin/users/:id
 * @access  Admin
 */
const deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));
  }

  // Prevent admin from deleting themselves
  if (req.params.id === req.user.id) {
    return next(new AppError('You cannot delete your own account', 400, 'CANNOT_DELETE_SELF'));
  }

  // Option: Delete user's lyrics or keep them
  if (req.query.deleteLyrics === 'true') {
    await Lyrics.deleteMany({ user: user._id });
  }

  await user.deleteOne();

  res.status(200).json({
    success: true,
    message: 'User deleted successfully',
    data: {}
  });
});

/**
 * @desc    Toggle user role
 * @route   PATCH /api/v1/admin/users/:id/role
 * @access  Admin
 */
const toggleUserRole = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));
  }

  if (req.params.id === req.user.id) {
    return next(new AppError('You cannot change your own role', 400, 'CANNOT_CHANGE_OWN_ROLE'));
  }

  user.role = user.role === 'admin' ? 'user' : 'admin';
  await user.save();

  res.status(200).json({
    success: true,
    message: `User role changed to ${user.role}`,
    data: user
  });
});

/**
 * @desc    Toggle user active status
 * @route   PATCH /api/v1/admin/users/:id/status
 * @access  Admin
 */
const toggleUserStatus = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));
  }

  if (req.params.id === req.user.id) {
    return next(new AppError('You cannot deactivate your own account', 400, 'CANNOT_DEACTIVATE_SELF'));
  }

  user.isActive = !user.isActive;
  await user.save();

  res.status(200).json({
    success: true,
    message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
    data: user
  });
});

// ======================= API KEY MANAGEMENT =======================

/**
 * @desc    Get all API keys
 * @route   GET /api/v1/admin/apikeys
 * @access  Admin
 */
const getApiKeys = asyncHandler(async (req, res, next) => {
  const apiKeys = await ApiKey.find();

  const keysWithStatus = apiKeys.map(key => ({
    _id: key._id,
    service: key.service,
    name: key.name,
    description: key.description,
    isActive: key.isActive,
    isConfigured: !!key.encryptedKey,
    maskedKey: key.getMaskedKey(),
    lastTested: key.lastTested,
    lastTestResult: key.lastTestResult,
    usageCount: key.usageCount,
    lastUsed: key.lastUsed,
    metadata: key.metadata,
    updatedAt: key.updatedAt
  }));

  res.status(200).json({
    success: true,
    count: keysWithStatus.length,
    data: keysWithStatus
  });
});

/**
 * @desc    Update API key
 * @route   PUT /api/v1/admin/apikeys/:service
 * @access  Admin
 */
const updateApiKey = asyncHandler(async (req, res, next) => {
  const { service } = req.params;
  const { key, isActive, metadata } = req.body;

  let apiKey = await ApiKey.findOne({ service });

  if (!apiKey) {
    return next(new AppError('API service not found', 404, 'SERVICE_NOT_FOUND'));
  }

  // Update key if provided
  if (key !== undefined) {
    if (key === '') {
      apiKey.encryptedKey = '';
    } else {
      apiKey.setKey(key);
    }
  }

  // Update other fields
  if (isActive !== undefined) apiKey.isActive = isActive;
  if (metadata) apiKey.metadata = { ...apiKey.metadata, ...metadata };
  
  apiKey.updatedBy = req.user._id;
  await apiKey.save();

  res.status(200).json({
    success: true,
    message: `${apiKey.name} API key updated successfully`,
    data: {
      service: apiKey.service,
      name: apiKey.name,
      isActive: apiKey.isActive,
      isConfigured: !!apiKey.encryptedKey,
      maskedKey: apiKey.getMaskedKey()
    }
  });
});

/**
 * @desc    Test API key
 * @route   POST /api/v1/admin/apikeys/:service/test
 * @access  Admin
 */
const testApiKey = asyncHandler(async (req, res, next) => {
  const { service } = req.params;
  const apiKey = await ApiKey.findOne({ service });

  if (!apiKey) {
    return next(new AppError('API service not found', 404, 'SERVICE_NOT_FOUND'));
  }

  const key = apiKey.getKey();
  if (!key) {
    apiKey.lastTested = new Date();
    apiKey.lastTestResult = 'failed';
    await apiKey.save();
    
    return res.status(200).json({
      success: true,
      data: {
        service,
        result: 'failed',
        message: 'No API key configured'
      }
    });
  }

  // Test the API based on service
  let testResult = { success: false, message: 'Unknown service' };

  try {
    const fetch = require('node-fetch');
    
    switch (service) {
      case 'anthropic':
        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          })
        });
        testResult = {
          success: anthropicRes.ok,
          message: anthropicRes.ok ? 'Connection successful' : `Error: ${anthropicRes.status}`
        };
        break;

      // Add other service tests as needed
      default:
        testResult = {
          success: true,
          message: 'Key saved (test not available for this service)'
        };
    }
  } catch (error) {
    testResult = {
      success: false,
      message: error.message
    };
  }

  apiKey.lastTested = new Date();
  apiKey.lastTestResult = testResult.success ? 'success' : 'failed';
  await apiKey.save();

  res.status(200).json({
    success: true,
    data: {
      service,
      result: apiKey.lastTestResult,
      message: testResult.message,
      testedAt: apiKey.lastTested
    }
  });
});

/**
 * @desc    Delete/Clear API key
 * @route   DELETE /api/v1/admin/apikeys/:service
 * @access  Admin
 */
const deleteApiKey = asyncHandler(async (req, res, next) => {
  const { service } = req.params;
  const apiKey = await ApiKey.findOne({ service });

  if (!apiKey) {
    return next(new AppError('API service not found', 404, 'SERVICE_NOT_FOUND'));
  }

  apiKey.encryptedKey = '';
  apiKey.lastTested = null;
  apiKey.lastTestResult = null;
  apiKey.updatedBy = req.user._id;
  await apiKey.save();

  res.status(200).json({
    success: true,
    message: `${apiKey.name} API key cleared`,
    data: {}
  });
});

module.exports = {
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
};
