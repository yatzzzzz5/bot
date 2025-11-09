import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

// Import configurations
import { connectDB, disconnectDB } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { setupSocket } from './config/socket';

// Import models (this ensures MongoDB collections are created)
import './models/User';
import './models/Portfolio';
import './models/Trade';
import './models/Signal';

// Import middleware
import { setupMiddleware } from './middleware';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { rateLimiter } from './middleware/rate-limiter';

// Import services
import { setupAIEngine } from './services/ai-engine';
import { setupTradingEngine } from './services/trading-engine';
import { LeverageTradingEngine } from './engines/leverage-trading-engine';
import { realTimeTradingService } from './services/real-time-trading-service';
import { guaranteedProfitEngine } from './services/guaranteed-profit-engine';

// Import new strategies
import { DailyProfitOptimizer, DailyProfitConfig } from './strategies/daily-profit-optimizer';
import { MomentumReversalBot, MomentumReversalConfig } from './strategies/momentum-reversal-bot';
import { TrendDetectionEngine } from './strategies/trend-detection-engine';

// Import new profit-focused strategies
import { RiskFreeArbitrageEngine } from './strategies/risk-free-arbitrage';
import { ScalpingStrategies, ScalpingConfig, MarketMakingConfig } from './strategies/scalping-strategies';
import { DeFiYieldStrategies, DeFiYieldConfig } from './strategies/defi-yield-strategies';
import { CompoundInterestOptimizer, CompoundInterestConfig } from './strategies/compound-interest-optimizer';
import { AutomatedProfitTaking, ProfitTakingConfig } from './strategies/automated-profit-taking';
import { Continuous24HourTrading, ContinuousTradingConfig } from './strategies/24-hour-continuous-trading';
import { MicroTradingEngine, MicroTradingConfig } from './strategies/micro-trading-engine';

// Import routes
import routes from './routes/index';

// Import cron jobs
import { setupCronJobs, setContinuousTrader, setMicroTrader } from './services/cron';

// Import logger
import { logger } from './utils/logger';

// Import order tracker
import { orderTracker } from './services/trading/real-time-order-tracker';

// Initialize Daily Profit Optimizer
const dailyProfitConfig: DailyProfitConfig = {
  startingCapital: 100, // $100 başlangıç
  dailyTarget: 0.5, // %50 günlük hedef (garantili kar için daha gerçekçi)
  maxRiskPerTrade: 0.1, // %10 risk per trade (çok düşük risk)
  maxDailyLoss: 0.1, // %10 max günlük kayıp (koruma)
  arbitrageEnabled: true, // Arbitraj açık (garantili)
  tradingEnabled: true,
  diversificationRequired: false // Tek coin focus
};

const dailyProfitOptimizer = new DailyProfitOptimizer(dailyProfitConfig);

// Initialize Momentum Reversal Bot
const momentumConfig: MomentumReversalConfig = {
  targetCoins: ['BTC', 'ETH', 'SOL', 'BNB', 'ADA'],
  dailyTargetMultiplier: 2.0, // 2x günlük hedef
  maxPositionsPerCoin: 3,
  quickProfitTarget: 1.5, // %1.5 hızlı kar hedefi
  stopLossPercentage: 2.0, // %2 stop loss
  maxDailyLoss: 5.0, // %5 max günlük kayıp
  trendDetectionSensitivity: 0.3,
  reversalDetectionThreshold: 3.0,
  executionSpeed: 'ULTRA_FAST'
};

const momentumBot = new MomentumReversalBot(momentumConfig);
const trendEngine = new TrendDetectionEngine();

// Initialize new profit-focused strategies
const riskFreeArbitrageEngine = new RiskFreeArbitrageEngine();

const scalpingConfig: ScalpingConfig = {
  profitTarget: 4.2, // %4.2 kar hedefi (hourly mini goal)
  stopLoss: 1.5,     // %1.5 stop loss (tight risk)
  frequency: 300,    // 5 dakikada bir check
  maxTrades: 288,    // 24 saat x 12 trade/hour = 288 max trades
  volume: 0,         // Dynamic volume based on available balance
  symbols: ['BTC/USDT', 'ETH/USDT'], // Focus on 2 major pairs
  minSpread: 0.05,   // %0.05 minimum spread
  maxSlippage: 0.5   // %0.5 maksimum slippage
};

