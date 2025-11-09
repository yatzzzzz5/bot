import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number; // Position size in base currency
  entryPrice: number;
  currentPrice: number;
  timestamp: number;
  exchange: string;
  status: 'OPEN' | 'CLOSED' | 'PARTIALLY_CLOSED';
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: {
    distance: number;
    activated: boolean;
    highestPrice?: number;
    lowestPrice?: number;
  };
  fees: {
    entry: number;
    exit?: number;
    total: number;
  };
  metadata?: any;
}

export interface PnLData {
  positionId: string;
  symbol: string;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  unrealizedPnLPercent: number;
  realizedPnLPercent: number;
  totalPnLPercent: number;
  currentPrice: number;
  entryPrice: number;
  timestamp: number;
  status: 'PROFIT' | 'LOSS' | 'BREAKEVEN';
  riskMetrics: {
    maxDrawdown: number;
    maxProfit: number;
    timeInTrade: number;
    volatility: number;
  };
}

export interface PortfolioPnL {
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  totalPnL: number;
  totalUnrealizedPnLPercent: number;
  totalRealizedPnLPercent: number;
  totalPnLPercent: number;
  positions: PnLData[];
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  yearlyPnL: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  timestamp: number;
}

export interface AutoCloseRule {
  id: string;
  positionId: string;
  type: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP' | 'TIME_BASED' | 'VOLATILITY_BASED';
  condition: any;
  enabled: boolean;
  createdAt: number;
  triggeredAt?: number;
  result?: any;
}

export class RealTimePnLTracker extends EventEmitter {
  private positions: Map<string, Position> = new Map();
  private pnlHistory: Map<string, PnLData[]> = new Map();
  private autoCloseRules: Map<string, AutoCloseRule[]> = new Map();
  private priceFeeds: Map<string, number> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  
  // Performance tracking
  private dailyPnL: number = 0;
  private weeklyPnL: number = 0;
  private monthlyPnL: number = 0;
  private yearlyPnL: number = 0;
  private maxDrawdown: number = 0;
  private peakBalance: number = 0;
  private winCount: number = 0;
  private lossCount: number = 0;
  private totalWins: number = 0;
  private totalLosses: number = 0;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    logger.info('📈 Initializing Real-time P&L Tracker...');
    
    // Start real-time price monitoring
    this.startPriceMonitoring();
    
    // Start P&L update loop
    this.startPnLUpdates();
    
