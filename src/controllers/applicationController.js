const Application = require('../models/Application');
const Tuition = require('../models/Tuition');
const User = require('../models/User');

// Tutor applies to a tuition
exports.applyToTuition = async (req, res) => {
  try {
    const { tuitionId, message, proposedRate } = req.body; // ✅ Changed field names
    const tutorId = req.user.userId;

    // Check if tuition exists and is open
    const tuition = await Tuition.findById(tuitionId);
    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: 'Tuition not found'
      });
    }

    if (tuition.status !== 'open') { // ✅ Changed from 'approved' to 'open'
      return res.status(400).json({
        success: false,
        message: 'This tuition is not available for applications'
      });
    }

    // Check if tutor already applied
    const existingApplication = await Application.findOne({
      tuition: tuitionId,
      tutor: tutorId
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied to this tuition'
      });
    }

    // Create application
    const application = await Application.create({
      tuition: tuitionId,
      tutor: tutorId,
      student: tuition.studentId, // ✅ Changed from postedBy
      message, // ✅ Changed from coverLetter
      proposedRate, // ✅ Optional field
      appliedAt: new Date()
    });

    await application.populate([
      { path: 'tutor', select: 'name email phone education subjects rating profileImage' },
      { path: 'tuition', select: 'title subject grade location salary' } // ✅ Changed 'class' to 'grade'
    ]);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      application
    });
  } catch (error) {
    console.error('Apply error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit application'
    });
  }
};

// Get tutor's applications
exports.getMyApplications = async (req, res) => {
  try {
    const applications = await Application.find({ tutor: req.user.userId })
      .populate('tuition', 'title subject grade location salary status') // ✅ Changed 'class' to 'grade'
      .populate('student', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      applications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications'
    });
  }
};

// Get applications for a specific tuition (Student)
exports.getApplicationsForTuition = async (req, res) => {
  try {
    const { tuitionId } = req.params;

    // Verify tuition ownership
    const tuition = await Tuition.findById(tuitionId);
    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: 'Tuition not found'
      });
    }

    if (tuition.studentId.toString() !== req.user.userId && req.user.role !== 'admin') { // ✅ Changed from postedBy
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view these applications'
      });
    }

    const applications = await Application.find({ tuition: tuitionId })
      .populate('tutor', 'name email phone education subjects rating profileImage experience location') // ✅ Added location
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      applications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications'
    });
  }
};

// Update application status (Accept/Reject)
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status, rejectionReason } = req.body;

    const application = await Application.findById(applicationId)
      .populate('tuition')
      .populate('tutor');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Verify ownership
    if (application.student.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this application'
      });
    }

    // Reject application
    if (status === 'rejected') {
      application.status = 'rejected';
      application.respondedAt = new Date(); // ✅ Added respondedAt
      if (rejectionReason) {
        application.rejectionReason = rejectionReason;
      }
      await application.save();

      return res.json({
        success: true,
        message: 'Application rejected',
        application
      });
    }

    // For acceptance, it should go through payment first
    res.status(400).json({
      success: false,
      message: 'Application approval requires payment completion'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update application'
    });
  }
};

// Withdraw application (Tutor)
exports.withdrawApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findById(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Verify tutor ownership
    if (application.tutor.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to withdraw this application'
      });
    }

    // Can't withdraw approved/accepted applications
    if (application.status === 'accepted') { // ✅ Changed from 'approved'
      return res.status(400).json({
        success: false,
        message: 'Cannot withdraw accepted application'
      });
    }

    application.status = 'withdrawn';
    await application.save();

    res.json({
      success: true,
      message: 'Application withdrawn successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to withdraw application'
    });
  }
};