const marketMakingConfig: MarketMakingConfig = {
  spread: 0.02,       // %0.02 spread
  volume: 1000,       // $1000 volume
  frequency: 30,      // 30 saniyede bir
  symbols: ['BTC', 'ETH', 'BNB', 'ADA', 'SOL'],
  minLiquidity: 10000, // $10000 minimum liquidity
  maxPosition: 5000   // $5000 maksimum pozisyon
};

const scalpingStrategies = new ScalpingStrategies(scalpingConfig, marketMakingConfig);

const defiYieldConfig: DeFiYieldConfig = {
  protocols: ['Uniswap', 'SushiSwap', 'PancakeSwap', 'Aave', 'Compound'],
  minAPY: 5,          // %5 minimum APY
  maxRisk: 'LOW',    // Düşük risk
  maxTVL: 10000000,   // $10M maksimum TVL
  minLiquidity: 100000, // $100K minimum liquidity
  maxSlippage: 1,     // %1 maksimum slippage
  autoCompound: true, // Otomatik compound
  rebalanceInterval: 24 // 24 saatte bir rebalance
};

const defiYieldStrategies = new DeFiYieldStrategies(defiYieldConfig);

const compoundInterestConfig: CompoundInterestConfig = {
  startingCapital: 100,     // $100 başlangıç
  dailyTarget: 100,         // %100 günlük hedef (2x)
  maxDailyLoss: 30,         // %30 maksimum günlük kayıp
  compoundFrequency: 'CONTINUOUS', // Sürekli compound for aggressive growth
  positionSizingMethod: 'MARTINGALE', // Agresif Martingale sizing
  maxPositionSize: 95,       // %95 maksimum pozisyon (aggressive)
  minPositionSize: 50,      // %50 minimum pozisyon
  riskFreeRate: 0.1,        // %0.1 risk-free rate
  targetVolatility: 25,     // %25 hedef volatilite (high volatility for 2x)
  maxDrawdown: 30,          // %30 maksatum drawdown (aggressive)
  profitTakingLevels: [50, 75, 90, 100], // Kar alma seviyeleri (%50, %75, %90, %100)
  stopLossLevels: [5, 10, 15] // Stop loss seviyeleri (%5, %10, %15)
};

const compoundInterestOptimizer = new CompoundInterestOptimizer(compoundInterestConfig);

const profitTakingConfig: ProfitTakingConfig = {
  enabled: true,
  strategies: [
    {
      name: 'Aggressive Profit Taking',
      type: 'FIXED_PERCENTAGE',
      enabled: true,
      parameters: {
        targetPercent: 50,     // %50 kar hedefi (2x için %50 profit)
        sellPercentage: 30,   // %30 sat (pozisyonun %30'u)
        stopLossPercent: 5     // %5 stop loss (aggressive)
      },
      priority: 8
    },
    {
      name: 'Trailing Stop Aggressive',
      type: 'TRAILING_STOP',
      enabled: true,
      parameters: {
        initialTarget: 25,    // %25 başlangıç hedefi
        trailingDistance: 10,  // %10 trailing distance
        stopLossPercent: 5     // %5 stop loss
      },
      priority: 9
    }
  ],
  maxPositions: 3,            // Max 3 pozisyon (focus strategy)
  minProfitPercent: 25,       // %25 minimum kar
  maxProfitPercent: 100,      // %100 maksimum kar (2x)
  trailingStopEnabled: true,
  partialProfitEnabled: true,
  compoundProfitEnabled: true
};

const automatedProfitTaking = new AutomatedProfitTaking(profitTakingConfig);

// Initialize 24-Hour Continuous Trading
const continuousTradingConfig: ContinuousTradingConfig = {
  hourlyProfitTarget: 4.2,     // %4.2 hourly (compound to ~170% daily)
  dailyProfitTarget: 100,      // %100 daily target (2x)
  stopLossPercentage: 1.5,      // %1.5 tight stops
  tradeFrequency: 'CONTINUOUS', // Every minute/hour
  symbols: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'], // Major pairs focus
  maxConcurrentTrades: 3,       // Max 3 concurrent
  emergencyStopLoss: 0.25,      // %25 max daily loss
  compoundFrequency: 'HOURLY'  // Compound every hour
};

