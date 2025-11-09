import { logger } from '../utils/logger';
import ccxt from 'ccxt';

// EMERGENCY DAY TRADING MODE - MAXIMUM AGGRESSION
// ⚠️ WARNING: EXTREME RISK - POTENTIAL TOTAL LOSS
export interface EmergencyConfig {
  totalCapital: number;
  dailyTarget: number; // Target % gain needed (50-200%)
  maxRiskPerTrade: number; // Maximum % to risk per trade
  emergencyHours: number; // Trading hours in day (16-20)
  symbols: string[];
  leverageEnabled: boolean;
  maxLeverage: number;
}

export interface EmergencyTrade {
  id: string;
  timestamp: Date;
  symbol: string;
  action: 'LONG' | 'SHORT';
  amount: number;
  leverage: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  status: 'OPEN' | 'CLOSED' | 'STOPPED';
  pnl?: number;
}

export class EmergencyDayTrader {
  private config: EmergencyConfig;
  private binance: any;
  private dailyTrades: EmergencyTrade[] = [];
  private currentBalance: number;
  private dailyTarget: number;
  private emergencyMode: boolean = false;
  private lastTradeTime: Date = new Date();
  private marketSessionStart: Date = new Date();

  constructor(config: EmergencyConfig) {
    this.config = config;
    this.currentBalance = config.totalCapital;
    this.dailyTarget = config.dailyTarget;

    // INSTATIATE REAL BINANCE CONNECTION
    this.binance = new ccxt.binance({
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_SECRET_KEY,
      options: {
        defaultType: 'future', // Futures for leverage
        adjustForTimeDifference: true,
      },
      enableRateLimit: true,
    });

    logger.warn('⚡🚨 EMERGENCY DAY TRADER INITIALIZED - EXTREME RISK MODE 🚨⚡');
  }

  async initialize(): Promise<void> {
    try {
      // Validate API keys
      await this.binance.loadMarkets();
      
      // Switch to futures
      await this.binance.setMarginMode('isolated');
      
      logger.error('🚨 EMERGENCY MODE ACTIVE - MAXIMUM AGGRESSION');
      logger.error(`🎯 DAILY TARGET: ${this.dailyTarget}%`);
      logger.error(`💸 TOTAL CAPITAL AT RISK: $${this.currentBalance}`);
      
      this.emergencyMode = true;
      
    } catch (error) {
      logger.error('❌ Emergency trader initialization failed:', error);
      throw error;
    }
  }

  // HYPER-AGGRESSIVE HOURLY STRATEGY
  async executeEmergencyRush(newsEvents?: string[]): Promise<void> {
    if (!this.emergencyMode) return;

    try {
      logger.error(`🚨 EMERGENCY RUSH EXECUTION AT ${new Date().toISOString()}`);
      
      // 1. SCAN FOR IMMEDIATE OPPORTUNITIES
      const urgentOps = await this.scanEmergencyOpportunities();
      
      if (urgentOps.length === 0) {
        logger.warn('⚠️ No emergency opportunities found - trying force entry');
        await this.executeForcedTrade();
        return;
      }

      // 2. SELECT MOST AGGRESSIVE OPPORTUNITY
      const mostAggressive = this.selectMostAggressiveTrade(urgentOps);
      
      // 3. CALCULATE GAMBLING POSITION SIZE
      const positionSize = this.calculateEmergencyPositionSize(mostAggressive);
      
      // 4. EXECUTE WITH MAXIMUM LEVERAGE
      const trade = await this.executeEmergencyTrade(mostAggressive, positionSize);
      
      if (trade) {
        this.dailyTrades.push(trade);
        logger.error(`⚡ EMERGENCY TRADE EXECUTED: ${trade.symbol} ${trade.leverage}x`);
        
        // Immediate monitoring
        setTimeout(() => this.aggressiveMonitor(trade), 60000);
      }

    } catch (error) {
      logger.error('❌ Emergency rush execution failed:', error);
      // Try again immediately
      setTimeout(() => this.executeEmergencyRush(), 5000);
    }
  }

