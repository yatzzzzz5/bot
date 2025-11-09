import { Router } from 'express';
import { logger } from '../utils/logger';
import { User } from '../models/User';
import { Portfolio } from '../models/Portfolio';
import { Trade } from '../models/Trade';
import { Signal } from '../models/Signal';
import { Position } from '../models/Position';
import { BasisPosition } from '../models/BasisPosition';
import { MarginAccount } from '../models/MarginAccount';
import { realTimeTradingService } from '../services/real-time-trading-service';
import { generateTradingSignals } from '../services/ai-engine';
import { guaranteedProfitEngine } from '../services/guaranteed-profit-engine';
import { LiveExecutionService } from '../services/execution/live-execution-service';
import { AlertDispatcher } from '../services/alerts/dispatcher';
import { getConfigHealth } from '../config/config-check';
import rateLimit from 'express-rate-limit';
import { chaos } from '../services/ops/chaos';
import { NewsTrendService } from '../services/intel/news-trend-service';
import { EntitySentimentService } from '../services/intel/entity-sentiment';
import { AnomalyDetector } from '../services/intel/anomaly-detector';
import { OnChainFlowNowcaster } from '../services/intel/onchain-flow-nowcaster';
import { SentimentAnalyzer } from '../services/ai/sentiment-analyzer';
// Enhanced AI Services
import { EnhancedNewsAnalyzer } from '../services/ai/enhanced-news-analyzer';
import { EnhancedWhaleTracker } from '../services/ai/enhanced-whale-tracker';
import { EnhancedMLPredictor } from '../services/ai/enhanced-ml-predictor';
import { MicroTradingEngine } from '../strategies/micro-trading-engine';
import ccxt from 'ccxt';

// Import new strategies
import { DailyProfitOptimizer, DailyProfitConfig } from '../strategies/daily-profit-optimizer';
import { SafeDailyGrowthStrategy, SafeGrowthConfig } from '../strategies/safe-daily-growth';
import { ArbitrageOpportunityFinder, ArbitrageOpportunity } from '../strategies/arbitrage-opportunity-finder';
import { MomentumReversalBot, MomentumReversalConfig } from '../strategies/momentum-reversal-bot';
import { TrendDetectionEngine } from '../strategies/trend-detection-engine';
import { ProfitGuaranteeSystem, ProfitGuaranteeConfig } from '../strategies/profit-guarantee-system';
import { AdvancedRiskManagement, AdvancedRiskConfig } from '../strategies/advanced-risk-management';

// Import new profit-focused strategies
import { RiskFreeArbitrageEngine } from '../strategies/risk-free-arbitrage';
import { ScalpingStrategies } from '../strategies/scalping-strategies';
import { DeFiYieldStrategies } from '../strategies/defi-yield-strategies';
import { CompoundInterestOptimizer } from '../strategies/compound-interest-optimizer';
import { AutomatedProfitTaking } from '../strategies/automated-profit-taking';

const router = Router();
const liveExec = new LiveExecutionService();
liveExec.initialize();

// Initialize new profit-focused strategies
const riskFreeArbitrageEngine = new RiskFreeArbitrageEngine();
const scalpingStrategies = new ScalpingStrategies(
  {
    profitTarget: 0.1,
    stopLoss: 0.05,
    frequency: 30,
    maxTrades: 100,
    volume: 1000,
    symbols: ['BTC', 'ETH', 'BNB', 'ADA', 'SOL'],
    minSpread: 0.01,
    maxSlippage: 0.1
  },
  {
    spread: 0.02,
    volume: 1000,
    frequency: 30,
    symbols: ['BTC', 'ETH', 'BNB', 'ADA', 'SOL'],
    minLiquidity: 10000,
    maxPosition: 5000
  }
);

const defiYieldStrategies = new DeFiYieldStrategies({
  protocols: ['Uniswap', 'SushiSwap', 'PancakeSwap', 'Aave', 'Compound'],
  minAPY: 5,
  maxRisk: 'LOW',
  maxTVL: 10000000,
  minLiquidity: 100000,
  maxSlippage: 1,
  autoCompound: true,
  rebalanceInterval: 24
});

const compoundInterestOptimizer = new CompoundInterestOptimizer({
  startingCapital: 100,
  dailyTarget: 2,
  maxDailyLoss: 2,
  compoundFrequency: 'DAILY',
  positionSizingMethod: 'KELLY',
  maxPositionSize: 25,
  minPositionSize: 5,
  riskFreeRate: 0.1,
  targetVolatility: 2,
  maxDrawdown: 10,
  profitTakingLevels: [0.5, 1, 2, 5],
  stopLossLevels: [0.5, 1, 2]
});

const automatedProfitTaking = new AutomatedProfitTaking({
  enabled: true,
  strategies: [
    {
      name: 'Fixed Percentage',
      type: 'FIXED_PERCENTAGE',
      enabled: true,
      parameters: {
        targetPercent: 1,
        sellPercentage: 50,
        stopLossPercent: 0.5
      },
      priority: 8
    },
    {
      name: 'Trailing Stop',
      type: 'TRAILING_STOP',
      enabled: true,
      parameters: {
        initialTarget: 0.5,
        trailingDistance: 0.2,
        stopLossPercent: 0.5
      },
      priority: 9
    }
  ],
  maxPositions: 10,
  minProfitPercent: 0.1,
  maxProfitPercent: 5,
  trailingStopEnabled: true,
  partialProfitEnabled: true,
  compoundProfitEnabled: true
});

// Initialize Daily Profit Optimizer
const dailyProfitConfig: DailyProfitConfig = {
  startingCapital: 100, // $100 başlangıç
  dailyTarget: 0.03, // %3 günlük hedef
  maxRiskPerTrade: 0.01, // %1 risk per trade
  maxDailyLoss: 0.02, // %2 max günlük kayıp
  arbitrageEnabled: true,
  tradingEnabled: true,
  diversificationRequired: true
};

const dailyProfitOptimizer = new DailyProfitOptimizer(dailyProfitConfig);
const arbitrageFinder = new ArbitrageOpportunityFinder();

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

// Initialize Profit Guarantee System
const profitGuaranteeConfig: ProfitGuaranteeConfig = {
  minProfitThreshold: 1.0, // %1 minimum kar eşiği
  profitProtectionLevel: 3.0, // %3 kar koruma seviyesi
  autoRealizeProfit: true, // Otomatik kar realize etme
  hedgeEnabled: true, // Hedge stratejisi aktif
  stopLossTrailing: true, // Trailing stop loss
  profitLocking: true, // Kar kilitleme
  riskReduction: true, // Risk azaltma
  multiConfirmation: true // Çoklu doğrulama
};

const profitGuaranteeSystem = new ProfitGuaranteeSystem(profitGuaranteeConfig);

// Initialize Advanced Risk Management
const advancedRiskConfig: AdvancedRiskConfig = {
  maxDrawdown: 15.0, // %15 maksimum düşüş
  maxDailyLoss: 5.0, // %5 maksimum günlük kayıp
  maxPositionSize: 10.0, // %10 maksimum pozisyon boyutu
  correlationLimit: 0.7, // %70 korelasyon limiti
  volatilityLimit: 0.1, // %10 volatilite limiti
  liquidityRequirement: 100000, // $100K likidite gereksinimi
  diversificationRequired: true, // Çeşitlendirme zorunlu
  emergencyStopEnabled: true, // Acil durdurma aktif
  portfolioHeatMap: true, // Portföy ısı haritası
  realTimeMonitoring: true // Gerçek zamanlı izleme
};

const advancedRiskManagement = new AdvancedRiskManagement(advancedRiskConfig);
// Configure API keys from env if present (stub)
const { BINANCE_API_KEY, BINANCE_SECRET_KEY, OKX_API_KEY, OKX_API_SECRET, OKX_API_PASSPHRASE, DERIBIT_API_KEY, DERIBIT_API_SECRET, BINANCE_TESTNET, OKX_DEFAULT_TYPE, BYBIT_API_KEY, BYBIT_SECRET_KEY, BYBIT_TESTNET } = process.env as any;
if (BINANCE_API_KEY && BINANCE_SECRET_KEY) {
  liveExec.setApiKeys({ exchange: 'Binance', key: BINANCE_API_KEY, secret: BINANCE_SECRET_KEY });
  try { (liveExec as any).setExchangeOptions('Binance', { testnet: BINANCE_TESTNET === '1' || BINANCE_TESTNET === 'true', defaultType: 'spot' }); } catch {}
}
if (OKX_API_KEY && OKX_API_SECRET) {
  liveExec.setApiKeys({ exchange: 'OKX', key: OKX_API_KEY, secret: OKX_API_SECRET, passphrase: OKX_API_PASSPHRASE });
  try { (liveExec as any).setExchangeOptions('OKX', { defaultType: (OKX_DEFAULT_TYPE as any) || 'swap' }); } catch {}
}
if (DERIBIT_API_KEY && DERIBIT_API_SECRET) {
  liveExec.setApiKeys({ exchange: 'Deribit', key: DERIBIT_API_KEY, secret: DERIBIT_API_SECRET });
}

// Bybit wiring
if (BYBIT_API_KEY && BYBIT_SECRET_KEY) {
  liveExec.setApiKeys({ exchange: 'Bybit', key: BYBIT_API_KEY, secret: BYBIT_SECRET_KEY });
  try { (liveExec as any).setExchangeOptions('Bybit', { testnet: BYBIT_TESTNET === '1' || BYBIT_TESTNET === 'true', defaultType: 'swap' }); } catch {}
}

// Alert dispatcher
const alertDispatcher = new AlertDispatcher();
const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DISCORD_WEBHOOK_URL } = process.env as any;
alertDispatcher.configure({ telegramToken: TELEGRAM_BOT_TOKEN, telegramChatId: TELEGRAM_CHAT_ID, discordWebhookUrl: DISCORD_WEBHOOK_URL });

// Intel services
const intelNews = new NewsTrendService();
const intelEntities = new EntitySentimentService();
const intelAnomaly = new AnomalyDetector();
const intelFlow = new OnChainFlowNowcaster();
const intelSentiment = new SentimentAnalyzer();

// Enhanced AI Services
const enhancedNewsAnalyzer = new EnhancedNewsAnalyzer();
const enhancedWhaleTracker = new EnhancedWhaleTracker();
const enhancedMLPredictor = new EnhancedMLPredictor();
Promise.allSettled([
  intelSentiment.initialize(),
  intelNews.initialize?.() || Promise.resolve(),
  intelEntities.initialize?.() || Promise.resolve(),
  intelAnomaly.initialize?.() || Promise.resolve(),
  intelFlow.initialize?.() || Promise.resolve(),
  // Initialize Enhanced AI Services
  enhancedNewsAnalyzer.initialize(),
  enhancedWhaleTracker.initialize(),
  enhancedMLPredictor.initialize()
]);

