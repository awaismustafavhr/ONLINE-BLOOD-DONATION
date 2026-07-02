const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const BloodRequest = require('../models/BloodRequest');
const Donation = require('../models/Donation');
const Notification = require('../models/Notification');
const AuditTrail = require('../models/AuditTrail');
const Analytics = require('../models/Analytics');
const { protect, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @desc    Get all users (Admin only)
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', protect, authorize('medical_admin', 'system_admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const {
      role,
      bloodType,
      isActive,
      status,
      isVerified,
      isMedicalVerified,
      city,
      state,
      search,
      sortBy: sortByParam,
      sortOrder: sortOrderParam
    } = req.query;

    // Build filter object
    const filter = {};
    const orConditions = [];
    
    // Handle role filter - can be single role or comma-separated roles
    if (role) {
      if (role.includes(',')) {
        // Multiple roles (e.g., "donor,recipient")
        const roles = role.split(',').map(r => r.trim());
        filter.role = { $in: roles };
      } else {
        filter.role = role;
      }
    }
    if (bloodType) filter.bloodType = bloodType;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (status) {
      switch (status) {
        case 'active':
          filter.isActive = true;
          filter.isBlocked = { $ne: true };
          break;
        case 'inactive':
          filter.isActive = false;
          break;
        case 'suspended':
          filter.isBlocked = true;
          break;
        case 'pending':
          filter.isEmailVerified = false;
          break;
      }
    }
    if (isVerified !== undefined) {
      if (isVerified === 'true') {
        filter.isEmailVerified = true;
        filter.isPhoneVerified = true;
        filter.isMedicalVerified = true;
      } else {
        orConditions.push(
          { isEmailVerified: false },
          { isPhoneVerified: false },
          { isMedicalVerified: false }
        );
      }
    }
    // Support direct medical verification filter
    if (isMedicalVerified !== undefined && isMedicalVerified !== null && isMedicalVerified !== '') {
      // Handle both string and boolean values
      const isVerified = isMedicalVerified === 'true' || isMedicalVerified === true;
      filter.isMedicalVerified = isVerified;
      logger.info(`Medical verification filter: ${isMedicalVerified} -> ${isVerified}`);
    }
    if (city) filter['address.city'] = new RegExp(city, 'i');
    if (state) filter['address.state'] = new RegExp(state, 'i');
    if (search) {
      orConditions.push(
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') }
      );
    }
    
    // Combine $or conditions if any exist
    if (orConditions.length > 0) {
      filter.$or = orConditions;
    }

    // Sorting
    const sortBy = sortByParam || 'createdAt';
    const sortOrder = (sortOrderParam || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    const sort = {};
    if (sortBy === 'name') {
      sort.firstName = sortOrder;
      sort.lastName = sortOrder;
    } else if (sortBy === 'email') {
      sort.email = sortOrder;
    } else {
      sort[sortBy] = sortOrder;
    }

    const users = await User.find(filter)
      .select('-password -emailVerificationToken -passwordResetToken -phoneVerificationToken')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    // Debug logging
    logger.info(`Admin users query: Found ${users.length} users out of ${total} total`);
    logger.info(`Filter used:`, JSON.stringify(filter, null, 2));
    logger.info(`Query params:`, JSON.stringify(req.query, null, 2));
    if (users.length > 0) {
      logger.info(`Sample user medical verification status:`, users[0].isMedicalVerified);
    }

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          total,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get admin users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get single user by ID (Admin only)
// @route   GET /api/admin/users/:id
// @access  Private/Admin
router.get('/users/:id', protect, authorize('medical_admin', 'system_admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -emailVerificationToken -passwordResetToken -phoneVerificationToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    logger.error('Get admin user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Create user (System Admin only)
// @route   POST /api/admin/users
// @access  Private/System Admin
router.post('/users', [
  protect,
  authorize('system_admin'),
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').isLength({ min: 10 }).withMessage('Phone must be at least 10 characters'),
  body('role').isIn(['donor', 'recipient', 'medical_admin', 'system_admin']).withMessage('Please provide a valid role'),
  body('bloodType').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Please provide a valid blood type'),
  body('dateOfBirth').optional().isDate().withMessage('Please provide a valid date of birth'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Please provide a valid gender'),
  body('address.street').optional().trim().isLength({ min: 3 }).withMessage('Street address must be at least 3 characters'),
  body('address.city').optional().trim().isLength({ min: 2 }).withMessage('City must be at least 2 characters'),
  body('address.state').optional().trim().isLength({ min: 2 }).withMessage('State must be at least 2 characters'),
  body('address.zipCode').optional().trim().isLength({ min: 3 }).withMessage('Zip code must be at least 3 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Create user validation errors:', errors.array());
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
      password,
      phone,
      role,
      bloodType,
      dateOfBirth,
      gender,
      address
    } = req.body;

    const normalizedAddress = address || {};
    if (normalizedAddress.zipCode && !normalizedAddress.postalCode) {
      normalizedAddress.postalCode = normalizedAddress.zipCode;
    }
    if (!normalizedAddress.country) normalizedAddress.country = 'Pakistan';
    if (!normalizedAddress.street) normalizedAddress.street = 'Unknown';
    if (!normalizedAddress.city) normalizedAddress.city = 'Unknown';
    if (!normalizedAddress.state) normalizedAddress.state = 'Unknown';
    if (!normalizedAddress.postalCode) normalizedAddress.postalCode = '00000';
    if (!normalizedAddress.coordinates || !Array.isArray(normalizedAddress.coordinates?.coordinates)) {
      normalizedAddress.coordinates = { type: 'Point', coordinates: [67.0011, 24.8607] };
    }

    const finalBloodType = bloodType || 'O+';
    const finalGender = gender || 'other';
    const finalDob = dateOfBirth ? new Date(dateOfBirth) : new Date('1990-01-01');

    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      logger.warn('Create user conflict (email/phone exists):', { email, phone });
      return res.status(400).json({
        success: false,
        message: existingUser.email === email ? 'Email already registered' : 'Phone number already registered'
      });
    }

    // Only system_admin can create admin users (medical_admin or system_admin)
    if (role === 'system_admin' || role === 'medical_admin') {
      if (req.user.role !== 'system_admin') {
        logger.warn('Create user admin blocked: only system_admin can create admin users');
        return res.status(403).json({
          success: false,
          message: 'Only system administrators can create admin users.'
        });
      }
      
      // If creating system_admin, check if one already exists
      if (role === 'system_admin') {
        const existingSystemAdmin = await User.findOne({ role: 'system_admin' });
        if (existingSystemAdmin) {
          logger.warn('Create user admin blocked: system_admin already exists');
          return res.status(400).json({
            success: false,
            message: 'System administrator already exists. Only one system admin is allowed.'
          });
        }
      }
    }
    
    // Medical admins can only create regular users (donors/recipients)
    if (req.user.role === 'medical_admin' && (role === 'medical_admin' || role === 'system_admin')) {
      logger.warn('Create user admin blocked: medical_admin cannot create admin users');
      return res.status(403).json({
        success: false,
        message: 'Medical administrators cannot create admin users.'
      });
    }

    // Create user - password will be hashed by User model's pre-save hook
    const user = new User({
      firstName,
      lastName,
      email,
      password: password, // Set plain password - pre-save hook will hash it
      phone,
      role,
      bloodType: finalBloodType,
      dateOfBirth: finalDob,
      gender: finalGender,
      address: normalizedAddress,
      weight: req.body.weight || 60,
      height: req.body.height || 170,
      emergencyContact: req.body.emergencyContact || { name: `${firstName} ${lastName}`, phone, relationship: 'self' },
      isEmailVerified: true,
      isActive: true
    });

    // Save user - pre-save hook will automatically hash the password
    await user.save();

    await AuditTrail.logAction({
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'user_create',
      resourceType: 'user',
      resourceId: user._id,
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      description: `User created by ${req.user.role}: ${firstName} ${lastName} (${role})`,
      changes: { before: {}, after: { firstName, lastName, email, role } },
      status: 'success',
      location: await getLocationFromIP(req.ip),
      riskLevel: role === 'system_admin' || role === 'medical_admin' ? 'high' : 'low'
    });

    logger.info(`User created by admin: ${user.email}`);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user }
    });

  } catch (error) {
    logger.error('Create user error:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => ({ field: e.path, message: e.message }));
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Update user (Admin only)
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
router.put('/users/:id', [
  protect,
  authorize('medical_admin', 'system_admin'),
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }),
  body('phone').optional().isLength({ min: 10, max: 15 }),
  body('dateOfBirth').optional().isISO8601(),
  body('gender').optional().isIn(['male', 'female', 'other']),
  body('weight').optional().isFloat({ min: 30, max: 300 }),
  body('height').optional().isFloat({ min: 100, max: 250 }),
  body('role').optional().isIn(['donor', 'recipient', 'medical_admin', 'system_admin']),
  body('bloodType').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  body('address.street').optional().trim().isLength({ min: 5 }),
  body('address.city').optional().trim().isLength({ min: 2 }),
  body('address.state').optional().trim().isLength({ min: 2 }),
  body('address.postalCode').optional().trim().isLength({ min: 3 }),
  body('isActive').optional().isBoolean(),
  body('isBlocked').optional().isBoolean(),
  body('isEmailVerified').optional().isBoolean(),
  body('isPhoneVerified').optional().isBoolean(),
  body('isMedicalVerified').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent updating system admin unless current user is system admin
    if (user.role === 'system_admin' && req.user.role !== 'system_admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update system admin'
      });
    }

    // Prevent changing role to system_admin unless current user is system_admin
    if (req.body.role === 'system_admin' && req.user.role !== 'system_admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to assign system admin role'
      });
    }

    const originalData = {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      isBlocked: user.isBlocked
    };

    // Medical admins can only update medical verification fields
    if (req.user.role === 'medical_admin') {
      // Only allow medical verification fields for medical admins
      if (req.body.isMedicalVerified !== undefined) {
        user.isMedicalVerified = req.body.isMedicalVerified;
        // Track verification date in metadata or use updatedAt
        if (req.body.isMedicalVerified && !user.metadata) {
          user.metadata = {};
        }
        if (user.metadata) {
          if (req.body.isMedicalVerified) {
            user.metadata.medicalVerificationDate = new Date();
            user.metadata.verifiedBy = req.user._id;
          } else {
            user.metadata.medicalVerificationDate = null;
            user.metadata.verifiedBy = null;
          }
        }
      }
      // Medical admins cannot update other fields
      await user.save();

      await AuditTrail.logAction({
        userId: req.user._id,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'medical_verification',
        resourceType: 'medical_record',
        resourceId: user._id,
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        description: `Medical verification ${req.body.isMedicalVerified ? 'approved' : 'revoked'} for ${user.firstName} ${user.lastName}`,
        changes: { before: { isMedicalVerified: originalData.isMedicalVerified || false }, after: { isMedicalVerified: req.body.isMedicalVerified } },
        status: 'success',
        location: await getLocationFromIP(req.ip),
        riskLevel: 'medium'
      });

      logger.info(`Medical verification updated by ${req.user.role}: ${user.email}`);

      return res.json({
        success: true,
        message: 'Medical verification updated successfully',
        data: { user }
      });
    }

    // System admin can update all fields
    const allowedFields = [
      'firstName', 'lastName', 'phone', 'dateOfBirth', 'gender',
      'weight', 'height', 'address', 'emergencyContact', 'medicalHistory',
      'preferredContactMethod', 'availabilityRadius', 'settings',
      'bloodType', 'role', 'isActive', 'isBlocked', 'isEmailVerified',
      'isPhoneVerified', 'isMedicalVerified'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    await user.save();

    await AuditTrail.logAction({
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'user_update',
      resourceType: 'user',
      resourceId: user._id,
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      description: 'User updated by admin',
      changes: { before: originalData, after: req.body },
      status: 'success',
      location: await getLocationFromIP(req.ip),
      riskLevel: 'medium'
    });

    logger.info(`User updated by admin: ${user.email}`);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });

  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Delete user (System Admin only)
