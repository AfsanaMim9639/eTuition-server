const Tuition = require('../models/Tuition');
const Application = require('../models/Application');

// Create new tuition
exports.createTuition = async (req, res) => {
  try {
    const tuitionData = {
      ...req.body,
      postedBy: req.user.userId
    };

    const tuition = await Tuition.create(tuitionData);

    res.status(201).json({
      success: true,
      message: 'Tuition posted successfully',
      tuition
    });
  } catch (error) {
    console.error('Create tuition error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create tuition'
    });
  }
};

// Get all tuitions with filters and pagination
exports.getAllTuitions = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      subject, 
      category, 
      medium,
      minSalary,
      maxSalary,
      status = 'approved'
    } = req.query;

    const query = { status };

    // Search by title, subject, or location
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by subject
    if (subject) {
      query.subject = subject;
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by medium
    if (medium) {
      query.medium = medium;
    }

    // Filter by salary range
    if (minSalary || maxSalary) {
      query.salary = {};
      if (minSalary) query.salary.$gte = Number(minSalary);
      if (maxSalary) query.salary.$lte = Number(maxSalary);
    }

    const skip = (page - 1) * limit;

    const tuitions = await Tuition.find(query)
      .populate('postedBy', 'name email phone profileImage')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Tuition.countDocuments(query);

    res.json({
      success: true,
      tuitions,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: Number(limit)
      }
    });
  } catch (error) {
    console.error('Get tuitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tuitions'
    });
  }
};

// Get tuition by ID
exports.getTuitionById = async (req, res) => {
  try {
    const tuition = await Tuition.findById(req.params.id)
      .populate('postedBy', 'name email phone profileImage')
      .populate('approvedTutor', 'name email phone education subjects rating');

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: 'Tuition not found'
      });
    }

    // Increment view count
    tuition.viewCount += 1;
    await tuition.save();

    res.json({
      success: true,
      tuition
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tuition details'
    });
  }
};

// Get tuitions posted by current user
exports.getMyTuitions = async (req, res) => {
  try {
    const tuitions = await Tuition.find({ postedBy: req.user.userId })
      .populate('approvedTutor', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      tuitions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your tuitions'
    });
  }
};

// Update tuition
exports.updateTuition = async (req, res) => {
  try {
    const tuition = await Tuition.findById(req.params.id);

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: 'Tuition not found'
      });
    }

    // Check if user is the owner
    if (tuition.postedBy.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this tuition'
      });
    }

    // Don't allow updates if tuition is ongoing or completed
    if (['ongoing', 'completed'].includes(tuition.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot update ${tuition.status} tuition`
      });
    }

    Object.assign(tuition, req.body);
    await tuition.save();

    res.json({
      success: true,
      message: 'Tuition updated successfully',
      tuition
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update tuition'
    });
  }
};

// Delete tuition
exports.deleteTuition = async (req, res) => {
  try {
    const tuition = await Tuition.findById(req.params.id);

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: 'Tuition not found'
      });
    }

    // Check if user is the owner
    if (tuition.postedBy.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this tuition'
      });
    }

    // Don't allow deletion if tuition is ongoing
    if (tuition.status === 'ongoing') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete ongoing tuition'
      });
    }

    // Delete associated applications
    await Application.deleteMany({ tuition: tuition._id });

    await tuition.deleteOne();

    res.json({
      success: true,
      message: 'Tuition deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete tuition'
    });
  }
};

// Get latest tuitions for home page
exports.getLatestTuitions = async (req, res) => {
  try {
    const tuitions = await Tuition.find({ status: 'approved' })
      .populate('postedBy', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(6);

    res.json({
      success: true,
      tuitions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest tuitions'
    });
  }
};