const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const AuditTrail = require('../models/AuditTrail');
const EmailService = require('../utils/emailService');
const emailService = new EmailService();

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const { generateToken, generateEmailVerificationToken, generatePasswordResetToken } = require('../utils/generateToken');
const { protect, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', [
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').isLength({ min: 10 }).withMessage('Please provide a valid phone number'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('dateOfBirth').isDate().withMessage('Please provide a valid date of birth'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Please provide a valid gender'),
  body('bloodType').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Please provide a valid blood type'),
  body('weight').optional().isFloat({ min: 30, max: 300 }).withMessage('Weight must be between 30 and 300 kg'),
  body('height').optional().isFloat({ min: 100, max: 250 }).withMessage('Height must be between 100 and 250 cm'),
  body('address.street').trim().isLength({ min: 5 }).withMessage('Street address is required'),
  body('address.city').trim().isLength({ min: 2 }).withMessage('City is required'),
  body('address.state').trim().isLength({ min: 2 }).withMessage('State is required'),
  body('address.postalCode').optional().trim().isLength({ min: 3 }).withMessage('Postal code must be at least 3 characters'),
  body('address.zipCode').optional().trim().isLength({ min: 3 }).withMessage('Zip code must be at least 3 characters'),
  body('emergencyContact.name').trim().isLength({ min: 2 }).withMessage('Emergency contact name is required'),
  body('emergencyContact.phone').isLength({ min: 10 }).withMessage('Emergency contact phone must be at least 10 characters'),
  body('emergencyContact.relationship').trim().isLength({ min: 2 }).withMessage('Emergency contact relationship is required'),
  body('role').optional().isIn(['donor', 'recipient', 'medical_admin', 'system_admin']).withMessage('Please provide a valid role')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      dateOfBirth,
      gender,
      bloodType,
      weight = 70, // Default weight in kg
      height = 170, // Default height in cm
      address,
      emergencyContact,
      role = 'donor'
    } = req.body;

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${escapeRegExp(normalizedEmail)}$`, 'i') } },
        { phone }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email ? 'Email already registered' : 'Phone number already registered'
      });
    }

    // Check if trying to register as admin and admin already exists
    if (role === 'system_admin' || role === 'medical_admin') {
      const existingAdmin = await User.findOne({
        role: { $in: ['system_admin', 'medical_admin'] }
      });
      
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Admin user already exists. Admin registration is not allowed.'
        });
      }
    }

    // Validate age (must be 18+)
    const age = Math.floor((new Date() - new Date(dateOfBirth)) / (1000 * 60 * 60 * 24 * 365));
    if (age < 18) {
      return res.status(400).json({
        success: false,
        message: 'You must be at least 18 years old to register'
      });
    }

    // Create user
    const user = new User({
      firstName,
      lastName,
      email: normalizedEmail,
      phone: phone.trim(),
      password,
      dateOfBirth,
      gender,
      bloodType,
      weight,
      height,
      address: {
        ...address,
        postalCode: address.postalCode || address.zipCode, // Use zipCode if postalCode is not provided
        coordinates: {
          type: 'Point',
          coordinates: [0, 0] // Will be updated with geocoding
        }
      },
      emergencyContact,
      role,
      isEmailVerified: true, // Set email as verified by default
      emailVerificationToken: null // No verification token needed
    });

    await user.save();

    // Generate JWT token
    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    // Log audit trail
    await AuditTrail.logAction({
      userId: user._id,
      userEmail: user.email,
      userRole: user.role,
      action: 'register',
      resourceType: 'user',
      resourceId: user._id,
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      description: 'User registered successfully',
      changes: { before: null, after: { email: user.email, role: user.role } },
      status: 'success',
      location: await getLocationFromIP(req.ip),
      metadata: { registrationMethod: 'email' }
    });

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully. You can now access your dashboard.',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified
        },
        token,
        refreshToken
      }
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    // Find user and include password for comparison
    const user = await User.findOne({ email: { $regex: new RegExp(`^${escapeRegExp(normalizedEmail)}$`, 'i') } }).select('+password');

    if (!user) {
      // Log failed login attempt
      await AuditTrail.logAction({
        userId: null,
        userEmail: email,
        userRole: 'anonymous',
        action: 'login',
        resourceType: 'authentication',
        resourceId: null,
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        description: 'Failed login attempt - user not found',
        changes: null,
        status: 'failure',
        errorMessage: 'Invalid credentials',
        location: await getLocationFromIP(req.ip),
        riskLevel: 'medium'
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      await AuditTrail.logAction({
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        action: 'login',
        resourceType: 'authentication',
        resourceId: user._id,
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        description: 'Failed login attempt - account deactivated',
        changes: null,
        status: 'failure',
        errorMessage: 'Account is deactivated',
        location: await getLocationFromIP(req.ip),
        riskLevel: 'medium'
      });

      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      await AuditTrail.logAction({
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        action: 'login',
        resourceType: 'authentication',
        resourceId: user._id,
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        description: 'Failed login attempt - account blocked',
        changes: null,
        status: 'failure',
        errorMessage: 'Account is blocked',
        location: await getLocationFromIP(req.ip),
        riskLevel: 'high'
      });

      return res.status(401).json({
        success: false,
        message: 'Account is blocked'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      await AuditTrail.logAction({
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        action: 'login',
        resourceType: 'authentication',
        resourceId: user._id,
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        description: 'Failed login attempt - invalid password',
        changes: null,
        status: 'failure',
        errorMessage: 'Invalid credentials',
        location: await getLocationFromIP(req.ip),
        riskLevel: 'medium'
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    user.lastActivity = new Date();
    await user.save();

    // Generate tokens
    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    // Log successful login
    await AuditTrail.logAction({
      userId: user._id,
      userEmail: user.email,
      userRole: user.role,
      action: 'login',
      resourceType: 'authentication',
      resourceId: user._id,
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      description: 'User logged in successfully',
      changes: { before: null, after: { lastLogin: user.lastLogin } },
      status: 'success',
      location: await getLocationFromIP(req.ip),
      metadata: { loginMethod: 'email' }
    });

    logger.info(`User logged in: ${user.email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          isMedicalVerified: user.isMedicalVerified,
          profilePicture: user.profilePicture,
          lastLogin: user.lastLogin
        },
        token,
        refreshToken
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, async (req, res) => {
  try {
    // Log logout
    await AuditTrail.logAction({
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'logout',
      resourceType: 'authentication',
      resourceId: req.user._id,
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      description: 'User logged out successfully',
      changes: null,
      status: 'success',
      location: await getLocationFromIP(req.ip)
    });

    logger.info(`User logged out: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Public
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required')
], async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive || user.isBlocked) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const newToken = user.generateAuthToken();
    const newRefreshToken = user.generateRefreshToken();

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

// @desc    Verify email
// @route   POST /api/auth/verify-email
// @access  Public
router.post('/verify-email', [
  body('token').notEmpty().withMessage('Verification token is required')
], async (req, res) => {
  try {
    const { token } = req.body;

    const user = await User.findOne({ emailVerificationToken: token });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    // Log email verification
    await AuditTrail.logAction({
      userId: user._id,
      userEmail: user.email,
      userRole: user.role,
      action: 'email_verification',
      resourceType: 'user',
      resourceId: user._id,
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      description: 'Email verified successfully',
      changes: { before: { isEmailVerified: false }, after: { isEmailVerified: true } },
      status: 'success',
      location: await getLocationFromIP(req.ip)
    });

    logger.info(`Email verified: ${user.email}`);

    res.json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during email verification'
    });
  }
});

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Private
router.post('/resend-verification', protect, async (req, res) => {
  try {
    const user = req.user;

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new verification token
    const verificationToken = generateEmailVerificationToken();
    user.emailVerificationToken = verificationToken.token;
    await user.save();

    // Send verification email
    await emailService.sendVerificationEmail(user, verificationToken.token);

    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });

  } catch (error) {
    logger.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')
], async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if email exists or not
      return res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    }

    // Generate password reset token
    const resetToken = generatePasswordResetToken();
    user.passwordResetToken = resetToken.token;
    user.passwordResetExpires = resetToken.expiresAt;
    await user.save();

    // Send password reset email
    await emailService.sendPasswordResetEmail(user, resetToken.token);

    // Log password reset request
    await AuditTrail.logAction({
      userId: user._id,
      userEmail: user.email,
      userRole: user.role,
      action: 'password_reset',
      resourceType: 'authentication',
      resourceId: user._id,
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      description: 'Password reset requested',
      changes: null,
      status: 'success',
      location: await getLocationFromIP(req.ip),
      riskLevel: 'medium'
    });

    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });

  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Log password reset
    await AuditTrail.logAction({
      userId: user._id,
      userEmail: user.email,
      userRole: user.role,
      action: 'password_reset',
      resourceType: 'authentication',
      resourceId: user._id,
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      description: 'Password reset successfully',
      changes: null,
      status: 'success',
      location: await getLocationFromIP(req.ip),
      riskLevel: 'high'
    });

    logger.info(`Password reset: ${user.email}`);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Change password
// @route   POST /api/auth/change-password
// @access  Private
router.post('/change-password', [
  protect,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Log password change
    await AuditTrail.logAction({
      userId: user._id,
      userEmail: user.email,
      userRole: user.role,
      action: 'password_change',
      resourceType: 'authentication',
      resourceId: user._id,
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      description: 'Password changed successfully',
      changes: null,
      status: 'success',
      location: await getLocationFromIP(req.ip),
      riskLevel: 'high'
    });

    logger.info(`Password changed: ${user.email}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Helper function to get location from IP
const getLocationFromIP = async (ipAddress) => {
  // In a real implementation, you would use a geolocation service
  return {
    country: 'Unknown',
    region: 'Unknown',
    city: 'Unknown'
  };
};

module.exports = router;
