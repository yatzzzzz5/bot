import { logger } from '../utils/logger';

export interface CompoundInterestConfig {
  startingCapital: number;
  dailyTarget: number; // %1-3
  maxDailyLoss: number; // %2-5
  compoundFrequency: 'DAILY' | 'HOURLY' | 'CONTINUOUS';
  positionSizingMethod: 'KELLY' | 'FIXED' | 'VOLATILITY_BASED' | 'MARTINGALE';
  maxPositionSize: number; // %10-25 of capital
  minPositionSize: number; // %1-5 of capital
  riskFreeRate: number; // %0.1-0.5
  targetVolatility: number; // %1-5
  maxDrawdown: number; // %10-20
  profitTakingLevels: number[]; // [0.5, 1, 2, 5] % profit levels
  stopLossLevels: number[]; // [0.5, 1, 2] % loss levels
}

export interface PositionSizingResult {
  symbol: string;
  recommendedSize: number;
  sizePercent: number;
  expectedReturn: number;
  expectedRisk: number;
  sharpeRatio: number;
  kellyFraction: number;
  maxDrawdown: number;
  confidence: number;
  reason: string;
}

export interface CompoundInterestResult {
  date: string;
  startingBalance: number;
  endingBalance: number;
  dailyReturn: number;
  cumulativeReturn: number;
  trades: number;
  profits: number;
  losses: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  compoundFactor: number;
  targetAchieved: boolean;
  recommendations: string[];
}

export interface ProfitTakingRule {
  level: number; // % profit
  action: 'SELL_PERCENTAGE' | 'SELL_ALL' | 'TRAILING_STOP';
  percentage: number; // % of position to sell
  trailingDistance: number; // % for trailing stop
  enabled: boolean;
}

export interface StopLossRule {
  level: number; // % loss
  action: 'SELL_PERCENTAGE' | 'SELL_ALL' | 'HEDGE';
  percentage: number; // % of position to sell
  enabled: boolean;
}

export class CompoundInterestOptimizer {
  private config: CompoundInterestConfig;
  private currentBalance: number;
  private dailyResults: CompoundInterestResult[] = [];
  private profitTakingRules: ProfitTakingRule[] = [];
  private stopLossRules: StopLossRule[] = [];
  private activePositions: Map<string, any> = new Map();
  private performanceMetrics: {
    totalTrades: number;
    totalProfits: number;
    totalLosses: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
    compoundFactor: number;
  } = {
    totalTrades: 0,
    totalProfits: 0,
    totalLosses: 0,
    winRate: 0,
    averageWin: 0,
    averageLoss: 0,
    profitFactor: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    compoundFactor: 1
  };

  constructor(config: CompoundInterestConfig) {
    this.config = config;
    this.currentBalance = config.startingCapital;
    this.initializeRules();
  }

  async initialize(): Promise<void> {
    logger.info('🚀 Initializing Compound Interest Optimizer...');
    logger.info(`Starting capital: ${this.config.startingCapital} USD`);
    logger.info(`Daily target: ${this.config.dailyTarget}%`);
    logger.info(`Max daily loss: ${this.config.maxDailyLoss}%`);
    logger.info('✅ Compound Interest Optimizer initialized');
  }

  // Calculate optimal position size using Kelly Criterion
  calculateKellyPositionSize(symbol: string, winRate: number, averageWin: number, averageLoss: number): PositionSizingResult {
    const kellyFraction = (winRate * averageWin - (1 - winRate) * averageLoss) / averageWin;
    const adjustedKelly = Math.max(0, Math.min(kellyFraction, this.config.maxPositionSize / 100));
    
    const recommendedSize = this.currentBalance * adjustedKelly;
    const sizePercent = (recommendedSize / this.currentBalance) * 100;
    
    const expectedReturn = winRate * averageWin - (1 - winRate) * averageLoss;
    const expectedRisk = Math.sqrt(winRate * Math.pow(averageWin, 2) + (1 - winRate) * Math.pow(averageLoss, 2));
    const sharpeRatio = expectedReturn / expectedRisk;
    
    return {
      symbol,
      recommendedSize,
      sizePercent,
      expectedReturn,
      expectedRisk,
      sharpeRatio,
      kellyFraction: adjustedKelly,
      maxDrawdown: expectedRisk * 2,
      confidence: winRate * 100,
      reason: `Kelly Criterion: ${adjustedKelly.toFixed(3)} fraction`
    };
  }

