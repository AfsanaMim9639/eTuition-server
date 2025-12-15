// controllers/adminController.js - FIXED VERSION

const User = require('../models/User');
const Tuition = require('../models/Tuition');
const Application = require('../models/Application');
const Payment = require('../models/Payment');

// Get Dashboard Statistics
// controllers/adminController.js - UPDATED getDashboardStats

exports.getDashboardStats = async (req, res) => {
  try {
    console.log('📊 Fetching admin dashboard stats...');

    // Existing stats
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalTutors = await User.countDocuments({ role: 'tutor' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });

    const totalTuitions = await Tuition.countDocuments();
    const pendingTuitions = await Tuition.countDocuments({ approvalStatus: 'pending' });
    const approvedTuitions = await Tuition.countDocuments({ approvalStatus: 'approved' });
    const rejectedTuitions = await Tuition.countDocuments({ approvalStatus: 'rejected' });
    const ongoingTuitions = await Tuition.countDocuments({ status: 'ongoing' });
    const completedTuitions = await Tuition.countDocuments({ status: 'completed' });

    const totalApplications = await Application.countDocuments();

    const paymentStats = await Payment.aggregate([
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalRevenue: { $sum: '$amount' },
          pendingAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0]
            }
          }
        }
      }
    ]);

    // ✅ NEW: Monthly Revenue Chart Data (Last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$amount' },
          platformFee: { $sum: '$platformFee' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: [
                  { $lt: ['$_id.month', 10] },
                  { $concat: ['0', { $toString: '$_id.month' }] },
                  { $toString: '$_id.month' }
                ]
              }
            ]
          },
          revenue: 1,
          platformFee: 1,
          count: 1
        }
      }
    ]);

    // ✅ NEW: Payment Methods Distribution
    const paymentMethodStats = await Payment.aggregate([
      {
        $match: { status: 'completed' }
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $project: {
          _id: 0,
          method: '$_id',
          count: 1,
          amount: '$totalAmount'
        }
      }
    ]);

    // ✅ NEW: User Growth (Last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            role: '$role'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      },
      {
        $group: {
          _id: {
            year: '$_id.year',
            month: '$_id.month'
          },
          students: {
            $sum: {
              $cond: [{ $eq: ['$_id.role', 'student'] }, '$count', 0]
            }
          },
          tutors: {
            $sum: {
              $cond: [{ $eq: ['$_id.role', 'tutor'] }, '$count', 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: [
                  { $lt: ['$_id.month', 10] },
                  { $concat: ['0', { $toString: '$_id.month' }] },
                  { $toString: '$_id.month' }
                ]
              }
            ]
          },
          students: 1,
          tutors: 1
        }
      },
      {
        $sort: { month: 1 }
      }
    ]);

    // ✅ NEW: Tuitions Status Distribution
    const tuitionsStatusChart = [
      { status: 'Pending', count: pendingTuitions, color: '#FFA500' },
      { status: 'Approved', count: approvedTuitions, color: '#39FF14' },
      { status: 'Ongoing', count: ongoingTuitions, color: '#00F0FF' },
      { status: 'Completed', count: completedTuitions, color: '#FF10F0' },
      { status: 'Rejected', count: rejectedTuitions, color: '#FF0000' }
    ];

    const stats = {
      users: {
        total: totalUsers,
        students: totalStudents,
        tutors: totalTutors,
        admins: totalAdmins
      },
      tuitions: {
        total: totalTuitions,
        pending: pendingTuitions,
        approved: approvedTuitions,
        rejected: rejectedTuitions,
        ongoing: ongoingTuitions,
        completed: completedTuitions
      },
      applications: totalApplications,
      payments: {
        total: paymentStats[0]?.totalPayments || 0,
        revenue: paymentStats[0]?.totalRevenue || 0,
        pending: paymentStats[0]?.pendingAmount || 0
      },
      // ✅ NEW: Charts Data
      charts: {
        monthlyRevenue,
        paymentMethods: paymentMethodStats,
        userGrowth,
        tuitionsStatus: tuitionsStatusChart
      }
    };

    console.log('✅ Stats fetched successfully');
    
    res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

