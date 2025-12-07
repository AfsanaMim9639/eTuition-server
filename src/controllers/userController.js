const User = require('../models/User');
const Tuition = require('../models/Tuition');

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If tutor, get additional stats
    let stats = {};
    if (user.role === 'tutor') {
      const ongoingTuitions = await Tuition.countDocuments({
        approvedTutor: user._id,
        status: 'ongoing'
      });

      const completedTuitions = await Tuition.countDocuments({
        approvedTutor: user._id,
        status: 'completed'
      });

      stats = {
        ongoingTuitions,
        completedTuitions,
        totalEarnings: user.totalEarnings
      };
    }

    res.json({
      success: true,
      user,
      stats
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
    const {
      name,
      phone,
      profileImage,
      education,
      subjects,
      experience,
      hourlyRate
    } = req.body;

    const updateData = {
      name,
      phone,
      profileImage
    };

    // Add tutor-specific fields if user is tutor
    const user = await User.findById(req.user.userId);
    if (user.role === 'tutor') {
      if (education) updateData.education = education;
      if (subjects) updateData.subjects = subjects;
      if (experience) updateData.experience = experience;
      if (hourlyRate) updateData.hourlyRate = hourlyRate;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update profile'
    });
  }
};

// Get all tutors for listing
exports.getAllTutors = async (req, res) => {
  try {
    const { 
      search, 
      subject, 
      minRate, 
      maxRate,
      page = 1,
      limit = 12
    } = req.query;

    const query = { role: 'tutor', status: 'active' };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { education: { $regex: search, $options: 'i' } }
      ];
    }

    if (subject) {
      query.subjects = subject;
    }

    if (minRate || maxRate) {
      query.hourlyRate = {};
      if (minRate) query.hourlyRate.$gte = Number(minRate);
      if (maxRate) query.hourlyRate.$lte = Number(maxRate);
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
        totalItems: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tutors'
    });
  }
};

// Get latest tutors for home page
exports.getLatestTutors = async (req, res) => {
  try {
    const tutors = await User.find({ role: 'tutor', status: 'active' })
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(6);

    res.json({
      success: true,
      tutors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest tutors'
    });
  }
};