const ClassSchedule = require('../models/ClassSchedule');
const User = require('../models/User');
const Notification = require('../models/Notification');

// ==================== CREATE SCHEDULE ====================
const createSchedule = async (req, res) => {
  try {
    const {
      title,
      subject,
      description,
      tutorId,
      studentId,
      startTime,
      endTime,
      classType,
      meetingLink,
      location,
      isRecurring,
      recurrence,
      relatedTuition,
      relatedApplication
    } = req.body;

    // Validate required fields
    if (!title || !subject || !tutorId || !studentId || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Validate users exist
    const [tutor, student] = await Promise.all([
      User.findById(tutorId),
      User.findById(studentId)
    ]);

    if (!tutor || tutor.role !== 'tutor') {
      return res.status(404).json({
        success: false,
        message: 'Tutor not found'
      });
    }

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check for scheduling conflicts
    const conflicts = await ClassSchedule.checkConflict(
      tutorId,
      new Date(startTime),
      new Date(endTime)
    );

    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Tutor has a conflicting class at this time',
        conflicts: conflicts.map(c => ({
          id: c._id,
          title: c.title,
          startTime: c.startTime,
          endTime: c.endTime
        }))
      });
    }

    // Check student conflicts
    const studentConflicts = await ClassSchedule.checkConflict(
      studentId,
      new Date(startTime),
      new Date(endTime)
    );

    if (studentConflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Student has a conflicting class at this time',
        conflicts: studentConflicts.map(c => ({
          id: c._id,
          title: c.title,
          startTime: c.startTime,
          endTime: c.endTime
        }))
      });
    }

    // Create schedule
    const schedule = await ClassSchedule.create({
      title,
      subject,
      description,
      tutor: tutorId,
      student: studentId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      classType: classType || 'online',
      meetingLink,
      location,
      isRecurring: isRecurring || false,
      recurrence: isRecurring ? recurrence : undefined,
      relatedTuition,
      relatedApplication,
      createdBy: req.user.userId
    });

    // Populate user details
    await schedule.populate('tutor student', 'name email profileImage');

    // Send notifications
    const io = req.app.get('io');
    
    // Notify tutor
    const tutorNotification = await Notification.create({
      user: tutorId,
      type: 'system_alert',
      title: 'New Class Scheduled',
      message: `A new class "${title}" has been scheduled with ${student.name}`,
      link: `/tutor/schedule/${schedule._id}`,
      priority: 'high'
    });
    
    if (io) {
      io.to(`user_${tutorId}`).emit('new_notification', tutorNotification);
    }

    // Notify student
    const studentNotification = await Notification.create({
      user: studentId,
      type: 'system_alert',
      title: 'New Class Scheduled',
      message: `A new class "${title}" has been scheduled with ${tutor.name}`,
      link: `/student/schedule/${schedule._id}`,
      priority: 'high'
    });
    
    if (io) {
      io.to(`user_${studentId}`).emit('new_notification', studentNotification);
    }

    res.status(201).json({
      success: true,
      message: 'Class scheduled successfully',
      data: schedule
    });

  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create schedule',
      error: error.message
    });
  }
};

// ==================== GET ALL SCHEDULES ====================
const getSchedules = async (req, res) => {
  try {
    const { role, userId } = req.user;
    const { status, startDate, endDate, page = 1, limit = 50 } = req.query;

    // Build filter
    const filter = {};
    
    if (role === 'tutor') {
      filter.tutor = userId;
    } else if (role === 'student') {
      filter.student = userId;
    } else {
      // Admin can see all
    }

    if (status) {
      filter.status = status;
    }

    if (startDate && endDate) {
      filter.startTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Pagination
    const skip = (page - 1) * limit;
    
    const [schedules, total] = await Promise.all([
      ClassSchedule.find(filter)
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('tutor student', 'name email profileImage phone')
        .populate('createdBy', 'name email'),
      ClassSchedule.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: schedules,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schedules',
      error: error.message
    });
  }
};

// ==================== GET UPCOMING CLASSES ====================
const getUpcomingClasses = async (req, res) => {
  try {
    const { userId } = req.user;
    const { limit = 10 } = req.query;

    const classes = await ClassSchedule.getUpcomingClasses(userId, parseInt(limit));

    res.status(200).json({
      success: true,
      data: classes,
      count: classes.length
    });

  } catch (error) {
    console.error('Get upcoming classes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming classes',
      error: error.message
    });
  }
};