const continuousTrader = new Continuous24HourTrading(continuousTradingConfig);

// Initialize MICRO-TRADING ENGINE - GÜNLÜK 2X İÇİN AI DESTEKLİ
// AI Decision Engine ile kesin karar verme + Arbitraj = Günlük 2x
const microTradingConfig: MicroTradingConfig = {
  startingCapital: 100,           // $100 başlangıç
  dailyTargetAmount: 100,         // $100 daily gain (2x total = %100)
  totalTradesPerDay: 1000,        // 1000 mikro-trade per day (AI ile hızlı karar)
  targetPerTrade: 0.1,            // $0.10 profit per trade (küçük ama çok fazla)
  maxLossPerTrade: 0.05,          // Max $0.05 loss per trade (çok düşük risk)
  allowedDailyLosses: 400,        // Allow 400 losing trades (60% win rate = 600 kazanç)
  symbols: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'ADA/USDT'], // Daha fazla coin
  minIntervalMs: 6000,            // 6 saniyede bir (çok hızlı tarama)
  makerFirst: true,               // Maker fee kullan (daha düşük fee)
  ladderLevels: 3,                // 3 seviyeli limit order
  ladderStepBps: 2,               // %0.02 step
  ladderEachPct: 0.34,            // Her seviyeye %34
  timeboxMs: 1000,                // 1 saniye max bekleme (hızlı execution)
  maxSpreadBps: 5,                // %0.05 max spread (çok tight)
  minDepthUsd: 500,               // $500 minimum depth
  maxNotionalUsd: 50,             // Max $50 per trade (küçük pozisyonlar)
  mlConfidenceThreshold: 0.85,    // %85 ML confidence gerekli (AI Decision Engine kullanır)
  cooldownLossStreak: 3,          // 3 kayıp sonrası cooldown
  cooldownMs: 30000,              // 30 saniye cooldown
  tradeCategories: {
    scalping: false,              // Scalping kapatıldı (risk var)
    arbitrage: true,              // ARBITRAGE AÇIK (garantili kar - öncelikli)
    momentUm: false,              // Momentum kapatıldı (AI Decision Engine kullanılacak)
    newsBased: false,             // News trading kapalı (AI Decision Engine içinde)
    patternBased: false           // Pattern trading kapalı (AI Decision Engine içinde)
    // AI DECISION ENGINE + ARBİTRAJ = GÜNLÜK 2X
  }
};

