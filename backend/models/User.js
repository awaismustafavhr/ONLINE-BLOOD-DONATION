const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[\+]?[0-9][\d]{9,15}$/, 'Please enter a valid phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  
  // Profile Information
  profilePicture: {
    type: String,
    default: null
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    enum: ['male', 'female', 'other']
  },
  
  // Medical Information
  bloodType: {
    type: String,
    required: [true, 'Blood type is required'],
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  weight: {
    type: Number,
    required: [true, 'Weight is required'],
    min: [30, 'Weight must be at least 30 kg'],
    max: [300, 'Weight cannot exceed 300 kg']
  },
  height: {
    type: Number,
    required: [true, 'Height is required'],
    min: [100, 'Height must be at least 100 cm'],
    max: [250, 'Height cannot exceed 250 cm']
  },
  
  // Medical History
  medicalHistory: {
    hasDiabetes: { type: Boolean, default: false },
    hasHypertension: { type: Boolean, default: false },
    hasHeartDisease: { type: Boolean, default: false },
    hasCancer: { type: Boolean, default: false },
    hasHepatitis: { type: Boolean, default: false },
    hasHIV: { type: Boolean, default: false },
    hasTuberculosis: { type: Boolean, default: false },
    hasEpilepsy: { type: Boolean, default: false },
    hasAsthma: { type: Boolean, default: false },
    hasAllergies: { type: Boolean, default: false },
    allergiesDescription: { type: String, default: '' },
    medications: [{ type: String }],
    lastDonationDate: { type: Date, default: null },
    totalDonations: { type: Number, default: 0 }
  },
  
  // Location Information
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true, default: 'Pakistan' },
    postalCode: { type: String, required: true },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    }
  },
  
  // Role and Permissions
  role: {
    type: String,
    enum: ['donor', 'recipient', 'medical_admin', 'system_admin'],
    default: 'donor'
  },
  
  // Availability and Preferences
  isAvailable: {
    type: Boolean,
    default: true
  },
  availabilityRadius: {
    type: Number,
    default: 50, // in kilometers
    min: 1,
    max: 500
  },
  preferredContactMethod: {
    type: String,
    enum: ['email', 'phone', 'both'],
    default: 'both'
  },
  emergencyContact: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    relationship: { type: String, required: true }
  },
  
  // Account Status
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  isMedicalVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  
  // Verification Tokens
  emailVerificationToken: String,
  phoneVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Statistics
  statistics: {
    totalRequests: { type: Number, default: 0 },
    totalDonations: { type: Number, default: 0 },
    totalLivesSaved: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 }, // in minutes
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0 }
  },
  
  // Settings
  settings: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      emergency: { type: Boolean, default: true }
    },
    privacy: {
      showLocation: { type: Boolean, default: true },
      showContact: { type: Boolean, default: true },
      showMedicalHistory: { type: Boolean, default: false }
    },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'Asia/Karachi' }
  },
  
  // Timestamps
  lastLogin: { type: Date, default: null },
  lastActivity: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ 'address.coordinates': '2dsphere' });
userSchema.index({ bloodType: 1, isAvailable: 1 });
userSchema.index({ role: 1, isActive: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age
userSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Virtual for BMI
userSchema.virtual('bmi').get(function() {
  if (!this.weight || !this.height) return null;
  const heightInMeters = this.height / 100;
  return (this.weight / (heightInMeters * heightInMeters)).toFixed(1);
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update lastActivity
userSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.lastActivity = new Date();
  }
  next();
});

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate JWT token
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      email: this.email, 
      role: this.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Method to generate refresh token
userSchema.methods.generateRefreshToken = function() {
  return jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );
};

// Method to check if user can donate
userSchema.methods.canDonate = function() {
  try {
    const now = new Date();
    const lastDonation = this.medicalHistory?.lastDonationDate;
    
    // Check if last donation was more than 56 days ago (8 weeks)
    if (lastDonation) {
      const daysSinceLastDonation = Math.floor((now - new Date(lastDonation)) / (1000 * 60 * 60 * 24));
      if (daysSinceLastDonation < 56) {
        return { canDonate: false, reason: `Must wait 56 days between donations. Last donation was ${daysSinceLastDonation} days ago.` };
      }
    }
    
    // Check age (must be 18-65)
    // Calculate age from dateOfBirth if age virtual is not available
    let age;
    if (this.dateOfBirth) {
      const birthDate = new Date(this.dateOfBirth);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    } else {
      age = this.age; // Use virtual if available
    }
    
    if (!age || age < 18 || age > 65) {
      return { canDonate: false, reason: `Age must be between 18-65 years. Current age: ${age || 'not available'}` };
    }
    
    // Check weight (must be at least 50kg)
    const weight = this.weight || 0;
    if (weight < 50) {
      return { canDonate: false, reason: `Weight must be at least 50kg. Current weight: ${weight}kg` };
    }
    
    // Check medical conditions
    const medicalHistory = this.medicalHistory || {};
    if (medicalHistory.hasHIV || medicalHistory.hasHepatitis || medicalHistory.hasCancer) {
      return { canDonate: false, reason: 'Medical condition prevents donation' };
    }
    
    return { canDonate: true };
  } catch (error) {
    // If there's an error checking, log it and allow donation (fail open for scheduling)
    // The actual donation will be validated later when it starts
    console.error('Error in canDonate check:', error);
    return { canDonate: true, warning: 'Could not verify all eligibility criteria' };
  }
};

// Method to update statistics
userSchema.methods.updateStatistics = function(type, value) {
  switch (type) {
    case 'donation':
      this.statistics.totalDonations += 1;
      this.statistics.totalLivesSaved += 1;
      this.medicalHistory.totalDonations += 1;
      this.medicalHistory.lastDonationDate = new Date();
      break;
    case 'request':
      this.statistics.totalRequests += 1;
      break;
    case 'rating':
      const currentTotal = this.statistics.rating * this.statistics.totalRatings;
      this.statistics.totalRatings += 1;
      this.statistics.rating = (currentTotal + value) / this.statistics.totalRatings;
      break;
  }
  return this.save();
};

// Static method to find nearby users
userSchema.statics.findNearby = function(coordinates, maxDistance = 50000, bloodType = null) {
  const query = {
    'address.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: maxDistance
      }
    },
    isAvailable: true,
    isActive: true,
    isBlocked: false
  };
  
  if (bloodType) {
    query.bloodType = bloodType;
  }
  
  return this.find(query);
};

module.exports = mongoose.model('User', userSchema);
