import { logger } from '../utils/logger';
import { Position, IPosition } from '../models/Position';
import { MarginAccount, IMarginAccount } from '../models/MarginAccount';
import { Trade } from '../models/Trade';

export class LeverageTradingEngine {
  private isRunning: boolean = false;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    logger.info('🚀 Leverage Trading Engine initialized');
  }

  // Start the engine
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Leverage trading engine is already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Starting leverage trading engine...');

    // Start position monitoring
    this.startPositionMonitoring();
    
    // Start liquidation monitoring
    this.startLiquidationMonitoring();
  }

  // Stop the engine
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Leverage trading engine is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    logger.info('🛑 Leverage trading engine stopped');
  }

  // Open a new leveraged position
  async openPosition(
    userId: string,
    symbol: string,
    type: 'LONG' | 'SHORT',
    size: number,
    leverage: number,
    entryPrice: number,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<IPosition> {
    try {
      // Check margin account
      const marginAccount = await MarginAccount.findOne({ userId });
      if (!marginAccount) {
        throw new Error('Margin account not found');
      }

      // Calculate required margin
      const positionValue = size * entryPrice;
      const requiredMargin = positionValue / leverage;

      // Check if enough margin available
      if (requiredMargin > marginAccount.marginFree) {
        throw new Error(`Insufficient margin. Required: $${requiredMargin.toFixed(2)}, Available: $${marginAccount.marginFree.toFixed(2)}`);
      }

      // Calculate liquidation price
      const liquidationPrice = this.calculateLiquidationPrice(type, entryPrice, leverage, marginAccount.liquidationThreshold);

      // Create position
      const position = new Position({
        userId,
        symbol,
        type,
        size,
        entryPrice,
        currentPrice: entryPrice,
        leverage,
        margin: requiredMargin,
        marginUsed: requiredMargin,
        liquidationPrice,
        stopLoss,
        takeProfit,
        exchange: 'Binance', // Default exchange
        orderId: `${symbol}_${type}_${Date.now()}`
      });

      await position.save();

      // Update margin account
      marginAccount.marginUsed += requiredMargin;
      marginAccount.openPositions += 1;
      marginAccount.totalPositions += 1;
      await marginAccount.save();

      // Create trade record
      await Trade.create({
        userId,
        symbol,
        type: type === 'LONG' ? 'BUY' : 'SELL',
        amount: size,
        price: entryPrice,
        total: positionValue,
        fee: positionValue * 0.001, // 0.1% fee
        exchange: 'Binance',
        status: 'COMPLETED',
        orderId: position.orderId,
        leverage,
        margin: requiredMargin
      });

      logger.info(`✅ Opened ${type} position: ${symbol} ${size} @ $${entryPrice} (${leverage}x)`);
      return position;

    } catch (error) {
      logger.error(`❌ Failed to open position: ${error.message}`);
      throw error;
    }
  }

  // Close a position
  async closePosition(positionId: string, exitPrice: number): Promise<void> {
    try {
      const position = await Position.findById(positionId);
      if (!position) {
        throw new Error('Position not found');
      }

      // Calculate PnL
      const positionValue = position.size * exitPrice;
      const entryValue = position.size * position.entryPrice;
      
      let pnl: number;
      if (position.type === 'LONG') {
        pnl = positionValue - entryValue;
      } else {
        pnl = entryValue - positionValue;
      }

      const pnlPercent = (pnl / entryValue) * 100;

      // Update position
      position.currentPrice = exitPrice;
      position.pnl = pnl;
      position.pnlPercent = pnlPercent;
      position.realizedPnL = pnl;
      position.status = 'CLOSED';
      position.updatedAt = new Date();
      await position.save();

      // Update margin account
      const marginAccount = await MarginAccount.findOne({ userId: position.userId });
      if (marginAccount) {
        marginAccount.marginUsed -= position.margin;
        marginAccount.openPositions -= 1;
        marginAccount.totalPnL += pnl;
        marginAccount.dailyPnL += pnl;
        
        // Update win rate
        if (pnl > 0) {
          const totalWins = marginAccount.totalPositions * marginAccount.winRate;
          marginAccount.winRate = (totalWins + 1) / marginAccount.totalPositions;
        }
        
        await marginAccount.save();
      }

      // Create closing trade record
      await Trade.create({
        userId: position.userId,
        symbol: position.symbol,
        type: position.type === 'LONG' ? 'SELL' : 'BUY',
        amount: position.size,
        price: exitPrice,
        total: positionValue,
        fee: positionValue * 0.001,
        exchange: 'Binance',
        status: 'COMPLETED',
        orderId: `${position.orderId}_CLOSE`,
        leverage: position.leverage,
        margin: position.margin
      });

      logger.info(`✅ Closed position: ${position.symbol} ${position.type} - PnL: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);

    } catch (error) {
      logger.error(`❌ Failed to close position: ${error.message}`);
      throw error;
    }
  }

  // Calculate liquidation price
  private calculateLiquidationPrice(
    type: 'LONG' | 'SHORT',
    entryPrice: number,
    leverage: number,
    liquidationThreshold: number
  ): number {
    if (type === 'LONG') {
      // For LONG: liquidation when price drops below threshold
      return entryPrice * (1 - (1 / leverage) * liquidationThreshold);
    } else {
      // For SHORT: liquidation when price rises above threshold
      return entryPrice * (1 + (1 / leverage) * liquidationThreshold);
    }
  }

  // Start position monitoring
  private startPositionMonitoring(): void {
    this.updateInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const openPositions = await Position.find({ status: 'OPEN' });
        
        for (const position of openPositions) {
          // Update current price (in real app, this would come from exchange API)
          const currentPrice = await this.getCurrentPrice(position.symbol);
          position.currentPrice = currentPrice;
          
          // Calculate unrealized PnL
          const entryValue = position.size * position.entryPrice;
          const currentValue = position.size * currentPrice;
          
          let unrealizedPnL: number;
          if (position.type === 'LONG') {
            unrealizedPnL = currentValue - entryValue;
          } else {
            unrealizedPnL = entryValue - currentValue;
          }
          
          position.unrealizedPnL = unrealizedPnL;
          position.pnlPercent = (unrealizedPnL / entryValue) * 100;
          
          await position.save();
        }
      } catch (error) {
        logger.error('Error updating positions:', error);
      }
    }, 5000); // Update every 5 seconds
  }

  // Start liquidation monitoring
  private startLiquidationMonitoring(): void {
    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const openPositions = await Position.find({ status: 'OPEN' });
        
        for (const position of openPositions) {
          // Check if position should be liquidated
          if (this.shouldLiquidate(position)) {
            await this.liquidatePosition(position);
          }
          
          // Check stop loss and take profit
          if (position.stopLoss && this.shouldTriggerStopLoss(position)) {
            await this.closePosition(position._id.toString(), position.stopLoss);
          }
          
          if (position.takeProfit && this.shouldTriggerTakeProfit(position)) {
            await this.closePosition(position._id.toString(), position.takeProfit);
          }
        }
      } catch (error) {
        logger.error('Error monitoring liquidations:', error);
      }
    }, 1000); // Check every second
  }

  // Check if position should be liquidated
  private shouldLiquidate(position: IPosition): boolean {
    if (position.type === 'LONG') {
      return position.currentPrice <= position.liquidationPrice;
    } else {
      return position.currentPrice >= position.liquidationPrice;
    }
  }

  // Check if stop loss should be triggered
  private shouldTriggerStopLoss(position: IPosition): boolean {
    if (!position.stopLoss) return false;
    
    if (position.type === 'LONG') {
      return position.currentPrice <= position.stopLoss;
    } else {
      return position.currentPrice >= position.stopLoss;
    }
  }

  // Check if take profit should be triggered
  private shouldTriggerTakeProfit(position: IPosition): boolean {
    if (!position.takeProfit) return false;
    
    if (position.type === 'LONG') {
      return position.currentPrice >= position.takeProfit;
    } else {
      return position.currentPrice <= position.takeProfit;
    }
  }

  // Liquidate a position
  private async liquidatePosition(position: IPosition): Promise<void> {
    try {
      position.status = 'LIQUIDATED';
      position.currentPrice = position.liquidationPrice;
      position.realizedPnL = position.unrealizedPnL;
      await position.save();

      // Update margin account
      const marginAccount = await MarginAccount.findOne({ userId: position.userId });
      if (marginAccount) {
        marginAccount.marginUsed -= position.margin;
        marginAccount.openPositions -= 1;
        marginAccount.totalPnL += position.realizedPnL;
        marginAccount.dailyPnL += position.realizedPnL;
        await marginAccount.save();
      }

      logger.warn(`🚨 Position liquidated: ${position.symbol} ${position.type} @ $${position.liquidationPrice}`);

    } catch (error) {
      logger.error('Error liquidating position:', error);
    }
  }

  // Get current price (mock implementation - replace with real exchange API)
  private async getCurrentPrice(symbol: string): Promise<number> {
    // Mock price - replace with real API call
    const basePrice = symbol === 'BTC' ? 45000 : symbol === 'ETH' ? 2500 : 100;
    const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
    return basePrice * (1 + variation);
  }

  // Get engine status
  getStatus(): { isRunning: boolean; openPositions: number } {
    return {
      isRunning: this.isRunning,
      openPositions: 0 // This would be updated in real implementation
    };
  }
}
