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
// Register
exports.register = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      role, 
      phone,
      address,
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
      address,
      active: true,
      status: 'pending' // ⭐ All new users start as pending
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

      // Handle education
      if (education) {
        if (typeof education === 'string') {
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
      userData.rating = 0;
      userData.totalReviews = 0;
    }

    console.log('💾 Creating user with data:', { ...userData, password: '***' });

    const user = await User.create(userData);

    console.log('✅ User created successfully:', user._id, 'Status:', user.status);

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Your account is pending approval.',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        profileImage: user.profileImage,
        status: user.status, // ⭐ Include status in response
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
      },
      // ⭐ Add pending approval message
      statusInfo: {
        status: 'pending',
        message: 'Your account is pending approval from admin. You can login but some features may be limited.'
      }
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }
    
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

// ⭐ Social Login - Also starts as pending
exports.socialLogin = async (req, res) => {
  try {
    const { name, email, profileImage, role } = req.body;

    console.log('📥 Social login request for:', email, 'with role:', role);

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Please select your role'
      });
    }

    let user = await User.findOne({ email });

    if (user) {
      // Check role mismatch
      if (user.role !== role) {
        console.log(`❌ Social login role mismatch! DB: ${user.role}, Selected: ${role}`);
        return res.status(403).json({
          success: false,
          message: `Role mismatch! You are registered as a ${user.role.toUpperCase()}, not a ${role.toUpperCase()}. Please select the correct role.`,
          registeredRole: user.role,
          selectedRole: role
        });
      }

      // Check if it's a regular account
      if (!user.isSocialLogin) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists. Please login with email and password.'
        });
      }

      // Admin bypass for status checks
      if (user.role !== 'admin') {
        if (user.status !== 'approved' && user.status !== 'pending') {
          return res.status(403).json({
            success: false,
            message: `Your account has been ${user.status}. Please contact support.`
          });
        }

        if (user.active === false) {
          return res.status(403).json({
            success: false,
            message: 'Your account has been deactivated'
          });
        }
      }

      console.log('✅ Existing social user found with correct role:', email);
    } else {
      // ⭐ Create new user with pending status
      console.log('📝 Creating new social login user:', email, 'as', role);
      user = await User.create({
        name,
        email,
        profileImage: profileImage || undefined,
        role: role || 'student',
        isSocialLogin: true,
        active: true,
        status: 'pending' // ⭐ New social users also pending
      });
      console.log('✅ New social user created:', user._id, 'Status:', user.status);
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user,
      // ⭐ Include status info
      ...(user.status === 'pending' && {
        statusInfo: {
          status: 'pending',
          message: 'Your account is pending approval. Some features may be limited.'
        }
      })
    });
  } catch (error) {
    console.error('❌ Social login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Social login failed'
    });
  }
};

// Login
// AuthContext.jsx - Login function এ এই changes করুন:

// Login
exports.login = async (req, res) => {
  try {
    const { email, password, selectedRole } = req.body;

    console.log('📥 Login request for:', email);
    console.log('🎭 Selected role from frontend:', selectedRole);

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // ✅ Validate selected role
    if (!selectedRole) {
      return res.status(400).json({
        success: false,
        message: 'Please select your role'
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

    // ✅ CHECK ROLE MISMATCH FIRST - Before password check
    if (user.role !== selectedRole) {
      console.log(`❌ Role mismatch! DB: ${user.role}, Selected: ${selectedRole}`);
      return res.status(403).json({
        success: false,
        message: `Role mismatch! You are registered as a ${user.role.toUpperCase()}, not a ${selectedRole.toUpperCase()}. Please select the correct role.`,
        registeredRole: user.role,
        selectedRole: selectedRole
      });
    }

    console.log('✅ Role validation passed:', user.role);

    // NOW verify password (after role check)
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log('✅ Password verified for:', email);

    // Check if it's a social login account
    if (user.isSocialLogin) {
      return res.status(400).json({
        success: false,
        message: 'This account uses social login. Please login with Google/Facebook.'
      });
    }

    // ⭐ ADMIN BYPASS - Admins don't need status checks
    let statusMessage = null;
    
    if (user.role !== 'admin') {
      // Status checks only for non-admin users
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

      // Check active field for tutors
      if (user.role === 'tutor' && user.active === false) {
        console.log('❌ Tutor account deactivated');
        return res.status(403).json({
          success: false,
          message: 'Your tutor account has been deactivated'
        });
      }
    } else {
      console.log('👑 Admin login - bypassing all status checks');
    }

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
      status: user.status,
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

    console.log('✅ Login successful for:', email, 'Role:', user.role);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userResponse,
      statusWarning: user.role === 'admin' ? null : statusMessage
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

    console.log('📥 Social login request for:', email, 'with role:', role);

    // Validate input
    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    // ✅ Validate role selection for social login
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Please select your role'
      });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // ✅ CHECK ROLE MISMATCH for existing users
      if (user.role !== role) {
        console.log(`❌ Social login role mismatch! DB: ${user.role}, Selected: ${role}`);
        return res.status(403).json({
          success: false,
          message: `Role mismatch! You are registered as a ${user.role.toUpperCase()}, not a ${role.toUpperCase()}. Please select the correct role.`,
          registeredRole: user.role,
          selectedRole: role
        });
      }

      // Check if it's a regular account trying to social login
      if (!user.isSocialLogin) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists. Please login with email and password.'
        });
      }

      // ⭐ ADMIN BYPASS for social login too
      if (user.role !== 'admin') {
        // Check account status for non-admins
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
      }

      console.log('✅ Existing social user found with correct role:', email);
    } else {
      // Create new user with social login
      console.log('📝 Creating new social login user:', email, 'as', role);
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

    // ⭐ ADMIN BYPASS - Admins always active
    if (user.role !== 'admin') {
      // Check if user is still active (only for non-admins)
      if (user.status !== 'active' || user.active === false) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated'
        });
      }
    } else {
      console.log('👑 Admin user - bypassing status check');
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