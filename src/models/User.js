const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return !this.isSocialLogin;
    },
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: {
    type: String,
    enum: ['student', 'tutor', 'admin'],
    default: 'student'
  },
  phone: {
    type: String,
    trim: true
  },
  profileImage: {
    type: String,
    default: 'https://i.ibb.co/qpB9ZNp/default-avatar.png'
  },
  isSocialLogin: {
    type: Boolean,
    default: false
  },
  
  // Common fields
  address: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  
  // Student specific fields
  grade: {
    type: String
  },
  institution: {
    type: String
  },
  
  // Tutor specific fields
  subjects: [{
    type: String
  }],
  experience: {
    type: Number,
    default: 0
  },
  education: [{
    degree: String,
    institution: String,
    year: String
  }],
  bio: {
    type: String,
    maxlength: 500
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  hourlyRate: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  },
  
  // ⭐ UPDATED: Status field with pending, approved, rejected
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended', 'blocked'],
    default: 'pending' // ⭐ Default is now 'pending'
  },
  
  // ⭐ NEW: Approval details
  approvalDetails: {
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectionReason: String
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || this.isSocialLogin) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON response
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);