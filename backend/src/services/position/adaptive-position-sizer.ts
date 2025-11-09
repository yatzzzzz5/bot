import { logger } from '../../utils/logger';
import { TechnicalAnalyzer } from '../ai/technical-analyzer';
import { RiskScorer } from '../ai/risk-scorer';
import { EnhancedMLPredictor } from '../ai/enhanced-ml-predictor';

export interface AdaptivePositionConfig {
  basePositionSize: number;        // Base % of portfolio (e.g., 0.05 = 5%)
  maxPositionSize: number;        // Maximum % of portfolio (e.g., 0.15 = 15%)
  minPositionSize: number;        // Minimum % of portfolio (e.g., 0.01 = 1%)
  volatilityMultiplier: number;   // How much volatility affects sizing (e.g., 0.5)
  confidenceMultiplier: number;   // How much confidence affects sizing (e.g., 1.2)
  consecutiveLossPenalty: number;  // Penalty for consecutive losses (e.g., 0.8)
  maxConsecutiveLosses: number;   // Max losses before position reduction (e.g., 3)
}

export interface PositionSizingResult {
  recommendedSize: number;        // Recommended position size (% of portfolio)
  sizeInUSD: number;             // Size in USD
  sizeInCoins: number;           // Size in coin units
  confidence: number;            // Confidence in this sizing (0-1)
  factors: {
    baseSize: number;
    volatilityAdjustment: number;
    confidenceAdjustment: number;
    consecutiveLossAdjustment: number;
    finalMultiplier: number;
  };
  warnings: string[];
}

export class AdaptivePositionSizer {
  private config: AdaptivePositionConfig;
  private technicalAnalyzer: TechnicalAnalyzer;
  private riskScorer: RiskScorer;
  private enhancedMLPredictor: EnhancedMLPredictor;
  private consecutiveLosses: number = 0;
  private lastTradeResult: 'WIN' | 'LOSS' | null = null;

  constructor(config?: Partial<AdaptivePositionConfig>) {
    this.config = {
      basePositionSize: 0.05,      // 5% base
      maxPositionSize: 0.15,        // 15% max
      minPositionSize: 0.01,        // 1% min
      volatilityMultiplier: 0.5,    // Reduce size by 50% in high volatility
      confidenceMultiplier: 1.2,     // Increase size by 20% for high confidence
      consecutiveLossPenalty: 0.8,   // Reduce size by 20% after losses
      maxConsecutiveLosses: 3,       // Max 3 losses before reduction
      ...config
    };

    this.technicalAnalyzer = new TechnicalAnalyzer();
    this.riskScorer = new RiskScorer();
    this.enhancedMLPredictor = new EnhancedMLPredictor();
  }

  async initialize(): Promise<void> {
    logger.info('🎯 Initializing Adaptive Position Sizer...');
    await Promise.all([
      this.technicalAnalyzer.initialize(),
      this.riskScorer.initialize(),
      this.enhancedMLPredictor.initialize()
    ]);
    logger.info('✅ Adaptive Position Sizer initialized');
  }

  async calculatePositionSize(
    symbol: string,
    signal: any,
    portfolioValue: number,
    currentPrice: number
  ): Promise<PositionSizingResult> {
    try {
      logger.info(`🎯 Calculating adaptive position size for ${symbol}`);

      // 1. Get market analysis
      const technicalAnalysis = await this.technicalAnalyzer.analyze(symbol);
      const riskAssessment = await this.riskScorer.calculate({
        symbol,
        sentiment: signal,
        technical: technicalAnalysis,
        patterns: []
      });
      const mlPrediction = await this.enhancedMLPredictor.predict(symbol, technicalAnalysis as any, signal, {} as any, {} as any);

      // 2. Calculate volatility adjustment
      const volatilityAdjustment = this.calculateVolatilityAdjustment(technicalAnalysis);
      
      // 3. Calculate confidence adjustment
      const confidenceAdjustment = this.calculateConfidenceAdjustment(
        signal.confidence,
        mlPrediction[0]?.confidence || 0.5,
        riskAssessment
      );

      // 4. Calculate consecutive loss adjustment
      const consecutiveLossAdjustment = this.calculateConsecutiveLossAdjustment();

      // 5. Calculate final position size
      const finalMultiplier = volatilityAdjustment * confidenceAdjustment * consecutiveLossAdjustment;
      const recommendedSize = Math.max(
        this.config.minPositionSize,
        Math.min(
          this.config.maxPositionSize,
          this.config.basePositionSize * finalMultiplier
        )
      );

      // 6. Convert to USD and coin units
      const sizeInUSD = portfolioValue * recommendedSize;
      const sizeInCoins = sizeInUSD / currentPrice;

      // 7. Calculate overall confidence
      const confidence = this.calculateOverallConfidence(
        signal.confidence,
        mlPrediction[0]?.confidence || 0.5,
        riskAssessment
      );

      // 8. Generate warnings
      const warnings = this.generateWarnings(
        recommendedSize,
        volatilityAdjustment,
        consecutiveLossAdjustment,
        riskAssessment
      );

      const result: PositionSizingResult = {
        recommendedSize,
        sizeInUSD,
        sizeInCoins,
        confidence,
        factors: {
          baseSize: this.config.basePositionSize,
          volatilityAdjustment,
          confidenceAdjustment,
          consecutiveLossAdjustment,
          finalMultiplier
        },
        warnings
      };

      logger.info(`✅ Position size calculated: ${(recommendedSize * 100).toFixed(2)}% ($${sizeInUSD.toFixed(2)})`);
      return result;

    } catch (error) {
      logger.error(`❌ Error calculating position size for ${symbol}:`, error);
      
      // Return conservative fallback
      return {
        recommendedSize: this.config.minPositionSize,
        sizeInUSD: portfolioValue * this.config.minPositionSize,
        sizeInCoins: (portfolioValue * this.config.minPositionSize) / currentPrice,
        confidence: 0.3,
        factors: {
          baseSize: this.config.basePositionSize,
          volatilityAdjustment: 0.5,
          confidenceAdjustment: 0.5,
          consecutiveLossAdjustment: 0.8,
          finalMultiplier: 0.1
        },
        warnings: ['Error in position sizing - using conservative fallback']
      };
    }
  }

