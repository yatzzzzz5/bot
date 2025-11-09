import { logger } from '../../utils/logger';

export interface TransactionCost {
  venue: string;
  symbol: string;
  size: number;
  timestamp: Date;
  executionMode: 'DIRECT' | 'TWAP' | 'ICEBERG';
  actualCost: number;
  expectedCost: number;
  slippage: number;
  fees: number;
  latency: number;
  success: boolean;
}

export interface VenuePerformance {
  venue: string;
  symbol: string;
  totalTrades: number;
  avgSlippage: number;
  avgFees: number;
  avgLatency: number;
  successRate: number;
  costEfficiency: number; // Lower is better
  lastUpdated: Date;
}

export interface ExecutionRecommendation {
  venue: string;
  executionMode: 'DIRECT' | 'TWAP' | 'ICEBERG';
  confidence: number;
  expectedCost: number;
  expectedSlippage: number;
  reasoning: string;
}

export class TCAAnalyzer {
  private transactionCosts: TransactionCost[] = [];
  private venuePerformance: Map<string, VenuePerformance> = new Map();
  private learningRate: number = 0.01;
  private minSamples: number = 10;

  async initialize(): Promise<void> {
    logger.info('📊 Initializing TCA Analyzer...');
    logger.info('✅ TCA Analyzer initialized');
  }

  // Record transaction cost data
  recordTransactionCost(cost: TransactionCost): void {
    try {
      this.transactionCosts.push(cost);
      
      // Update venue performance
      this.updateVenuePerformance(cost);
      
      // Keep only recent data (last 1000 transactions)
      if (this.transactionCosts.length > 1000) {
        this.transactionCosts = this.transactionCosts.slice(-1000);
      }
      
      logger.info(`📈 TCA recorded: ${cost.venue} ${cost.symbol} ${cost.executionMode} - Cost: ${cost.actualCost.toFixed(4)}`);
    } catch (error) {
      logger.error('❌ Failed to record transaction cost:', error);
    }
  }

  // Update venue performance metrics
  private updateVenuePerformance(cost: TransactionCost): void {
    try {
      const key = `${cost.venue}_${cost.symbol}`;
      const existing = this.venuePerformance.get(key) || {
        venue: cost.venue,
        symbol: cost.symbol,
        totalTrades: 0,
        avgSlippage: 0,
        avgFees: 0,
        avgLatency: 0,
        successRate: 0,
        costEfficiency: 0,
        lastUpdated: new Date()
      };

      // Update metrics using exponential moving average
      const alpha = this.learningRate;
      existing.totalTrades += 1;
      existing.avgSlippage = existing.avgSlippage * (1 - alpha) + cost.slippage * alpha;
      existing.avgFees = existing.avgFees * (1 - alpha) + cost.fees * alpha;
      existing.avgLatency = existing.avgLatency * (1 - alpha) + cost.latency * alpha;
      existing.successRate = existing.successRate * (1 - alpha) + (cost.success ? 1 : 0) * alpha;
      
      // Cost efficiency = (slippage + fees) / success_rate (lower is better)
      existing.costEfficiency = (existing.avgSlippage + existing.avgFees) / Math.max(0.1, existing.successRate);
      existing.lastUpdated = new Date();

      this.venuePerformance.set(key, existing);
    } catch (error) {
      logger.error('❌ Failed to update venue performance:', error);
    }
  }

  // Get execution recommendation based on TCA
  getExecutionRecommendation(params: {
    symbol: string;
    size: number;
    availableVenues: string[];
    urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  }): ExecutionRecommendation {
    try {
      const { symbol, size, availableVenues, urgency } = params;
      
      let bestVenue = availableVenues[0];
      let bestMode: 'DIRECT' | 'TWAP' | 'ICEBERG' = 'DIRECT';
      let bestCost = Infinity;
      let bestConfidence = 0;
      let reasoning = '';

      // Analyze each venue
      for (const venue of availableVenues) {
        const key = `${venue}_${symbol}`;
        const performance = this.venuePerformance.get(key);
        
        if (!performance || performance.totalTrades < this.minSamples) {
          // Use default estimates for new venues
          const defaultCost = this.estimateDefaultCost(venue, size, urgency);
          if (defaultCost < bestCost) {
            bestCost = defaultCost;
            bestVenue = venue;
            bestMode = this.selectExecutionMode(size, urgency);
            bestConfidence = 0.3;
            reasoning = `New venue, using default estimates`;
          }
          continue;
        }

        // Calculate expected cost for each execution mode
        const modes: Array<'DIRECT' | 'TWAP' | 'ICEBERG'> = ['DIRECT', 'TWAP', 'ICEBERG'];
        
        for (const mode of modes) {
          const expectedCost = this.calculateExpectedCost(performance, size, mode, urgency);
          const confidence = this.calculateConfidence(performance, mode);
          
          if (expectedCost < bestCost) {
            bestCost = expectedCost;
            bestVenue = venue;
            bestMode = mode;
            bestConfidence = confidence;
            reasoning = `${venue} ${mode}: ${performance.totalTrades} trades, ${(performance.successRate * 100).toFixed(1)}% success, ${performance.costEfficiency.toFixed(4)} efficiency`;
          }
        }
      }

      return {
        venue: bestVenue,
        executionMode: bestMode,
        confidence: bestConfidence,
        expectedCost: bestCost,
        expectedSlippage: this.estimateSlippage(bestVenue, symbol, size),
        reasoning
      };

    } catch (error) {
      logger.error('❌ Failed to get execution recommendation:', error);
      return {
        venue: 'DEFAULT',
        executionMode: 'DIRECT',
        confidence: 0.1,
        expectedCost: 0.01,
        expectedSlippage: 0.005,
        reasoning: 'Error in TCA analysis, using defaults'
      };
    }
  }

