import { logger } from '../utils/logger';
import { SentimentAnalyzer } from './ai/sentiment-analyzer';
import { TechnicalAnalyzer } from './ai/technical-analyzer';
import { PatternRecognizer } from './ai/pattern-recognizer';
import { RiskScorer } from './ai/risk-scorer';
import { NewsAnalyzer } from './ai/news-analyzer';
import { WhaleTracker } from './ai/whale-tracker';
import { MarketPredictor } from './ai/market-predictor';
import { PortfolioOptimizer } from './ai/portfolio-optimizer';

// Yeni AI modülleri
import { OnChainAnalyzer } from './ai/on-chain-analyzer';
import { OffChainAnalyzer } from './ai/off-chain-analyzer';
import { AdvancedIndicators } from './ai/advanced-indicators';
import { FundamentalAnalyzer } from './ai/fundamental-analyzer';
import { ArbitrageDetector } from './ai/arbitrage-detector';
import { MEVDetector } from './ai/mev-detector';
import { FlashLoanOptimizer } from './ai/flash-loan-optimizer';
import { YieldFarmingOptimizer } from './ai/yield-farming-optimizer';
import { LiquidationSniper, LiquidationOpportunity } from './ai/liquidation-sniper';
import { OptionsVolArb, OptionsVolArbOpp } from './ai/options-vol-arb';
import { BasisCarry, BasisCarryOpp } from './ai/basis-carry';
import { OrderbookL2Service } from './market-data/orderbook-l2-service';
import { chaos } from './ops/chaos';
import { FeatureStore } from './ai/feature-store';
import { AlphaModels } from './ai/alpha-models';
import { MetaEnsemble } from './ai/meta-ensemble';
import { FundingRateService } from './derivatives/funding-rate-service';
import { BorrowRateOptimizer } from './derivatives/borrow-rate-optimizer';
import { OptionsAnalytics, OptionsOpportunity } from './derivatives/options-analytics';
import { NewsTrendService } from './intel/news-trend-service';
import { EntitySentimentService } from './intel/entity-sentiment';
import { AnomalyDetector } from './intel/anomaly-detector';
import { OnChainFlowNowcaster } from './intel/onchain-flow-nowcaster';
import { MarketDataValidator } from './validation/market-data-validator';
import { AtomicExecutionEngine } from './execution/atomic-execution-engine';
import { EmergencyController } from './emergency/emergency-controller';
import { DynamicPositionSizer } from './position/dynamic-position-sizer';
import { RealTimePnLTracker } from './position/real-time-pnl-tracker';
import { BacktestingEngine } from './backtesting/backtesting-engine';
import { PaperTradingEngine } from './backtesting/paper-trading-engine';
import { LiquidityAggregator } from './execution/liquidity-aggregator';
import { SlippageProtector } from './execution/slippage-protector';

export interface GuaranteedSignal {
  symbol: string;
  action: 'LONG' | 'SHORT' | 'CLOSE' | 'ARBITRAGE' | 'FLASH_LOAN' | 'MEV' | 'YIELD_FARM';
  confidence: number; // 0-100
  expectedProfit: number; // Yüzde
  riskLevel: 'ZERO' | 'MINIMAL' | 'LOW' | 'MEDIUM';
  timeframe: string;
  reason: string;
  stopLoss?: number;
  takeProfit?: number;
  entryPrice?: number;
  exitPrice?: number;
  arbitrageExchanges?: string[];
  flashLoanAmount?: number;
  mevOpportunity?: string;
  yieldProtocol?: string;
}

export interface GuaranteedAnalysis {
  symbol: string;
  timestamp: Date;
  onChainMetrics: OnChainMetrics;
  offChainMetrics: OffChainMetrics;
  technicalIndicators: TechnicalIndicators;
  fundamentalMetrics: FundamentalMetrics;
  arbitrageOpportunities: ArbitrageOpportunity[];
  mevOpportunities: MEVOpportunity[];
  flashLoanOpportunities: FlashLoanOpportunity[];
  yieldFarmingOpportunities: YieldFarmingOpportunity[];
  liquidationOpportunities?: LiquidationOpportunity[];
  optionsVolArbOpportunities?: OptionsVolArbOpp[];
  basisCarryOpportunities?: BasisCarryOpp[];
  fundingForecast?: { symbol: string; nextFundingRatePct: number; confidence: number; timeToFundingMin: number };
  borrowBest?: { venue: string; base: string; borrowApyPct: number } | null;
  optionsOpps?: { symbol: string; type: string; edgePct: number; confidence: number; details?: string }[];
  newsHeadlines?: { ts: number; source: string; headline: string; sentiment: number; entities?: string[] }[];
  entitySentiment?: { entity: string; score: number; count: number }[];
  flowNowcast?: { symbol: string; cexInflowUSD: number; cexOutflowUSD: number; dexVolumeUSD: number; whaleNetUSD: number; directionalConfidence: number };
  anomalies?: { ts: number; type: string; severity: number; details?: string }[];
  overallSignal: GuaranteedSignal;
  riskScore: number;
  profitProbability: number;
}

type MarketRegime = 'TRENDING' | 'RANGING' | 'EVENT_DRIVEN' | 'UNKNOWN';

interface OnChainMetrics {
  whaleMovements: number;
  exchangeFlows: number;
  networkActivity: number;
  gasFees: number;
  mempoolSize: number;
  smartContractCalls: number;
  defiProtocolUsage: number;
  nftMarketActivity: number;
}

interface OffChainMetrics {
  socialSentiment: number; // -100 to 100
  newsSentiment: number; // -100 to 100
  googleTrends: number; // 0 to 100
  redditActivity: number; // 0 to 100
  twitterActivity: number; // 0 to 100
  institutionalFlows: number; // -100 to 100
  regulatoryNews: number; // -100 to 100
  marketManipulation: number; // 0 to 100
  whaleMovements: number; // -100 to 100
  exchangeFlows: number; // -100 to 100
  networkActivity: number; // 0 to 100
  gasFees: number; // Gwei
  mempoolSize: number; // Number of pending transactions
  smartContractCalls: number; // Number of contract calls
  defiProtocolUsage: number; // 0 to 100
  nftMarketActivity: number; // 0 to 100
  largeTransactions: number; // Number of large transactions
  institutionalMovements: number; // -100 to 100
  miningDifficulty: number; // Mining difficulty
  hashRate: number; // Hash rate
  activeAddresses: number; // Number of active addresses
  transactionCount: number; // Number of transactions
  averageTransactionValue: number; // Average transaction value
  defiTvl: number; // DeFi TVL
  lendingProtocols: number; // 0 to 100
  stakingRewards: number; // Staking rewards
}

