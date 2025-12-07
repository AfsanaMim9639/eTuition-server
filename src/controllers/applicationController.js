const Application = require('../models/Application');
const Tuition = require('../models/Tuition');
const User = require('../models/User');

// Tutor applies to a tuition
exports.applyToTuition = async (req, res) => {
  try {
    const { tuitionId, coverLetter, expectedSalary, availability } = req.body;
    const tutorId = req.user.userId;

    // Check if tuition exists and is approved
    const tuition = await Tuition.findById(tuitionId);
    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: 'Tuition not found'
      });
    }

    if (tuition.status !== 'approved') {
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
      student: tuition.postedBy,
      coverLetter,
      expectedSalary,
      availability
    });

    // Increment application count
    tuition.applicationCount += 1;
    await tuition.save();

    await application.populate([
      { path: 'tutor', select: 'name email phone education subjects rating profileImage' },
      { path: 'tuition', select: 'title subject class' }
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
      .populate('tuition', 'title subject class location salary status')
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

    if (tuition.postedBy.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view these applications'
      });
    }

    const applications = await Application.find({ tuition: tuitionId })
      .populate('tutor', 'name email phone education subjects rating profileImage experience')
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

// Approve application (requires payment - handled in payment controller)
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

    // Approval requires payment (handled separately in payment flow)
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

    // Can't withdraw approved applications
    if (application.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot withdraw approved application'
      });
    }

    application.status = 'withdrawn';
    await application.save();

    // Decrement application count
    await Tuition.findByIdAndUpdate(application.tuition, {
      $inc: { applicationCount: -1 }
    });

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