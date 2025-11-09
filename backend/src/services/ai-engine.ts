import { logger } from '../utils/logger';
import { SentimentAnalyzer } from './ai/sentiment-analyzer';
import { TechnicalAnalyzer } from './ai/technical-analyzer';
import { PatternRecognizer } from './ai/pattern-recognizer';
import { RiskScorer } from './ai/risk-scorer';
import { NewsAnalyzer } from './ai/news-analyzer';
import { WhaleTracker } from './ai/whale-tracker';
import { MarketPredictor } from './ai/market-predictor';

// Enhanced AI Services
import { EnhancedNewsAnalyzer } from './ai/enhanced-news-analyzer';
import { EnhancedWhaleTracker } from './ai/enhanced-whale-tracker';
import { EnhancedMLPredictor } from './ai/enhanced-ml-predictor';
import { PortfolioOptimizer } from './ai/portfolio-optimizer';

export class AIEngine {
  private sentimentAnalyzer: SentimentAnalyzer;
  private technicalAnalyzer: TechnicalAnalyzer;
  private patternRecognizer: PatternRecognizer;
  private riskScorer: RiskScorer;
  private newsAnalyzer: NewsAnalyzer;
  private whaleTracker: WhaleTracker;
  private marketPredictor: MarketPredictor;
  private portfolioOptimizer: PortfolioOptimizer;

  // Enhanced AI Services
  private enhancedNewsAnalyzer: EnhancedNewsAnalyzer;
  private enhancedWhaleTracker: EnhancedWhaleTracker;
  private enhancedMLPredictor: EnhancedMLPredictor;