  private async scanEmergencyOpportunities(): Promise<any[]> {
    const opportunities = [];
    
    for (const symbol of this.config.symbols) {
      try {
        // Get latest prices
        const ticker = await this.binance.fetchTicker(symbol);
        const recentCloses = await this.binance.fetchOHLCV(symbol, '1m', undefined, 10);
        
        if (recentCloses.length < 5) continue;

        // VOLATILITY CHECK (Emergency traders LOVE volatility)
        const volatility = this.calculateVolatility(recentCloses);
        
        // MOMENTUM CHECK
        const momentum = this.calculateMomentum(recentCloses);
        
        // VOLUME SPIKE CHECK
        const volumeSpike = await this.checkVolumeSpike(symbol);

        if (volatility > 0.05 && Math.abs(momentum) > 0.02) { // At least 5% volatility, 2% momentum
          opportunities.push({
            symbol,
            currentPrice: ticker.last,
            volatility,
            momentum,
            volumeSpike,
            urgency: volumeSpike > 2 ? 'CRITICAL' : 'HIGH',
            entryPrice: ticker.last,
            expectedMove: momentum * (volatility > 0.1 ? 1.5 : 1), // Expected move
            leverageSuggestion: Math.min(this.config.maxLeverage, Math.floor(50 / volatility))
          });
        }

      } catch (error) {
        logger.debug(`Emergency scan failed for ${symbol}:`, error.message);
      }
    }

    return opportunities.sort((a, b) => {
      const aScore = a.volatility * Math.abs(a.momentum) * (a.urgency === 'CRITICAL' ? 2 : 1);
      const bScore = b.volatility * Math.abs(b.momentum) * (b.urgency === 'CRITICAL' ? 2 : 1);
      return bScore - aScore;
    });
  }

  private async executeForcedTrade(): Promise<void> {
    // When no opportunities exist, force entry on highest volume coin
    logger.warn('⚠️ FORCE ENTRY - NO OPPORTUNITIES FOUND');
    
    try {
      const tickers = await this.binance.fetchTickers(this.config.symbols);
      const highestVolume = Object.values(tickers).reduce((max: any, ticker: any) => 
        ticker.quoteVolume > max.quoteVolume ? ticker : max
      );

      const forcedTrade = {
        symbol: Object.keys(tickers).find(k => tickers[k] === highestVolume),
        currentPrice: (highestVolume as any).last || 0,
        volatility: 0.1, // Assume high volatility
        momentum: (Math.random() - 0.5) * 0.1, // Random momentum
        urgency: 'CRITICAL' as const,
        leverageSuggestion: this.config.maxLeverage
      };

      const positionSize = this.currentBalance * 0.8; // 80% of balance
      
      await this.executeEmergencyTrade(forcedTrade, positionSize);
      
    } catch (error) {
      logger.error('❌ Forced trade execution failed:', error);
    }
  }

  private selectMostAggressiveTrade(opportunities: any[]): any {
    // Select highest volatility + momentum combination
    return opportunities.reduce((best, current) => {
      const bestScore = best.volatility * Math.abs(best.momentum) * (best.urgency === 'CRITICAL' ? 2 : 1);
      const currentScore = current.volatility * Math.abs(current.momentum) * (current.urgency === 'CRITICAL' ? 2 : 1);
      return currentScore > bestScore ? current : best;
    });
  }

  private calculateEmergencyPositionSize(opportunity: any): number {
    // EMERGENCY POSITION SIZING - MUCH MORE AGGRESSIVE
    const targetProfit = this.dailyTarget / this.config.emergencyHours; // Hourly target
    
    if (targetProfit > 20) { // If we need more than 20% hourly
      return this.currentBalance * 0.9; // Use 90% of balance
    } else if (targetProfit > 10) {
      return this.currentBalance * 0.7; // Use 70% of balance
    } else {
      return this.currentBalance * 0.5; // Use 50% of balance
    }
  }

