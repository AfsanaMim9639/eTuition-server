const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parser
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toLocaleTimeString()} - ${req.method} ${req.path}`);
  next();
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const tuitionRoutes = require('./routes/tuitionRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const studentRoutes = require('./routes/studentRoutes');

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tuitions', tuitionRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);

// Root Route
app.get('/', (req, res) => {
  res.json({ 
    message: '🎓 Tuition Management API is running!',
    version: '1.0.0',
    endpoints: {
      tutors: '/api/users/tutors',
      latestTutors: '/api/users/tutors/latest',
      tuitions: '/api/tuitions',
      latestTuitions: '/api/tuitions/latest'
    }
  });
});

// 404 Handler
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.path} not found`
  });
});

// Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// ✅ শুধু এই part টা change করুন:
// Local development এর জন্য
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║  🚀 Server is running on port ${PORT}   ║
║  📍 http://localhost:${PORT}             ║
║  📚 API: http://localhost:${PORT}/api   ║
╚════════════════════════════════════════╝
    `);
  });
}

// ✅ এই line টা add করুন (Vercel এর জন্য)
module.exports = app;