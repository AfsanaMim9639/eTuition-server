require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://etuitionbd-b9b1d.web.app',
      'https://etuitionbd-b9b1d.firebaseapp.com'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  }
});

// Make io available to routes
app.set('io', io);

// Initialize socket handler
const socketHandler = require('./socket/socketHandler');
socketHandler(io);

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
  
  if (mongoose.connection.readyState !== 1) {
    console.log('⚠️  DB not connected, attempting to connect...');
    await connectDB();
  }
  
  next();
});

// MongoDB Connection with caching for serverless
let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('♻️  Reusing existing MongoDB connection');
    return;
  }

  try {
    console.log('🔍 MongoDB Connection Debug Info:');
    console.log('- MONGODB_URI exists:', !!process.env.MONGODB_URI);
    
    if (!process.env.MONGODB_URI) {
      console.error('❌ CRITICAL: MONGODB_URI is not defined!');
      return;
    }

    console.log('🔄 Attempting MongoDB connection...');
    
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
    console.log('🗄️  Database:', mongoose.connection.name);
    
  } catch (error) {
    isConnected = false;
    console.error('❌ MongoDB Connection Failed:', error.message);
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log('🟢 Mongoose connected');
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  console.error('🔴 Mongoose error:', err);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log('🟡 Mongoose disconnected');
});

// Connect to MongoDB
connectDB();

// Root routes
app.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
  
  res.json({
    status: 'success',
    message: '✅ Tuition Management API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    socketio: '✅ enabled',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      tuitions: '/api/tuitions',
      applications: '/api/applications',
      payments: '/api/payments',
      admin: '/api/admin',
      student: '/api/student',
      conversations: '/api/conversations',
      messages: '/api/messages',
      notifications: '/api/notifications',
      reviews: '/api/reviews',
      schedules: '/api/schedules' // ✅ ADDED
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    socketio: 'enabled',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Enhanced route loading
const loadRoutes = () => {
  const loadedRoutes = [];
  const failedRoutes = [];

  console.log('\n📦 ============ ROUTE LOADING DIAGNOSTICS ============\n');
  
  const dirsToCheck = ['routes', 'controllers', 'models', 'middleware', 'socket', 'utils'];
  console.log('📁 Checking directory structure:');
  
  dirsToCheck.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    const exists = fs.existsSync(dirPath);
    console.log(`   ${exists ? '✅' : '❌'} ${dir}/ ${exists ? 'exists' : 'MISSING'}`);
    
    if (exists) {
      try {
        const files = fs.readdirSync(dirPath);
        console.log(`      Files: ${files.join(', ') || 'empty'}`);
      } catch (err) {
        console.log(`      Error reading: ${err.message}`);
      }
    }
  });

  console.log('\n🔧 Attempting to load routes:\n');
  
  const routeConfigs = [
    { path: '/api/auth', file: './routes/authRoutes', name: 'Auth' },
    { path: '/api/users', file: './routes/userRoutes', name: 'Users' },
    { path: '/api/tuitions', file: './routes/tuitionRoutes', name: 'Tuitions' },
    { path: '/api/applications', file: './routes/applicationRoutes', name: 'Applications' },
    { path: '/api/payments', file: './routes/paymentRoutes', name: 'Payments' },
    { path: '/api/admin', file: './routes/adminRoutes', name: 'Admin' },
    { path: '/api/student', file: './routes/studentRoutes', name: 'Student' },
    { path: '/api/conversations', file: './routes/conversationRoutes', name: 'Conversations' },
    { path: '/api/messages', file: './routes/messageRoutes', name: 'Messages' },
    { path: '/api/notifications', file: './routes/notificationRoutes', name: 'Notifications' },
    { path: '/api/reviews', file: './routes/reviewRoutes', name: 'Reviews' },
    { path: '/api/schedules', file: './routes/scheduleRoutes', name: 'Schedules' }
  ];

  routeConfigs.forEach(config => {
    try {
      console.log(`\n🔍 Loading ${config.name}:`);
      console.log(`   Path: ${config.path}`);
      console.log(`   File: ${config.file}`);
      
      const filePath = path.join(__dirname, config.file + '.js');
      const fileExists = fs.existsSync(filePath);
      console.log(`   File exists: ${fileExists ? '✅' : '❌'}`);
      
      if (!fileExists) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      const routeHandler = require(config.file);
      console.log(`   ✓ Required successfully`);
      console.log(`   ✓ Export type: ${typeof routeHandler}`);
      
      app.use(config.path, routeHandler);
      console.log(`   ✅ Mounted at ${config.path}`);
      
      loadedRoutes.push(config.name);
      
    } catch (error) {
      console.error(`   ❌ FAILED: ${error.message}`);
      console.error(`   Stack trace:`);
      console.error(error.stack);
      
      failedRoutes.push({ 
        name: config.name, 
        path: config.path,
        error: error.message,
        stack: error.stack
      });
      
      app.use(config.path, (req, res) => {
        res.status(503).json({
          status: 'error',
          message: `${config.name} routes are temporarily unavailable`,
          detail: process.env.NODE_ENV === 'development' ? error.message : 'Service unavailable',
          errorType: error.name,
          timestamp: new Date().toISOString()
        });
      });
    }
  });
 
  if (loadedRoutes.length > 0) {
    console.log(`\n✅ Successfully loaded: ${loadedRoutes.join(', ')}`);
  }
  
  if (failedRoutes.length > 0) {
    console.log(`\n❌ Failed to load: ${failedRoutes.map(r => r.name).join(', ')}`);
  }
  console.log('='.repeat(60) + '\n');
  
  return { loadedRoutes, failedRoutes };
};

// Load all routes
const routeStatus = loadRoutes();

// Enhanced route status endpoint
app.get('/api/routes-status', (req, res) => {
  res.json({
    status: 'success',
    loaded: routeStatus.loadedRoutes,
    failed: routeStatus.failedRoutes.map(r => ({
      name: r.name,
      path: r.path,
      error: r.error
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
      dbName: mongoose.connection.name || 'not connected'
    },
    socketio: {
      enabled: true,
      status: 'running'
    },
    routes: {
      loaded: routeStatus.loadedRoutes,
      failed: routeStatus.failedRoutes.map(r => ({
        name: r.name,
        error: r.error
      }))
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('💥 Error:', err.message);
  
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
  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   🚀 Server Running on ${PORT}        ║
║   MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Disconnected ❌'} ║
║   Socket.io: Enabled ✅                ║
║   Notifications: Enabled ✅            ║
║   Schedules: Enabled ✅                ║
╚═══════════════════════════════════════╝
    `);
  });
}