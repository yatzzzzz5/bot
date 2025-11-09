import * as ccxt from 'ccxt';
import { logger } from '../utils/logger';
import { realTimePriceService } from './real-time-price-service';
import { Position } from '../models/Position';
import { MarginAccount } from '../models/MarginAccount';

export interface TradingSignal {
  symbol: string;
  type: 'LONG' | 'SHORT' | 'HOLD';
  strength: 'WEAK' | 'MEDIUM' | 'STRONG';
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  leverage: number;
  reason: string;
  timestamp: Date;
}

export interface LivePosition {
  id: string;
  symbol: string;
  type: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  margin: number;
  unrealizedPnL: number;
  pnlPercent: number;
  liquidationPrice: number;
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  stopLoss?: number;
  takeProfit?: number;
  lastUpdate: Date;
}

class RealTimeTradingService {
  private binance: ccxt.binance;
  private isRunning: boolean = false;
  private updateInterval: NodeJS.Timeout | null = null;
  private riskCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    const apiKey = process.env.BINANCE_API_KEY;
    const secretKey = process.env.BINANCE_SECRET_KEY;
    
    // Only initialize if API keys are provided and not placeholder values
    if (apiKey && secretKey && 
        apiKey !== '' && secretKey !== '' && 
        !apiKey.includes('test_api_key') && !secretKey.includes('test_secret_key')) {
      this.binance = new ccxt.binance({
        apiKey,
        secret: secretKey,
        sandbox: process.env.BINANCE_SANDBOX === 'true',
        testnet: process.env.BINANCE_TESTNET === 'true',
        enableRateLimit: true,
        options: {
          defaultType: 'future',
          adjustForTimeDifference: true,
        }
      });
      try {
        (this.binance as any).options = (this.binance as any).options || {};
        (this.binance as any).options.recvWindow = parseInt(process.env.BINANCE_RECV_WINDOW || '60000');
      } catch {}
      logger.info('🚀 Real-time trading service initialized with Binance API');
    } else {
      logger.info('ℹ️ Real-time trading service initialized in demo mode (no valid API keys)');
    }
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('📈 Starting real-time trading service...');
    
    // Start real-time price updates
    await realTimePriceService.start();
    
    // Start position monitoring
    this.updateInterval = setInterval(async () => {
      await this.updateAllPositions();
    }, 2000); // Update every 2 seconds
    
    // Start risk monitoring
    this.riskCheckInterval = setInterval(async () => {
      await this.checkRiskLevels();
    }, 5000); // Check every 5 seconds
    