// Get All Users with Filters and Pagination
exports.getAllUsers = async (req, res) => {
  try {
    console.log('👥 Fetching all users with filters:', req.query);

    const { 
      page = 1, 
      limit = 20, 
      role, 
      status, 
      search 
    } = req.query;

    const query = {};
    
    if (role) {
      query.role = role;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    console.log(`✅ Found ${users.length} users (Page ${page}/${totalPages})`);

    res.status(200).json({
      success: true,
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalUsers,
        usersPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// Update User Role
exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    console.log(`🔄 Updating user ${userId} role to: ${role}`);

    const validRoles = ['student', 'tutor', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be: student, tutor, or admin'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`✅ User role updated successfully`);

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      user
    });

  } catch (error) {
    console.error('❌ Error updating user role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: error.message
    });
  }
};

// Get Single User Details
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`👤 Fetching user details: ${userId}`);

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`✅ User details fetched: ${user.email}`);

    res.status(200).json({
      success: true,
      user
    });

  } catch (error) {
    console.error('❌ Error fetching user details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details',
      error: error.message
    });
  }
};

// Update User Information
exports.updateUserInfo = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    console.log(`📝 Updating user info: ${userId}`, updateData);

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const allowedFields = [
      'name',
      'email',
      'phone',
      'address',
      'location',
      'profileImage',
      'grade',
      'institution',
      'subjects',
      'experience',
      'education',
      'bio',
      'hourlyRate'
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    if (updates.email && updates.email !== user.email) {
      const emailExists = await User.findOne({ email: updates.email });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`✅ User info updated successfully: ${updatedUser.email}`);

    res.status(200).json({
      success: true,
      message: 'User information updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('❌ Error updating user info:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update user information',
      error: error.message
    });
  }
};

