import { logger } from '../../utils/logger';

export interface PositionSizingParams {
  symbol: string;
  accountBalance: number;
  riskPerTrade: number; // Percentage of account balance to risk
  entryPrice: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  volatility: number; // Historical volatility (annualized)
  marketRegime: 'TRENDING' | 'RANGING' | 'EVENT_DRIVEN' | 'UNKNOWN';
  confidence: number; // Signal confidence (0-100)
  liquidity: number; // Available liquidity in USD
  maxPositionSize: number; // Maximum position size in USD
  correlationRisk: number; // Correlation with existing positions
}

export interface PositionSizingResult {
  recommendedSize: number; // Position size in base currency
  recommendedSizeUSD: number; // Position size in USD
  riskAmount: number; // Amount at risk in USD
  riskRewardRatio: number;
  positionValue: number; // Total position value
  leverage: number; // Recommended leverage
  sizingMethod: 'KELLY' | 'FIXED_FRACTIONAL' | 'VOLATILITY_ADJUSTED' | 'CONFIDENCE_WEIGHTED';
  confidence: number;
  warnings: string[];
  adjustments: {
    volatilityAdjustment: number;
    regimeAdjustment: number;
    confidenceAdjustment: number;
    liquidityAdjustment: number;
    correlationAdjustment: number;
  };
}

export interface RiskMetrics {
  portfolioRisk: number; // Total portfolio risk
  maxDrawdown: number; // Maximum expected drawdown
  sharpeRatio: number; // Risk-adjusted return
  var95: number; // Value at Risk (95% confidence)
  expectedReturn: number; // Expected return for the position
  winRate: number; // Historical win rate
  averageWin: number; // Average winning trade
  averageLoss: number; // Average losing trade
}

export class DynamicPositionSizer {
  private riskMetrics: Map<string, RiskMetrics> = new Map();
  private positionHistory: Map<string, any[]> = new Map();
  private volatilityCache: Map<string, number> = new Map();
  private correlationMatrix: Map<string, Map<string, number>> = new Map();
  
  // Risk parameters
  private maxRiskPerTrade: number = 0.02; // 2% max risk per trade
  private maxPortfolioRisk: number = 0.10; // 10% max portfolio risk
  private kellyFraction: number = 0.25; // Maximum Kelly fraction
  private minPositionSize: number = 100; // Minimum position size in USD
  private maxPositionSize: number = 100000; // Maximum position size in USD

  async initialize(): Promise<void> {
    logger.info('📊 Initializing Dynamic Position Sizer...');
    
    // Initialize risk metrics for common symbols
    await this.initializeRiskMetrics();
    
    // Initialize correlation matrix
    await this.initializeCorrelationMatrix();
    
    logger.info('✅ Dynamic Position Sizer initialized');
  }

  private async initializeRiskMetrics(): Promise<void> {
    const commonSymbols = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'DOT', 'MATIC', 'AVAX'];
    
