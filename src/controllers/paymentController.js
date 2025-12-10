const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/Payment');
const Application = require('../models/Application');
const Tuition = require('../models/Tuition');
const User = require('../models/User');

// Create payment intent
exports.createPaymentIntent = async (req, res) => {
  try {
    const { applicationId, amount } = req.body;

    console.log('💳 Creating payment intent for application:', applicationId);

    // Verify application
    const application = await Application.findById(applicationId)
      .populate('tuition')
      .populate('tutor');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Verify student ownership
    if (application.student.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Check if application is already accepted
    if (application.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Application is already accepted'
      });
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to paisa/cents
      currency: 'bdt',
      metadata: {
        applicationId: applicationId,
        tuitionId: application.tuition._id.toString(),
        tutorId: application.tutor._id.toString(),
        studentId: req.user.userId
      }
    });

    console.log('✅ Payment intent created:', paymentIntent.id);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('❌ Payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent'
    });
  }
};

// Confirm payment and approve tutor
exports.confirmPayment = async (req, res) => {
  try {
    const { 
      paymentIntentId, 
      applicationId, 
      amount 
    } = req.body;

    console.log('✅ Confirming payment:', paymentIntentId);

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }

    // Get application
    const application = await Application.findById(applicationId)
      .populate('tuition')
      .populate('tutor');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Calculate platform fee and tutor receives
    const platformFee = amount * 0.10; // 10% platform fee
    const tutorReceives = amount - platformFee;

    // Create payment record
    const payment = await Payment.create({
      tuition: application.tuition._id,
      student: req.user.userId,
      tutor: application.tutor._id,
      amount,
      platformFee,
      tutorReceives,
      transactionId: paymentIntentId,
      stripePaymentIntentId: paymentIntentId,
      paymentMethod: 'stripe',
      status: 'completed',
      completedAt: new Date(),
      description: `Payment for tuition: ${application.tuition.title}`
    });

    // Update application status
    application.status = 'accepted';
    application.respondedAt = new Date();
    await application.save();

    // Update tuition status
    const tuition = await Tuition.findById(application.tuition._id);
    tuition.status = 'ongoing';
    tuition.approvedTutor = application.tutor._id;
    tuition.closedAt = new Date();
    await tuition.save();

    // Reject all other applications for this tuition
    await Application.updateMany(
      { 
        tuition: application.tuition._id,
        _id: { $ne: applicationId },
        status: 'pending'
      },
      { 
        status: 'rejected',
        respondedAt: new Date(),
        rejectionReason: 'Another tutor has been selected'
      }
    );

    // Update tutor's earnings
    await User.findByIdAndUpdate(application.tutor._id, {
      $inc: { totalEarnings: tutorReceives }
    });

    console.log('✅ Payment confirmed and tutor approved');

    res.json({
      success: true,
      message: 'Payment successful and tutor approved',
      payment,
      application
    });
  } catch (error) {
    console.error('❌ Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment'
    });
  }
};

// Get payment history (Student)
exports.getMyPayments = async (req, res) => {
  try {
    console.log('🔍 Fetching payments for student:', req.user.userId);

    const payments = await Payment.find({ student: req.user.userId })
      .populate('tuition', 'title subject grade')
      .populate('tutor', 'name email phone')
      .sort({ createdAt: -1 });

    const totalSpent = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, payment) => sum + payment.amount, 0);

    console.log(`✅ Found ${payments.length} payments, total spent: ${totalSpent}`);

    res.json({
      success: true,
      payments,
      totalSpent,
      totalTransactions: payments.length
    });
  } catch (error) {
    console.error('❌ Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history'
    });
  }
};

// Get revenue history (Tutor)
exports.getMyRevenue = async (req, res) => {
  try {
    console.log('🔍 Fetching revenue for tutor:', req.user.userId);

    const payments = await Payment.find({ 
      tutor: req.user.userId,
      status: 'completed'
    })
      .populate('tuition', 'title subject grade')
      .populate('student', 'name email phone')
      .sort({ createdAt: -1 });

    const totalRevenue = payments.reduce((sum, payment) => sum + payment.tutorReceives, 0);
    const platformFees = payments.reduce((sum, payment) => sum + payment.platformFee, 0);

    console.log(`✅ Found ${payments.length} payments, total revenue: ${totalRevenue}`);

    res.json({
      success: true,
      payments,
      totalRevenue,
      platformFees,
      grossAmount: totalRevenue + platformFees,
      totalTransactions: payments.length
    });
  } catch (error) {
    console.error('❌ Get revenue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue history'
    });
  }
};

// Get payment details
exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Fetching payment details:', id);

    const payment = await Payment.findById(id)
      .populate('tuition')
      .populate('student', 'name email phone')
      .populate('tutor', 'name email phone');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check authorization
    if (
      payment.student._id.toString() !== req.user.userId &&
      payment.tutor._id.toString() !== req.user.userId &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    res.json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('❌ Get payment by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details'
    });
  }
};

// Update payment status (for refunds, disputes, cancellations)
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    console.log('🔍 Updating payment status:', id, 'to', status);

    // Validate status
    const validStatuses = ['pending', 'completed', 'failed', 'refunded', 'disputed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const payment = await Payment.findById(id)
      .populate('tuition', 'title')
      .populate('student', 'name email')
      .populate('tutor', 'name email');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check authorization
    const isStudent = payment.student._id.toString() === req.user.userId;
    const isAdmin = req.user.role === 'admin';

    if (!isStudent && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this payment'
      });
    }

    // Prevent changing completed payments (except admin refunds)
    if (payment.status === 'completed' && status !== 'refunded' && !isAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify completed payment. Contact admin for refunds.'
      });
    }

    // Store old status for logging
    const oldStatus = payment.status;

    // Update payment status
    payment.status = status;
    
    // Set timestamps and handle side effects based on status
    if (status === 'completed' && !payment.completedAt) {
      payment.completedAt = new Date();
    } 
    else if (status === 'refunded') {
      payment.refundedAt = new Date();
      payment.refundReason = reason || 'Refund requested';
      
      // Deduct from tutor's earnings if refunded
      if (payment.tutor && payment.tutorReceives) {
        await User.findByIdAndUpdate(payment.tutor._id, {
          $inc: { totalEarnings: -payment.tutorReceives }
        });
        console.log(`💰 Deducted ${payment.tutorReceives} from tutor earnings`);
      }

      // Update application back to pending if refunded
      if (payment.tuition) {
        await Application.updateMany(
          { tuition: payment.tuition._id, status: 'accepted' },
          { status: 'pending', respondedAt: null }
        );

        // Update tuition back to open
        await Tuition.findByIdAndUpdate(payment.tuition._id, {
          status: 'open',
          approvedTutor: null,
          closedAt: null
        });
        console.log('📝 Tuition reopened due to refund');
      }
    }
    else if (status === 'failed' || status === 'cancelled') {
      payment.failureReason = reason || `Payment ${status}`;
    }
    else if (status === 'disputed') {
      payment.disputeReason = reason || 'Payment disputed';
      payment.disputedAt = new Date();
    }

    await payment.save();

    console.log(`✅ Payment status updated: ${oldStatus} → ${status}`);

    res.json({
      success: true,
      message: `Payment status updated to ${status}`,
      payment
    });
  } catch (error) {
    console.error('❌ Update payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status',
      error: error.message
    });
  }
};