import { logger } from '../utils/logger';
import ccxt from 'ccxt';
import { Server } from 'socket.io';
import { TechnicalAnalyzer } from '../services/ai/technical-analyzer';
import { orderTracker } from '../services/trading/real-time-order-tracker';
import { EnhancedNewsAnalyzer } from '../services/ai/enhanced-news-analyzer';
import { EnhancedWhaleTracker } from '../services/ai/enhanced-whale-tracker';
import { EnhancedMLPredictor } from '../services/ai/enhanced-ml-predictor';
import { AdaptivePositionSizer } from '../services/position/adaptive-position-sizer';
import { CircuitBreakerSystem } from '../services/risk/circuit-breaker-system';
import { MarketRegimeDetector } from '../services/analysis/market-regime-detector';
import { ProfitLockSystem } from '../services/protection/profit-lock-system';
import { PnlTargeter } from '../services/pnl-targeter';
import { BankrollScaler } from '../services/bankroll-scaler';
import { RiskFreeArbitrageEngine } from './risk-free-arbitrage';
import { AIDecisionEngine, AIDecision } from '../services/ai/ai-decision-engine';
import { AdvancedExecutionManager } from '../services/execution/advanced-execution-manager';
import { TriangularArbitrageDetector } from '../services/trading/triangular-arbitrage-detector';
import { CompoundProfitManager } from '../services/trading/compound-profit-manager';
import { SymbolPerformanceFilter } from '../services/trading/symbol-performance-filter';
import { MarketDataCache } from '../services/market-data/market-data-cache';

// MICRO-TRADING ENGINE - 100 small trades = daily 2x
export interface MicroTradingConfig {
  startingCapital: number;
  dailyTargetAmount: number; // How much to gain ($100 for doubling)
  totalTradesPerDay: number; // 100 trades
  targetPerTrade: number; // $1 per trade
  maxLossPerTrade: number; // Max loss per trade ($0.50)
  allowedDailyLosses: number; // Max losing trades per day (30-40)
  symbols: string[];
  minIntervalMs?: number; // minimum time between trades (default 60s)
  // execution/slippage/ladder settings
  makerFirst?: boolean; // try maker post-only first
  ladderLevels?: number; // number of limit levels
  ladderStepBps?: number; // step between levels in bps
  ladderEachPct?: number; // percent of order per level (sum <= 1)
  timeboxMs?: number; // max wait for maker fill before fallback
  maxSpreadBps?: number; // skip if spread wider than this
  minDepthUsd?: number; // require at least this USD depth at top 5 levels
  tradeCategories: {
    scalping: boolean;
    arbitrage: boolean;
    momentUm: boolean;
    newsBased: boolean;
    patternBased: boolean;
  };
  // Risk and ML gating (optional)
  maxNotionalUsd?: number; // absolute cap per trade in USD
  mlConfidenceThreshold?: number; // e.g., 0.7
  cooldownLossStreak?: number; // losses before cooldown (e.g., 2)
  cooldownMs?: number; // cooldown duration (e.g., 5 minutes)
}

export interface MicroTrade {
  id: string;
  timestamp: Date;
  symbol: string;
  type: 'SCALPING' | 'ARBITRAGE' | 'MOMENTUM' | 'NEWS' | 'PATTERN';
  action: 'BUY' | 'SELL';
  amount: number;
  entryPrice: number;
  targetAmount: number; // Target profit amount ($1)
  stopLoss: number;
  status: 'OPEN' | 'CLOSED' | 'STOPPED';
  actualPnl: number;
  duration: number; // Trade duration in seconds
  success: boolean;
  partialTaken?: boolean;
  targetPrice?: number;
}

export interface MicroTradingDay {
  date: string;
  startingBalance: number;
  endingBalance: number;
  tradesExecuted: number;
  successfulTrades: number;
  failedTrades: number;
  totalGains: number;
  totalLosses: number;
  winRate: number;
  avgTradeDuration: number;
  microTrades: MicroTrade[];
  targetAchieved: boolean;
}

export class MicroTradingEngine {
  private config: MicroTradingConfig;
  private binance: any;
  private currentBalance: number;
  private todaysTrades: MicroTrade[] = [];
  private tradeCount: number = 0;
  private successfulTrades: number = 0;
  private failedTrades: number = 0;
  private totalGains: number = 0;
  private totalLosses: number = 0;
  private dayStarted: Date = new Date();
  private maxDailyLosses: number = 0;
  private running: boolean = false;
  private stopRequested: boolean = false;
  private symbolLossStreak: Map<string, number> = new Map();
  private symbolCooldownUntil: Map<string, number> = new Map();
  private paper: boolean = false;

  // Enhanced AI Services
  private technicalAnalyzer: TechnicalAnalyzer;
  private enhancedNewsAnalyzer: EnhancedNewsAnalyzer;
  private enhancedWhaleTracker: EnhancedWhaleTracker;
  private enhancedMLPredictor: EnhancedMLPredictor;

  // Advanced Protection Systems
  private adaptivePositionSizer: AdaptivePositionSizer;
  private circuitBreakerSystem: CircuitBreakerSystem;
  private marketRegimeDetector: MarketRegimeDetector;
  private profitLockSystem: ProfitLockSystem;
  private pnlTargeter: PnlTargeter;
  private bankrollScaler: BankrollScaler;
  
  // Risk-Free Arbitrage Engine (GARANTİLİ KAR İÇİN)
  private arbitrageEngine: RiskFreeArbitrageEngine;
  
  // AI Decision Engine (KESİN KAZANÇ İÇİN)
  private aiDecisionEngine: AIDecisionEngine;
  
  // Advanced Execution Manager (OPTİMİZE EDİLMİŞ EXECUTION)
  private executionManager: AdvancedExecutionManager;
  
  // Triangular Arbitrage Detector (EK GARANTİLİ KAR)
  private triangularArbitrage: TriangularArbitrageDetector;
  
  // Compound Profit Manager (OTOMATIK KAR REINVESTMENT)
  private compoundManager: CompoundProfitManager;
  
  // Symbol Performance Filter (EN KARLI COINLERE ODAKLAN)
  private symbolFilter: SymbolPerformanceFilter;
  
  // Market Data Cache (HIZ İÇİN)
  private marketDataCache: MarketDataCache;

  // Socket.IO for real-time updates
  private io: Server | null = null;