  private async executeEmergencyTrade(opportunity: any, positionSize: number): Promise<EmergencyTrade | null> {
    try {
      const leverage = Math.min(opportunity.leverageSuggestion, this.config.maxLeverage);
      const action = opportunity.momentum > 0 ? 'LONG' : 'SHORT';
      
      // Calculate targets
      const targetMove = Math.abs(opportunity.expectedMove);
      const targetPrice = action === 'LONG' 
        ? opportunity.entryPrice * (1 + targetMove)
        : opportunity.entryPrice * (1 - targetMove);
        
      const stopLoss = action === 'LONG'
        ? opportunity.entryPrice * (1 - targetMove * 0.3) // 30% of target distance
        : opportunity.entryPrice * (1 + targetMove * 0.3);

      const trade: EmergencyTrade = {
        id: `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        symbol: opportunity.symbol,
        action,
        amount: positionSize,
        leverage,
        entryPrice: opportunity.entryPrice,
        targetPrice,
        stopLoss,
        urgency: opportunity.urgency,
        status: 'OPEN'
      };

      // PLACE ACTUAL FUTURES ORDER
      const orderSize = positionSize * leverage / opportunity.entryPrice;
      
      const order = await this.binance.createOrder(
        opportunity.symbol,
        'market',
        action.toLowerCase(),
        orderSize,
        undefined,
        {
          reduceOnly: false,
        }
      );

      logger.error(`⚡ EMERGENCY ORDER PLACED: ${opportunity.symbol} ${action} ${leverage}x ${orderSize}`);
      logger.error(`💸 Position Value: $${positionSize * leverage}`);
      logger.error(`🎯 Target: ${targetPrice} | Stop: ${stopLoss}`);

      return trade;
      
    } catch (error) {
      logger.error('❌ Emergency trade execution failed:', error);
      return null;
    }
  }

  private async aggressiveMonitor(trade: EmergencyTrade): Promise<void> {
    try {
      const currentPrice = await this.binance.watchTicker(trade.symbol);
      
      const priceChange = trade.action === 'LONG' 
        ? (currentPrice.last - trade.entryPrice) / trade.entryPrice
        : (trade.entryPrice - currentPrice.last) / trade.entryPrice;

      const pnlPercent = priceChange * trade.leverage;
      
      // Update trade PnL
      trade.pnl = trade.amount * pnlPercent;
      this.currentBalance += trade.pnl;

      // EMERGENCY PROFIT TAKING (take profits aggressively)
      if (pnlPercent >= 0.3) { // Take profit at 30%
        await this.closeEmergencyTrade(trade, currentPrice.last, 'PROFIT_TAKEN');
        logger.error(`💰 EMERGENCY PROFIT TAKEN: ${(pnlPercent * 100).toFixed(2)}%`);
      }
      // EMERGENCY STOP LOSS
      else if (trade.action === 'LONG' && currentPrice.last <= trade.stopLoss ||
               trade.action === 'SHORT' && currentPrice.last >= trade.stopLoss) {
        await this.closeEmergencyTrade(trade, currentPrice.last, 'STOP_LOSS');
        logger.error(`🔴 EMERGENCY STOP HIT: ${Math.abs(pnlPercent * 100).toFixed(2)}% LOSS`);
      }

    } catch (error) {
      logger.error(`❌ Emergency monitor failed for ${trade.id}:`, error);
    }
  }

  private async closeEmergencyTrade(trade: EmergencyTrade, exitPrice: number, reason: string): Promise<void> {
    try {
      // Close futures position
      await this.binance.createOrder(
        trade.symbol,
        'market',
        trade.action === 'LONG' ? 'sell' : 'buy',
        trade.amount * trade.leverage / trade.entryPrice,
        undefined,
        { reduceOnly: true }
      );

      trade.status = 'CLOSED';
      
      logger.error(`🔒 EMERGENCY TRADE CLOSED: ${trade.symbol} | Reason: ${reason}`);
      logger.error(`💸 Current Balance: $${this.currentBalance.toFixed(2)}`);
      
      // Check if daily target reached
      const dailyReturn = (this.currentBalance - this.config.totalCapital) / this.config.totalCapital;
      if (dailyReturn >= this.dailyTarget) {
        logger.error(`🎯 DAILY TARGET ACHIEVED: ${(dailyReturn * 100).toFixed(2)}%`);
        this.stopEmergencyMode();
      }

    } catch (error) {
      logger.error(`❌ Error closing emergency trade ${trade.id}:`, error);
      trade.status = 'STOPPED';
    }
  }

  private calculateVolatility(closes: number[][]): number {
    const prices = closes.map(c => c[4]); // Close prices
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    const avg = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private calculateMomentum(closes: number[][]): number {
    const prices = closes.map(c => c[4]);
    const latest = prices[prices.length - 1];
    const previous = prices[prices.length - 3];
    return (latest - previous) / previous;
  }

  private async checkVolumeSpike(symbol: string): Promise<number> {
    // Check if current volume is significantly higher than average
    const ticker = await this.binance.fetchTicker(symbol);
    const avgVolume = ticker.average * 24; // Daily average
    const currentVolume = ticker.quoteVolume;
    return currentVolume / avgVolume;
  }

  async generateEmergencyReport(): Promise<any> {
    const currentReturn = (this.currentBalance - this.config.totalCapital) / this.config.totalCapital;
    const targetAchieved = currentReturn >= this.dailyTarget;
    
    const successfulTrades = this.dailyTrades.filter(t => t.pnl && t.pnl > 0);
    const failedTrades = this.dailyTrades.filter(t => t.pnl && t.pnl <= 0);

    return {
      currentBalance: this.currentBalance,
      dailyReturn: currentReturn * 100,
      targetAchieved,
      totalTrades: this.dailyTrades.length,
      successfulTrades: successfulTrades.length,
      failedTrades: failedTrades.length,
      winRate: this.dailyTrades.length > 0 ? successfulTrades.length / this.dailyTrades.length : 0,
      trades: this.dailyTrades,
      emergencyMode: this.emergencyMode
    };
  }

  private stopEmergencyMode(): void {
    this.emergencyMode = false;
    logger.error('🛑 EMERGENCY MODE STOPPED - TARGET ACHIEVED OR MAX LOSS');
  }
}
