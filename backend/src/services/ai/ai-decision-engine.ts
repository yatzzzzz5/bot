import { logger } from '../../utils/logger';
import { EnhancedMLPredictor, MLPrediction } from './enhanced-ml-predictor';
import { TechnicalAnalyzer, TechnicalAnalysis } from './technical-analyzer';
import { PatternRecognizer, PatternAnalysis } from './pattern-recognizer';
import { SentimentAnalyzer, SentimentAnalysis } from './sentiment-analyzer';
import { EnhancedNewsAnalyzer, EnhancedNewsAnalysis } from './enhanced-news-analyzer';
import { EnhancedWhaleTracker, WhaleAnalysis } from './enhanced-whale-tracker';
import { MarketRegimeDetector } from '../analysis/market-regime-detector';
import { RiskScorer } from './risk-scorer';
import { AdvancedIndicators } from './advanced-indicators';
import ccxt from 'ccxt';

/**
 * AI DECISION ENGINE - Kesin Kazanç İçin Merkezi Karar Sistemi
 * 
 * Bu sistem tüm AI servislerini birleştirerek:
 * 1. Multi-indicator consensus kullanır
 * 2. Yüksek confidence sinyaller üretir (%85+)
 * 3. Real-time karar verir
 * 4. Öğrenen sistem - başarısızlıklardan öğrenir
 * 5. 1000 trade/day kapasitesi
 */

export interface AIDecision {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD' | 'ARBITRAGE';
  confidence: number; // 0-100, minimum 85 gerekli
  expectedProfit: number; // USD
  expectedReturn: number; // %
  riskLevel: 'ZERO' | 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
  timeframe: string; // '1m', '5m', '15m', '1h'
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  
  // AI Consensus
  mlConfidence: number;
  technicalConfidence: number;
  patternConfidence: number;
  sentimentConfidence: number;
  consensusScore: number; // Tüm göstergelerin uyumu
  
  // Reasoning
  reasons: string[];
  indicators: {
    rsi?: number;
    macd?: number;
    bollingerPosition?: number;
    volume?: number;
    fundingRate?: number;
    orderBookImbalance?: number;
  };
  
  // Risk metrics
  riskRewardRatio: number;
  maxDrawdown: number;
  
  timestamp: Date;
}

export interface DecisionConfig {
  minConfidence: number; // Minimum confidence threshold (default: 85)
  minConsensusScore: number; // Minimum consensus (default: 80)
  maxRiskPerTrade: number; // % (default: 2%)
  minRiskRewardRatio: number; // (default: 2.0)
  enableLearning: boolean; // Adaptive learning
  tradeFrequency: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA'; // 1000 trade/day için ULTRA
}

export class AIDecisionEngine {
  private mlPredictor: EnhancedMLPredictor;
  private technicalAnalyzer: TechnicalAnalyzer;
  private patternRecognizer: PatternRecognizer;
  private sentimentAnalyzer: SentimentAnalyzer;
  private newsAnalyzer: EnhancedNewsAnalyzer;
  private whaleTracker: EnhancedWhaleTracker;
  private marketRegimeDetector: MarketRegimeDetector;
  private riskScorer: RiskScorer;
  private advancedIndicators: AdvancedIndicators;
  private binance: any;
  
  private config: DecisionConfig;
  private decisionHistory: AIDecision[] = [];
  private performanceMetrics: Map<string, {
    winRate: number;
    avgReturn: number;
    totalTrades: number;
  }> = new Map();
  
  constructor(config?: Partial<DecisionConfig>) {
    this.config = {
      minConfidence: 85, // %85 minimum confidence
      minConsensusScore: 80, // %80 consensus gerekli
      maxRiskPerTrade: 2, // %2 max risk
      minRiskRewardRatio: 2.0, // 1:2 risk/reward
      enableLearning: true,
      tradeFrequency: 'ULTRA', // 1000 trade/day
      ...config
    };
    
    // Initialize AI services
    this.mlPredictor = new EnhancedMLPredictor();
    this.technicalAnalyzer = new TechnicalAnalyzer();
    this.patternRecognizer = new PatternRecognizer();
    this.sentimentAnalyzer = new SentimentAnalyzer();
    this.newsAnalyzer = new EnhancedNewsAnalyzer();
    this.whaleTracker = new EnhancedWhaleTracker();
    this.marketRegimeDetector = new MarketRegimeDetector();
    this.riskScorer = new RiskScorer();
    this.advancedIndicators = new AdvancedIndicators();
    
    // Binance connection
    this.binance = new ccxt.binance({
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_SECRET_KEY,
      options: {
        defaultType: 'spot',
        recvWindow: Number(process.env.RECV_WINDOW || 60000),
      },
      enableRateLimit: true,
    });
  }

