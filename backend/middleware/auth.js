const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditTrail = require('../models/AuditTrail');
const logger = require('../utils/logger');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'No user found with this token'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      // Check if user is blocked
      if (user.isBlocked) {
        return res.status(401).json({
          success: false,
          message: 'Account is blocked'
        });
      }

      // Update last activity
      user.lastActivity = new Date();
      await user.save();

      req.user = user;
      next();
    } catch (error) {
      logger.error('Token verification error:', error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }

    next();
  };
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (user && user.isActive && !user.isBlocked) {
          req.user = user;
        }
      } catch (error) {
        // Token is invalid, but we don't fail the request
        logger.warn('Invalid token in optional auth:', error.message);
      }
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next(); // Continue even if there's an error
  }
};

// Check if user can donate
const canDonate = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Ensure user is populated with all fields
    await req.user.populate();
    
    const donationCheck = req.user.canDonate();
    
    if (!donationCheck.canDonate) {
      logger.warn(`Donation eligibility check failed for user ${req.user.email}: ${donationCheck.reason}`);
      return res.status(400).json({
        success: false,
        message: donationCheck.reason,
        code: 'DONATION_ELIGIBILITY_FAILED'
      });
    }

    next();
  } catch (error) {
    logger.error('Can donate middleware error:', error);
    logger.error('Error details:', {
      userId: req.user?._id,
      email: req.user?.email,
      errorMessage: error.message,
      errorStack: error.stack
    });
    return res.status(500).json({
      success: false,
      message: 'Server error checking donation eligibility',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Check if user owns resource or is admin
const checkOwnership = (resourceModel, paramName = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramName];
      const resource = await resourceModel.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }

      // Check if user owns the resource or is admin
      const isOwner = resource.userId && resource.userId.toString() === req.user.id;
      const isAdmin = ['medical_admin', 'system_admin'].includes(req.user.role);

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this resource'
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      logger.error('Ownership check middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error checking resource ownership'
      });
    }
  };
};

// Rate limiting for sensitive operations
const sensitiveOperationLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const key = `${req.user?.id || req.ip}_${req.path}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old attempts
    if (attempts.has(key)) {
      const userAttempts = attempts.get(key).filter(time => time > windowStart);
      attempts.set(key, userAttempts);
    } else {
      attempts.set(key, []);
    }

    const userAttempts = attempts.get(key);

    if (userAttempts.length >= maxAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Too many attempts. Please try again later.'
      });
    }

    userAttempts.push(now);
    next();
  };
};

// Verify email verification
const requireEmailVerification = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }
  next();
};

// Verify phone verification
const requirePhoneVerification = (req, res, next) => {
  if (!req.user.isPhoneVerified) {
    return res.status(403).json({
      success: false,
      message: 'Phone verification required',
      code: 'PHONE_NOT_VERIFIED'
    });
  }
  next();
};

// Verify medical verification
const requireMedicalVerification = (req, res, next) => {
  if (!req.user.isMedicalVerified) {
    return res.status(403).json({
      success: false,
      message: 'Medical verification required',
      code: 'MEDICAL_NOT_VERIFIED'
    });
  }
  next();
};

// Check if user is verified (all verifications)
const requireFullVerification = (req, res, next) => {
  const user = req.user;
  
  if (!user.isEmailVerified || !user.isPhoneVerified || !user.isMedicalVerified) {
    return res.status(403).json({
      success: false,
      message: 'Full verification required',
      code: 'INCOMPLETE_VERIFICATION',
      details: {
        emailVerified: user.isEmailVerified,
        phoneVerified: user.isPhoneVerified,
        medicalVerified: user.isMedicalVerified
      }
    });
  }
  next();
};

// Log security events
const logSecurityEvent = async (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(body) {
    // Log security events
    if (res.statusCode >= 400 && req.path.includes('/auth')) {
      setImmediate(async () => {
        try {
          await AuditTrail.logAction({
            userId: req.user?.id || null,
            userEmail: req.user?.email || 'anonymous',
            userRole: req.user?.role || 'anonymous',
            action: 'security_alert',
            resourceType: 'authentication',
            resourceId: null,
            requestId: req.id || null,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown',
            sessionId: req.sessionID || null,
            description: `Failed authentication attempt: ${req.path}`,
            changes: null,
            status: 'failure',
            errorMessage: body.error || body.message,
            location: await getLocationFromIP(req.ip),
            metadata: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode
            },
            riskLevel: 'medium'
          });
        } catch (error) {
          logger.error('Error logging security event:', error);
        }
      });
    }
    
    return originalJson.call(this, body);
  };
  
  next();
};

const getLocationFromIP = async (ipAddress) => {
  // In a real implementation, you would use a geolocation service
  return {
    country: 'Unknown',
    region: 'Unknown',
    city: 'Unknown'
  };
};

module.exports = {
  protect,
  authorize,
  optionalAuth,
  canDonate,
  checkOwnership,
  sensitiveOperationLimit,
  requireEmailVerification,
  requirePhoneVerification,
  requireMedicalVerification,
  requireFullVerification,
  logSecurityEvent
};
