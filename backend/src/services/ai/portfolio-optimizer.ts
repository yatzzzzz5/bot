import { logger } from '../../utils/logger';
import { TradingSignal } from '../ai-engine';

export interface PortfolioRecommendation {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  timestamp: Date;
}

export interface PortfolioOptimization {
  recommendations: PortfolioRecommendation[];
  riskScore: number;
  expectedReturn: number;
  timestamp: Date;
}

export interface StrategyAllocation {
  strategy: string;
  allocation: number; // 0-1
  riskContribution: number;
  expectedReturn: number;
  volatility: number;
}

export interface RiskParityResult {
  allocations: StrategyAllocation[];
  totalRisk: number;
  sharpeRatio: number;
  timestamp: Date;
}

export interface RegimePerformance {
  regime: string;
  preset: string;
  totalTrades: number;
  winRate: number;
  avgReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  lastUpdated: Date;
}

export class PortfolioOptimizer {
  private regimePerformance: Map<string, RegimePerformance> = new Map();
  private banditWeights: Map<string, number> = new Map();
  private explorationRate: number = 0.1;
  private learningRate: number = 0.01;

  async initialize(): Promise<void> {
    logger.info('📈 Initializing Portfolio Optimizer...');
    
    // Initialize bandit weights for different preset-regime combinations
    const presets = ['MICRO_SAFE', 'SPEED'];
    const regimes = ['TRENDING', 'RANGING', 'EVENT_DRIVEN', 'UNKNOWN'];
    
    for (const preset of presets) {
      for (const regime of regimes) {
        const key = `${preset}_${regime}`;
        this.banditWeights.set(key, 1.0); // Equal initial weights
      }
    }
    
    logger.info('✅ Portfolio Optimizer initialized');
  }