interface TechnicalIndicators {
  rsi: number; // 0-100
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    percentB: number;
  };
  stochastic: {
    k: number;
    d: number;
    overbought: boolean;
    oversold: boolean;
  };
  williamsR: {
    value: number;
    overbought: boolean;
    oversold: boolean;
  };
  cci: {
    value: number;
    overbought: boolean;
    oversold: boolean;
  };
  adx: {
    value: number;
    trendStrength: 'STRONG' | 'WEAK' | 'NEUTRAL';
  };
  obv: {
    value: number;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  vwap: {
    value: number;
    deviation: number;
  };
  ichimoku: {
    tenkan: number;
    kijun: number;
    senkouA: number;
    senkouB: number;
    chikou: number;
    cloudColor: 'GREEN' | 'RED' | 'NEUTRAL';
  };
  fibonacci: {
    retracements: number[];
    extensions: number[];
    currentLevel: number;
  };
  elliotWave: {
    currentWave: number;
    wavePosition: number;
    nextTarget: number;
  };
  supportResistance: {
    support: number[];
    resistance: number[];
    currentLevel: 'SUPPORT' | 'RESISTANCE' | 'NEUTRAL';
  };
  volumeProfile: {
    poc: number; // Point of Control
    valueAreas: number[];
    volumeNodes: number[];
  };
  orderBookImbalance: {
    ratio: number;
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  fundingRate: {
    current: number;
    predicted: number;
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  };
  openInterest: {
    value: number;
    change: number;
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  };
  liquidationLevels: {
    longLiquidations: number[];
    shortLiquidations: number[];
    totalLiquidationValue: number;
  };
}

interface FundamentalMetrics {
  marketCap: number; // USD
  volume24h: number; // USD
  circulatingSupply: number;
  totalSupply: number;
  priceToBookRatio: number;
  priceToSalesRatio: number;
  revenueGrowth: number; // Percentage
  userGrowth: number; // Percentage
  developerActivity: number; // 0-100 score
  githubCommits: number;
  partnerships: number;
  regulatoryStatus: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  institutionalAdoption: number; // 0-100 score
  retailAdoption: number; // 0-100 score
  networkSecurity: number; // 0-100 score
  technologyScore: number; // 0-100 score
  teamScore: number; // 0-100 score
  communityScore: number; // 0-100 score
  liquidityScore: number; // 0-100 score
  volatilityScore: number; // 0-100 score
  correlationScore: number; // 0-100 score
  marketDominance: number; // 0-100 score
  ecosystemGrowth: number; // Percentage
  tokenUtility: number; // 0-100 score
  governanceScore: number; // 0-100 score
  sustainabilityScore: number; // 0-100 score
}

interface ArbitrageOpportunity {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  profit: number; // Yüzde
  profitAmount: number; // USD
  volume: number;
  executionTime: number; // Milisaniye
  risk: 'ZERO' | 'MINIMAL' | 'LOW';
  confidence: number; // 0-100
  spread: number; // Bid-ask spread
  liquidity: number;
  fees: number;
  netProfit: number;
  minTradeSize: number;
  maxTradeSize: number;
  estimatedSlippage: number;
  timeWindow: number; // Fırsatın geçerli olduğu süre (ms)
  description: string;
}

interface MEVOpportunity {
  type: 'SANDWICH' | 'FRONT_RUN' | 'BACK_RUN' | 'LIQUIDATION' | 'GAS_OPTIMIZATION' | 'FLASH_LOAN_MEV';
  targetTransaction: string;
  profit: number;
  gasCost: number;
  netProfit: number;
  executionTime: number;
  risk: 'ZERO' | 'MINIMAL';
  confidence: number;
  description: string;
  mempoolPosition?: number;
  gasPrice?: number;
  blockNumber?: number;
  yieldProtocol?: string;
}

interface FlashLoanOpportunity {
  platform: string;
  loanAmount: number;
  arbitrageProfit: number;
  interestCost: number;
  netProfit: number;
  executionTime: number;
  risk: 'ZERO' | 'MINIMAL';
  confidence: number;
  description: string;
  targetExchanges: string[];
  arbitragePath: string[];
  gasCost: number;
  flashLoanFee: number;
  liquidationThreshold?: number;
  collateralRatio?: number;
}

interface YieldFarmingOpportunity {
  protocol: string;
  apy: number;
  tvl: number;
  risk: 'ZERO' | 'MINIMAL' | 'LOW' | 'MEDIUM';
  confidence: number;
  description: string;
  token: string;
  strategy: string;
  minStake: number;
  maxStake: number;
  lockPeriod: number;
  rewards: string[];
  gasCost: number;
  netApy: number;
  impermanentLoss?: number;
  liquidationRisk?: number;
  protocolRisk?: number;
  historicalPerformance?: number;
}

export class GuaranteedProfitEngine {
  private sentimentAnalyzer: SentimentAnalyzer;
  private technicalAnalyzer: TechnicalAnalyzer;
  private patternRecognizer: PatternRecognizer;
  private riskScorer: RiskScorer;
  private newsAnalyzer: NewsAnalyzer;
  private whaleTracker: WhaleTracker;
  private marketPredictor: MarketPredictor;
  private portfolioOptimizer: PortfolioOptimizer;

  // Yeni AI modülleri
  private onChainAnalyzer: OnChainAnalyzer;
  private offChainAnalyzer: OffChainAnalyzer;
  private advancedIndicators: AdvancedIndicators;
  private fundamentalAnalyzer: FundamentalAnalyzer;
  private arbitrageDetector: ArbitrageDetector;
  private mevDetector: MEVDetector;
  private flashLoanOptimizer: FlashLoanOptimizer;
  private yieldFarmingOptimizer: YieldFarmingOptimizer;
  private liquidationSniper: LiquidationSniper;
  private optionsVolArb: OptionsVolArb;
  private basisCarry: BasisCarry;
  private l2: OrderbookL2Service;
  private featureStore: FeatureStore;
  private alphaModels: AlphaModels;
  private metaEnsemble: MetaEnsemble;
  private funding: FundingRateService;
  private borrowOpt: BorrowRateOptimizer;
  private optionsAnalytics: OptionsAnalytics;
  private newsTrend: NewsTrendService;
  private entitySent: EntitySentimentService;
  private anomaly: AnomalyDetector;
  private flowNow: OnChainFlowNowcaster;
  private marketValidator: MarketDataValidator;
  private atomicExecutor: AtomicExecutionEngine;
  private emergencyController: EmergencyController;
  private positionSizer: DynamicPositionSizer;
  private pnlTracker: RealTimePnLTracker;
  private backtestingEngine: BacktestingEngine;
  private paperTradingEngine: PaperTradingEngine;
  private liquidityAggregator: LiquidityAggregator;
  private slippageProtector: SlippageProtector;

  private isRunning: boolean = false;
  private activeSignals: Map<string, GuaranteedSignal> = new Map();
  private currentRegime: MarketRegime = 'UNKNOWN';
  private dataProviders: string[] = ['PRIMARY', 'SECONDARY'];
  private activeProviderIndex: number = 0;
  private lastAnomalyAt: number | null = null;
  private lastLatencyMs: number = 0;
  private clockSkewMs: number = 0;
  private presetsAB: Record<string, any> = {
    MICRO_SAFE: { minConfidence: 98, takeProfitPct: 0.5, stopLossPct: 0.3 },
    SPEED: { minConfidence: 95, takeProfitPct: 0.4, stopLossPct: 0.25 }
  };
  private activePresetKey: string = 'MICRO_SAFE';
  private counters = {
    signalsGenerated: 0,
    signalsFilteredEdge: 0,
    signalsThrottled: 0,
    tradesSimulated: 0,
    latencies: [] as number[]
  };
  // Fast Micro-Profit preset
  private preset = {
    minConfidence: 98,
    preferArbitrage: true,
    enableMEV: false,
    enableFlashLoan: false,
    enableYield: false,
    takeProfitPct: 0.6,
    stopLossPct: 0.3,
    maxSignalsPerCycle: 3,
    // SpikeGuard thresholds
    spikePricePct: 1.0, // %1 ani hareket (kısa pencerede)
    spikeFreezeMs: 3 * 60 * 1000, // 3 dakika
    volumeZMin: 2.0,
    // NewsGate thresholds
    newsSentimentAbsGate: 80, // |newsSentiment| yüksekse dur
    regulatoryNegGate: -50, // reg. haberleri çok negatifse dur
    newsFreezeMs: 5 * 60 * 1000, // 5 dakika
    // Risk Guard thresholds
    dailyLossLimitPct: 2.0, // günlük -%2 zarar sonrası kapat
    maxConsecutiveLosses: 3,
    circuitBreakerMs: 15 * 60 * 1000, // 15 dk duraklat
    // Execution safeguards
    maxSlippagePct: 0.15, // %0.15
    minLiquidityUSD: 10000, // emir defteri/derinlik için yaklaşık alt sınır
    // Sizing & Leverage
    kellyFractionCap: 0.25,
    volatilityTargetPct: 0.6, // günlük hedef volatilite %
    leverageMax: 5
  };

  // Speed Mode (agresif) ayarları
  private speedMode = {
    enabled: false,
    analysisIntervalMs: 10000,
    minConfidence: 95,
    takeProfitPct: 0.4,
    stopLossPct: 0.25,
    preferArbitrage: true,
    kellyFractionCap: 0.35,
    volatilityTargetPct: 1.2,
    leverageMax: 8,
    maxSlippagePct: 0.25,
    minLiquidityUSD: 5000
  };

  // Spike/News gating state
  private spikeActiveUntil: number | null = null;
  private newsActiveUntil: number | null = null;
  // Throttle
  private minSignalIntervalMs: number = 20000; // sembol başına min sinyal aralığı (20 sn)
  private lastSignalAt: Map<string, number> = new Map();

  // Risk guard state
  private dailyStats = {
    dayKey: '' as string,
    realizedPnLUSD: 0 as number,
    consecutiveLosses: 0 as number
  };
  private circuitBreakerUntil: number | null = null;
  private symbolCircuitBreaker: Map<string, number> = new Map();
  private strategyCircuitBreaker: Map<string, number> = new Map();

  // Kelly sizing helpers (basit sürüm)
  private kelly = {
    fractionCap: 0.25 // portföyün en fazla %25'i
  };

  constructor() {
    this.sentimentAnalyzer = new SentimentAnalyzer();
    this.technicalAnalyzer = new TechnicalAnalyzer();
    this.patternRecognizer = new PatternRecognizer();
    this.riskScorer = new RiskScorer();
    this.newsAnalyzer = new NewsAnalyzer();
    this.whaleTracker = new WhaleTracker();
    this.marketPredictor = new MarketPredictor();
    this.portfolioOptimizer = new PortfolioOptimizer();

    // Yeni AI modülleri
    this.onChainAnalyzer = new OnChainAnalyzer();
    this.offChainAnalyzer = new OffChainAnalyzer();
    this.advancedIndicators = new AdvancedIndicators();
    this.fundamentalAnalyzer = new FundamentalAnalyzer();
    this.arbitrageDetector = new ArbitrageDetector();
    this.mevDetector = new MEVDetector();
    this.flashLoanOptimizer = new FlashLoanOptimizer();
    this.yieldFarmingOptimizer = new YieldFarmingOptimizer();
    this.liquidationSniper = new LiquidationSniper();
    this.optionsVolArb = new OptionsVolArb();
    this.basisCarry = new BasisCarry();
    this.l2 = new OrderbookL2Service();
    this.featureStore = new FeatureStore(this.l2);
    this.alphaModels = new AlphaModels();
    this.metaEnsemble = new MetaEnsemble();
    this.funding = new FundingRateService();
    this.borrowOpt = new BorrowRateOptimizer();
    this.optionsAnalytics = new OptionsAnalytics();
    this.newsTrend = new NewsTrendService();
    this.entitySent = new EntitySentimentService();
    this.anomaly = new AnomalyDetector();
    this.flowNow = new OnChainFlowNowcaster();
    this.marketValidator = new MarketDataValidator();
    this.atomicExecutor = new AtomicExecutionEngine();
    this.emergencyController = new EmergencyController();
    this.positionSizer = new DynamicPositionSizer();
    this.pnlTracker = new RealTimePnLTracker();
    this.backtestingEngine = new BacktestingEngine();
    this.paperTradingEngine = new PaperTradingEngine();
    this.liquidityAggregator = new LiquidityAggregator();
    this.slippageProtector = new SlippageProtector();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Garanti Kazanç AI Engine başlatılıyor...');
      
      // Tüm AI modüllerini başlat
      // Initialize core services (non-Ethereum dependent)
      await Promise.allSettled([
        this.sentimentAnalyzer.initialize(),
        this.technicalAnalyzer.initialize(),
        this.patternRecognizer.initialize(),
        this.riskScorer.initialize(),
        this.newsAnalyzer.initialize(),
        this.whaleTracker.initialize(),
        this.marketPredictor.initialize(),
        this.portfolioOptimizer.initialize(),
        this.onChainAnalyzer.initialize(),
        this.offChainAnalyzer.initialize(),
        this.advancedIndicators.initialize(),
        this.fundamentalAnalyzer.initialize(),
        this.arbitrageDetector.initialize(),
        this.liquidationSniper.initialize(),
        this.optionsVolArb.initialize(),
        this.basisCarry.initialize(),
        this.l2.initialize(),
        this.featureStore.initialize(),
        this.alphaModels.initialize(),
        this.metaEnsemble.initialize()
      ]);

      // Initialize Ethereum-dependent services with error handling
      const ethereumServices = [
        { name: 'MEV Detector', service: this.mevDetector },
        { name: 'Flash Loan Optimizer', service: this.flashLoanOptimizer },
        { name: 'Yield Farming Optimizer', service: this.yieldFarmingOptimizer }
      ];

      for (const { name, service } of ethereumServices) {
        try {
          await service.initialize();
          logger.info(`✅ ${name} başarıyla başlatıldı`);
        } catch (error) {
          logger.warn(`⚠️ ${name} başlatılamadı, devre dışı bırakılıyor:`, error.message);
        }
      }
      await Promise.all([
        this.funding.initialize(),
        this.borrowOpt.initialize(),
        this.optionsAnalytics.initialize(),
        this.newsTrend.initialize(),
        this.entitySent.initialize(),
        this.flowNow.initialize(),
        this.marketValidator.initialize(),
        this.atomicExecutor.initialize(),
        this.emergencyController.initialize(),
        this.positionSizer.initialize(),
        this.pnlTracker.initialize(),
        this.backtestingEngine.initialize(),
        this.paperTradingEngine.initialize(),
        this.liquidityAggregator.initialize(),
        this.slippageProtector.initialize()
      ]);
      
      logger.info('✅ Garanti Kazanç AI Engine başarıyla başlatıldı');
    } catch (error) {
      logger.error('❌ Garanti Kazanç AI Engine başlatılamadı:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('⚠️ Garanti Kazanç Engine zaten çalışıyor');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Garanti Kazanç Engine başlatılıyor...');

    // Sürekli analiz döngüsü
    this.startContinuousAnalysis();
    
    logger.info('✅ Garanti Kazanç Engine başlatıldı');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('⚠️ Garanti Kazanç Engine çalışmıyor');
      return;
    }

    this.isRunning = false;
    logger.info('🛑 Garanti Kazanç Engine durduruldu');
  }

  private generatePriceData(symbol: string): any[] {
    // Placeholder fiyat verisi oluştur
    const priceData = [];
    const basePrice = 50000; // BTC için örnek
    
    for (let i = 0; i < 100; i++) {
      const timestamp = new Date(Date.now() - (100 - i) * 24 * 60 * 60 * 1000);
      const price = basePrice + Math.random() * 10000 - 5000;
      const high = price + Math.random() * 1000;
      const low = price - Math.random() * 1000;
      const volume = Math.random() * 1000000;
      
      priceData.push({
        timestamp,
        open: price,
        high: high,
        low: low,
        close: price + Math.random() * 200 - 100,
        volume: volume
      });
    }
    
    return priceData;
  }

  private async startContinuousAnalysis(): Promise<void> {
    const tick = async () => {
      if (!this.isRunning) {
        return;
      }
      try {
        const symbols = ['BTC', 'ETH', 'ADA', 'DOT', 'LINK', 'UNI', 'AAVE', 'COMP'];
        for (const symbol of symbols) {
          const analysis = await this.analyzeSymbol(symbol);
          this.detectAndSetRegime(analysis);
          const signal = await this.generateGuaranteedSignal(analysis);
          if (signal && signal.confidence >= 85) {
            this.activeSignals.set(symbol, signal);
            await this.notifySignal(signal);
          }
        }
      } catch (error) {
        logger.error('❌ Sürekli analiz hatası:', error);
      } finally {
        setTimeout(tick, this.speedMode.enabled ? this.speedMode.analysisIntervalMs : 30000);
      }
    };
    setTimeout(tick, 1000);
  }

  private getDayKey(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
  }

  private resetDailyIfNeeded(): void {
    const key = this.getDayKey();
    if (this.dailyStats.dayKey !== key) {
      this.dailyStats.dayKey = key;
      this.dailyStats.realizedPnLUSD = 0;
      this.dailyStats.consecutiveLosses = 0;
    }
  }

  private isCircuitBreakerActive(): boolean {
    return !!(this.circuitBreakerUntil && Date.now() < this.circuitBreakerUntil);
  }

  private isSymbolCBActive(symbol: string): boolean {
    const until = this.symbolCircuitBreaker.get(symbol);
    return !!(until && Date.now() < until);
  }

  private isStrategyCBActive(strategy: string): boolean {
    const until = this.strategyCircuitBreaker.get(strategy);
    return !!(until && Date.now() < until);
  }

  private setCircuitBreaker(level: 'GLOBAL' | 'SYMBOL' | 'STRATEGY', key: string | null, ms: number): void {
    const until = Date.now() + ms;
    if (level === 'GLOBAL') this.circuitBreakerUntil = until;
    if (level === 'SYMBOL' && key) this.symbolCircuitBreaker.set(key, until);
    if (level === 'STRATEGY' && key) this.strategyCircuitBreaker.set(key, until);
  }

  private canOpenNewTrade(): boolean {
    this.resetDailyIfNeeded();
    if (this.isCircuitBreakerActive()) return false;
    // Günlük zarar limiti: toplam realizedPnLUSD negatifte ve limiti aştıysa dur
    const portfolioNotional = 100000; // TODO: gerçek portföy değeri ile değiştir
    const dailyLossPct = portfolioNotional > 0 ? (Math.min(0, this.dailyStats.realizedPnLUSD) / portfolioNotional) * 100 : 0;
    if (Math.abs(dailyLossPct) >= this.preset.dailyLossLimitPct) return false;
    if (this.dailyStats.consecutiveLosses >= this.preset.maxConsecutiveLosses) return false;
    return true;
  }

  private canOpenTradeFor(symbol: string, strategy: string): boolean {
    if (!this.canOpenNewTrade()) return false;
    if (this.isSymbolCBActive(symbol)) return false;
    if (this.isStrategyCBActive(strategy)) return false;
    return true;
  }

  public recordTradeResult(pnlUSD: number): void {
    try {
      this.resetDailyIfNeeded();
      this.dailyStats.realizedPnLUSD += pnlUSD;
      if (pnlUSD < 0) {
        this.dailyStats.consecutiveLosses += 1;
      } else {
        this.dailyStats.consecutiveLosses = 0;
      }
      // Circuit breaker koşulu
      const portfolioNotional = 100000; // TODO
      const dailyLossPct = portfolioNotional > 0 ? (Math.min(0, this.dailyStats.realizedPnLUSD) / portfolioNotional) * 100 : 0;
      if (Math.abs(dailyLossPct) >= this.preset.dailyLossLimitPct || this.dailyStats.consecutiveLosses >= this.preset.maxConsecutiveLosses) {
        this.circuitBreakerUntil = Date.now() + this.preset.circuitBreakerMs;
        logger.warn(`⛔ Circuit breaker aktif. ${new Date(this.circuitBreakerUntil).toISOString()} kadar yeni işlem yok.`);
      }
    } catch {}
  }

  private preTradeValidateEdge(params: {
    symbol: string;
    strategy: string; // e.g. 'ARBITRAGE' | 'TA' | 'LIQUIDATION' | 'FLASH_LOAN'
    expectedProfitPct: number;
    feesPct?: number;
    estSlippagePct?: number;
    liquidityUSD?: number;
    notionalUSD?: number;
  }): boolean {
    const { symbol, strategy, expectedProfitPct, feesPct = 0.05 } = params;
    let { estSlippagePct, liquidityUSD } = params as any;
    const notionalUSD = params.notionalUSD ?? 0;
    // CB checks
    if (!this.canOpenTradeFor(symbol, strategy)) return false;
    // Liquidity/Slippage caps
    const liqCap = this.speedMode.enabled ? this.speedMode.minLiquidityUSD : this.preset.minLiquidityUSD;
    const slipCap = this.speedMode.enabled ? this.speedMode.maxSlippagePct : this.preset.maxSlippagePct;
    if (!liquidityUSD || liquidityUSD <= 0) {
      liquidityUSD = this.getTopLiquidityUSD(symbol);
    }
    if (liquidityUSD < liqCap) return false;
    if (estSlippagePct === undefined || estSlippagePct === null) {
      estSlippagePct = this.simulateDepthSlippage({ notionalUSD: notionalUSD > 0 ? notionalUSD : liqCap, topLiquidityUSD: liquidityUSD });
    }
    if (estSlippagePct > slipCap) return false;
    // Net edge check
    const net = expectedProfitPct - (feesPct + estSlippagePct);
    const minNet = 0.1; // %0.1 zorunlu net edge (preset ile taşınabilir)
    return net >= minNet;
  }

  private detectAndSetRegime(analysis: GuaranteedAnalysis): void {
    try {
      const { technicalIndicators, offChainMetrics } = analysis;
      const adx = technicalIndicators.adx?.value ?? 0;
      const macdHist = technicalIndicators.macd?.histogram ?? 0;
      const bbw = technicalIndicators.bollingerBands?.bandwidth ?? 0;
      const newsAbs = Math.abs(offChainMetrics.newsSentiment || 0);
      let regime: MarketRegime = 'UNKNOWN';
      if (newsAbs >= this.preset.newsSentimentAbsGate) regime = 'EVENT_DRIVEN';
      else if (adx >= 25 && Math.abs(macdHist) > 0.5) regime = 'TRENDING';
      else if (bbw < 0.05) regime = 'RANGING';
      else regime = 'UNKNOWN';
      this.currentRegime = regime;
    } catch {}
  }

  public getSystemStatus(): any {
    this.resetDailyIfNeeded();
    return {
      spikeActiveUntil: this.spikeActiveUntil,
      newsActiveUntil: this.newsActiveUntil,
      circuitBreakerUntil: this.circuitBreakerUntil,
      symbolCircuitBreakers: Array.from(this.symbolCircuitBreaker.entries()),
      strategyCircuitBreakers: Array.from(this.strategyCircuitBreaker.entries()),
      dailyLossUSD: this.dailyStats.realizedPnLUSD,
      consecutiveLosses: this.dailyStats.consecutiveLosses,
      preset: this.preset,
      speedMode: this.speedMode,
      providers: {
        list: this.dataProviders,
        active: this.dataProviders[this.activeProviderIndex] || null,
        lastAnomalyAt: this.lastAnomalyAt
      },
      latency: {
        lastLatencyMs: this.lastLatencyMs,
        clockSkewMs: this.clockSkewMs
      },
      abTesting: {
        activePresetKey: this.activePresetKey,
        presets: Object.keys(this.presetsAB)
      },
      throttle: {
        minSignalIntervalMs: this.minSignalIntervalMs,
        lastSignalAtCount: this.lastSignalAt.size
      },
      monitoring: {
        ...this.counters
      },
      regimeAllocation: {
        currentRegime: this.currentRegime,
        activePreset: this.activePresetKey,
        banditWeights: this.portfolioOptimizer.getBanditWeights(),
        regimePerformance: this.portfolioOptimizer.getRegimePerformance()
      }
    };
  }

  public computeKellyFraction(winRate: number, rewardRisk: number): number {
    // Basit Kelly: f* = p - (1-p)/b, b = reward/risk
    const p = Math.max(0, Math.min(1, winRate));
    const b = Math.max(0.0001, rewardRisk);
    const f = p - (1 - p) / b;
    return Math.max(0, Math.min(this.preset.kellyFractionCap, f));
  }

  public computeDynamicLeverage(realizedDailyVolPct: number): number {
    // Basit hedef volatilite: lev = targetVol / realizedVol
    const vol = Math.max(0.01, realizedDailyVolPct);
    const lev = this.preset.volatilityTargetPct / vol;
    return Math.max(1, Math.min(this.preset.leverageMax, lev));
  }

  public computePositionSizeUSD(params: {
    winRate: number; // 0..1
    rewardRisk: number; // R multiple
    portfolioUSD: number;
    realizedDailyVolPct: number;
    maxInvestmentUSD?: number;
  }): number {
    const { winRate, rewardRisk, portfolioUSD, realizedDailyVolPct, maxInvestmentUSD } = params;
    const kellyF = this.computeKellyFraction(winRate, rewardRisk);
    const lev = this.computeDynamicLeverage(realizedDailyVolPct);
    const base = portfolioUSD * kellyF;
    const sized = base * lev;
    const capped = Math.max(0, Math.min(sized, maxInvestmentUSD ?? sized));
    return Math.floor(capped);
  }

  // Speed Mode kontrolü
  public setSpeedMode(enabled: boolean): void {
    this.speedMode.enabled = enabled;
    if (enabled) {
      this.preset.minConfidence = Math.min(this.preset.minConfidence, this.speedMode.minConfidence);
      this.preset.takeProfitPct = this.speedMode.takeProfitPct;
      this.preset.stopLossPct = this.speedMode.stopLossPct;
    }
  }

  public getSpeedMode(): boolean {
    return this.speedMode.enabled;
  }

  // A/B preset control with regime-aware allocation
  public setActivePreset(key: string): boolean {
    const preset = this.presetsAB[key];
    if (!preset) return false;
    this.activePresetKey = key;
    // apply selected baseline to core preset while keeping guard caps
    this.preset.minConfidence = preset.minConfidence ?? this.preset.minConfidence;
    this.preset.takeProfitPct = preset.takeProfitPct ?? this.preset.takeProfitPct;
    this.preset.stopLossPct = preset.stopLossPct ?? this.preset.stopLossPct;
    return true;
  }

  // Regime-aware preset selection using bandit learning
  public async selectOptimalPresetForRegime(): Promise<string> {
    try {
      const availablePresets = Object.keys(this.presetsAB);
      const selectedPreset = await this.portfolioOptimizer.selectPresetForRegime(
        this.currentRegime, 
        availablePresets
      );
      
      if (selectedPreset !== this.activePresetKey) {
        logger.info(`🔄 Regime-aware preset switch: ${this.activePresetKey} → ${selectedPreset} (regime: ${this.currentRegime})`);
        this.setActivePreset(selectedPreset);
      }
      
      return selectedPreset;
    } catch (error) {
      logger.error('❌ Regime-aware preset selection failed:', error);
      return this.activePresetKey;
    }
  }

  // Update performance tracking after trade execution
  public recordTradeResultWithRisk(pnl: number, risk: number = 1.0): void {
    try {
      const win = pnl > 0;
      this.portfolioOptimizer.updateRegimePerformance(
        this.currentRegime,
        this.activePresetKey,
        { pnl, win, risk }
      );
      
      logger.info(`📊 Trade result recorded: PnL=${pnl.toFixed(2)}, Win=${win}, Regime=${this.currentRegime}, Preset=${this.activePresetKey}`);
    } catch (error) {
      logger.error('❌ Trade result recording failed:', error);
    }
  }

  // Get regime-aware allocation recommendations
  public async getRegimeAllocation(totalCapital: number): Promise<{
    preset: string;
    allocation: number;
    confidence: number;
    regime: string;
  }> {
    try {
      const availablePresets = Object.keys(this.presetsAB);
      const allocation = await this.portfolioOptimizer.allocateCapitalByRegime(
        this.currentRegime,
        totalCapital,
        availablePresets
      );
      
      return {
        ...allocation,
        regime: this.currentRegime
      };
    } catch (error) {
      logger.error('❌ Regime allocation failed:', error);
      return {
        preset: this.activePresetKey,
        allocation: 0.5,
        confidence: 0.5,
        regime: this.currentRegime
      };
    }
  }

  public getMonitoringMetrics() {
    return { ...this.counters };
  }

  // Market data validation
  public async validateMarketData(symbol: string): Promise<any> {
    try {
      return await this.marketValidator.crossValidatePrices(symbol);
    } catch (error) {
      logger.error('❌ Market data validation failed:', error);
      throw error;
    }
  }

  // Atomic execution
  public async executeAtomicTransaction(orders: any[]): Promise<any> {
    try {
      const transactionId = await this.atomicExecutor.createAtomicTransaction(orders);
      return await this.atomicExecutor.executeAtomicTransaction(transactionId);
    } catch (error) {
      logger.error('❌ Atomic execution failed:', error);
      throw error;
    }
  }

  // Emergency controls
  public async triggerEmergencyStop(params: {
    type: 'SYSTEM' | 'SYMBOL' | 'EXCHANGE' | 'STRATEGY';
    reason: string;
    scope: string[];
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    initiatedBy: string;
  }): Promise<string> {
    try {
      return await this.emergencyController.triggerEmergencyStop(params);
    } catch (error) {
      logger.error('❌ Emergency stop failed:', error);
      throw error;
    }
  }

  public getEmergencyStatus(): any {
    return this.emergencyController.getEmergencyStatus();
  }

  public isTradingAllowed(symbol?: string, exchange?: string): boolean {
    return this.emergencyController.isTradingAllowed(symbol, exchange);
  }

  // Dynamic position sizing
  public async calculatePositionSize(params: any): Promise<any> {
    try {
      return await this.positionSizer.calculatePositionSize(params);
    } catch (error) {
      logger.error('❌ Position sizing failed:', error);
      throw error;
    }
  }

  public async updateRiskMetrics(symbol: string, tradeOutcome: any): Promise<void> {
    try {
      await this.positionSizer.updateRiskMetrics(symbol, tradeOutcome);
    } catch (error) {
      logger.error('❌ Risk metrics update failed:', error);
      throw error;
    }
  }

  public getRiskMetrics(symbol: string): any {
    return this.positionSizer.getRiskMetrics(symbol);
  }

  public async calculatePortfolioRisk(positions: any[]): Promise<any> {
    try {
      return await this.positionSizer.calculatePortfolioRisk(positions);
    } catch (error) {
      logger.error('❌ Portfolio risk calculation failed:', error);
      throw error;
    }
  }

  // Real-time P&L tracking
  public async addPosition(position: any): Promise<string> {
    try {
      return await this.pnlTracker.addPosition(position);
    } catch (error) {
      logger.error('❌ Add position failed:', error);
      throw error;
    }
  }

  public async updatePosition(positionId: string, updates: any): Promise<boolean> {
    try {
      return await this.pnlTracker.updatePosition(positionId, updates);
    } catch (error) {
      logger.error('❌ Update position failed:', error);
      throw error;
    }
  }

  public async closePosition(positionId: string, exitPrice: number, reason?: string): Promise<boolean> {
    try {
      return await this.pnlTracker.closePosition(positionId, exitPrice, reason);
    } catch (error) {
      logger.error('❌ Close position failed:', error);
      throw error;
    }
  }

  public calculatePnL(position: any, currentPrice?: number): any {
    return this.pnlTracker.calculatePnL(position, currentPrice);
  }

  public getPortfolioPnL(): any {
    return this.pnlTracker.getPortfolioPnL();
  }

  public async addAutoCloseRule(rule: any): Promise<string> {
    try {
      return await this.pnlTracker.addAutoCloseRule(rule);
    } catch (error) {
      logger.error('❌ Add auto-close rule failed:', error);
      throw error;
    }
  }

  public getPosition(positionId: string): any {
    return this.pnlTracker.getPosition(positionId);
  }

  public getAllPositions(): any[] {
    return this.pnlTracker.getAllPositions();
  }

  public getPnLHistory(positionId: string): any[] {
    return this.pnlTracker.getPnLHistory(positionId);
  }

  public getAutoCloseRules(positionId: string): any[] {
    return this.pnlTracker.getAutoCloseRules(positionId);
  }

  public getPnLStats(): any {
    return this.pnlTracker.getStats();
  }

  // Backtesting system
  public async runBacktest(config: any): Promise<any> {
    try {
      return await this.backtestingEngine.runBacktest(config);
    } catch (error) {
      logger.error('❌ Backtest failed:', error);
      throw error;
    }
  }

  public async getBacktestResults(backtestId: string): Promise<any> {
    try {
      // Placeholder implementation
      return { backtestId, status: 'COMPLETED', results: {} };
    } catch (error) {
      logger.error('❌ Get backtest results failed:', error);
      throw error;
    }
  }

  public async getBacktestHistory(): Promise<any[]> {
    try {
      // Placeholder implementation
      return [];
    } catch (error) {
      logger.error('❌ Get backtest history failed:', error);
      throw error;
    }
  }

  // Paper trading system
  public async createPaperPortfolio(config: any): Promise<string> {
    try {
      return await this.paperTradingEngine.createPortfolio(config);
    } catch (error) {
      logger.error('❌ Create paper portfolio failed:', error);
      throw error;
    }
  }

  public async executePaperTrade(portfolioId: string, signal: any): Promise<boolean> {
    try {
      return await this.paperTradingEngine.executeTrade(portfolioId, signal);
    } catch (error) {
      logger.error('❌ Execute paper trade failed:', error);
      throw error;
    }
  }

  public getPaperPortfolio(portfolioId: string): any {
    return this.paperTradingEngine.getPortfolio(portfolioId);
  }

  public getAllPaperPortfolios(): any[] {
    return this.paperTradingEngine.getAllPortfolios();
  }

  // Liquidity aggregation
  public async getLiquiditySnapshot(symbol: string): Promise<any> {
    try {
      return await this.liquidityAggregator.getLiquiditySnapshot(symbol);
    } catch (error) {
      logger.error('❌ Get liquidity snapshot failed:', error);
      throw error;
    }
  }

  public async generateSmartRoute(symbol: string, side: 'BUY' | 'SELL', size: number): Promise<any> {
    try {
      return await this.liquidityAggregator.generateSmartRoute(symbol, side, size);
    } catch (error) {
      logger.error('❌ Generate smart route failed:', error);
      throw error;
    }
  }

  public async getLiquidityMetrics(symbol: string): Promise<any> {
    try {
      return await this.liquidityAggregator.getLiquidityMetrics(symbol);
    } catch (error) {
      logger.error('❌ Get liquidity metrics failed:', error);
      throw error;
    }
  }

  public getAllLiquiditySources(): any[] {
    return this.liquidityAggregator.getAllSources();
  }

  // Slippage protection
  public async analyzeSlippage(symbol: string, side: 'BUY' | 'SELL', size: number): Promise<any> {
    try {
      return await this.slippageProtector.analyzeSlippage(symbol, side, size);
    } catch (error) {
      logger.error('❌ Analyze slippage failed:', error);
      throw error;
    }
  }

  public async createSlippageProtection(symbol: string, side: 'BUY' | 'SELL', size: number, config?: any): Promise<string> {
    try {
      return await this.slippageProtector.createProtection(symbol, side, size, config) || '';
    } catch (error) {
      logger.error('❌ Create slippage protection failed:', error);
      throw error;
    }
  }

  public getSlippageProtection(protectionId: string): any {
    return this.slippageProtector.getProtection(protectionId);
  }

  public getAllSlippageProtections(): any[] {
    return this.slippageProtector.getAllProtections();
  }

  // Fetch approximate top-of-book liquidity (USD) – placeholder until L2 WS integration
  private getTopLiquidityUSD(symbol: string): number {
    // Prefer L2 service if available
    try {
      return this.l2.getTopLiquidityUSD(symbol);
    } catch {
      const defaults: Record<string, number> = { BTC: 50000, ETH: 30000 };
      return defaults[symbol as keyof typeof defaults] ?? 15000;
    }
  }

  // Depth-based slippage simulator (simplified placeholder)
  private simulateDepthSlippage(params: { notionalUSD: number; topLiquidityUSD: number }): number {
    const { notionalUSD, topLiquidityUSD } = params;
    if (!isFinite(notionalUSD) || !isFinite(topLiquidityUSD) || topLiquidityUSD <= 0) {
      return 1.0; // worst-case fallback
    }
    const ratio = Math.max(0, Math.min(5, notionalUSD / topLiquidityUSD));
    // concave increase in slippage as notional approaches depth
    const slip = 0.02 * ratio + 0.01 * Math.sqrt(ratio); // e.g., up to ~>0 when ratio high
    const chaosMult = chaos.getSlipMultiplier ? chaos.getSlipMultiplier() : 1;
    return Math.max(0, Math.min(1, slip * chaosMult));
  }

  private switchProvider(): void {
    this.activeProviderIndex = (this.activeProviderIndex + 1) % this.dataProviders.length;
    logger.warn(`🔁 Veri sağlayıcı değiştirildi → ${this.dataProviders[this.activeProviderIndex]}`);
  }

  private checkDataAnomalies(priceData: any[]): void {
    try {
      if (!priceData || priceData.length < 3) return;
      const last = priceData.slice(-3);
      const vols = last.map(c => c.volume || 0);
      const closes = last.map(c => c.close || 0);
      const volSpike = Math.max(...vols) > 50 * (Math.min(...vols) + 1);
      const zeroClose = closes.some(c => !isFinite(c) || c <= 0);
      if (volSpike || zeroClose) {
        this.lastAnomalyAt = Date.now();
        this.switchProvider();
      }
      const injected = chaos.getLatencyMs ? chaos.getLatencyMs() : 0;
      const latency = Math.max(5, Math.random() * 50) + injected;
      this.lastLatencyMs = latency;
      this.clockSkewMs = Math.max(-20, Math.min(20, (Math.random() - 0.5) * 40));
      try { this.counters.latencies.push(this.lastLatencyMs); if (this.counters.latencies.length > 200) this.counters.latencies.shift(); } catch {}
    } catch {}
  }

  async analyzeSymbol(symbol: string): Promise<GuaranteedAnalysis> {
    try {
      logger.info(`🔍 ${symbol} için garanti kazanç analizi başlatılıyor...`);

      // Fiyat verilerini al (placeholder)
      const priceData = this.generatePriceData(symbol);
      this.checkDataAnomalies(priceData);

      // Paralel analizler
      const [
        onChainMetrics,
        offChainMetrics,
        technicalIndicators,
        fundamentalMetrics,
        arbitrageOpportunities,
        liquidationOpportunities,
        optionsVolArbOpportunities,
        basisCarryOpportunities,
        fundingForecast,
        borrowBest,
        optionsOpps
      ] = await Promise.all([
        this.onChainAnalyzer.analyze(symbol),
        this.offChainAnalyzer.analyze(symbol),
        this.advancedIndicators.analyze(symbol, priceData),
        this.fundamentalAnalyzer.analyze(symbol),
        this.arbitrageDetector.findOpportunities(symbol),
        this.liquidationSniper.findOpportunities(symbol),
        this.optionsVolArb.findOpportunities(symbol),
        this.basisCarry.findOpportunities(symbol),
        this.funding.forecast(symbol),
        Promise.resolve(this.borrowOpt.getBestBorrow('USDT')),
        this.optionsAnalytics.analyze(symbol)
      ]);

      // Ethereum-dependent services (only if initialized)
      let mevOpportunities: any[] = [];
      let flashLoanOpportunities: any[] = [];
      let yieldFarmingOpportunities: any[] = [];

      try {
        if (this.mevDetector.isInitialized) {
          mevOpportunities = await this.mevDetector.findOpportunities(symbol);
        }
      } catch (error) {
        logger.warn(`⚠️ MEV Detector analysis failed for ${symbol}:`, error.message);
      }

      try {
        if (this.flashLoanOptimizer.isInitialized) {
          flashLoanOpportunities = await this.flashLoanOptimizer.findOpportunities(symbol);
        }
      } catch (error) {
        logger.warn(`⚠️ Flash Loan Optimizer analysis failed for ${symbol}:`, error.message);
      }

      try {
        if (this.yieldFarmingOptimizer.isInitialized) {
          yieldFarmingOpportunities = await this.yieldFarmingOptimizer.findOpportunities(symbol);
        }
      } catch (error) {
        logger.warn(`⚠️ Yield Farming Optimizer analysis failed for ${symbol}:`, error.message);
      }

      // Build features and run alpha models + meta-ensemble
      const features = await this.featureStore.buildFeatures(symbol, {
        indicators: { rsi: (technicalIndicators as any).rsi, macd: (technicalIndicators as any).macd },
        offChain: { sentimentScore: (offChainMetrics as any).socialSentiment },
        onChain: { activeAddresses: (onChainMetrics as any).activeAddresses },
        vol24h: (fundamentalMetrics as any).volume24h
      });
      const alphaPreds = await this.alphaModels.predict(features as any);
      const ensemble = this.metaEnsemble.blend(alphaPreds || []);

      // News & entity sentiment & flow & anomalies
      const headlines = await this.newsTrend.fetchRecent(symbol);
      const entityScores = await this.entitySent.scoreEntities(symbol, headlines);
      const flow = await this.flowNow.nowcast(symbol);
      const anomalies = this.anomaly.detect({
        priceChangePct: (()=>{ try { const last = priceData.slice(-2); if (last.length>=2) return ((last[1].close-last[0].close)/(last[0].close||1))*100; } catch{} return 0; })(),
        volumeZ: 0,
        newsCount: headlines.length,
        flowDelta: flow.whaleNetUSD + (flow.cexInflowUSD - flow.cexOutflowUSD)
      });

      // SpikeGuard: ani volatilite kontrolü (son 3 mum)
      try {
        const last = priceData.slice(-3);
        if (last.length >= 2) {
          const p0 = last[last.length - 2].close;
          const p1 = last[last.length - 1].close;
          const priceMovePct = Math.abs(((p1 - p0) / (p0 || 1)) * 100);
          const avgVol = last.reduce((s: number, c: any) => s + (c.volume || 0), 0) / last.length;
          const volNow = last[last.length - 1].volume || 0;
          const volZ = avgVol > 0 ? (volNow - avgVol) / (avgVol * 0.5) : 0; // kaba yaklaşım
          if (priceMovePct >= this.preset.spikePricePct || volZ >= this.preset.volumeZMin) {
            this.spikeActiveUntil = Date.now() + this.preset.spikeFreezeMs;
          }
        }
      } catch {}

      // NewsGate: haber belirsizliği kontrolü
      try {
        const newsAbs = Math.abs(offChainMetrics.newsSentiment || 0);
        const regNews = offChainMetrics.regulatoryNews || 0;
        if (newsAbs >= this.preset.newsSentimentAbsGate || regNews <= this.preset.regulatoryNegGate) {
          this.newsActiveUntil = Date.now() + this.preset.newsFreezeMs;
        }
      } catch {}

      // Risk skoru hesapla
      const riskScore = await this.calculateRiskScore({
        onChainMetrics,
        offChainMetrics,
        technicalIndicators,
        fundamentalMetrics
      });

      // Kazanç olasılığı hesapla
      const profitProbability = await this.calculateProfitProbability({
        arbitrageOpportunities,
        mevOpportunities,
        flashLoanOpportunities,
        yieldFarmingOpportunities,
        technicalIndicators,
        fundamentalMetrics
      });

      return {
        symbol,
        timestamp: new Date(),
        onChainMetrics,
        offChainMetrics,
        technicalIndicators,
        fundamentalMetrics,
        arbitrageOpportunities,
        mevOpportunities,
        flashLoanOpportunities,
        yieldFarmingOpportunities,
        liquidationOpportunities,
        optionsVolArbOpportunities,
        basisCarryOpportunities,
        fundingForecast,
        borrowBest,
        optionsOpps,
        newsHeadlines: headlines,
        entitySentiment: entityScores,
        flowNowcast: flow,
        anomalies,
        overallSignal: null as any, // Sonra doldurulacak
        riskScore,
        profitProbability: ensemble?.probUp ? Math.round(ensemble.probUp * 100) : profitProbability
      };

    } catch (error) {
      logger.error(`❌ ${symbol} analizi hatası:`, error);
      throw error;
    }
  }

  async generateGuaranteedSignal(analysis: GuaranteedAnalysis): Promise<GuaranteedSignal | null> {
    try {
      // Risk guard & gating
      if (!this.canOpenNewTrade()) return null;
      // Gate: spike/news aktifse yeni işlem açma
      const nowTs = Date.now();
      if ((this.spikeActiveUntil && nowTs < this.spikeActiveUntil) || (this.newsActiveUntil && nowTs < this.newsActiveUntil)) {
        return null;
      }
      const { symbol, arbitrageOpportunities, mevOpportunities, flashLoanOpportunities, yieldFarmingOpportunities, technicalIndicators, fundamentalMetrics, riskScore, profitProbability, liquidationOpportunities, optionsVolArbOpportunities } = analysis;

      // Yönsel bias hesapla (on-chain + haber + orderbook)
      const bias = this.computeDirectionalBias(analysis);

      // En yüksek kazanç fırsatını bul
      let bestSignal: GuaranteedSignal | null = null;
      let maxProfit = 0;

      // 1. Arbitraj fırsatları (öncelikli)
      if (this.preset.preferArbitrage) {
        for (const opportunity of arbitrageOpportunities) {
          // Execution safeguards: likidite & slipaj
          const liqCap = this.speedMode.enabled ? this.speedMode.minLiquidityUSD : this.preset.minLiquidityUSD;
          const slipCap = this.speedMode.enabled ? this.speedMode.maxSlippagePct : this.preset.maxSlippagePct;
          if ((opportunity.liquidity ?? 0) < liqCap) continue;
          if ((opportunity.estimatedSlippage ?? 0) > slipCap) continue;
          if (!this.preTradeValidateEdge({
            symbol,
            strategy: 'ARBITRAGE',
            expectedProfitPct: opportunity.netProfit,
            feesPct: opportunity.fees ?? 0.05,
            estSlippagePct: opportunity.estimatedSlippage ?? 0.1,
            liquidityUSD: opportunity.liquidity ?? 0
          })) continue;
          if (opportunity.netProfit > maxProfit && opportunity.risk === 'ZERO' && opportunity.confidence >= this.preset.minConfidence) {
            maxProfit = opportunity.netProfit;
            bestSignal = {
              symbol,
              action: 'ARBITRAGE',
              confidence: opportunity.confidence,
              expectedProfit: opportunity.netProfit,
              riskLevel: 'ZERO',
              timeframe: 'IMMEDIATE',
              reason: `Arbitraj: ${opportunity.buyExchange} -> ${opportunity.sellExchange}`,
              arbitrageExchanges: [opportunity.buyExchange, opportunity.sellExchange]
            };
          }
        }
      }

      // 1b. Basis/Funding carry (market-neutral)
      const bcos: BasisCarryOpp[] = (analysis as any).basisCarryOpportunities || [];
      for (const bc of bcos) {
        if (bc.expectedNetPct > maxProfit && bc.risk !== 'MEDIUM' && bc.confidence >= 90) {
          if (this.preTradeValidateEdge({ symbol, strategy: 'ARBITRAGE', expectedProfitPct: bc.expectedNetPct, estSlippagePct: 0.05, liquidityUSD: 20000 })) {
            maxProfit = bc.expectedNetPct;
            bestSignal = {
              symbol,
              action: 'ARBITRAGE',
              confidence: bc.confidence,
              expectedProfit: bc.expectedNetPct,
              riskLevel: 'ZERO',
              timeframe: `${Math.round(bc.windowHours)}h`,
              reason: `Basis/Funding carry: ${bc.spotExchange}/${bc.perpExchange}`
            };
          }
        }
      }

      // 2. MEV fırsatları (preset kapalıysa pas geç)
      if (this.preset.enableMEV) {
        for (const opportunity of mevOpportunities) {
          if (opportunity.netProfit > maxProfit && opportunity.risk === 'ZERO' && (opportunity.confidence ?? 0) >= this.preset.minConfidence) {
            maxProfit = opportunity.netProfit;
            bestSignal = {
              symbol,
              action: 'MEV',
              confidence: opportunity.confidence ?? 98,
              expectedProfit: opportunity.netProfit,
              riskLevel: 'ZERO',
              timeframe: 'IMMEDIATE',
              reason: `MEV: ${opportunity.type}`,
              mevOpportunity: opportunity.type
            };
          }
        }
      }

      // 3. Flash Loan fırsatları (preset kapalıysa pas geç)
      if (this.preset.enableFlashLoan) {
        for (const opportunity of flashLoanOpportunities) {
          if (opportunity.netProfit > maxProfit && opportunity.risk === 'ZERO' && opportunity.confidence >= this.preset.minConfidence) {
            maxProfit = opportunity.netProfit;
            bestSignal = {
              symbol,
              action: 'FLASH_LOAN',
              confidence: opportunity.confidence,
              expectedProfit: opportunity.netProfit,
              riskLevel: 'ZERO',
              timeframe: 'IMMEDIATE',
              reason: `Flash Loan: ${opportunity.platform}`,
              flashLoanAmount: opportunity.loanAmount
            };
          }
        }
      }

      // 4. Yield Farming (preset kapalı: kısa vadede anlamlı değil)
      if (this.preset.enableYield) {
        for (const opportunity of yieldFarmingOpportunities) {
          if (opportunity.netApy > 20 && (opportunity.risk === 'ZERO' || opportunity.risk === 'MINIMAL')) {
            bestSignal = {
              symbol,
              action: 'YIELD_FARM',
              confidence: opportunity.confidence ?? 90,
              expectedProfit: opportunity.netApy,
              riskLevel: opportunity.risk === 'ZERO' ? 'ZERO' : 'MINIMAL',
              timeframe: 'LONG_TERM',
              reason: `Yield: ${opportunity.protocol} - %${opportunity.netApy} net APY`,
              yieldProtocol: opportunity.protocol
            };
          }
        }
      }

      // 5. Liquidation sniping (agresif modda önceliklendirme opsiyonu)
      if (this.speedMode.enabled && liquidationOpportunities && liquidationOpportunities.length > 0) {
        const liq = liquidationOpportunities.sort((a,b) => (b.heatScore*b.confidence) - (a.heatScore*a.confidence))[0];
        if (liq && liq.confidence >= 90 && liq.expectedEdgePct > maxProfit && this.preTradeValidateEdge({
          symbol,
          strategy: 'LIQUIDATION',
          expectedProfitPct: liq.expectedEdgePct,
          estSlippagePct: 0.15,
          liquidityUSD: 10000
        })) {
          maxProfit = liq.expectedEdgePct;
          bestSignal = {
            symbol,
            action: liq.side === 'LONG_LIQ' ? 'SHORT' : 'LONG',
            confidence: liq.confidence,
            expectedProfit: liq.expectedEdgePct,
            riskLevel: 'LOW',
            timeframe: 'IMMEDIATE',
            reason: `Liquidation snipe: heat=${liq.heatScore}, distance=%${liq.distancePct}`
          };
        }
      }

      // 6. Options vol-arb (bilgi amaçlı; manuel/ayrı yürütme)
      if (!bestSignal && optionsVolArbOpportunities && optionsVolArbOpportunities.length > 0) {
        const ov = optionsVolArbOpportunities.sort((a,b) => b.expectedReturnPct - a.expectedReturnPct)[0];
        if (ov && ov.confidence >= 90) {
          bestSignal = {
            symbol,
            action: 'CLOSE',
            confidence: ov.confidence,
            expectedProfit: ov.expectedReturnPct,
            riskLevel: ov.risk === 'LOW' ? 'LOW' : 'MEDIUM',
            timeframe: '1D',
            reason: `Options vol-arb: ${ov.strategy} ivEdge=%${ov.ivEdgePct}`
          };
        }
      }

      // 7. Teknik analiz sinyalleri (sadece yüksek güvenilirlik)
      const minConf = this.speedMode.enabled ? Math.min(this.preset.minConfidence, this.speedMode.minConfidence) : this.preset.minConfidence;
      const tpPct = this.speedMode.enabled ? this.speedMode.takeProfitPct : this.preset.takeProfitPct;
      const slPct = this.speedMode.enabled ? this.speedMode.stopLossPct : this.preset.stopLossPct;
      if (profitProbability >= minConf && riskScore <= 10) {
        const technicalSignal = this.generateTechnicalSignal(technicalIndicators, fundamentalMetrics);
        if (technicalSignal && technicalSignal.confidence >= minConf) {
          // Bias hizalama: en az iki farklı kaynak aynı yönde ise öncelik ver
          const aligns = bias.direction === 'NEUTRAL' || technicalSignal.action === bias.direction;
          if (aligns || (bias.votes >= 2 && (bias.direction === 'LONG' || bias.direction === 'SHORT'))) {
            bestSignal = { ...technicalSignal, takeProfit: tpPct, stopLoss: slPct, reason: `${technicalSignal.reason} | Bias: ${bias.direction} (${bias.votes} votes)` };
          }
        }
      }

      // Throttle: aynı sembolde çok sık sinyal verme
      if (bestSignal) {
        const last = this.lastSignalAt.get(symbol) || 0;
        if (Date.now() - last < this.minSignalIntervalMs) {
          try { this.counters.signalsThrottled++; } catch {}
          return null;
        }
      }

      // Preset güven eşiğini sağlamayan sinyalleri eler
      if (bestSignal && bestSignal.confidence < minConf) {
        try { this.counters.signalsFilteredEdge++; } catch {}
        return null;
      }

      if (bestSignal) {
        this.lastSignalAt.set(symbol, Date.now());
        try { this.counters.signalsGenerated++; } catch {}
      }
      return bestSignal;

    } catch (error) {
      logger.error(`❌ Sinyal oluşturma hatası:`, error);
      return null;
    }
  }

  private computeDirectionalBias(analysis: GuaranteedAnalysis): { direction: 'LONG' | 'SHORT' | 'NEUTRAL'; votes: number; reason: string } {
    try {
      let longVotes = 0;
      let shortVotes = 0;
      const reasons: string[] = [];

      // On-chain: whale & exchange flows
      const wm = analysis.onChainMetrics?.whaleMovements ?? 0;
      const xf = analysis.onChainMetrics?.exchangeFlows ?? 0;
      if (wm > 0 && xf > 0) { longVotes++; reasons.push('on-chain: inflow/whales'); }
      if (wm < 0 && xf < 0) { shortVotes++; reasons.push('on-chain: outflow/whales'); }

      // News/Sentiment
      const ns = analysis.offChainMetrics?.newsSentiment ?? 0;
      if (ns >= 50) { longVotes++; reasons.push('news: positive'); }
      if (ns <= -50) { shortVotes++; reasons.push('news: negative'); }

      // Order book imbalance
      const obBias = analysis.technicalIndicators?.orderBookImbalance?.bias;
      if (obBias === 'BULLISH') { longVotes++; reasons.push('orderbook: bullish'); }
      if (obBias === 'BEARISH') { shortVotes++; reasons.push('orderbook: bearish'); }

      // Decide
      if (longVotes > shortVotes) return { direction: 'LONG', votes: longVotes, reason: reasons.join(', ') };
      if (shortVotes > longVotes) return { direction: 'SHORT', votes: shortVotes, reason: reasons.join(', ') };
      return { direction: 'NEUTRAL', votes: 0, reason: 'no consensus' };
    } catch {
      return { direction: 'NEUTRAL', votes: 0, reason: 'error' };
    }
  }

  private generateTechnicalSignal(technicalIndicators: TechnicalIndicators, fundamentalMetrics: FundamentalMetrics): GuaranteedSignal | null {
    // Gelişmiş teknik analiz sinyali
    const { rsi, macd, bollingerBands, stochastic, williamsR, cci, adx, obv, vwap, ichimoku } = technicalIndicators;
    
    // Çoklu indikatör doğrulaması
    let buySignals = 0;
    let sellSignals = 0;
    let totalSignals = 0;

    // RSI analizi
    if (rsi < 30) buySignals++;
    else if (rsi > 70) sellSignals++;
    totalSignals++;

    // MACD analizi
    if (macd.macd > macd.signal && macd.histogram > 0) buySignals++;
    else if (macd.macd < macd.signal && macd.histogram < 0) sellSignals++;
    totalSignals++;

    // Bollinger Bands analizi
    // ... diğer indikatörler

    const confidence = (Math.max(buySignals, sellSignals) / totalSignals) * 100;
    
    if (confidence >= this.preset.minConfidence) {
      return {
        symbol: 'BTC', // Dinamik olarak değiştirilecek
        action: buySignals > sellSignals ? 'LONG' : 'SHORT',
        confidence,
        expectedProfit: this.preset.takeProfitPct, // beklenen kazanç %0.6
        riskLevel: 'LOW',
        timeframe: '4H',
        reason: `Çoklu indikatör doğrulaması: ${confidence}% güven`,
        stopLoss: this.preset.stopLossPct, // %0.3 SL
        takeProfit: this.preset.takeProfitPct // %0.6 TP
      };
    }

    return null;
  }

  private async calculateRiskScore(metrics: any): Promise<number> {
    // Risk skoru hesaplama algoritması
    let riskScore = 0;
    
    // On-chain risk faktörleri
    if (metrics.onChainMetrics.whaleMovements > 1000000) riskScore += 10;
    if (metrics.onChainMetrics.exchangeFlows < -500000) riskScore += 15;
    
    // Off-chain risk faktörleri
    if (metrics.offChainMetrics.socialSentiment < -0.5) riskScore += 10;
    if (metrics.offChainMetrics.regulatoryNews < -0.3) riskScore += 20;
    
    return Math.min(riskScore, 100);
  }

  private async calculateProfitProbability(opportunities: any): Promise<number> {
    // Kazanç olasılığı hesaplama
    let totalProbability = 0;
    let count = 0;
    
    // Arbitraj olasılığı
    if (opportunities.arbitrageOpportunities.length > 0) {
      totalProbability += 95;
      count++;
    }
    
    // MEV olasılığı
    if (opportunities.mevOpportunities.length > 0) {
      totalProbability += 98;
      count++;
    }
    
    // Flash Loan olasılığı
    if (opportunities.flashLoanOpportunities.length > 0) {
      totalProbability += 97;
      count++;
    }
    
    return count > 0 ? totalProbability / count : 0;
  }

  async notifySignal(signal: GuaranteedSignal): Promise<void> {
    try {
      logger.info(`🚨 GARANTİ KAZANÇ SİNYALİ: ${signal.symbol} ${signal.action}`);
      logger.info(`💰 Beklenen Kazanç: %${signal.expectedProfit}`);
      logger.info(`🎯 Güven: %${signal.confidence}`);
      logger.info(`⚠️ Risk: ${signal.riskLevel}`);
      logger.info(`📝 Sebep: ${signal.reason}`);

      // WebSocket ile frontend'e gönder
      // Email/SMS bildirimi
      // Telegram bot bildirimi
      
    } catch (error) {
      logger.error('❌ Sinyal bildirimi hatası:', error);
    }
  }

  async getActiveSignals(): Promise<GuaranteedSignal[]> {
    return Array.from(this.activeSignals.values());
  }

  async getSignalForSymbol(symbol: string): Promise<GuaranteedSignal | null> {
    return this.activeSignals.get(symbol) || null;
  }
}

// Singleton instance
export const guaranteedProfitEngine = new GuaranteedProfitEngine();
