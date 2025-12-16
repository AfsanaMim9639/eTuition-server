// controllers/applicationController.js

const Application = require('../models/Application');
const Tuition = require('../models/Tuition');
const User = require('../models/User');

// ✅ Apply to Tuition (Tutor)
exports.applyToTuition = async (req, res) => {
  try {
    const { tuitionId, qualifications, experience, expectedSalary } = req.body;
    const tutorId = req.user.userId;

    console.log('📝 Application request:', { tuitionId, tutorId });

    // Validate input
    if (!tuitionId || !qualifications || !experience || !expectedSalary) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if tuition exists
    const tuition = await Tuition.findById(tuitionId).populate('studentId', 'name email');
    
    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: 'Tuition not found'
      });
    }

    // Check if tuition is approved
    if (tuition.approvalStatus !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'This tuition is not approved yet'
      });
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      tuition: tuitionId,
      tutor: tutorId
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied to this tuition',
        alreadyApplied: true
      });
    }

    // Get tutor details
    const tutor = await User.findById(tutorId).select('name email');

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor not found'
      });
    }

    // Create application
    const application = await Application.create({
      tuition: tuitionId,
      tutor: tutorId,
      student: tuition.studentId._id,
      name: tutor.name,
      email: tutor.email,
      qualifications,
      experience,
      expectedSalary,
      status: 'pending'
    });

    // Populate the application
    await application.populate([
      { path: 'tutor', select: 'name email phone profileImage rating experience subjects education' },
      { path: 'tuition', select: 'title subject grade location salary' },
      { path: 'student', select: 'name email' }
    ]);

    console.log('✅ Application created successfully:', application._id);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      application
    });

  } catch (error) {
    console.error('❌ Apply to tuition error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application',
      error: error.message
    });
  }
};

// ✅ Check if already applied
exports.checkIfApplied = async (req, res) => {
  try {
    const { tuitionId } = req.params;
    const tutorId = req.user.userId;

    const application = await Application.findOne({
      tuition: tuitionId,
      tutor: tutorId
    });

    res.status(200).json({
      success: true,
      alreadyApplied: !!application,
      application: application || null
    });

  } catch (error) {
    console.error('❌ Check application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check application status'
    });
  }
};

// ✅ Get My Applications (Tutor)
exports.getMyApplications = async (req, res) => {
  try {
    const tutorId = req.user.userId;

    console.log('📋 Fetching applications for tutor:', tutorId);

    const applications = await Application.find({ tutor: tutorId })
      .populate('tuition', 'title subject grade location salary status approvalStatus')
      .populate('student', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();

    console.log(`✅ Found ${applications.length} applications`);

    res.status(200).json({
      success: true,
      applications
    });

  } catch (error) {
    console.error('❌ Get my applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message
    });
  }
};

// ✅ Get Applications for Tuition (Student)
exports.getApplicationsForTuition = async (req, res) => {
  try {
    const { tuitionId } = req.params;
    const studentId = req.user.userId;

    console.log('📋 Fetching applications for tuition:', tuitionId);

    // Check if tuition belongs to student
    const tuition = await Tuition.findById(tuitionId);
    
    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: 'Tuition not found'
      });
    }

    if (tuition.studentId.toString() !== studentId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view these applications'
      });
    }

    const applications = await Application.find({ tuition: tuitionId })
      .populate('tutor', 'name email phone profileImage rating experience subjects education bio address')
      .sort({ createdAt: -1 })
      .lean();

    console.log(`✅ Found ${applications.length} applications`);

    res.status(200).json({
      success: true,
      applications
    });

  } catch (error) {
    console.error('❌ Get tuition applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message
    });
  }
};

// ✅ Update Application Status (Student - Accept/Reject)
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status, rejectionReason } = req.body;
    const studentId = req.user.userId;

    console.log('🔄 Updating application status:', { applicationId, status });

    // Validate status
    const validStatuses = ['accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: accepted or rejected'
      });
    }

    // Find application
    const application = await Application.findById(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check authorization
    if (application.student.toString() !== studentId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this application'
      });
    }

    // Check if already processed
    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Application is already ${application.status}`
      });
    }

    // Update application
    application.status = status;
    application.respondedAt = new Date();
    
    if (status === 'rejected' && rejectionReason) {
      application.rejectionReason = rejectionReason;
    }

    await application.save();

    // Populate for response
    await application.populate([
      { path: 'tutor', select: 'name email phone' },
      { path: 'tuition', select: 'title subject' }
    ]);

    console.log(`✅ Application ${status} successfully`);

    res.status(200).json({
      success: true,
      message: `Application ${status} successfully`,
      application
    });

  } catch (error) {
    console.error('❌ Update application status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update application status',
      error: error.message
    });
  }
};

// ✅ Withdraw Application (Tutor)
exports.withdrawApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const tutorId = req.user.userId;

    console.log('🔙 Withdrawing application:', applicationId);

    const application = await Application.findById(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check authorization
    if (application.tutor.toString() !== tutorId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to withdraw this application'
      });
    }

    // Can only withdraw pending applications
    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot withdraw ${application.status} application`
      });
    }

    application.status = 'withdrawn';
    await application.save();

    console.log('✅ Application withdrawn successfully');

    res.status(200).json({
      success: true,
      message: 'Application withdrawn successfully',
      application
    });

  } catch (error) {
    console.error('❌ Withdraw application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to withdraw application',
      error: error.message
    });
  }
};