  constructor() {
    this.sentimentAnalyzer = new SentimentAnalyzer();
    this.technicalAnalyzer = new TechnicalAnalyzer();
    this.patternRecognizer = new PatternRecognizer();
    this.riskScorer = new RiskScorer();
    this.newsAnalyzer = new NewsAnalyzer();
    this.whaleTracker = new WhaleTracker();
    this.marketPredictor = new MarketPredictor();
    this.portfolioOptimizer = new PortfolioOptimizer();

    // Initialize Enhanced AI Services
    this.enhancedNewsAnalyzer = new EnhancedNewsAnalyzer();
    this.enhancedWhaleTracker = new EnhancedWhaleTracker();
    this.enhancedMLPredictor = new EnhancedMLPredictor();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🧠 Initializing AI Engine...');
      
      // Initialize all AI modules
      await Promise.all([
        this.sentimentAnalyzer.initialize(),
        this.technicalAnalyzer.initialize(),
        this.patternRecognizer.initialize(),
        this.riskScorer.initialize(),
        this.newsAnalyzer.initialize(),
        this.whaleTracker.initialize(),
        this.marketPredictor.initialize(),
        this.portfolioOptimizer.initialize()
      ]);

      // Initialize Enhanced AI Services
      logger.info('🚀 Initializing Enhanced AI Services...');
      await Promise.all([
        this.enhancedNewsAnalyzer.initialize(),
        this.enhancedWhaleTracker.initialize(),
        this.enhancedMLPredictor.initialize()
      ]);
      
      logger.info('✅ Enhanced AI Engine initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize AI Engine:', error);
      throw error;
    }
  }

  async analyzeMarket(symbol: string): Promise<MarketAnalysis> {
    try {
      logger.info(`🔍 Analyzing market for ${symbol}`);
      
      // Enhanced parallel analysis with new AI services
      const [
        sentiment,
        technical,
        patterns,
        news,
        whaleActivity,
        prediction,
        enhancedNews,
        enhancedWhale
      ] = await Promise.all([
        this.sentimentAnalyzer.analyze(symbol),
        this.technicalAnalyzer.analyze(symbol),
        this.patternRecognizer.analyze(symbol),
        this.newsAnalyzer.analyze(symbol),
        this.whaleTracker.analyze(symbol),
        this.marketPredictor.predict(symbol),
        this.enhancedNewsAnalyzer.analyze(symbol),
        this.enhancedWhaleTracker.analyze(symbol)
      ]);

      // Get ML predictions after we have the other data
      const mlPredictions = await this.enhancedMLPredictor.predict(symbol, technical as any, sentiment, enhancedNews, enhancedWhale);

      // Calculate risk score
      const riskScore = await this.riskScorer.calculate({
        symbol,
        sentiment,
        technical,
        patterns
      });

      // Generate trading signals
      const signals = this.generateSignals({
        sentiment,
        technical,
        patterns,
        prediction,
        riskScore
      });

      // Portfolio optimization
      const portfolioRecommendation = await this.portfolioOptimizer.optimize({
        symbol,
        currentPosition: 0, // Get from portfolio service
        signals,
        riskScore
      });

      const analysis: MarketAnalysis = {
        symbol,
        timestamp: new Date(),
        sentiment,
        technical,
        patterns,
        news,
        whaleActivity,
        prediction,
        riskScore,
        signals,
        portfolioRecommendation,
        confidence: this.calculateConfidence(sentiment, technical, patterns, prediction)
      };

      logger.info(`✅ Market analysis completed for ${symbol}`);
      return analysis;

    } catch (error) {
      logger.error(`❌ Failed to analyze market for ${symbol}:`, error);
      throw error;
    }
  }

  private generateSignals(data: SignalData): TradingSignal[] {
    const signals: TradingSignal[] = [];
    
    // Sentiment-based signals
    if (data.sentiment.score > 0.7) {
      signals.push({
        type: 'BUY',
        strength: 'STRONG',
        reason: 'Positive sentiment detected',
        confidence: data.sentiment.score,
        source: 'SENTIMENT'
      });
    } else if (data.sentiment.score < -0.7) {
      signals.push({
        type: 'SELL',
        strength: 'STRONG',
        reason: 'Negative sentiment detected',
        confidence: Math.abs(data.sentiment.score),
        source: 'SENTIMENT'
      });
    }

    // Technical analysis signals
    if (data.technical.rsi < 30) {
      signals.push({
        type: 'BUY',
        strength: 'MEDIUM',
        reason: 'Oversold condition (RSI < 30)',
        confidence: 0.8,
        source: 'TECHNICAL'
      });
    } else if (data.technical.rsi > 70) {
      signals.push({
        type: 'SELL',
        strength: 'MEDIUM',
        reason: 'Overbought condition (RSI > 70)',
        confidence: 0.8,
        source: 'TECHNICAL'
      });
    }

    // Pattern-based signals
    data.patterns.forEach(pattern => {
      if (pattern.confidence > 0.8) {
        signals.push({
          type: pattern.direction === 'BULLISH' ? 'BUY' : 'SELL',
          strength: 'STRONG',
          reason: `High-confidence ${pattern.name} pattern detected`,
          confidence: pattern.confidence,
          source: 'PATTERN'
        });
      }
    });

    // Prediction-based signals
    if (data.prediction.confidence > 0.7) {
      signals.push({
        type: data.prediction.direction === 'UP' ? 'BUY' : 'SELL',
        strength: 'STRONG',
        reason: `AI prediction: ${data.prediction.direction} with ${(data.prediction.confidence * 100).toFixed(1)}% confidence`,
        confidence: data.prediction.confidence,
        source: 'AI_PREDICTION'
      });
    }

    return signals;
  }

  private calculateConfidence(
    sentiment: SentimentAnalysis,
    technical: TechnicalAnalysis,
    patterns: PatternAnalysis[],
    prediction: MarketPrediction
  ): number {
    const weights = {
      sentiment: 0.2,
      technical: 0.3,
      patterns: 0.25,
      prediction: 0.25
    };

    const sentimentScore = Math.abs(sentiment.score);
    const technicalScore = technical.confidence;
    const patternsScore = patterns.length > 0 ? 
      patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length : 0;
    const predictionScore = prediction.confidence;

    return (
      sentimentScore * weights.sentiment +
      technicalScore * weights.technical +
      patternsScore * weights.patterns +
      predictionScore * weights.prediction
    );
  }

  async getPortfolioOptimization(portfolio: Portfolio): Promise<PortfolioOptimization> {
    return await this.portfolioOptimizer.optimizePortfolio(portfolio);
  }

  async getRiskAssessment(positions: Position[]): Promise<RiskAssessment> {
    return await this.riskScorer.assessPortfolio(positions);
  }

  // Generate trading signals with LONG/SHORT recommendations
  async generateTradingSignals(symbol: string): Promise<{
    type: 'LONG' | 'SHORT' | 'HOLD';
    strength: 'WEAK' | 'MEDIUM' | 'STRONG';
    confidence: number;
    reason: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    recommendedLeverage: number;
    riskScore: number;
  }> {
    try {
      logger.info(`🔍 Generating trading signals for ${symbol}...`);

      // Get market data
      const marketData = await this.getMarketData(symbol);
      
      // Technical analysis
      const technicalSignals = await this.performTechnicalAnalysis(marketData);
      
      // Sentiment analysis
      const sentimentScore = await this.analyzeSentiment(symbol);
      
      // Pattern recognition
      const patterns = await this.recognizePatterns(marketData);
      
      // Risk assessment
      const riskScore = this.calculateRiskScore(marketData, technicalSignals, sentimentScore);
      
      // Decision making algorithm
      const decision = this.makeTradingDecision(technicalSignals, sentimentScore, patterns, riskScore);
      
      // Calculate entry, stop loss, and take profit prices
      const currentPrice = marketData.currentPrice;
      const volatility = marketData.volatility;
      
      const entryPrice = currentPrice;
      const stopLoss = decision.type === 'LONG' 
        ? currentPrice * (1 - volatility * 2) // 2x volatility for stop loss
        : currentPrice * (1 + volatility * 2);
      
      const takeProfit = decision.type === 'LONG'
        ? currentPrice * (1 + volatility * 3) // 3x volatility for take profit
        : currentPrice * (1 - volatility * 3);
      
      // Recommend leverage based on risk
      const recommendedLeverage = this.recommendLeverage(riskScore, decision.confidence);
      
      logger.info(`✅ Generated ${decision.type} signal for ${symbol} with ${decision.confidence.toFixed(2)} confidence`);
      
      return {
        type: decision.type,
        strength: decision.strength,
        confidence: decision.confidence,
        reason: decision.reason,
        entryPrice,
        stopLoss,
        takeProfit,
        recommendedLeverage,
        riskScore
      };
      
    } catch (error) {
      logger.error(`❌ Failed to generate trading signals for ${symbol}:`, error);
      throw error;
    }
  }

  // Make trading decision based on all analysis
  private makeTradingDecision(
    technicalSignals: any,
    sentimentScore: number,
    patterns: any,
    riskScore: number
  ): {
    type: 'LONG' | 'SHORT' | 'HOLD';
    strength: 'WEAK' | 'MEDIUM' | 'STRONG';
    confidence: number;
    reason: string;
  } {
    // Calculate composite score
    let longScore = 0;
    let shortScore = 0;
    
    // Technical analysis contribution (40%)
    if (technicalSignals.rsi < 30) longScore += 0.4;
    if (technicalSignals.rsi > 70) shortScore += 0.4;
    if (technicalSignals.macd > 0) longScore += 0.2;
    if (technicalSignals.macd < 0) shortScore += 0.2;
    
    // Sentiment contribution (30%)
    if (sentimentScore > 0.6) longScore += 0.3;
    if (sentimentScore < 0.4) shortScore += 0.3;
    
    // Pattern contribution (20%)
    if (patterns.bullishPatterns > patterns.bearishPatterns) longScore += 0.2;
    if (patterns.bearishPatterns > patterns.bullishPatterns) shortScore += 0.2;
    
    // Risk adjustment (10%)
    const riskAdjustment = (1 - riskScore) * 0.1;
    longScore += riskAdjustment;
    shortScore += riskAdjustment;
    
    // Determine type and strength
    let type: 'LONG' | 'SHORT' | 'HOLD' = 'HOLD';
    let strength: 'WEAK' | 'MEDIUM' | 'STRONG' = 'WEAK';
    let confidence = 0;
    let reason = '';
    
    if (longScore > shortScore && longScore > 0.6) {
      type = 'LONG';
      confidence = longScore;
      reason = this.generateLongReason(technicalSignals, sentimentScore, patterns);
    } else if (shortScore > longScore && shortScore > 0.6) {
      type = 'SHORT';
      confidence = shortScore;
      reason = this.generateShortReason(technicalSignals, sentimentScore, patterns);
    } else {
      type = 'HOLD';
      confidence = Math.max(longScore, shortScore);
      reason = 'Mixed signals, waiting for clearer direction';
    }
    
    // Determine strength
    if (confidence > 0.8) strength = 'STRONG';
    else if (confidence > 0.6) strength = 'MEDIUM';
    else strength = 'WEAK';
    
    return { type, strength, confidence, reason };
  }

  // Generate reason for LONG signal
  private generateLongReason(technicalSignals: any, sentimentScore: number, patterns: any): string {
    const reasons = [];
    
    if (technicalSignals.rsi < 30) reasons.push('RSI oversold');
    if (technicalSignals.macd > 0) reasons.push('MACD bullish crossover');
    if (sentimentScore > 0.6) reasons.push('Positive market sentiment');
    if (patterns.bullishPatterns > 0) reasons.push('Bullish pattern detected');
    
    return reasons.length > 0 ? `Strong bullish signals: ${reasons.join(', ')}` : 'Technical indicators suggest upward movement';
  }

  // Generate reason for SHORT signal
  private generateShortReason(technicalSignals: any, sentimentScore: number, patterns: any): string {
    const reasons = [];
    
    if (technicalSignals.rsi > 70) reasons.push('RSI overbought');
    if (technicalSignals.macd < 0) reasons.push('MACD bearish crossover');
    if (sentimentScore < 0.4) reasons.push('Negative market sentiment');
    if (patterns.bearishPatterns > 0) reasons.push('Bearish pattern detected');
    
    return reasons.length > 0 ? `Strong bearish signals: ${reasons.join(', ')}` : 'Technical indicators suggest downward movement';
  }

  // Recommend leverage based on risk and confidence
  private recommendLeverage(riskScore: number, confidence: number): number {
    // Higher confidence and lower risk = higher leverage
    const leverageScore = confidence * (1 - riskScore);
    
    if (leverageScore > 0.8) return 50;      // Very confident, low risk
    if (leverageScore > 0.6) return 20;      // Confident, moderate risk
    if (leverageScore > 0.4) return 10;      // Moderate confidence, moderate risk
    if (leverageScore > 0.2) return 5;       // Low confidence, moderate risk
    return 2;                                // Very low confidence or high risk
  }

  // Get market data for analysis
  private async getMarketData(symbol: string): Promise<{
    currentPrice: number;
    volatility: number;
    volume: number;
    priceHistory: number[];
  }> {
    // Mock market data - replace with real exchange API
    const basePrice = symbol === 'BTC' ? 45000 : symbol === 'ETH' ? 2500 : 100;
    const volatility = 0.02; // 2% volatility
    
    return {
      currentPrice: basePrice * (1 + (Math.random() - 0.5) * 0.1),
      volatility,
      volume: Math.random() * 1000000,
      priceHistory: Array.from({ length: 100 }, () => basePrice * (1 + (Math.random() - 0.5) * 0.1))
    };
  }

  // Perform technical analysis
  private async performTechnicalAnalysis(marketData: any): Promise<{
    rsi: number;
    macd: number;
    sma: number;
    ema: number;
  }> {
    // Mock technical analysis - replace with real calculations
    return {
      rsi: 30 + Math.random() * 40, // RSI between 30-70
      macd: (Math.random() - 0.5) * 100, // MACD between -50 to 50
      sma: marketData.currentPrice * (1 + (Math.random() - 0.5) * 0.05),
      ema: marketData.currentPrice * (1 + (Math.random() - 0.5) * 0.05)
    };
  }

  // Analyze market sentiment
  private async analyzeSentiment(symbol: string): Promise<number> {
    // Mock sentiment analysis - replace with real news/social media analysis
    return 0.3 + Math.random() * 0.4; // Sentiment between 0.3-0.7
  }

  // Recognize chart patterns
  private async recognizePatterns(marketData: any): Promise<{
    bullishPatterns: number;
    bearishPatterns: number;
    neutralPatterns: number;
  }> {
    // Mock pattern recognition - replace with real pattern analysis
    return {
      bullishPatterns: Math.floor(Math.random() * 3),
      bearishPatterns: Math.floor(Math.random() * 3),
      neutralPatterns: Math.floor(Math.random() * 2)
    };
  }

  // Calculate risk score
  private calculateRiskScore(marketData: any, technicalSignals: any, sentimentScore: number): number {
    // Mock risk calculation - replace with real risk assessment
    const volatilityRisk = marketData.volatility * 10; // 0.2
    const technicalRisk = Math.abs(technicalSignals.rsi - 50) / 50; // 0.4
    const sentimentRisk = Math.abs(sentimentScore - 0.5) * 2; // 0.4
    
    return (volatilityRisk + technicalRisk + sentimentRisk) / 3;
  }
}

