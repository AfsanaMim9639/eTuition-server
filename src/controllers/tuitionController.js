const Tuition = require('../models/Tuition');
const mongoose = require('mongoose');

// Get latest tuitions for home page
exports.getLatestTuitions = async (req, res) => {
  try {
    console.log('📍 getLatestTuitions called');
    
    // Check DB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'error',
        message: 'Database not connected'
      });
    }

    const tuitions = await Tuition.find({ status: 'open' })
      .populate('studentId', 'name location')
      .sort({ postedAt: -1, createdAt: -1 })
      .limit(6)
      .lean();

    // ✅ FIXED: Use consistent response format
    res.json({
      status: 'success',
      count: tuitions.length,
      data: tuitions // Changed from 'tuitions' to 'data'
    });
  } catch (error) {
    console.error('❌ Error in getLatestTuitions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch latest tuitions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get filter options
exports.getFilterOptions = async (req, res) => {
  try {
    console.log('📍 getFilterOptions called');
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'error',
        message: 'Database not connected'
      });
    }

    const subjects = await Tuition.distinct('subject', { status: 'open' });
    const grades = await Tuition.distinct('grade', { status: 'open' });
    const tutoringTypes = await Tuition.distinct('tutoring_type', { status: 'open' });
    const mediums = await Tuition.distinct('preferred_medium', { status: 'open' });
    const locations = await Tuition.distinct('location', { status: 'open' });

    const salaryStats = await Tuition.aggregate([
      { $match: { status: 'open' } },
      {
        $group: {
          _id: null,
          minSalary: { $min: '$salary' },
          maxSalary: { $max: '$salary' }
        }
      }
    ]);

    // ✅ FIXED: Use consistent response format
    res.json({
      status: 'success',
      data: {
        subjects: subjects.filter(Boolean).sort(),
        grades: grades.filter(Boolean).sort(),
        tutoringTypes: tutoringTypes.filter(Boolean),
        mediums: mediums.filter(Boolean),
        locations: locations.filter(Boolean).sort(),
        salaryRange: salaryStats[0] || { minSalary: 0, maxSalary: 50000 }
      }
    });
  } catch (error) {
    console.error('❌ Error in getFilterOptions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch filter options',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all tuitions with filters
exports.getAllTuitions = async (req, res) => {
  try {
    console.log('📍 getAllTuitions called', req.query);
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'error',
        message: 'Database not connected'
      });
    }

    const { 
      page = 1, 
      limit = 10, 
      search, 
      subject,
      class: grade,
      tutoring_type, 
      preferred_medium,
      minSalary,
      maxSalary,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status = 'open'
    } = req.query;

    const query = { status };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    if (subject) query.subject = subject;
    if (grade) query.grade = grade;
    if (tutoring_type) query.tutoring_type = tutoring_type;
    if (preferred_medium) query.preferred_medium = preferred_medium;

    if (minSalary || maxSalary) {
      query.salary = {};
      if (minSalary) query.salary.$gte = Number(minSalary);
      if (maxSalary) query.salary.$lte = Number(maxSalary);
    }

    const skip = (page - 1) * limit;

    const sortOptions = {};
    if (sortBy === 'salary') {
      sortOptions.salary = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortOptions.postedAt = sortOrder === 'asc' ? 1 : -1;
      sortOptions.createdAt = sortOrder === 'asc' ? 1 : -1;
    }

    const tuitions = await Tuition.find(query)
      .populate('studentId', 'name phone location')
      .sort(sortOptions)
      .limit(Number(limit))
      .skip(skip)
      .lean();

    const total = await Tuition.countDocuments(query);

    // ✅ FIXED: Use consistent response format
    res.json({
      status: 'success',
      count: tuitions.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: tuitions // Changed from 'tuitions' to 'data'
    });
  } catch (error) {
    console.error('❌ Error in getAllTuitions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch tuitions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get tuition by ID
exports.getTuitionById = async (req, res) => {
  try {
    console.log('📍 getTuitionById called:', req.params.id);
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'error',
        message: 'Database not connected'
      });
    }

    const tuition = await Tuition.findById(req.params.id)
      .populate('studentId', 'name email phone location')
      .populate('approvedTutor', 'name email phone subjects rating')
      .lean();

    if (!tuition) {
      return res.status(404).json({
        status: 'error',
        message: 'Tuition not found'
      });
    }

    // Increment view count (without blocking response)
    Tuition.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }).exec();

    // ✅ FIXED: Use consistent response format
    res.json({
      status: 'success',
      data: tuition // Changed from 'tuition' to 'data'
    });
  } catch (error) {
    console.error('❌ Error in getTuitionById:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch tuition details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create new tuition
exports.createTuition = async (req, res) => {
  try {
    console.log('📍 createTuition called');
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'error',
        message: 'Database not connected'
      });
    }

    const tuitionData = {
      ...req.body,
      studentId: req.user?.userId,
      postedAt: new Date(),
      status: 'open',
      views: 0
    };

    const tuition = await Tuition.create(tuitionData);

    // ✅ FIXED: Use consistent response format
    res.status(201).json({
      status: 'success',
      message: 'Tuition posted successfully',
      data: tuition
    });
  } catch (error) {
    console.error('❌ Error in createTuition:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to create tuition',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get user's own tuitions
exports.getMyTuitions = async (req, res) => {
  try {
    console.log('📍 getMyTuitions called');
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'error',
        message: 'Database not connected'
      });
    }

    const tuitions = await Tuition.find({ studentId: req.user.userId })
      .populate('approvedTutor', 'name phone subjects')
      .sort({ createdAt: -1 })
      .lean();

    // ✅ FIXED: Use consistent response format
    res.json({
      status: 'success',
      count: tuitions.length,
      data: tuitions
    });
  } catch (error) {
    console.error('❌ Error in getMyTuitions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch your tuitions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update tuition
exports.updateTuition = async (req, res) => {
  try {
    console.log('📍 updateTuition called:', req.params.id);
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'error',
        message: 'Database not connected'
      });
    }

    const tuition = await Tuition.findById(req.params.id);

    if (!tuition) {
      return res.status(404).json({
        status: 'error',
        message: 'Tuition not found'
      });
    }

    if (tuition.studentId.toString() !== req.user.userId) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to update this tuition'
      });
    }

    Object.assign(tuition, req.body);
    await tuition.save();

    // ✅ FIXED: Use consistent response format
    res.json({
      status: 'success',
      message: 'Tuition updated successfully',
      data: tuition
    });
  } catch (error) {
    console.error('❌ Error in updateTuition:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update tuition',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete tuition
exports.deleteTuition = async (req, res) => {
  try {
    console.log('📍 deleteTuition called:', req.params.id);
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'error',
        message: 'Database not connected'
      });
    }

    const tuition = await Tuition.findById(req.params.id);

    if (!tuition) {
      return res.status(404).json({
        status: 'error',
        message: 'Tuition not found'
      });
    }

    if (tuition.studentId.toString() !== req.user.userId) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to delete this tuition'
      });
    }

    await tuition.deleteOne();

    // ✅ FIXED: Use consistent response format
    res.json({
      status: 'success',
      message: 'Tuition deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error in deleteTuition:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete tuition',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
