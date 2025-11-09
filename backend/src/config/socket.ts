import { Server } from 'socket.io';
import { logger } from '../utils/logger';

export function setupSocket(io: Server): void {
  logger.info('📡 Setting up Socket.IO...');

  io.on('connection', (socket) => {
    logger.info(`🔌 Client connected: ${socket.id}`);

    // Join trading room
    socket.on('join-trading', (symbol: string) => {
      socket.join(`trading:${symbol}`);
      logger.info(`📊 Client ${socket.id} joined trading room for ${symbol}`);
    });

    // Leave trading room
    socket.on('leave-trading', (symbol: string) => {
      socket.leave(`trading:${symbol}`);
      logger.info(`📊 Client ${socket.id} left trading room for ${symbol}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  logger.info('✅ Socket.IO setup completed');
}

// Helper functions for emitting events
export function emitTradeUpdate(io: Server, symbol: string, data: any): void {
  io.to(`trading:${symbol}`).emit('trade-update', data);
}

export function emitSignalUpdate(io: Server, symbol: string, data: any): void {
  io.to(`trading:${symbol}`).emit('signal-update', data);
}

export function emitPortfolioUpdate(io: Server, data: any): void {
  io.emit('portfolio-update', data);
}

export function emitSystemAlert(io: Server, data: any): void {
  io.emit('system-alert', data);
}