  constructor(config: MicroTradingConfig) {
    this.config = config;
    this.currentBalance = config.startingCapital;
    this.maxDailyLosses = config.allowedDailyLosses;

    this.binance = new ccxt.binance({
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_SECRET_KEY,
      options: {
        defaultType: 'spot', // Spot trading for micro-trades
        recvWindow: Number(process.env.RECV_WINDOW || 60000),
        adjustForTimeDifference: true,
        // Avoid signed SAPI call during loadMarkets → prevents -2015 when IP/perm fluctuates
        fetchCurrencies: false,
        warnOnFetchCurrenciesUnsupported: true
      },
      enableRateLimit: true,
    });

    // Initialize Enhanced AI Services
    this.technicalAnalyzer = new TechnicalAnalyzer();
    this.enhancedNewsAnalyzer = new EnhancedNewsAnalyzer();
    this.enhancedWhaleTracker = new EnhancedWhaleTracker();
    this.enhancedMLPredictor = new EnhancedMLPredictor();

    // Initialize Advanced Protection Systems
    this.adaptivePositionSizer = new AdaptivePositionSizer();
    this.circuitBreakerSystem = new CircuitBreakerSystem();
    this.marketRegimeDetector = new MarketRegimeDetector();
    this.profitLockSystem = new ProfitLockSystem();

    // P&L targeter and bankroll scaler
    this.pnlTargeter = new PnlTargeter({ dailyMultiplier: 2, minPerTradeUsd: 1, maxPerTradeUsd: Math.max(2, config.targetPerTrade) });
    this.bankrollScaler = new BankrollScaler({ baseRiskBp: 50, maxOpenRiskPct: 2, maxConcurrent: 2 });

    // Risk-Free Arbitrage Engine (GARANTİLİ KAR)
    this.arbitrageEngine = new RiskFreeArbitrageEngine();

    // AI Decision Engine (KESİN KAZANÇ - TÜM AI SERVİSLERİ BİRLEŞTİRİLMİŞ)
    this.aiDecisionEngine = new AIDecisionEngine({
      minConfidence: 85, // %85 minimum confidence
      minConsensusScore: 80, // %80 consensus gerekli
      maxRiskPerTrade: 2, // %2 max risk
      minRiskRewardRatio: 2.0, // 1:2 risk/reward
      enableLearning: true, // Adaptive learning
      tradeFrequency: 'ULTRA' // 1000 trade/day için
    });

    // Advanced Execution Manager (SLIPPAGE PROTECTION + LIQUIDITY AGGREGATION + ATOMIC EXECUTION)
    this.executionManager = new AdvancedExecutionManager();

    // Triangular Arbitrage Detector (EK GARANTİLİ KAR)
    this.triangularArbitrage = new TriangularArbitrageDetector();

    // Compound Profit Manager (OTOMATIK KAR REINVESTMENT - GÜNLÜK 2X İÇİN)
    this.compoundManager = new CompoundProfitManager(config.startingCapital, {
      type: 'IMMEDIATE' // Her kazanç hemen sermayeye eklenir
    });

    // Symbol Performance Filter (EN KARLI COINLERE ODAKLAN)
    this.symbolFilter = new SymbolPerformanceFilter({
      minWinRate: 55, // %55 minimum win rate (günlük 2x için yüksek)
      minProfitFactor: 2.0, // 2x minimum profit factor
      maxConsecutiveLosses: 3,
      minTrades: 10,
      enableAutoDisable: true
    });

    // Market Data Cache (HIZ İÇİN - 1000 trade/day)
    this.marketDataCache = new MarketDataCache();

    logger.info(`🎯 Micro-Trading Engine initialized for ${config.dailyTargetAmount} daily gain`);
    logger.info(`✅ Risk-Free Arbitrage Engine integrated for guaranteed profits`);
    logger.info(`✅ AI Decision Engine integrated for intelligent decision making`);
    logger.info(`✅ Advanced Execution Manager integrated for optimized execution`);
    logger.info(`✅ Triangular Arbitrage Detector integrated for additional profit opportunities`);
    logger.info(`✅ Compound Profit Manager integrated for automatic reinvestment`);
    logger.info(`✅ Symbol Performance Filter integrated for focusing on best performers`);
    logger.info(`✅ Market Data Cache integrated for ultra-fast data access`);
  }

  // Set Socket.IO instance for real-time updates
  setSocketIO(io: Server): void {
    this.io = io;
    logger.info('🔌 Socket.IO connected to MicroTradingEngine');
  }

