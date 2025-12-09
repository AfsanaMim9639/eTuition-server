const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
  // Tutor specific fields - matching your MongoDB collection
  subjects: [{
    type: String
  }],
  experience: {
    type: Number,  // Changed from String to Number to match collection
    default: 0
  },
  location: {
    type: String,  // Added location field from collection
    trim: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  active: {  // Added active field from collection
    type: Boolean,
    default: true
  },
  // Additional tutor fields (not in your sample but might be needed)
  education: {
    type: String,
    required: function() {
      return this.role === 'tutor';
    }
  },
  hourlyRate: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'blocked'],
    default: 'active'
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