// @route   DELETE /api/admin/users/:id
// @access  Private/System Admin
router.delete('/users/:id', protect, authorize('system_admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting other system admins unless current user is system admin
    if (user.role === 'system_admin' && req.user.role !== 'system_admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete system admin'
      });
    }

    // Delete profile picture from Cloudinary if exists
    if (user.profilePicture && user.profilePicture.includes('cloudinary.com')) {
      try {
        const cloudinary = require('cloudinary').v2;
        const publicId = user.profilePicture.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`bloodlink/profile-pictures/${publicId}`);
      } catch (error) {
        logger.warn('Error deleting profile picture from Cloudinary:', error);
      }
    }

    await User.findByIdAndDelete(req.params.id);

    await AuditTrail.logAction({
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'user_delete',
      resourceType: 'user',
      resourceId: user._id,
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      description: 'User deleted by admin',
      changes: { before: { email: user.email, role: user.role }, after: null },
      status: 'success',
      location: await getLocationFromIP(req.ip),
      riskLevel: 'critical'
    });

    logger.info(`User deleted by admin: ${user.email} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get audit trail (System Admin only)
// @route   GET /api/admin/audit-trail
// @access  Private/System Admin
router.get('/audit-trail', protect, authorize('system_admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const {
      userId,
      userRole,
      action,
      resourceType,
      status,
      riskLevel,
      isSuspicious,
      startDate,
      endDate,
      search,
      sortBy: sortByParam,
      sortOrder: sortOrderParam
    } = req.query;

    // Build filter object
    const filter = {};
    const searchConditions = [];
    
    // Build base filters
    if (userId) filter.userId = userId;
    if (userRole) {
      // Filter by user role - find audit trails where userRole matches
      filter.userRole = userRole;
    }
    if (action) {
      // Use exact match for action filter (actions are stored in lowercase with underscores)
      filter.action = action;
    }
    if (resourceType) filter.resourceType = resourceType;
    if (status) filter.status = status;
    if (riskLevel) filter.riskLevel = riskLevel;
    if (isSuspicious !== undefined) filter.isSuspicious = isSuspicious === 'true';
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    // Handle search filter
    if (search) {
      searchConditions.push(
        { userEmail: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { ipAddress: new RegExp(search, 'i') },
        { action: new RegExp(search, 'i') }
      );
    }
    
    // Combine search with other filters using $and if we have both
    if (searchConditions.length > 0) {
      if (Object.keys(filter).length > 0) {
        // We have both search and other filters, combine them with $and
        const baseFilters = { ...filter };
        // Clear filter and rebuild with $and
        Object.keys(filter).forEach(key => delete filter[key]);
        filter.$and = [
          baseFilters,
          { $or: searchConditions }
        ];
      } else {
        // Only search filter
        filter.$or = searchConditions;
      }
    }

    // Sorting
    const sortBy = sortByParam || 'createdAt';
    const sortOrder = (sortOrderParam || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    // Debug logging
    logger.info(`Admin audit trail query - Filter:`, JSON.stringify(filter, null, 2));
    logger.info(`Admin audit trail query - Params:`, { action, userRole, resourceType, search });

    const auditTrails = await AuditTrail.find(filter)
      .populate('userId', 'firstName lastName email role')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await AuditTrail.countDocuments(filter);

    logger.info(`Admin audit trail query: Found ${auditTrails.length} logs out of ${total} total`);

    res.json({
      success: true,
      data: {
        auditTrails,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          total,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get admin audit trail error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get audit trail entry by ID (System Admin only)
// @route   GET /api/admin/audit-trail/:id
// @access  Private/System Admin
router.get('/audit-trail/:id', protect, authorize('system_admin'), async (req, res) => {
  try {
    const auditTrail = await AuditTrail.findById(req.params.id)
      .populate('userId', 'firstName lastName email role');

    if (!auditTrail) {
      return res.status(404).json({
        success: false,
        message: 'Audit trail entry not found'
      });
    }

    res.json({
      success: true,
      data: { auditTrail }
    });

  } catch (error) {
    logger.error('Get admin audit trail entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get admin dashboard overview
// @route   GET /api/admin/dashboard
// @access  Private/Admin
router.get('/dashboard', protect, authorize('medical_admin', 'system_admin'), async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get comprehensive statistics
    const [
      totalUsers,
      activeUsers,
      newUsers,
      totalRequests,
      completedRequests,
      pendingRequests,
      criticalRequests,
      highUrgencyRequests,
      mediumUrgencyRequests,
      lowUrgencyRequests,
      totalDonations,
      successfulDonations,
      totalNotifications,
      unreadNotifications,
      systemAlerts,
      recentActivityRaw
    ] = await Promise.all([
      User.countDocuments({ createdAt: { $lte: endDate } }),
      User.countDocuments({ 
        lastActivity: { $gte: startDate, $lte: endDate },
        isActive: true 
      }),
      User.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      BloodRequest.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      BloodRequest.countDocuments({ 
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }),
      BloodRequest.countDocuments({ 
        status: 'pending',
        expiresAt: { $gt: new Date() }
      }),
      BloodRequest.countDocuments({ 
        urgency: 'critical',
        status: { $in: ['pending', 'matched', 'confirmed'] }
      }),
      BloodRequest.countDocuments({ 
        urgency: 'high',
        status: { $in: ['pending', 'matched', 'confirmed'] }
      }),
      BloodRequest.countDocuments({ 
        urgency: 'medium',
        status: { $in: ['pending', 'matched', 'confirmed'] }
      }),
      BloodRequest.countDocuments({ 
        urgency: 'low',
        status: { $in: ['pending', 'matched', 'confirmed'] }
      }),
      Donation.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      Donation.countDocuments({ 
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'distributed'
      }),
      Notification.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      Notification.countDocuments({ 
        isRead: false,
        expiresAt: { $gt: new Date() }
      }),
      AuditTrail.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
        riskLevel: { $in: ['high', 'critical'] }
      }),
      AuditTrail.find({
        createdAt: { $gte: startDate, $lte: endDate }
      })
      .populate('userId', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('action description createdAt userId userEmail riskLevel')
    ]);

    // Format recent activity for frontend
    let recentActivity = (recentActivityRaw && Array.isArray(recentActivityRaw) && recentActivityRaw.length > 0) 
      ? recentActivityRaw.map(activity => ({
          description: activity.description || `${activity.action || 'Activity'} by ${activity.userId ? (activity.userId.firstName + ' ' + activity.userId.lastName) : activity.userEmail || 'System'}`,
          type: activity.action && activity.action.includes('user') ? 'user' : 
                activity.action && activity.action.includes('donation') ? 'donation' :
                activity.action && activity.action.includes('request') ? 'request' :
                activity.action && activity.action.includes('login') ? 'authentication' : 'system',
          createdAt: activity.createdAt,
          userEmail: activity.userEmail,
          riskLevel: activity.riskLevel
        }))
      : [];

    // Fallback for empty period: get latest activities
    if (!recentActivity || recentActivity.length === 0) {
      const fallback = await AuditTrail.find({})
        .populate('userId', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .limit(10)
        .select('action description createdAt userId userEmail riskLevel');
      recentActivity = fallback.map(activity => ({
        description: activity.description || `${activity.action || 'Activity'} by ${activity.userId ? (activity.userId.firstName + ' ' + activity.userId.lastName) : activity.userEmail || 'System'}`,
        type: activity.action && activity.action.includes('user') ? 'user' : 
              activity.action && activity.action.includes('donation') ? 'donation' :
              activity.action && activity.action.includes('request') ? 'request' :
              activity.action && activity.action.includes('login') ? 'authentication' : 'system',
        createdAt: activity.createdAt,
        userEmail: activity.userEmail,
        riskLevel: activity.riskLevel
      }));
    }

    // Calculate success rates
    const requestSuccessRate = totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0;
    const donationSuccessRate = totalDonations > 0 ? (successfulDonations / totalDonations) * 100 : 0;

    // Get blood type distribution
    const bloodTypeDistribution = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$bloodType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get urgency distribution
    const urgencyDistribution = await BloodRequest.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$urgency',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get geographic distribution
    const geographicDistribution = await BloodRequest.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: { city: '$city', state: '$state' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get system health metrics
    const systemHealth = await getSystemHealthMetrics();

    // Add medical verification counts
    const [medicalVerifications, pendingVerifications] = await Promise.all([
      User.countDocuments({ isMedicalVerified: true, role: { $in: ['donor', 'recipient'] } }),
      User.countDocuments({ isMedicalVerified: false, role: { $in: ['donor', 'recipient'] } })
    ]);

    const dashboardData = {
      // Top-level stats for easy access
      totalUsers,
      activeUsers,
      previousUsers: totalUsers,
      newUsers,
      totalRequests,
      previousRequests: 0, // Could calculate if needed
      completedRequests,
      pendingRequests,
      criticalRequests,
      highUrgencyRequests,
      mediumUrgencyRequests,
      lowUrgencyRequests,
      totalDonations,
      previousDonations: 0, // Could calculate if needed
      successfulDonations,
      totalBloodCollected: totalDonations * 450, // Approximate
      previousBloodCollected: 0, // Could calculate if needed
      totalNotifications,
      unreadNotifications,
      medicalVerifications,
      pendingVerifications,
      systemAlerts,
      overview: {
        totalUsers,
        activeUsers,
        newUsers,
        totalRequests,
        completedRequests,
        pendingRequests,
        criticalRequests,
        highUrgencyRequests,
        mediumUrgencyRequests,
        lowUrgencyRequests,
        totalDonations,
        successfulDonations,
        totalNotifications,
        unreadNotifications,
        systemAlerts,
        medicalVerifications,
        pendingVerifications,
        requestSuccessRate: Math.round(requestSuccessRate * 100) / 100,
        donationSuccessRate: Math.round(donationSuccessRate * 100) / 100
      },
      distributions: {
        bloodType: bloodTypeDistribution,
        urgency: urgencyDistribution,
        geographic: geographicDistribution
      },
      recentActivity,
      systemHealth
    };

    res.json({
      success: true,
      data: { dashboard: dashboardData }
    });

  } catch (error) {
    logger.error('Get admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get medical report metrics
// @route   GET /api/admin/medical-report
// @access  Private/Admin
router.get('/medical-report', protect, authorize('medical_admin', 'system_admin'), async (req, res) => {
  try {
    const { startDate: startStr, endDate: endStr } = req.query;
    const endDate = endStr ? new Date(endStr) : new Date();
    const startDate = startStr ? new Date(startStr) : new Date(new Date().setDate(endDate.getDate() - 30));

    const [
      donationsTotal,
      donationsByStatus,
      testingOutcomes,
      storedUnits,
      distributedUnits,
      discardedUnits,
      requestsByStatus,
      inventoryByBloodType,
      verifiedUsers,
      unverifiedUsers
    ] = await Promise.all([
      Donation.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      Donation.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Donation.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$bloodTesting.isSuitableForTransfusion', count: { $sum: 1 } } }
      ]),
      Donation.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: 'stored' } },
        { $group: { _id: null, ml: { $sum: { $multiply: ['$bloodUnits', 450] } } } }
      ]),
      Donation.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: 'distributed' } },
        { $group: { _id: null, ml: { $sum: { $multiply: ['$bloodUnits', 450] } } } }
      ]),
      Donation.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: 'discarded' } },
        { $group: { _id: null, ml: { $sum: { $multiply: ['$bloodUnits', 450] } } } }
      ]),
      BloodRequest.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Donation.aggregate([
        { $match: { createdAt: { $lte: endDate } } },
        { $group: { _id: '$bloodType', units: { $sum: '$bloodUnits' }, ml: { $sum: { $multiply: ['$bloodUnits', 450] } } } },
        { $sort: { _id: 1 } }
      ]),
      User.countDocuments({ isMedicalVerified: true, role: { $in: ['donor','recipient'] } }),
      User.countDocuments({ isMedicalVerified: false, role: { $in: ['donor','recipient'] } })
    ]);

    const asMap = (arr, key = '_id', val = 'count') =>
      Object.fromEntries((arr || []).map(i => [String(i[key]), i[val] ?? 0]));

    const report = {
      period: { startDate, endDate },
      totals: {
        donations: donationsTotal,
        successfulDonations: asMap(donationsByStatus)['completed'] || 0,
      },
      donationsByStatus: asMap(donationsByStatus),
      testing: {
        suitable: asMap(testingOutcomes, '_id')['true'] || 0,
        unsuitable: asMap(testingOutcomes, '_id')['false'] || 0,
      },
      volumesMl: {
        stored: (storedUnits[0]?.ml) || 0,
        distributed: (distributedUnits[0]?.ml) || 0,
        discarded: (discardedUnits[0]?.ml) || 0,
      },
      requestsByStatus: asMap(requestsByStatus),
      verifications: { verified: verifiedUsers || 0, unverified: unverifiedUsers || 0 },
      inventoryByBloodType: (inventoryByBloodType || []).map(i => ({ bloodType: i._id, units: i.units, ml: i.ml })),
    };

    return res.json({ success: true, data: { report } });
  } catch (error) {
    logger.error('Get medical report error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get system statistics
// @route   GET /api/admin/statistics
// @access  Private/Admin
router.get('/statistics', protect, authorize('medical_admin', 'system_admin'), async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let statistics;

    switch (type) {
      case 'users':
        statistics = await getUserStatistics(start, end);
        break;
      case 'blood-requests':
        statistics = await BloodRequest.getStatistics();
        break;
      case 'donations':
        statistics = await Donation.getStatistics();
        break;
      case 'notifications':
        statistics = await getNotificationStatistics(start, end);
        break;
      case 'audit':
        statistics = await getAuditStatistics(start, end);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid statistics type'
        });
    }

    res.json({
      success: true,
      data: { statistics }
    });

  } catch (error) {
    logger.error('Get system statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get system health
// @route   GET /api/admin/system-health
// @access  Private/System Admin
router.get('/system-health', protect, authorize('system_admin'), async (req, res) => {
  try {
    const systemHealth = await getSystemHealthMetrics();

    res.json({
      success: true,
      data: { systemHealth }
    });

  } catch (error) {
    logger.error('Get system health error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update system configuration
// @route   PUT /api/admin/config
// @access  Private/System Admin
router.put('/config', [
  protect,
  authorize('system_admin'),
  body('config').isObject().withMessage('Configuration object is required')
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

    const { config } = req.body;

    // In a real implementation, you would update system configuration
    // For now, we'll just log the action

    // Log configuration update
    await AuditTrail.logAction({
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'system_config_update',
      resourceType: 'system',
      resourceId: null,
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      description: 'System configuration updated',
      changes: { before: null, after: config },
      status: 'success',
      location: await getLocationFromIP(req.ip),
      riskLevel: 'high'
    });

    logger.info(`System configuration updated by ${req.user.email}`);

    res.json({
      success: true,
      message: 'System configuration updated successfully',
      data: { config }
    });

  } catch (error) {
    logger.error('Update system configuration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Generate system backup
// @route   POST /api/admin/backup
// @access  Private/System Admin
router.post('/backup', protect, authorize('system_admin'), async (req, res) => {
  try {
    // In a real implementation, you would create a database backup
    const backupInfo = {
      timestamp: new Date(),
      type: 'full',
      size: '0 MB', // Would be calculated from actual backup
      status: 'completed'
    };

    // Log backup creation
    await AuditTrail.logAction({
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'backup_create',
      resourceType: 'system',
      resourceId: null,
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      description: 'System backup created',
      changes: { before: null, after: backupInfo },
      status: 'success',
      location: await getLocationFromIP(req.ip),
      riskLevel: 'medium'
    });

    logger.info(`System backup created by ${req.user.email}`);

    res.json({
      success: true,
      message: 'System backup created successfully',
      data: { backup: backupInfo }
    });

  } catch (error) {
    logger.error('Create system backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Cleanup system data
// @route   DELETE /api/admin/cleanup
// @access  Private/System Admin
router.delete('/cleanup', [
  protect,
  authorize('system_admin'),
  body('cleanupType').isIn(['notifications', 'audit', 'analytics', 'all']).withMessage('Valid cleanup type is required'),
  body('retentionDays').optional().isInt({ min: 1, max: 3650 }).withMessage('Retention days must be between 1 and 3650')
], async (req, res) => {
  try {
    const { cleanupType, retentionDays = 30 } = req.body;

    let cleanupResults = {};

    switch (cleanupType) {
      case 'notifications':
        const notificationResult = await Notification.cleanupExpired();
        cleanupResults.notifications = { deletedCount: notificationResult.deletedCount };
        break;
      case 'audit':
        const auditResult = await AuditTrail.cleanupOldEntries();
        cleanupResults.audit = { deletedCount: auditResult.deletedCount };
        break;
      case 'analytics':
        // Cleanup old analytics data
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        const analyticsResult = await Analytics.deleteMany({ createdAt: { $lt: cutoffDate } });
        cleanupResults.analytics = { deletedCount: analyticsResult.deletedCount };
        break;
      case 'all':
        const allResults = await Promise.all([
          Notification.cleanupExpired(),
          AuditTrail.cleanupOldEntries(),
          Analytics.deleteMany({ createdAt: { $lt: new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000) } })
        ]);
        cleanupResults = {
          notifications: { deletedCount: allResults[0].deletedCount },
          audit: { deletedCount: allResults[1].deletedCount },
          analytics: { deletedCount: allResults[2].deletedCount }
        };
        break;
    }

    // Log cleanup action
    await AuditTrail.logAction({
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'system_cleanup',
      resourceType: 'system',
      resourceId: null,
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      description: `System cleanup performed: ${cleanupType}`,
      changes: { before: null, after: cleanupResults },
      status: 'success',
      location: await getLocationFromIP(req.ip),
      riskLevel: 'medium'
    });

    logger.info(`System cleanup performed: ${cleanupType} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'System cleanup completed successfully',
      data: { cleanupResults }
    });

  } catch (error) {
    logger.error('System cleanup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get system logs
// @route   GET /api/admin/logs
// @access  Private/System Admin
router.get('/logs', protect, authorize('system_admin'), async (req, res) => {
  try {
    const { level, startDate, endDate, limit = 100 } = req.query;
    
    // In a real implementation, you would read from log files
    // For now, we'll return audit trail entries as logs
    const filter = {};
    
    if (level) filter.riskLevel = level;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditTrail.find(filter)
      .populate('userId', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('action description createdAt userId userEmail riskLevel status');

    res.json({
      success: true,
      data: { logs }
    });

  } catch (error) {
    logger.error('Get system logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Send system announcement
// @route   POST /api/admin/announcement
// @access  Private/Admin
router.post('/announcement', [
  protect,
  authorize('medical_admin', 'system_admin'),
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title is required'),
  body('message').trim().isLength({ min: 1, max: 500 }).withMessage('Message is required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('targetRoles').optional().isArray().withMessage('Target roles must be an array'),
  body('targetBloodTypes').optional().isArray().withMessage('Target blood types must be an array'),
  body('targetCities').optional().isArray().withMessage('Target cities must be an array')
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
      title,
      message,
      priority = 'medium',
      targetRoles,
      targetBloodTypes,
      targetCities
    } = req.body;

    // Build user filter
    const userFilter = { isActive: true };
    
    if (targetRoles && targetRoles.length > 0) {
      userFilter.role = { $in: targetRoles };
    }
    
    if (targetBloodTypes && targetBloodTypes.length > 0) {
      userFilter.bloodType = { $in: targetBloodTypes };
    }
    
    if (targetCities && targetCities.length > 0) {
      userFilter['address.city'] = { $in: targetCities };
    }

    // Get target users
    const users = await User.find(userFilter).select('_id');
    const userIds = users.map(user => user._id);

    if (userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No users found matching the criteria'
      });
    }

    // Create system announcement notifications
    const notifications = await Notification.sendToMultipleUsers(userIds, {
      title,
      message,
      type: 'system_announcement',
      priority,
      isUrgent: priority === 'critical',
      actionRequired: false,
      metadata: {
        announcementType: 'system',
        targetCriteria: {
          roles: targetRoles,
          bloodTypes: targetBloodTypes,
          cities: targetCities
        }
      },
      sentBy: req.user._id,
      sentBySystem: true
    });

    // Log system announcement
    await AuditTrail.logAction({
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'system_announcement',
      resourceType: 'notification',
      resourceId: null,
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      description: `System announcement sent to ${userIds.length} users`,
      changes: { before: null, after: { title, priority, recipientCount: userIds.length } },
      status: 'success',
      location: await getLocationFromIP(req.ip),
      riskLevel: 'medium'
    });

    logger.info(`System announcement sent to ${userIds.length} users by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: `System announcement sent to ${userIds.length} users successfully`,
      data: { 
        notifications,
        recipientCount: userIds.length,
        targetCriteria: {
          roles: targetRoles,
          bloodTypes: targetBloodTypes,
          cities: targetCities
        }
      }
    });

  } catch (error) {
    logger.error('Send system announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Helper functions
const getSystemHealthMetrics = async () => {
  // In a real implementation, you would check various system metrics
  return {
    database: {
      status: 'healthy',
      responseTime: 15, // ms
      connections: 5
    },
    memory: {
      usage: 65, // percentage
      available: 2.1 // GB
    },
    disk: {
      usage: 45, // percentage
      available: 50.2 // GB
    },
    uptime: 99.9, // percentage
    lastBackup: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
    errorRate: 0.1 // percentage
  };
};

const getUserStatistics = async (startDate, endDate) => {
  const stats = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: {
          $sum: { $cond: [{ $gte: ['$lastActivity', startDate] }, 1, 0] }
        },
        verifiedUsers: {
          $sum: { 
            $cond: [
              { $and: ['$isEmailVerified', '$isPhoneVerified', '$isMedicalVerified'] }, 
              1, 
              0
            ] 
          }
        },
        byRole: {
          $push: {
            role: '$role',
            isActive: '$isActive'
          }
        }
      }
    }
  ]);

  return stats[0] || {
    totalUsers: 0,
    activeUsers: 0,
    verifiedUsers: 0,
    byRole: []
  };
};

const getNotificationStatistics = async (startDate, endDate) => {
  const stats = await Notification.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalNotifications: { $sum: 1 },
        readNotifications: { $sum: { $cond: ['$isRead', 1, 0] } },
        unreadNotifications: { $sum: { $cond: ['$isRead', 0, 1] } },
        urgentNotifications: { $sum: { $cond: ['$isUrgent', 1, 0] } }
      }
    }
  ]);

  return stats[0] || {
    totalNotifications: 0,
    readNotifications: 0,
    unreadNotifications: 0,
    urgentNotifications: 0
  };
};

const getAuditStatistics = async (startDate, endDate) => {
  const stats = await AuditTrail.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalEntries: { $sum: 1 },
        successfulActions: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
        failedActions: { $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] } },
        suspiciousActivities: { $sum: { $cond: ['$isSuspicious', 1, 0] } },
        highRiskActivities: { $sum: { $cond: [{ $in: ['$riskLevel', ['high', 'critical']] }, 1, 0] } }
      }
    }
  ]);

  return stats[0] || {
    totalEntries: 0,
    successfulActions: 0,
    failedActions: 0,
    suspiciousActivities: 0,
    highRiskActivities: 0
  };
};

const getLocationFromIP = async (ipAddress) => {
  // In a real implementation, you would use a geolocation service
  return {
    country: 'Unknown',
    region: 'Unknown',
    city: 'Unknown'
  };
};

// @desc    Get system reports data
// @route   GET /api/admin/reports
// @access  Private/System Admin
router.get('/reports', protect, authorize('system_admin'), async (req, res) => {
  try {
    const { dateFrom, dateTo, filters } = req.query;
    const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateTo ? new Date(dateTo) : new Date();
    
    const dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };
    
    // Build additional filters
    const donationFilter = { ...dateFilter };
    const requestFilter = { ...dateFilter };
    
    if (filters) {
      const parsedFilters = typeof filters === 'string' ? JSON.parse(filters) : filters;
      if (parsedFilters.bloodType) donationFilter.bloodType = parsedFilters.bloodType;
      if (parsedFilters.status) {
        if (parsedFilters.status === 'donation') {
          donationFilter.status = parsedFilters.donationStatus;
        } else {
          requestFilter.status = parsedFilters.status;
        }
      }
      if (parsedFilters.urgency) requestFilter.urgency = parsedFilters.urgency;
    }
    
    // Fetch comprehensive report data
    const [
      totalDonations,
      donationsByStatus,
      donationsByBloodType,
      totalRequests,
      requestsByStatus,
      requestsByUrgency,
      usersByRole,
      usersByBloodType,
      geographicData,
      systemMetrics
    ] = await Promise.all([
      // Donation Summary
      Donation.countDocuments(donationFilter),
      Donation.aggregate([
        { $match: donationFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Donation.aggregate([
        { $match: donationFilter },
        { $group: { _id: '$bloodType', count: { $sum: 1 }, totalUnits: { $sum: '$bloodUnits' } } }
      ]),
      
      // Request Analysis
      BloodRequest.countDocuments(requestFilter),
      BloodRequest.aggregate([
        { $match: requestFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      BloodRequest.aggregate([
        { $match: requestFilter },
        { $group: { _id: '$urgency', count: { $sum: 1 } } }
      ]),
      
      // User Activity
      User.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate }, bloodType: { $exists: true } } },
        { $group: { _id: '$bloodType', count: { $sum: 1 } } }
      ]),
      
      // Geographic Distribution
      Donation.aggregate([
        { $match: donationFilter },
        { $group: { _id: '$location.city', count: { $sum: 1 }, totalUnits: { $sum: '$bloodUnits' } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]),
      
      // System Performance
      Promise.all([
        User.countDocuments(),
        Donation.countDocuments(),
        BloodRequest.countDocuments(),
        Notification.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
        AuditTrail.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } })
      ])
    ]);
    
    const reports = {
      donationSummary: {
        total: totalDonations,
        byStatus: donationsByStatus.reduce((acc, item) => {
          acc[item._id || 'unknown'] = item.count;
          return acc;
        }, {}),
        byBloodType: donationsByBloodType.reduce((acc, item) => {
          acc[item._id || 'unknown'] = { count: item.count, units: item.totalUnits || 0 };
          return acc;
        }, {})
      },
      requestAnalysis: {
        total: totalRequests,
        byStatus: requestsByStatus.reduce((acc, item) => {
          acc[item._id || 'unknown'] = item.count;
          return acc;
        }, {}),
        byUrgency: requestsByUrgency.reduce((acc, item) => {
          acc[item._id || 'unknown'] = item.count;
          return acc;
        }, {})
      },
      userActivity: {
        byRole: usersByRole.reduce((acc, item) => {
          acc[item._id || 'unknown'] = item.count;
          return acc;
        }, {}),
        byBloodType: usersByBloodType.reduce((acc, item) => {
          acc[item._id || 'unknown'] = item.count;
          return acc;
        }, {})
      },
      geographicDistribution: geographicData.map(item => ({
        city: item._id || 'Unknown',
        donations: item.count,
        units: item.totalUnits || 0
      })),
      systemPerformance: {
        totalUsers: systemMetrics[0],
        totalDonations: systemMetrics[1],
        totalRequests: systemMetrics[2],
        totalNotifications: systemMetrics[3],
        totalAuditEntries: systemMetrics[4]
      }
    };
    
    res.json({
      success: true,
      data: { reports, dateRange: { startDate, endDate } }
    });
  } catch (error) {
    logger.error('Get system reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Generate and export system report
// @route   POST /api/admin/reports/generate
// @access  Private/System Admin
router.post('/reports/generate', protect, authorize('system_admin'), async (req, res) => {
  try {
    const { type, dateFrom, dateTo, filters } = req.body;
    
    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Report type is required'
      });
    }
    
    const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateTo ? new Date(dateTo) : new Date();
    const dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };
    
    let csvData = [];
    let filename = '';
    
    switch (type) {
      case 'donation_summary': {
        const donations = await Donation.find(dateFilter)
          .populate('donorId', 'fullName email phone bloodType')
          .sort({ createdAt: -1 })
          .lean();
        
        csvData = donations.map(d => ({
          'Date': new Date(d.createdAt).toLocaleDateString(),
          'Donor Name': d.donorId?.fullName || 'N/A',
          'Donor Email': d.donorId?.email || 'N/A',
          'Blood Type': d.bloodType || 'N/A',
          'Units': d.bloodUnits || 0,
          'Status': d.status || 'N/A',
          'Location': d.location?.city || 'N/A',
          'Scheduled Date': d.scheduledDate ? new Date(d.scheduledDate).toLocaleDateString() : 'N/A'
        }));
        filename = `donation-summary-${Date.now()}.csv`;
        break;
      }
      
      case 'request_analysis': {
        const requests = await BloodRequest.find(dateFilter)
          .populate('recipientId', 'fullName email phone')
          .sort({ createdAt: -1 })
          .lean();
        
        csvData = requests.map(r => ({
          'Date': new Date(r.createdAt).toLocaleDateString(),
          'Recipient Name': r.recipientId?.fullName || 'N/A',
          'Recipient Email': r.recipientId?.email || 'N/A',
          'Blood Type': r.bloodType || 'N/A',
          'Units Required': r.unitsRequired || 0,
          'Urgency': r.urgency || 'N/A',
          'Status': r.status || 'N/A',
          'Location': r.location?.city || 'N/A',
          'Fulfilled Date': r.fulfilledAt ? new Date(r.fulfilledAt).toLocaleDateString() : 'N/A'
        }));
        filename = `request-analysis-${Date.now()}.csv`;
        break;
      }
      
      case 'user_activity': {
        const users = await User.find({ createdAt: { $gte: startDate, $lte: endDate } })
          .sort({ createdAt: -1 })
          .lean();
        
        csvData = users.map(u => ({
          'Registration Date': new Date(u.createdAt).toLocaleDateString(),
          'Name': u.fullName || 'N/A',
          'Email': u.email || 'N/A',
          'Phone': u.phone || 'N/A',
          'Role': u.role || 'N/A',
          'Blood Type': u.bloodType || 'N/A',
          'City': u.address?.city || 'N/A',
          'State': u.address?.state || 'N/A',
          'Email Verified': u.isEmailVerified ? 'Yes' : 'No',
          'Medical Verified': u.isMedicalVerified ? 'Yes' : 'No',
          'Active': u.isActive ? 'Yes' : 'No'
        }));
        filename = `user-activity-${Date.now()}.csv`;
        break;
      }
      
      case 'geographic_distribution': {
        const donations = await Donation.find(dateFilter)
          .populate('donorId', 'fullName')
          .lean();
        
        const cityMap = {};
        donations.forEach(d => {
          const city = d.location?.city || 'Unknown';
          if (!cityMap[city]) {
            cityMap[city] = { donations: 0, units: 0, requests: 0 };
          }
          cityMap[city].donations++;
          cityMap[city].units += d.bloodUnits || 0;
        });
        
        const requests = await BloodRequest.find(dateFilter).lean();
        requests.forEach(r => {
          const city = r.location?.city || 'Unknown';
          if (!cityMap[city]) {
            cityMap[city] = { donations: 0, units: 0, requests: 0 };
          }
          cityMap[city].requests++;
        });
        
        csvData = Object.entries(cityMap).map(([city, data]) => ({
          'City': city,
          'Total Donations': data.donations,
          'Total Units': data.units,
          'Total Requests': data.requests
        }));
        filename = `geographic-distribution-${Date.now()}.csv`;
        break;
      }
      
      case 'blood_type_analysis': {
        const donations = await Donation.aggregate([
          { $match: dateFilter },
          { $group: { _id: '$bloodType', count: { $sum: 1 }, units: { $sum: '$bloodUnits' } } }
        ]);
        
        const requests = await BloodRequest.aggregate([
          { $match: dateFilter },
          { $group: { _id: '$bloodType', count: { $sum: 1 }, units: { $sum: '$unitsRequired' } } }
        ]);
        
        const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        csvData = bloodTypes.map(bt => {
          const donation = donations.find(d => d._id === bt) || { count: 0, units: 0 };
          const request = requests.find(r => r._id === bt) || { count: 0, units: 0 };
          return {
            'Blood Type': bt,
            'Donations': donation.count,
            'Donation Units': donation.units,
            'Requests': request.count,
            'Requested Units': request.units,
            'Balance': donation.units - request.units
          };
        });
        filename = `blood-type-analysis-${Date.now()}.csv`;
        break;
      }
      
      case 'system_performance': {
        const [users, donations, requests, notifications, auditTrails] = await Promise.all([
          User.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean(),
          Donation.find(dateFilter).lean(),
          BloodRequest.find(dateFilter).lean(),
          Notification.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean(),
          AuditTrail.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean()
        ]);
        
        csvData = [
          {
            'Metric': 'Total Users',
            'Count': users.length,
            'Period': `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
          },
          {
            'Metric': 'Total Donations',
            'Count': donations.length,
            'Period': `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
          },
          {
            'Metric': 'Total Requests',
            'Count': requests.length,
            'Period': `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
          },
          {
            'Metric': 'Total Notifications',
            'Count': notifications.length,
            'Period': `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
          },
          {
            'Metric': 'Total Audit Entries',
            'Count': auditTrails.length,
            'Period': `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
          }
        ];
        filename = `system-performance-${Date.now()}.csv`;
        break;
      }
      
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type'
        });
    }
    
    // Convert to CSV
    if (csvData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No data found for the selected criteria'
      });
    }
    
    const headers = Object.keys(csvData[0]);
    const csvRows = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => {
        const value = row[header] || '';
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(','))
    ];
    const csvContent = csvRows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
    
  } catch (error) {
    logger.error('Generate report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