    this.isRunning = true;
    logger.info('✅ Real-time P&L Tracker initialized');
  }

  // Add new position
  async addPosition(position: Omit<Position, 'id' | 'timestamp' | 'status' | 'fees'>): Promise<string> {
    try {
      const positionId = `POS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newPosition: Position = {
        ...position,
        id: positionId,
        timestamp: Date.now(),
        status: 'OPEN',
        fees: {
          entry: position.size * position.entryPrice * 0.001, // 0.1% fee
          total: position.size * position.entryPrice * 0.001
        }
      };

      this.positions.set(positionId, newPosition);
      
      // Initialize P&L history
      this.pnlHistory.set(positionId, []);
      
      // Initialize auto-close rules
      this.autoCloseRules.set(positionId, []);
      
      // Add default auto-close rules
      await this.addDefaultAutoCloseRules(positionId, newPosition);
      
      // Emit position added event
      this.emit('positionAdded', newPosition);
      
      logger.info(`📈 Position added: ${positionId} - ${position.symbol} ${position.side} ${position.size}`);
      
      return positionId;

    } catch (error) {
      logger.error('❌ Failed to add position:', error);
      throw error;
    }
  }

  // Update position
  async updatePosition(positionId: string, updates: Partial<Position>): Promise<boolean> {
    try {
      const position = this.positions.get(positionId);
      if (!position) {
        logger.warn(`⚠️ Position not found: ${positionId}`);
        return false;
      }

      const updatedPosition = { ...position, ...updates };
      this.positions.set(positionId, updatedPosition);
      
      // Emit position updated event
      this.emit('positionUpdated', updatedPosition);
      
      logger.info(`📈 Position updated: ${positionId}`);
      return true;

    } catch (error) {
      logger.error('❌ Failed to update position:', error);
      return false;
    }
  }

  // Close position
  async closePosition(positionId: string, exitPrice: number, reason?: string): Promise<boolean> {
    try {
      const position = this.positions.get(positionId);
      if (!position) {
        logger.warn(`⚠️ Position not found: ${positionId}`);
        return false;
      }

      // Calculate final P&L
      const finalPnL = this.calculatePnL(position, exitPrice);
      
      // Update position
      const closedPosition: Position = {
        ...position,
        status: 'CLOSED',
        currentPrice: exitPrice,
        fees: {
          ...position.fees,
          exit: position.size * exitPrice * 0.001, // 0.1% exit fee
          total: position.fees.entry + (position.size * exitPrice * 0.001)
        }
      };

      this.positions.set(positionId, closedPosition);
      
      // Update performance metrics
      this.updatePerformanceMetrics(finalPnL.realizedPnL);
      
      // Remove auto-close rules
      this.autoCloseRules.delete(positionId);
      
      // Emit position closed event
      this.emit('positionClosed', {
        position: closedPosition,
        pnl: finalPnL,
        reason: reason || 'Manual close'
      });
      
      logger.info(`📈 Position closed: ${positionId} - P&L: ${finalPnL.realizedPnL.toFixed(2)} USD`);
      
      return true;

    } catch (error) {
      logger.error('❌ Failed to close position:', error);
      return false;
    }
  }

  // Calculate P&L for a position
  calculatePnL(position: Position, currentPrice?: number): PnLData {
    const price = currentPrice || position.currentPrice;
    const positionValue = position.size * price;
    const entryValue = position.size * position.entryPrice;
    
    let unrealizedPnL: number;
    let unrealizedPnLPercent: number;
    
    if (position.side === 'LONG') {
      unrealizedPnL = positionValue - entryValue - position.fees.total;
      unrealizedPnLPercent = (unrealizedPnL / entryValue) * 100;
    } else {
      unrealizedPnL = entryValue - positionValue - position.fees.total;
      unrealizedPnLPercent = (unrealizedPnL / entryValue) * 100;
    }
    
    const realizedPnL = position.status === 'CLOSED' ? unrealizedPnL : 0;
    const totalPnL = unrealizedPnL;
    const totalPnLPercent = unrealizedPnLPercent;
    
    const status: 'PROFIT' | 'LOSS' | 'BREAKEVEN' = 
      totalPnL > 0 ? 'PROFIT' : totalPnL < 0 ? 'LOSS' : 'BREAKEVEN';
    
    // Calculate risk metrics
    const timeInTrade = Date.now() - position.timestamp;
    const volatility = this.calculateVolatility(position.symbol);
    
    const pnlData: PnLData = {
      positionId: position.id,
      symbol: position.symbol,
      unrealizedPnL,
      realizedPnL,
      totalPnL,
      unrealizedPnLPercent,
      realizedPnLPercent: (realizedPnL / entryValue) * 100,
      totalPnLPercent,
      currentPrice: price,
      entryPrice: position.entryPrice,
      timestamp: Date.now(),
      status,
      riskMetrics: {
        maxDrawdown: this.calculateMaxDrawdown(position.id),
        maxProfit: this.calculateMaxProfit(position.id),
        timeInTrade,
        volatility
      }
    };
    
    return pnlData;
  }

  // Get portfolio P&L
  getPortfolioPnL(): PortfolioPnL {
    const positions = Array.from(this.positions.values());
    const pnlData: PnLData[] = [];
    
    let totalUnrealizedPnL = 0;
    let totalRealizedPnL = 0;
    let totalValue = 0;
    
    for (const position of positions) {
      const pnl = this.calculatePnL(position);
      pnlData.push(pnl);
      
      totalUnrealizedPnL += pnl.unrealizedPnL;
      totalRealizedPnL += pnl.realizedPnL;
      totalValue += position.size * position.entryPrice;
    }
    
    const totalPnL = totalUnrealizedPnL + totalRealizedPnL;
    const totalPnLPercent = totalValue > 0 ? (totalPnL / totalValue) * 100 : 0;
    
    // Calculate performance metrics
    const winRate = (this.winCount + this.lossCount) > 0 ? 
      this.winCount / (this.winCount + this.lossCount) : 0;
    
    const averageWin = this.winCount > 0 ? this.totalWins / this.winCount : 0;
    const averageLoss = this.lossCount > 0 ? this.totalLosses / this.lossCount : 0;
    
    const profitFactor = this.totalLosses > 0 ? this.totalWins / Math.abs(this.totalLosses) : 0;
    
    const sharpeRatio = this.calculateSharpeRatio();
    
    return {
      totalUnrealizedPnL,
      totalRealizedPnL,
      totalPnL,
      totalUnrealizedPnLPercent: totalValue > 0 ? (totalUnrealizedPnL / totalValue) * 100 : 0,
      totalRealizedPnLPercent: totalValue > 0 ? (totalRealizedPnL / totalValue) * 100 : 0,
      totalPnLPercent,
      positions: pnlData,
      dailyPnL: this.dailyPnL,
      weeklyPnL: this.weeklyPnL,
      monthlyPnL: this.monthlyPnL,
      yearlyPnL: this.yearlyPnL,
      sharpeRatio,
      maxDrawdown: this.maxDrawdown,
      winRate,
      averageWin,
      averageLoss,
      profitFactor,
      timestamp: Date.now()
    };
  }

  // Add auto-close rule
  async addAutoCloseRule(rule: Omit<AutoCloseRule, 'id' | 'createdAt'>): Promise<string> {
    try {
      const ruleId = `RULE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newRule: AutoCloseRule = {
        ...rule,
        id: ruleId,
        createdAt: Date.now()
      };
      
      const rules = this.autoCloseRules.get(rule.positionId) || [];
      rules.push(newRule);
      this.autoCloseRules.set(rule.positionId, rules);
      
      logger.info(`📈 Auto-close rule added: ${ruleId} for position ${rule.positionId}`);
      
      return ruleId;

    } catch (error) {
      logger.error('❌ Failed to add auto-close rule:', error);
      throw error;
    }
  }

  // Check auto-close conditions
  private async checkAutoCloseConditions(): Promise<void> {
    try {
      for (const [positionId, rules] of this.autoCloseRules) {
        const position = this.positions.get(positionId);
        if (!position || position.status !== 'OPEN') continue;
        
        for (const rule of rules) {
          if (!rule.enabled) continue;
          
          const shouldClose = await this.evaluateAutoCloseRule(rule, position);
          if (shouldClose) {
            await this.executeAutoClose(rule, position);
          }
        }
      }
    } catch (error) {
      logger.error('❌ Auto-close condition check failed:', error);
    }
  }

  // Evaluate auto-close rule
  private async evaluateAutoCloseRule(rule: AutoCloseRule, position: Position): Promise<boolean> {
    try {
      switch (rule.type) {
        case 'STOP_LOSS':
          if (position.stopLoss) {
            if (position.side === 'LONG' && position.currentPrice <= position.stopLoss) {
              return true;
            }
            if (position.side === 'SHORT' && position.currentPrice >= position.stopLoss) {
              return true;
            }
          }
          break;
          
        case 'TAKE_PROFIT':
          if (position.takeProfit) {
            if (position.side === 'LONG' && position.currentPrice >= position.takeProfit) {
              return true;
            }
            if (position.side === 'SHORT' && position.currentPrice <= position.takeProfit) {
              return true;
            }
          }
          break;
          
        case 'TRAILING_STOP':
          if (position.trailingStop) {
            const trailingStop = position.trailingStop;
            if (position.side === 'LONG') {
              if (position.currentPrice > (trailingStop.highestPrice || position.entryPrice)) {
                trailingStop.highestPrice = position.currentPrice;
                trailingStop.activated = true;
              }
              if (trailingStop.activated && position.currentPrice <= (trailingStop.highestPrice! - trailingStop.distance)) {
                return true;
              }
            } else {
              if (position.currentPrice < (trailingStop.lowestPrice || position.entryPrice)) {
                trailingStop.lowestPrice = position.currentPrice;
                trailingStop.activated = true;
              }
              if (trailingStop.activated && position.currentPrice >= (trailingStop.lowestPrice! + trailingStop.distance)) {
                return true;
              }
            }
          }
          break;
          
        case 'TIME_BASED':
          const timeLimit = rule.condition.timeLimit; // in milliseconds
          if (Date.now() - position.timestamp > timeLimit) {
            return true;
          }
          break;
          
        case 'VOLATILITY_BASED':
          const volatility = this.calculateVolatility(position.symbol);
          const volatilityThreshold = rule.condition.volatilityThreshold;
          if (volatility > volatilityThreshold) {
            return true;
          }
          break;
      }
      
      return false;

    } catch (error) {
      logger.error('❌ Auto-close rule evaluation failed:', error);
      return false;
    }
  }

  // Execute auto-close
  private async executeAutoClose(rule: AutoCloseRule, position: Position): Promise<void> {
    try {
      const success = await this.closePosition(position.id, position.currentPrice, `Auto-close: ${rule.type}`);
      
      if (success) {
        rule.triggeredAt = Date.now();
        rule.result = { success: true, price: position.currentPrice };
        
        // Emit auto-close event
        this.emit('autoCloseTriggered', {
          rule,
          position,
          pnl: this.calculatePnL(position)
        });
        
        logger.info(`📈 Auto-close executed: ${rule.id} for position ${position.id}`);
      }

    } catch (error) {
      logger.error('❌ Auto-close execution failed:', error);
      rule.result = { success: false, error: error.message };
    }
  }

  // Add default auto-close rules
  private async addDefaultAutoCloseRules(positionId: string, position: Position): Promise<void> {
    try {
      // Add stop loss rule if specified
      if (position.stopLoss) {
        await this.addAutoCloseRule({
          positionId,
          type: 'STOP_LOSS',
          condition: { price: position.stopLoss },
          enabled: true
        });
      }
      
      // Add take profit rule if specified
      if (position.takeProfit) {
        await this.addAutoCloseRule({
          positionId,
          type: 'TAKE_PROFIT',
          condition: { price: position.takeProfit },
          enabled: true
        });
      }
      
      // Add trailing stop rule if specified
      if (position.trailingStop) {
        await this.addAutoCloseRule({
          positionId,
          type: 'TRAILING_STOP',
          condition: { distance: position.trailingStop.distance },
          enabled: true
        });
      }

    } catch (error) {
      logger.error('❌ Failed to add default auto-close rules:', error);
    }
  }

  // Start price monitoring
  private startPriceMonitoring(): void {
    // Simulate price updates (in real implementation, connect to price feeds)
    setInterval(() => {
      this.updatePrices();
    }, 1000); // Update every second
  }

  // Update prices
  private updatePrices(): void {
    try {
      const symbols = Array.from(new Set(Array.from(this.positions.values()).map(p => p.symbol)));
      
      for (const symbol of symbols) {
        // Simulate price movement (in real implementation, get from price feed)
        const currentPrice = this.priceFeeds.get(symbol) || 50000;
        const priceChange = (Math.random() - 0.5) * currentPrice * 0.001; // 0.1% random change
        const newPrice = currentPrice + priceChange;
        
        this.priceFeeds.set(symbol, newPrice);
        
        // Update positions with new price
        for (const position of this.positions.values()) {
          if (position.symbol === symbol && position.status === 'OPEN') {
            position.currentPrice = newPrice;
          }
        }
      }
    } catch (error) {
      logger.error('❌ Price update failed:', error);
    }
  }

  // Start P&L updates
  private startPnLUpdates(): void {
    this.updateInterval = setInterval(async () => {
      await this.updatePnLData();
      await this.checkAutoCloseConditions();
    }, 5000); // Update every 5 seconds
  }

  // Update P&L data
  private async updatePnLData(): Promise<void> {
    try {
      for (const position of this.positions.values()) {
        if (position.status === 'OPEN') {
          const pnl = this.calculatePnL(position);
          
          // Store P&L history
          const history = this.pnlHistory.get(position.id) || [];
          history.push(pnl);
          
          // Keep only last 1000 data points
          if (history.length > 1000) {
            history.shift();
          }
          
          this.pnlHistory.set(position.id, history);
          
          // Emit P&L update event
          this.emit('pnlUpdated', pnl);
        }
      }
    } catch (error) {
      logger.error('❌ P&L update failed:', error);
    }
  }

  // Update performance metrics
  private updatePerformanceMetrics(pnl: number): void {
    if (pnl > 0) {
      this.winCount++;
      this.totalWins += pnl;
    } else {
      this.lossCount++;
      this.totalLosses += pnl;
    }
    
    // Update drawdown
    const currentBalance = this.peakBalance + pnl;
    if (currentBalance > this.peakBalance) {
      this.peakBalance = currentBalance;
    } else {
      const drawdown = (this.peakBalance - currentBalance) / this.peakBalance;
      this.maxDrawdown = Math.max(this.maxDrawdown, drawdown);
    }
  }

  // Calculate volatility
  private calculateVolatility(symbol: string): number {
    // Simplified volatility calculation (in real implementation, use historical data)
    return Math.random() * 0.1 + 0.02; // 2-12% volatility
  }

  // Calculate max drawdown for position
  private calculateMaxDrawdown(positionId: string): number {
    const history = this.pnlHistory.get(positionId) || [];
    if (history.length === 0) return 0;
    
    let maxPnL = 0;
    let maxDrawdown = 0;
    
    for (const pnl of history) {
      maxPnL = Math.max(maxPnL, pnl.totalPnL);
      const drawdown = maxPnL - pnl.totalPnL;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return maxDrawdown;
  }

  // Calculate max profit for position
  private calculateMaxProfit(positionId: string): number {
    const history = this.pnlHistory.get(positionId) || [];
    if (history.length === 0) return 0;
    
    return Math.max(...history.map(pnl => pnl.totalPnL));
  }

  // Calculate Sharpe ratio
  private calculateSharpeRatio(): number {
    // Simplified Sharpe ratio calculation
    const returns = [this.dailyPnL, this.weeklyPnL, this.monthlyPnL];
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  // Get position by ID
  getPosition(positionId: string): Position | null {
    return this.positions.get(positionId) || null;
  }

  // Get all positions
  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  // Get P&L history for position
  getPnLHistory(positionId: string): PnLData[] {
    return this.pnlHistory.get(positionId) || [];
  }

  // Get auto-close rules for position
  getAutoCloseRules(positionId: string): AutoCloseRule[] {
    return this.autoCloseRules.get(positionId) || [];
  }

  // Stop the tracker
  async stop(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.isRunning = false;
    logger.info('📈 Real-time P&L Tracker stopped');
  }

  // Get tracker statistics
  getStats(): {
    totalPositions: number;
    openPositions: number;
    closedPositions: number;
    totalPnL: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
    maxDrawdown: number;
    isRunning: boolean;
  } {
    const positions = Array.from(this.positions.values());
    const openPositions = positions.filter(p => p.status === 'OPEN').length;
    const closedPositions = positions.filter(p => p.status === 'CLOSED').length;
    
    const portfolioPnL = this.getPortfolioPnL();
    
    return {
      totalPositions: positions.length,
      openPositions,
      closedPositions,
      totalPnL: portfolioPnL.totalPnL,
      winRate: portfolioPnL.winRate,
      averageWin: portfolioPnL.averageWin,
      averageLoss: portfolioPnL.averageLoss,
      maxDrawdown: portfolioPnL.maxDrawdown,
      isRunning: this.isRunning
    };
  }
}
