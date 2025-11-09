import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.get('/api/v1', (req, res) => {
  res.json({
    message: 'Enterprise Crypto Bot API v1',
    endpoints: {
      trading: '/api/v1/trading',
      portfolio: '/api/v1/portfolio',
      analytics: '/api/v1/analytics',
      signals: '/api/v1/signals'
    }
  });
});

// Trading routes
app.get('/api/v1/trading/status', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Portfolio routes
app.get('/api/v1/portfolio', (req, res) => {
  res.json({
    totalValue: 100000,
    positions: [],
    timestamp: new Date().toISOString()
  });
});

// Analytics routes
app.get('/api/v1/analytics/performance', (req, res) => {
  res.json({
    totalReturn: 15.5,
    dailyReturn: 2.3,
    sharpeRatio: 1.8,
    timestamp: new Date().toISOString()
  });
});

// Signals routes
app.get('/api/v1/signals', (req, res) => {
  res.json({
    signals: [],
    timestamp: new Date().toISOString()
  });
});

// Socket.IO setup
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join-trading', (symbol: string) => {
    socket.join(`trading:${symbol}`);
    console.log(`Client ${socket.id} joined trading room for ${symbol}`);
  });

  socket.on('leave-trading', (symbol: string) => {
    socket.leave(`trading:${symbol}`);
    console.log(`Client ${socket.id} left trading room for ${symbol}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Enterprise Crypto Bot Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API: http://localhost:${PORT}/api/v1`);
});
