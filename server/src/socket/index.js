const jwt = require('jsonwebtoken');

function initSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join:workspace', (workspaceId) => {
      socket.join(`workspace:${workspaceId}`);
    });

    socket.on('leave:workspace', (workspaceId) => {
      socket.leave(`workspace:${workspaceId}`);
    });

    socket.on('join:project', (projectId) => {
      socket.join(`project:${projectId}`);
      socket.to(`project:${projectId}`).emit('user:joined', {
        userId: socket.user.userId,
        email: socket.user.email,
      });
    });

    socket.on('leave:project', (projectId) => {
      socket.leave(`project:${projectId}`);
      socket.to(`project:${projectId}`).emit('user:left', {
        userId: socket.user.userId,
      });
    });

    socket.on('disconnect', () => {
      // rooms are cleaned up automatically
    });
  });
}

module.exports = { initSocket };
