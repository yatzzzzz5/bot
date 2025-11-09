import { logger } from '../utils/logger';

export interface ProfitTakingConfig {
  enabled: boolean;
  strategies: ProfitTakingStrategy[];
  maxPositions: number;
  minProfitPercent: number; // %0.1 minimum
  maxProfitPercent: number; // %5 maximum
  trailingStopEnabled: boolean;
  partialProfitEnabled: boolean;
  compoundProfitEnabled: boolean;
}

export interface ProfitTakingStrategy {
  name: string;
  type: 'FIXED_PERCENTAGE' | 'TRAILING_STOP' | 'TIME_BASED' | 'VOLATILITY_BASED' | 'MOMENTUM_BASED';
  enabled: boolean;
  parameters: any;
  priority: number; // 1-10, higher = more priority
}

export interface ProfitTakingRule {
  id: string;
  symbol: string;
  strategy: string;
  entryPrice: number;
  currentPrice: number;
  profitPercent: number;
  targetPrice: number;
  stopPrice: number;
  positionSize: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfitTakingSignal {
  ruleId: string;
  symbol: string;
  action: 'SELL_PARTIAL' | 'SELL_ALL' | 'TRAILING_STOP' | 'TAKE_PROFIT';
  percentage: number; // % of position to sell
  price: number;
  reason: string;
  confidence: number;
  expectedProfit: number;
  risk: number;
}

export interface ProfitTakingResult {
  ruleId: string;
  symbol: string;
  action: string;
  executed: boolean;
  profit: number;
  profitPercent: number;
  fees: number;
  netProfit: number;
  timestamp: Date;
  error?: string;
}

export class AutomatedProfitTaking {
  private config: ProfitTakingConfig;
  private activeRules: Map<string, ProfitTakingRule> = new Map();
  private profitTakingHistory: ProfitTakingResult[] = [];
  private dailyStats: {
    totalSignals: number;
    executedSignals: number;
    totalProfit: number;
    totalFees: number;
    netProfit: number;
    successRate: number;
    averageProfit: number;
  } = {
    totalSignals: 0,
    executedSignals: 0,
    totalProfit: 0,
    totalFees: 0,
    netProfit: 0,
    successRate: 0,
    averageProfit: 0
  };

  constructor(config: ProfitTakingConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    logger.info('🚀 Initializing Automated Profit Taking...');
    logger.info(`Enabled: ${this.config.enabled}`);
    logger.info(`Strategies: ${this.config.strategies.length}`);
    logger.info(`Max positions: ${this.config.maxPositions}`);
    logger.info('✅ Automated Profit Taking initialized');
  }

