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

// Lightweight request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ✅ VERCEL-OPTIMIZED: MongoDB Connection
let cachedConnection = null;

const connectDB = async () => {
  // If already connected, reuse connection
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('♻️  Reusing existing MongoDB connection');
    return cachedConnection;
  }

  // If currently connecting, wait for it
  if (mongoose.connection.readyState === 2) {
    console.log('⏳ Connection in progress, waiting...');
    let attempts = 0;
    while (mongoose.connection.readyState === 2 && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    if (mongoose.connection.readyState === 1) {
      cachedConnection = mongoose.connection;
      return cachedConnection;
    }
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('❌ MONGODB_URI is not defined!');
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    
    // ✅ VERCEL OPTIMIZED: Fast connection settings
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,  // 5 seconds max
      socketTimeoutMS: 30000,
      connectTimeoutMS: 5000,
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 10000,
      family: 4,
      retryWrites: true,
      retryReads: true,
    });
    
    cachedConnection = mongoose.connection;
    console.log('✅ MongoDB Connected:', mongoose.connection.name);
    return cachedConnection;
    
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error.message);
    cachedConnection = null;
    throw error;
  }
};

// Connection event handlers
mongoose.connection.on('connected', () => {
  console.log('🟢 Mongoose connected');
});

mongoose.connection.on('error', (err) => {
  console.error('🔴 Mongoose error:', err.message);
  cachedConnection = null;
});

mongoose.connection.on('disconnected', () => {
  console.log('🟡 Mongoose disconnected');
  cachedConnection = null;
});

// Handle process termination
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error closing MongoDB:', err);
    process.exit(1);
  }
});

// ✅ CRITICAL: Ensure DB connection before each API request
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('❌ DB Connection failed:', error.message);
    return res.status(503).json({
      status: 'error',
      message: 'Database connection unavailable. Please try again.',
      code: 'DB_CONNECTION_FAILED'
    });
  }
});

// Initial connection (for local development)
if (process.env.NODE_ENV !== 'production') {
  connectDB().catch(err => console.error('Initial connection failed:', err));
}

// Health check
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

// Route loading
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
      
      app.use(config.path, (req, res) => {
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

// Debug endpoints
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

// Start server (only in local development)
if (require.main === module) {
  connectDB()
    .then(() => {
      server.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════╗
║   🚀 Server Running on ${PORT}        ║
║   MongoDB: Connected ✅                ║
║   Socket.io: Enabled ✅                ║
╚═══════════════════════════════════════╝
        `);
      });
    })
    .catch(err => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}