  // Risk-Parity Allocation Implementation
  async computeRiskParityAllocation(strategies: Array<{
    name: string;
    expectedReturn: number;
    volatility: number;
    correlation?: number;
  }>): Promise<RiskParityResult> {
    try {
      if (strategies.length === 0) {
        return {
          allocations: [],
          totalRisk: 0,
          sharpeRatio: 0,
          timestamp: new Date()
        };
      }

      // Simple risk-parity: equal risk contribution
      const allocations: StrategyAllocation[] = strategies.map(strategy => {
        // Inverse volatility weighting for risk parity
        const riskWeight = 1 / Math.max(0.01, strategy.volatility);
        return {
          strategy: strategy.name,
          allocation: 0,
          riskContribution: 0,
          expectedReturn: strategy.expectedReturn,
          volatility: strategy.volatility
        };
      });

      // Normalize weights to sum to 1
      const totalRiskWeight = allocations.reduce((sum, alloc) => 
        sum + (1 / Math.max(0.01, alloc.volatility)), 0);
      
      allocations.forEach(alloc => {
        alloc.allocation = (1 / Math.max(0.01, alloc.volatility)) / totalRiskWeight;
        alloc.riskContribution = alloc.allocation * alloc.volatility;
      });

      // Calculate portfolio metrics
      const totalRisk = Math.sqrt(allocations.reduce((sum, alloc) => 
        sum + Math.pow(alloc.riskContribution, 2), 0));
      
      const expectedReturn = allocations.reduce((sum, alloc) => 
        sum + alloc.allocation * alloc.expectedReturn, 0);
      
      const sharpeRatio = totalRisk > 0 ? expectedReturn / totalRisk : 0;

      return {
        allocations,
        totalRisk,
        sharpeRatio,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('❌ Risk parity calculation failed:', error);
      return {
        allocations: [],
        totalRisk: 0,
        sharpeRatio: 0,
        timestamp: new Date()
      };
    }
  }

  // Multi-Armed Bandit for Preset Selection
  async selectPresetForRegime(regime: string, availablePresets: string[]): Promise<string> {
    try {
      const regimePresets = availablePresets.map(preset => `${preset}_${regime}`);
      
      // Exploration vs Exploitation
      if (Math.random() < this.explorationRate) {
        // Exploration: random selection
        const randomPreset = availablePresets[Math.floor(Math.random() * availablePresets.length)];
        logger.info(`🎲 Bandit exploration: selected ${randomPreset} for regime ${regime}`);
        return randomPreset;
      } else {
        // Exploitation: select best performing preset
        let bestPreset = availablePresets[0];
        let bestWeight = this.banditWeights.get(`${bestPreset}_${regime}`) || 0;
        
        for (const preset of availablePresets) {
          const weight = this.banditWeights.get(`${preset}_${regime}`) || 0;
          if (weight > bestWeight) {
            bestWeight = weight;
            bestPreset = preset;
          }
        }
        
        logger.info(`🎯 Bandit exploitation: selected ${bestPreset} for regime ${regime} (weight: ${bestWeight.toFixed(3)})`);
        return bestPreset;
      }
    } catch (error) {
      logger.error('❌ Bandit preset selection failed:', error);
      return availablePresets[0] || 'MICRO_SAFE';
    }
  }

  // Update bandit weights based on performance
  updateBanditWeights(preset: string, regime: string, performance: {
    return: number;
    risk: number;
    winRate: number;
  }): void {
    try {
      const key = `${preset}_${regime}`;
      const currentWeight = this.banditWeights.get(key) || 1.0;
      
      // Calculate reward based on Sharpe-like ratio
      const reward = performance.risk > 0 ? 
        (performance.return / performance.risk) * performance.winRate : 0;
      
      // Update weight using exponential moving average
      const newWeight = currentWeight + this.learningRate * (reward - currentWeight);
      this.banditWeights.set(key, Math.max(0.1, newWeight)); // Minimum weight of 0.1
      
      logger.info(`📊 Updated bandit weight for ${key}: ${currentWeight.toFixed(3)} → ${newWeight.toFixed(3)} (reward: ${reward.toFixed(3)})`);
    } catch (error) {
      logger.error('❌ Bandit weight update failed:', error);
    }
  }

  // Track regime performance
  updateRegimePerformance(regime: string, preset: string, tradeResult: {
    pnl: number;
    win: boolean;
    risk: number;
  }): void {
    try {
      const key = `${regime}_${preset}`;
      const current = this.regimePerformance.get(key) || {
        regime,
        preset,
        totalTrades: 0,
        winRate: 0,
        avgReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        lastUpdated: new Date()
      };

      // Update metrics
      current.totalTrades += 1;
      current.winRate = (current.winRate * (current.totalTrades - 1) + (tradeResult.win ? 1 : 0)) / current.totalTrades;
      current.avgReturn = (current.avgReturn * (current.totalTrades - 1) + tradeResult.pnl) / current.totalTrades;
      current.sharpeRatio = tradeResult.risk > 0 ? current.avgReturn / tradeResult.risk : 0;
      current.lastUpdated = new Date();

      this.regimePerformance.set(key, current);

      // Update bandit weights
      this.updateBanditWeights(preset, regime, {
        return: current.avgReturn,
        risk: tradeResult.risk,
        winRate: current.winRate
      });

    } catch (error) {
      logger.error('❌ Regime performance update failed:', error);
    }
  }

  // Get current regime performance
  getRegimePerformance(): RegimePerformance[] {
    return Array.from(this.regimePerformance.values());
  }

  // Get bandit weights
  getBanditWeights(): Record<string, number> {
    const weights: Record<string, number> = {};
    this.banditWeights.forEach((weight, key) => {
      weights[key] = weight;
    });
    return weights;
  }

  // Capital allocation based on regime and performance
  async allocateCapitalByRegime(regime: string, totalCapital: number, availablePresets: string[]): Promise<{
    preset: string;
    allocation: number;
    confidence: number;
  }> {
    try {
      const selectedPreset = await this.selectPresetForRegime(regime, availablePresets);
      const key = `${selectedPreset}_${regime}`;
      const weight = this.banditWeights.get(key) || 1.0;
      
      // Calculate allocation based on bandit weight and regime performance
      const performance = this.regimePerformance.get(key);
      const baseAllocation = 0.5; // 50% base allocation
      const weightMultiplier = Math.min(2.0, weight); // Cap at 2x
      const performanceMultiplier = performance ? 
        Math.min(1.5, 1 + (performance.sharpeRatio * 0.1)) : 1.0;
      
      const allocation = Math.min(0.9, baseAllocation * weightMultiplier * performanceMultiplier);
      const confidence = Math.min(0.95, 0.5 + (weight - 1) * 0.1 + (performance?.winRate || 0.5) * 0.3);

      return {
        preset: selectedPreset,
        allocation: allocation,
        confidence: confidence
      };

    } catch (error) {
      logger.error('❌ Capital allocation failed:', error);
      return {
        preset: availablePresets[0] || 'MICRO_SAFE',
        allocation: 0.5,
        confidence: 0.5
      };
    }
  }

  async optimize(data: {
    symbol: string;
    currentPosition: number;
    signals: TradingSignal[];
    riskScore: number;
  }): Promise<PortfolioRecommendation> {
    return {
      action: 'HOLD',
      confidence: 0,
      timestamp: new Date()
    };
  }

  async optimizePortfolio(portfolio: any): Promise<PortfolioOptimization> {
    return {
      recommendations: [],
      riskScore: 0.5,
      expectedReturn: 0.1,
      timestamp: new Date()
    };
  }
}