// Types
export interface MarketAnalysis {
  symbol: string;
  timestamp: Date;
  sentiment: SentimentAnalysis;
  technical: TechnicalAnalysis;
  patterns: PatternAnalysis[];
  news: NewsAnalysis;
  whaleActivity: WhaleAnalysis;
  prediction: MarketPrediction;
  riskScore: number;
  signals: TradingSignal[];
  portfolioRecommendation: PortfolioRecommendation;
  confidence: number;
}

export interface TradingSignal {
  type: 'BUY' | 'SELL' | 'HOLD';
  strength: 'WEAK' | 'MEDIUM' | 'STRONG';
  reason: string;
  confidence: number;
  source: string;
}

export interface SignalData {
  sentiment: SentimentAnalysis;
  technical: TechnicalAnalysis;
  patterns: PatternAnalysis[];
  prediction: MarketPrediction;
  riskScore: number;
}

export interface Portfolio {
  id: string;
  userId: string;
  totalValue: number;
  positions: Position[];
  timestamp: Date;
}

export interface Position {
  symbol: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  timestamp: Date;
}

export interface PortfolioRecommendation {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  timestamp: Date;
}

// Additional interfaces for AI modules
export interface SentimentAnalysis {
  score: number;
  confidence: number;
  sources: string[];
  timestamp: Date;
}