    for (const symbol of commonSymbols) {
      // Simulate risk metrics (in real implementation, load from historical data)
      const metrics: RiskMetrics = {
        portfolioRisk: Math.random() * 0.05 + 0.02, // 2-7%
        maxDrawdown: Math.random() * 0.15 + 0.05, // 5-20%
        sharpeRatio: Math.random() * 1.5 + 0.5, // 0.5-2.0
        var95: Math.random() * 0.08 + 0.02, // 2-10%
        expectedReturn: Math.random() * 0.1 + 0.02, // 2-12%
        winRate: Math.random() * 0.3 + 0.5, // 50-80%
        averageWin: Math.random() * 0.05 + 0.02, // 2-7%
        averageLoss: Math.random() * 0.03 + 0.01 // 1-4%
      };
      
      this.riskMetrics.set(symbol, metrics);
    }
  }

  private async initializeCorrelationMatrix(): Promise<void> {
    const symbols = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'DOT', 'MATIC', 'AVAX'];
    
    for (const symbol1 of symbols) {
      const correlations = new Map<string, number>();
      
      for (const symbol2 of symbols) {
        if (symbol1 === symbol2) {
          correlations.set(symbol2, 1.0);
        } else {
          // Simulate correlation (in real implementation, calculate from historical data)
          correlations.set(symbol2, Math.random() * 0.8 + 0.1); // 0.1-0.9
        }
      }
      
      this.correlationMatrix.set(symbol1, correlations);
    }
  }

  // Main position sizing method
  async calculatePositionSize(params: PositionSizingParams): Promise<PositionSizingResult> {
    try {
      logger.info(`📊 Calculating position size for ${params.symbol}...`);

      const warnings: string[] = [];
      const adjustments = {
        volatilityAdjustment: 1.0,
        regimeAdjustment: 1.0,
        confidenceAdjustment: 1.0,
        liquidityAdjustment: 1.0,
        correlationAdjustment: 1.0
      };

      // 1. Calculate base position size using Kelly Criterion
      const kellySize = this.calculateKellySize(params);
      
      // 2. Apply volatility adjustment
      adjustments.volatilityAdjustment = this.calculateVolatilityAdjustment(params.volatility);
      
      // 3. Apply market regime adjustment
      adjustments.regimeAdjustment = this.calculateRegimeAdjustment(params.marketRegime);
      
      // 4. Apply confidence adjustment
      adjustments.confidenceAdjustment = this.calculateConfidenceAdjustment(params.confidence);
      
      // 5. Apply liquidity adjustment
      adjustments.liquidityAdjustment = this.calculateLiquidityAdjustment(params.liquidity, kellySize);
      
      // 6. Apply correlation adjustment
      adjustments.correlationAdjustment = this.calculateCorrelationAdjustment(params.symbol, params.correlationRisk);

      // 7. Calculate final position size
      const finalSize = this.calculateFinalSize(kellySize, adjustments, params);
      
      // 8. Apply risk limits
      const riskLimitedSize = this.applyRiskLimits(finalSize, params);
      
      // 9. Calculate position metrics
      const result = this.calculatePositionMetrics(riskLimitedSize, params, adjustments, warnings);

      logger.info(`✅ Position size calculated: ${result.recommendedSizeUSD.toFixed(2)} USD`);
      return result;

    } catch (error) {
      logger.error('❌ Position sizing calculation failed:', error);
      throw error;
    }
  }

  // Calculate Kelly Criterion position size
  private calculateKellySize(params: PositionSizingParams): number {
    const riskMetrics = this.riskMetrics.get(params.symbol);
    if (!riskMetrics) {
      logger.warn(`⚠️ No risk metrics found for ${params.symbol}, using default values`);
      return params.accountBalance * 0.01; // 1% default
    }

    // Kelly formula: f = (bp - q) / b
    // where b = odds (averageWin/averageLoss), p = win rate, q = loss rate
    const b = riskMetrics.averageWin / riskMetrics.averageLoss;
    const p = riskMetrics.winRate;
    const q = 1 - p;
    
    const kellyFraction = (b * p - q) / b;
    
    // Cap Kelly fraction to prevent over-leveraging
    const cappedKelly = Math.min(kellyFraction, this.kellyFraction);
    
    return params.accountBalance * cappedKelly;
  }

  // Calculate volatility adjustment
  private calculateVolatilityAdjustment(volatility: number): number {
    // Higher volatility = smaller position size
    if (volatility < 0.2) return 1.2; // Low volatility, can increase size
    if (volatility < 0.4) return 1.0; // Normal volatility
    if (volatility < 0.6) return 0.8; // High volatility, reduce size
    return 0.6; // Very high volatility, significantly reduce size
  }

  // Calculate market regime adjustment
  private calculateRegimeAdjustment(regime: string): number {
    switch (regime) {
      case 'TRENDING':
        return 1.1; // Slightly increase size in trending markets
      case 'RANGING':
        return 0.9; // Reduce size in ranging markets
      case 'EVENT_DRIVEN':
        return 0.7; // Significantly reduce size during events
      case 'UNKNOWN':
        return 0.8; // Reduce size when regime is unknown
      default:
        return 1.0;
    }
  }

  // Calculate confidence adjustment
  private calculateConfidenceAdjustment(confidence: number): number {
    // Higher confidence = larger position size
    if (confidence >= 90) return 1.2;
    if (confidence >= 80) return 1.1;
    if (confidence >= 70) return 1.0;
    if (confidence >= 60) return 0.9;
    if (confidence >= 50) return 0.8;
    return 0.6; // Low confidence, significantly reduce size
  }

  // Calculate liquidity adjustment
  private calculateLiquidityAdjustment(liquidity: number, positionSize: number): number {
    // Ensure position size doesn't exceed available liquidity
    const maxSizeFromLiquidity = liquidity * 0.01; // Max 1% of available liquidity
    
    if (positionSize > maxSizeFromLiquidity) {
      return maxSizeFromLiquidity / positionSize;
    }
    
    return 1.0;
  }

  // Calculate correlation adjustment
  private calculateCorrelationAdjustment(symbol: string, correlationRisk: number): number {
    // Higher correlation with existing positions = smaller new position
    if (correlationRisk < 0.3) return 1.0; // Low correlation
    if (correlationRisk < 0.6) return 0.9; // Medium correlation
    if (correlationRisk < 0.8) return 0.7; // High correlation
    return 0.5; // Very high correlation
  }

  // Calculate final position size
  private calculateFinalSize(
    baseSize: number, 
    adjustments: any, 
    params: PositionSizingParams
  ): number {
    let finalSize = baseSize;
    
    // Apply all adjustments
    finalSize *= adjustments.volatilityAdjustment;
    finalSize *= adjustments.regimeAdjustment;
    finalSize *= adjustments.confidenceAdjustment;
    finalSize *= adjustments.liquidityAdjustment;
    finalSize *= adjustments.correlationAdjustment;
    
    return finalSize;
  }

  // Apply risk limits
  private applyRiskLimits(positionSize: number, params: PositionSizingParams): number {
    // Apply maximum risk per trade
    const maxRiskAmount = params.accountBalance * this.maxRiskPerTrade;
    const riskAmount = this.calculateRiskAmount(positionSize, params);
    
    if (riskAmount > maxRiskAmount) {
      positionSize = (maxRiskAmount / riskAmount) * positionSize;
    }
    
    // Apply position size limits
    positionSize = Math.max(positionSize, this.minPositionSize);
    positionSize = Math.min(positionSize, this.maxPositionSize);
    positionSize = Math.min(positionSize, params.maxPositionSize);
    
    return positionSize;
  }

  // Calculate risk amount
  private calculateRiskAmount(positionSize: number, params: PositionSizingParams): number {
    if (params.stopLossPrice) {
      const riskPerUnit = Math.abs(params.entryPrice - params.stopLossPrice);
      const positionSizeInUnits = positionSize / params.entryPrice;
      return riskPerUnit * positionSizeInUnits;
    }
    
    // If no stop loss, use percentage-based risk
    return positionSize * (params.riskPerTrade / 100);
  }

  // Calculate position metrics
  private calculatePositionMetrics(
    positionSize: number, 
    params: PositionSizingParams, 
    adjustments: any, 
    warnings: string[]
  ): PositionSizingResult {
    const positionSizeUSD = positionSize;
    const positionSizeInUnits = positionSizeUSD / params.entryPrice;
    const riskAmount = this.calculateRiskAmount(positionSizeUSD, params);
    
    // Calculate risk-reward ratio
    let riskRewardRatio = 0;
    if (params.stopLossPrice && params.takeProfitPrice) {
      const risk = Math.abs(params.entryPrice - params.stopLossPrice);
      const reward = Math.abs(params.takeProfitPrice - params.entryPrice);
      riskRewardRatio = reward / risk;
    }
    
    // Calculate leverage
    const leverage = positionSizeUSD / params.accountBalance;
    
    // Determine sizing method
    const sizingMethod = this.determineSizingMethod(adjustments);
    
    // Calculate confidence
    const confidence = this.calculateOverallConfidence(adjustments);
    
    // Generate warnings
    this.generateWarnings(positionSizeUSD, riskAmount, leverage, riskRewardRatio, warnings);
    
    return {
      recommendedSize: positionSizeInUnits,
      recommendedSizeUSD: positionSizeUSD,
      riskAmount,
      riskRewardRatio,
      positionValue: positionSizeUSD,
      leverage,
      sizingMethod,
      confidence,
      warnings,
      adjustments
    };
  }

  // Determine sizing method used
  private determineSizingMethod(adjustments: any): 'KELLY' | 'FIXED_FRACTIONAL' | 'VOLATILITY_ADJUSTED' | 'CONFIDENCE_WEIGHTED' {
    if (adjustments.volatilityAdjustment !== 1.0) return 'VOLATILITY_ADJUSTED';
    if (adjustments.confidenceAdjustment !== 1.0) return 'CONFIDENCE_WEIGHTED';
    return 'KELLY';
  }

  // Calculate overall confidence
  private calculateOverallConfidence(adjustments: any): number {
    let confidence = 100;
    
    // Reduce confidence based on adjustments
    if (adjustments.volatilityAdjustment < 1.0) confidence -= 10;
    if (adjustments.regimeAdjustment < 1.0) confidence -= 15;
    if (adjustments.confidenceAdjustment < 1.0) confidence -= 20;
    if (adjustments.liquidityAdjustment < 1.0) confidence -= 10;
    if (adjustments.correlationAdjustment < 1.0) confidence -= 15;
    
    return Math.max(confidence, 0);
  }

  // Generate warnings
  private generateWarnings(
    positionSize: number, 
    riskAmount: number, 
    leverage: number, 
    riskRewardRatio: number, 
    warnings: string[]
  ): void {
    if (leverage > 0.1) {
      warnings.push('High leverage detected - consider reducing position size');
    }
    
    if (riskRewardRatio < 1.5 && riskRewardRatio > 0) {
      warnings.push('Low risk-reward ratio - consider adjusting stop loss or take profit');
    }
    
    if (positionSize > 50000) {
      warnings.push('Large position size - ensure sufficient liquidity');
    }
    
    if (riskAmount > 1000) {
      warnings.push('High risk amount - monitor position closely');
    }
  }

  // Update risk metrics based on trade outcome
  async updateRiskMetrics(symbol: string, tradeOutcome: {
    profit: number;
    loss: number;
    win: boolean;
    duration: number;
  }): Promise<void> {
    try {
      const currentMetrics = this.riskMetrics.get(symbol);
      if (!currentMetrics) return;

      // Update win rate
      const totalTrades = this.positionHistory.get(symbol)?.length || 0;
      const currentWins = currentMetrics.winRate * totalTrades;
      const newWinRate = (currentWins + (tradeOutcome.win ? 1 : 0)) / (totalTrades + 1);
      
      // Update average win/loss
      const newAverageWin = tradeOutcome.win ? 
        (currentMetrics.averageWin * totalTrades + tradeOutcome.profit) / (totalTrades + 1) :
        currentMetrics.averageWin;
        
      const newAverageLoss = !tradeOutcome.win ? 
        (currentMetrics.averageLoss * totalTrades + tradeOutcome.loss) / (totalTrades + 1) :
        currentMetrics.averageLoss;

      // Update metrics
      this.riskMetrics.set(symbol, {
        ...currentMetrics,
        winRate: newWinRate,
        averageWin: newAverageWin,
        averageLoss: newAverageLoss
      });

      // Store trade history
      const history = this.positionHistory.get(symbol) || [];
      history.push({
        ...tradeOutcome,
        timestamp: Date.now()
      });
      
      // Keep only last 100 trades
      if (history.length > 100) {
        history.shift();
      }
      
      this.positionHistory.set(symbol, history);

      logger.info(`📊 Risk metrics updated for ${symbol}: Win rate ${(newWinRate * 100).toFixed(1)}%`);

    } catch (error) {
      logger.error('❌ Failed to update risk metrics:', error);
    }
  }

  // Get current risk metrics
  getRiskMetrics(symbol: string): RiskMetrics | null {
    return this.riskMetrics.get(symbol) || null;
  }

  // Get position sizing statistics
  getSizingStats(): {
    totalCalculations: number;
    averagePositionSize: number;
    averageLeverage: number;
    riskMetricsCount: number;
    symbolsTracked: number;
  } {
    let totalCalculations = 0;
    let totalPositionSize = 0;
    let totalLeverage = 0;

    for (const history of this.positionHistory.values()) {
      totalCalculations += history.length;
      // Calculate averages from history
    }

    return {
      totalCalculations,
      averagePositionSize: totalCalculations > 0 ? totalPositionSize / totalCalculations : 0,
      averageLeverage: totalCalculations > 0 ? totalLeverage / totalCalculations : 0,
      riskMetricsCount: this.riskMetrics.size,
      symbolsTracked: this.positionHistory.size
    };
  }

  // Calculate portfolio-level risk
  async calculatePortfolioRisk(positions: Array<{
    symbol: string;
    size: number;
    value: number;
    volatility: number;
  }>): Promise<{
    totalRisk: number;
    diversifiedRisk: number;
    concentrationRisk: number;
    recommendations: string[];
  }> {
    try {
      let totalRisk = 0;
      let concentrationRisk = 0;
      const recommendations: string[] = [];

      // Calculate individual position risks
      for (const position of positions) {
        const riskMetrics = this.riskMetrics.get(position.symbol);
        if (riskMetrics) {
          totalRisk += position.value * riskMetrics.var95;
        }
      }

      // Calculate concentration risk
      const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);
      for (const position of positions) {
        const concentration = position.value / totalValue;
        if (concentration > 0.2) { // More than 20% in one position
          concentrationRisk += concentration * 0.5;
          recommendations.push(`High concentration in ${position.symbol}: ${(concentration * 100).toFixed(1)}%`);
        }
      }

      // Calculate diversified risk (considering correlations)
      let diversifiedRisk = 0;
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const pos1 = positions[i];
          const pos2 = positions[j];
          const correlation = this.correlationMatrix.get(pos1.symbol)?.get(pos2.symbol) || 0;
          diversifiedRisk += pos1.value * pos2.value * correlation * 0.1;
        }
      }

      if (totalRisk > totalValue * 0.1) {
        recommendations.push('Portfolio risk exceeds 10% - consider reducing position sizes');
      }

      return {
        totalRisk,
        diversifiedRisk,
        concentrationRisk,
        recommendations
      };

    } catch (error) {
      logger.error('❌ Portfolio risk calculation failed:', error);
      throw error;
    }
  }
}
