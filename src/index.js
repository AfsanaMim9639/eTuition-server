require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://etuitionbd-b9b1d.web.app',
    'https://etuitionbd-b9b1d.firebaseapp.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging and DB connection check
app.use(async (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  
  // Ensure DB connection before handling request
  if (mongoose.connection.readyState !== 1) {
    console.log('⚠️  DB not connected, attempting to connect...');
    await connectDB();
  }
  
  next();
});

// MongoDB Connection with caching for serverless
let isConnected = false;

const connectDB = async () => {
  // If already connected, reuse connection
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('♻️  Reusing existing MongoDB connection');
    return;
  }

  try {
    console.log('🔍 MongoDB Connection Debug Info:');
    console.log('- MONGODB_URI exists:', !!process.env.MONGODB_URI);
    console.log('- MONGODB_URI length:', process.env.MONGODB_URI?.length || 0);
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- Current readyState:', mongoose.connection.readyState);
    
    if (!process.env.MONGODB_URI) {
      console.error('❌ CRITICAL: MONGODB_URI is not defined in environment variables!');
      console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('MONGO')));
      return;
    }

    // Show first and last 10 characters for debugging (hide password)
    const uri = process.env.MONGODB_URI;
    console.log('- URI preview:', uri.substring(0, 20) + '...' + uri.substring(uri.length - 20));

    console.log('🔄 Attempting MongoDB connection...');
    
    // Disconnect if in connecting state
    if (mongoose.connection.readyState === 2) {
      console.log('⚠️  Detected stuck connection, disconnecting...');
      await mongoose.disconnect();
    }
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 75000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 2,
      family: 4,
      retryWrites: true,
      retryReads: true,
    });
    
    isConnected = true;
    
    console.log('✅ MongoDB Connected Successfully!');
    console.log('📊 Connection state:', mongoose.connection.readyState);
    console.log('🗄️  Database name:', mongoose.connection.name);
    console.log('🌐 Host:', conn.connection.host);
    
  } catch (error) {
    isConnected = false;
    console.error('❌ MongoDB Connection Failed!');
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);
    if (error.reason) {
      console.error('Error reason:', error.reason);
    }
    console.error('Full error:', JSON.stringify(error, null, 2));
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log('🟢 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  console.error('🔴 Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log('🟡 Mongoose disconnected from MongoDB');
});

// Connect to MongoDB
connectDB();

// Root routes
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: '✅ Tuition Management API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    mongoState: mongoose.connection.readyState,
    env: process.env.NODE_ENV || 'development',
    hasMongoUri: !!process.env.MONGODB_URI,
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      tuitions: '/api/tuitions',
      applications: '/api/applications',
      payments: '/api/payments',
      admin: '/api/admin',
      student: '/api/student'
    }
  });
});

app.get('/api', (req, res) => {
  res.json({
    status: 'success',
    message: 'API endpoint working',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    mongoReadyState: mongoose.connection.readyState,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    hasMongoUri: !!process.env.MONGODB_URI
  });
});

// Load routes with comprehensive error handling
const loadRoutes = () => {
  const loadedRoutes = [];
  const failedRoutes = [];

  try {
    console.log('📦 Loading routes...');
    
    const routeConfigs = [
      { path: '/api/auth', file: './routes/authRoutes', name: 'Auth' },
      { path: '/api/users', file: './routes/userRoutes', name: 'Users' },
      { path: '/api/tuitions', file: './routes/tuitionRoutes', name: 'Tuitions' },
      { path: '/api/applications', file: './routes/applicationRoutes', name: 'Applications' },
      { path: '/api/payments', file: './routes/paymentRoutes', name: 'Payments' },
      { path: '/api/admin', file: './routes/adminRoutes', name: 'Admin' },
      { path: '/api/student', file: './routes/studentRoutes', name: 'Student' }
    ];

    routeConfigs.forEach(config => {
      try {
        const routeHandler = require(config.file);
        app.use(config.path, routeHandler);
        loadedRoutes.push(config.name);
        console.log(`✅ Loaded: ${config.name} routes (${config.path})`);
      } catch (error) {
        failedRoutes.push({ 
          name: config.name, 
          path: config.path,
          error: error.message 
        });
        console.error(`❌ Failed to load ${config.name}:`, error.message);
        
        // Create fallback route for failed routes
        app.use(config.path, (req, res) => {
          res.status(503).json({
            status: 'error',
            message: `${config.name} routes are temporarily unavailable`,
            detail: process.env.NODE_ENV === 'development' ? error.message : 'Service unavailable'
          });
        });
      }
    });

    console.log(`\n✅ Route Loading Summary:`);
    console.log(`   Loaded: ${loadedRoutes.length}/${routeConfigs.length}`);
    console.log(`   Success: ${loadedRoutes.join(', ')}`);
    
    if (failedRoutes.length > 0) {
      console.log(`   Failed: ${failedRoutes.map(r => r.name).join(', ')}`);
    }
    
    return { loadedRoutes, failedRoutes };
  } catch (error) {
    console.error('❌ Critical error loading routes:', error);
    return { loadedRoutes: [], failedRoutes: [] };
  }
};

// Load all routes
const routeStatus = loadRoutes();

// Route status endpoint
app.get('/api/routes-status', (req, res) => {
  res.json({
    status: 'success',
    loaded: routeStatus.loadedRoutes,
    failed: routeStatus.failedRoutes.map(r => ({
      name: r.name,
      path: r.path
    })),
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint
app.get('/api/debug', (req, res) => {
  res.json({
    status: 'success',
    environment: process.env.NODE_ENV,
    mongodb: {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
      hasUri: !!process.env.MONGODB_URI,
      uriLength: process.env.MONGODB_URI?.length || 0,
      dbName: mongoose.connection.name || 'not connected'
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 404 handler - must be after all routes
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      'GET /',
      'GET /api',
      'GET /api/health',
      'GET /api/debug',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET /api/tuitions',
      'GET /api/users/tutors'
    ]
  });
});

// Global error handler - must be last
app.use((err, req, res, next) => {
  console.error('💥 Global Error Handler:');
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? {
      message: err.message,
      stack: err.stack
    } : undefined
  });
});

// Export for Vercel
module.exports = app;

// Local development server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   🚀 Tuition Server Running           ║
║   Port: ${PORT}                       ║
║   Environment: ${process.env.NODE_ENV || 'development'} ║
║   MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Disconnected ❌'} ║
╚═══════════════════════════════════════╝
    `);
  });
}