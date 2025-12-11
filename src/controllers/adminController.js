// controllers/adminController.js

const User = require('../models/User');
const Tuition = require('../models/Tuition');
const Application = require('../models/Application');
const Payment = require('../models/Payment');

// Get Dashboard Statistics
exports.getDashboardStats = async (req, res) => {
  try {
    console.log('📊 Fetching admin dashboard stats...');

    // User statistics
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalTutors = await User.countDocuments({ role: 'tutor' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });

    // Tuition statistics
    const totalTuitions = await Tuition.countDocuments();
    const pendingTuitions = await Tuition.countDocuments({ status: 'pending' });
    const approvedTuitions = await Tuition.countDocuments({ status: 'approved' });
    const ongoingTuitions = await Tuition.countDocuments({ status: 'ongoing' });
    const completedTuitions = await Tuition.countDocuments({ status: 'completed' });

    // Application statistics
    const totalApplications = await Application.countDocuments();

    // Payment statistics
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
        ongoing: ongoingTuitions,
        completed: completedTuitions
      },
      applications: totalApplications,
      payments: {
        total: paymentStats[0]?.totalPayments || 0,
        revenue: paymentStats[0]?.totalRevenue || 0,
        pending: paymentStats[0]?.pendingAmount || 0
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

    // Build query
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

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    // Fetch users
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

    // Validate role
    const validRoles = ['student', 'tutor', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be: student, tutor, or admin'
      });
    }

    // Update user
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

// Update User Status
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    console.log(`🔄 Updating user ${userId} status to: ${status}`);

    // Validate status
    const validStatuses = ['active', 'suspended', 'blocked'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: active, suspended, or blocked'
      });
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`✅ User status updated successfully`);

    res.status(200).json({
      success: true,
      message: 'User status updated successfully',
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

// Delete User
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`🗑️ Deleting user: ${userId}`);

    // Check if user exists
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting admin accounts (optional safety check)
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete admin accounts'
      });
    }

    // Delete user
    await User.findByIdAndDelete(userId);

    console.log(`✅ User deleted successfully`);

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

// Get All Tuitions (Admin)
exports.getAllTuitionsAdmin = async (req, res) => {
  try {
    console.log('📚 Fetching all tuitions for admin:', req.query);

    const { 
      page = 1, 
      limit = 20, 
      status 
    } = req.query;

    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalTuitions = await Tuition.countDocuments(query);
    const totalPages = Math.ceil(totalTuitions / parseInt(limit));

    // Fetch tuitions with student info
    const tuitions = await Tuition.find(query)
      .populate('student', 'name email phone')
      .populate('applications')
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

// Update Tuition Status
exports.updateTuitionStatus = async (req, res) => {
  try {
    const { tuitionId } = req.params;
    const { status } = req.body;

    console.log(`🔄 Updating tuition ${tuitionId} status to: ${status}`);

    // Validate status
    const validStatuses = ['pending', 'approved', 'ongoing', 'completed', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: pending, approved, ongoing, completed, or rejected'
      });
    }

    // Update tuition
    const tuition = await Tuition.findByIdAndUpdate(
      tuitionId,
      { status },
      { new: true, runValidators: true }
    ).populate('student', 'name email');

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

// Get All Payments (Admin)
exports.getAllPayments = async (req, res) => {
  try {
    console.log('💰 Fetching all payments for admin');

    const payments = await Payment.find()
      .populate('user', 'name email')
      .populate('tuition', 'subject class')
      .sort({ createdAt: -1 })
      .limit(100) // Limit to last 100 payments
      .lean();

    console.log(`✅ Found ${payments.length} payments`);

    res.status(200).json({
      success: true,
      payments
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