  // Calculate volatility-based position size
  calculateVolatilityPositionSize(symbol: string, volatility: number, expectedReturn: number): PositionSizingResult {
    const targetVolatility = this.config.targetVolatility / 100;
    const positionSize = (targetVolatility / volatility) * this.currentBalance;
    const adjustedSize = Math.max(
      this.currentBalance * (this.config.minPositionSize / 100),
      Math.min(positionSize, this.currentBalance * (this.config.maxPositionSize / 100))
    );
    
    const sizePercent = (adjustedSize / this.currentBalance) * 100;
    const expectedRisk = volatility * adjustedSize;
    const sharpeRatio = expectedReturn / volatility;
    
    return {
      symbol,
      recommendedSize: adjustedSize,
      sizePercent,
      expectedReturn,
      expectedRisk,
      sharpeRatio,
      kellyFraction: sizePercent / 100,
      maxDrawdown: volatility * 2,
      confidence: Math.min(95, 70 + (expectedReturn / volatility) * 10),
      reason: `Volatility-based: ${volatility.toFixed(3)} volatility`
    };
  }

  // Calculate fixed position size
  calculateFixedPositionSize(symbol: string, fixedPercent: number): PositionSizingResult {
    const recommendedSize = this.currentBalance * (fixedPercent / 100);
    const sizePercent = fixedPercent;
    
    return {
      symbol,
      recommendedSize,
      sizePercent,
      expectedReturn: 0,
      expectedRisk: 0,
      sharpeRatio: 0,
      kellyFraction: fixedPercent / 100,
      maxDrawdown: 0,
      confidence: 50,
      reason: `Fixed size: ${fixedPercent}% of capital`
    };
  }

  // Execute compound interest strategy
  async executeCompoundStrategy(): Promise<CompoundInterestResult> {
    const startTime = new Date();
    const startingBalance = this.currentBalance;
    let endingBalance = startingBalance;
    let trades = 0;
    let profits = 0;
    let losses = 0;
    const recommendations: string[] = [];

    try {
      logger.info(`📊 Starting compound strategy with ${startingBalance.toFixed(2)} USD`);

      // 1. Scan for opportunities
      const opportunities = await this.scanOpportunities();
      
      // 2. Calculate position sizes
      const positionSizes = this.calculatePositionSizes(opportunities);
      
      // 3. Execute trades
      for (const position of positionSizes) {
        if (position.recommendedSize > 0) {
          const tradeResult = await this.executeTrade(position);
          
          if (tradeResult.success) {
            trades++;
            if (tradeResult.profit > 0) {
              profits++;
              endingBalance += tradeResult.profit;
            } else {
              losses++;
              endingBalance += tradeResult.profit; // profit is negative for losses
            }
          }
        }
      }

      // 4. Apply compound interest
      if (this.config.compoundFrequency === 'DAILY') {
        endingBalance = this.applyDailyCompound(endingBalance);
      } else if (this.config.compoundFrequency === 'HOURLY') {
        endingBalance = this.applyHourlyCompound(endingBalance);
      } else if (this.config.compoundFrequency === 'CONTINUOUS') {
        endingBalance = this.applyContinuousCompound(endingBalance);
      }

      // 5. Apply profit taking rules
      const profitTakingResult = this.applyProfitTakingRules(endingBalance);
      endingBalance = profitTakingResult.newBalance;
      recommendations.push(...profitTakingResult.recommendations);

      // 6. Apply stop loss rules
      const stopLossResult = this.applyStopLossRules(endingBalance);
      endingBalance = stopLossResult.newBalance;
      recommendations.push(...stopLossResult.recommendations);

      // 7. Calculate metrics
      const dailyReturn = ((endingBalance - startingBalance) / startingBalance) * 100;
      const cumulativeReturn = ((endingBalance - this.config.startingCapital) / this.config.startingCapital) * 100;
      const winRate = trades > 0 ? (profits / trades) * 100 : 0;
      const sharpeRatio = this.calculateSharpeRatio();
      const maxDrawdown = this.calculateMaxDrawdown();
      const compoundFactor = endingBalance / this.config.startingCapital;
      const targetAchieved = dailyReturn >= this.config.dailyTarget;

      // 8. Update performance metrics
      this.updatePerformanceMetrics(trades, profits, losses, endingBalance - startingBalance);

      // 9. Generate recommendations
      this.generateRecommendations(dailyReturn, targetAchieved, recommendations);

      const result: CompoundInterestResult = {
        date: startTime.toISOString().split('T')[0],
        startingBalance,
        endingBalance,
        dailyReturn,
        cumulativeReturn,
        trades,
        profits,
        losses,
        winRate,
        sharpeRatio,
        maxDrawdown,
        compoundFactor,
        targetAchieved,
        recommendations
      };

      this.dailyResults.push(result);
      this.currentBalance = endingBalance;

      logger.info(`✅ Compound strategy completed: ${dailyReturn.toFixed(2)}% daily return`);
      logger.info(`Total balance: ${endingBalance.toFixed(2)} USD`);
      logger.info(`Compound factor: ${compoundFactor.toFixed(2)}x`);

      return result;

    } catch (error) {
      logger.error('❌ Compound strategy failed:', error);
      
      return {
        date: startTime.toISOString().split('T')[0],
        startingBalance,
        endingBalance: startingBalance,
        dailyReturn: 0,
        cumulativeReturn: 0,
        trades: 0,
        profits: 0,
        losses: 0,
        winRate: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        compoundFactor: 1,
        targetAchieved: false,
        recommendations: ['Strategy execution failed']
      };
    }
  }

