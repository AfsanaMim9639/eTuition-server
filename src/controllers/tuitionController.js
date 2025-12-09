const Tuition = require('../models/Tuition');
const Application = require('../models/Application');

// Get all tuitions with filters and pagination
exports.getAllTuitions = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      subject, 
      tutoring_type, 
      preferred_medium,
      minSalary,
      maxSalary,
      status = 'open'
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

    // Filter by tutoring type
    if (tutoring_type) {
      query.tutoring_type = tutoring_type;
    }

    // Filter by medium
    if (preferred_medium) {
      query.preferred_medium = preferred_medium;
    }

    // Filter by salary range
    if (minSalary || maxSalary) {
      query.salary = {};
      if (minSalary) query.salary.$gte = Number(minSalary);
      if (maxSalary) query.salary.$lte = Number(maxSalary);
    }

    const skip = (page - 1) * limit;

    const tuitions = await Tuition.find(query)
      .populate('studentId', 'name phone location') // ✅ Added populate
      .sort({ postedAt: -1, createdAt: -1 }) // ✅ Changed from posted_date
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

// Get latest tuitions for home page
exports.getLatestTuitions = async (req, res) => {
  try {
    const tuitions = await Tuition.find({ status: 'open' })
      .populate('studentId', 'name location') // ✅ Added populate
      .sort({ postedAt: -1, createdAt: -1 }) // ✅ Changed from posted_date
      .limit(6);

    res.json({
      success: true,
      tuitions
    });
  } catch (error) {
    console.error('Get latest tuitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest tuitions'
    });
  }
};

// Get tuition by ID
exports.getTuitionById = async (req, res) => {
  try {
    const tuition = await Tuition.findById(req.params.id)
      .populate('studentId', 'name email phone location') // ✅ Added populate
      .populate('approvedTutor', 'name email phone subjects rating'); // ✅ Added populate

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: 'Tuition not found'
      });
    }

    // Increment view count
    tuition.views = (tuition.views || 0) + 1;
    await tuition.save();

    res.json({
      success: true,
      tuition
    });
  } catch (error) {
    console.error('Get tuition by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tuition details'
    });
  }
};

// Create new tuition
exports.createTuition = async (req, res) => {
  try {
    const tuitionData = {
      ...req.body,
      studentId: req.user?.userId, // ✅ Changed from postedBy to studentId
      postedAt: new Date(), // ✅ Changed from posted_date
      status: 'open',
      views: 0
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

// Get tuitions posted by current user
exports.getMyTuitions = async (req, res) => {
  try {
    const tuitions = await Tuition.find({ studentId: req.user.userId }) // ✅ Changed from postedBy
      .populate('approvedTutor', 'name phone subjects') // ✅ Added populate
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
    if (tuition.studentId.toString() !== req.user.userId) { // ✅ Changed from postedBy
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this tuition'
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
    if (tuition.studentId.toString() !== req.user.userId) { // ✅ Changed from postedBy
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this tuition'
      });
    }

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