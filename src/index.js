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
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.set('io', io);

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

// ✅ IMPROVED: Lightweight request logging (no DB check in middleware)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ✅ IMPROVED: MongoDB Connection with better timeout handling
let isConnected = false;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;

const connectDB = async () => {
  // Check if already connected
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return true;
  }

  // Prevent multiple simultaneous connection attempts
  if (mongoose.connection.readyState === 2) {
    console.log('⏳ Connection already in progress...');
    // Wait for connection to complete
    await new Promise(resolve => {
      const checkConnection = setInterval(() => {
        if (mongoose.connection.readyState === 1) {
          clearInterval(checkConnection);
          resolve();
        }
      }, 100);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkConnection);
        resolve();
      }, 10000);
    });
    return mongoose.connection.readyState === 1;
  }

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined!');
    return false;
  }

  try {
    connectionAttempts++;
    console.log(`🔄 MongoDB connection attempt ${connectionAttempts}/${MAX_RETRY_ATTEMPTS}...`);
    
    // ✅ FIXED: Reduced timeouts for faster failure detection
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // ✅ Reduced from 30s to 10s
      socketTimeoutMS: 45000,           // ✅ Reduced from 75s to 45s
      connectTimeoutMS: 10000,          // ✅ Reduced from 30s to 10s
      maxPoolSize: 5,                   // ✅ Reduced from 10 to 5
      minPoolSize: 1,                   // ✅ Reduced from 2 to 1
      maxIdleTimeMS: 10000,             // ✅ Close idle connections after 10s
      family: 4,
      retryWrites: true,
      retryReads: true,
    });
    
    isConnected = true;
    connectionAttempts = 0;
    console.log('✅ MongoDB Connected Successfully!');
    console.log('🗄️  Database:', mongoose.connection.name);
    return true;
    
  } catch (error) {
    isConnected = false;
    console.error(`❌ MongoDB Connection Failed (attempt ${connectionAttempts}):`, error.message);
    
    // ✅ Auto-retry logic
    if (connectionAttempts < MAX_RETRY_ATTEMPTS) {
      console.log(`⏳ Retrying in 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return connectDB();
    }
    
    return false;
  }
};

// ✅ IMPROVED: Connection event handlers with auto-reconnect
mongoose.connection.on('connected', () => {
  isConnected = true;
  connectionAttempts = 0;
  console.log('🟢 Mongoose connected');
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  console.error('🔴 Mongoose error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log('🟡 Mongoose disconnected');
  
  // ✅ Auto-reconnect after disconnect
  if (connectionAttempts < MAX_RETRY_ATTEMPTS) {
    console.log('🔄 Attempting to reconnect...');
    setTimeout(() => connectDB(), 5000);
  }
});

// ✅ Handle process termination gracefully
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error closing MongoDB connection:', err);
    process.exit(1);
  }
});

// Initial connection
connectDB();

// ✅ IMPROVED: Health check with connection status
app.get('/', async (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({
    status: dbStatus === 1 ? 'success' : 'degraded',
    message: '✅ Tuition Management API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    mongodb: {
      status: dbStateMap[dbStatus],
      readyState: dbStatus,
      database: mongoose.connection.name || 'not connected'
    },
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
      schedules: '/api/schedules'
    }
  });
});

app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  res.json({
    status: dbStatus === 1 ? 'healthy' : 'unhealthy',
    mongodb: {
      connected: dbStatus === 1,
      readyState: dbStatus,
      name: mongoose.connection.name
    },
    socketio: 'enabled',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Enhanced route loading
const loadRoutes = () => {
  const loadedRoutes = [];
  const failedRoutes = [];

  console.log('\n📦 ============ ROUTE LOADING ============\n');
  
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
      const filePath = path.join(__dirname, config.file + '.js');
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      const routeHandler = require(config.file);
      app.use(config.path, routeHandler);
      
      loadedRoutes.push(config.name);
      console.log(`✅ ${config.name} loaded at ${config.path}`);
      
    } catch (error) {
      console.error(`❌ ${config.name} failed: ${error.message}`);
      
      failedRoutes.push({ 
        name: config.name, 
        path: config.path,
        error: error.message
      });
      
      // ✅ Fallback route with proper DB check
      app.use(config.path, async (req, res) => {
        // Check DB connection for this specific route
        if (mongoose.connection.readyState !== 1) {
          return res.status(503).json({
            status: 'error',
            message: 'Database connection unavailable',
            route: config.name,
            timestamp: new Date().toISOString()
          });
        }
        
        res.status(503).json({
          status: 'error',
          message: `${config.name} routes are temporarily unavailable`,
          timestamp: new Date().toISOString()
        });
      });
    }
  });
 
  console.log(`\n✅ Loaded: ${loadedRoutes.length} routes`);
  if (failedRoutes.length > 0) {
    console.log(`❌ Failed: ${failedRoutes.length} routes`);
  }
  console.log('='.repeat(50) + '\n');
  
  return { loadedRoutes, failedRoutes };
};

const routeStatus = loadRoutes();

// ✅ API-level DB check middleware (only for API routes)
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      status: 'error',
      message: 'Database connection temporarily unavailable',
      code: 'DB_DISCONNECTED',
      timestamp: new Date().toISOString()
    });
  }
  next();
});

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
    memory: process.memoryUsage(),
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

module.exports = app;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   🚀 Server Running on ${PORT}        ║
║   MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Connecting ⏳'} ║
║   Socket.io: Enabled ✅                ║
╚═══════════════════════════════════════╝
    `);
  });
}