  // Get performance metrics
  getPerformanceMetrics(): {
    totalTrades: number;
    totalProfits: number;
    totalLosses: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
    compoundFactor: number;
    currentBalance: number;
    totalReturn: number;
  } {
    const totalReturn = ((this.currentBalance - this.config.startingCapital) / this.config.startingCapital) * 100;
    
    return {
      ...this.performanceMetrics,
      currentBalance: this.currentBalance,
      totalReturn
    };
  }

  // Get daily results
  getDailyResults(): CompoundInterestResult[] {
    return this.dailyResults;
  }

  // Get compound interest projection
  getCompoundProjection(days: number): {
    projectedBalance: number;
    projectedReturn: number;
    dailyReturns: number[];
    cumulativeReturns: number[];
  } {
    const dailyReturns: number[] = [];
    const cumulativeReturns: number[] = [];
    let projectedBalance = this.currentBalance;
    
    for (let day = 1; day <= days; day++) {
      const dailyReturn = this.config.dailyTarget / 100;
      projectedBalance *= (1 + dailyReturn);
      
      dailyReturns.push(dailyReturn * 100);
      cumulativeReturns.push(((projectedBalance - this.config.startingCapital) / this.config.startingCapital) * 100);
    }
    
    const projectedReturn = ((projectedBalance - this.config.startingCapital) / this.config.startingCapital) * 100;
    
    return {
      projectedBalance,
      projectedReturn,
      dailyReturns,
      cumulativeReturns
    };
  }

  // Helper methods
  private initializeRules(): void {
    // Initialize profit taking rules
    this.profitTakingRules = this.config.profitTakingLevels.map(level => ({
      level,
      action: 'SELL_PERCENTAGE' as const,
      percentage: 25, // Sell 25% at each level
      trailingDistance: 0.5,
      enabled: true
    }));

    // Initialize stop loss rules
    this.stopLossRules = this.config.stopLossLevels.map(level => ({
      level: -level, // Negative for losses
      action: 'SELL_PERCENTAGE' as const,
      percentage: 50, // Sell 50% at each level
      enabled: true
    }));
  }

  private async scanOpportunities(): Promise<any[]> {
    // Implementation for scanning opportunities
    return [
      { symbol: 'BTC', expectedReturn: 0.02, volatility: 0.03, confidence: 80 },
      { symbol: 'ETH', expectedReturn: 0.015, volatility: 0.04, confidence: 75 },
      { symbol: 'BNB', expectedReturn: 0.01, volatility: 0.02, confidence: 70 }
    ];
  }

  private calculatePositionSizes(opportunities: any[]): PositionSizingResult[] {
    const positionSizes: PositionSizingResult[] = [];
    
    for (const opportunity of opportunities) {
      let positionSize: PositionSizingResult;
      
      switch (this.config.positionSizingMethod) {
        case 'KELLY':
          positionSize = this.calculateKellyPositionSize(
            opportunity.symbol,
            opportunity.confidence / 100,
            opportunity.expectedReturn,
            opportunity.volatility
          );
          break;
        case 'VOLATILITY_BASED':
          positionSize = this.calculateVolatilityPositionSize(
            opportunity.symbol,
            opportunity.volatility,
            opportunity.expectedReturn
          );
          break;
        case 'FIXED':
          positionSize = this.calculateFixedPositionSize(
            opportunity.symbol,
            this.config.maxPositionSize
          );
          break;
        default:
          positionSize = this.calculateFixedPositionSize(
            opportunity.symbol,
            this.config.maxPositionSize
          );
      }
      
      positionSizes.push(positionSize);
    }
    
    return positionSizes;
  }

