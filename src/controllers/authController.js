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
      education, 
      subjects,
      experience,
      location
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
      active: true  // Set active to true by default
    };

    // Add tutor-specific fields
    if (role === 'tutor') {
      // Validate required tutor fields
      if (!education || !subjects || !location) {
        return res.status(400).json({
          success: false,
          message: 'Education, subjects and location are required for tutors'
        });
      }

      userData.education = education;
      userData.subjects = Array.isArray(subjects) ? subjects : [];
      userData.experience = experience ? Number(experience) : 0;
      userData.location = location;
      userData.rating = 5.0;  // Default rating for new tutors
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
      user
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('📥 Login request for:', email);

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended or blocked'
      });
    }

    // Also check the 'active' field for tutors
    if (user.active === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log('✅ Login successful:', email);

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user
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

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // Check if account is active
      if (user.status !== 'active' || user.active === false) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been suspended or blocked'
        });
      }
      console.log('✅ Existing user found:', email);
    } else {
      // Create new user with social login
      console.log('📝 Creating new social login user:', email);
      user = await User.create({
        name,
        email,
        profileImage,
        role: role || 'student',
        isSocialLogin: true,
        active: true
      });
      console.log('✅ New user created:', user._id);
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
      message: 'Social login failed'
    });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
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