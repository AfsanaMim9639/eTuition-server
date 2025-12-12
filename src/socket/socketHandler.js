const jwt = require('jsonwebtoken');

const socketHandler = (io) => {
  // Store connected users
  const connectedUsers = new Map();

  // Socket authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      
      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);
    
    // Store user socket
    connectedUsers.set(socket.userId, socket.id);
    
    // Join user to their own room
    socket.join(socket.userId);

    // Join conversation rooms
    socket.on('join-conversation', (conversationId) => {
      socket.join(conversationId);
      console.log(`User ${socket.userId} joined conversation: ${conversationId}`);
    });

    // Leave conversation room
    socket.on('leave-conversation', (conversationId) => {
      socket.leave(conversationId);
      console.log(`User ${socket.userId} left conversation: ${conversationId}`);
    });

    // Typing indicator
    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(conversationId).emit('user-typing', {
        userId: socket.userId,
        conversationId,
        isTyping
      });
    });

    // Mark message as read
    socket.on('mark-read', ({ conversationId, messageId }) => {
      socket.to(conversationId).emit('message-read', {
        userId: socket.userId,
        conversationId,
        messageId
      });
    });

    // Online status
    socket.on('update-status', (status) => {
      io.emit('user-status', {
        userId: socket.userId,
        status,
        timestamp: new Date()
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.userId}`);
      connectedUsers.delete(socket.userId);
      
      // Notify others that user went offline
      io.emit('user-status', {
        userId: socket.userId,
        status: 'offline',
        timestamp: new Date()
      });
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Helper function to emit to specific user
  io.emitToUser = (userId, event, data) => {
    const socketId = connectedUsers.get(userId);
    if (socketId) {
      io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  };

  // Helper function to check if user is online
  io.isUserOnline = (userId) => {
    return connectedUsers.has(userId);
  };

  console.log('🔌 Socket.io initialized');
};

module.exports = socketHandler;