// ==================== GET TODAY'S CLASSES ====================
const getTodayClasses = async (req, res) => {
  try {
    const { userId } = req.user;

    const classes = await ClassSchedule.getTodayClasses(userId);

    res.status(200).json({
      success: true,
      data: classes,
      count: classes.length
    });

  } catch (error) {
    console.error('Get today classes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today\'s classes',
      error: error.message
    });
  }
};

// ==================== GET SINGLE SCHEDULE ====================
const getScheduleById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user;

    const schedule = await ClassSchedule.findById(id)
      .populate('tutor student', 'name email profileImage phone location')
      .populate('createdBy', 'name email')
      .populate('cancelledBy', 'name email');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Check access permission
    const isTutor = schedule.tutor._id.toString() === userId;
    const isStudent = schedule.student._id.toString() === userId;
    const isAdmin = role === 'admin';

    if (!isTutor && !isStudent && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: schedule
    });

  } catch (error) {
    console.error('Get schedule by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schedule',
      error: error.message
    });
  }
};

// ==================== UPDATE SCHEDULE ====================
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user;
    const updates = req.body;

    const schedule = await ClassSchedule.findById(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Check permission
    const isTutor = schedule.tutor.toString() === userId;
    const isStudent = schedule.student.toString() === userId;
    const isAdmin = role === 'admin';

    if (!isTutor && !isStudent && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Students can only update their notes
    if (isStudent && !isAdmin && !isTutor) {
      if (Object.keys(updates).some(key => key !== 'studentNotes')) {
        return res.status(403).json({
          success: false,
          message: 'Students can only update their notes'
        });
      }
    }

    // Check for conflicts if time is being updated
    if (updates.startTime || updates.endTime) {
      const newStart = updates.startTime ? new Date(updates.startTime) : schedule.startTime;
      const newEnd = updates.endTime ? new Date(updates.endTime) : schedule.endTime;

      const conflicts = await ClassSchedule.checkConflict(
        schedule.tutor.toString(),
        newStart,
        newEnd,
        id
      );

      if (conflicts.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Time slot conflicts with existing schedule',
          conflicts
        });
      }
    }

    // Update schedule
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        schedule[key] = updates[key];
      }
    });

    await schedule.save();
    await schedule.populate('tutor student', 'name email profileImage');

    // Send notification for significant updates
    if (updates.startTime || updates.endTime || updates.status) {
      const io = req.app.get('io');
      
      const notificationUsers = [
        { id: schedule.tutor.toString(), link: `/tutor/schedule/${id}` },
        { id: schedule.student.toString(), link: `/student/schedule/${id}` }
      ].filter(u => u.id !== userId);

      for (const user of notificationUsers) {
        const notification = await Notification.create({
          user: user.id,
          type: 'system_alert',
          title: 'Class Schedule Updated',
          message: `Class "${schedule.title}" has been updated`,
          link: user.link,
          priority: 'medium'
        });

        if (io) {
          io.to(`user_${user.id}`).emit('new_notification', notification);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Schedule updated successfully',
      data: schedule
    });

  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update schedule',
      error: error.message
    });
  }
};

// ==================== CANCEL SCHEDULE ====================
const cancelSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    const { reason } = req.body;

    const schedule = await ClassSchedule.findById(id)
      .populate('tutor student', 'name email');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Check permission
    const isTutor = schedule.tutor._id.toString() === userId;
    const isStudent = schedule.student._id.toString() === userId;

    if (!isTutor && !isStudent) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Cancel the class
    await schedule.cancelClass(userId, reason);

    // Send notifications
    const io = req.app.get('io');
    const cancelledBy = isTutor ? schedule.tutor : schedule.student;
    const notifyUser = isTutor ? schedule.student : schedule.tutor;

    const notification = await Notification.create({
      user: notifyUser._id,
      type: 'system_alert',
      title: 'Class Cancelled',
      message: `${cancelledBy.name} has cancelled the class "${schedule.title}"${reason ? `: ${reason}` : ''}`,
      link: notifyUser.role === 'tutor' ? `/tutor/schedule/${id}` : `/student/schedule/${id}`,
      priority: 'high'
    });

    if (io) {
      io.to(`user_${notifyUser._id}`).emit('new_notification', notification);
    }

    res.status(200).json({
      success: true,
      message: 'Class cancelled successfully',
      data: schedule
    });

  } catch (error) {
    console.error('Cancel schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel schedule',
      error: error.message
    });
  }
};

