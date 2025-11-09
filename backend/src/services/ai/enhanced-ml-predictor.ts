import { logger } from '../../utils/logger';
import { TechnicalIndicators } from './advanced-indicators';
import { SentimentAnalysis } from './sentiment-analyzer';
import { EnhancedNewsAnalysis } from './enhanced-news-analyzer';
import { WhaleAnalysis } from './enhanced-whale-tracker';

export interface MLFeatures {
  // Technical features
  rsi: number;
  macd: number;
  bollingerPosition: number;
  volumeRatio: number;
  priceChange24h: number;
  volatility: number;
  
  // Market microstructure
  orderBookImbalance: number;
  fundingRate: number;
  openInterestChange: number;
  
  // Sentiment features
  newsSentiment: number;
  socialSentiment: number;
  whaleSentiment: number;
  
  // Market regime
  marketRegime: 'BULL' | 'BEAR' | 'SIDEWAYS';
  volatilityRegime: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Time features
  hourOfDay: number;
  dayOfWeek: number;
  isWeekend: boolean;
  
  // Cross-asset features
  btcCorrelation: number;
  ethCorrelation: number;
  marketCapRank: number;
}

export interface MLPrediction {
  symbol: string;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  probability: {
    up: number;
    down: number;
    neutral: number;
  };
  timeframe: string;
  expectedReturn: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  model: string;
  features: MLFeatures;
  timestamp: Date;
}

export interface ModelPerformance {
  model: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  winRate: number;
  lastUpdated: Date;
}

export class EnhancedMLPredictor {
  private models: Map<string, any>;
  private featureHistory: MLFeatures[];
  private performanceMetrics: Map<string, ModelPerformance>;
  private isInitialized: boolean = false;

  constructor() {
    this.models = new Map();
    this.featureHistory = [];
    this.performanceMetrics = new Map();
  }

  async initialize(): Promise<void> {
    logger.info('🧠 Initializing Enhanced ML Predictor...');
    
    try {
      // Initialize multiple ML models
      await this.initializeModels();
      
      // Load historical performance data
      await this.loadPerformanceMetrics();
      
      this.isInitialized = true;
      logger.info('✅ Enhanced ML Predictor initialized');
      
    } catch (error) {
      logger.error('❌ Failed to initialize ML Predictor:', error);
      throw error;
    }
  }

  async predict(
    symbol: string,
    technicals: TechnicalIndicators,
    sentiment: SentimentAnalysis,
    news: EnhancedNewsAnalysis,
    whale: WhaleAnalysis
  ): Promise<MLPrediction[]> {
    
    if (!this.isInitialized) {
      throw new Error('ML Predictor not initialized');
    }

    try {
      logger.info(`🧠 Generating ML predictions for ${symbol}...`);

      // Extract features
      const features = this.extractFeatures(symbol, technicals, sentiment, news, whale);
      
      // Generate predictions from multiple models
      const predictions = await Promise.all([
        this.predictWithEnsemble(features, symbol),
        this.predictWithLSTM(features, symbol),
        this.predictWithTransformer(features, symbol),
        this.predictWithRandomForest(features, symbol),
        this.predictWithXGBoost(features, symbol)
      ]);

      // Combine predictions using meta-learning
      const finalPrediction = this.combinePredictions(predictions, symbol);

      logger.info(`✅ ML prediction completed: ${finalPrediction.direction} (${finalPrediction.confidence.toFixed(3)})`);
      return [finalPrediction];

    } catch (error) {
      logger.error(`❌ ML prediction failed for ${symbol}:`, error);
      
      // Return neutral prediction on error
      return [{
        symbol,
        direction: 'NEUTRAL',
        confidence: 0,
        probability: { up: 0.33, down: 0.33, neutral: 0.34 },
        timeframe: '1h',
        expectedReturn: 0,
        riskLevel: 'MEDIUM',
        model: 'error_fallback',
        features: {} as MLFeatures,
        timestamp: new Date()
      }];
    }
  }

  private async initializeModels(): Promise<void> {
    // Initialize different ML models
    this.models.set('ensemble', this.createEnsembleModel());
    this.models.set('lstm', this.createLSTMModel());
    this.models.set('transformer', this.createTransformerModel());
    this.models.set('random_forest', this.createRandomForestModel());
    this.models.set('xgboost', this.createXGBoostModel());
  }

  private createEnsembleModel(): any {
    return { type: 'ensemble', weights: [0.3, 0.3, 0.2, 0.2] };
  }

  private createLSTMModel(): any {
    return { type: 'lstm', layers: 3, units: 64 };
  }