    // Initial update
    await this.updateAllPositions();
  }

  async stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.riskCheckInterval) {
      clearInterval(this.riskCheckInterval);
      this.riskCheckInterval = null;
    }
    
    await realTimePriceService.stop();
    this.isRunning = false;
    logger.info('🛑 Real-time trading service stopped');
  }

  private async updateAllPositions() {
    try {
      // Update margin account with real-time data
      await this.updateMarginAccount();
      
      const positions = await Position.find({ status: 'OPEN' });
      
      for (const position of positions) {
        await this.updatePositionPrice(position);
      }
    } catch (error) {
      logger.error('Error updating positions:', error);
    }
  }

  private async updateMarginAccount() {
    try {
      const positions = await Position.find({ status: 'OPEN' });
      let marginAccount = await MarginAccount.findOne();
      
      if (!marginAccount) {
        marginAccount = await MarginAccount.create({
          totalBalance: 100000,
          marginBalance: 50000,
          marginUsed: 0,
          marginFree: 50000,
          marginRatio: 0,
          riskLevel: 'LOW',
          maxLeverage: 100,
          dailyPnL: 0,
          totalPnL: 0,
          maxDrawdown: 0,
          openPositions: 0,
          totalPositions: 0,
          winRate: 0
        });
      }

      // Calculate real-time values
      const totalMarginUsed = positions.reduce((sum, pos) => sum + (pos.margin || 0), 0);
      const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + (pos.unrealizedPnL || 0), 0);
      const marginBalance = marginAccount.totalBalance + totalUnrealizedPnL;
      const marginFree = marginBalance - totalMarginUsed;
      const marginRatio = totalMarginUsed > 0 ? totalMarginUsed / marginBalance : 0;
      
      // Determine risk level based on margin ratio
      let riskLevel = 'LOW';
      if (marginRatio > 0.8) riskLevel = 'EXTREME';
      else if (marginRatio > 0.6) riskLevel = 'HIGH';
      else if (marginRatio > 0.4) riskLevel = 'MEDIUM';

      // Update margin account
      await MarginAccount.findByIdAndUpdate(marginAccount._id, {
        marginBalance,
        marginUsed: totalMarginUsed,
        marginFree,
        marginRatio,
        riskLevel,
        openPositions: positions.length,
        totalPositions: positions.length,
        dailyPnL: totalUnrealizedPnL,
        totalPnL: totalUnrealizedPnL,
        updatedAt: new Date()
      });

      // logger.debug(`Margin account updated: Balance: $${marginBalance.toFixed(2)}, Used: $${totalMarginUsed.toFixed(2)}, Ratio: ${(marginRatio * 100).toFixed(2)}%`);
    } catch (error) {
      logger.error('Error updating margin account:', error);
    }
  }

  private async updatePositionPrice(position: any) {
    try {
      // Skip if no Binance API key configured
      if (!this.binance) {
        return;
      }

      const currentPrice = realTimePriceService.getCurrentPrice(position.symbol);
      
      if (currentPrice > 0) {
        // Calculate unrealized PnL
        const entryValue = position.size * position.entryPrice;
        const currentValue = position.size * currentPrice;
        
        let unrealizedPnL: number;
        if (position.type === 'LONG') {
          unrealizedPnL = currentValue - entryValue;
        } else {
          unrealizedPnL = entryValue - currentValue;
        }
        
        const pnlPercent = (unrealizedPnL / entryValue) * 100;
        
        // Update position
        position.currentPrice = currentPrice;
        position.unrealizedPnL = unrealizedPnL;
        position.pnlPercent = pnlPercent;
        position.lastUpdate = new Date();
        
        await position.save();
        
        // Check stop-loss and take-profit
        await this.checkStopLossTakeProfit(position);
        
        // Check liquidation
        await this.checkLiquidation(position);
      }
    } catch (error) {
      logger.error(`Error updating position ${position._id}:`, error);
    }
  }

  private async checkStopLossTakeProfit(position: any) {
    try {
      if (position.stopLoss && position.currentPrice <= position.stopLoss && position.type === 'LONG') {
        logger.warn(`🛑 Stop-loss triggered for ${position.symbol} LONG @ $${position.currentPrice}`);
        await this.closePosition(position._id, position.currentPrice, 'STOP_LOSS');
      }
      
      if (position.stopLoss && position.currentPrice >= position.stopLoss && position.type === 'SHORT') {
        logger.warn(`🛑 Stop-loss triggered for ${position.symbol} SHORT @ $${position.currentPrice}`);
        await this.closePosition(position._id, position.currentPrice, 'STOP_LOSS');
      }
      
      if (position.takeProfit && position.currentPrice >= position.takeProfit && position.type === 'LONG') {
        logger.info(`🎯 Take-profit triggered for ${position.symbol} LONG @ $${position.currentPrice}`);
        await this.closePosition(position._id, position.currentPrice, 'TAKE_PROFIT');
      }
      
      if (position.takeProfit && position.currentPrice <= position.takeProfit && position.type === 'SHORT') {
        logger.info(`🎯 Take-profit triggered for ${position.symbol} SHORT @ $${position.currentPrice}`);
        await this.closePosition(position._id, position.currentPrice, 'TAKE_PROFIT');
      }
    } catch (error) {
      logger.error(`Error checking stop-loss/take-profit for position ${position._id}:`, error);
    }
  }

  private async checkLiquidation(position: any) {
    try {
      if (position.currentPrice <= position.liquidationPrice && position.type === 'LONG') {
        logger.error(`💥 LIQUIDATION for ${position.symbol} LONG @ $${position.currentPrice}`);
        await this.closePosition(position._id, position.currentPrice, 'LIQUIDATED');
      }
      
      if (position.currentPrice >= position.liquidationPrice && position.type === 'SHORT') {
        logger.error(`💥 LIQUIDATION for ${position.symbol} SHORT @ $${position.currentPrice}`);
        await this.closePosition(position._id, position.currentPrice, 'LIQUIDATED');
      }
    } catch (error) {
      logger.error(`Error checking liquidation for position ${position._id}:`, error);
    }
  }

  private async closePosition(positionId: string, exitPrice: number, reason: string) {
    try {
      const position = await Position.findById(positionId);
      if (!position) return;
      
      // Calculate realized PnL
      const entryValue = position.size * position.entryPrice;
      const exitValue = position.size * exitPrice;
      
      let realizedPnL: number;
      if (position.type === 'LONG') {
        realizedPnL = exitValue - entryValue;
      } else {
        realizedPnL = entryValue - exitValue;
      }
      
      // Update position
      position.currentPrice = exitPrice;
      position.realizedPnL = realizedPnL;
      position.status = 'CLOSED';
      position.updatedAt = new Date();
      await position.save();
      
      // Update margin account
      const marginAccount = await MarginAccount.findOne();
      if (marginAccount) {
        marginAccount.marginUsed -= position.margin;
        marginAccount.openPositions -= 1;
        marginAccount.totalPnL += realizedPnL;
        marginAccount.dailyPnL += realizedPnL;
        await marginAccount.save();
      }
      
      logger.info(`✅ Position closed: ${position.symbol} ${position.type} - PnL: $${realizedPnL.toFixed(2)} (${reason})`);
    } catch (error) {
      logger.error(`Error closing position ${positionId}:`, error);
    }
  }

  private async checkRiskLevels() {
    try {
      const marginAccount = await MarginAccount.findOne();
      if (!marginAccount) return;
      
      // Check margin ratio
      const marginRatio = marginAccount.marginUsed / marginAccount.marginBalance;
      
      if (marginRatio > 0.8) {
        logger.warn(`⚠️ HIGH RISK: Margin ratio ${(marginRatio * 100).toFixed(2)}%`);
      }
      
      if (marginRatio > 0.9) {
        logger.error(`🚨 CRITICAL RISK: Margin ratio ${(marginRatio * 100).toFixed(2)}% - Consider closing positions!`);
      }
    } catch (error) {
      logger.error('Error checking risk levels:', error);
    }
  }

  async openPosition(symbol: string, type: 'LONG' | 'SHORT', size: number, leverage: number, stopLoss?: number, takeProfit?: number) {
    try {
      const currentPrice = realTimePriceService.getCurrentPrice(symbol);
      if (currentPrice <= 0) {
        throw new Error('Unable to get current price');
      }
      
      // Calculate required margin
      const positionValue = size * currentPrice;
      const requiredMargin = positionValue / leverage;
      
      // Check margin availability
      const marginAccount = await MarginAccount.findOne();
      if (!marginAccount || marginAccount.marginFree < requiredMargin) {
        throw new Error('Insufficient margin');
      }
      
      // Calculate liquidation price
      const liquidationPrice = type === 'LONG' 
        ? currentPrice * (1 - (1 / leverage) * 0.8)
        : currentPrice * (1 + (1 / leverage) * 0.8);
      
      // Create position
      const position = new Position({
        symbol,
        type,
        size,
        entryPrice: currentPrice,
        currentPrice: currentPrice,
        leverage,
        margin: requiredMargin,
        marginUsed: requiredMargin,
        liquidationPrice,
        stopLoss,
        takeProfit,
        exchange: 'Binance',
        orderId: `${symbol}_${type}_${Date.now()}`
      });
      
      await position.save();
      
      // Update margin account
      marginAccount.marginUsed += requiredMargin;
      marginAccount.openPositions += 1;
      marginAccount.totalPositions += 1;
      await marginAccount.save();
      
      logger.info(`✅ Opened ${type} position: ${symbol} ${size} @ $${currentPrice} (${leverage}x)`);
      
      return position;
    } catch (error) {
      logger.error('Error opening position:', error);
      throw error;
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }

  getServiceStatus() {
    return {
      isRunning: this.isRunning,
      priceServiceRunning: realTimePriceService.isServiceRunning(),
      lastUpdate: new Date()
    };
  }
}

export const realTimeTradingService = new RealTimeTradingService();
