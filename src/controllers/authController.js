const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user._id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      role, 
      phone,
      address, // ✅ Added address
      // Student fields
      grade,
      institution,
      // Tutor fields
      education, 
      subjects,
      experience,
      location,
      bio,
      hourlyRate
    } = req.body;

    console.log('📥 Registration request:', { name, email, role });

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create new user data
    const userData = {
      name,
      email,
      password,
      role: role || 'student',
      phone,
      address, // ✅ Added
      active: true,
      status: 'active' // ✅ Set status to active by default
    };

    // Add student-specific fields
    if (role === 'student') {
      if (grade) userData.grade = grade;
      if (institution) userData.institution = institution;
    }

    // Add tutor-specific fields
    if (role === 'tutor') {
      // Validate required tutor fields
      if (!subjects || subjects.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one subject is required for tutors'
        });
      }

      if (!location) {
        return res.status(400).json({
          success: false,
          message: 'Location is required for tutors'
        });
      }

      // Handle education - can be string or array
      if (education) {
        if (typeof education === 'string') {
          // If string, convert to single object array
          userData.education = [{
            degree: education,
            institution: '',
            year: ''
          }];
        } else if (Array.isArray(education)) {
          userData.education = education;
        }
      }

      userData.subjects = Array.isArray(subjects) ? subjects : [subjects];
      userData.experience = experience ? Number(experience) : 0;
      userData.location = location;
      userData.bio = bio || '';
      userData.hourlyRate = hourlyRate ? Number(hourlyRate) : 0;
      userData.rating = 0; // ✅ Start with 0, will increase with reviews
      userData.totalReviews = 0;
    }

    console.log('💾 Creating user with data:', { ...userData, password: '***' });

    const user = await User.create(userData);

    console.log('✅ User created successfully:', user._id);

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        profileImage: user.profileImage,
        // Include role-specific fields
        ...(user.role === 'student' && {
          grade: user.grade,
          institution: user.institution
        }),
        ...(user.role === 'tutor' && {
          subjects: user.subjects,
          experience: user.experience,
          location: user.location,
          rating: user.rating,
          hourlyRate: user.hourlyRate
        })
      }
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
};

//Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('📥 Login request for:', email);

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user (need to include password for comparison)
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log('✅ User found:', { email: user.email, role: user.role, status: user.status });

    // Check if it's a social login account
    if (user.isSocialLogin) {
      return res.status(400).json({
        success: false,
        message: 'This account uses social login. Please login with Google/Facebook.'
      });
    }

    // ⭐ UPDATED: Allow login but show warning message based on status
    let statusMessage = null;
    
    if (user.status === 'pending') {
      statusMessage = 'Your account is pending approval. Some features may be limited.';
      console.log('⚠️ Pending user logging in:', email);
    } else if (user.status === 'rejected') {
      statusMessage = 'Your account registration was rejected. Please contact support.';
      console.log('⚠️ Rejected user logging in:', email);
    } else if (user.status === 'suspended') {
      statusMessage = 'Your account has been suspended. Some features are restricted.';
      console.log('⚠️ Suspended user logging in:', email);
    } else if (user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Please contact support.'
      });
    }

    // Check active field for tutors (admins don't need this check)
    if (user.role === 'tutor' && user.active === false) {
      console.log('❌ Tutor account deactivated');
      return res.status(403).json({
        success: false,
        message: 'Your tutor account has been deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log('✅ Password verified for:', email);

    // Generate token
    const token = generateToken(user);

    // Create clean user object for response
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      profileImage: user.profileImage,
      address: user.address,
      location: user.location,
      status: user.status, // ⭐ Include status in response
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    // Add role-specific fields
    if (user.role === 'student') {
      userResponse.grade = user.grade;
      userResponse.institution = user.institution;
    } else if (user.role === 'tutor') {
      userResponse.subjects = user.subjects;
      userResponse.experience = user.experience;
      userResponse.education = user.education;
      userResponse.bio = user.bio;
      userResponse.rating = user.rating;
      userResponse.totalReviews = user.totalReviews;
      userResponse.hourlyRate = user.hourlyRate;
      userResponse.totalEarnings = user.totalEarnings;
    }

    console.log('✅ Login successful for:', email, 'Role:', user.role, 'Status:', user.status);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userResponse,
      statusWarning: statusMessage // ⭐ Send warning message if exists
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

// Social login (Google/Facebook)
exports.socialLogin = async (req, res) => {
  try {
    const { name, email, profileImage, role } = req.body;

    console.log('📥 Social login request for:', email);

    // Validate input
    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // Check if it's a regular account trying to social login
      if (!user.isSocialLogin) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists. Please login with email and password.'
        });
      }

      // Check account status
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: `Your account has been ${user.status}. Please contact support.`
        });
      }

      // Check active field
      if (user.active === false) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated'
        });
      }

      console.log('✅ Existing social user found:', email);
    } else {
      // Create new user with social login
      console.log('📝 Creating new social login user:', email);
      user = await User.create({
        name,
        email,
        profileImage: profileImage || undefined,
        role: role || 'student',
        isSocialLogin: true,
        active: true,
        status: 'active'
      });
      console.log('✅ New social user created:', user._id);
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user
    });
  } catch (error) {
    console.error('❌ Social login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Social login failed'
    });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is still active
    if (user.status !== 'active' || user.active === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('❌ Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user data'
    });
  }
};

// Logout (optional - mainly for clearing client-side token)
exports.logout = async (req, res) => {
  try {
    // In JWT, logout is typically handled client-side by removing the token
    // But you can add server-side token blacklisting if needed
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    // Get user with password
    const user = await User.findById(req.user.userId).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if it's a social login account
    if (user.isSocialLogin) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change password for social login accounts'
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};