const microTrader = new MicroTradingEngine(microTradingConfig);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    logger.info('🚀 Starting Crypto Trading Bot Backend...');

    // Connect to databases
    logger.info('📊 Connecting to databases...');
    await connectDB();
    await connectRedis();
    logger.info('✅ Database connections established');

    // Setup middleware
    logger.info('🔧 Setting up middleware...');
    setupMiddleware(app);
    app.use(rateLimiter);
    logger.info('✅ Middleware configured');

    // Setup Socket.IO
    logger.info('🔌 Setting up Socket.IO...');
    setupSocket(io);
    logger.info('✅ Socket.IO configured');

    // Initialize Order Tracker
    logger.info('📊 Initializing Real-time Order Tracker...');
    orderTracker.initialize(io);
    logger.info('✅ Order Tracker initialized');

    // Setup AI and Trading engines
    logger.info('🧠 Initializing AI and Trading engines...');
    await setupAIEngine();
    await setupTradingEngine();
    logger.info('✅ AI and Trading engines initialized');
    logger.info('✅ Leverage Trading Engine initialized');

    // Setup Guaranteed Profit Engine (can be disabled)
    if (process.env.DISABLE_GUARANTEED_ENGINE === 'true') {
      logger.warn('⏸️ Guaranteed Profit Engine disabled by env (DISABLE_GUARANTEED_ENGINE=true)');
    } else {
      logger.info('🚀 Initializing Guaranteed Profit Engine...');
      await guaranteedProfitEngine.initialize();
      await guaranteedProfitEngine.start();
      logger.info('✅ Guaranteed Profit Engine initialized and started');
    }

    // Setup Real-Time Trading Service
    logger.info('🚀 Initializing Real-Time Trading Service...');
    await realTimeTradingService.start();
    logger.info('✅ Real-Time Trading Service started');

    // Setup Daily Profit Optimizer
    await dailyProfitOptimizer.initialize();

    // Setup Momentum Reversal Bot
    await momentumBot.initialize();
    await trendEngine.initialize();

    // Setup new profit-focused strategies
    logger.info('🚀 Initializing Risk-Free Arbitrage Engine...');
    await riskFreeArbitrageEngine.initialize();
    logger.info('✅ Risk-Free Arbitrage Engine initialized');

    logger.info('🚀 Initializing Scalping Strategies...');
    await scalpingStrategies.initialize();
    logger.info('✅ Scalping Strategies initialized');

    logger.info('🚀 Initializing DeFi Yield Strategies...');
    await defiYieldStrategies.initialize();
    logger.info('✅ DeFi Yield Strategies initialized');

    logger.info('🚀 Initializing Compound Interest Optimizer...');
    await compoundInterestOptimizer.initialize();
    logger.info('✅ Compound Interest Optimizer initialized');

    logger.info('🚀 Initializing Automated Profit Taking...');
    await automatedProfitTaking.initialize();
    logger.info('✅ Automated Profit Taking initialized');

    logger.info('🚀 Initializing 24-Hour Continuous Trading...');
    await continuousTrader.initialize();
    logger.info('✅ 24-Hour Continuous Trading initialized');

    logger.info('🚀 Initializing Micro-Trading Engine (100 trades = 2x)...');
    microTrader.setSocketIO(io); // Pass Socket.IO instance for real-time updates
    await microTrader.initialize();
    logger.info('✅ Micro-Trading Engine initialized');
    
    // Auto-start micro trading if enabled (default: true)
    const autoStartMicro = process.env.MICRO_AUTO_START !== 'false';
    if (autoStartMicro) {
      logger.info('🚀 Auto-starting Micro-Trading Engine...');
      try {
        await microTrader.start();
        logger.info('✅ Micro-Trading Engine started automatically');
      } catch (error) {
        logger.error('❌ Failed to auto-start Micro-Trading Engine:', error);
      }
    } else {
      logger.info('⏸️ Micro-Trading Engine auto-start disabled (MICRO_AUTO_START=false). Start manually via API.');
    }

    // Setup routes (with authentication middleware)
    logger.info('🛣️ Setting up API routes...');
    
    // Apply authentication to all routes except auth and health endpoints
    app.use('/api', (req, res, next) => {
      const path = req.path || '';
      const authExcludedPaths = ['/auth/login', '/auth/logout', '/auth/verify', '/health'];
      
      // Skip authentication for excluded paths
      if (authExcludedPaths.some(excludedPath => path === excludedPath || path.startsWith(excludedPath))) {
        return next();
      }
      
      // Import authenticate dynamically to avoid circular dependencies
      const { authenticate } = require('./middleware/auth');
      authenticate(req as any, res, next);
    });
    
    app.use('/api', routes);
    logger.info('✅ API routes configured');

    // Setup cron jobs
    logger.info('⏰ Setting up scheduled tasks...');
    setupCronJobs();
    setContinuousTrader(continuousTrader); // Pass continuous trader to cron jobs
    setMicroTrader(microTrader);           // Pass micro trader to cron jobs
    logger.info('✅ Scheduled tasks configured');

    // Error handling middleware (must be last)
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Start server
    server.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info(`🌐 API available at http://localhost:${PORT}/api`);
      logger.info(`🔌 WebSocket available at http://localhost:${PORT}`);
    });

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('🛑 Shutting down server...');
  
  try {
    // Stop real-time trading service
    await realTimeTradingService.stop();
    
    // Stop guaranteed profit engine
    await guaranteedProfitEngine.stop();
    
    // Close server
    server.close();
    
    // Disconnect from databases
    await disconnectDB();
    await disconnectRedis();
    
    logger.info('✅ Server shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown();
});

// Start the server
startServer();