export interface TechnicalAnalysis {
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  sma: {
    sma20: number;
    sma50: number;
    sma200: number;
  };
  ema: {
    ema12: number;
    ema26: number;
  };
  confidence: number;
  timestamp: Date;
}

export interface PatternAnalysis {
  name: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  startPrice: number;
  endPrice: number;
  timestamp: Date;
}

export interface RiskAssessment {
  score: number;
  factors: string[];
  recommendations: string[];
  timestamp: Date;
}

export interface NewsAnalysis {
  score: number;
  confidence: number;
  articles: number;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  timestamp: Date;
}

export interface WhaleAnalysis {
  score: number;
  confidence: number;
  largeTransactions: number;
  netFlow: number;
  timestamp: Date;
}

export interface MarketPrediction {
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  targetPrice?: number;
  timeframe: string;
  timestamp: Date;
}

export interface PortfolioOptimization {
  recommendations: PortfolioRecommendation[];
  riskScore: number;
  expectedReturn: number;
  timestamp: Date;
}

// Export singleton instance
export const aiEngine = new AIEngine();
export async function setupAIEngine(): Promise<void> {
  await aiEngine.initialize();
}

// Export trading signals function
export async function generateTradingSignals(symbol: string) {
  return await aiEngine.generateTradingSignals(symbol);
}
