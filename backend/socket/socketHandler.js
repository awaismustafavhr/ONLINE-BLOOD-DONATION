const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Store active connections
const activeConnections = new Map();
const userRooms = new Map();

// Socket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
};

// Initialize socket handlers
const initializeSocket = (io) => {
  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.name} (${socket.userId}) connected`);
    
    // Store connection
    activeConnections.set(socket.userId, socket);
    userRooms.set(socket.userId, new Set());

    // Join user's personal room
    socket.join(`user-${socket.userId}`);
    userRooms.get(socket.userId).add(`user-${socket.userId}`);

    // Join role-based rooms
    socket.join(`role-${socket.user.role}`);
    userRooms.get(socket.userId).add(`role-${socket.user.role}`);

    // Join blood type room if user has blood type
    if (socket.user.bloodType) {
      socket.join(`blood-type-${socket.user.bloodType}`);
      userRooms.get(socket.userId).add(`blood-type-${socket.user.bloodType}`);
    }

    // Handle joining specific rooms
    socket.on('join-request-room', (requestId) => {
      socket.join(`request-${requestId}`);
      userRooms.get(socket.userId).add(`request-${requestId}`);
      console.log(`User ${socket.userId} joined request room: ${requestId}`);
    });

    socket.on('leave-request-room', (requestId) => {
      socket.leave(`request-${requestId}`);
      const userRoomSet = userRooms.get(socket.userId);
      if (userRoomSet) {
        userRoomSet.delete(`request-${requestId}`);
      }
      console.log(`User ${socket.userId} left request room: ${requestId}`);
    });

    // Handle blood request subscriptions
    socket.on('subscribe-blood-request', (requestId) => {
      socket.join(`blood-request-${requestId}`);
      userRooms.get(socket.userId).add(`blood-request-${requestId}`);
      console.log(`User ${socket.userId} subscribed to blood request: ${requestId}`);
    });

    socket.on('unsubscribe-blood-request', (requestId) => {
      socket.leave(`blood-request-${requestId}`);
      const userRoomSet = userRooms.get(socket.userId);
      if (userRoomSet) {
        userRoomSet.delete(`blood-request-${requestId}`);
      }
      console.log(`User ${socket.userId} unsubscribed from blood request: ${requestId}`);
    });

    // Handle donation subscriptions
    socket.on('subscribe-donation', (donationId) => {
      socket.join(`donation-${donationId}`);
      userRooms.get(socket.userId).add(`donation-${donationId}`);
      console.log(`User ${socket.userId} subscribed to donation: ${donationId}`);
    });

    socket.on('unsubscribe-donation', (donationId) => {
      socket.leave(`donation-${donationId}`);
      const userRoomSet = userRooms.get(socket.userId);
      if (userRoomSet) {
        userRoomSet.delete(`donation-${donationId}`);
      }
      console.log(`User ${socket.userId} unsubscribed from donation: ${donationId}`);
    });

    // Handle messaging
    socket.on('send-message', (data) => {
      const { roomId, message } = data;
      socket.to(roomId).emit('new-message', {
        from: socket.userId,
        fromName: socket.user.name,
        message,
        timestamp: new Date(),
      });
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      const { roomId, isTyping } = data;
      socket.to(roomId).emit('typing', {
        userId: socket.userId,
        userName: socket.user.name,
        isTyping,
      });
    });

    // Handle notification read status
    socket.on('mark-notification-read', (notificationId) => {
      // Emit to user's personal room
      socket.emit('notification-read', { notificationId });
    });

    socket.on('mark-all-notifications-read', () => {
      // Emit to user's personal room
      socket.emit('all-notifications-read');
    });

    // Handle location updates
    socket.on('update-location', (location) => {
      // Broadcast to nearby users or relevant rooms
      socket.to(`location-${socket.user.bloodType}`).emit('user-location-update', {
        userId: socket.userId,
        location,
        timestamp: new Date(),
      });
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`User ${socket.userId} disconnected: ${reason}`);
      activeConnections.delete(socket.userId);
      userRooms.delete(socket.userId);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  return io;
};

// Utility functions for emitting events
const emitToUser = (userId, event, data) => {
  const socket = activeConnections.get(userId);
  if (socket) {
    socket.emit(event, data);
  }
};

const emitToRoom = (roomId, event, data) => {
  io.to(roomId).emit(event, data);
};

const emitToRole = (role, event, data) => {
  io.to(`role-${role}`).emit(event, data);
};

const emitToBloodType = (bloodType, event, data) => {
  io.to(`blood-type-${bloodType}`).emit(event, data);
};

const emitToAll = (event, data) => {
  io.emit(event, data);
};

// Notification helpers
const sendNotification = (userId, notification) => {
  emitToUser(userId, 'new-notification', notification);
};

const sendBloodRequestUpdate = (requestId, update) => {
  emitToRoom(`blood-request-${requestId}`, 'blood-request-update', update);
};

const sendDonationUpdate = (donationId, update) => {
  emitToRoom(`donation-${donationId}`, 'donation-update', update);
};

const sendEmergencyAlert = (bloodType, message) => {
  emitToBloodType(bloodType, 'emergency-alert', {
    message,
    timestamp: new Date(),
    priority: 'critical',
  });
};

const sendSystemAnnouncement = (message, targetRole = null) => {
  if (targetRole) {
    emitToRole(targetRole, 'system-announcement', {
      message,
      timestamp: new Date(),
    });
  } else {
    emitToAll('system-announcement', {
      message,
      timestamp: new Date(),
    });
  }
};

// Get connection statistics
const getConnectionStats = () => {
  return {
    totalConnections: activeConnections.size,
    connectedUsers: Array.from(activeConnections.keys()),
    rooms: Array.from(userRooms.values()).reduce((acc, rooms) => {
      rooms.forEach(room => acc.add(room));
      return acc;
    }, new Set()).size,
  };
};

module.exports = {
  initializeSocket,
  emitToUser,
  emitToRoom,
  emitToRole,
  emitToBloodType,
  emitToAll,
  sendNotification,
  sendBloodRequestUpdate,
  sendDonationUpdate,
  sendEmergencyAlert,
  sendSystemAnnouncement,
  getConnectionStats,
};