  private async executeTrade(position: PositionSizingResult): Promise<{
    success: boolean;
    profit: number;
    error?: string;
  }> {
    // Implementation for executing trades
    const success = Math.random() > 0.3; // 70% success rate
    const profit = success ? position.recommendedSize * 0.01 : -position.recommendedSize * 0.005;
    
    return {
      success,
      profit,
      error: success ? undefined : 'Trade failed'
    };
  }

  private applyDailyCompound(balance: number): number {
    return balance * (1 + this.config.dailyTarget / 100);
  }

  private applyHourlyCompound(balance: number): number {
    const hourlyRate = this.config.dailyTarget / 24 / 100;
    return balance * Math.pow(1 + hourlyRate, 24);
  }

  private applyContinuousCompound(balance: number): number {
    const rate = this.config.dailyTarget / 100;
    return balance * Math.exp(rate);
  }

  private applyProfitTakingRules(balance: number): {
    newBalance: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let newBalance = balance;
    
    for (const rule of this.profitTakingRules) {
      if (rule.enabled) {
        const profitPercent = ((balance - this.config.startingCapital) / this.config.startingCapital) * 100;
        
        if (profitPercent >= rule.level) {
          const sellAmount = balance * (rule.percentage / 100);
          newBalance -= sellAmount;
          recommendations.push(`Profit taking: Sold ${rule.percentage}% at ${profitPercent.toFixed(2)}% profit`);
        }
      }
    }
    
    return { newBalance, recommendations };
  }

  private applyStopLossRules(balance: number): {
    newBalance: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let newBalance = balance;
    
    for (const rule of this.stopLossRules) {
      if (rule.enabled) {
        const lossPercent = ((balance - this.config.startingCapital) / this.config.startingCapital) * 100;
        
        if (lossPercent <= rule.level) {
          const sellAmount = balance * (rule.percentage / 100);
          newBalance -= sellAmount;
          recommendations.push(`Stop loss: Sold ${rule.percentage}% at ${lossPercent.toFixed(2)}% loss`);
        }
      }
    }
    
    return { newBalance, recommendations };
  }

  private calculateSharpeRatio(): number {
    if (this.dailyResults.length < 2) return 0;
    
    const returns = this.dailyResults.map(r => r.dailyReturn);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  private calculateMaxDrawdown(): number {
    if (this.dailyResults.length < 2) return 0;
    
    let maxDrawdown = 0;
    let peak = this.dailyResults[0].endingBalance;
    
    for (const result of this.dailyResults) {
      if (result.endingBalance > peak) {
        peak = result.endingBalance;
      }
      
      const drawdown = ((peak - result.endingBalance) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return maxDrawdown;
  }

  private updatePerformanceMetrics(trades: number, profits: number, losses: number, netProfit: number): void {
    this.performanceMetrics.totalTrades += trades;
    this.performanceMetrics.totalProfits += profits;
    this.performanceMetrics.totalLosses += losses;
    
    if (this.performanceMetrics.totalTrades > 0) {
      this.performanceMetrics.winRate = (this.performanceMetrics.totalProfits / this.performanceMetrics.totalTrades) * 100;
    }
    
    if (this.performanceMetrics.totalProfits > 0) {
      this.performanceMetrics.averageWin = netProfit / this.performanceMetrics.totalProfits;
    }
    
    if (this.performanceMetrics.totalLosses > 0) {
      this.performanceMetrics.averageLoss = Math.abs(netProfit) / this.performanceMetrics.totalLosses;
    }
    
    this.performanceMetrics.profitFactor = this.performanceMetrics.totalProfits / Math.abs(this.performanceMetrics.totalLosses);
    this.performanceMetrics.sharpeRatio = this.calculateSharpeRatio();
    this.performanceMetrics.maxDrawdown = this.calculateMaxDrawdown();
    this.performanceMetrics.compoundFactor = this.currentBalance / this.config.startingCapital;
  }

  private generateRecommendations(dailyReturn: number, targetAchieved: boolean, existingRecommendations: string[]): void {
    if (targetAchieved) {
      existingRecommendations.push('✅ Daily target achieved!');
    } else {
      existingRecommendations.push('⚠️ Daily target not achieved, consider adjusting strategy');
    }
    
    if (dailyReturn < 0) {
      existingRecommendations.push('⚠️ Negative daily return, review risk management');
    }
    
    if (this.performanceMetrics.winRate < 50) {
      existingRecommendations.push('⚠️ Low win rate, consider improving signal quality');
    }
    
    if (this.performanceMetrics.maxDrawdown > this.config.maxDrawdown) {
      existingRecommendations.push('⚠️ Max drawdown exceeded, reduce position sizes');
    }
  }
}