// ==================== MARK ATTENDANCE ====================
const markAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user;
    const { role: attendanceRole, isPresent } = req.body;

    if (!attendanceRole || isPresent === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide role and attendance status'
      });
    }

    const schedule = await ClassSchedule.findById(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Only tutor or admin can mark attendance
    if (role !== 'tutor' && role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can mark attendance'
      });
    }

    await schedule.markAttendance(attendanceRole, isPresent, userId);

    res.status(200).json({
      success: true,
      message: 'Attendance marked successfully',
      data: schedule
    });

  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance',
      error: error.message
    });
  }
};

// ==================== COMPLETE CLASS ====================
const completeClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user;

    const schedule = await ClassSchedule.findById(id)
      .populate('tutor student', 'name email');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Only tutor can complete class
    if (schedule.tutor._id.toString() !== userId && role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the tutor can complete this class'
      });
    }

    await schedule.completeClass();

    // Send notification to student
    const io = req.app.get('io');
    const notification = await Notification.create({
      user: schedule.student._id,
      type: 'system_alert',
      title: 'Class Completed',
      message: `Your class "${schedule.title}" with ${schedule.tutor.name} has been completed`,
      link: `/student/schedule/${id}`,
      priority: 'medium'
    });

    if (io) {
      io.to(`user_${schedule.student._id}`).emit('new_notification', notification);
    }

    res.status(200).json({
      success: true,
      message: 'Class completed successfully',
      data: schedule
    });

  } catch (error) {
    console.error('Complete class error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete class',
      error: error.message
    });
  }
};

// ==================== START CLASS ====================
const startClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    const schedule = await ClassSchedule.findById(id)
      .populate('tutor student', 'name email');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Only tutor can start class
    if (schedule.tutor._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the tutor can start this class'
      });
    }

    await schedule.startClass();

    // Send notification to student
    const io = req.app.get('io');
    const notification = await Notification.create({
      user: schedule.student._id,
      type: 'system_alert',
      title: 'Class Started',
      message: `Your class "${schedule.title}" with ${schedule.tutor.name} has started`,
      link: `/student/schedule/${id}`,
      priority: 'urgent'
    });

    if (io) {
      io.to(`user_${schedule.student._id}`).emit('new_notification', notification);
    }

    res.status(200).json({
      success: true,
      message: 'Class started successfully',
      data: schedule
    });

  } catch (error) {
    console.error('Start class error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start class',
      error: error.message
    });
  }
};

// ==================== GET CLASS STATISTICS ====================
const getClassStatistics = async (req, res) => {
  try {
    const { userId, role } = req.user;

    const stats = await ClassSchedule.getClassStats(userId, role);

    // Get additional stats
    const [upcomingCount, todayCount] = await Promise.all([
      ClassSchedule.countDocuments({
        $or: [{ tutor: userId }, { student: userId }],
        status: 'scheduled',
        startTime: { $gte: new Date() }
      }),
      ClassSchedule.countDocuments({
        $or: [{ tutor: userId }, { student: userId }],
        status: { $in: ['scheduled', 'in-progress'] },
        startTime: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lte: new Date(new Date().setHours(23, 59, 59, 999))
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        byStatus: stats,
        upcoming: upcomingCount,
        today: todayCount
      }
    });

  } catch (error) {
    console.error('Get class statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

// ==================== DELETE SCHEDULE ====================
const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user;

    const schedule = await ClassSchedule.findById(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Only admin or creator can delete
    if (role !== 'admin' && schedule.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await schedule.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Schedule deleted successfully'
    });

  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete schedule',
      error: error.message
    });
  }
};

module.exports = {
  createSchedule,
  getSchedules,
  getUpcomingClasses,
  getTodayClasses,
  getScheduleById,
  updateSchedule,
  cancelSchedule,
  markAttendance,
  completeClass,
  startClass,
  getClassStatistics,
  deleteSchedule
};