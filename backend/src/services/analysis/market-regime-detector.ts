import { logger } from '../../utils/logger';
import { TechnicalAnalyzer } from '../ai/technical-analyzer';
import { SentimentAnalyzer } from '../ai/sentiment-analyzer';
import { EnhancedNewsAnalyzer } from '../ai/enhanced-news-analyzer';

export interface MarketRegime {
  type: 'BULL' | 'BEAR' | 'SIDEWAYS' | 'VOLATILE' | 'TRENDING' | 'RANGING';
  confidence: number;           // 0-1 confidence in regime classification
  volatility: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  trend: 'STRONG_UP' | 'WEAK_UP' | 'NEUTRAL' | 'WEAK_DOWN' | 'STRONG_DOWN';
  timeframe: string;           // e.g., '1h', '4h', '1d'
  duration: number;            // How long this regime has been active (minutes)
  expectedDuration: number;    // Expected duration based on historical data
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  recommendedStrategy: string; // Which strategy to use
  positionSizeMultiplier: number; // Adjust position size based on regime
}

export interface RegimeDetectionConfig {
  lookbackPeriods: number;     // Number of periods to analyze (e.g., 50)
  volatilityThreshold: number; // Threshold for high volatility (e.g., 0.03)
  trendThreshold: number;      // Threshold for strong trend (e.g., 0.02)
  confidenceThreshold: number; // Minimum confidence to trust regime (e.g., 0.7)
  updateFrequencyMinutes: number; // How often to update regime (e.g., 15)
}

export class MarketRegimeDetector {
  private config: RegimeDetectionConfig;
  private technicalAnalyzer: TechnicalAnalyzer;
  private sentimentAnalyzer: SentimentAnalyzer;
  private enhancedNewsAnalyzer: EnhancedNewsAnalyzer;
  private currentRegime: MarketRegime | null = null;
  private regimeHistory: MarketRegime[] = [];
  private lastUpdateTime: Date = new Date();

  constructor(config?: Partial<RegimeDetectionConfig>) {
    this.config = {
      lookbackPeriods: 50,
      volatilityThreshold: 0.03,
      trendThreshold: 0.02,
      confidenceThreshold: 0.7,
      updateFrequencyMinutes: 15,
      ...config
    };

    this.technicalAnalyzer = new TechnicalAnalyzer();
    this.sentimentAnalyzer = new SentimentAnalyzer();
    this.enhancedNewsAnalyzer = new EnhancedNewsAnalyzer();
  }

  async initialize(): Promise<void> {
    logger.info('🎯 Initializing Market Regime Detector...');
    await Promise.all([
      this.technicalAnalyzer.initialize(),
      this.sentimentAnalyzer.initialize(),
      this.enhancedNewsAnalyzer.initialize()
    ]);
    logger.info('✅ Market Regime Detector initialized');
  }

  async detectRegime(symbol: string): Promise<MarketRegime> {
    try {
      // Check if we need to update (based on frequency)
      const timeSinceLastUpdate = Date.now() - this.lastUpdateTime.getTime();
      if (timeSinceLastUpdate < this.config.updateFrequencyMinutes * 60 * 1000 && this.currentRegime) {
        return this.currentRegime;
      }

      logger.info(`🎯 Detecting market regime for ${symbol}`);

      // Get market data and analysis
      const [technicalAnalysis, sentimentAnalysis, newsAnalysis] = await Promise.all([
        this.technicalAnalyzer.analyze(symbol),
        this.sentimentAnalyzer.analyze(symbol),
        this.enhancedNewsAnalyzer.analyze(symbol)
      ]);

      // Analyze price action
      const priceAction = this.analyzePriceAction(technicalAnalysis);
      
      // Analyze volatility
      const volatility = this.analyzeVolatility(technicalAnalysis);
      
      // Analyze trend strength
      const trend = this.analyzeTrend(technicalAnalysis);
      
      // Analyze sentiment
      const sentiment = this.analyzeSentiment(sentimentAnalysis, newsAnalysis);
      
      // Determine regime type
      const regimeType = this.determineRegimeType(priceAction, volatility, trend, sentiment);
      
      // Calculate confidence
      const confidence = this.calculateConfidence(priceAction, volatility, trend, sentiment);
      
      // Determine risk level and recommendations
      const riskLevel = this.determineRiskLevel(regimeType, volatility, trend);
      const recommendedStrategy = this.getRecommendedStrategy(regimeType, riskLevel);
      const positionSizeMultiplier = this.getPositionSizeMultiplier(regimeType, volatility, riskLevel);

      // Calculate duration
      const duration = this.calculateRegimeDuration(regimeType);
      const expectedDuration = this.getExpectedDuration(regimeType);

      const regime: MarketRegime = {
        type: regimeType,
        confidence,
        volatility,
        trend,
        timeframe: '1h', // Default timeframe
        duration,
        expectedDuration,
        riskLevel,
        recommendedStrategy,
        positionSizeMultiplier
      };

      // Update current regime and history
      this.currentRegime = regime;
      this.regimeHistory.push(regime);
      this.lastUpdateTime = new Date();

      // Keep only last 100 regimes in history
      if (this.regimeHistory.length > 100) {
        this.regimeHistory = this.regimeHistory.slice(-100);
      }

      logger.info(`✅ Market regime detected: ${regimeType} (${(confidence * 100).toFixed(1)}% confidence)`);
      return regime;

    } catch (error) {
      logger.error(`❌ Error detecting market regime for ${symbol}:`, error);
      
      // Return conservative fallback regime
      return {
        type: 'SIDEWAYS',
        confidence: 0.3,
        volatility: 'MEDIUM',
        trend: 'NEUTRAL',
        timeframe: '1h',
        duration: 0,
        expectedDuration: 60,
        riskLevel: 'MEDIUM',
        recommendedStrategy: 'CONSERVATIVE',
        positionSizeMultiplier: 0.5
      };
    }
  }

