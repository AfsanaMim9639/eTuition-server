const User = require('../models/User');

// Get all tutors with filters
exports.getAllTutors = async (req, res) => {
  try {
    console.log('🔍 getAllTutors called with params:', req.query);

    const { search, subject, location, minRating, minExperience } = req.query;
    
    const query = { role: 'tutor' };
    
    if (search && search.trim()) {
      query.name = { $regex: search.trim(), $options: 'i' };
    }
    
    if (subject && subject.trim()) {
      query.subjects = { 
        $elemMatch: { 
          $regex: subject.trim(), 
          $options: 'i' 
        } 
      };
    }
    
    if (location && location.trim()) {
      query.address = { $regex: location.trim(), $options: 'i' };
    }
    
    if (minRating) {
      const rating = parseFloat(minRating);
      if (!isNaN(rating)) {
        query.rating = { $gte: rating };
      }
    }
    
    if (minExperience) {
      const exp = parseInt(minExperience);
      if (!isNaN(exp)) {
        query.experience = { $gte: exp };
      }
    }
    
    console.log('🔎 MongoDB Query:', JSON.stringify(query, null, 2));
    
    const tutors = await User.find(query)
      .select('-password')
      .sort({ rating: -1, createdAt: -1 })
      .lean();
    
    console.log(`✅ Found ${tutors.length} tutors`);
    
    res.json({
      status: 'success',
      count: tutors.length,
      data: tutors
    });
    
  } catch (error) {
    console.error('❌ Error in getAllTutors:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch tutors',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get latest tutors
exports.getLatestTutors = async (req, res) => {
  try {
    console.log('🔍 getLatestTutors called');
    
    const tutors = await User.find({ role: 'tutor' })
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();
    
    console.log(`✅ Found ${tutors.length} latest tutors`);
    
    res.json({
      status: 'success',
      count: tutors.length,
      data: tutors
    });
  } catch (error) {
    console.error('❌ Error in getLatestTutors:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch latest tutors',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('🔍 getUserProfile called for:', userId);
    
    const user = await User.findById(userId).select('-password').lean();
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    res.json({
      status: 'success',
      data: user
    });
  } catch (error) {
    console.error('❌ Error in getUserProfile:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
  try {
    const updates = req.body;
    console.log('🔍 updateUserProfile called by:', req.user.userId);
    
    delete updates.password;
    delete updates.email;
    delete updates.role;
    delete updates._id;
    delete updates.totalEarnings;
    delete updates.rating;
    delete updates.totalReviews;
    
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updates,
      { 
        new: true, 
        runValidators: true 
      }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    res.json({
      status: 'success',
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    console.error('❌ Error in updateUserProfile:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};