const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/Payment');
const Application = require('../models/Application');
const Tuition = require('../models/Tuition');
const User = require('../models/User');

// Create payment intent
exports.createPaymentIntent = async (req, res) => {
  try {
    const { applicationId, amount } = req.body;

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
    if (application.status === 'accepted') { // ✅ Changed from 'approved'
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

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Payment intent error:', error);
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
    application.status = 'accepted'; // ✅ Changed from 'approved' to 'accepted'
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
      $inc: { totalEarnings: tutorReceives } // ✅ Use tutorReceives instead of full amount
    });

    res.json({
      success: true,
      message: 'Payment successful and tutor approved',
      payment,
      application
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment'
    });
  }
};

// Get payment history (Student)
exports.getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ student: req.user.userId })
      .populate('tuition', 'title subject grade') // ✅ Changed 'class' to 'grade'
      .populate('tutor', 'name email phone')
      .sort({ createdAt: -1 });

    const totalSpent = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, payment) => sum + payment.amount, 0);

    res.json({
      success: true,
      payments,
      totalSpent,
      totalTransactions: payments.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history'
    });
  }
};

// Get revenue history (Tutor)
exports.getMyRevenue = async (req, res) => {
  try {
    const payments = await Payment.find({ 
      tutor: req.user.userId,
      status: 'completed'
    })
      .populate('tuition', 'title subject grade') // ✅ Changed 'class' to 'grade'
      .populate('student', 'name email phone')
      .sort({ createdAt: -1 });

    const totalRevenue = payments.reduce((sum, payment) => sum + payment.tutorReceives, 0); // ✅ Use tutorReceives
    const platformFees = payments.reduce((sum, payment) => sum + payment.platformFee, 0);

    res.json({
      success: true,
      payments,
      totalRevenue,
      platformFees,
      grossAmount: totalRevenue + platformFees,
      totalTransactions: payments.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue history'
    });
  }
};

// Get payment details
exports.getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
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
      payment.student.toString() !== req.user.userId &&
      payment.tutor.toString() !== req.user.userId &&
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
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details'
    });
  }
};