  private analyzePriceAction(technicalAnalysis: any): any {
    const rsi = technicalAnalysis.rsi || 50;
    const macd = technicalAnalysis.macd?.histogram || 0;
    const bollingerPosition = technicalAnalysis.bollingerBands?.percentB || 0.5;
    
    return {
      rsi,
      macd,
      bollingerPosition,
      isOverbought: rsi > 70,
      isOversold: rsi < 30,
      isAboveMA: macd > 0,
      isInBollingerMiddle: bollingerPosition > 0.3 && bollingerPosition < 0.7
    };
  }

  private analyzeVolatility(technicalAnalysis: any): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
    const atr = technicalAnalysis.atr || 0.02;
    const bollingerWidth = technicalAnalysis.bollingerBands?.width || 0.02;
    
    const volatility = Math.max(atr, bollingerWidth);
    
    if (volatility > 0.05) return 'EXTREME';
    if (volatility > 0.03) return 'HIGH';
    if (volatility > 0.015) return 'MEDIUM';
    return 'LOW';
  }

  private analyzeTrend(technicalAnalysis: any): 'STRONG_UP' | 'WEAK_UP' | 'NEUTRAL' | 'WEAK_DOWN' | 'STRONG_DOWN' {
    const macd = technicalAnalysis.macd?.histogram || 0;
    const rsi = technicalAnalysis.rsi || 50;
    const trendStrength = Math.abs(macd);
    
    if (macd > 0 && trendStrength > this.config.trendThreshold) {
      return rsi > 60 ? 'STRONG_UP' : 'WEAK_UP';
    } else if (macd < 0 && trendStrength > this.config.trendThreshold) {
      return rsi < 40 ? 'STRONG_DOWN' : 'WEAK_DOWN';
    }
    
    return 'NEUTRAL';
  }

  private analyzeSentiment(sentimentAnalysis: any, newsAnalysis: any): any {
    const sentimentScore = sentimentAnalysis.score || 0;
    const newsSentiment = newsAnalysis.overallSentiment || 0;
    const combinedSentiment = (sentimentScore + newsSentiment) / 2;
    
    return {
      score: combinedSentiment,
      isBullish: combinedSentiment > 0.2,
      isBearish: combinedSentiment < -0.2,
      isNeutral: Math.abs(combinedSentiment) <= 0.2
    };
  }

  private determineRegimeType(
    priceAction: any,
    volatility: string,
    trend: string,
    sentiment: any
  ): MarketRegime['type'] {
    // High volatility regimes
    if (volatility === 'EXTREME' || volatility === 'HIGH') {
      return 'VOLATILE';
    }
    
    // Trending regimes
    if (trend === 'STRONG_UP' || trend === 'STRONG_DOWN') {
      return 'TRENDING';
    }
    
    // Bull/Bear markets based on sentiment and trend
    if (sentiment.isBullish && (trend === 'WEAK_UP' || trend === 'STRONG_UP')) {
      return 'BULL';
    }
    
    if (sentiment.isBearish && (trend === 'WEAK_DOWN' || trend === 'STRONG_DOWN')) {
      return 'BEAR';
    }
    
    // Sideways/ranging markets
    if (trend === 'NEUTRAL' && volatility === 'LOW') {
      return 'RANGING';
    }
    
    return 'SIDEWAYS';
  }

  private calculateConfidence(
    priceAction: any,
    volatility: string,
    trend: string,
    sentiment: any
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence for clear signals
    if (priceAction.isOverbought || priceAction.isOversold) confidence += 0.1;
    if (trend === 'STRONG_UP' || trend === 'STRONG_DOWN') confidence += 0.2;
    if (sentiment.isBullish || sentiment.isBearish) confidence += 0.1;
    if (volatility === 'LOW' || volatility === 'EXTREME') confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  private determineRiskLevel(
    regimeType: MarketRegime['type'],
    volatility: string,
    trend: string
  ): MarketRegime['riskLevel'] {
    if (volatility === 'EXTREME') return 'EXTREME';
    if (regimeType === 'VOLATILE' || volatility === 'HIGH') return 'HIGH';
    if (regimeType === 'TRENDING' && (trend === 'STRONG_UP' || trend === 'STRONG_DOWN')) return 'MEDIUM';
    if (regimeType === 'BULL' || regimeType === 'BEAR') return 'MEDIUM';
    return 'LOW';
  }

  private getRecommendedStrategy(
    regimeType: MarketRegime['type'],
    riskLevel: MarketRegime['riskLevel']
  ): string {
    const strategies = {
      'BULL': 'MOMENTUM_LONG',
      'BEAR': 'MOMENTUM_SHORT',
      'TRENDING': 'TREND_FOLLOWING',
      'VOLATILE': 'SCALPING',
      'SIDEWAYS': 'MEAN_REVERSION',
      'RANGING': 'RANGE_TRADING'
    };
    
    const baseStrategy = strategies[regimeType] || 'CONSERVATIVE';
    
    if (riskLevel === 'EXTREME') return 'EMERGENCY_STOP';
    if (riskLevel === 'HIGH') return 'CONSERVATIVE';
    
    return baseStrategy;
  }

  private getPositionSizeMultiplier(
    regimeType: MarketRegime['type'],
    volatility: string,
    riskLevel: MarketRegime['riskLevel']
  ): number {
    let multiplier = 1.0;
    
    // Reduce size for high-risk regimes
    if (riskLevel === 'EXTREME') multiplier *= 0.2;
    else if (riskLevel === 'HIGH') multiplier *= 0.5;
    else if (riskLevel === 'MEDIUM') multiplier *= 0.8;
    
    // Adjust for volatility
    if (volatility === 'EXTREME') multiplier *= 0.3;
    else if (volatility === 'HIGH') multiplier *= 0.6;
    else if (volatility === 'LOW') multiplier *= 1.2;
    
    // Adjust for regime type
    if (regimeType === 'VOLATILE') multiplier *= 0.4;
    else if (regimeType === 'TRENDING') multiplier *= 1.1;
    else if (regimeType === 'BULL' || regimeType === 'BEAR') multiplier *= 1.0;
    else multiplier *= 0.7; // Sideways/ranging
    
    return Math.max(0.1, Math.min(1.5, multiplier)); // Clamp between 10% and 150%
  }

  private calculateRegimeDuration(regimeType: MarketRegime['type']): number {
    // Simple duration calculation - in real implementation, track actual duration
    return 0; // Placeholder
  }

  private getExpectedDuration(regimeType: MarketRegime['type']): number {
    const durations = {
      'BULL': 240,      // 4 hours
      'BEAR': 180,      // 3 hours
      'TRENDING': 120,  // 2 hours
      'VOLATILE': 60,   // 1 hour
      'SIDEWAYS': 300,  // 5 hours
      'RANGING': 360    // 6 hours
    };
    
    return durations[regimeType] || 120;
  }

  // Get current regime
  getCurrentRegime(): MarketRegime | null {
    return this.currentRegime;
  }

  // Get regime history
  getRegimeHistory(): MarketRegime[] {
    return [...this.regimeHistory];
  }

  // Check if regime has changed
  hasRegimeChanged(newRegime: MarketRegime): boolean {
    if (!this.currentRegime) return true;
    return this.currentRegime.type !== newRegime.type;
  }

  // Update configuration
  updateConfig(newConfig: Partial<RegimeDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('⚙️ Market Regime Detector configuration updated');
  }
}
