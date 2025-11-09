import { logger } from '../../utils/logger';
import { SentimentAnalysis } from './sentiment-analyzer';
import { TechnicalAnalysis } from './technical-analyzer';
import { PatternAnalysis } from './pattern-recognizer';

export interface RiskAssessment {
  score: number; // 0 to 1 (low to high risk)
  factors: string[];
  recommendations: string[];
  timestamp: Date;
}

export class RiskScorer {
  constructor() {}

  async initialize(): Promise<void> {
    logger.info('⚠️ Initializing Risk Scorer...');
    logger.info('✅ Risk Scorer initialized');
  }

  async calculate(data: {
    symbol: string;
    sentiment: SentimentAnalysis;
    technical: TechnicalAnalysis;
    patterns: PatternAnalysis[];
  }): Promise<number> {
    try {
      let riskScore = 0.5; // Base risk score
      
      // Sentiment risk
      const sentimentRisk = this.calculateSentimentRisk(data.sentiment);
      
      // Technical risk
      const technicalRisk = this.calculateTechnicalRisk(data.technical);
      
      // Pattern risk
      const patternRisk = this.calculatePatternRisk(data.patterns);
      
      // Combine risk scores
      riskScore = (sentimentRisk + technicalRisk + patternRisk) / 3;
      
      return Math.max(0, Math.min(1, riskScore));
      
    } catch (error) {
      logger.error('❌ Risk calculation failed:', error);
      return 0.5; // Default medium risk
    }
  }

  private calculateSentimentRisk(sentiment: SentimentAnalysis): number {
    // Extreme sentiment (positive or negative) increases risk
    const sentimentExtremity = Math.abs(sentiment.score);
    return sentimentExtremity * 0.3 + 0.2; // 0.2 to 0.5 range
  }

  private calculateTechnicalRisk(technical: TechnicalAnalysis): number {
    let risk = 0.5;
    
    // RSI extremes increase risk
    if (technical.rsi < 20 || technical.rsi > 80) {
      risk += 0.2;
    }
    
    // High volatility increases risk
    const volatility = Math.abs(technical.macd.histogram) / technical.macd.macd;
    if (volatility > 0.1) {
      risk += 0.1;
    }
    
    return Math.min(1, risk);
  }

  private calculatePatternRisk(patterns: PatternAnalysis[]): number {
    if (patterns.length === 0) return 0.5;
    
    // High confidence patterns reduce risk
    const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
    return 1 - avgConfidence * 0.3; // 0.7 to 1.0 range
  }

  async assessPortfolio(positions: any[]): Promise<RiskAssessment> {
    try {
      let totalRisk = 0;
      const factors: string[] = [];
      
      for (const position of positions) {
        totalRisk += position.riskScore || 0.5;
        
        if (position.riskScore > 0.7) {
          factors.push(`High risk position: ${position.symbol}`);
        }
      }
      
      const avgRisk = totalRisk / Math.max(1, positions.length);
      
      return {
        score: avgRisk,
        factors,
        recommendations: factors.length > 0 ? ['Consider reducing high-risk positions'] : ['Portfolio risk is acceptable'],
        timestamp: new Date()
      };
      
    } catch (error) {
      logger.error('❌ Portfolio risk assessment failed:', error);
      return {
        score: 0.5,
        factors: ['Risk assessment failed'],
        recommendations: ['Unable to assess portfolio risk'],
        timestamp: new Date()
      };
    }
  }
}