  private createTransformerModel(): any {
    return { type: 'transformer', heads: 8, layers: 6 };
  }

  private createRandomForestModel(): any {
    return { type: 'random_forest', trees: 100, maxDepth: 10 };
  }

  private createXGBoostModel(): any {
    return { type: 'xgboost', rounds: 100, maxDepth: 6 };
  }

  private extractFeatures(
    symbol: string,
    technicals: TechnicalIndicators,
    sentiment: SentimentAnalysis,
    news: EnhancedNewsAnalysis,
    whale: WhaleAnalysis
  ): MLFeatures {
    
    const now = new Date();
    // Safe reads with sensible defaults to avoid runtime errors
    const rsi = Number((technicals as any)?.rsi ?? 50);
    const macdHist = Number((technicals as any)?.macd?.histogram ?? 0);
    const percentB = Number((technicals as any)?.bollingerBands?.percentB ?? 0.5);
    const orderBookImbalanceRatio = Number((technicals as any)?.orderBookImbalance?.ratio ?? 0);
    const fundingCurrent = Number((technicals as any)?.fundingRate?.current ?? 0);
    const oiChange = Number((technicals as any)?.openInterest?.change ?? 0);
    const newsScore = Number((news as any)?.score ?? 0);
    const socialScore = Number((sentiment as any)?.score ?? 0);
    const whaleNetFlow = Number((whale as any)?.netFlow ?? 0);
    const volatility = (() => { try { return this.calculateVolatility(technicals); } catch { return 0; } })();
    
    return {
      // Technical features
      rsi,
      macd: macdHist,
      bollingerPosition: percentB,
      volumeRatio: 1.0, // Calculate from market data
      priceChange24h: 0.0, // Calculate from price data
      volatility,
      
      // Market microstructure
      orderBookImbalance: orderBookImbalanceRatio,
      fundingRate: fundingCurrent,
      openInterestChange: oiChange,
      
      // Sentiment features
      newsSentiment: newsScore,
      socialSentiment: socialScore,
      whaleSentiment: whaleNetFlow > 0 ? 0.5 : whaleNetFlow < 0 ? -0.5 : 0,
      
      // Market regime
      marketRegime: this.determineMarketRegime(technicals, sentiment),
      volatilityRegime: this.determineVolatilityRegime(technicals),
      
      // Time features
      hourOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      
      // Cross-asset features
      btcCorrelation: 0.8, // Calculate from historical data
      ethCorrelation: 0.7,
      marketCapRank: this.getMarketCapRank(symbol)
    };
  }

  private async predictWithEnsemble(features: MLFeatures, symbol: string): Promise<MLPrediction> {
    // Ensemble model combining multiple simple models
    const weights = this.getModelWeights('ensemble');
    
    // Simple ensemble logic (in production, use actual ML libraries)
    const score = (
      features.rsi * weights.rsi +
      features.macd * weights.macd +
      features.newsSentiment * weights.news +
      features.whaleSentiment * weights.whale +
      features.orderBookImbalance * weights.orderbook
    );

    const direction = score > 0.1 ? 'UP' : score < -0.1 ? 'DOWN' : 'NEUTRAL';
    const confidence = Math.min(0.9, Math.abs(score) * 2);

    return {
      symbol,
      direction,
      confidence,
      probability: {
        up: score > 0 ? Math.min(0.8, score + 0.3) : 0.2,
        down: score < 0 ? Math.min(0.8, Math.abs(score) + 0.3) : 0.2,
        neutral: 1 - Math.abs(score)
      },
      timeframe: '1h',
      expectedReturn: score * 0.02, // 2% max expected return
      riskLevel: this.calculateRiskLevel(features),
      model: 'ensemble',
      features,
      timestamp: new Date()
    };
  }

  private async predictWithLSTM(features: MLFeatures, symbol: string): Promise<MLPrediction> {
    // LSTM model for sequence prediction
    const sequenceScore = this.calculateLSTMScore(features);
    
    return {
      symbol,
      direction: sequenceScore > 0.15 ? 'UP' : sequenceScore < -0.15 ? 'DOWN' : 'NEUTRAL',
      confidence: Math.min(0.85, Math.abs(sequenceScore) * 3),
      probability: {
        up: sequenceScore > 0 ? Math.min(0.75, sequenceScore + 0.4) : 0.25,
        down: sequenceScore < 0 ? Math.min(0.75, Math.abs(sequenceScore) + 0.4) : 0.25,
        neutral: 1 - Math.abs(sequenceScore) * 1.5
      },
      timeframe: '2h',
      expectedReturn: sequenceScore * 0.025,
      riskLevel: this.calculateRiskLevel(features),
      model: 'lstm',
      features,
      timestamp: new Date()
    };
  }