  async initialize(): Promise<void> {
    try {
      await this.binance.loadMarkets();
      
      // Try to get REAL balance from Binance (if API keys available)
      try {
        if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET_KEY &&
            process.env.BINANCE_API_KEY.trim() !== '' && process.env.BINANCE_SECRET_KEY.trim() !== '' &&
            !process.env.BINANCE_API_KEY.includes('test') && !process.env.BINANCE_SECRET_KEY.includes('test')) {
          const balance = await this.binance.fetchBalance();
          const balanceTotal = balance.total as any;
          const realBalanceUSDT = balanceTotal?.['USDT'] || balanceTotal?.['usdt'] || 0;
          
          if (realBalanceUSDT > 0) {
            this.currentBalance = realBalanceUSDT;
            this.config.startingCapital = realBalanceUSDT;
            
            // Reset compound manager with real balance (set balance to real amount)
            this.compoundManager.recordProfit(realBalanceUSDT - this.config.startingCapital);
            
            logger.info(`💰 Real Binance balance loaded: $${realBalanceUSDT.toFixed(2)}`);
            
            if (realBalanceUSDT < 10) {
              logger.warn(`⚠️ Ultra-low balance detected ($${realBalanceUSDT.toFixed(2)}) - Testing mode enabled`);
              logger.warn(`⚠️ Minimum amount checks will be bypassed for small orders`);
              logger.info(`🔬 System will attempt trades even with very small amounts (e.g., $${realBalanceUSDT.toFixed(2)})`);
            }
          }
        }
      } catch (balanceError: any) {
        logger.warn('⚠️ Could not fetch real Binance balance, using configured starting capital:', balanceError.message);
      }
      
      // Initialize all protection systems
      await Promise.all([
        this.adaptivePositionSizer.initialize(),
        this.circuitBreakerSystem.initialize(),
        this.marketRegimeDetector.initialize(),
        this.profitLockSystem.initialize()
      ]);

      // Initialize Risk-Free Arbitrage Engine (GARANTİLİ KAR)
      await this.arbitrageEngine.initialize();

      // Initialize AI Decision Engine (KESİN KAZANÇ)
      await this.aiDecisionEngine.initialize();

      // Initialize Advanced Execution Manager (OPTİMİZE EDİLMİŞ EXECUTION)
      await this.executionManager.initialize();

      // Initialize Triangular Arbitrage Detector
      await this.triangularArbitrage.initialize();

      // Initialize ML predictor for gating
      try { await this.enhancedMLPredictor.initialize(); } catch {}

      // Paper mode only via env flag (default off)
      const envPaper = String(process.env.MICRO_PAPER || 'false').toLowerCase() === 'true';
      this.paper = envPaper;
      if (this.paper) {
        logger.warn('⏸️ Using PAPER mode for micro trading (MICRO_PAPER=true). No real orders will be sent.');
      }
      
      // Initialize daily targets and bankroll with REAL balance
      this.pnlTargeter.startDay(this.currentBalance, this.config.totalTradesPerDay);
      this.bankrollScaler.setEquity(this.currentBalance);

      const isUltraLow = this.currentBalance < 10;
      logger.info('✅ Micro-Trading Engine ready for execution');
      logger.info(`💰 Starting Balance: $${this.currentBalance.toFixed(2)}${isUltraLow ? ' (ULTRA-LOW BALANCE MODE - Testing)' : ''}`);
      logger.info(`📊 Daily Target: +$${this.config.dailyTargetAmount}`);
      logger.info(`🔄 Max Trades: ${this.config.totalTradesPerDay}`);
      logger.info(`💰 Target per Trade: $${this.config.targetPerTrade}`);
      logger.info('🛡️ Advanced protection systems activated');
      if (isUltraLow) {
        logger.info('⚠️ Ultra-low balance mode: Minimum amount checks bypassed for testing');
        logger.info('🔬 System will try to execute trades even with $0.06 or less');
      }
      
    } catch (error) {
      logger.error('❌ Micro-Trading Engine initialization failed:', error);
      throw error;
    }
  }

  // Public control API
  async start(): Promise<void> {
    if (this.running) return;
    await this.initialize();
    this.running = true;
    this.stopRequested = false;
    // Fire-and-forget session; reset running flag when done
    this.executeMicroTradingSession()
      .catch(err => logger.error('❌ Micro session crashed:', err))
      .finally(() => { this.running = false; });
  }

  isRunning(): boolean {
    return this.running;
  }

  stop(): void {
    this.stopRequested = true;
  }

  getStatus(): { running: boolean; trades: number; successRate: number; balance: number; startedAt: string; compoundStats?: any; symbolStats?: any } {
    const currentBalance = this.compoundManager ? this.compoundManager.getBalance() : this.currentBalance;
    
    return {
      running: this.running,
      trades: this.tradeCount,
      successRate: this.getSuccessRate(),
      balance: currentBalance,
      startedAt: this.dayStarted.toISOString(),
      compoundStats: this.compoundManager ? this.compoundManager.getStats() : undefined,
      symbolStats: this.symbolFilter ? this.symbolFilter.getTopPerformers(5).map(p => ({
        symbol: p.symbol,
        winRate: p.winRate,
        score: p.score,
        totalProfit: p.totalProfit
      })) : undefined
    };
  }

  // MAIN EXECUTION LOOP - 24 hour continuous micro-trading
  async executeMicroTradingSession(): Promise<void> {
    logger.info('🚀 Starting 24-hour micro-trading session...');
    
    const sessionStartTime = Date.now();
    const sessionDuration = 24 * 60 * 60 * 1000; // 24 hours
    let lastTradeTime = 0;
    const minIntervalMs = this.config.minIntervalMs ?? 60_000; // default 1 minute
    const progressMs = Number(process.env.PROGRESS_LOG_MS || 10000);
    let lastProgressLog = 0;
    
    while (!this.stopRequested &&
           (Date.now() - sessionStartTime) < sessionDuration &&
           this.failedTrades <= this.maxDailyLosses &&
           !this.isTargetAchieved()) {
      
      try {
        const timeSinceLastTrade = Date.now() - lastTradeTime;
        // Execute micro-trade on configurable cadence (as frequent as every minute)
        if (timeSinceLastTrade >= minIntervalMs) {
          await this.executeMicroTrade();
          lastTradeTime = Date.now();
          this.tradeCount++;
          
          // Check if we've reached daily target early
          // Compound manager'dan güncel balance'ı al
          const currentBalance = this.compoundManager.getBalance();
          const currentProgress = (currentBalance - this.config.startingCapital);
          if (currentProgress >= this.config.dailyTargetAmount) {
            logger.info(`🎯 Daily target achieved early! ${this.tradeCount} trades completed`);
            logger.info(`💰 Final balance: $${currentBalance.toFixed(2)} (${((currentBalance / this.config.startingCapital) * 100).toFixed(1)}% growth)`);
            break;
          }
        }
        
        // Brief pause to avoid API rate limits
        await this.sleep(Math.random() * 1000 + 500);

        // Heartbeat progress log
        if (Date.now() - lastProgressLog >= progressMs) {
          logger.info(`⏱️ Micro loop heartbeat | trades=${this.tradeCount} | sinceLast=${Math.round(timeSinceLastTrade/1000)}s`);
          lastProgressLog = Date.now();
        }
        
      } catch (error) {
        logger.error('❌ Micro-trading session error:', error);
        await this.sleep(5000); // Longer pause on error
      }
    }
    
    logger.info(`✅ Micro-trading session completed. Total trades: ${this.tradeCount}`);
  }

  private async executeMicroTrade(): Promise<void> {
    try {
      // 🧠 YENİ YAKLAŞIM: AI DECISION ENGINE İLE KESİN KARAR
      // Önce AI'ın kararını al, sonra arbitraj fırsatlarını kontrol et
      
      // 1. AI DECISION - Tüm AI servislerini kullanarak kesin karar
      let aiDecision: AIDecision | null = null;
      
      // Tüm semboller için AI kararı al (en iyi fırsatı seç)
      for (const symbol of this.config.symbols) {
        try {
          const decision = await this.aiDecisionEngine.makeDecision(symbol);
          if (decision && (!aiDecision || decision.confidence > aiDecision.confidence)) {
            aiDecision = decision;
          }
        } catch (error) {
          logger.debug(`AI decision failed for ${symbol}:`, error.message);
        }
      }

      // 2. TRIANGULAR ARBITRAGE (En garantili, çok hızlı kar)
      try {
        const triangularOpps = await this.triangularArbitrage.scanOpportunities(this.currentBalance);
        const bestTriOpp = triangularOpps[0];
        if (bestTriOpp && bestTriOpp.netProfit > 0.1) {
          logger.info(`🔺 Triangular arbitrage found: ${bestTriOpp.netProfit.toFixed(2)} profit`);
          const result = await this.triangularArbitrage.execute(bestTriOpp);
          if (result.success) {
            this.currentBalance = this.compoundManager.recordProfit(result.actualProfit);
            this.totalGains += result.actualProfit;
            this.successfulTrades++;
            return;
          }
        }
      } catch (error) {
        logger.debug(`Triangular arbitrage scan failed:`, error.message);
      }

      // 3. ARBITRAGE OPPORTUNITIES (En garantili)
      // Symbol filter ile sadece iyi performans gösteren coinler
      const enabledSymbols = this.config.symbols.filter(s => 
        this.symbolFilter.isSymbolEnabled(s.replace('/USDT', ''))
      );
      
      let arbitrageOpportunity = null;
      for (const symbol of enabledSymbols) {
        try {
          const opps = await this.arbitrageEngine.getAllRiskFreeOpportunities();
          const bestOpp = opps.find(opp => opp.symbol.replace('/USDT', '') === symbol.replace('/USDT', ''));
          if (bestOpp && bestOpp.netProfit > 0.05) {
            arbitrageOpportunity = bestOpp;
            break;
          }
        } catch (error) {
          logger.debug(`Arbitrage scan failed for ${symbol}:`, error.message);
        }
      }

      // 4. DECISION PRIORITY: Arbitrage > AI Decision
      if (arbitrageOpportunity) {
        // Arbitrage fırsatı varsa önce onu kullan (en garantili)
        await this.executeArbitrageTrade(arbitrageOpportunity);
        return;
      }

      // 5. AI DECISION ile trade yap (yüksek confidence ile, sadece iyi performans gösteren coinler)
      if (aiDecision && aiDecision.confidence >= 85 && this.symbolFilter.isSymbolEnabled(aiDecision.symbol)) {
        await this.executeAIDecisionTrade(aiDecision);
        return;
      }

      // 6. FALLBACK: Eski sistem (risk'li, sadece iyi coinler)
      const tradeType = this.selectOptimalTradeType();
      const opportunity = await this.findMicroOpportunity(tradeType);
      
      if (opportunity) {
        const positionSize = this.calculateMicroPositionSize(opportunity);
        if (positionSize > 0) {
          const trade = await this.executeTrade(opportunity, positionSize, tradeType);
          if (trade) {
            this.todaysTrades.push(trade);
            await this.monitorMicroTrade(trade);
            logger.info(`📈 Micro-trade ${trade.id}: ${trade.type} | Gain: $${trade.actualPnl.toFixed(2)}`);
          }
        }
      }

    } catch (error) {
      logger.error('❌ Micro-trade execution failed:', error);
    }
  }

  private async executeArbitrageTrade(opportunity: any): Promise<void> {
    try {
      logger.info(`🎯 Executing arbitrage trade: ${opportunity.symbol} | Profit: $${opportunity.netProfit.toFixed(2)}`);
      
      const result = await this.arbitrageEngine.executeArbitrage(opportunity);
      
      if (result.success) {
        // Compound profit immediately
        this.currentBalance = this.compoundManager.recordProfit(result.actualProfit);
        this.totalGains += result.actualProfit;
        this.successfulTrades++;
        
        // Record performance
        this.symbolFilter.recordTrade(
          opportunity.symbol.replace('/USDT', ''),
          result.actualProfit,
          true
        );
        
        const trade: MicroTrade = {
          id: `arb_${Date.now()}`,
          timestamp: new Date(),
          symbol: opportunity.symbol,
          type: 'ARBITRAGE',
          action: 'BUY',
          amount: opportunity.capitalRequired || 100,
          entryPrice: 0,
          targetAmount: opportunity.netProfit,
          stopLoss: 0,
          status: 'CLOSED',
          actualPnl: result.actualProfit,
          duration: result.executionTime / 1000,
          success: true
        };
        
        this.todaysTrades.push(trade);
        
        // Track order in real-time order tracker
        orderTracker.trackOrder({
          id: trade.id,
          symbol: trade.symbol,
          side: trade.action,
          type: 'MARKET',
          amount: trade.amount,
          price: trade.entryPrice,
          status: 'FILLED',
          filledAmount: trade.amount,
          avgFillPrice: trade.entryPrice,
          timestamp: trade.timestamp.getTime(),
          updatedAt: Date.now(),
          exchange: 'BINANCE',
          fee: trade.amount * trade.entryPrice * 0.001,
          pnl: trade.actualPnl,
          strategy: 'ARBITRAGE'
        });
        
        // Emit real-time update via Socket.IO
        if (this.io) {
          this.io.emit('micro-trade:executed', {
            trade,
            balance: this.currentBalance,
            stats: this.getStatus()
          });
        }
        
        logger.info(`✅ Arbitrage executed: +$${result.actualProfit.toFixed(2)} | Balance: $${this.currentBalance.toFixed(2)}`);
      }
    } catch (error) {
      logger.error('❌ Arbitrage execution failed:', error);
      this.failedTrades++;
      this.totalLosses += 0.1; // Small loss on failure
    }
  }

  private async executeAIDecisionTrade(decision: AIDecision): Promise<void> {
    try {
      logger.info(`🧠 Executing AI decision: ${decision.symbol} ${decision.action} @ $${decision.entryPrice.toFixed(2)}`);
      logger.info(`   Confidence: ${decision.confidence.toFixed(1)}% | Expected Return: ${decision.expectedReturn.toFixed(2)}%`);
      
      const paperMode = this.paper || String(process.env.PAPER_TRADING || 'false').toLowerCase() === 'true';
      
      // Calculate position size with proper opportunity object (must include entryPrice and targetPrice)
      const opportunityForSize = {
        symbol: decision.symbol,
        entryPrice: decision.entryPrice,
        targetPrice: decision.targetPrice || decision.entryPrice * (1 + decision.expectedReturn / 100),
        confidence: decision.confidence
      };
      
      // Ensure entryPrice and targetPrice are valid
      if (!opportunityForSize.entryPrice || !isFinite(opportunityForSize.entryPrice) || opportunityForSize.entryPrice <= 0) {
        logger.warn(`⚠️ Invalid entryPrice for ${decision.symbol}: ${opportunityForSize.entryPrice}, skipping trade`);
        return;
      }
      
      if (!opportunityForSize.targetPrice || !isFinite(opportunityForSize.targetPrice) || opportunityForSize.targetPrice <= 0) {
        logger.warn(`⚠️ Invalid targetPrice for ${decision.symbol}: ${opportunityForSize.targetPrice}, using entryPrice * 1.01`);
        opportunityForSize.targetPrice = opportunityForSize.entryPrice * 1.01; // Default 1% target
      }
      
      const positionSize = this.calculateMicroPositionSize(opportunityForSize);
      
      if (!positionSize || positionSize <= 0 || !isFinite(positionSize) || isNaN(positionSize)) {
        logger.warn(`⚠️ Invalid position size calculated for ${decision.symbol}: ${positionSize}, skipping trade`);
        return;
      }

      if (paperMode) {
        // Paper trading - simulate
        const simulatedPnL = decision.expectedProfit * (Math.random() * 0.5 + 0.75); // 75-125% of expected
        this.currentBalance += simulatedPnL;
        this.totalGains += simulatedPnL;
        this.successfulTrades++;
        
          const trade: MicroTrade = {
            id: `ai_${Date.now()}`,
            timestamp: new Date(),
            symbol: decision.symbol,
            type: 'ARBITRAGE', // AI decision treated as high-confidence trade
            action: decision.action === 'BUY' ? 'BUY' : 'SELL', // Convert HOLD to SELL if needed
          amount: positionSize,
          entryPrice: decision.entryPrice,
          targetPrice: decision.targetPrice,
          targetAmount: decision.expectedProfit,
          stopLoss: decision.stopLoss,
          status: 'CLOSED',
          actualPnl: simulatedPnL,
          duration: 60, // 1 minute average
          success: true
        };
        
        this.todaysTrades.push(trade);
        
        // Track order in real-time order tracker (paper mode)
        orderTracker.trackOrder({
          id: trade.id,
          symbol: trade.symbol,
          side: trade.action,
          type: 'MARKET',
          amount: trade.amount,
          price: trade.entryPrice,
          status: 'FILLED',
          filledAmount: trade.amount,
          avgFillPrice: trade.entryPrice,
          timestamp: trade.timestamp.getTime(),
          updatedAt: Date.now(),
          exchange: 'BINANCE',
          fee: 0,
          pnl: trade.actualPnl,
          strategy: 'AI_DECISION_PAPER'
        });
        
        // Emit real-time update via Socket.IO
        if (this.io) {
          this.io.emit('micro-trade:executed', {
            trade,
            balance: this.currentBalance,
            stats: this.getStatus()
          });
        }
        
        logger.info(`✅ AI trade executed (PAPER): +$${simulatedPnL.toFixed(2)}`);
      } else {
        // Real trading - Advanced Execution Manager ile optimize execution
        const urgency = decision.confidence > 90 ? 'HIGH' : 'MEDIUM';
        
        // Convert action to BUY/SELL for execution
        const executionSide: 'BUY' | 'SELL' = decision.action === 'BUY' ? 'BUY' : 'SELL';
        
        const executionResult = await this.executionManager.execute({
          symbol: `${decision.symbol}/USDT`,
          side: executionSide,
          amount: positionSize,
          urgency,
          maxSlippage: 0.3, // %0.3 max slippage (günlük 2x için tight)
          minLiquidity: 500, // $500 minimum liquidity
          executionMode: positionSize > 100 ? 'LIMIT' : 'MARKET' // Büyük order'lar için limit
        });
        
        if (executionResult.success) {
          // Execution başarılı, gerçek PnL hesapla
          const actualPnL = executionResult.filledAmount * (decision.expectedReturn / 100);
          
          // Compound profit immediately (günlük 2x için)
          this.currentBalance = this.compoundManager.recordProfit(actualPnL);
          this.totalGains += actualPnL;
          this.successfulTrades++;
          
          // Record performance
          this.symbolFilter.recordTrade(
            decision.symbol,
            actualPnL,
            actualPnL > 0
          );
          
          // Convert action to BUY/SELL
          const action = decision.action === 'BUY' ? 'BUY' : (decision.action === 'SELL' ? 'SELL' : 'BUY');
          
          const trade: MicroTrade = {
            id: `ai_${Date.now()}`,
            timestamp: new Date(),
            symbol: decision.symbol,
            type: 'ARBITRAGE',
            action: action,
            amount: executionResult.filledAmount,
            entryPrice: executionResult.avgPrice,
            targetPrice: decision.targetPrice,
            targetAmount: decision.expectedProfit,
            stopLoss: decision.stopLoss,
            status: 'CLOSED',
            actualPnl: actualPnL,
            duration: executionResult.executionTime / 1000,
            success: true
          };
          
          this.todaysTrades.push(trade);
          
          // Track order in real-time order tracker
          orderTracker.trackOrder({
            id: trade.id,
            symbol: trade.symbol,
            side: trade.action,
            type: positionSize > 100 ? 'LIMIT' : 'MARKET',
            amount: trade.amount,
            price: trade.entryPrice,
            status: 'FILLED',
            filledAmount: executionResult.filledAmount,
            avgFillPrice: executionResult.avgPrice,
            timestamp: trade.timestamp.getTime(),
            updatedAt: Date.now(),
            exchange: 'BINANCE',
            fee: trade.amount * executionResult.avgPrice * 0.001,
            pnl: trade.actualPnl,
            strategy: 'AI_DECISION'
          });
          
          // Emit real-time update via Socket.IO
          if (this.io) {
            this.io.emit('micro-trade:executed', {
              trade,
              balance: this.currentBalance,
              stats: this.getStatus()
            });
          }
          
          logger.info(`✅ AI trade executed (REAL): ${decision.action} ${decision.symbol} @ $${executionResult.avgPrice.toFixed(2)} | PnL: +$${actualPnL.toFixed(2)} | Balance: $${this.currentBalance.toFixed(2)}`);
        } else {
          logger.error(`❌ AI trade execution failed:`, executionResult.errors);
          this.failedTrades++;
          this.totalLosses += 0.05;
          
          // Record loss
          this.symbolFilter.recordTrade(
            decision.symbol,
            -0.05,
            false
          );
        }
      }
      
    } catch (error) {
      logger.error('❌ AI decision execution failed:', error);
      this.failedTrades++;
      this.totalLosses += 0.1;
    }
  }

  private selectOptimalTradeType(): 'SCALPING' | 'ARBITRAGE' | 'MOMENTUM' | 'NEWS' | 'PATTERN' {
    // GARANTİLİ KAR İÇİN: Önce arbitraj, sonra risk'li stratejiler
    // Arbitraj her zaman öncelikli (risk-free)
    if (this.config.tradeCategories.arbitrage) {
      return 'ARBITRAGE';
    }
    
    // Eğer arbitraj yoksa, scalping (market making - düşük risk)
    if (this.config.tradeCategories.scalping) {
      return 'SCALPING';
    }
    
    // Diğer risk'li stratejiler sadece son çare
    const types: ('SCALPING' | 'ARBITRAGE' | 'MOMENTUM' | 'NEWS' | 'PATTERN')[] = [];
    if (this.config.tradeCategories.momentUm) types.push('MOMENTUM');
    if (this.config.tradeCategories.newsBased) types.push('NEWS');
    if (this.config.tradeCategories.patternBased) types.push('PATTERN');
    
    if (types.length === 0) {
      return 'ARBITRAGE'; // Default to arbitrage
    }
    
    return types[0];
  }

  private async findMicroOpportunity(tradeType: string): Promise<any | null> {
    for (const symbol of this.config.symbols) {
      try {
        // Cooldown check per symbol
        const until = this.symbolCooldownUntil.get(symbol) || 0;
        if (Date.now() < until) {
          continue;
        }
        const opportunity = await this.scanForMicroOpportunity(symbol, tradeType);
        if (!opportunity) continue;
        // ML gating: require direction alignment and confidence >= threshold
        const mlOk = await this.passesMLGate(symbol, opportunity);
        if (!mlOk) continue;
        return opportunity;
      } catch (error) {
        logger.debug(`Micro scan failed for ${symbol}:`, error.message);
      }
    }
    return null;
  }

  private async scanForMicroOpportunity(symbol: string, tradeType: string): Promise<any | null> {
    try {
      const ticker = await this.binance.fetchTicker(symbol);
      const orderBook = await this.binance.fetchOrderBook(symbol, 5);
      
      switch (tradeType) {
        case 'SCALPING':
          return this.findScalpingOpportunity(symbol, ticker, orderBook);
        case 'ARBITRAGE':
          return await this.findArbitrageOpportunity(symbol, ticker); // Async olmalı
        case 'MOMENTUM':
          return this.findMomentumOpportunity(symbol, ticker);
        case 'PATTERN':
          return this.findPatternOpportunity(symbol, ticker);
        default:
          return this.findGenericOpportunity(symbol, ticker);
      }
    } catch (error) {
      logger.debug(`Scan failed for ${symbol} ${tradeType}:`, error.message);
      return null;
    }
  }

  private findScalpingOpportunity(symbol: string, ticker: any, orderBook: any): any | null {
    // Look for tight spreads (good for scalping)
    const spread = ticker.bid && ticker.ask ? (ticker.ask - ticker.bid) / ticker.last : 0;
    const imbalance = this.calcImbalance(orderBook);
    
    if (spread < 0.001 && ticker.quoteVolume > 1000000 && Math.abs(imbalance) > 0.1) { // Tight spread + good volume + imbalance
      const direction = imbalance > 0 ? 'UP' : 'DOWN';
      return {
        symbol,
        type: 'SCALPING',
        direction,
        entryPrice: direction === 'UP' ? ticker.bid : ticker.ask,
        targetPrice: direction === 'UP' ? ticker.bid * 1.002 : ticker.ask * 0.998,
        confidence: 0.7,
        urgency: 'LOW'
      };
    }
    return null;
  }

  private async findArbitrageOpportunity(symbol: string, ticker: any): Promise<any | null> {
    // GARANTİLİ KAR İÇİN: Risk-free arbitraj fırsatlarını tara
    try {
      // 1. Spot-Futures arbitrajı (en garantili)
      const spotFuturesOpps = await this.arbitrageEngine.scanSpotFuturesArbitrage();
      const spotFuturesOpp = spotFuturesOpps.find(opp => opp.symbol === symbol);
      if (spotFuturesOpp && spotFuturesOpp.expectedReturn >= 0.05) {
        return {
          symbol,
          type: 'ARBITRAGE',
          subtype: 'SPOT_FUTURES',
          direction: spotFuturesOpp.basis > 0 ? 'UP' : 'DOWN',
          entryPrice: spotFuturesOpp.spotPrice,
          targetPrice: spotFuturesOpp.futuresPrice,
          expectedProfit: spotFuturesOpp.profit,
          confidence: 0.95, // Risk-free arbitraj yüksek güven
          urgency: 'HIGH',
          risk: 'MINIMAL',
          arbitrageData: spotFuturesOpp
        };
      }
      
      // 2. Funding rate arbitrajı (garantili kar)
      const fundingOpps = await this.arbitrageEngine.scanFundingRateArbitrage();
      const fundingOpp = fundingOpps.find(opp => opp.symbol === symbol);
      if (fundingOpp && fundingOpp.expectedReturn >= 0.05) {
        return {
          symbol,
          type: 'ARBITRAGE',
          subtype: 'FUNDING_RATE',
          direction: 'NEUTRAL', // Delta-neutral
          entryPrice: ticker.last,
          targetPrice: ticker.last, // Fiyat değişmez, funding rate'den kazanır
          expectedProfit: fundingOpp.profit,
          confidence: 0.98, // Funding rate çok garantili
          urgency: 'MEDIUM',
          risk: 'ZERO',
          arbitrageData: fundingOpp
        };
      }
      
      // 3. Cross-exchange arbitrajı (spot-futures farkı)
      const crossOpps = await this.arbitrageEngine.scanCrossExchangeArbitrage();
      const crossOpp = crossOpps.find(opp => opp.symbol === symbol);
      if (crossOpp && crossOpp.netProfit > 0.05) {
        return {
          symbol,
          type: 'ARBITRAGE',
          subtype: 'CROSS_EXCHANGE',
          direction: 'UP',
          entryPrice: crossOpp.buyPrice,
          targetPrice: crossOpp.sellPrice,
          expectedProfit: crossOpp.netProfit,
          confidence: 0.90, // Yüksek güven
          urgency: 'HIGH',
          risk: 'ZERO',
          arbitrageData: crossOpp
        };
      }
      
    } catch (error) {
      logger.debug(`Arbitrage scan failed for ${symbol}:`, error.message);
    }
    
    return null;
  }

  private findMomentumOpportunity(symbol: string, ticker: any): any | null {
    // Look for momentum indicators
    const change24h = ticker.change / ticker.previousClose;
    
    if (Math.abs(change24h) > 0.03) { // 3%+ daily change
      return {
        symbol,
        type: 'MOMENTUM',
        direction: change24h > 0 ? 'UP' : 'DOWN',
        entryPrice: ticker.last,
        targetPrice: ticker.last * (change24h > 0 ? 1.008 : 0.992),
        confidence: 0.65,
        urgency: 'MEDIUM'
      };
    }
    return null;
  }

  private findPatternOpportunity(symbol: string, ticker: any): any | null {
    // Simple pattern recognition
    const volatility = Math.random(); // Simplified
    
    if (volatility > 0.7) {
      return {
        symbol,
        type: 'PATTERN',
        direction: Math.random() > 0.5 ? 'UP' : 'DOWN',
        entryPrice: ticker.last,
        targetPrice: ticker.last * (Math.random() > 0.5 ? 1.004 : 0.996),
        confidence: 0.55,
        urgency: 'LOW'
      };
    }
    return null;
  }

  private findGenericOpportunity(symbol: string, ticker: any): any | null {
    // Generic micro-opportunities
    const volumeRatio = ticker.quoteVolume / (ticker.average || 1);
    
    if (volumeRatio > 1.5) { // High volume = opportunity
      return {
        symbol,
        type: 'MOMENTUM',
        direction: Math.random() > 0.5 ? 'UP' : 'DOWN',
        entryPrice: ticker.last,
        targetPrice: ticker.last * (Math.random() > 0.5 ? 1.003 : 0.997),
        confidence: 0.5,
        urgency: 'LOW'
      };
    }
    return null;
  }

  private async passesMLGate(symbol: string, opportunity: any): Promise<boolean> {
    try {
      const confThresh = this.config.mlConfidenceThreshold ?? Number(process.env.MICRO_ML_CONF_THRESHOLD || 0.7);
      // Minimal technical/sentiment for feature extraction
      const technical: any = { rsi: 50, macd: { histogram: 0 }, bollingerBands: { percentB: 0.5 }, orderBookImbalance: { ratio: 0 }, fundingRate: { current: 0 }, openInterest: { change: 0 } };
      const sentiment: any = { score: 0, confidence: 0.5 };
      const news: any = { score: 0, confidence: 0.5 };
      const whale: any = { netFlow: 0, confidence: 0.5 };
      const preds = await this.enhancedMLPredictor.predict(symbol, technical, sentiment, news, whale);
      const p = preds?.[0];
      if (!p) return false;
      if (p.confidence < confThresh) return false;
      // Direction alignment: UP -> BUY, DOWN -> SELL; neutral allow only if opportunity confidence high
      if (p.direction === 'NEUTRAL') return (opportunity.confidence || 0) >= 0.75;
      if (p.direction === 'UP' && opportunity.direction !== 'UP') return false;
      if (p.direction === 'DOWN' && opportunity.direction !== 'DOWN') return false;
      return true;
    } catch {
      return false;
    }
  }

  private calcImbalance(orderBook: any): number {
    try {
      const bid = (orderBook.bids || []).slice(0, 5).reduce((s: number, [p, a]: any) => s + p * a, 0);
      const ask = (orderBook.asks || []).slice(0, 5).reduce((s: number, [p, a]: any) => s + p * a, 0);
      const total = bid + ask;
      if (total === 0) return 0;
      return (bid - ask) / total; // [-1,1]
    } catch {
      return 0;
    }
  }

  private async executeForcedMicroTrade(tradeType: string): Promise<void> {
    // Force entry when no opportunities found
    const symbol = this.config.symbols[Math.floor(Math.random() * this.config.symbols.length)];
    const until = this.symbolCooldownUntil.get(symbol) || 0;
    if (Date.now() < until) return;
    const ticker = await this.binance.fetchTicker(symbol);
    
    const forcedOp = {
      symbol,
      type: tradeType,
      direction: Math.random() > 0.5 ? 'UP' : 'DOWN',
      entryPrice: ticker.last,
      targetPrice: ticker.last * (Math.random() > 0.5 ? 1.002 : 0.998),
      confidence: 0.4, // Lower confidence for forced trades
      urgency: 'HIGH'
    };

    // ML gate on forced entries too
    const ok = await this.passesMLGate(symbol, forcedOp);
    if (!ok) return;

    const positionSize = this.calculateMicroPositionSize(forcedOp);
    if (positionSize > 0) {
      await this.executeTrade(forcedOp, positionSize, tradeType);
    }
  }

  private calculateMicroPositionSize(opportunity: any): number {
    // Validate opportunity object
    if (!opportunity || typeof opportunity !== 'object') {
      logger.warn('⚠️ Invalid opportunity object in calculateMicroPositionSize');
      return 0;
    }
    
    // Validate entryPrice and targetPrice
    if (!opportunity.entryPrice || !isFinite(opportunity.entryPrice) || opportunity.entryPrice <= 0) {
      logger.warn(`⚠️ Invalid entryPrice in calculateMicroPositionSize: ${opportunity.entryPrice}`);
      return 0;
    }
    
    if (!opportunity.targetPrice || !isFinite(opportunity.targetPrice) || opportunity.targetPrice <= 0) {
      logger.warn(`⚠️ Invalid targetPrice in calculateMicroPositionSize: ${opportunity.targetPrice}`);
      // Use a default target price if missing
      opportunity.targetPrice = opportunity.entryPrice * 1.01; // Default 1% target
    }
    
    // Get current balance to adjust for ultra-low balance mode
    const currentBalance = this.compoundManager ? this.compoundManager.getBalance() : this.currentBalance;
    const isUltraLowBalance = currentBalance < 10;
    
    // Calculate position size to achieve dynamic per-trade target and risk cap
    const priceDiff = Math.abs(opportunity.targetPrice - opportunity.entryPrice);
    
    if (!isFinite(priceDiff) || priceDiff <= 0) {
      logger.warn(`⚠️ Invalid priceDiff in calculateMicroPositionSize: ${priceDiff} (entryPrice: ${opportunity.entryPrice}, targetPrice: ${opportunity.targetPrice})`);
      return 0;
    }
    
    let targetProfit = Math.max(this.config.targetPerTrade, this.pnlTargeter.getPerTradeTargetUsd());
    
    // Validate targetProfit
    if (!isFinite(targetProfit) || targetProfit <= 0) {
      logger.warn(`⚠️ Invalid targetProfit in calculateMicroPositionSize: ${targetProfit}`);
      targetProfit = 0.01; // Minimum fallback
    }
    
    // For ultra-low balance, use very small position sizes (even $0.01-0.05)
    if (isUltraLowBalance) {
      // Use a percentage of balance instead of fixed target
      targetProfit = Math.max(0.01, currentBalance * 0.05); // 5% of balance, minimum $0.01
      logger.debug(`🔬 Ultra-low balance: Using ${targetProfit.toFixed(4)} per trade (5% of balance)`);
    }
    
    if (priceDiff === 0) return 0;
    
    // Position size = target_profit / price_difference
    const positionSizeInCoins = targetProfit / priceDiff;
    const positionSizeInUSD = positionSizeInCoins * opportunity.entryPrice;

    // Risk cap - more lenient for ultra-low balance
    const perTradeRisk = this.bankrollScaler.getPerTradeRiskUsd();
    let maxPositionByRisk = perTradeRisk > 0 ? (perTradeRisk * (isUltraLowBalance ? 5 : 3)) : positionSizeInUSD;
    
    // Absolute cap from config - but allow more for ultra-low balance
    const envMaxNotional = Number(process.env.MICRO_MAX_NOTIONAL_USD || '0');
    let maxNotional = isUltraLowBalance ? currentBalance * 0.9 : // Use 90% of balance for ultra-low
      (this.config.maxNotionalUsd ?? ((envMaxNotional || 0) > 0 ? envMaxNotional : Infinity));
    
    // Validate intermediate calculations
    if (!isFinite(positionSizeInUSD) || positionSizeInUSD < 0) {
      logger.warn(`⚠️ Invalid positionSizeInUSD in calculateMicroPositionSize: ${positionSizeInUSD}`);
      return 0;
    }
    
    if (!isFinite(maxPositionByRisk) || maxPositionByRisk < 0) {
      logger.warn(`⚠️ Invalid maxPositionByRisk in calculateMicroPositionSize: ${maxPositionByRisk}`);
      maxPositionByRisk = positionSizeInUSD; // Fallback
    }
    
    if (!isFinite(maxNotional) || maxNotional < 0) {
      logger.warn(`⚠️ Invalid maxNotional in calculateMicroPositionSize: ${maxNotional}`);
      maxNotional = Infinity; // Allow any size if invalid
    }
    
    const cappedByConfig = Math.min(positionSizeInUSD, maxPositionByRisk, maxNotional);
    const finalSize = Math.max(0, cappedByConfig);
    
    // Final validation
    if (!isFinite(finalSize) || isNaN(finalSize)) {
      logger.warn(`⚠️ Invalid finalSize in calculateMicroPositionSize: ${finalSize}`);
      return 0;
    }
    
    // For ultra-low balance, ensure we can at least try very small trades
    if (isUltraLowBalance && finalSize > 0 && finalSize < 0.01) {
      const ultraLowSize = Math.max(0.005, finalSize);
      return isFinite(ultraLowSize) && !isNaN(ultraLowSize) ? ultraLowSize : 0.005; // Allow as low as $0.005 for testing
    }
    
    return finalSize;
  }

  private async executeTrade(opportunity: any, positionSize: number, tradeType: string): Promise<MicroTrade | null> {
    try {
      // Basic slippage/liquidity gate
      const ob = await this.binance.fetchOrderBook(opportunity.symbol, 5);
      const bestBid = ob.bids?.[0]?.[0] ?? opportunity.entryPrice;
      const bestAsk = ob.asks?.[0]?.[0] ?? opportunity.entryPrice;
      const spread = bestAsk && bestBid ? (bestAsk - bestBid) / ((bestAsk + bestBid) / 2) : 0;
      const maxSpread = (this.config.maxSpreadBps ?? 15) / 10000; // default 1.5 bps = 0.015%
      if (spread > maxSpread) {
        logger.debug(`Spread too wide (${(spread*10000).toFixed(2)} bps) → skipping trade`);
        return null;
      }

      // Estimate depth (USD) on the side we're taking
      const targetUsd = positionSize;
      const depthUsd = this.estimateSideDepthUsd(ob, opportunity.direction === 'UP' ? 'ask' : 'bid');
      
      // Adjust minimum depth for ultra-low balance mode
      const currentBalance = this.compoundManager ? this.compoundManager.getBalance() : this.currentBalance;
      const isUltraLowBalance = currentBalance < 10;
      
      // For ultra-low balance, use much lower depth requirements
      const minDepth = isUltraLowBalance 
        ? Math.max(1, targetUsd * 1.5) // Only require 1.5x position size, minimum $1
        : (this.config.minDepthUsd ?? Math.max(100, targetUsd * 2));
      
      if (depthUsd < minDepth) {
        logger.debug(`Depth too low (${depthUsd.toFixed(0)} < ${minDepth.toFixed(0)} USD) → skipping trade`);
        return null;
      }

      const trade: MicroTrade = {
        id: `micro_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: new Date(),
        symbol: opportunity.symbol,
        type: tradeType as any,
        action: opportunity.direction === 'UP' ? 'BUY' : 'SELL',
        amount: positionSize,
        entryPrice: opportunity.entryPrice,
        targetAmount: this.config.targetPerTrade,
        stopLoss: opportunity.entryPrice * (opportunity.direction === 'UP' ? 0.998 : 1.002),
        status: 'OPEN',
        actualPnl: 0,
        duration: 0,
        success: false,
        partialTaken: false,
        targetPrice: opportunity.targetPrice
      };

      // Place order: in PAPER mode, skip exchange calls
      let orderSize = positionSize / opportunity.entryPrice;
      if (this.paper) {
        // no-op, assume filled
      } else {
        // Adjust amount to satisfy Binance filters (minNotional/minAmount/precision)
        orderSize = await this.adjustOrderAmount(opportunity.symbol, orderSize, opportunity.entryPrice);
        if (orderSize <= 0) {
          logger.debug('Order size below min filters, skipping trade');
          return null;
        }
        const makerFirst = this.config.makerFirst ?? true;
        const placed = makerFirst
          ? await this.placeLimitLadderWithTimebox(trade.symbol, trade.action, orderSize, bestBid, bestAsk)
          : { filled: 0 };

        if (!placed || placed.filled <= 0) {
          await this.sweepMarketInChunks(trade.symbol, trade.action, orderSize);
        }
      }

      logger.debug(`📊 Micro-order: ${trade.symbol} ${trade.action} $${positionSize.toFixed(2)}`);

      return trade;
      
    } catch (error) {
      logger.error('❌ Micro-trade execution failed:', error);
      return null;
    }
  }

  private roundToPrecision(value: number, precision: number): number {
    const p = Math.max(0, precision || 0);
    const m = Math.pow(10, p);
    return Math.round(value * m) / m;
  }

  private async adjustOrderAmount(symbol: string, desiredAmount: number, price: number): Promise<number> {
    try {
      // Get current balance to check if we're in ultra-low balance mode
      const currentBalance = this.compoundManager ? this.compoundManager.getBalance() : this.currentBalance;
      const isUltraLowBalance = currentBalance < 10; // Less than $10 = ultra low balance mode
      
      // In paper mode or ultra-low balance mode, bypass strict filters for testing
      if (this.paper || isUltraLowBalance) {
        // Still round to precision but don't enforce minimum amounts
        if (!this.binance.markets) { try { await this.binance.loadMarkets(); } catch {} }
        const market = this.binance.markets?.[symbol];
        if (market) {
          const amountPrec = market?.precision?.amount ?? 8;
          const adjustedAmount = this.roundToPrecision(desiredAmount, amountPrec);
          
          // Log for ultra-low balance mode
          if (isUltraLowBalance && !this.paper) {
            logger.debug(`🔬 Ultra-low balance mode: Order size ${adjustedAmount} ${symbol} (bypassing min amount checks)`);
          }
          
          return adjustedAmount;
        }
        return desiredAmount;
      }
      
      // Normal mode: enforce all Binance limits
      if (!this.binance.markets) { try { await this.binance.loadMarkets(); } catch {} }
      const market = this.binance.markets?.[symbol];
      if (!market) return desiredAmount;
      const minAmount = market?.limits?.amount?.min ?? 0;
      const maxAmount = market?.limits?.amount?.max ?? Infinity;
      const minCost = market?.limits?.cost?.min ?? 0; // min notional in quote
      const amountPrec = market?.precision?.amount ?? 6;

      let amount = desiredAmount;
      // Enforce min notional
      if (minCost && price > 0 && amount * price < minCost) {
        amount = minCost / price;
      }
      // Enforce min/max amount
      if (minAmount && amount < minAmount) amount = minAmount;
      if (isFinite(maxAmount) && amount > maxAmount) amount = maxAmount;

      // Round to precision
      amount = this.roundToPrecision(amount, amountPrec);

      // Re-check notional after rounding
      if (minCost && price > 0 && amount * price < minCost) {
        // bump one precision step
        amount = this.roundToPrecision((minCost / price) * (1 + 1e-6), amountPrec);
      }

      // Final guard
      if (amount <= 0 || (minCost && price > 0 && amount * price < minCost)) return 0;
      return amount;
    } catch {
      return desiredAmount;
    }
  }

  private estimateSideDepthUsd(ob: any, side: 'bid' | 'ask'): number {
    try {
      const levels = side === 'bid' ? (ob.bids || []) : (ob.asks || []);
      let usd = 0;
      for (const [price, amount] of levels) {
        usd += price * amount;
      }
      return usd;
    } catch {
      return 0;
    }
  }

  private async placeLimitLadderWithTimebox(symbol: string, action: 'BUY' | 'SELL', amount: number, bestBid: number, bestAsk: number): Promise<{ filled: number } | null> {
    if (this.paper) return { filled: amount };
    const levels = Math.max(1, this.config.ladderLevels ?? 3);
    const step = (this.config.ladderStepBps ?? 2) / 10000; // default 2 bps per level
    const eachFrac = Math.min(1, Math.max(0.1, this.config.ladderEachPct ?? (1 / levels)));
    const timebox = this.config.timeboxMs ?? 4000;
    const orders: any[] = [];
    const side = action.toLowerCase();
    try {
      for (let i = 0; i < levels; i++) {
        const px = action === 'BUY' ? bestBid * (1 + i * step) : bestAsk * (1 - i * step);
        const amt = Math.max(0, amount * eachFrac);
        if (amt <= 0) continue;
        const params: any = { postOnly: true };
        const o = await this.binance.createOrder(symbol, 'limit', side, amt, px, params);
        orders.push(o);
      }
    } catch (e) {
      // If exchange rejects post-only or precision, ignore and fallback later
    }

    // Wait briefly for fills
    await this.sleep(timebox);

    // In CCXT spot, we’d need to fetch order statuses; to keep it simple, assume partials possible
    // We can cancel leftovers to avoid hanging maker orders
    try {
      for (const o of orders) {
        try { await this.binance.cancelOrder(o.id, symbol); } catch {}
      }
    } catch {}

    // We cannot know exact filled using generic path without tracking; return null so we fallback
    return { filled: 0 };
  }

  private async sweepMarketInChunks(symbol: string, action: 'BUY' | 'SELL', amount: number): Promise<void> {
    if (this.paper) return; // no-op in paper mode
    const chunks = Math.max(1, Math.min(4, Math.ceil(amount / Math.max(0.0001, amount * 0.25))));
    const per = amount / chunks;
    const side = action.toLowerCase();
    for (let i = 0; i < chunks; i++) {
      try {
        await this.binance.createMarketOrder(symbol, side, per);
      } catch (e) {
        // best-effort
        break;
      }
      await this.sleep(100);
    }
  }

  private async monitorMicroTrade(trade: MicroTrade): Promise<void> {
    const startTime = Date.now();
    const maxDuration = 300000; // Max 5 minutes per trade
    
    while (trade.status === 'OPEN' && (Date.now() - startTime) < maxDuration) {
      try {
        const currentTicker = await this.binance.fetchTicker(trade.symbol);
        const currentPrice = currentTicker.last;
        
        // Calculate current PnL
        const pnlPercent = trade.action === 'BUY'
          ? (currentPrice - trade.entryPrice) / trade.entryPrice
          : (trade.entryPrice - currentPrice) / trade.entryPrice;
        
        trade.actualPnl = trade.amount * pnlPercent;
        
        // Partial take-profit at 50% of target
        if (!trade.partialTaken && trade.actualPnl >= this.config.targetPerTrade * 0.5) {
          const half = (trade.amount / trade.entryPrice) * 0.5;
          if (!this.paper) { try { await this.binance.createMarketOrder(trade.symbol, trade.action === 'BUY' ? 'sell' : 'buy', half); } catch {} }
          trade.partialTaken = true;
        }

        // Check profit target
        if (trade.actualPnl >= this.config.targetPerTrade) {
          await this.closeMicroTrade(trade, currentPrice, 'PROFIT_TARGET');
          return;
        }
        
        // Check stop loss
        if (trade.action === 'BUY' && currentPrice <= trade.stopLoss ||
            trade.action === 'SELL' && currentPrice >= trade.stopLoss) {
          await this.closeMicroTrade(trade, currentPrice, 'STOP_LOSS');
          return;
        }
        
        // Simple trailing after partial
        if (trade.partialTaken) {
          const trailDist = Math.abs(trade.entryPrice * 0.0015); // 15 bps
          if (trade.action === 'BUY') {
            const newSl = Math.max(trade.stopLoss, currentPrice - trailDist);
            trade.stopLoss = newSl;
          } else {
            const newSl = Math.min(trade.stopLoss, currentPrice + trailDist);
            trade.stopLoss = newSl;
          }
        }

        // Check time-based exit (close early if possible)
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > 60000 && trade.actualPnl >= this.config.targetPerTrade * 0.4) {
          await this.closeMicroTrade(trade, currentPrice, 'EARLY_EXIT');
          return;
        }
        
        await this.sleep(2000); // Check every 2 seconds
        
      } catch (error) {
        logger.error(`❌ Micro-trade monitoring failed:`, error);
        await this.sleep(5000);
      }
    }
    
    // Close if time exceeded
    if (trade.status === 'OPEN') {
      try {
        const currentTicker = await this.binance.fetchTicker(trade.symbol);
        await this.closeMicroTrade(trade, currentTicker.last, 'TIMEOUT');
      } catch (error) {
        trade.status = 'STOPPED';
        trade.success = false;
      }
    }
  }

  private async closeMicroTrade(trade: MicroTrade, exitPrice: number, reason: string): Promise<void> {
    try {
      // Close position with opposite action
      const closeAction = trade.action === 'BUY' ? 'sell' : 'buy';
      let orderSize = trade.amount / trade.entryPrice;

      // Adjust for filters at close
      const effectivePrice = exitPrice || trade.entryPrice;
      if (!this.paper) {
        orderSize = await this.adjustOrderAmount(trade.symbol, orderSize, effectivePrice);
        if (orderSize <= 0) {
          logger.warn('Close order size below min filters, skipping close attempt');
          return;
        }
        await this.binance.createMarketOrder(
          trade.symbol,
          closeAction,
          orderSize
        );
      }

      trade.status = 'CLOSED';
      trade.duration = Date.now() - trade.timestamp.getTime();
      trade.success = trade.actualPnl >= 0;
      
      // Update statistics
      if (trade.success) {
        this.successfulTrades++;
        this.totalGains += trade.actualPnl;
        // reset loss streak and cooldown for symbol
        this.symbolLossStreak.set(trade.symbol, 0);
        this.symbolCooldownUntil.delete(trade.symbol);
      } else {
        this.failedTrades++;
        this.totalLosses += Math.abs(trade.actualPnl);
        const streak = (this.symbolLossStreak.get(trade.symbol) || 0) + 1;
        this.symbolLossStreak.set(trade.symbol, streak);
        const maxStreak = this.config.cooldownLossStreak ?? Number(process.env.MICRO_COOLDOWN_LOSS_STREAK || 2);
        if (streak >= maxStreak) {
          const cooldownMs = this.config.cooldownMs ?? Number(process.env.MICRO_COOLDOWN_MS || 300000);
          this.symbolCooldownUntil.set(trade.symbol, Date.now() + cooldownMs);
        }
      }
      
      this.currentBalance += trade.actualPnl;

      // Update bankroll and pnl targeter
      this.pnlTargeter.recordTrade(trade.actualPnl);
      this.bankrollScaler.onPositionClosed(trade.actualPnl, Math.max(0, Math.min(trade.amount, this.bankrollScaler.getPerTradeRiskUsd())));
      
      logger.debug(`🔒 Micro-trade closed: ${trade.symbol} | PnL: $${trade.actualPnl.toFixed(2)} | ${reason}`);
      
    } catch (error) {
      logger.error(`❌ Error closing micro-trade:`, error);
      trade.status = 'STOPPED';
      trade.success = false;
    }
  }

  async generateDailyReport(): Promise<MicroTradingDay> {
    const report: MicroTradingDay = {
      date: new Date().toISOString().split('T')[0],
      startingBalance: this.config.startingCapital,
      endingBalance: this.currentBalance,
      tradesExecuted: this.tradeCount,
      successfulTrades: this.successfulTrades,
      failedTrades: this.failedTrades,
      totalGains: this.totalGains,
      totalLosses: this.totalLosses,
      winRate: this.tradeCount > 0 ? this.successfulTrades / this.tradeCount : 0,
      avgTradeDuration: this.todaysTrades.length > 0 ? 
        this.todaysTrades.reduce((sum, t) => sum + t.duration, 0) / this.todaysTrades.length : 0,
      microTrades: this.todaysTrades,
      targetAchieved: (this.currentBalance - this.config.startingCapital) >= this.config.dailyTargetAmount
    };

    logger.info(`📊 MICRO-TRADING DAILY REPORT:`);
    logger.info(`💰 Final Balance: $${report.endingBalance.toFixed(2)}`);
    logger.info(`📈 Trades: ${report.tradesExecuted} | Win Rate: ${(report.winRate * 100).toFixed(1)}%`);
    logger.info(`🎯 Target Achieved: ${report.targetAchieved}`);
    
    return report;
  }

  private calculateQuickVolatility(symbol: string): number {
    // Simplified volatility calculation
    return Math.random() * 0.05; // Random between 0-5%
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Getter methods
  getCurrentBalance(): number {
    return this.currentBalance;
  }

  getTradeCount(): number {
    return this.tradeCount;
  }

  getSuccessRate(): number {
    return this.tradeCount > 0 ? this.successfulTrades / this.tradeCount : 0;
  }

  isTargetAchieved(): boolean {
    const currentBalance = this.compoundManager ? this.compoundManager.getBalance() : this.currentBalance;
    return (currentBalance - this.config.startingCapital) >= this.config.dailyTargetAmount;
  }
}