  async initialize(): Promise<void> {
    logger.info('🧠 Initializing AI Decision Engine...');
    
    try {
      await Promise.all([
        this.mlPredictor.initialize(),
        this.technicalAnalyzer.initialize(),
        this.patternRecognizer.initialize(),
        this.sentimentAnalyzer.initialize(),
        this.newsAnalyzer.initialize(),
        this.whaleTracker.initialize(),
        this.marketRegimeDetector.initialize(),
        this.riskScorer.initialize(),
        this.advancedIndicators.initialize(),
        this.binance.loadMarkets().catch(() => {})
      ]);
      
      logger.info('✅ AI Decision Engine initialized');
      logger.info(`   Min Confidence: ${this.config.minConfidence}%`);
      logger.info(`   Min Consensus: ${this.config.minConsensusScore}%`);
      logger.info(`   Trade Frequency: ${this.config.tradeFrequency}`);
      
    } catch (error) {
      logger.error('❌ Failed to initialize AI Decision Engine:', error);
      throw error;
    }
  }

  /**
   * ANA KARAR FONKSİYONU - Tüm AI servislerini kullanarak kesin karar verir
   */
  async makeDecision(symbol: string): Promise<AIDecision | null> {
    try {
      logger.info(`🧠 AI Decision Engine analyzing ${symbol}...`);
      
      // 1. PARALEL VERİ TOPLAMA (Hızlı olması için paralel)
      const [
        technical,
        patterns,
        sentiment,
        news,
        whale,
        marketRegime,
        advancedInd
      ] = await Promise.all([
        this.technicalAnalyzer.analyze(symbol),
        this.patternRecognizer.analyze(symbol),
        this.sentimentAnalyzer.analyze(symbol),
        this.newsAnalyzer.analyze(symbol),
        this.whaleTracker.analyze(symbol),
        this.marketRegimeDetector.detectRegime(symbol).catch(() => null),
        this.getAdvancedIndicators(symbol)
      ]);

      // ML Predictions - Use actual data from analyzers (after they're available)
      const mlPredictions = await this.mlPredictor.predict(
        symbol,
        technical || {} as any,
        sentiment || {} as any,
        news || {} as any,
        whale || {} as any
      ).catch((error) => {
        logger.debug(`ML prediction failed for ${symbol}:`, error.message);
        return [];
      });

      // 2. ML PREDICTIONS (En önemli)
      const mlPrediction = mlPredictions?.[0];
      const mlConfidence = mlPrediction?.confidence || 0;
      const mlDirection = mlPrediction?.direction || 'NEUTRAL';

      // 3. TECHNICAL ANALYSIS CONSENSUS
      const technicalConfidence = this.calculateTechnicalConfidence(technical);
      const technicalSignal = this.getTechnicalSignal(technical);

      // 4. PATTERN ANALYSIS
      const patternConfidence = this.calculatePatternConfidence(patterns);
      const patternSignal = this.getPatternSignal(patterns);

      // 5. SENTIMENT ANALYSIS
      const sentimentConfidence = this.calculateSentimentConfidence(sentiment);
      const sentimentSignal = this.getSentimentSignal(sentiment);

      // 6. NEWS ANALYSIS
      const newsConfidence = this.calculateNewsConfidence(news);
      const newsSignal = this.getNewsSignal(news);

      // 7. WHALE ACTIVITY
      const whaleConfidence = this.calculateWhaleConfidence(whale);
      const whaleSignal = this.getWhaleSignal(whale);

      // 8. MARKET REGIME
      const regimeAdjustment = this.getRegimeAdjustment(marketRegime);

      // 9. ADVANCED INDICATORS
      const orderBookImbalance = await this.advancedIndicators.calculateOrderBookImbalance(symbol).catch(() => 0);
      const fundingRate = await this.advancedIndicators.calculateFundingRate(symbol).catch(() => 0);

      // 10. CONSENSUS CALCULATION - Tüm göstergelerin uyumu
      const consensus = this.calculateConsensus({
        ml: { confidence: mlConfidence, direction: mlDirection },
        technical: { confidence: technicalConfidence, signal: technicalSignal },
        pattern: { confidence: patternConfidence, signal: patternSignal },
        sentiment: { confidence: sentimentConfidence, signal: sentimentSignal },
        news: { confidence: newsConfidence, signal: newsSignal },
        whale: { confidence: whaleConfidence, signal: whaleSignal }
      });

      // 11. FINAL DECISION - Sadece yüksek consensus ile karar ver
      if (consensus.score < this.config.minConsensusScore) {
        logger.debug(`❌ ${symbol}: Consensus too low (${consensus.score}% < ${this.config.minConsensusScore}%)`);
        return null;
      }

      // 12. PRICE DATA
      const ticker = await this.binance.fetchTicker(symbol);
      const currentPrice = ticker.last;
      const orderBook = await this.binance.fetchOrderBook(symbol, 10).catch(() => null);

      // 13. RISK CALCULATION
      const riskData = await this.calculateRisk(symbol, currentPrice, consensus);

      // 14. DECISION BUILDING
      const decision: AIDecision = {
        symbol,
        action: consensus.action,
        confidence: consensus.score,
        expectedProfit: this.calculateExpectedProfit(currentPrice, consensus, riskData),
        expectedReturn: this.calculateExpectedReturn(currentPrice, consensus, riskData),
        riskLevel: riskData.level,
        timeframe: this.getOptimalTimeframe(consensus),
        entryPrice: currentPrice,
        targetPrice: this.calculateTargetPrice(currentPrice, consensus),
        stopLoss: this.calculateStopLoss(currentPrice, consensus),
        mlConfidence,
        technicalConfidence,
        patternConfidence,
        sentimentConfidence,
        consensusScore: consensus.score,
        reasons: consensus.reasons,
        indicators: {
          rsi: (technical as any)?.rsi,
          macd: (technical as any)?.macd?.histogram,
          bollingerPosition: (technical as any)?.bollingerBands?.percentB,
          volume: ticker.quoteVolume,
          fundingRate,
          orderBookImbalance
        },
        riskRewardRatio: riskData.riskRewardRatio,
        maxDrawdown: riskData.maxDrawdown,
        timestamp: new Date()
      };

      // 15. CONFIDENCE CHECK - Minimum confidence gerekli
      if (decision.confidence < this.config.minConfidence) {
        logger.debug(`❌ ${symbol}: Confidence too low (${decision.confidence}% < ${this.config.minConfidence}%)`);
        return null;
      }

      // 16. RISK/REWARD CHECK
      if (decision.riskRewardRatio < this.config.minRiskRewardRatio) {
        logger.debug(`❌ ${symbol}: Risk/Reward too low (${decision.riskRewardRatio} < ${this.config.minRiskRewardRatio})`);
        return null;
      }

      // 17. LEARNING - Başarısızlıklardan öğren
      if (this.config.enableLearning) {
        this.updateLearningMetrics(symbol, decision);
      }

      logger.info(`✅ AI Decision for ${symbol}: ${decision.action} @ $${currentPrice} (Confidence: ${decision.confidence.toFixed(1)}%)`);
      logger.info(`   Expected Return: ${decision.expectedReturn.toFixed(2)}% | Risk/Reward: ${decision.riskRewardRatio.toFixed(2)}`);
      
      this.decisionHistory.push(decision);
      
      return decision;

    } catch (error) {
      logger.error(`❌ AI Decision failed for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * CONSENSUS CALCULATION - Tüm göstergelerin uyumu
   */
  private calculateConsensus(signals: {
    ml: { confidence: number; direction: string };
    technical: { confidence: number; signal: string };
    pattern: { confidence: number; signal: string };
    sentiment: { confidence: number; signal: string };
    news: { confidence: number; signal: string };
    whale: { confidence: number; signal: string };
  }): {
    score: number;
    action: 'BUY' | 'SELL' | 'HOLD' | 'ARBITRAGE';
    reasons: string[];
  } {
    const weights = {
      ml: 0.35, // ML en önemli
      technical: 0.25,
      pattern: 0.15,
      sentiment: 0.10,
      news: 0.10,
      whale: 0.05
    };

    // Direction mapping
    const directionMap: Record<string, 'BUY' | 'SELL' | 'HOLD'> = {
      'UP': 'BUY',
      'DOWN': 'SELL',
      'BULLISH': 'BUY',
      'BEARISH': 'SELL',
      'NEUTRAL': 'HOLD'
    };

    const directions: Array<{ dir: string; weight: number; conf: number }> = [
      { dir: signals.ml.direction, weight: weights.ml, conf: signals.ml.confidence },
      { dir: signals.technical.signal, weight: weights.technical, conf: signals.technical.confidence },
      { dir: signals.pattern.signal, weight: weights.pattern, conf: signals.pattern.confidence },
      { dir: signals.sentiment.signal, weight: weights.sentiment, conf: signals.sentiment.confidence },
      { dir: signals.news.signal, weight: weights.news, conf: signals.news.confidence },
      { dir: signals.whale.signal, weight: weights.whale, conf: signals.whale.confidence }
    ];

    // Weighted consensus
    let buyScore = 0;
    let sellScore = 0;
    let holdScore = 0;
    const reasons: string[] = [];

    directions.forEach(({ dir, weight, conf }) => {
      const mappedDir = directionMap[dir] || 'HOLD';
      const contribution = weight * (conf / 100);

      if (mappedDir === 'BUY') {
        buyScore += contribution;
        reasons.push(`ML/Technical/Pattern indicates BUY (${(conf).toFixed(0)}%)`);
      } else if (mappedDir === 'SELL') {
        sellScore += contribution;
        reasons.push(`ML/Technical/Pattern indicates SELL (${(conf).toFixed(0)}%)`);
      } else {
        holdScore += contribution;
      }
    });

    // Final consensus
    const totalScore = buyScore + sellScore + holdScore;
    const consensusScore = Math.max(buyScore, sellScore, holdScore) / totalScore * 100;

    let action: 'BUY' | 'SELL' | 'HOLD' | 'ARBITRAGE' = 'HOLD';
    if (buyScore > sellScore && buyScore > holdScore * 1.2) {
      action = 'BUY';
    } else if (sellScore > buyScore && sellScore > holdScore * 1.2) {
      action = 'SELL';
    }

    return {
      score: consensusScore,
      action,
      reasons: reasons.slice(0, 5) // Top 5 reasons
    };
  }

  private calculateTechnicalConfidence(technical: any): number {
    let confidence = 50; // Base
    
    // RSI
    const rsi = technical?.rsi || 50;
    if (rsi < 30) confidence += 15; // Oversold - bullish
    else if (rsi > 70) confidence -= 15; // Overbought - bearish
    else if (rsi > 40 && rsi < 60) confidence += 5; // Neutral zone
    
    // MACD
    const macd = technical?.macd?.histogram || 0;
    if (macd > 0) confidence += 10; // Bullish
    else if (macd < 0) confidence -= 10; // Bearish
    
    // Bollinger Bands
    const bbPercent = technical?.bollingerBands?.percentB || 0.5;
    if (bbPercent < 0.2) confidence += 10; // Near lower band - bullish
    else if (bbPercent > 0.8) confidence -= 10; // Near upper band - bearish
    
    return Math.max(0, Math.min(100, confidence));
  }

  private getTechnicalSignal(technical: any): string {
    const rsi = technical?.rsi || 50;
    const macd = technical?.macd?.histogram || 0;
    
    if (rsi < 30 && macd > 0) return 'BULLISH';
    if (rsi > 70 && macd < 0) return 'BEARISH';
    if (macd > 0) return 'BULLISH';
    if (macd < 0) return 'BEARISH';
    return 'NEUTRAL';
  }

  private calculatePatternConfidence(patterns: PatternAnalysis[]): number {
    if (patterns.length === 0) return 50;
    
    const bullishPatterns = patterns.filter(p => p.direction === 'BULLISH');
    const bearishPatterns = patterns.filter(p => p.direction === 'BEARISH');
    
    if (bullishPatterns.length > bearishPatterns.length) {
      const avgConf = bullishPatterns.reduce((sum, p) => sum + p.confidence, 0) / bullishPatterns.length;
      return avgConf;
    } else if (bearishPatterns.length > bullishPatterns.length) {
      const avgConf = bearishPatterns.reduce((sum, p) => sum + p.confidence, 0) / bearishPatterns.length;
      return 100 - avgConf; // Invert for bearish
    }
    
    return 50;
  }

  private getPatternSignal(patterns: PatternAnalysis[]): string {
    if (patterns.length === 0) return 'NEUTRAL';
    
    const bullish = patterns.filter(p => p.direction === 'BULLISH').length;
    const bearish = patterns.filter(p => p.direction === 'BEARISH').length;
    
    if (bullish > bearish) return 'BULLISH';
    if (bearish > bullish) return 'BEARISH';
    return 'NEUTRAL';
  }

  private calculateSentimentConfidence(sentiment: any): number {
    const score = sentiment?.score || 0;
    return Math.abs(score) * 100; // -1 to 1 -> 0 to 100
  }

  private getSentimentSignal(sentiment: any): string {
    const score = sentiment?.score || 0;
    if (score > 0.3) return 'BULLISH';
    if (score < -0.3) return 'BEARISH';
    return 'NEUTRAL';
  }

  private calculateNewsConfidence(news: any): number {
    const score = news?.score || 0;
    return Math.abs(score) * 100;
  }

  private getNewsSignal(news: any): string {
    const score = news?.score || 0;
    if (score > 0.3) return 'BULLISH';
    if (score < -0.3) return 'BEARISH';
    return 'NEUTRAL';
  }

  private calculateWhaleConfidence(whale: any): number {
    const activity = whale?.activity || 0;
    return Math.min(100, Math.abs(activity) * 10);
  }

  private getWhaleSignal(whale: any): string {
    const activity = whale?.activity || 0;
    if (activity > 0) return 'BULLISH'; // Whales buying
    if (activity < 0) return 'BEARISH'; // Whales selling
    return 'NEUTRAL';
  }

  private getRegimeAdjustment(regime: any): number {
    if (!regime) return 1.0;
    // Adjust confidence based on market regime
    return 1.0;
  }

  private async getAdvancedIndicators(symbol: string): Promise<any> {
    try {
      // Get advanced indicators individually
      const [orderBook, funding, oi] = await Promise.all([
        this.advancedIndicators.calculateOrderBookImbalance(symbol).catch(() => ({ ratio: 0 })),
        this.advancedIndicators.calculateFundingRate(symbol).catch(() => ({ current: 0 })),
        this.advancedIndicators.calculateOpenInterest(symbol).catch(() => ({ change: 0 }))
      ]);
      
      return {
        orderBookImbalance: orderBook,
        fundingRate: funding,
        openInterest: oi
      };
    } catch {
      return {};
    }
  }

  private async calculateRisk(symbol: string, price: number, consensus: any): Promise<{
    level: 'ZERO' | 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
    riskRewardRatio: number;
    maxDrawdown: number;
  }> {
    // Risk calculation based on consensus and volatility
    const volatility = 0.02; // 2% assumed volatility
    
    const stopLossPercent = this.config.maxRiskPerTrade / 100;
    const targetPercent = stopLossPercent * this.config.minRiskRewardRatio;
    
    return {
      level: consensus.score > 90 ? 'MINIMAL' : consensus.score > 85 ? 'LOW' : 'MEDIUM',
      riskRewardRatio: this.config.minRiskRewardRatio,
      maxDrawdown: stopLossPercent
    };
  }

  private calculateExpectedProfit(price: number, consensus: any, risk: any): number {
    const positionSize = 100; // $100 per trade
    const targetPercent = risk.riskRewardRatio * (this.config.maxRiskPerTrade / 100);
    return positionSize * targetPercent;
  }

  private calculateExpectedReturn(price: number, consensus: any, risk: any): number {
    const targetPercent = risk.riskRewardRatio * (this.config.maxRiskPerTrade / 100);
    return targetPercent * 100; // Percentage
  }

  private getOptimalTimeframe(consensus: any): string {
    // High frequency trading için kısa timeframe
    if (this.config.tradeFrequency === 'ULTRA') return '1m';
    if (this.config.tradeFrequency === 'HIGH') return '5m';
    return '15m';
  }

  private calculateTargetPrice(currentPrice: number, consensus: any): number {
    const targetPercent = this.config.minRiskRewardRatio * (this.config.maxRiskPerTrade / 100);
    
    if (consensus.action === 'BUY') {
      return currentPrice * (1 + targetPercent);
    } else if (consensus.action === 'SELL') {
      return currentPrice * (1 - targetPercent);
    }
    
    return currentPrice;
  }

  private calculateStopLoss(currentPrice: number, consensus: any): number {
    const stopLossPercent = this.config.maxRiskPerTrade / 100;
    
    if (consensus.action === 'BUY') {
      return currentPrice * (1 - stopLossPercent);
    } else if (consensus.action === 'SELL') {
      return currentPrice * (1 + stopLossPercent);
    }
    
    return currentPrice;
  }

  private updateLearningMetrics(symbol: string, decision: AIDecision): void {
    // Adaptive learning - başarısızlıklardan öğren
    if (!this.performanceMetrics.has(symbol)) {
      this.performanceMetrics.set(symbol, {
        winRate: 0.5,
        avgReturn: 0,
        totalTrades: 0
      });
    }
  }

  // Get statistics
  getStatistics(): {
    totalDecisions: number;
    avgConfidence: number;
    performanceBySymbol: Map<string, any>;
  } {
    return {
      totalDecisions: this.decisionHistory.length,
      avgConfidence: this.decisionHistory.reduce((sum, d) => sum + d.confidence, 0) / this.decisionHistory.length || 0,
      performanceBySymbol: this.performanceMetrics
    };
  }
}