// Delete User
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`🗑️ Deleting user: ${userId}`);
    console.log(`🔑 Request by admin: ${req.user.userId}`);

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      console.log(`❌ User not found: ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user._id.toString() === req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    await User.findByIdAndDelete(userId);

    console.log(`✅ User deleted successfully: ${userId}`);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
};

// Update User Status
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, rejectionReason } = req.body;

    console.log(`🔄 Updating user ${userId} status to: ${status}`);

    const validStatuses = ['pending', 'approved', 'rejected', 'suspended', 'blocked'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: pending, approved, rejected, suspended, or blocked'
      });
    }

    const updateData = { status };

    if (status === 'approved') {
      updateData.approvalDetails = {
        approvedBy: req.user.userId,
        approvedAt: new Date()
      };
    }

    if (status === 'rejected' && rejectionReason) {
      updateData['approvalDetails.rejectionReason'] = rejectionReason;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`✅ User status updated successfully to: ${status}`);

    res.status(200).json({
      success: true,
      message: `User status updated to ${status} successfully`,
      user
    });

  } catch (error) {
    console.error('❌ Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message
    });
  }
};

// ============================================
// TUITION MANAGEMENT - FIXED
// ============================================

// Get All Tuitions (Admin) - FIXED
exports.getAllTuitionsAdmin = async (req, res) => {
  try {
    console.log('📚 Fetching all tuitions for admin:', req.query);

    const { 
      page = 1, 
      limit = 20, 
      status,
      approvalStatus,
      subject,
      tutoring_type,
      grade,
      search
    } = req.query;

    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }

    if (approvalStatus) {
      query.approvalStatus = approvalStatus;
    }

    if (subject) {
      query.subject = subject;
    }

    if (tutoring_type) {
      query.tutoring_type = tutoring_type;
    }

    if (grade) {
      query.grade = grade;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalTuitions = await Tuition.countDocuments(query);
    const totalPages = Math.ceil(totalTuitions / parseInt(limit));

    // ✅ FIXED: Use 'studentId' instead of 'student'
    const tuitions = await Tuition.find(query)
      .populate('studentId', 'name email phone')
      .populate('approvedTutor', 'name email phone')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    console.log(`✅ Found ${tuitions.length} tuitions (Page ${page}/${totalPages})`);

    res.status(200).json({
      success: true,
      tuitions,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalTuitions,
        tuitionsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching tuitions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tuitions',
      error: error.message
    });
  }
};

// Get Tuition By ID - FIXED
exports.getTuitionById = async (req, res) => {
  try {
    const { tuitionId } = req.params;

    console.log(`📚 Fetching tuition details: ${tuitionId}`);

    if (!tuitionId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tuition ID format'
      });
    }

    // ✅ FIXED: Use 'studentId' instead of 'student'
    const tuition = await Tuition.findById(tuitionId)
      .populate('studentId', 'name email phone')
      .populate('approvedTutor', 'name email phone subjects')
      .populate('approvedBy', 'name email')
      .lean();

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: 'Tuition not found'
      });
    }

    console.log(`✅ Tuition details fetched: ${tuition.title}`);

    res.status(200).json({
      success: true,
      tuition
    });

  } catch (error) {
    console.error('❌ Error fetching tuition details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tuition details',
      error: error.message
    });
  }
};

// Approve Tuition
exports.approveTuition = async (req, res) => {
  try {
    const { tuitionId } = req.params;

    console.log(`✅ Approving tuition: ${tuitionId}`);

    if (!tuitionId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tuition ID format'
      });
    }

    const tuition = await Tuition.findByIdAndUpdate(
      tuitionId,
      {
        approvalStatus: 'approved',
        approvedBy: req.user.userId,
        approvedAt: new Date()
      },
      { new: true, runValidators: true }
    ).populate('studentId', 'name email phone');

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: 'Tuition not found'
      });
    }

    console.log(`✅ Tuition approved successfully: ${tuition.title}`);

    res.status(200).json({
      success: true,
      message: 'Tuition approved successfully',
      tuition
    });

  } catch (error) {
    console.error('❌ Error approving tuition:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve tuition',
      error: error.message
    });
  }
};

// Reject Tuition
exports.rejectTuition = async (req, res) => {
  try {
    const { tuitionId } = req.params;
    const { rejectionReason } = req.body;

    console.log(`❌ Rejecting tuition: ${tuitionId}`);

    if (!tuitionId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tuition ID format'
      });
    }

    const tuition = await Tuition.findByIdAndUpdate(
      tuitionId,
      {
        approvalStatus: 'rejected',
        rejectionReason: rejectionReason || 'No reason provided',
        rejectedAt: new Date()
      },
      { new: true, runValidators: true }
    ).populate('studentId', 'name email phone');

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: 'Tuition not found'
      });
    }

    console.log(`✅ Tuition rejected: ${tuition.title}`);

    res.status(200).json({
      success: true,
      message: 'Tuition rejected successfully',
      tuition
    });

  } catch (error) {
    console.error('❌ Error rejecting tuition:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject tuition',
      error: error.message
    });
  }
};

// Update Tuition Status
exports.updateTuitionStatus = async (req, res) => {
  try {
    const { tuitionId } = req.params;
    const { status } = req.body;

    console.log(`🔄 Updating tuition ${tuitionId} status to: ${status}`);

    const validStatuses = ['open', 'closed', 'ongoing', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: open, closed, ongoing, or completed'
      });
    }

    const tuition = await Tuition.findByIdAndUpdate(
      tuitionId,
      { status },
      { new: true, runValidators: true }
    ).populate('studentId', 'name email');

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: 'Tuition not found'
      });
    }

    console.log(`✅ Tuition status updated successfully`);

    res.status(200).json({
      success: true,
      message: 'Tuition status updated successfully',
      tuition
    });

  } catch (error) {
    console.error('❌ Error updating tuition status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tuition status',
      error: error.message
    });
  }
};

// Get Financial Reports
exports.getFinancialReports = async (req, res) => {
  try {
    console.log('💰 Fetching financial reports...');

    // Get all completed payments
    const completedPayments = await Payment.find({ status: 'completed' })
      .populate('student', 'name email')
      .populate('tutor', 'name email')
      .populate('tuition', 'title subject')
      .sort({ createdAt: -1 })
      .lean();

    // Calculate total earnings
    const totalEarnings = completedPayments.reduce((sum, payment) => {
      return sum + (payment.platformFee || 0);
    }, 0);

    // Calculate total transaction amount
    const totalTransactionAmount = completedPayments.reduce((sum, payment) => {
      return sum + (payment.amount || 0);
    }, 0);

    // Calculate tutor earnings (after platform fee)
    const totalTutorEarnings = completedPayments.reduce((sum, payment) => {
      return sum + (payment.tutorReceives || 0);
    }, 0);

    // Get payment statistics by status
    const paymentsByStatus = await Payment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Get monthly earnings (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyEarnings = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalAmount: { $sum: '$amount' },
          platformFee: { $sum: '$platformFee' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get payment method distribution
    const paymentMethodStats = await Payment.aggregate([
      {
        $match: { status: 'completed' }
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Get recent transactions (last 50)
    const recentTransactions = await Payment.find()
      .populate('student', 'name email')
      .populate('tutor', 'name email')
      .populate('tuition', 'title subject')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Format transactions for frontend
    const formattedTransactions = recentTransactions.map(payment => ({
      _id: payment._id,
      transactionId: payment.transactionId,
      studentName: payment.student?.name || 'Unknown',
      studentEmail: payment.student?.email || '',
      tutorName: payment.tutor?.name || 'Unknown',
      tutorEmail: payment.tutor?.email || '',
      amount: payment.amount,
      platformFee: payment.platformFee,
      tutorReceives: payment.tutorReceives,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      createdAt: payment.createdAt,
      completedAt: payment.completedAt,
      tuitionTitle: payment.tuition?.title || 'N/A',
      tuitionSubject: payment.tuition?.subject || 'N/A'
    }));

    const report = {
      summary: {
        totalEarnings, // Platform earnings (fees)
        totalTransactionAmount, // Total amount transacted
        totalTutorEarnings, // Amount paid to tutors
        totalCompletedTransactions: completedPayments.length,
        averageTransactionAmount: completedPayments.length > 0 
          ? totalTransactionAmount / completedPayments.length 
          : 0
      },
      paymentsByStatus,
      monthlyEarnings,
      paymentMethodStats,
      recentTransactions: formattedTransactions
    };

    console.log('✅ Financial reports fetched successfully');
    console.log('💵 Total Platform Earnings:', totalEarnings);
    console.log('📊 Total Transactions:', completedPayments.length);

    res.status(200).json({
      success: true,
      report
    });

  } catch (error) {
    console.error('❌ Error fetching financial reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch financial reports',
      error: error.message
    });
  }
};

// Get All Payments (Admin) - UPDATED VERSION
exports.getAllPayments = async (req, res) => {
  try {
    console.log('💰 Fetching all payments for admin');

    const { 
      page = 1, 
      limit = 50,
      status,
      paymentMethod,
      startDate,
      endDate
    } = req.query;

    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalPayments = await Payment.countDocuments(query);
    const totalPages = Math.ceil(totalPayments / parseInt(limit));

    const payments = await Payment.find(query)
      .populate('student', 'name email')
      .populate('tutor', 'name email')
      .populate('tuition', 'title subject')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Format payments
    const formattedPayments = payments.map(payment => ({
      _id: payment._id,
      transactionId: payment.transactionId,
      studentName: payment.student?.name || 'Unknown',
      studentEmail: payment.student?.email || '',
      tutorName: payment.tutor?.name || 'Unknown',
      tutorEmail: payment.tutor?.email || '',
      amount: payment.amount,
      platformFee: payment.platformFee,
      tutorReceives: payment.tutorReceives,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      createdAt: payment.createdAt,
      completedAt: payment.completedAt,
      tuitionTitle: payment.tuition?.title || 'N/A'
    }));

    console.log(`✅ Found ${payments.length} payments (Page ${page}/${totalPages})`);

    res.status(200).json({
      success: true,
      payments: formattedPayments,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalPayments,
        paymentsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
};