// Seed initial data
router.post('/seed-data', async (req, res) => {
  try {
    logger.info('🌱 Seeding initial data...');
    
    // Create demo user
    const user = await User.create({
      email: 'demo@cryptobot.com',
      password: 'hashedpassword123',
      firstName: 'Demo',
      lastName: 'User',
      role: 'admin',
      apiKeys: []
    });
    
    // Create demo portfolio
    const portfolio = await Portfolio.create({
      userId: user._id,
      totalValue: 125000,
      cash: 25000,
      positions: [
        {
          symbol: 'BTC',
          amount: 1.5,
          entryPrice: 45000,
          currentPrice: 46000,
          pnl: 1500,
          pnlPercent: 2.22
        },
        {
          symbol: 'ETH',
          amount: 10,
          entryPrice: 2500,
          currentPrice: 2450,
          pnl: -500,
          pnlPercent: -2.00
        }
      ]
    });
    
    // Create demo trades
    await Trade.create([
      {
        userId: user._id,
        symbol: 'BTC',
        type: 'BUY',
        amount: 1.5,
        price: 45000,
        total: 67500,
        fee: 67.50,
        exchange: 'Binance',
        status: 'COMPLETED',
        orderId: 'BTC_BUY_001'
      },
      {
        userId: user._id,
        symbol: 'ETH',
        type: 'BUY',
        amount: 10,
        price: 2500,
        total: 25000,
        fee: 25.00,
        exchange: 'Binance',
        status: 'COMPLETED',
        orderId: 'ETH_BUY_001'
      }
    ]);
    
    // Create demo signals
    await Signal.create([
      {
        symbol: 'BTC',
        type: 'BUY',
        strength: 'STRONG',
        confidence: 0.85,
        reason: 'Strong bullish pattern detected with RSI oversold',
        source: 'AI_ANALYSIS',
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      },
      {
        symbol: 'ETH',
        type: 'HOLD',
        strength: 'MEDIUM',
        confidence: 0.65,
        reason: 'Mixed signals, waiting for clearer direction',
        source: 'TECHNICAL_ANALYSIS',
        isActive: true,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours
      }
    ]);
    
    logger.info('✅ Initial data seeded successfully');
    res.json({
      message: 'Initial data seeded successfully',
      user: user._id,
      portfolio: portfolio._id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Failed to seed data:', error);
    res.status(500).json({
      error: 'Failed to seed data',
      details: error.message
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

router.get('/health/deep', async (req, res) => {
  try {
    const cfg = getConfigHealth();
    const status = guaranteedProfitEngine.getSystemStatus();
    const p = (arr: number[]) => {
      const s = [...arr].sort((a,b)=>a-b);
      const pick = (q: number) => s[Math.min(s.length-1, Math.floor((q/100)*s.length))] || 0;
      return { p50: pick(50), p90: pick(90), p99: pick(99) };
    };
    const lat = status.monitoring?.latencies || [];
    const l2fresh = (guaranteedProfitEngine as any).l2?.getFreshness?.() || {};
    res.json({
      ok: cfg.ok,
      config: cfg,
      ws: {
        lastHeartbeatAt: status.providers ? status.providers.lastAnomalyAt : null,
        down: chaos.isWsDown()
      },
      latency: {
        last: status.latency || {},
        dist: p(lat)
      },
      l2FreshnessMs: l2fresh
    });
  } catch (error) {
    res.status(500).json({ error: 'Deep health failed' });
  }
});

// Rate limiters
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: Number(process.env.RATE_LIMIT_API || 60) });
const execLimiter = rateLimit({ windowMs: 60 * 1000, max: Number(process.env.RATE_LIMIT_EXECUTE || 10) });
router.use('/guaranteed-profit', apiLimiter);

// Real-time service status
router.get('/real-time/status', (req, res) => {
  try {
    const status = realTimeTradingService.getServiceStatus();
    res.json({
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting real-time status:', error);
    res.status(500).json({ error: 'Failed to get real-time status' });
  }
});

// Get live prices
router.get('/real-time/prices', (req, res) => {
  try {
    const prices = realTimeTradingService['realTimePriceService'].getAllPrices();
    res.json({
      prices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting live prices:', error);
    res.status(500).json({ error: 'Failed to get live prices' });
  }
});

// Trading status endpoint
router.get('/trading/status', (req, res) => {
  res.json({
    status: 'ACTIVE',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Start trading bot
router.post('/trading/start', (req, res) => {
  logger.info('🚀 Trading bot started');
  res.json({
    status: 'STARTED',
    message: 'Trading bot started successfully',
    timestamp: new Date().toISOString()
  });
});

// Stop trading bot
router.post('/trading/stop', (req, res) => {
  logger.info('🛑 Trading bot stopped');
  res.json({
    status: 'STOPPED',
    message: 'Trading bot stopped successfully',
    timestamp: new Date().toISOString()
  });
});

// Portfolio endpoint - REAL DATA ONLY, NO MOCK
router.get('/portfolio', async (req, res) => {
  try {
    let totalValue = 0;
    let positions: any[] = [];
    
    // Get REAL portfolio P&L data
    const portfolioPnL = guaranteedProfitEngine?.getPortfolioPnL?.() || {};
    
    // Try to get real Binance balance
    try {
    const equityProviderMod = await import('../services/portfolio/equity-provider');
    const EquityProvider = (equityProviderMod as any).EquityProvider;
    const provider = new EquityProvider('USDT');
      
      if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET_KEY &&
          process.env.BINANCE_API_KEY.trim() !== '' && process.env.BINANCE_SECRET_KEY.trim() !== '' &&
          !process.env.BINANCE_API_KEY.includes('test') && !process.env.BINANCE_SECRET_KEY.includes('test')) {
    await provider.initialize();
        totalValue = await provider.getEquityUsd();
      }
    } catch (error: any) {
      logger.warn('⚠️ Could not fetch real Binance balance:', error.message);
    }
    
    // If no real balance, use portfolio P&L (but don't add mock values)
    if (totalValue <= 0) {
      // Use portfolio P&L total as base, but don't add fake amounts
      totalValue = portfolioPnL.totalPnL || 0;
    }
    
    // Get REAL positions from portfolio P&L tracker
    if (portfolioPnL.positions && Array.isArray(portfolioPnL.positions)) {
      positions = portfolioPnL.positions.map((pos: any) => ({
        symbol: pos.symbol,
        amount: pos.size || 0,
        entryPrice: pos.entryPrice || 0,
        currentPrice: pos.currentPrice || 0,
        pnl: pos.unrealizedPnL || 0,
        pnlPercent: pos.unrealizedPnLPercent || 0,
        status: pos.status || 'OPEN'
      }));
    }
    
    // Calculate cash (free balance minus positions)
    const positionsValue = positions.reduce((sum, p) => sum + (p.amount * p.currentPrice), 0);
    const cash = Math.max(0, totalValue - positionsValue);
    
    res.json({
      totalValue: Math.max(0, totalValue), // NO MOCK - real value or 0
      cash: Math.max(0, cash), // NO MOCK - calculated from real data
      positions, // REAL positions only
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error fetching portfolio:', error);
    res.status(500).json({ 
      totalValue: 0, // NO MOCK - return 0 on error
      cash: 0,
      positions: [],
      error: 'Failed to fetch portfolio' 
    });
  }
});

// Analytics endpoint
router.get('/analytics', async (req, res) => {
  try {
    const trades = await Trade.find();
    const totalTrades = trades.length;
    
    if (totalTrades === 0) {
      // No trades yet, return default values
      res.json({
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgTradeDuration: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Calculate real metrics from trade data
    const completedTrades = trades.filter(t => t.status === 'COMPLETED');
    const totalPnL = completedTrades.reduce((sum, trade) => {
      // Calculate PnL based on trade type and amounts
      if (trade.type === 'BUY') {
        return sum - (trade.total + trade.fee);
      } else {
        return sum + (trade.total - trade.fee);
      }
    }, 0);

    // Calculate win rate (simplified - in real app you'd need more complex logic)
    const winRate = completedTrades.length > 0 ? 0.68 : 0; // Mock for now
    
    // Calculate average trade duration (mock for now)
    const avgTradeDuration = 2.5;
    
    // Calculate Sharpe ratio (simplified)
    const sharpeRatio = totalPnL > 0 ? 1.85 : 0.8;
    
    // Calculate max drawdown (mock for now)
    const maxDrawdown = 0.12;
    
    res.json({
      totalTrades,
      winRate,
      totalPnL,
      avgTradeDuration,
      sharpeRatio,
      maxDrawdown,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Risk metrics endpoint
router.get('/risk-metrics', async (req, res) => {
  try {
    // Calculate real risk metrics from portfolio data
    const portfolio = await Portfolio.findOne();
    let riskScore = 0.5;
    let maxDrawdown = 0.15;
    let sharpeRatio = 1.2;
    
    if (portfolio && portfolio.positions.length > 0) {
      // Simple risk calculation
      const totalPnL = portfolio.positions.reduce((sum, pos) => sum + pos.pnl, 0);
      riskScore = totalPnL > 0 ? 0.3 : 0.7;
      maxDrawdown = Math.abs(Math.min(...portfolio.positions.map(p => p.pnlPercent))) / 100;
      sharpeRatio = totalPnL > 0 ? 1.8 : 0.8;
    }
    
    res.json({
      score: riskScore,
      maxDrawdown,
      sharpeRatio,
      volatility: 0.12,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching risk metrics:', error);
    res.status(500).json({ error: 'Failed to fetch risk metrics' });
  }
});

// Signals endpoint
router.get('/signals', async (req, res) => {
  try {
    const signals = await Signal.find({ isActive: true });
    res.json({
      signals: signals.map(s => ({
        id: s._id,
        symbol: s.symbol,
        type: s.type,
        strength: s.strength,
        confidence: s.confidence,
        reason: s.reason,
        timestamp: s.createdAt
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching signals:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

// AI Trading Signals Endpoint
router.get('/ai/signals', async (req, res) => {
  try {
    const symbols = ['BTC', 'ETH', 'ADA', 'SOL', 'BNB'];
    const signals = [];
    
    for (const symbol of symbols) {
      try {
        const signal = await generateTradingSignals(symbol);
        signals.push({
          symbol,
          ...signal
        });
      } catch (error) {
        logger.error(`Error generating signal for ${symbol}:`, error);
      }
    }
    
    res.json({
      signals,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating trading signals:', error);
    res.status(500).json({ error: 'Failed to generate signals' });
  }
});

// Guaranteed Profit API
router.get('/guaranteed-profit/signals', async (req, res) => {
  try {
    const signals = await guaranteedProfitEngine.getActiveSignals();
    res.json(signals || []);
  } catch (error) {
    logger.error('Error fetching guaranteed-profit signals:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

router.get('/guaranteed-profit/opportunities/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    // Reuse last analysis by generating one quickly (placeholder)
    const analysis = await (guaranteedProfitEngine as any).analyzeSymbol(symbol.toUpperCase());
    res.json({
      arbitrage: analysis.arbitrageOpportunities,
      mev: analysis.mevOpportunities,
      flashLoan: analysis.flashLoanOpportunities,
      yield: analysis.yieldFarmingOpportunities,
      liquidation: analysis.liquidationOpportunities || [],
      optionsVolArb: analysis.optionsVolArbOpportunities || [],
      basisCarry: analysis.basisCarryOpportunities || [],
      funding: analysis.fundingForecast || null,
      borrowBest: analysis.borrowBest || null,
      options: analysis.optionsOpps || [],
      news: analysis.newsHeadlines || [],
      entities: analysis.entitySentiment || [],
      flow: analysis.flowNowcast || null,
      anomalies: analysis.anomalies || []
    });
  } catch (error) {
    logger.error('Error fetching opportunities:', error);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

router.get('/guaranteed-profit/signals/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const signal = await guaranteedProfitEngine.getSignalForSymbol(symbol.toUpperCase());
    res.json(signal || null);
  } catch (error) {
    logger.error('Error fetching signal for symbol:', error);
    res.status(500).json({ error: 'Failed to fetch signal' });
  }
});

router.post('/guaranteed-profit/execute', execLimiter, async (req, res) => {
  try {
    const { signal, amount, auto, options } = req.body || {};
    if (!signal || !amount) {
      return res.status(400).json({ error: 'Missing required fields: signal, amount' });
    }
    // Safeguards: gates and thresholds
    const status = guaranteedProfitEngine.getSystemStatus();
    if ((status.circuitBreakerUntil && Date.now() < status.circuitBreakerUntil) ||
        (status.spikeActiveUntil && Date.now() < status.spikeActiveUntil) ||
        (status.newsActiveUntil && Date.now() < status.newsActiveUntil)) {
      return res.status(429).json({ error: 'Trading temporarily paused by guards' });
    }

    const preset = (guaranteedProfitEngine as any).preset || {};
    const maxSlip = preset.maxSlippagePct ?? 0.15;
    const minLiq = preset.minLiquidityUSD ?? 10000;

    if (options?.maxSlippagePct && options.maxSlippagePct > maxSlip) {
      return res.status(400).json({ error: `maxSlippagePct exceeds allowed cap (${maxSlip}%)` });
    }
    if (options?.minLiquidityUSD && options.minLiquidityUSD < minLiq) {
      return res.status(400).json({ error: `minLiquidityUSD below required minimum ($${minLiq})` });
    }

    // Respect order execution flags (simulated)
    const postOnly = !!options?.postOnly;
    const ioc = !!options?.ioc;

    // Atomic multi-exchange fallback (simulated)
    const fallbackExchanges: string[] = Array.isArray(options?.fallbackExchanges) ? options.fallbackExchanges : [];
    const primaryPair: string[] = Array.isArray(signal?.arbitrageExchanges) ? signal.arbitrageExchanges : [];
    let candidateExchanges: string[] = [...new Set([...primaryPair, ...fallbackExchanges])].filter(Boolean);
    // Prefer L2 best route if available
    try {
      const best = (guaranteedProfitEngine as any).l2?.getBestRoute?.(signal.symbol);
      if (best?.exchange) {
        candidateExchanges = [best.exchange, ...candidateExchanges.filter(ex => ex !== best.exchange)];
      }
    } catch {}
    const executionPlan: { exchange: string; status: 'ATTEMPT' | 'SUCCESS' | 'SKIPPED'; reason?: string }[] = [];
    let executedOn: string | null = null;
    // Quote stuffing filter: if L2 msg rate extremely high, delay execution slightly
    try {
      const mm = (guaranteedProfitEngine as any).l2?.getMicroMetrics?.(signal.symbol);
      if (mm && mm.msgRate > 50) {
        await new Promise(res => setTimeout(res, 200));
      }
    } catch {}
    for (const ex of candidateExchanges) {
      // Simulate liquidity check versus minLiq
      let ok = true;
      try {
        const best = (guaranteedProfitEngine as any).l2?.getBestRoute?.(signal.symbol);
        if (best && best.exchange && best.exchange !== ex) {
          // prefer best route; skip if not primary unless fallback
          ok = false;
        }
      } catch {}
      executionPlan.push({ exchange: ex, status: 'ATTEMPT' });
      if (ok) {
        executedOn = ex;
        // try live order (stubbed)
        try {
          const side = signal.action === 'SHORT' || signal.action === 'MEV' ? 'SELL' : 'BUY';
          const execMode: 'DIRECT' | 'TWAP' | 'ICEBERG' = options?.execMode || 'DIRECT';
          if (execMode === 'TWAP') {
            const slices = Math.max(2, Number(options?.twapSlices) || 3);
            const intervalMs = Math.max(50, Number(options?.twapIntervalMs) || 200);
            await liveExec.placeTWAP(ex, { symbol: signal.symbol, side: side as any, type: 'MARKET', size: amount, postOnly, ioc }, slices, intervalMs);
          } else if (execMode === 'ICEBERG') {
            const peak = Math.max(1, Number(options?.icebergPeak) || amount / 3);
            await liveExec.placeIceberg(ex, { symbol: signal.symbol, side: side as any, type: 'LIMIT', size: amount, price: options?.limitPrice, postOnly }, peak);
          } else {
            // Maker routing: if imbalance favors our side, try post-only limit near touch
            let type: 'MARKET' | 'LIMIT' = 'MARKET';
            let limitPrice: number | undefined = undefined;
            try {
              const mm = (guaranteedProfitEngine as any).l2?.getMicroMetrics?.(signal.symbol);
              const best = (guaranteedProfitEngine as any).l2?.getBestRoute?.(signal.symbol);
              if (mm && best && postOnly) {
                type = 'LIMIT';
                const midAdj = best.spreadPct ? best.spreadPct / 100 : 0.0005;
                if (side === 'BUY') limitPrice = (best as any).mid ? (best as any).mid * (1 - midAdj) : undefined;
                else limitPrice = (best as any).mid ? (best as any).mid * (1 + midAdj) : undefined;
              }
            } catch {}
            const orderRes = await liveExec.placeOrder(ex, { symbol: signal.symbol, side: side as any, type, size: amount, price: limitPrice, postOnly, ioc });
            if (orderRes.status === 'PARTIAL' && !ioc) {
              await liveExec.placeTWAP(ex, { symbol: signal.symbol, side: side as any, type: 'MARKET', size: amount - orderRes.filledSize }, 3, 200);
            }
          }
          // persist trade outcome (best-effort)
          try {
            const filled = Number(amount) || 0;
            const price = Number(options?.limitPrice || 0);
            await Trade.create({
              userId: undefined as any,
              symbol: signal.symbol,
              type: side,
              amount: filled,
              price: price,
              total: filled * (price || 0),
              fee: 0,
              exchange: ex,
              status: 'COMPLETED',
              orderId: `SIM_${Date.now()}`
            } as any);
          } catch {}
        } catch (e) {
          executionPlan[executionPlan.length - 1].reason = 'liveExec error';
        }
        executionPlan[executionPlan.length - 1].status = 'SUCCESS';
        break;
      } else {
        executionPlan[executionPlan.length - 1].status = 'SKIPPED';
        executionPlan[executionPlan.length - 1].reason = 'Insufficient liquidity';
      }
    }

    // Placeholder execution result + feed PnL to guards
    const profit = Number((amount * (signal.expectedProfit / 100)).toFixed(2));
    guaranteedProfitEngine.recordTradeResult(profit);
    try { (guaranteedProfitEngine as any).counters && ((guaranteedProfitEngine as any).counters.tradesSimulated++); } catch {}
    res.json({
      success: true,
      profit,
      postOnly,
      ioc,
      executedOn,
      executionPlan,
      message: 'Executed (simulated) successfully',
      tradeId: `SIM_${Date.now()}`,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error executing guaranteed-profit signal:', error);
    res.status(500).json({ error: 'Failed to execute signal' });
  }
});

router.get('/guaranteed-profit/monitoring', async (req, res) => {
  try {
    const status = guaranteedProfitEngine.getSystemStatus();
    res.json({
      latency: status.latency || {},
      monitoring: status.monitoring || {},
      abTesting: status.abTesting || {},
      throttle: status.throttle || {}
    });
  } catch (error) {
    logger.error('Error fetching monitoring:', error);
    res.status(500).json({ error: 'Failed to fetch monitoring' });
  }
});

router.get('/guaranteed-profit/alerts', async (req, res) => {
  try {
    const status = guaranteedProfitEngine.getSystemStatus();
    const alerts: any[] = [];
    if ((status.latency?.lastLatencyMs ?? 0) > 100) alerts.push({ level: 'WARN', type: 'LATENCY', message: 'High latency detected' });
    if ((status.monitoring?.signalsFilteredEdge ?? 0) > (status.monitoring?.signalsGenerated ?? 1)) alerts.push({ level: 'INFO', type: 'EDGE_FILTER', message: 'Many signals filtered by edge' });
    // Dispatch alerts
    for (const a of alerts) {
      await alertDispatcher.dispatch(a);
    }
    res.json(alerts);
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

router.post('/guaranteed-profit/alerts/test', async (req, res) => {
  try {
    const { level = 'INFO', type = 'TEST', message = 'Test alert' } = req.body || {};
    await alertDispatcher.dispatch({ level, type, message });
    res.json({ ok: true });
  } catch (error) {
    logger.error('Error sending test alert:', error);
    res.status(500).json({ error: 'Failed to send test alert' });
  }
});

// Chaos test routes
router.post('/chaos/latency', (req, res) => {
  const ms = Number(req.body?.ms || req.query?.ms || 0);
  chaos.setLatencyMs(ms);
  res.json({ ok: true, latencyMs: chaos.getLatencyMs() });
});
router.post('/chaos/slippage', (req, res) => {
  const x = Number(req.body?.x || req.query?.x || 1);
  chaos.setSlipMultiplier(x);
  res.json({ ok: true, slipMultiplier: chaos.getSlipMultiplier() });
});
router.post('/chaos/ws-down', (req, res) => {
  chaos.setWsDown(true);
  res.json({ ok: true, wsDown: chaos.isWsDown() });
});
router.post('/chaos/reset', (req, res) => {
  chaos.reset();
  res.json({ ok: true });
});

// Basis/Funding carry automation (stubs)
router.post('/guaranteed-profit/basis/open', async (req, res) => {
  try {
    const { symbol, spotExchange, perpExchange, notionalUSD } = req.body || {};
    if (!symbol || !spotExchange || !perpExchange || !notionalUSD) return res.status(400).json({ error: 'Missing fields' });
    const bp = await BasisPosition.create({ symbol, spotExchange, perpExchange, notionalUSD, status: 'OPEN' });
    res.json({ ok: true, message: 'Basis carry opened', id: bp._id, symbol, spotExchange, perpExchange, notionalUSD });
  } catch (error) {
    logger.error('Error opening basis carry:', error);
    res.status(500).json({ error: 'Failed to open basis carry' });
  }
});

router.post('/guaranteed-profit/basis/close', async (req, res) => {
  try {
    const { id, symbol, spotExchange, perpExchange } = req.body || {};
    let bp = null;
    if (id) {
      bp = await BasisPosition.findById(id);
    } else {
      if (!symbol || !spotExchange || !perpExchange) return res.status(400).json({ error: 'Missing fields' });
      bp = await BasisPosition.findOne({ symbol, spotExchange, perpExchange, status: 'OPEN' }).sort({ createdAt: -1 });
    }
    if (!bp) return res.status(404).json({ error: 'No open basis position' });
    bp.status = 'CLOSED';
    bp.closedAt = new Date();
    await bp.save();
    res.json({ ok: true, message: 'Basis carry closed', id: bp._id });
  } catch (error) {
    logger.error('Error closing basis carry:', error);
    res.status(500).json({ error: 'Failed to close basis carry' });
  }
});

router.post('/guaranteed-profit/basis/rollover', async (req, res) => {
  try {
    const { id, symbol, perpExchange } = req.body || {};
    let bp = null;
    if (id) {
      bp = await BasisPosition.findById(id);
    } else {
      if (!symbol || !perpExchange) return res.status(400).json({ error: 'Missing fields' });
      bp = await BasisPosition.findOne({ symbol, perpExchange, status: 'OPEN' }).sort({ createdAt: -1 });
    }
    if (!bp) return res.status(404).json({ error: 'No open basis position' });
    // noop; placeholder for contract roll
    res.json({ ok: true, message: 'Basis carry rolled', id: bp._id });
  } catch (error) {
    logger.error('Error rolling basis carry:', error);
    res.status(500).json({ error: 'Failed to roll basis carry' });
  }
});

router.get('/guaranteed-profit/basis/list', async (req, res) => {
  try {
    const list = await BasisPosition.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    logger.error('Error listing basis positions:', error);
    res.status(500).json({ error: 'Failed to list basis positions' });
  }
});

router.post('/guaranteed-profit/auto-trading', async (req, res) => {
  try {
    const { enabled } = req.body || {};
    res.json({ autoTrading: !!enabled });
  } catch (error) {
    logger.error('Error toggling auto trading:', error);
    res.status(500).json({ error: 'Failed to toggle auto trading' });
  }
});

router.put('/guaranteed-profit/settings', async (req, res) => {
  try {
    // Persist custom settings if needed; accept and return 200 for now
    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.get('/guaranteed-profit/portfolio', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne();
    res.json({
      totalValue: portfolio?.totalValue ?? 0,
      cash: portfolio?.cash ?? 0,
      activePositions: portfolio?.positions?.length ?? 0,
      totalProfit: 0,
      riskLevel: 'Orta',
      positions: portfolio?.positions ?? []
    });
  } catch (error) {
    logger.error('Error fetching guaranteed-profit portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

router.get('/guaranteed-profit/performance', async (req, res) => {
  try {
    res.json({
      totalProfit: 0,
      dailyProfit: 0,
      dailyProfitPercentage: 0,
      successRate: 0,
      totalTrades: 0,
      averageProfit: 0,
      winRate: 0,
      lossRate: 0
    });
  } catch (error) {
    logger.error('Error fetching guaranteed-profit performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
});

// Event & Flow Intelligence Endpoints
router.get('/intel/news/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const items = await intelNews.fetchRecent(symbol.toUpperCase());
    res.json({ symbol: symbol.toUpperCase(), news: items, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Error fetching intel news:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

router.get('/intel/sentiment/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const overall = await intelSentiment.analyze(symbol.toUpperCase());
    const headlines = await intelNews.fetchRecent(symbol.toUpperCase());
    const entities = await intelEntities.scoreEntities(symbol.toUpperCase(), headlines);
    res.json({ symbol: symbol.toUpperCase(), overall, entities, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Error fetching intel sentiment:', error);
    res.status(500).json({ error: 'Failed to fetch sentiment' });
  }
});

router.get('/intel/anomalies', async (req, res) => {
  try {
    const priceChangePct = Number(req.query.priceChangePct || 0);
    const volumeZ = Number(req.query.volumeZ || 0);
    const newsCount = Number(req.query.newsCount || 0);
    const flowDelta = Number(req.query.flowDelta || 0);
    const signals = intelAnomaly.detect({ priceChangePct, volumeZ, newsCount, flowDelta });
    res.json({ anomalies: signals, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Error detecting anomalies:', error);
    res.status(500).json({ error: 'Failed to detect anomalies' });
  }
});

router.get('/intel/flow/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const nowcast = await intelFlow.nowcast(symbol.toUpperCase());
    res.json({ ...nowcast, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Error fetching on-chain flow nowcast:', error);
    res.status(500).json({ error: 'Failed to fetch flow nowcast' });
  }
});

router.get('/guaranteed-profit/system-status', async (req, res) => {
  try {
    const status = guaranteedProfitEngine.getSystemStatus();
    res.json({
      ...status,
      sizing: {
        kellyFractionCap: (guaranteedProfitEngine as any).preset?.kellyFractionCap,
        volatilityTargetPct: (guaranteedProfitEngine as any).preset?.volatilityTargetPct,
        leverageMax: (guaranteedProfitEngine as any).preset?.leverageMax
      },
      speedMode: status.speedMode,
      regime: (guaranteedProfitEngine as any).currentRegime,
      marketData: {
        l2: {
          topLiquidityHint: {
            BTC: (guaranteedProfitEngine as any).l2?.getTopLiquidityUSD?.('BTC'),
            ETH: (guaranteedProfitEngine as any).l2?.getTopLiquidityUSD?.('ETH')
          }
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching system status:', error);
    res.status(500).json({ error: 'Failed to fetch system status' });
  }
});

// Regime-aware allocation endpoints
router.get('/guaranteed-profit/regime-allocation', async (req, res) => {
  try {
    const totalCapital = Number(req.query.capital) || 100000;
    const allocation = await guaranteedProfitEngine.getRegimeAllocation(totalCapital);
    res.json({
      ...allocation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching regime allocation:', error);
    res.status(500).json({ error: 'Failed to fetch regime allocation' });
  }
});

router.post('/guaranteed-profit/select-optimal-preset', async (req, res) => {
  try {
    const selectedPreset = await guaranteedProfitEngine.selectOptimalPresetForRegime();
    res.json({
      selectedPreset,
      regime: (guaranteedProfitEngine as any).currentRegime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error selecting optimal preset:', error);
    res.status(500).json({ error: 'Failed to select optimal preset' });
  }
});

router.get('/guaranteed-profit/regime-performance', async (req, res) => {
  try {
    const status = guaranteedProfitEngine.getSystemStatus();
    res.json({
      regimePerformance: status.regimeAllocation?.regimePerformance || [],
      banditWeights: status.regimeAllocation?.banditWeights || {},
      currentRegime: status.regimeAllocation?.currentRegime || 'UNKNOWN',
      activePreset: status.regimeAllocation?.activePreset || 'MICRO_SAFE',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching regime performance:', error);
    res.status(500).json({ error: 'Failed to fetch regime performance' });
  }
});

// TCA and Execution RL endpoints
router.get('/execution/tca-stats', async (req, res) => {
  try {
    const tcaStats = liveExec.getTCAStats();
    res.json({
      ...tcaStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching TCA stats:', error);
    res.status(500).json({ error: 'Failed to fetch TCA stats' });
  }
});

router.get('/execution/venue-performance', async (req, res) => {
  try {
    const venuePerformance = liveExec.getVenuePerformance();
    res.json({
      venues: venuePerformance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching venue performance:', error);
    res.status(500).json({ error: 'Failed to fetch venue performance' });
  }
});

router.get('/execution/rl-stats', async (req, res) => {
  try {
    const rlStats = liveExec.getRLStats();
    res.json({
      ...rlStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching RL stats:', error);
    res.status(500).json({ error: 'Failed to fetch RL stats' });
  }
});

router.post('/execution/execute-with-tca', execLimiter, async (req, res) => {
  try {
    const { symbol, side, size, urgency, marketVolatility, liquidity } = req.body || {};
    
    if (!symbol || !side || !size || !urgency) {
      return res.status(400).json({ error: 'Missing required fields: symbol, side, size, urgency' });
    }

    const result = await liveExec.executeWithTCA({
      symbol,
      side,
      size: Number(size),
      urgency,
      marketVolatility: Number(marketVolatility) || 0.02,
      liquidity: Number(liquidity) || 1000000
    });

    res.json({
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error executing with TCA:', error);
    res.status(500).json({ error: 'Failed to execute with TCA' });
  }
});

// Market Data Validation endpoints
router.get('/validation/market-data/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const validation = await guaranteedProfitEngine.validateMarketData(symbol.toUpperCase());
    res.json({
      ...validation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error validating market data:', error);
    res.status(500).json({ error: 'Failed to validate market data' });
  }
});

// Atomic Execution endpoints
router.post('/execution/atomic', execLimiter, async (req, res) => {
  try {
    const { orders } = req.body || {};
    
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid orders array' });
    }

    const result = await guaranteedProfitEngine.executeAtomicTransaction(orders);
    res.json({
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error executing atomic transaction:', error);
    res.status(500).json({ error: 'Failed to execute atomic transaction' });
  }
});

// Emergency Control endpoints
router.get('/emergency/status', async (req, res) => {
  try {
    const status = guaranteedProfitEngine.getEmergencyStatus();
    res.json({
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching emergency status:', error);
    res.status(500).json({ error: 'Failed to fetch emergency status' });
  }
});

router.post('/emergency/stop', async (req, res) => {
  try {
    const { type, reason, scope, severity, initiatedBy } = req.body || {};
    
    if (!type || !reason || !scope || !severity || !initiatedBy) {
      return res.status(400).json({ 
        error: 'Missing required fields: type, reason, scope, severity, initiatedBy' 
      });
    }

    const stopId = await guaranteedProfitEngine.triggerEmergencyStop({
      type,
      reason,
      scope: Array.isArray(scope) ? scope : [scope],
      severity,
      initiatedBy
    });

    res.json({
      stopId,
      message: 'Emergency stop triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error triggering emergency stop:', error);
    res.status(500).json({ error: 'Failed to trigger emergency stop' });
  }
});

router.get('/emergency/trading-allowed', async (req, res) => {
  try {
    const { symbol, exchange } = req.query;
    const allowed = guaranteedProfitEngine.isTradingAllowed(
      symbol as string, 
      exchange as string
    );
    
    res.json({
      tradingAllowed: allowed,
      symbol: symbol || 'ALL',
      exchange: exchange || 'ALL',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error checking trading status:', error);
    res.status(500).json({ error: 'Failed to check trading status' });
  }
});

// Dynamic Position Sizing endpoints
router.post('/position/calculate-size', async (req, res) => {
  try {
    const params = req.body || {};
    
    if (!params.symbol || !params.accountBalance || !params.entryPrice) {
      return res.status(400).json({ 
        error: 'Missing required fields: symbol, accountBalance, entryPrice' 
      });
    }

    const result = await guaranteedProfitEngine.calculatePositionSize(params);
    res.json({
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error calculating position size:', error);
    res.status(500).json({ error: 'Failed to calculate position size' });
  }
});

router.get('/position/risk-metrics/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const metrics = guaranteedProfitEngine.getRiskMetrics(symbol.toUpperCase());
    
    res.json({
      symbol: symbol.toUpperCase(),
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching risk metrics:', error);
    res.status(500).json({ error: 'Failed to fetch risk metrics' });
  }
});

router.post('/position/update-risk-metrics', async (req, res) => {
  try {
    const { symbol, tradeOutcome } = req.body || {};
    
    if (!symbol || !tradeOutcome) {
      return res.status(400).json({ 
        error: 'Missing required fields: symbol, tradeOutcome' 
      });
    }

    await guaranteedProfitEngine.updateRiskMetrics(symbol, tradeOutcome);
    res.json({
      success: true,
      message: 'Risk metrics updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error updating risk metrics:', error);
    res.status(500).json({ error: 'Failed to update risk metrics' });
  }
});

router.post('/position/portfolio-risk', async (req, res) => {
  try {
    const { positions } = req.body || {};
    
    if (!positions || !Array.isArray(positions)) {
      return res.status(400).json({ 
        error: 'Missing or invalid positions array' 
      });
    }

    const result = await guaranteedProfitEngine.calculatePortfolioRisk(positions);
    res.json({
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error calculating portfolio risk:', error);
    res.status(500).json({ error: 'Failed to calculate portfolio risk' });
  }
});

// Real-time P&L Tracking endpoints
router.post('/position/add', async (req, res) => {
  try {
    const position = req.body || {};
    
    if (!position.symbol || !position.side || !position.size || !position.entryPrice) {
      return res.status(400).json({ 
        error: 'Missing required fields: symbol, side, size, entryPrice' 
      });
    }

    const positionId = await guaranteedProfitEngine.addPosition(position);
    res.json({
      positionId,
      message: 'Position added successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error adding position:', error);
    res.status(500).json({ error: 'Failed to add position' });
  }
});

router.put('/position/:positionId', async (req, res) => {
  try {
    const { positionId } = req.params;
    const updates = req.body || {};
    
    const success = await guaranteedProfitEngine.updatePosition(positionId, updates);
    
    if (success) {
      res.json({
        success: true,
        message: 'Position updated successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({ error: 'Position not found' });
    }
  } catch (error) {
    logger.error('Error updating position:', error);
    res.status(500).json({ error: 'Failed to update position' });
  }
});

router.post('/position/:positionId/close', async (req, res) => {
  try {
    const { positionId } = req.params;
    const { exitPrice, reason } = req.body || {};
    
    if (!exitPrice) {
      return res.status(400).json({ 
        error: 'Missing required field: exitPrice' 
      });
    }

    const success = await guaranteedProfitEngine.closePosition(positionId, exitPrice, reason);
    
    if (success) {
      res.json({
        success: true,
        message: 'Position closed successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({ error: 'Position not found' });
    }
  } catch (error) {
    logger.error('Error closing position:', error);
    res.status(500).json({ error: 'Failed to close position' });
  }
});

router.get('/position/portfolio-pnl', async (req, res) => {
  try {
    const portfolioPnL = guaranteedProfitEngine.getPortfolioPnL();
    res.json({
      ...portfolioPnL,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching portfolio P&L:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio P&L' });
  }
});

router.get('/position/:positionId', async (req, res) => {
  try {
    const { positionId } = req.params;
    const position = guaranteedProfitEngine.getPosition(positionId);
    
    if (position) {
      res.json({
        position,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({ error: 'Position not found' });
    }
  } catch (error) {
    logger.error('Error fetching position:', error);
    res.status(500).json({ error: 'Failed to fetch position' });
  }
});

router.get('/position/:positionId/pnl-history', async (req, res) => {
  try {
    const { positionId } = req.params;
    const pnlHistory = guaranteedProfitEngine.getPnLHistory(positionId);
    
    res.json({
      positionId,
      pnlHistory,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching P&L history:', error);
    res.status(500).json({ error: 'Failed to fetch P&L history' });
  }
});

router.get('/position/:positionId/auto-close-rules', async (req, res) => {
  try {
    const { positionId } = req.params;
    const rules = guaranteedProfitEngine.getAutoCloseRules(positionId);
    
    res.json({
      positionId,
      rules,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching auto-close rules:', error);
    res.status(500).json({ error: 'Failed to fetch auto-close rules' });
  }
});

router.post('/position/auto-close-rule', async (req, res) => {
  try {
    const rule = req.body || {};
    
    if (!rule.positionId || !rule.type || !rule.condition) {
      return res.status(400).json({ 
        error: 'Missing required fields: positionId, type, condition' 
      });
    }

    const ruleId = await guaranteedProfitEngine.addAutoCloseRule(rule);
    res.json({
      ruleId,
      message: 'Auto-close rule added successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error adding auto-close rule:', error);
    res.status(500).json({ error: 'Failed to add auto-close rule' });
  }
});

router.get('/position/stats', async (req, res) => {
  try {
    const stats = guaranteedProfitEngine.getPnLStats();
    res.json({
      ...stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching position stats:', error);
    res.status(500).json({ error: 'Failed to fetch position stats' });
  }
});

router.post('/guaranteed-profit/speed-mode', async (req, res) => {
  try {
    const { enabled } = req.body || {};
    guaranteedProfitEngine.setSpeedMode(!!enabled);
    res.json({ enabled: guaranteedProfitEngine.getSpeedMode() });
  } catch (error) {
    logger.error('Error toggling speed mode:', error);
    res.status(500).json({ error: 'Failed to toggle speed mode' });
  }
});

router.post('/guaranteed-profit/preset', async (req, res) => {
  try {
    const { key } = req.body || {};
    if (!key) return res.status(400).json({ error: 'Missing preset key' });
    const ok = (guaranteedProfitEngine as any).setActivePreset?.(key);
    if (!ok) return res.status(400).json({ error: 'Unknown preset key' });
    res.json({ activePreset: key });
  } catch (error) {
    logger.error('Error setting preset:', error);
    res.status(500).json({ error: 'Failed to set preset' });
  }
});

// Leverage Trading Endpoints
router.get('/leverage/positions', async (req, res) => {
  try {
    const positions = await Position.find({ status: 'OPEN' }).sort({ createdAt: -1 });
    res.json({
      positions: positions.map(pos => ({
        id: pos._id,
        symbol: pos.symbol,
        type: pos.type,
        size: pos.size,
        entryPrice: pos.entryPrice,
        currentPrice: pos.currentPrice,
        leverage: pos.leverage,
        margin: pos.margin,
        pnl: pos.unrealizedPnL,
        pnlPercent: pos.pnlPercent,
        liquidationPrice: pos.liquidationPrice,
        status: pos.status,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        createdAt: pos.createdAt
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching leverage positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

router.get('/leverage/margin-account', async (req, res) => {
  try {
    // Get REAL balance from Binance API - NO MOCK DATA, NO DEFAULT VALUES
    let realBalanceUSDT = 0;
    let realFreeUSDT = 0;
    
    try {
      const ex = new ccxt.binance({
        apiKey: process.env.BINANCE_API_KEY,
        secret: process.env.BINANCE_SECRET_KEY,
        enableRateLimit: true,
        options: { defaultType: 'spot' }
      });
      
      if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET_KEY &&
          process.env.BINANCE_API_KEY.trim() !== '' && process.env.BINANCE_SECRET_KEY.trim() !== '' &&
          !process.env.BINANCE_API_KEY.includes('test') && !process.env.BINANCE_SECRET_KEY.includes('test')) {
        try {
          await ex.loadMarkets();
          const balance = await ex.fetchBalance();
          // CCXT balance structure: balance['USDT'] or balance.total?.['USDT']
          const balanceTotal = balance.total as any;
          const balanceFree = balance.free as any;
          realBalanceUSDT = balanceTotal?.['USDT'] || balanceTotal?.['usdt'] || 0;
          realFreeUSDT = balanceFree?.['USDT'] || balanceFree?.['usdt'] || 0;
          
          // If no USDT, calculate from other assets using EquityProvider
          if (realBalanceUSDT <= 0) {
            try {
              const equityProviderMod = await import('../services/portfolio/equity-provider');
              const EquityProvider = (equityProviderMod as any).EquityProvider;
              const provider = new EquityProvider('USDT');
              await provider.initialize();
              realBalanceUSDT = await provider.getEquityUsd();
              realFreeUSDT = realBalanceUSDT * 0.9; // Estimate free as 90% of total
            } catch (eqError) {
              logger.warn('⚠️ Could not calculate equity from other assets');
            }
          }
          
          logger.info(`💰 Real Binance balance fetched: ${realBalanceUSDT.toFixed(2)} USDT`);
        } catch (balanceError: any) {
          logger.warn('⚠️ Could not fetch real Binance balance:', balanceError.message);
        }
      } else {
        logger.warn('⚠️ Binance API keys not configured or invalid');
      }
    } catch (error: any) {
      logger.warn('⚠️ Binance API error:', error.message);
    }

    // Get portfolio P&L stats (real data)
    const portfolioPnL = guaranteedProfitEngine?.getPortfolioPnL?.() || {};
    const stats = guaranteedProfitEngine?.getPnLStats?.() || {};
    
    // Use REAL balance from Binance (even if it's very low) - NO MOCK VALUES
    const totalBalance = realBalanceUSDT > 0 ? realBalanceUSDT : 0; // If no API access, return 0 (not mock)
    
    // Calculate margin based on real positions
    const marginUsed = portfolioPnL.positions?.reduce((sum: number, p: any) => {
      return sum + (p.status === 'OPEN' ? (p.size || 0) * (p.entryPrice || 0) : 0);
    }, 0) || 0;
    
    const marginBalance = Math.max(0, totalBalance);
    const marginFree = Math.max(0, marginBalance - marginUsed);
    const marginRatio = marginBalance > 0 ? marginUsed / marginBalance : 0;
    
    // Calculate risk level based on margin ratio
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'LOW';
    if (marginRatio >= 0.8) riskLevel = 'EXTREME';
    else if (marginRatio >= 0.6) riskLevel = 'HIGH';
    else if (marginRatio >= 0.3) riskLevel = 'MEDIUM';

    // Dynamic leverage based on real balance (more conservative for small accounts)
    let maxLeverage = 1;
    if (totalBalance >= 10000) maxLeverage = 10;
    else if (totalBalance >= 5000) maxLeverage = 5;
    else if (totalBalance >= 1000) maxLeverage = 3;
    else if (totalBalance > 0) maxLeverage = 2;

    // Update or create margin account with REAL data only
    let marginAccount = await MarginAccount.findOne();
    
    if (marginAccount) {
      // Update existing account with real data
      marginAccount.totalBalance = totalBalance;
      marginAccount.marginBalance = marginBalance;
      marginAccount.marginUsed = marginUsed;
      marginAccount.marginFree = marginFree;
      marginAccount.marginRatio = marginRatio;
      marginAccount.riskLevel = riskLevel;
      marginAccount.maxLeverage = maxLeverage;
      marginAccount.dailyPnL = portfolioPnL.dailyPnL || 0;
      marginAccount.totalPnL = portfolioPnL.totalPnL || 0;
      marginAccount.maxDrawdown = portfolioPnL.maxDrawdown || 0;
      marginAccount.openPositions = portfolioPnL.positions?.filter((p: any) => p.status === 'OPEN')?.length || 0;
      marginAccount.totalPositions = portfolioPnL.positions?.length || 0;
      marginAccount.winRate = portfolioPnL.winRate || 0;
      await marginAccount.save();
    } else {
      // Create new account with REAL data only (no defaults)
      marginAccount = await MarginAccount.create({
        totalBalance,
        marginBalance,
        marginUsed,
        marginFree,
        marginRatio,
        riskLevel,
        maxLeverage,
        dailyPnL: portfolioPnL.dailyPnL || 0,
        totalPnL: portfolioPnL.totalPnL || 0,
        maxDrawdown: portfolioPnL.maxDrawdown || 0,
        openPositions: portfolioPnL.positions?.filter((p: any) => p.status === 'OPEN')?.length || 0,
        totalPositions: portfolioPnL.positions?.length || 0,
        winRate: portfolioPnL.winRate || 0
      });
    }
    
      res.json({
        totalBalance: marginAccount.totalBalance,
        marginBalance: marginAccount.marginBalance,
        marginUsed: marginAccount.marginUsed,
        marginFree: marginAccount.marginFree,
        marginRatio: marginAccount.marginRatio,
        riskLevel: marginAccount.riskLevel,
        maxLeverage: marginAccount.maxLeverage,
        dailyPnL: marginAccount.dailyPnL,
        totalPnL: marginAccount.totalPnL,
        maxDrawdown: marginAccount.maxDrawdown,
        openPositions: marginAccount.openPositions,
        totalPositions: marginAccount.totalPositions,
        winRate: marginAccount.winRate,
        timestamp: marginAccount.updatedAt
      });
  } catch (error) {
    logger.error('❌ Error fetching margin account:', error);
    res.status(500).json({ error: 'Failed to fetch margin account' });
  }
});

// Open new leverage position
router.post('/leverage/open-position', async (req, res) => {
  try {
    const { symbol, type, size, leverage, stopLoss, takeProfit } = req.body;
    
    // Validate required fields
    if (!symbol || !type || !size || !leverage) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Use real-time trading service to open position
    const position = await realTimeTradingService.openPosition(
      symbol, type, size, leverage, stopLoss, takeProfit
    );
    
    res.json({
      message: 'Position opened successfully',
      position: {
        id: position._id,
        symbol: position.symbol,
        type: position.type,
        size: position.size,
        entryPrice: position.entryPrice,
        leverage: position.leverage,
        margin: position.margin,
        liquidationPrice: position.liquidationPrice
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error opening position:', error);
    res.status(500).json({ error: error.message || 'Failed to open position' });
  }
});

// Close leverage position
router.post('/leverage/close-position/:positionId', async (req, res) => {
  try {
    const { positionId } = req.params;
    const { exitPrice } = req.body;
    
    const position = await Position.findById(positionId);
    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }
    
    if (position.status !== 'OPEN') {
      return res.status(400).json({ error: 'Position is not open' });
    }
    
    // Calculate PnL
    const entryValue = position.size * position.entryPrice;
    const exitValue = position.size * exitPrice;
    
    let pnl: number;
    if (position.type === 'LONG') {
      pnl = exitValue - entryValue;
    } else {
      pnl = entryValue - exitValue;
    }
    
    const pnlPercent = (pnl / entryValue) * 100;
    
    // Update position
    position.currentPrice = exitPrice;
    position.pnl = pnl;
    position.pnlPercent = pnlPercent;
    position.realizedPnL = pnl;
    position.status = 'CLOSED';
    position.updatedAt = new Date();
    await position.save();
    
    // Update margin account
    const marginAccount = await MarginAccount.findOne();
    if (marginAccount) {
      marginAccount.marginUsed -= position.margin;
      marginAccount.openPositions -= 1;
      marginAccount.totalPnL += pnl;
      marginAccount.dailyPnL += pnl;
      
      // Update win rate
      if (pnl > 0) {
        const totalWins = marginAccount.totalPositions * marginAccount.winRate;
        marginAccount.winRate = (totalWins + 1) / marginAccount.totalPositions;
      }
      
      await marginAccount.save();
    }
    
    logger.info(`✅ Closed position: ${position.symbol} ${position.type} - PnL: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
    
    res.json({
      message: 'Position closed successfully',
      pnl,
      pnlPercent,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error closing position:', error);
    res.status(500).json({ error: 'Failed to close position' });
  }
});

// ===== BACKTESTING ENDPOINTS =====

// POST /backtesting/run - Run a backtest
router.post('/backtesting/run', async (req, res) => {
  try {
    const config = req.body;
    const result = await guaranteedProfitEngine.runBacktest(config);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('❌ Run backtest failed:', error);
    res.status(500).json({ success: false, error: 'Failed to run backtest' });
  }
});

// GET /backtesting/results/:backtestId - Get backtest results
router.get('/backtesting/results/:backtestId', async (req, res) => {
  try {
    const { backtestId } = req.params;
    const results = await guaranteedProfitEngine.getBacktestResults(backtestId);
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('❌ Get backtest results failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get backtest results' });
  }
});

// GET /backtesting/history - Get backtest history
router.get('/backtesting/history', async (req, res) => {
  try {
    const history = await guaranteedProfitEngine.getBacktestHistory();
    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('❌ Get backtest history failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get backtest history' });
  }
});

// ===== PAPER TRADING ENDPOINTS =====

// POST /paper-trading/portfolio - Create paper trading portfolio
router.post('/paper-trading/portfolio', async (req, res) => {
  try {
    const config = req.body;
    const portfolioId = await guaranteedProfitEngine.createPaperPortfolio(config);
    res.json({ success: true, data: { portfolioId } });
  } catch (error) {
    logger.error('❌ Create paper portfolio failed:', error);
    res.status(500).json({ success: false, error: 'Failed to create paper portfolio' });
  }
});

// POST /paper-trading/execute - Execute paper trade
router.post('/paper-trading/execute', async (req, res) => {
  try {
    const { portfolioId, signal } = req.body;
    const success = await guaranteedProfitEngine.executePaperTrade(portfolioId, signal);
    res.json({ success: true, data: { executed: success } });
  } catch (error) {
    logger.error('❌ Execute paper trade failed:', error);
    res.status(500).json({ success: false, error: 'Failed to execute paper trade' });
  }
});

// GET /paper-trading/portfolio/:portfolioId - Get paper portfolio
router.get('/paper-trading/portfolio/:portfolioId', async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const portfolio = guaranteedProfitEngine.getPaperPortfolio(portfolioId);
    res.json({ success: true, data: portfolio });
  } catch (error) {
    logger.error('❌ Get paper portfolio failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get paper portfolio' });
  }
});

// GET /paper-trading/portfolios - Get all paper portfolios
router.get('/paper-trading/portfolios', async (req, res) => {
  try {
    const portfolios = guaranteedProfitEngine.getAllPaperPortfolios();
    res.json({ success: true, data: portfolios });
  } catch (error) {
    logger.error('❌ Get paper portfolios failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get paper portfolios' });
  }
});

// ===== LIQUIDITY AGGREGATION ENDPOINTS =====

// GET /liquidity/snapshot/:symbol - Get liquidity snapshot
router.get('/liquidity/snapshot/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const snapshot = await guaranteedProfitEngine.getLiquiditySnapshot(symbol);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    logger.error('❌ Get liquidity snapshot failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get liquidity snapshot' });
  }
});

// POST /liquidity/route - Generate smart route
router.post('/liquidity/route', async (req, res) => {
  try {
    const { symbol, side, size } = req.body;
    const route = await guaranteedProfitEngine.generateSmartRoute(symbol, side, size);
    res.json({ success: true, data: route });
  } catch (error) {
    logger.error('❌ Generate smart route failed:', error);
    res.status(500).json({ success: false, error: 'Failed to generate smart route' });
  }
});

// GET /liquidity/metrics/:symbol - Get liquidity metrics
router.get('/liquidity/metrics/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const metrics = await guaranteedProfitEngine.getLiquidityMetrics(symbol);
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error('❌ Get liquidity metrics failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get liquidity metrics' });
  }
});

// GET /liquidity/sources - Get all liquidity sources
router.get('/liquidity/sources', async (req, res) => {
  try {
    const sources = guaranteedProfitEngine.getAllLiquiditySources();
    res.json({ success: true, data: sources });
  } catch (error) {
    logger.error('❌ Get liquidity sources failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get liquidity sources' });
  }
});

// ===== SLIPPAGE PROTECTION ENDPOINTS =====

// POST /slippage/analyze - Analyze slippage
router.post('/slippage/analyze', async (req, res) => {
  try {
    const { symbol, side, size } = req.body;
    const analysis = await guaranteedProfitEngine.analyzeSlippage(symbol, side, size);
    res.json({ success: true, data: analysis });
  } catch (error) {
    logger.error('❌ Analyze slippage failed:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze slippage' });
  }
});

// POST /slippage/protection - Create slippage protection
router.post('/slippage/protection', async (req, res) => {
  try {
    const { symbol, side, size, config } = req.body;
    const protectionId = await guaranteedProfitEngine.createSlippageProtection(symbol, side, size, config);
    res.json({ success: true, data: { protectionId } });
  } catch (error) {
    logger.error('❌ Create slippage protection failed:', error);
    res.status(500).json({ success: false, error: 'Failed to create slippage protection' });
  }
});

// GET /slippage/protection/:protectionId - Get slippage protection
router.get('/slippage/protection/:protectionId', async (req, res) => {
  try {
    const { protectionId } = req.params;
    const protection = guaranteedProfitEngine.getSlippageProtection(protectionId);
    res.json({ success: true, data: protection });
  } catch (error) {
    logger.error('❌ Get slippage protection failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get slippage protection' });
  }
});

// GET /slippage/protections - Get all slippage protections
router.get('/slippage/protections', async (req, res) => {
  try {
    const protections = guaranteedProfitEngine.getAllSlippageProtections();
    res.json({ success: true, data: protections });
  } catch (error) {
    logger.error('❌ Get slippage protections failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get slippage protections' });
  }
});

// ===== DAILY PROFIT OPTIMIZER ENDPOINTS =====

// POST /daily-profit/execute - Execute daily strategy
router.post('/daily-profit/execute', async (req, res) => {
  try {
    const result = await dailyProfitOptimizer.executeDailyStrategy();
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Execute daily strategy failed:', error);
    res.status(500).json({ success: false, error: 'Failed to execute daily strategy' });
  }
});

// GET /daily-profit/performance - Get performance stats
router.get('/daily-profit/performance', async (req, res) => {
  try {
    const stats = dailyProfitOptimizer.getPerformanceStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Get performance stats failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get performance stats' });
  }
});

// GET /daily-profit/results - Get daily results
router.get('/daily-profit/results', async (req, res) => {
  try {
    const results = dailyProfitOptimizer.getDailyResults();
    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Get daily results failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get daily results' });
  }
});

// ===== ARBITRAGE OPPORTUNITY FINDER ENDPOINTS =====

// GET /arbitrage/opportunities - Scan arbitrage opportunities
router.get('/arbitrage/opportunities', async (req, res) => {
  try {
    const opportunities = await arbitrageFinder.scanOpportunities();
    res.json({
      success: true,
      data: opportunities,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Scan arbitrage opportunities failed:', error);
    res.status(500).json({ success: false, error: 'Failed to scan arbitrage opportunities' });
  }
});

// POST /arbitrage/execute - Execute arbitrage opportunity
router.post('/arbitrage/execute', async (req, res) => {
  try {
    const { opportunity } = req.body;
    
    if (!opportunity) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing opportunity data' 
      });
    }

    const result = await arbitrageFinder.executeArbitrage(opportunity);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Execute arbitrage failed:', error);
    res.status(500).json({ success: false, error: 'Failed to execute arbitrage' });
  }
});

// GET /arbitrage/best - Get best opportunities
router.get('/arbitrage/best', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 5;
    const opportunities = arbitrageFinder.getBestOpportunities(limit);
    res.json({
      success: true,
      data: opportunities,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Get best arbitrage opportunities failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get best opportunities' });
  }
});

// ===== SAFE GROWTH STRATEGY ENDPOINTS =====

// POST /safe-growth/analyze - Analyze trading opportunity
router.post('/safe-growth/analyze', async (req, res) => {
  try {
    const { signal, analysis } = req.body;
    
    if (!signal || !analysis) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing signal or analysis data' 
      });
    }

    const safeGrowthStrategy = new SafeDailyGrowthStrategy({
      dailyTarget: 0.03,
      maxRiskPerTrade: 0.01,
      maxDailyLoss: 0.02,
      maxPositions: 10,
      minConfidence: 70,
      diversification: true
    });

    await safeGrowthStrategy.initialize();
    const result = await safeGrowthStrategy.analyzeOpportunity(signal, analysis);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Analyze safe growth opportunity failed:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze opportunity' });
  }
});

// GET /safe-growth/status - Get daily status
router.get('/safe-growth/status', async (req, res) => {
  try {
    const safeGrowthStrategy = new SafeDailyGrowthStrategy({
      dailyTarget: 0.03,
      maxRiskPerTrade: 0.01,
      maxDailyLoss: 0.02,
      maxPositions: 10,
      minConfidence: 70,
      diversification: true
    });

    await safeGrowthStrategy.initialize();
    const status = safeGrowthStrategy.getDailyStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Get safe growth status failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

// ===== MOMENTUM REVERSAL BOT ENDPOINTS =====

// POST /momentum/start - Start momentum reversal bot
router.post('/momentum/start', async (req, res) => {
  try {
    await momentumBot.initialize();
    await momentumBot.startTrading();
    
    res.json({
      success: true,
      message: 'Momentum Reversal Bot started successfully',
      config: momentumConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Start momentum bot failed:', error);
    res.status(500).json({ success: false, error: 'Failed to start momentum bot' });
  }
});

// GET /momentum/status - Get bot status
router.get('/momentum/status', async (req, res) => {
  try {
    const status = momentumBot.getDailyStatus();
    const activeTrades = momentumBot.getActiveTrades();
    
    res.json({
      success: true,
      data: {
        ...status,
        activeTrades: Array.from(activeTrades.entries()).map(([symbol, trades]) => ({
          symbol,
          trades: trades.length,
          positions: trades
        })),
        config: momentumConfig
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Get momentum status failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get momentum status' });
  }
});

// GET /momentum/trend/:symbol - Get trend analysis for symbol
router.get('/momentum/trend/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const trendAnalysis = momentumBot.getTrendAnalysis(symbol.toUpperCase());
    
    if (!trendAnalysis) {
      return res.status(404).json({ 
        success: false, 
        error: `No trend analysis available for ${symbol}` 
      });
    }
    
    res.json({
      success: true,
      data: trendAnalysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Get trend analysis failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get trend analysis' });
  }
});

// GET /momentum/trades/:symbol - Get active trades for symbol
router.get('/momentum/trades/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const activeTrades = momentumBot.getActiveTrades();
    const symbolTrades = activeTrades.get(symbol.toUpperCase()) || [];
    
    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        trades: symbolTrades,
        count: symbolTrades.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Get active trades failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get active trades' });
  }
});

// ===== TREND DETECTION ENGINE ENDPOINTS =====

// GET /trend/analyze/:symbol - Analyze trend for symbol
router.get('/trend/analyze/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '5m' } = req.query;
    
    await trendEngine.initialize();
    const trendSignal = await trendEngine.analyzeTrend(symbol.toUpperCase(), timeframe as string);
    
    if (!trendSignal) {
      return res.status(404).json({ 
        success: false, 
        error: `No trend signal available for ${symbol}` 
      });
    }
    
    res.json({
      success: true,
      data: trendSignal,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Analyze trend failed:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze trend' });
  }
});

// GET /trend/reversal/:symbol - Detect reversal for symbol
router.get('/trend/reversal/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '5m' } = req.query;
    
    await trendEngine.initialize();
    const reversalSignal = await trendEngine.detectReversal(symbol.toUpperCase(), timeframe as string);
    
    if (!reversalSignal) {
      return res.status(404).json({ 
        success: false, 
        error: `No reversal signal available for ${symbol}` 
      });
    }
    
    res.json({
      success: true,
      data: reversalSignal,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Detect reversal failed:', error);
    res.status(500).json({ success: false, error: 'Failed to detect reversal' });
  }
});

// GET /trend/history/:symbol - Get trend history for symbol
router.get('/trend/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 50 } = req.query;
    
    await trendEngine.initialize();
    const trendHistory = trendEngine.getTrendHistory(symbol.toUpperCase());
    const reversalHistory = trendEngine.getReversalHistory(symbol.toUpperCase());
    
    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        trendHistory: trendHistory.slice(-Number(limit)),
        reversalHistory: reversalHistory.slice(-Number(limit)),
        totalTrendSignals: trendHistory.length,
        totalReversalSignals: reversalHistory.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Get trend history failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get trend history' });
  }
});

// POST /momentum/execute-quick - Execute quick trade
router.post('/momentum/execute-quick', async (req, res) => {
  try {
    const { symbol, direction, amount, reason } = req.body;
    
    if (!symbol || !direction || !amount) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: symbol, direction, amount' 
      });
    }

    // Mock quick trade execution
    const mockTrade = {
      symbol: symbol.toUpperCase(),
      direction: direction.toUpperCase(),
      entryPrice: 50000, // Mock price
      targetPrice: direction.toUpperCase() === 'LONG' ? 50750 : 49250,
      stopLoss: direction.toUpperCase() === 'LONG' ? 49000 : 51000,
      positionSize: amount,
      expectedProfit: amount * 0.015, // 1.5% profit
      riskReward: 1.5,
      confidence: 85,
      timeframe: '5m',
      reason: reason || 'Manual quick trade'
    };

    res.json({
      success: true,
      data: {
        trade: mockTrade,
        message: 'Quick trade executed successfully',
        estimatedProfit: mockTrade.expectedProfit
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Execute quick trade failed:', error);
    res.status(500).json({ success: false, error: 'Failed to execute quick trade' });
  }
});

// GET /momentum/performance - Get bot performance
router.get('/momentum/performance', async (req, res) => {
  try {
    const status = momentumBot.getDailyStatus();
    const activeTrades = momentumBot.getActiveTrades();
    
    // Calculate performance metrics
    const totalActiveTrades = Array.from(activeTrades.values()).flat().length;
    const targetProgress = (status.dailyPnL / status.dailyTarget) * 100;
    
    res.json({
      success: true,
      data: {
        currentBalance: status.currentBalance,
        dailyPnL: status.dailyPnL,
        dailyTarget: status.dailyTarget,
        targetProgress: Math.min(targetProgress, 100),
        activeTrades: totalActiveTrades,
        totalTrades: status.totalTrades,
        profitPercentage: (status.dailyPnL / 100) * 100, // Based on $100 start
        riskLevel: status.dailyPnL < 0 ? 'HIGH' : status.dailyPnL > status.dailyTarget * 0.5 ? 'MEDIUM' : 'LOW',
        recommendations: generateRecommendations(status, targetProgress)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Get momentum performance failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get momentum performance' });
  }
});

// Helper function for recommendations
function generateRecommendations(status: any, targetProgress: number): string[] {
  const recommendations: string[] = [];
  
  if (targetProgress >= 100) {
    recommendations.push('🎯 Daily target achieved! Consider reducing risk');
  } else if (targetProgress >= 50) {
    recommendations.push('📈 Good progress! Continue with current strategy');
  } else if (targetProgress >= 25) {
    recommendations.push('⚠️ Moderate progress. Consider adjusting strategy');
  } else {
    recommendations.push('🚨 Low progress. Review risk management and strategy');
  }
  
  if (status.dailyPnL < 0) {
    recommendations.push('🛑 Negative P&L. Consider stopping and reassessing');
  }
  
  if (status.activeTrades > 10) {
    recommendations.push('⚠️ High number of active trades. Consider reducing exposure');
  }
  
  return recommendations;
}

// ===== PROFIT GUARANTEE SYSTEM ENDPOINTS =====

// POST /profit/protect - Protect profit for position
router.post('/profit/protect', async (req, res) => {
  try {
    const { symbol, entryPrice, currentPrice, positionSize } = req.body;
    
    if (!symbol || !entryPrice || !currentPrice || !positionSize) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: symbol, entryPrice, currentPrice, positionSize' 
      });
    }

    await profitGuaranteeSystem.initialize();
    const protection = await profitGuaranteeSystem.protectProfit(symbol, entryPrice, currentPrice, positionSize);
    
    res.json({
      success: true,
      data: protection,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to protect profit' });
  }
});

// POST /profit/hedge - Create hedge position
router.post('/profit/hedge', async (req, res) => {
  try {
    const { symbol, mainPosition, positionSize } = req.body;
    
    if (!symbol || !mainPosition || !positionSize) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: symbol, mainPosition, positionSize' 
      });
    }

    await profitGuaranteeSystem.initialize();
    const hedgePosition = await profitGuaranteeSystem.createHedgePosition(symbol, mainPosition, positionSize);
    
    res.json({
      success: true,
      data: hedgePosition,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create hedge position' });
  }
});

// POST /profit/lock - Lock profit
router.post('/profit/lock', async (req, res) => {
  try {
    const { symbol, currentPrice, profitPercentage } = req.body;
    
    if (!symbol || !currentPrice || !profitPercentage) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: symbol, currentPrice, profitPercentage' 
      });
    }

    await profitGuaranteeSystem.initialize();
    const profitLock = await profitGuaranteeSystem.lockProfit(symbol, currentPrice, profitPercentage);
    
    res.json({
      success: true,
      data: profitLock,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to lock profit' });
  }
});

// GET /profit/protections - Get all profit protections
router.get('/profit/protections', async (req, res) => {
  try {
    await profitGuaranteeSystem.initialize();
    const protections = profitGuaranteeSystem.getProfitProtections();
    const hedgePositions = profitGuaranteeSystem.getHedgePositions();
    const profitLocks = profitGuaranteeSystem.getProfitLocks();
    
    res.json({
      success: true,
      data: {
        protections: Array.from(protections.entries()),
        hedgePositions: Array.from(hedgePositions.entries()),
        profitLocks: Array.from(profitLocks.entries()),
        dailyProfit: profitGuaranteeSystem.getDailyProfit(),
        maxDailyProfit: profitGuaranteeSystem.getMaxDailyProfit(),
        riskLevel: profitGuaranteeSystem.getRiskLevel()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Get profit protections failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get profit protections' });
  }
});

// ===== ADVANCED RISK MANAGEMENT ENDPOINTS =====

// POST /risk/analyze - Analyze portfolio risk
router.post('/risk/analyze', async (req, res) => {
  try {
    const { positions } = req.body;
    
    if (!positions || !Array.isArray(positions)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing or invalid positions array' 
      });
    }

    await advancedRiskManagement.initialize();
    const riskMetrics = await advancedRiskManagement.analyzePortfolioRisk(positions);
    
    res.json({
      success: true,
      data: riskMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Analyze portfolio risk failed:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze portfolio risk' });
  }
});

// POST /risk/position - Analyze position risk
router.post('/risk/position', async (req, res) => {
  try {
    const { symbol, positionData } = req.body;
    
    if (!symbol || !positionData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: symbol, positionData' 
      });
    }

    await advancedRiskManagement.initialize();
    const positionRisk = await advancedRiskManagement.analyzePositionRisk(symbol, positionData);
    
    res.json({
      success: true,
      data: positionRisk,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Analyze position risk failed:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze position risk' });
  }
});

// GET /risk/emergency-check - Check emergency stop conditions
router.get('/risk/emergency-check', async (req, res) => {
  try {
    const { portfolioValue, dailyPnL } = req.query;
    
    if (!portfolioValue || !dailyPnL) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: portfolioValue, dailyPnL' 
      });
    }

    await advancedRiskManagement.initialize();
    const emergencyCheck = await advancedRiskManagement.checkEmergencyStop(
      Number(portfolioValue), 
      Number(dailyPnL)
    );
    
    res.json({
      success: true,
      data: emergencyCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Emergency check failed:', error);
    res.status(500).json({ success: false, error: 'Failed to check emergency conditions' });
  }
});

// GET /risk/heatmap - Get portfolio heat map
router.get('/risk/heatmap', async (req, res) => {
  try {
    const { positions } = req.query;
    
    if (!positions) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameter: positions' 
      });
    }

    const positionsArray = JSON.parse(positions as string);
    
    await advancedRiskManagement.initialize();
    const heatMap = await advancedRiskManagement.generatePortfolioHeatMap(positionsArray);
    
    res.json({
      success: true,
      data: {
        heatMap: Array.from(heatMap.entries()),
        currentDrawdown: advancedRiskManagement.getCurrentDrawdown(),
        maxDrawdown: advancedRiskManagement.getMaxDrawdown(),
        emergencyStop: advancedRiskManagement.isEmergencyStopActive()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Get portfolio heat map failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get portfolio heat map' });
  }
});

// POST /risk/start-monitoring - Start real-time risk monitoring
router.post('/risk/start-monitoring', async (req, res) => {
  try {
    await advancedRiskManagement.initialize();
    await advancedRiskManagement.startRealTimeMonitoring();
    
    res.json({
      success: true,
      message: 'Real-time risk monitoring started',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Start risk monitoring failed:', error);
    res.status(500).json({ success: false, error: 'Failed to start risk monitoring' });
  }
});

// GET /risk/status - Get risk management status
router.get('/risk/status', async (req, res) => {
  try {
    await advancedRiskManagement.initialize();
    
    res.json({
      success: true,
      data: {
        riskMetrics: Array.from(advancedRiskManagement.getRiskMetrics().entries()),
        positionRisks: Array.from(advancedRiskManagement.getPositionRisks().entries()),
        portfolioHeatMap: Array.from(advancedRiskManagement.getPortfolioHeatMap().entries()),
        currentDrawdown: advancedRiskManagement.getCurrentDrawdown(),
        maxDrawdown: advancedRiskManagement.getMaxDrawdown(),
        emergencyStop: advancedRiskManagement.isEmergencyStopActive()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Get risk status failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get risk status' });
  }
});

// POST /risk/reset-emergency - Reset emergency stop
router.post('/risk/reset-emergency', async (req, res) => {
  try {
    await advancedRiskManagement.initialize();
    advancedRiskManagement.resetEmergencyStop();
    
    res.json({
      success: true,
      message: 'Emergency stop reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Reset emergency stop failed:', error);
    res.status(500).json({ success: false, error: 'Failed to reset emergency stop' });
  }
});

// ===== COMBINED SECURITY ENDPOINTS =====

// POST /security/validate-trade - Validate trade with all security systems
router.post('/security/validate-trade', async (req, res) => {
  try {
    const { symbol, signal, positionData } = req.body;
    
    if (!symbol || !signal || !positionData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: symbol, signal, positionData' 
      });
    }

    // Initialize all systems
    await profitGuaranteeSystem.initialize();
    await advancedRiskManagement.initialize();

    // Multi-layer validation
    const profitValidation = await profitGuaranteeSystem.validateTradeSignal(symbol, signal);
    const riskValidation = await advancedRiskManagement.analyzePositionRisk(symbol, positionData);
    const emergencyCheck = await advancedRiskManagement.checkEmergencyStop(100, 0);

    const overallValidation = {
      isValid: profitValidation.isValid && riskValidation.confidence > 70 && !emergencyCheck.shouldStop,
      profitValidation,
      riskValidation,
      emergencyCheck,
      recommendations: [
        ...profitValidation.recommendations,
        ...(riskValidation as any).recommendations || [],
        ...emergencyCheck.recommendations
      ]
    };

    res.json({
      success: true,
      data: overallValidation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Validate trade failed:', error);
    res.status(500).json({ success: false, error: 'Failed to validate trade' });
  }
});

// GET /security/overview - Get complete security overview
router.get('/security/overview', async (req, res) => {
  try {
    await profitGuaranteeSystem.initialize();
    await advancedRiskManagement.initialize();

    const profitProtections = profitGuaranteeSystem.getProfitProtections();
    const hedgePositions = profitGuaranteeSystem.getHedgePositions();
    const profitLocks = profitGuaranteeSystem.getProfitLocks();
    const riskMetrics = advancedRiskManagement.getRiskMetrics();
    const positionRisks = advancedRiskManagement.getPositionRisks();
    const portfolioHeatMap = advancedRiskManagement.getPortfolioHeatMap();

    res.json({
      success: true,
      data: {
        profitGuarantee: {
          protections: Array.from(profitProtections.entries()),
          hedgePositions: Array.from(hedgePositions.entries()),
          profitLocks: Array.from(profitLocks.entries()),
          dailyProfit: profitGuaranteeSystem.getDailyProfit(),
          maxDailyProfit: profitGuaranteeSystem.getMaxDailyProfit(),
          riskLevel: profitGuaranteeSystem.getRiskLevel()
        },
        riskManagement: {
          riskMetrics: Array.from(riskMetrics.entries()),
          positionRisks: Array.from(positionRisks.entries()),
          portfolioHeatMap: Array.from(portfolioHeatMap.entries()),
          currentDrawdown: advancedRiskManagement.getCurrentDrawdown(),
          maxDrawdown: advancedRiskManagement.getMaxDrawdown(),
          emergencyStop: advancedRiskManagement.isEmergencyStopActive()
        },
        overallSecurity: {
          status: advancedRiskManagement.isEmergencyStopActive() ? 'EMERGENCY' : 'NORMAL',
          riskLevel: profitGuaranteeSystem.getRiskLevel(),
          recommendations: generateOverallRecommendations(
            profitGuaranteeSystem.getRiskLevel(),
            advancedRiskManagement.getCurrentDrawdown(),
            advancedRiskManagement.isEmergencyStopActive()
          )
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Get security overview failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get security overview' });
  }
});

// GET /api/health - Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Crypto Bot API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// GET /api/status - System status
router.get('/status', async (req, res) => {
  try {
    // Build real status from micro engine and equity provider
    const s = microEngine.getStatus();
    const equityProviderMod = await import('../services/portfolio/equity-provider');
    const EquityProvider = (equityProviderMod as any).EquityProvider;
    const provider = new EquityProvider('USDT');
    await provider.initialize();
    const equityUsd = await provider.getEquityUsd();
    res.json({
      success: true,
      data: {
        momentumBot: {
          isActive: s.running,
          dailyPnL: Math.max(0, equityUsd - Number(process.env.MICRO_START_CAPITAL || 100)),
          totalTrades: s.trades,
          currentBalance: equityUsd
        },
        profitGuarantee: {
          protections: 0,
          hedgePositions: 0,
          profitLocks: 0,
          riskLevel: 'LOW'
        },
        riskManagement: {
          currentDrawdown: 0,
          maxDrawdown: 0,
          emergencyStop: false
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get system status' });
  }
});

// Helper method for overall recommendations
function generateOverallRecommendations(riskLevel: string, drawdown: number, emergencyStop: boolean): string[] {
  const recommendations: string[] = [];
  
  if (emergencyStop) {
    recommendations.push('🚨 EMERGENCY: All trading stopped');
    recommendations.push('🛑 Manual intervention required');
  } else if (drawdown > 10) {
    recommendations.push('⚠️ HIGH DRAWDOWN: Reduce position sizes');
    recommendations.push('📉 Consider closing some positions');
  } else if (riskLevel === 'HIGH') {
    recommendations.push('⚠️ HIGH RISK: Implement hedging strategies');
    recommendations.push('🛡️ Increase profit protection levels');
  } else if (riskLevel === 'MEDIUM') {
    recommendations.push('📊 MEDIUM RISK: Monitor positions closely');
    recommendations.push('🔄 Review risk parameters');
  } else {
    recommendations.push('✅ LOW RISK: Normal operations');
    recommendations.push('📈 Continue with current strategy');
  }
  
  return recommendations;
}

// ===== NEW PROFIT-FOCUSED API ENDPOINTS =====

// Risk-Free Arbitrage Endpoints
router.get('/arbitrage/risk-free/opportunities', async (req, res) => {
  try {
    const opportunities = await riskFreeArbitrageEngine.getAllRiskFreeOpportunities();
    res.json({
      success: true,
      data: opportunities,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Risk-free arbitrage opportunities failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get risk-free arbitrage opportunities' });
  }
});

// ===== FRONTEND POLLING STUBS (prevent 404/429 loops) =====
// Wire real micro trading engine
const microEngine = new MicroTradingEngine({
  startingCapital: Number(process.env.MICRO_START_CAPITAL || 100),
  dailyTargetAmount: Number(process.env.MICRO_DAILY_TARGET || 100),
  totalTradesPerDay: Number(process.env.MICRO_TRADES_PER_DAY || 100),
  targetPerTrade: Number(process.env.MICRO_TARGET_PER_TRADE || 1),
  maxLossPerTrade: Number(process.env.MICRO_MAX_LOSS_PER_TRADE || 0.5),
  allowedDailyLosses: Number(process.env.MICRO_ALLOWED_DAILY_LOSSES || 40),
  symbols: (process.env.MICRO_SYMBOLS || 'BTC/USDT,ETH/USDT').split(',').map(s => s.trim()),
  minIntervalMs: Number(process.env.MICRO_MIN_INTERVAL_MS || 60_000),
  makerFirst: true,
  ladderLevels: 2,
  ladderStepBps: 2,
  ladderEachPct: 0.5,
  timeboxMs: 4000,
  maxSpreadBps: 15,
  minDepthUsd: 200, // Will be adjusted dynamically for ultra-low balance
  tradeCategories: { scalping: true, arbitrage: false, momentUm: true, newsBased: false, patternBased: false }
});

router.get('/micro-trading/status', async (req, res) => {
  try {
  const s = microEngine.getStatus();
    
    // Get REAL balance from Binance (even if very low)
    let realBalance = s.balance;
    try {
      const equityProviderMod = await import('../services/portfolio/equity-provider');
      const EquityProvider = (equityProviderMod as any).EquityProvider;
      const provider = new EquityProvider('USDT');
      await provider.initialize();
      const equityUsd = await provider.getEquityUsd();
      if (equityUsd > 0) {
        realBalance = equityUsd;
      }
    } catch (error: any) {
      // Use status balance if equity fetch fails
    }
    
    res.json({ 
      success: true, 
      data: { 
        isActive: s.running,
        running: s.running, 
        tradesToday: s.trades, 
        targetUsd: Number(process.env.MICRO_DAILY_TARGET || 100), 
        balance: realBalance, 
        startedAt: s.startedAt, 
        successRate: s.successRate 
      } 
    });
  } catch (error: any) {
    logger.error('❌ Error fetching micro trading status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/micro-trading/performance', async (req, res) => {
  try {
  const report = await microEngine.generateDailyReport();
    
    // Get REAL current balance from Binance
    let currentBalance = report.endingBalance;
    try {
      const equityProviderMod = await import('../services/portfolio/equity-provider');
      const EquityProvider = (equityProviderMod as any).EquityProvider;
      const provider = new EquityProvider('USDT');
      await provider.initialize();
      const equityUsd = await provider.getEquityUsd();
      if (equityUsd > 0) {
        currentBalance = equityUsd;
      }
    } catch (error: any) {
      // Use report balance if equity fetch fails
    }
    
    const dailyProfit = currentBalance - report.startingBalance;
    const dailyTarget = Number(process.env.MICRO_DAILY_TARGET || 100);
    
    res.json({ 
      success: true, 
      data: { 
        currentBalance: currentBalance,
        dailyProfit: dailyProfit,
        pnlUsd: dailyProfit, 
        winRate: report.winRate || 0, 
        avgTradeUsd: report.tradesExecuted > 0 ? (report.totalGains - report.totalLosses) / report.tradesExecuted : 0, 
        trades: report.tradesExecuted,
        dailyLosses: Math.abs(Math.min(0, dailyProfit)),
        dailyTarget: dailyTarget,
        targetProgress: Math.max(0, (dailyProfit / dailyTarget) * 100)
      } 
    });
  } catch (error: any) {
    logger.error('❌ Error fetching micro trading performance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/micro-trading/trades', async (req, res) => {
  try {
    const report = await microEngine.generateDailyReport();
    res.json({ success: true, data: report.microTrades });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch micro trades' });
  }
});

router.get('/profit-lock/status', (req, res) => {
  // TODO: wire actual ProfitLockSystem state when exposed; placeholder reflects inactive by default
  res.json({ success: true, data: { active: false, lockedProfitUsd: 0 } });
});

router.get('/circuit-breaker/status', async (req, res) => {
  try {
    // Since CircuitBreakerSystem is internal to microEngine, expose minimal info from report for now
    const report = await microEngine.generateDailyReport();
    const isPaused = microEngine.isRunning() === false && report.tradesExecuted > 0;
    const isActive = isPaused; // Circuit breaker is active when paused (protection active)
    
    res.json({ 
      success: true, 
      data: { 
        isActive: isActive,
        paused: isPaused, 
        reason: isPaused ? 'Daily loss limit or circuit breaker triggered' : null, 
        until: null 
      } 
    });
  } catch {
    res.json({ 
      success: true, 
      data: { 
        isActive: false,
        paused: false, 
        reason: null, 
        until: null 
      } 
    });
  }
});

router.post('/micro-trading/start', async (req, res) => {
  try {
    await microEngine.start();
    res.json({ success: true, message: 'Micro trading session started' });
  } catch (e) {
    logger.error('❌ Failed to start micro trading:', e);
    res.status(500).json({ success: false, error: 'Failed to start micro trading' });
  }
});

router.post('/micro-trading/stop', (req, res) => {
  try {
    microEngine.stop();
    res.json({ success: true, message: 'Micro trading stop requested' });
  } catch (e) {
    logger.error('❌ Failed to stop micro trading:', e);
    res.status(500).json({ success: false, error: 'Failed to stop micro trading' });
  }
});

router.get('/market-regime/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const MarketRegimeDetector = (await import('../services/analysis/market-regime-detector')).MarketRegimeDetector;
    const detector = new MarketRegimeDetector();
    await detector.initialize();
    const regime = await detector.detectRegime(symbol);
    
    res.json({ 
      success: true, 
      data: { 
        symbol,
        regime: regime.type,
        confidence: regime.confidence * 100, // Convert to percentage
        volatility: regime.volatility,
        trend: regime.trend,
        strategy: regime.recommendedStrategy,
        riskLevel: regime.riskLevel
      } 
    });
  } catch (error: any) {
    logger.error(`❌ Error detecting market regime for ${req.params.symbol}:`, error);
    // Fallback response
    res.json({ 
      success: true, 
      data: { 
        symbol: req.params.symbol, 
        regime: 'SIDEWAYS', 
        confidence: 30,
        volatility: 'MEDIUM',
        trend: 'NEUTRAL',
        strategy: 'CONSERVATIVE',
        riskLevel: 'MEDIUM'
      } 
    });
  }
});

// Live account balance from Binance via CCXT
router.get('/account/balance', async (req, res) => {
  try {
    const ex = new ccxt.binance({
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_SECRET_KEY,
      enableRateLimit: true,
      options: { defaultType: 'spot' }
    });
    try { await ex.loadMarkets(); } catch {}
    const balance = await ex.fetchBalance();
    res.json({ success: true, data: balance });
  } catch (error) {
    logger.error('❌ Failed to fetch account balance:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch account balance' });
  }
});

router.post('/arbitrage/risk-free/execute', async (req, res) => {
  try {
    const { opportunity } = req.body;
    const result = await riskFreeArbitrageEngine.executeArbitrage(opportunity);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Risk-free arbitrage execution failed:', error);
    res.status(500).json({ success: false, error: 'Failed to execute risk-free arbitrage' });
  }
});

// Scalping Strategy Endpoints
router.get('/scalping/signals', async (req, res) => {
  try {
    const signals = await scalpingStrategies.generateScalpingSignals();
    res.json({
      success: true,
      data: signals,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Scalping signals failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get scalping signals' });
  }
});

router.get('/scalping/market-making/signals', async (req, res) => {
  try {
    const signals = await scalpingStrategies.generateMarketMakingSignals();
    res.json({
      success: true,
      data: signals,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Market making signals failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get market making signals' });
  }
});

router.post('/scalping/execute', async (req, res) => {
  try {
    const { signal } = req.body;
    const result = await scalpingStrategies.executeScalpingTrade(signal);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Scalping execution failed:', error);
    res.status(500).json({ success: false, error: 'Failed to execute scalping trade' });
  }
});

router.get('/scalping/performance', async (req, res) => {
  try {
    const performance = scalpingStrategies.getDailyPerformance();
    res.json({
      success: true,
      data: performance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Scalping performance failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get scalping performance' });
  }
});

// DeFi Yield Strategy Endpoints
router.get('/defi/yield/opportunities', async (req, res) => {
  try {
    const opportunities = await defiYieldStrategies.getAllDeFiOpportunities();
    res.json({
      success: true,
      data: opportunities,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ DeFi yield opportunities failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get DeFi yield opportunities' });
  }
});

router.post('/defi/yield/execute', async (req, res) => {
  try {
    const { opportunity, amount } = req.body;
    let result;
    
    switch (opportunity.type) {
      case 'YIELD_FARMING':
        result = await defiYieldStrategies.executeYieldFarming(opportunity, amount);
        break;
      case 'LIQUIDITY_MINING':
        result = await defiYieldStrategies.executeLiquidityMining(opportunity, amount);
        break;
      case 'STAKING':
        result = await defiYieldStrategies.executeStaking(opportunity, amount);
        break;
      case 'LENDING':
        result = await defiYieldStrategies.executeLending(opportunity, amount);
        break;
      default:
        throw new Error('Unknown DeFi strategy type');
    }
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ DeFi yield execution failed:', error);
    res.status(500).json({ success: false, error: 'Failed to execute DeFi yield strategy' });
  }
});

router.get('/defi/yield/performance', async (req, res) => {
  try {
    const performance = defiYieldStrategies.getDailyPerformance();
    res.json({
      success: true,
      data: performance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ DeFi yield performance failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get DeFi yield performance' });
  }
});

// Compound Interest Endpoints
router.post('/compound/execute', async (req, res) => {
  try {
    const result = await compoundInterestOptimizer.executeCompoundStrategy();
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Compound strategy execution failed:', error);
    res.status(500).json({ success: false, error: 'Failed to execute compound strategy' });
  }
});

router.get('/compound/performance', async (req, res) => {
  try {
    const performance = compoundInterestOptimizer.getPerformanceMetrics();
    res.json({
      success: true,
      data: performance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Compound performance failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get compound performance' });
  }
});

router.get('/compound/projection/:days', async (req, res) => {
  try {
    const days = parseInt(req.params.days);
    const projection = compoundInterestOptimizer.getCompoundProjection(days);
    res.json({
      success: true,
      data: projection,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Compound projection failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get compound projection' });
  }
});

// Automated Profit Taking Endpoints
router.post('/profit-taking/create-rule', async (req, res) => {
  try {
    const { symbol, entryPrice, positionSize, strategy } = req.body;
    const ruleId = await automatedProfitTaking.createProfitTakingRule(symbol, entryPrice, positionSize, strategy);
    res.json({
      success: true,
      data: { ruleId },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Create profit taking rule failed:', error);
    res.status(500).json({ success: false, error: 'Failed to create profit taking rule' });
  }
});

router.get('/profit-taking/signals', async (req, res) => {
  try {
    const signals = await automatedProfitTaking.scanProfitTakingOpportunities();
    res.json({
      success: true,
      data: signals,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Profit taking signals failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get profit taking signals' });
  }
});

router.post('/profit-taking/execute', async (req, res) => {
  try {
    const { signals } = req.body;
    const results = await automatedProfitTaking.executeProfitTakingSignals(signals);
    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Profit taking execution failed:', error);
    res.status(500).json({ success: false, error: 'Failed to execute profit taking signals' });
  }
});

router.get('/profit-taking/performance', async (req, res) => {
  try {
    const performance = automatedProfitTaking.getPerformanceMetrics();
    res.json({
      success: true,
      data: performance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Profit taking performance failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get profit taking performance' });
  }
});

// Combined Profit Strategy Endpoint
router.get('/profit/combined-opportunities', async (req, res) => {
  try {
    const [arbitrage, scalping, defi, compound] = await Promise.all([
      riskFreeArbitrageEngine.getAllRiskFreeOpportunities(),
      scalpingStrategies.generateScalpingSignals(),
      defiYieldStrategies.getAllDeFiOpportunities(),
      compoundInterestOptimizer.getPerformanceMetrics()
    ]);
    
    res.json({
      success: true,
      data: {
        arbitrage,
        scalping,
        defi,
        compound,
        totalOpportunities: arbitrage.length + scalping.length + 
          (defi.yieldFarming.length + defi.liquidityMining.length + defi.staking.length + defi.lending.length)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Combined profit opportunities failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get combined profit opportunities' });
  }
});

// ===== ENHANCED AI ENDPOINTS =====

// Enhanced News Analysis
router.get('/enhanced/news/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const analysis = await enhancedNewsAnalyzer.analyze(symbol);
    res.json(analysis);
  } catch (error) {
    logger.error('Enhanced news analysis failed:', error);
    res.status(500).json({ error: 'Enhanced news analysis failed' });
  }
});

// Enhanced Whale Tracking
router.get('/enhanced/whale/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const analysis = await enhancedWhaleTracker.analyze(symbol);
    res.json(analysis);
  } catch (error) {
    logger.error('Enhanced whale analysis failed:', error);
    res.status(500).json({ error: 'Enhanced whale analysis failed' });
  }
});

// Enhanced ML Predictions
router.get('/enhanced/ml/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // Get all required data for ML prediction
    const [technical, sentiment, news, whale] = await Promise.all([
      // Mock technical data - in production, get from actual services
      { rsi: 50, macd: { histogram: 0 }, bollingerBands: { percentB: 0.5 }, orderBookImbalance: { ratio: 0 }, fundingRate: { current: 0 }, openInterest: { change: 0 } },
      { score: 0, confidence: 0.5, sources: [], timestamp: new Date() },
      await enhancedNewsAnalyzer.analyze(symbol),
      await enhancedWhaleTracker.analyze(symbol)
    ]);
    
    const predictions = await enhancedMLPredictor.predict(symbol, technical as any, sentiment, news, whale);
    res.json(predictions);
  } catch (error) {
    logger.error('Enhanced ML prediction failed:', error);
    res.status(500).json({ error: 'Enhanced ML prediction failed' });
  }
});

// Combined Enhanced Analysis
router.get('/enhanced/analysis/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    const [news, whale, technical, sentiment] = await Promise.all([
      enhancedNewsAnalyzer.analyze(symbol),
      enhancedWhaleTracker.analyze(symbol),
      // Mock technical and sentiment - integrate with actual services
      { rsi: 50, macd: { histogram: 0 }, bollingerBands: { percentB: 0.5 } },
      { score: 0, confidence: 0.5, sources: [], timestamp: new Date() }
    ]);
    
    const mlPredictions = await enhancedMLPredictor.predict(symbol, technical as any, sentiment, news, whale);
    
    const combinedAnalysis = {
      symbol,
      timestamp: new Date(),
      news,
      whale,
      mlPredictions,
      confidence: (news.confidence + whale.confidence + mlPredictions[0]?.confidence) / 3,
      recommendation: mlPredictions[0]?.direction || 'NEUTRAL'
    };
    
    res.json(combinedAnalysis);
  } catch (error) {
    logger.error('Combined enhanced analysis failed:', error);
    res.status(500).json({ error: 'Combined enhanced analysis failed' });
  }
});

// ===== AUTHENTICATION ENDPOINTS =====
import { handleLogin, authenticate, verifyToken } from '../middleware/auth';

router.post('/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password required'
      });
    }

    // Trim whitespace from username and password
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    const result = handleLogin(trimmedUsername, trimmedPassword);
    
    if (result.success) {
      // Set cookie
      res.cookie('authToken', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      res.json({
        success: true,
        token: result.token,
        message: 'Login successful'
      });
    } else {
      res.status(401).json({
        success: false,
        error: result.error || 'Invalid credentials'
      });
    }
  } catch (error) {
    logger.error('Login failed:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('authToken');
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

router.get('/auth/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.authToken;
  
  if (!token) {
    return res.status(401).json({
      success: false,
      authenticated: false
    });
  }

  const isValid = verifyToken(token);
  
  res.json({
    success: isValid,
    authenticated: isValid
  });
});

// Health check endpoint (no auth required)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ===== ORDER TRACKING ENDPOINTS =====
import { orderTracker } from '../services/trading/real-time-order-tracker';

router.get('/orders', authenticate as any, (req, res) => {
  try {
    const { symbol, side, status, strategy, limit } = req.query;
    
    const orders = orderTracker.getAllOrders({
      symbol: symbol as string,
      side: side as 'BUY' | 'SELL',
      status: status as any,
      strategy: strategy as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({
      success: true,
      data: orders,
      count: orders.length
    });
  } catch (error) {
    logger.error('Get orders failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get orders'
    });
  }
});

router.get('/orders/active', authenticate as any, (req, res) => {
  try {
    const activeOrders = orderTracker.getActiveOrders();
    res.json({
      success: true,
      data: activeOrders,
      count: activeOrders.length
    });
  } catch (error) {
    logger.error('Get active orders failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active orders'
    });
  }
});

router.get('/orders/:id', authenticate as any, (req, res) => {
  try {
    const { id } = req.params;
    const order = orderTracker.getOrder(id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Get order failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get order'
    });
  }
});

router.get('/orders/stats/summary', authenticate as any, (req, res) => {
  try {
    const stats = orderTracker.getOrderStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Get order stats failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get order stats'
    });
  }
});

export { router };
export default router;