  // Calculate expected cost for a venue and execution mode
  private calculateExpectedCost(
    performance: VenuePerformance, 
    size: number, 
    mode: 'DIRECT' | 'TWAP' | 'ICEBERG',
    urgency: 'LOW' | 'MEDIUM' | 'HIGH'
  ): number {
    let baseCost = performance.avgSlippage + performance.avgFees;
    
    // Adjust for execution mode
    switch (mode) {
      case 'DIRECT':
        baseCost *= 1.0; // No adjustment
        break;
      case 'TWAP':
        baseCost *= 0.8; // TWAP typically reduces market impact
        break;
      case 'ICEBERG':
        baseCost *= 0.9; // Iceberg reduces visible size
        break;
    }
    
    // Adjust for urgency
    switch (urgency) {
      case 'LOW':
        baseCost *= 0.9; // Can be more patient
        break;
      case 'MEDIUM':
        baseCost *= 1.0; // No adjustment
        break;
      case 'HIGH':
        baseCost *= 1.2; // May need to pay more for speed
        break;
    }
    
    // Adjust for size (larger orders typically have higher costs)
    const sizeMultiplier = Math.min(2.0, 1 + (size / 100000)); // Cap at 2x for very large orders
    baseCost *= sizeMultiplier;
    
    return baseCost;
  }

  // Calculate confidence in recommendation
  private calculateConfidence(performance: VenuePerformance, mode: 'DIRECT' | 'TWAP' | 'ICEBERG'): number {
    let confidence = Math.min(0.95, performance.totalTrades / 100); // More trades = higher confidence
    
    // Adjust for success rate
    confidence *= performance.successRate;
    
    // Adjust for execution mode (some modes are more predictable)
    switch (mode) {
      case 'DIRECT':
        confidence *= 1.0;
        break;
      case 'TWAP':
        confidence *= 0.9; // Slightly less predictable due to time component
        break;
      case 'ICEBERG':
        confidence *= 0.8; // Less predictable due to hidden nature
        break;
    }
    
    return Math.max(0.1, confidence);
  }

  // Select execution mode based on size and urgency
  private selectExecutionMode(size: number, urgency: 'LOW' | 'MEDIUM' | 'HIGH'): 'DIRECT' | 'TWAP' | 'ICEBERG' {
    if (urgency === 'HIGH' || size < 10000) {
      return 'DIRECT';
    } else if (size > 100000) {
      return 'ICEBERG';
    } else {
      return 'TWAP';
    }
  }

  // Estimate default cost for new venues
  private estimateDefaultCost(venue: string, size: number, urgency: 'LOW' | 'MEDIUM' | 'HIGH'): number {
    // Default estimates based on venue type
    const venueDefaults: Record<string, number> = {
      'Binance': 0.001,
      'OKX': 0.0012,
      'Coinbase': 0.0015,
      'Kraken': 0.0018,
      'DEFAULT': 0.002
    };
    
    let baseCost = venueDefaults[venue] || venueDefaults['DEFAULT'];
    
    // Adjust for urgency
    switch (urgency) {
      case 'LOW':
        baseCost *= 0.8;
        break;
      case 'MEDIUM':
        baseCost *= 1.0;
        break;
      case 'HIGH':
        baseCost *= 1.5;
        break;
    }
    
    // Adjust for size
    const sizeMultiplier = Math.min(2.0, 1 + (size / 100000));
    baseCost *= sizeMultiplier;
    
    return baseCost;
  }

  // Estimate slippage for a venue
  private estimateSlippage(venue: string, symbol: string, size: number): number {
    // Simple slippage estimation based on size
    const baseSlippage = 0.0005; // 0.05% base
    const sizeImpact = Math.min(0.01, size / 1000000); // Max 1% for very large orders
    return baseSlippage + sizeImpact;
  }

  // Get venue performance summary
  getVenuePerformance(): VenuePerformance[] {
    return Array.from(this.venuePerformance.values());
  }

  // Get TCA statistics
  getTCAStats(): {
    totalTransactions: number;
    avgCost: number;
    bestVenue: string;
    worstVenue: string;
    modeDistribution: Record<string, number>;
  } {
    if (this.transactionCosts.length === 0) {
      return {
        totalTransactions: 0,
        avgCost: 0,
        bestVenue: 'N/A',
        worstVenue: 'N/A',
        modeDistribution: {}
      };
    }

    const avgCost = this.transactionCosts.reduce((sum, cost) => sum + cost.actualCost, 0) / this.transactionCosts.length;
    
    // Find best and worst venues
    const venueStats = new Map<string, { total: number; avgCost: number }>();
    this.transactionCosts.forEach(cost => {
      const existing = venueStats.get(cost.venue) || { total: 0, avgCost: 0 };
      existing.total += 1;
      existing.avgCost = (existing.avgCost * (existing.total - 1) + cost.actualCost) / existing.total;
      venueStats.set(cost.venue, existing);
    });

    let bestVenue = 'N/A';
    let worstVenue = 'N/A';
    let bestCost = Infinity;
    let worstCost = -Infinity;

    venueStats.forEach((stats, venue) => {
      if (stats.avgCost < bestCost) {
        bestCost = stats.avgCost;
        bestVenue = venue;
      }
      if (stats.avgCost > worstCost) {
        worstCost = stats.avgCost;
        worstVenue = venue;
      }
    });

    // Mode distribution
    const modeDistribution: Record<string, number> = {};
    this.transactionCosts.forEach(cost => {
      modeDistribution[cost.executionMode] = (modeDistribution[cost.executionMode] || 0) + 1;
    });

    return {
      totalTransactions: this.transactionCosts.length,
      avgCost,
      bestVenue,
      worstVenue,
      modeDistribution
    };
  }
}
