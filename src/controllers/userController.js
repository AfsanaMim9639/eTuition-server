const User = require('../models/User');

// Get all tutors with filters and pagination
exports.getAllTutors = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      subject,
      location,
      minRating,
      minExperience
    } = req.query;

    const query = { role: 'tutor', active: true };  // Changed from status to active

    // Search by name
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Filter by subject
    if (subject) {
      query.subjects = { $in: [subject] };
    }

    // Filter by location
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    // Filter by minimum rating
    if (minRating) {
      query.rating = { $gte: Number(minRating) };
    }

    // Filter by minimum experience
    if (minExperience) {
      query.experience = { $gte: Number(minExperience) };
    }

    const skip = (page - 1) * limit;

    const tutors = await User.find(query)
      .select('-password')
      .sort({ rating: -1, createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      tutors,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: Number(limit)
      }
    });
  } catch (error) {
    console.error('Get tutors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tutors'
    });
  }
};

// Get latest tutors for home page
exports.getLatestTutors = async (req, res) => {
  try {
    const tutors = await User.find({ 
      role: 'tutor', 
      active: true  // Changed from status: 'active' to active: true
    })
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(6);

    res.json({
      success: true,
      tutors
    });
  } catch (error) {
    console.error('Get latest tutors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest tutors'
    });
  }
};

// Get user profile by ID
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');

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
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile'
    });
  }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const updates = req.body;

    // Don't allow updating these fields
    delete updates.email;
    delete updates.role;
    delete updates.password;
    delete updates.totalEarnings;
    delete updates.rating;

    const user = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update profile'
    });
  }
};