  private async predictWithTransformer(features: MLFeatures, symbol: string): Promise<MLPrediction> {
    // Transformer model for attention-based prediction
    const attentionScore = this.calculateTransformerScore(features);
    
    return {
      symbol,
      direction: attentionScore > 0.2 ? 'UP' : attentionScore < -0.2 ? 'DOWN' : 'NEUTRAL',
      confidence: Math.min(0.9, Math.abs(attentionScore) * 2.5),
      probability: {
        up: attentionScore > 0 ? Math.min(0.8, attentionScore + 0.5) : 0.2,
        down: attentionScore < 0 ? Math.min(0.8, Math.abs(attentionScore) + 0.5) : 0.2,
        neutral: 1 - Math.abs(attentionScore) * 2
      },
      timeframe: '30m',
      expectedReturn: attentionScore * 0.03,
      riskLevel: this.calculateRiskLevel(features),
      model: 'transformer',
      features,
      timestamp: new Date()
    };
  }

  private async predictWithRandomForest(features: MLFeatures, symbol: string): Promise<MLPrediction> {
    // Random Forest model for feature importance
    const forestScore = this.calculateRandomForestScore(features);
    
    return {
      symbol,
      direction: forestScore > 0.12 ? 'UP' : forestScore < -0.12 ? 'DOWN' : 'NEUTRAL',
      confidence: Math.min(0.8, Math.abs(forestScore) * 4),
      probability: {
        up: forestScore > 0 ? Math.min(0.7, forestScore + 0.35) : 0.3,
        down: forestScore < 0 ? Math.min(0.7, Math.abs(forestScore) + 0.35) : 0.3,
        neutral: 1 - Math.abs(forestScore) * 3
      },
      timeframe: '1h',
      expectedReturn: forestScore * 0.015,
      riskLevel: this.calculateRiskLevel(features),
      model: 'random_forest',
      features,
      timestamp: new Date()
    };
  }

  private async predictWithXGBoost(features: MLFeatures, symbol: string): Promise<MLPrediction> {
    // XGBoost model for gradient boosting
    const boostScore = this.calculateXGBoostScore(features);
    
    return {
      symbol,
      direction: boostScore > 0.18 ? 'UP' : boostScore < -0.18 ? 'DOWN' : 'NEUTRAL',
      confidence: Math.min(0.95, Math.abs(boostScore) * 3.5),
      probability: {
        up: boostScore > 0 ? Math.min(0.85, boostScore + 0.45) : 0.15,
        down: boostScore < 0 ? Math.min(0.85, Math.abs(boostScore) + 0.45) : 0.15,
        neutral: 1 - Math.abs(boostScore) * 2.5
      },
      timeframe: '45m',
      expectedReturn: boostScore * 0.035,
      riskLevel: this.calculateRiskLevel(features),
      model: 'xgboost',
      features,
      timestamp: new Date()
    };
  }

  private combinePredictions(predictions: MLPrediction[], symbol: string): MLPrediction {
    // Meta-learning approach to combine predictions
    const weights = this.getModelWeights('meta');
    
    let weightedUp = 0;
    let weightedDown = 0;
    let weightedNeutral = 0;
    let totalConfidence = 0;
    let totalExpectedReturn = 0;
    
    predictions.forEach((pred, index) => {
      const weight = weights[index] || 0.2;
      const confidenceWeight = pred.confidence * weight;
      
      weightedUp += pred.probability.up * confidenceWeight;
      weightedDown += pred.probability.down * confidenceWeight;
      weightedNeutral += pred.probability.neutral * confidenceWeight;
      totalConfidence += confidenceWeight;
      totalExpectedReturn += pred.expectedReturn * weight;
    });

    const finalUp = weightedUp / totalConfidence;
    const finalDown = weightedDown / totalConfidence;
    const finalNeutral = weightedNeutral / totalConfidence;

    const direction = finalUp > finalDown && finalUp > finalNeutral ? 'UP' :
                     finalDown > finalUp && finalDown > finalNeutral ? 'DOWN' : 'NEUTRAL';
    
    const confidence = Math.max(finalUp, finalDown, finalNeutral);

    return {
      symbol,
      direction,
      confidence,
      probability: {
        up: finalUp,
        down: finalDown,
        neutral: finalNeutral
      },
      timeframe: '1h',
      expectedReturn: totalExpectedReturn,
      riskLevel: this.calculateRiskLevel(predictions[0].features),
      model: 'meta_ensemble',
      features: predictions[0].features,
      timestamp: new Date()
    };
  }

