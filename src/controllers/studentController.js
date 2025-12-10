// controllers/studentController.js
const Tuition = require('../models/Tuition');
const Application = require('../models/Application');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');

// Get Student Dashboard Data
exports.getDashboardData = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    console.log('📊 Fetching dashboard data for student:', studentId);

    // Get Active Tuitions Count
    const activeTuitions = await Tuition.countDocuments({
      studentId,
      status: { $in: ['open', 'ongoing'] }
    });

    // Get Pending Applications Count (applications received on student's tuitions)
    const studentTuitions = await Tuition.find({ studentId }).select('_id');
    const tuitionIds = studentTuitions.map(t => t._id);
    
    const pendingApplications = await Application.countDocuments({
      tuition: { $in: tuitionIds },
      status: 'pending'
    });

    // Get Total Spent This Month
    const monthlyPayments = await Payment.aggregate([
      {
        $match: {
          student: req.user.userId,
          createdAt: { $gte: startOfMonth },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' }
        }
      }
    ]);

    const totalSpent = monthlyPayments.length > 0 ? monthlyPayments[0].totalSpent : 0;

    // Get Recent Activities from Notifications
    const recentActivities = await Notification.find({
      user: studentId
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Format activities
    const formattedActivities = recentActivities.map(activity => ({
      _id: activity._id,
      type: activity.type,
      message: activity.message,
      createdAt: activity.createdAt,
      actionUrl: activity.link || null
    }));

    // Get Upcoming Sessions (simulated - you can create a Session model later)
    // For now, we'll get recent accepted applications as "upcoming sessions"
    const upcomingSessions = await Application.find({
      student: studentId,
      status: 'accepted'
    })
      .sort({ appliedAt: -1 })
      .limit(5)
      .populate('tutor', 'name')
      .populate('tuition', 'subject title')
      .lean();

    // Format sessions
    const formattedSessions = upcomingSessions.map(app => ({
      _id: app._id,
      subject: app.tuition?.subject || 'N/A',
      topic: app.tuition?.title || 'N/A',
      tutorName: app.tutor?.name || 'N/A',
      date: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date within next week
      time: '3:00 PM - 5:00 PM' // You can make this dynamic later
    }));

    console.log('✅ Dashboard data fetched successfully');

    res.json({
      success: true,
      stats: {
        activeTuitions,
        pendingApplications,
        totalSpent
      },
      recentActivities: formattedActivities,
      upcomingSessions: formattedSessions
    });

  } catch (error) {
    console.error('❌ Dashboard data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
};

// Get Student Stats (for analytics page)
exports.getStudentStats = async (req, res) => {
  try {
    const studentId = req.user.userId;

    console.log('📈 Fetching student stats:', studentId);

    // Total tuitions posted
    const totalTuitions = await Tuition.countDocuments({ studentId });

    // Tuitions by status
    const openTuitions = await Tuition.countDocuments({ 
      studentId, 
      status: 'open' 
    });
    
    const ongoingTuitions = await Tuition.countDocuments({ 
      studentId, 
      status: 'ongoing' 
    });
    
    const completedTuitions = await Tuition.countDocuments({
      studentId,
      status: 'completed'
    });

    // Get student's tuition IDs
    const studentTuitions = await Tuition.find({ studentId }).select('_id');
    const tuitionIds = studentTuitions.map(t => t._id);

    // Total applications received
    const totalApplications = await Application.countDocuments({ 
      tuition: { $in: tuitionIds }
    });

    // Accepted applications
    const acceptedApplications = await Application.countDocuments({
      tuition: { $in: tuitionIds },
      status: 'accepted'
    });

    // Pending applications
    const pendingApplications = await Application.countDocuments({
      tuition: { $in: tuitionIds },
      status: 'pending'
    });

    // Total spent (all time)
    const allTimePayments = await Payment.aggregate([
      {
        $match: {
          student: req.user.userId,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' },
          totalTransactions: { $sum: 1 }
        }
      }
    ]);

    const paymentStats = allTimePayments.length > 0 ? allTimePayments[0] : {
      totalSpent: 0,
      totalTransactions: 0
    };

    // Monthly spending trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await Payment.aggregate([
      {
        $match: {
          student: req.user.userId,
          status: 'completed',
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalSpent: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.json({
      success: true,
      tuitionStats: {
        total: totalTuitions,
        open: openTuitions,
        ongoing: ongoingTuitions,
        completed: completedTuitions
      },
      applicationStats: {
        total: totalApplications,
        accepted: acceptedApplications,
        pending: pendingApplications,
        rejected: totalApplications - acceptedApplications - pendingApplications
      },
      paymentStats: {
        totalSpent: paymentStats.totalSpent,
        totalTransactions: paymentStats.totalTransactions,
        averagePayment: paymentStats.totalTransactions > 0 
          ? paymentStats.totalSpent / paymentStats.totalTransactions 
          : 0
      },
      monthlyTrend
    });

  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student stats',
      error: error.message
    });
  }
};

// Create notification helper (call this from other controllers)
exports.createNotification = async (userId, data) => {
  try {
    const notification = await Notification.create({
      user: userId,
      ...data
    });
    console.log('✅ Notification created:', notification._id);
    return notification;
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    throw error;
  }
};