  private calculateVolatilityAdjustment(technicalAnalysis: any): number {
    try {
      // Use ATR or Bollinger Bands width as volatility measure
      const volatility = technicalAnalysis.atr || technicalAnalysis.bollingerBands?.width || 0.02;
      
      // Higher volatility = smaller position size
      if (volatility > 0.05) return 0.3;      // Very high volatility
      if (volatility > 0.03) return 0.5;      // High volatility
      if (volatility > 0.02) return 0.7;      // Medium volatility
      if (volatility > 0.01) return 0.9;      // Low volatility
      return 1.0;                             // Very low volatility
    } catch (error) {
      logger.warn('Error calculating volatility adjustment:', error);
      return 0.7; // Conservative fallback
    }
  }

  private calculateConfidenceAdjustment(
    signalConfidence: number,
    mlConfidence: number,
    riskScore: number
  ): number {
    try {
      // Combine signal and ML confidence
      const combinedConfidence = (signalConfidence + mlConfidence) / 2;
      
      // Adjust based on risk score
      const riskAdjustedConfidence = combinedConfidence * (1 - riskScore);
      
      // Convert to multiplier
      if (riskAdjustedConfidence > 0.8) return this.config.confidenceMultiplier;
      if (riskAdjustedConfidence > 0.6) return 1.0;
      if (riskAdjustedConfidence > 0.4) return 0.8;
      return 0.6; // Low confidence
    } catch (error) {
      logger.warn('Error calculating confidence adjustment:', error);
      return 0.8; // Conservative fallback
    }
  }

  private calculateConsecutiveLossAdjustment(): number {
    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      return this.config.consecutiveLossPenalty;
    }
    
    // Gradual reduction based on consecutive losses
    const penaltyFactor = Math.pow(this.config.consecutiveLossPenalty, this.consecutiveLosses);
    return Math.max(0.3, penaltyFactor); // Minimum 30% of original size
  }

  private calculateOverallConfidence(
    signalConfidence: number,
    mlConfidence: number,
    riskScore: number
  ): number {
    const combinedConfidence = (signalConfidence + mlConfidence) / 2;
    const riskAdjustedConfidence = combinedConfidence * (1 - riskScore);
    
    // Factor in consecutive losses
    const consecutiveLossPenalty = Math.pow(0.9, this.consecutiveLosses);
    
    return Math.max(0.1, Math.min(1.0, riskAdjustedConfidence * consecutiveLossPenalty));
  }

  private generateWarnings(
    recommendedSize: number,
    volatilityAdjustment: number,
    consecutiveLossAdjustment: number,
    riskScore: number
  ): string[] {
    const warnings: string[] = [];

    if (recommendedSize >= this.config.maxPositionSize * 0.9) {
      warnings.push('⚠️ Position size near maximum limit');
    }

    if (volatilityAdjustment < 0.5) {
      warnings.push('⚠️ High market volatility detected - reduced position size');
    }

    if (consecutiveLossAdjustment < 0.8) {
      warnings.push(`⚠️ ${this.consecutiveLosses} consecutive losses - reduced position size`);
    }

    if (riskScore > 0.7) {
      warnings.push('⚠️ High risk score - consider avoiding this trade');
    }

    if (recommendedSize <= this.config.minPositionSize * 1.1) {
      warnings.push('⚠️ Position size at minimum - very conservative');
    }

    return warnings;
  }

  // Update consecutive losses after trade result
  updateTradeResult(result: 'WIN' | 'LOSS'): void {
    if (result === 'LOSS') {
      this.consecutiveLosses++;
      logger.warn(`📉 Consecutive losses: ${this.consecutiveLosses}`);
    } else if (result === 'WIN') {
      this.consecutiveLosses = 0;
      logger.info('✅ Win streak - resetting consecutive losses');
    }
    
    this.lastTradeResult = result;
  }

  // Reset consecutive losses (e.g., at start of new day)
  resetConsecutiveLosses(): void {
    this.consecutiveLosses = 0;
    this.lastTradeResult = null;
    logger.info('🔄 Consecutive losses reset');
  }

  // Get current consecutive losses count
  getConsecutiveLosses(): number {
    return this.consecutiveLosses;
  }

  // Update configuration
  updateConfig(newConfig: Partial<AdaptivePositionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('⚙️ Adaptive Position Sizer configuration updated');
  }
}
