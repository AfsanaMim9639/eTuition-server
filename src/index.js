// Dependencies
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// MongoDB Connection (with error handling)
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err.message));
}

// Health Check Route
app.get('/', (req, res) => {
  res.json({ 
    status: 'success',
    message: '✅ API is running!',
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

// Import and use routes (with try-catch)
try {
  // Routes
  const authRoutes = require('./routes/authRoutes');
  const userRoutes = require('./routes/userRoutes');
  const tuitionRoutes = require('./routes/tuitionRoutes');
  const applicationRoutes = require('./routes/applicationRoutes');
  const paymentRoutes = require('./routes/paymentRoutes');
  const adminRoutes = require('./routes/adminRoutes');
  const studentRoutes = require('./routes/studentRoutes');

  // Mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/tuitions', tuitionRoutes);
  app.use('/api/applications', applicationRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/student', studentRoutes);
  
  console.log('✅ All routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading routes:', error.message);
}

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.path
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
});

// Export for Vercel
module.exports = app;

// Local development only
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║  🚀 Server running on port ${PORT}      ║
╚════════════════════════════════════════╝
    `);
  });
}