import { logger } from '../utils/logger';
import { SafeDailyGrowthStrategy, SafeGrowthConfig } from './safe-daily-growth';
import { ArbitrageOpportunityFinder, ArbitrageOpportunity } from './arbitrage-opportunity-finder';
import { TradingSignal, MarketAnalysis } from '../services/ai-engine';

export interface DailyProfitConfig {
  startingCapital: number;
  dailyTarget: number; // %2-5
  maxRiskPerTrade: number; // %0.5-1
  maxDailyLoss: number; // %2-3
  arbitrageEnabled: boolean;
  tradingEnabled: boolean;
  diversificationRequired: boolean;
}

export interface DailyProfitResult {
  date: string;
  startingBalance: number;
  endingBalance: number;
  dailyReturn: number;
  totalReturn: number;
  tradesExecuted: number;
  arbitrageExecuted: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  targetAchieved: boolean;
  recommendations: string[];
}

export class DailyProfitOptimizer {
  private config: DailyProfitConfig;
  private safeGrowthStrategy: SafeDailyGrowthStrategy;
  private arbitrageFinder: ArbitrageOpportunityFinder;
  private dailyResults: DailyProfitResult[] = [];
  private currentBalance: number;
  private totalTrades: number = 0;
  private totalArbitrage: number = 0;

  constructor(config: DailyProfitConfig) {
    this.config = config;
    this.currentBalance = config.startingCapital;
    
    const safeConfig: SafeGrowthConfig = {
      dailyTarget: config.dailyTarget,
      maxRiskPerTrade: config.maxRiskPerTrade,
      maxDailyLoss: config.maxDailyLoss,
      maxPositions: 10,
      minConfidence: 70,
      diversification: config.diversificationRequired
    };

    this.safeGrowthStrategy = new SafeDailyGrowthStrategy(safeConfig);
    this.arbitrageFinder = new ArbitrageOpportunityFinder();
  }

  async initialize(): Promise<void> {
    logger.info('🚀 Initializing Daily Profit Optimizer...');
    
    await this.safeGrowthStrategy.initialize();
    await this.arbitrageFinder.initialize();
    
    logger.info('✅ Daily Profit Optimizer initialized');
  }

  async executeDailyStrategy(): Promise<DailyProfitResult> {
    const startTime = new Date();
    const startingBalance = this.currentBalance;
    let endingBalance = startingBalance;
    let tradesExecuted = 0;
    let arbitrageExecuted = 0;
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    const recommendations: string[] = [];

    try {
      logger.info(`📊 Starting daily strategy with ${startingBalance.toFixed(2)} USD`);

      // 1. Arbitraj fırsatlarını tara
      if (this.config.arbitrageEnabled) {
        const arbitrageResults = await this.executeArbitrageStrategy();
        arbitrageExecuted = arbitrageResults.length;
        endingBalance += arbitrageResults.reduce((sum, result) => sum + result.actualProfit, 0);
        
        if (arbitrageExecuted > 0) {
          recommendations.push(`✅ ${arbitrageExecuted} arbitraj fırsatı değerlendirildi`);
        }
      }

      // 2. Trading sinyallerini değerlendir
      if (this.config.tradingEnabled) {
        const tradingResults = await this.executeTradingStrategy();
        tradesExecuted = tradingResults.length;
        
        for (const result of tradingResults) {
          if (result.success) {
            endingBalance += result.profit;
          } else {
            endingBalance -= result.loss;
          }
        }

        if (tradesExecuted > 0) {
          recommendations.push(`📈 ${tradesExecuted} trading işlemi gerçekleştirildi`);
        }
      }

      // 3. Risk seviyesini belirle
      riskLevel = this.calculateRiskLevel(startingBalance, endingBalance, tradesExecuted);

      // 4. Günlük sonuçları hesapla
      const dailyReturn = ((endingBalance - startingBalance) / startingBalance) * 100;
      const totalReturn = ((endingBalance - this.config.startingCapital) / this.config.startingCapital) * 100;
      const targetAchieved = dailyReturn >= this.config.dailyTarget;

      // 5. Öneriler oluştur
      this.generateRecommendations(dailyReturn, targetAchieved, recommendations);

      const result: DailyProfitResult = {
        date: startTime.toISOString().split('T')[0],
        startingBalance,
        endingBalance,
        dailyReturn,
        totalReturn,
        tradesExecuted,
        arbitrageExecuted,
        riskLevel,
        targetAchieved,
        recommendations
      };

      this.dailyResults.push(result);
      this.currentBalance = endingBalance;
      this.totalTrades += tradesExecuted;
      this.totalArbitrage += arbitrageExecuted;

      logger.info(`✅ Daily strategy completed: ${dailyReturn.toFixed(2)}% return`);
      return result;

    } catch (error) {
      logger.error('❌ Error executing daily strategy:', error);
      
      return {
        date: startTime.toISOString().split('T')[0],
        startingBalance,
        endingBalance,
        dailyReturn: 0,
        totalReturn: 0,
        tradesExecuted: 0,
        arbitrageExecuted: 0,
        riskLevel: 'HIGH',
        targetAchieved: false,
        recommendations: ['❌ Günlük strateji hatası']
      };
    }
  }

