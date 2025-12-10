const Application = require('../models/Application');
const Tuition = require('../models/Tuition');
const Notification = require('../models/Notification');

// Helper function to create notification
const createNotification = async (userId, data) => {
  try {
    await Notification.create({
      user: userId,
      ...data
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// Tutor applies to a tuition
exports.applyToTuition = async (req, res) => {
  try {
    const { tuitionId, message, proposedRate } = req.body;
    const tutorId = req.user.userId;

    console.log('📝 Tutor applying:', tutorId, 'to tuition:', tuitionId);

    // Check if tuition exists and is open
    const tuition = await Tuition.findById(tuitionId);
    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: 'Tuition not found'
      });
    }

    if (tuition.status !== 'open') {
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
      student: tuition.studentId,
      message,
      proposedRate,
      appliedAt: new Date()
    });

    await application.populate([
      { path: 'tutor', select: 'name email phone education subjects rating profileImage' },
      { path: 'tuition', select: 'title subject grade location salary' }
    ]);

    // Create notification for student
    await createNotification(tuition.studentId, {
      type: 'application_received',
      title: 'New Tutor Application',
      message: `New tutor applied for ${tuition.subject} - ${tuition.title}`,
      link: `/dashboard/student/tuition/${tuitionId}/applications`,
      relatedTuition: tuitionId,
      relatedApplication: application._id,
      relatedUser: tutorId,
      priority: 'high'
    });

    console.log('✅ Application submitted successfully');

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      application
    });
  } catch (error) {
    console.error('❌ Apply error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit application'
    });
  }
};

// Get tutor's applications
exports.getMyApplications = async (req, res) => {
  try {
    console.log('📋 Fetching applications for tutor:', req.user.userId);

    const applications = await Application.find({ tutor: req.user.userId })
      .populate('tuition', 'title subject grade location salary status')
      .populate('student', 'name email phone')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${applications.length} applications`);

    res.json({
      success: true,
      applications
    });
  } catch (error) {
    console.error('❌ Get applications error:', error);
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

    console.log('📋 Fetching applications for tuition:', tuitionId);

    // Verify tuition ownership
    const tuition = await Tuition.findById(tuitionId);
    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: 'Tuition not found'
      });
    }

    if (tuition.studentId.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view these applications'
      });
    }

    const applications = await Application.find({ tuition: tuitionId })
      .populate('tutor', 'name email phone education subjects rating profileImage experience location')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${applications.length} applications`);

    res.json({
      success: true,
      applications
    });
  } catch (error) {
    console.error('❌ Get applications error:', error);
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

    console.log('🔄 Updating application:', applicationId, 'to status:', status);

    const application = await Application.findById(applicationId)
      .populate('tuition')
      .populate('tutor', 'name');

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
      application.respondedAt = new Date();
      if (rejectionReason) {
        application.rejectionReason = rejectionReason;
      }
      await application.save();

      // Create notification for tutor
      await createNotification(application.tutor._id, {
        type: 'application_rejected',
        title: 'Application Status Update',
        message: `Your application for ${application.tuition.subject} has been rejected`,
        link: `/dashboard/tutor/applications`,
        relatedTuition: application.tuition._id,
        relatedApplication: application._id,
        priority: 'medium'
      });

      console.log('✅ Application rejected');

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
    console.error('❌ Update application error:', error);
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

    console.log('🔙 Withdrawing application:', applicationId);

    const application = await Application.findById(applicationId)
      .populate('tuition', 'subject title');

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

    // Can't withdraw accepted applications
    if (application.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot withdraw accepted application'
      });
    }

    application.status = 'withdrawn';
    await application.save();

    // Create notification for student
    await createNotification(application.student, {
      type: 'system_alert',
      title: 'Application Withdrawn',
      message: `A tutor withdrew their application for ${application.tuition.subject}`,
      link: `/dashboard/student/tuition/${application.tuition._id}/applications`,
      relatedTuition: application.tuition._id,
      relatedApplication: application._id,
      priority: 'low'
    });

    console.log('✅ Application withdrawn');

    res.json({
      success: true,
      message: 'Application withdrawn successfully'
    });
  } catch (error) {
    console.error('❌ Withdraw application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to withdraw application'
    });
  }
};