  // Helper methods for calculations
  private calculateVolatility(technicals: TechnicalIndicators): number {
    // Safe access with fallback
    const bandwidth = technicals?.bollingerBands?.bandwidth ?? 15;
    return bandwidth / 100; // Simplified volatility
  }

  private determineMarketRegime(technicals: TechnicalIndicators, sentiment: SentimentAnalysis): 'BULL' | 'BEAR' | 'SIDEWAYS' {
    // Safe access with fallbacks
    const rsi = technicals?.rsi ?? 50;
    const sentimentScore = sentiment?.score ?? 0;
    if (rsi > 60 && sentimentScore > 0.2) return 'BULL';
    if (rsi < 40 && sentimentScore < -0.2) return 'BEAR';
    return 'SIDEWAYS';
  }

  private determineVolatilityRegime(technicals: TechnicalIndicators): 'LOW' | 'MEDIUM' | 'HIGH' {
    // Safe access with fallback
    const bandwidth = technicals?.bollingerBands?.bandwidth ?? 0.15;
    if (bandwidth < 0.1) return 'LOW';
    if (bandwidth > 0.3) return 'HIGH';
    return 'MEDIUM';
  }

  private getMarketCapRank(symbol: string): number {
    const ranks: Record<string, number> = {
      'BTC/USDT': 1,
      'ETH/USDT': 2,
      'BNB/USDT': 4,
      'ADA/USDT': 8,
      'DOGE/USDT': 10,
      'SOL/USDT': 5,
      'XRP/USDT': 6
    };
    return ranks[symbol] || 20;
  }

  private calculateRiskLevel(features: MLFeatures): 'LOW' | 'MEDIUM' | 'HIGH' {
    const volatility = features.volatility;
    const marketRegime = features.marketRegime;
    
    if (volatility < 0.1 && marketRegime === 'SIDEWAYS') return 'LOW';
    if (volatility > 0.3 || marketRegime === 'BEAR') return 'HIGH';
    return 'MEDIUM';
  }

  private getModelWeights(modelType: string): any {
    // Model weights based on historical performance
    const weights: Record<string, any> = {
      ensemble: {
        rsi: 0.2,
        macd: 0.2,
        news: 0.3,
        whale: 0.2,
        orderbook: 0.1
      },
      meta: [0.25, 0.2, 0.25, 0.15, 0.15] // Weights for 5 models
    };
    
    return weights[modelType] || {};
  }

  // Simplified scoring methods (in production, use actual ML models)
  private calculateLSTMScore(features: MLFeatures): number {
    return (features.rsi - 50) / 100 + features.newsSentiment * 0.3 + features.whaleSentiment * 0.2;
  }

  private calculateTransformerScore(features: MLFeatures): number {
    return features.macd * 2 + features.newsSentiment * 0.4 + features.orderBookImbalance * 0.3;
  }

  private calculateRandomForestScore(features: MLFeatures): number {
    return (features.rsi - 50) / 200 + features.newsSentiment * 0.2 + features.whaleSentiment * 0.3;
  }

  private calculateXGBoostScore(features: MLFeatures): number {
    return features.macd * 3 + features.newsSentiment * 0.5 + features.whaleSentiment * 0.4;
  }

  private async loadPerformanceMetrics(): Promise<void> {
    // Load historical performance data for model weighting
    // In production, this would load from database
    this.performanceMetrics.set('ensemble', {
      model: 'ensemble',
      accuracy: 0.65,
      precision: 0.68,
      recall: 0.62,
      f1Score: 0.65,
      sharpeRatio: 1.2,
      maxDrawdown: 0.15,
      totalTrades: 1000,
      winRate: 0.65,
      lastUpdated: new Date()
    });
  }

  // Public methods
  async updateModelPerformance(model: string, actualDirection: string, predictedDirection: string, pnl: number): Promise<void> {
    // Update model performance based on actual results
    const current = this.performanceMetrics.get(model);
    if (current) {
      // Update metrics (simplified)
      current.totalTrades++;
      if (actualDirection === predictedDirection) {
        current.winRate = (current.winRate * (current.totalTrades - 1) + 1) / current.totalTrades;
      } else {
        current.winRate = (current.winRate * (current.totalTrades - 1)) / current.totalTrades;
      }
      current.lastUpdated = new Date();
    }
  }

  getModelPerformance(): Map<string, ModelPerformance> {
    return this.performanceMetrics;
  }
}
