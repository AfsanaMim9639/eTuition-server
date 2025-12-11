require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// MongoDB Connection
const connectDB = async () => {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ MongoDB Connected');
    }
  } catch (error) {
    console.error('❌ MongoDB Error:', error.message);
  }
};

connectDB();

// Root route
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: '✅ Tuition Management API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({
    status: 'success',
    message: 'API endpoint working'
  });
});

// Import routes - FIX PATHS (add ./src/)
let routesLoaded = false;
try {
  const authRoutes = require('./src/routes/authRoutes');
  const userRoutes = require('./src/routes/userRoutes');
  const tuitionRoutes = require('./src/routes/tuitionRoutes');
  const applicationRoutes = require('./src/routes/applicationRoutes');
  const paymentRoutes = require('./src/routes/paymentRoutes');
  const adminRoutes = require('./src/routes/adminRoutes');
  const studentRoutes = require('./src/routes/studentRoutes');

  // Use routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/tuitions', tuitionRoutes);
  app.use('/api/applications', applicationRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/student', studentRoutes);

  routesLoaded = true;
  console.log('✅ Routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading routes:', error.message);
  console.error(error.stack);
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.path,
    routesLoaded
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Vercel export
module.exports = app;

// Local development
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}