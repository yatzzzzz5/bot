import { logger } from '../utils/logger';
import { TradingSignal, MarketAnalysis } from '../services/ai-engine';
import { DynamicPositionSizer, PositionSizingParams } from '../services/position/dynamic-position-sizer';

export interface SafeGrowthConfig {
  dailyTarget: number; // %2-5 günlük hedef
  maxRiskPerTrade: number; // %0.5-1 risk per trade
  maxDailyLoss: number; // %2-3 max günlük kayıp
  maxPositions: number; // 5-10 maksimum pozisyon
  minConfidence: number; // %70+ güven seviyesi
  diversification: boolean; // Çeşitlendirme zorunlu
}

export class SafeDailyGrowthStrategy {
  private config: SafeGrowthConfig;
  private positionSizer: DynamicPositionSizer;
  private dailyPnL: number = 0;
  private activePositions: number = 0;
  private maxDailyLoss: number = 0;

  constructor(config: SafeGrowthConfig) {
    this.config = config;
    this.positionSizer = new DynamicPositionSizer();
  }

  async initialize(): Promise<void> {
    logger.info('🛡️ Initializing Safe Daily Growth Strategy...');
    await this.positionSizer.initialize();
    logger.info('✅ Safe Daily Growth Strategy initialized');
  }

  async analyzeOpportunity(signal: TradingSignal, analysis: MarketAnalysis): Promise<{
    shouldTrade: boolean;
    positionSize: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    expectedReturn: number;
    reason: string;
  }> {
    try {
      // 1. Günlük kayıp kontrolü
      if (this.dailyPnL <= -this.maxDailyLoss) {
        return {
          shouldTrade: false,
          positionSize: 0,
          riskLevel: 'HIGH',
          expectedReturn: 0,
          reason: 'Günlük kayıp limiti aşıldı'
        };
      }

      // 2. Pozisyon sayısı kontrolü
      if (this.activePositions >= this.config.maxPositions) {
        return {
          shouldTrade: false,
          positionSize: 0,
          riskLevel: 'MEDIUM',
          expectedReturn: 0,
          reason: 'Maksimum pozisyon sayısına ulaşıldı'
        };
      }

      // 3. Güven seviyesi kontrolü
      if (signal.confidence < this.config.minConfidence) {
        return {
          shouldTrade: false,
          positionSize: 0,
          riskLevel: 'HIGH',
          expectedReturn: 0,
          reason: 'Yetersiz güven seviyesi'
        };
      }

      // 4. Risk skoru kontrolü
      if (analysis.riskScore > 0.7) {
        return {
          shouldTrade: false,
          positionSize: 0,
          riskLevel: 'HIGH',
          expectedReturn: 0,
          reason: 'Yüksek risk skoru'
        };
      }

      // 5. Pozisyon boyutu hesaplama
      const positionParams: PositionSizingParams = {
        symbol: analysis.symbol,
        accountBalance: 10000, // Başlangıç bakiyesi
        riskPerTrade: this.config.maxRiskPerTrade,
        entryPrice: (signal as any).entryPrice || 0,
        stopLossPrice: (signal as any).stopLoss || 0,
        takeProfitPrice: (signal as any).takeProfit || 0,
        volatility: (analysis as any).volatility || 0.3,
        marketRegime: 'TRENDING',
        confidence: signal.confidence,
        liquidity: 1000000,
        maxPositionSize: 1000,
        correlationRisk: 0.5
      };

      const sizingResult = await this.positionSizer.calculatePositionSize(positionParams);
      
      // 6. Beklenen getiri hesaplama
      const expectedReturn = this.calculateExpectedReturn(signal, analysis);
      
      // 7. Risk seviyesi belirleme
      const riskLevel = this.determineRiskLevel(signal, analysis, sizingResult);

      return {
        shouldTrade: true,
        positionSize: sizingResult.recommendedSizeUSD,
        riskLevel,
        expectedReturn,
        reason: 'Güvenli fırsat tespit edildi'
      };

    } catch (error) {
      logger.error('❌ Error analyzing opportunity:', error);
      return {
        shouldTrade: false,
        positionSize: 0,
        riskLevel: 'HIGH',
        expectedReturn: 0,
        reason: 'Analiz hatası'
      };
    }
  }

  private calculateExpectedReturn(signal: TradingSignal, analysis: MarketAnalysis): number {
    // Gerçekçi getiri hesaplama
    const baseReturn = 0.02; // %2 temel getiri
    const confidenceMultiplier = signal.confidence / 100;
    const strengthMultiplier = signal.strength === 'STRONG' ? 1.5 : 
                              signal.strength === 'MEDIUM' ? 1.0 : 0.5;
    
    return baseReturn * confidenceMultiplier * strengthMultiplier;
  }

  private determineRiskLevel(signal: TradingSignal, analysis: MarketAnalysis, sizingResult: any): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (analysis.riskScore < 0.3 && signal.confidence > 80) return 'LOW';
    if (analysis.riskScore < 0.5 && signal.confidence > 70) return 'MEDIUM';
    return 'HIGH';
  }

  async updateDailyPnL(pnl: number): Promise<void> {
    this.dailyPnL += pnl;
    logger.info(`📊 Günlük P&L güncellendi: ${this.dailyPnL.toFixed(2)}`);
  }

  async resetDaily(): Promise<void> {
    this.dailyPnL = 0;
    this.activePositions = 0;
    logger.info('🔄 Günlük metrikler sıfırlandı');
  }

  getDailyStatus(): {
    dailyPnL: number;
    activePositions: number;
    maxDailyLoss: number;
    targetAchieved: boolean;
  } {
    return {
      dailyPnL: this.dailyPnL,
      activePositions: this.activePositions,
      maxDailyLoss: this.maxDailyLoss,
      targetAchieved: this.dailyPnL >= this.config.dailyTarget
    };
  }
}