  // Create profit taking rule
  async createProfitTakingRule(symbol: string, entryPrice: number, positionSize: number, strategy: string): Promise<string> {
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const rule: ProfitTakingRule = {
      id: ruleId,
      symbol,
      strategy,
      entryPrice,
      currentPrice: entryPrice,
      profitPercent: 0,
      targetPrice: this.calculateTargetPrice(entryPrice, strategy),
      stopPrice: this.calculateStopPrice(entryPrice, strategy),
      positionSize,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.activeRules.set(ruleId, rule);
    
    logger.info(`📋 Created profit taking rule for ${symbol}: ${strategy}`);
    
    return ruleId;
  }

  // Update profit taking rule
  async updateProfitTakingRule(ruleId: string, updates: Partial<ProfitTakingRule>): Promise<boolean> {
    const rule = this.activeRules.get(ruleId);
    
    if (!rule) {
      logger.error(`Rule not found: ${ruleId}`);
      return false;
    }
    
    const updatedRule = { ...rule, ...updates, updatedAt: new Date() };
    this.activeRules.set(ruleId, updatedRule);
    
    logger.info(`📝 Updated profit taking rule: ${ruleId}`);
    
    return true;
  }

  // Delete profit taking rule
  async deleteProfitTakingRule(ruleId: string): Promise<boolean> {
    const deleted = this.activeRules.delete(ruleId);
    
    if (deleted) {
      logger.info(`🗑️ Deleted profit taking rule: ${ruleId}`);
    } else {
      logger.error(`Rule not found: ${ruleId}`);
    }
    
    return deleted;
  }

  // Scan for profit taking opportunities
  async scanProfitTakingOpportunities(): Promise<ProfitTakingSignal[]> {
    const signals: ProfitTakingSignal[] = [];
    
    if (!this.config.enabled) {
      return signals;
    }
    
    for (const [ruleId, rule] of this.activeRules) {
      if (!rule.enabled) continue;
      
      try {
        // Update current price
        const currentPrice = await this.getCurrentPrice(rule.symbol);
        const profitPercent = ((currentPrice - rule.entryPrice) / rule.entryPrice) * 100;
        
        // Update rule with current data
        rule.currentPrice = currentPrice;
        rule.profitPercent = profitPercent;
        rule.updatedAt = new Date();
        
        // Check if profit taking conditions are met
        const signal = await this.checkProfitTakingConditions(rule);
        
        if (signal) {
          signals.push(signal);
        }
        
      } catch (error) {
        logger.error(`Error scanning rule ${ruleId}:`, error);
      }
    }
    
    // Sort by priority and confidence
    return signals.sort((a, b) => {
      const aStrategy = this.config.strategies.find(s => s.name === a.reason);
      const bStrategy = this.config.strategies.find(s => s.name === b.reason);
      const aPriority = aStrategy?.priority || 0;
      const bPriority = bStrategy?.priority || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return b.confidence - a.confidence;
    });
  }

  // Execute profit taking signals
  async executeProfitTakingSignals(signals: ProfitTakingSignal[]): Promise<ProfitTakingResult[]> {
    const results: ProfitTakingResult[] = [];
    
    for (const signal of signals) {
      try {
        const result = await this.executeProfitTakingSignal(signal);
        results.push(result);
        
        // Update daily stats
        this.updateDailyStats(result);
        
      } catch (error) {
        logger.error(`Error executing signal ${signal.ruleId}:`, error);
        
        results.push({
          ruleId: signal.ruleId,
          symbol: signal.symbol,
          action: signal.action,
          executed: false,
          profit: 0,
          profitPercent: 0,
          fees: 0,
          netProfit: 0,
          timestamp: new Date(),
          error: error.message
        });
      }
    }
    
    return results;
  }

  // Get active rules
  getActiveRules(): ProfitTakingRule[] {
    return Array.from(this.activeRules.values());
  }

  // Get profit taking history
  getProfitTakingHistory(): ProfitTakingResult[] {
    return this.profitTakingHistory;
  }

  // Get daily stats
  getDailyStats(): {
    totalSignals: number;
    executedSignals: number;
    totalProfit: number;
    totalFees: number;
    netProfit: number;
    successRate: number;
    averageProfit: number;
  } {
    return this.dailyStats;
  }

  // Get performance metrics
  getPerformanceMetrics(): {
    totalRules: number;
    activeRules: number;
    totalSignals: number;
    executedSignals: number;
    successRate: number;
    totalProfit: number;
    averageProfit: number;
    bestPerformingStrategy: string;
    worstPerformingStrategy: string;
  } {
    const totalRules = this.activeRules.size;
    const activeRules = Array.from(this.activeRules.values()).filter(r => r.enabled).length;
    
    const strategyPerformance = this.calculateStrategyPerformance();
    const bestStrategy = strategyPerformance.reduce((best, current) => 
      current.totalProfit > best.totalProfit ? current : best
    );
    const worstStrategy = strategyPerformance.reduce((worst, current) => 
      current.totalProfit < worst.totalProfit ? current : worst
    );
    
    return {
      totalRules,
      activeRules,
      totalSignals: this.dailyStats.totalSignals,
      executedSignals: this.dailyStats.executedSignals,
      successRate: this.dailyStats.successRate,
      totalProfit: this.dailyStats.totalProfit,
      averageProfit: this.dailyStats.averageProfit,
      bestPerformingStrategy: bestStrategy.strategy,
      worstPerformingStrategy: worstStrategy.strategy
    };
  }

  // Helper methods
  private calculateTargetPrice(entryPrice: number, strategy: string): number {
    const strategyConfig = this.config.strategies.find(s => s.name === strategy);
    
    if (!strategyConfig) {
      return entryPrice * 1.02; // Default 2% target
    }
    
    switch (strategyConfig.type) {
      case 'FIXED_PERCENTAGE':
        return entryPrice * (1 + strategyConfig.parameters.targetPercent / 100);
      case 'TRAILING_STOP':
        return entryPrice * (1 + strategyConfig.parameters.initialTarget / 100);
      case 'TIME_BASED':
        return entryPrice * (1 + strategyConfig.parameters.targetPercent / 100);
      case 'VOLATILITY_BASED':
        return entryPrice * (1 + strategyConfig.parameters.targetPercent / 100);
      case 'MOMENTUM_BASED':
        return entryPrice * (1 + strategyConfig.parameters.targetPercent / 100);
      default:
        return entryPrice * 1.02;
    }
  }

  private calculateStopPrice(entryPrice: number, strategy: string): number {
    const strategyConfig = this.config.strategies.find(s => s.name === strategy);
    
    if (!strategyConfig) {
      return entryPrice * 0.98; // Default 2% stop loss
    }
    
    switch (strategyConfig.type) {
      case 'FIXED_PERCENTAGE':
        return entryPrice * (1 - strategyConfig.parameters.stopLossPercent / 100);
      case 'TRAILING_STOP':
        return entryPrice * (1 - strategyConfig.parameters.stopLossPercent / 100);
      case 'TIME_BASED':
        return entryPrice * (1 - strategyConfig.parameters.stopLossPercent / 100);
      case 'VOLATILITY_BASED':
        return entryPrice * (1 - strategyConfig.parameters.stopLossPercent / 100);
      case 'MOMENTUM_BASED':
        return entryPrice * (1 - strategyConfig.parameters.stopLossPercent / 100);
      default:
        return entryPrice * 0.98;
    }
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    // Implementation for getting current price
    return 50000; // Mock price
  }

  private async checkProfitTakingConditions(rule: ProfitTakingRule): Promise<ProfitTakingSignal | null> {
    const strategyConfig = this.config.strategies.find(s => s.name === rule.strategy);
    
    if (!strategyConfig || !strategyConfig.enabled) {
      return null;
    }
    
    switch (strategyConfig.type) {
      case 'FIXED_PERCENTAGE':
        return this.checkFixedPercentageConditions(rule, strategyConfig);
      case 'TRAILING_STOP':
        return this.checkTrailingStopConditions(rule, strategyConfig);
      case 'TIME_BASED':
        return this.checkTimeBasedConditions(rule, strategyConfig);
      case 'VOLATILITY_BASED':
        return this.checkVolatilityBasedConditions(rule, strategyConfig);
      case 'MOMENTUM_BASED':
        return this.checkMomentumBasedConditions(rule, strategyConfig);
      default:
        return null;
    }
  }

  private checkFixedPercentageConditions(rule: ProfitTakingRule, strategyConfig: any): ProfitTakingSignal | null {
    if (rule.profitPercent >= strategyConfig.parameters.targetPercent) {
      return {
        ruleId: rule.id,
        symbol: rule.symbol,
        action: 'TAKE_PROFIT',
        percentage: strategyConfig.parameters.sellPercentage || 100,
        price: rule.currentPrice,
        reason: strategyConfig.name,
        confidence: 95,
        expectedProfit: rule.positionSize * (rule.profitPercent / 100),
        risk: 0
      };
    }
    
    return null;
  }

  private checkTrailingStopConditions(rule: ProfitTakingRule, strategyConfig: any): ProfitTakingSignal | null {
    const trailingDistance = strategyConfig.parameters.trailingDistance || 1;
    const currentTrailingStop = rule.currentPrice * (1 - trailingDistance / 100);
    
    if (currentTrailingStop > rule.stopPrice) {
      // Update trailing stop
      rule.stopPrice = currentTrailingStop;
      
      return {
        ruleId: rule.id,
        symbol: rule.symbol,
        action: 'TRAILING_STOP',
        percentage: 100,
        price: rule.currentPrice,
        reason: strategyConfig.name,
        confidence: 90,
        expectedProfit: rule.positionSize * (rule.profitPercent / 100),
        risk: 0
      };
    }
    
    return null;
  }

  private checkTimeBasedConditions(rule: ProfitTakingRule, strategyConfig: any): ProfitTakingSignal | null {
    const timeElapsed = Date.now() - rule.createdAt.getTime();
    const maxTime = strategyConfig.parameters.maxTime * 60 * 1000; // Convert minutes to milliseconds
    
    if (timeElapsed >= maxTime && rule.profitPercent > 0) {
      return {
        ruleId: rule.id,
        symbol: rule.symbol,
        action: 'SELL_ALL',
        percentage: 100,
        price: rule.currentPrice,
        reason: strategyConfig.name,
        confidence: 85,
        expectedProfit: rule.positionSize * (rule.profitPercent / 100),
        risk: 0
      };
    }
    
    return null;
  }

  private async checkVolatilityBasedConditions(rule: ProfitTakingRule, strategyConfig: any): Promise<ProfitTakingSignal | null> {
    // Implementation for volatility-based conditions
    const volatility = await this.getVolatility(rule.symbol);
    const targetVolatility = strategyConfig.parameters.targetVolatility || 0.02;
    
    if (volatility >= targetVolatility && rule.profitPercent > 0) {
      return {
        ruleId: rule.id,
        symbol: rule.symbol,
        action: 'SELL_PARTIAL',
        percentage: strategyConfig.parameters.sellPercentage || 50,
        price: rule.currentPrice,
        reason: strategyConfig.name,
        confidence: 80,
        expectedProfit: rule.positionSize * (rule.profitPercent / 100),
        risk: 0
      };
    }
    
    return null;
  }

  private async checkMomentumBasedConditions(rule: ProfitTakingRule, strategyConfig: any): Promise<ProfitTakingSignal | null> {
    // Implementation for momentum-based conditions
    const momentum = await this.getMomentum(rule.symbol);
    const targetMomentum = strategyConfig.parameters.targetMomentum || 0.5;
    
    if (momentum >= targetMomentum && rule.profitPercent > 0) {
      return {
        ruleId: rule.id,
        symbol: rule.symbol,
        action: 'SELL_PARTIAL',
        percentage: strategyConfig.parameters.sellPercentage || 50,
        price: rule.currentPrice,
        reason: strategyConfig.name,
        confidence: 85,
        expectedProfit: rule.positionSize * (rule.profitPercent / 100),
        risk: 0
      };
    }
    
    return null;
  }

  private async executeProfitTakingSignal(signal: ProfitTakingSignal): Promise<ProfitTakingResult> {
    const rule = this.activeRules.get(signal.ruleId);
    
    if (!rule) {
      throw new Error(`Rule not found: ${signal.ruleId}`);
    }
    
    try {
      // Execute the trade
      const tradeResult = await this.executeTrade(
        signal.symbol,
        signal.action,
        signal.price,
        signal.percentage
      );
      
      if (!tradeResult.success) {
        throw new Error(`Trade execution failed: ${tradeResult.error}`);
      }
      
      const profit = rule.positionSize * (signal.percentage / 100) * (rule.profitPercent / 100);
      const fees = tradeResult.fees || 0;
      const netProfit = profit - fees;
      
      const result: ProfitTakingResult = {
        ruleId: signal.ruleId,
        symbol: signal.symbol,
        action: signal.action,
        executed: true,
        profit,
        profitPercent: rule.profitPercent,
        fees,
        netProfit,
        timestamp: new Date()
      };
      
      // Update rule
      rule.positionSize -= rule.positionSize * (signal.percentage / 100);
      rule.updatedAt = new Date();
      
      // Add to history
      this.profitTakingHistory.push(result);
      
      logger.info(`✅ Profit taking executed: ${signal.symbol} - ${signal.action} - ${netProfit.toFixed(2)} USD`);
      
      return result;
      
    } catch (error) {
      logger.error(`❌ Profit taking execution failed:`, error);
      
      return {
        ruleId: signal.ruleId,
        symbol: signal.symbol,
        action: signal.action,
        executed: false,
        profit: 0,
        profitPercent: 0,
        fees: 0,
        netProfit: 0,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  private async executeTrade(symbol: string, action: string, price: number, percentage: number): Promise<{
    success: boolean;
    fees: number;
    error?: string;
  }> {
    // Implementation for executing trades
    return {
      success: true,
      fees: price * percentage * 0.001 // 0.1% fees
    };
  }

  private async getVolatility(symbol: string): Promise<number> {
    // Implementation for getting volatility
    return 0.02; // Mock volatility
  }

  private async getMomentum(symbol: string): Promise<number> {
    // Implementation for getting momentum
    return 0.5; // Mock momentum
  }

  private updateDailyStats(result: ProfitTakingResult): void {
    this.dailyStats.totalSignals++;
    
    if (result.executed) {
      this.dailyStats.executedSignals++;
      this.dailyStats.totalProfit += result.profit;
      this.dailyStats.totalFees += result.fees;
      this.dailyStats.netProfit += result.netProfit;
    }
    
    this.dailyStats.successRate = (this.dailyStats.executedSignals / this.dailyStats.totalSignals) * 100;
    this.dailyStats.averageProfit = this.dailyStats.executedSignals > 0 
      ? this.dailyStats.totalProfit / this.dailyStats.executedSignals 
      : 0;
  }

  private calculateStrategyPerformance(): Array<{
    strategy: string;
    totalProfit: number;
    totalTrades: number;
    successRate: number;
  }> {
    const strategyStats = new Map<string, {
      totalProfit: number;
      totalTrades: number;
      successfulTrades: number;
    }>();
    
    for (const result of this.profitTakingHistory) {
      const rule = this.activeRules.get(result.ruleId);
      if (!rule) continue;
      
      const stats = strategyStats.get(rule.strategy) || {
        totalProfit: 0,
        totalTrades: 0,
        successfulTrades: 0
      };
      
      stats.totalProfit += result.netProfit;
      stats.totalTrades++;
      
      if (result.executed && result.netProfit > 0) {
        stats.successfulTrades++;
      }
      
      strategyStats.set(rule.strategy, stats);
    }
    
    return Array.from(strategyStats.entries()).map(([strategy, stats]) => ({
      strategy,
      totalProfit: stats.totalProfit,
      totalTrades: stats.totalTrades,
      successRate: stats.totalTrades > 0 ? (stats.successfulTrades / stats.totalTrades) * 100 : 0
    }));
  }
}