  private async executeArbitrageStrategy(): Promise<Array<{ actualProfit: number }>> {
    try {
      const opportunities = await this.arbitrageFinder.scanOpportunities();
      const results = [];

      for (const opportunity of opportunities.slice(0, 3)) { // En fazla 3 arbitraj
        const result = await this.arbitrageFinder.executeArbitrage(opportunity);
        if (result.success) {
          results.push({ actualProfit: result.actualProfit });
        }
      }

      return results;
    } catch (error) {
      logger.error('❌ Error executing arbitrage strategy:', error);
      return [];
    }
  }

  private async executeTradingStrategy(): Promise<Array<{ success: boolean; profit: number; loss: number }>> {
    // Mock trading signals - gerçek sistemde AI engine'den gelecek
    const mockSignals = [
      { confidence: 85, strength: 'STRONG', type: 'LONG' },
      { confidence: 75, strength: 'MEDIUM', type: 'SHORT' },
      { confidence: 80, strength: 'STRONG', type: 'LONG' }
    ];

    const results = [];

    for (const signal of mockSignals) {
      // Mock trading execution
      const success = Math.random() > 0.2; // %80 başarı oranı
      const profit = success ? Math.random() * 50 + 10 : 0; // $10-60 kar
      const loss = !success ? Math.random() * 30 + 5 : 0; // $5-35 kayıp

      results.push({ success, profit, loss });
    }

    return results;
  }

  private calculateRiskLevel(startingBalance: number, endingBalance: number, tradesExecuted: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    const dailyReturn = ((endingBalance - startingBalance) / startingBalance) * 100;
    
    if (dailyReturn >= 0 && dailyReturn <= 3 && tradesExecuted <= 5) return 'LOW';
    if (dailyReturn >= -2 && dailyReturn <= 5 && tradesExecuted <= 10) return 'MEDIUM';
    return 'HIGH';
  }

  private generateRecommendations(dailyReturn: number, targetAchieved: boolean, recommendations: string[]): void {
    if (targetAchieved) {
      recommendations.push('🎯 Günlük hedef başarıyla ulaşıldı!');
    } else {
      recommendations.push('⚠️ Günlük hedefe ulaşılamadı, risk yönetimini gözden geçirin');
    }

    if (dailyReturn > 5) {
      recommendations.push('🚨 Yüksek getiri! Risk seviyesini kontrol edin');
    }

    if (dailyReturn < -2) {
      recommendations.push('🛑 Günlük kayıp limiti yaklaşıyor, pozisyonları küçültün');
    }
  }

  getPerformanceStats(): {
    totalDays: number;
    successfulDays: number;
    averageDailyReturn: number;
    totalReturn: number;
    bestDay: number;
    worstDay: number;
    totalTrades: number;
    totalArbitrage: number;
  } {
    if (this.dailyResults.length === 0) {
      return {
        totalDays: 0,
        successfulDays: 0,
        averageDailyReturn: 0,
        totalReturn: 0,
        bestDay: 0,
        worstDay: 0,
        totalTrades: 0,
        totalArbitrage: 0
      };
    }

    const successfulDays = this.dailyResults.filter(r => r.targetAchieved).length;
    const averageDailyReturn = this.dailyResults.reduce((sum, r) => sum + r.dailyReturn, 0) / this.dailyResults.length;
    const bestDay = Math.max(...this.dailyResults.map(r => r.dailyReturn));
    const worstDay = Math.min(...this.dailyResults.map(r => r.dailyReturn));

    return {
      totalDays: this.dailyResults.length,
      successfulDays,
      averageDailyReturn,
      totalReturn: this.dailyResults[this.dailyResults.length - 1]?.totalReturn || 0,
      bestDay,
      worstDay,
      totalTrades: this.totalTrades,
      totalArbitrage: this.totalArbitrage
    };
  }

  getDailyResults(): DailyProfitResult[] {
    return this.dailyResults;
  }
}
