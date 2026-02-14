/**
 * Authentication Controller
 * Handles user registration, login, logout, and password management
 */

const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const config = require('../config/config');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * @desc    Register new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res, next) => {
  const { name, email, password, phone, organization } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return next(new AppError('Email already registered', 400, 'EMAIL_EXISTS'));
  }

  // Create user
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    profile: {
      phone: phone || '',
      organization: organization || ''
    }
  });

  // Create free subscription for new user
  try {
    const freePlan = await SubscriptionPlan.findOne({ tier: 'free' });
    if (freePlan) {
      await Subscription.create({
        user: user._id,
        plan: freePlan._id,
        status: 'active',
        billingCycle: 'none'
      });
    }
  } catch (subError) {
    console.error('Error creating free subscription:', subError.message);
  }

  // Send token response
  sendTokenResponse(user, 201, res, 'Registration successful');
});

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400, 'MISSING_CREDENTIALS'));
  }

  // Check for user
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user) {
    return next(new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS'));
  }

  // Check if account is active
  if (!user.isActive) {
    return next(new AppError('Account is deactivated. Please contact admin.', 401, 'ACCOUNT_DEACTIVATED'));
  }

  // Check password
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS'));
  }

  // Update last active
  user.stats.lastActive = new Date();
  await user.save({ validateBeforeSave: false });

  // Send token response
  sendTokenResponse(user, 200, res, 'Login successful');
});

/**
 * @desc    Logout user / clear cookie
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
    data: {}
  });
});

/**
 * @desc    Get current logged in user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  // Attach subscription info
  const subscription = await Subscription.getForUser(req.user.id);
  const userData = user.toObject();
  if (subscription) {
    userData.subscription = {
      plan: subscription.plan,
      status: subscription.status,
      usage: subscription.usage,
      endDate: subscription.endDate
    };
  }

  res.status(200).json({
    success: true,
    data: userData
  });
});

/**
 * @desc    Update user details
 * @route   PUT /api/v1/auth/updatedetails
 * @access  Private
 */
const updateDetails = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = {
    name: req.body.name,
    'profile.phone': req.body.phone,
    'profile.organization': req.body.organization,
    'profile.bio': req.body.bio,
    'preferences.defaultDialect': req.body.defaultDialect,
    'preferences.defaultStyle': req.body.defaultStyle,
    'preferences.defaultPoetryForm': req.body.defaultPoetryForm,
    'preferences.emailNotifications': req.body.emailNotifications
  };

  // Remove undefined fields
  Object.keys(fieldsToUpdate).forEach(key => {
    if (fieldsToUpdate[key] === undefined) {
      delete fieldsToUpdate[key];
    }
  });

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: user
  });
});

/**
 * @desc    Update password
 * @route   PUT /api/v1/auth/updatepassword
 * @access  Private
 */
const updatePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new AppError('Please provide current and new password', 400, 'MISSING_PASSWORDS'));
  }

  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    return next(new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD'));
  }

  // Validate new password
  if (newPassword.length < 6) {
    return next(new AppError('Password must be at least 6 characters', 400, 'PASSWORD_TOO_SHORT'));
  }

  user.password = newPassword;
  await user.save();

  sendTokenResponse(user, 200, res, 'Password updated successfully');
});

/**
 * @desc    Forgot password
 * @route   POST /api/v1/auth/forgotpassword
 * @access  Public
 */
const forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email?.toLowerCase() });

  if (!user) {
    return next(new AppError('No user found with that email', 404, 'USER_NOT_FOUND'));
  }

  // Get reset token
  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  // In production, send email with reset token
  // For now, just return the token (not secure for production!)
  res.status(200).json({
    success: true,
    message: 'Password reset token generated',
    data: {
      resetToken,
      note: 'In production, this token would be sent via email'
    }
  });
});

/**
 * @desc    Reset password
 * @route   PUT /api/v1/auth/resetpassword/:resettoken
 * @access  Public
 */
const resetPassword = asyncHandler(async (req, res, next) => {
  const crypto = require('crypto');
  
  // Get hashed token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resettoken)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: resetPasswordToken,
    passwordResetExpire: { $gt: Date.now() }
  });

  if (!user) {
    return next(new AppError('Invalid or expired token', 400, 'INVALID_TOKEN'));
  }

  // Set new password
  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res, 'Password reset successful');
});

/**
 * Helper function to send token response
 */
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(Date.now() + config.jwt.cookieExpire * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'strict'
  };

  // Remove password from output
  const userData = user.toObject();
  delete userData.password;

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      message,
      data: userData
    });
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateDetails,
  updatePassword,
  forgotPassword,
  resetPassword
};
