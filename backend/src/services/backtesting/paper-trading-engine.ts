import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface PaperTrade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  currentPrice: number;
  entryTime: number;
  status: 'OPEN' | 'CLOSED';
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: {
    distance: number;
    activated: boolean;
    highestPrice?: number;
    lowestPrice?: number;
  };
  fees: number;
  unrealizedPnL: number;
  realizedPnL: number;
  reason?: string;
}

export interface PaperPortfolio {
  id: string;
  name: string;
  initialCapital: number;
  currentCapital: number;
  totalValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  totalPnLPercent: number;
  openTrades: PaperTrade[];
  closedTrades: PaperTrade[];
  performance: {
    winRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    averageWin: number;
    averageLoss: number;
    largestWin: number;
    largestLoss: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface PaperTradingConfig {
  portfolioId: string;
  initialCapital: number;
  maxPositions: number;
  riskPerTrade: number; // Percentage of capital to risk per trade
  commission: number; // Percentage commission per trade
  slippage: number; // Percentage slippage per trade
  autoClose: {
    stopLoss: number; // Percentage stop loss
    takeProfit: number; // Percentage take profit
    trailingStop: number; // Percentage trailing stop distance
    timeBased: number; // Maximum time in trade (hours)
  };
  symbols: string[];
  strategies: string[];
}

export interface PaperTradingSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'CLOSE';
  strength: number;
  reason: string;
  timestamp: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
}

export class PaperTradingEngine extends EventEmitter {
  private portfolios: Map<string, PaperPortfolio> = new Map();
  private activeConfigs: Map<string, PaperTradingConfig> = new Map();
  private priceFeeds: Map<string, number> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    logger.info('📝 Initializing Paper Trading Engine...');
    
    // Start price monitoring
    this.startPriceMonitoring();
    
    // Start portfolio updates
    this.startPortfolioUpdates();
    
    this.isRunning = true;
    logger.info('✅ Paper Trading Engine initialized');
  }

  // Create new paper trading portfolio
  async createPortfolio(config: PaperTradingConfig): Promise<string> {
    try {
      const portfolio: PaperPortfolio = {
        id: config.portfolioId,
        name: `Paper Portfolio ${config.portfolioId}`,
        initialCapital: config.initialCapital,
        currentCapital: config.initialCapital,
        totalValue: config.initialCapital,
        unrealizedPnL: 0,
        realizedPnL: 0,
        totalPnL: 0,
        totalPnLPercent: 0,
        openTrades: [],
        closedTrades: [],
        performance: {
          winRate: 0,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          averageWin: 0,
          averageLoss: 0,
          largestWin: 0,
          largestLoss: 0,
          maxDrawdown: 0,
          sharpeRatio: 0
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      this.portfolios.set(config.portfolioId, portfolio);
      this.activeConfigs.set(config.portfolioId, config);
      
      this.emit('portfolioCreated', portfolio);
      
      logger.info(`📝 Paper portfolio created: ${config.portfolioId} with ${config.initialCapital} capital`);
      
      return config.portfolioId;

    } catch (error) {
      logger.error('❌ Failed to create paper portfolio:', error);
      throw error;
    }
  }

  // Execute paper trade
  async executeTrade(portfolioId: string, signal: PaperTradingSignal): Promise<boolean> {
    try {
      const portfolio = this.portfolios.get(portfolioId);
      const config = this.activeConfigs.get(portfolioId);
      
      if (!portfolio || !config) {
        logger.warn(`⚠️ Portfolio or config not found: ${portfolioId}`);
        return false;
      }

      if (signal.action === 'BUY' || signal.action === 'SELL') {
        return await this.openTrade(portfolio, config, signal);
      } else if (signal.action === 'CLOSE') {
        return await this.closeTrade(portfolio, config, signal);
      }

      return false;

    } catch (error) {
      logger.error('❌ Failed to execute paper trade:', error);
      return false;
    }
  }

  private async openTrade(
    portfolio: PaperPortfolio, 
    config: PaperTradingConfig, 
    signal: PaperTradingSignal
  ): Promise<boolean> {
    try {
      // Check if we can open a new position
      if (portfolio.openTrades.length >= config.maxPositions) {
        logger.warn(`⚠️ Maximum positions reached for portfolio ${portfolio.id}`);
        return false;
      }

      // Check if we already have a position in this symbol
      const existingTrade = portfolio.openTrades.find(t => t.symbol === signal.symbol);
      if (existingTrade) {
        logger.warn(`⚠️ Position already exists for ${signal.symbol} in portfolio ${portfolio.id}`);
        return false;
      }

      // Calculate position size
      const riskAmount = portfolio.currentCapital * (config.riskPerTrade / 100);
      const positionSize = riskAmount / signal.price;
      
      // Check if we have enough capital
      const requiredCapital = positionSize * signal.price;
      if (requiredCapital > portfolio.currentCapital) {
        logger.warn(`⚠️ Insufficient capital for trade in portfolio ${portfolio.id}`);
        return false;
      }

      // Create trade
      const trade: PaperTrade = {
        id: `PAPER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol: signal.symbol,
        side: signal.action === 'BUY' ? 'LONG' : 'SHORT',
        size: positionSize,
        entryPrice: signal.price,
        currentPrice: signal.price,
        entryTime: signal.timestamp,
        status: 'OPEN',
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        trailingStop: signal.trailingStop ? {
          distance: signal.trailingStop,
          activated: false
        } : undefined,
        fees: requiredCapital * (config.commission / 100),
        unrealizedPnL: 0,
        realizedPnL: 0
      };

      // Update portfolio
      portfolio.openTrades.push(trade);
      portfolio.currentCapital -= requiredCapital;
      portfolio.updatedAt = Date.now();

      this.emit('tradeOpened', { portfolio, trade });
      
      logger.info(`📝 Paper trade opened: ${trade.id} - ${signal.symbol} ${trade.side} ${trade.size}`);
      
      return true;

    } catch (error) {
      logger.error('❌ Failed to open paper trade:', error);
      return false;
    }
  }

  private async closeTrade(
    portfolio: PaperPortfolio, 
    config: PaperTradingConfig, 
    signal: PaperTradingSignal
  ): Promise<boolean> {
    try {
      const tradeIndex = portfolio.openTrades.findIndex(t => t.symbol === signal.symbol);
      if (tradeIndex === -1) {
        logger.warn(`⚠️ No open position found for ${signal.symbol} in portfolio ${portfolio.id}`);
        return false;
      }

      const trade = portfolio.openTrades[tradeIndex];
      
      // Calculate P&L
      const entryValue = trade.size * trade.entryPrice;
      const exitValue = trade.size * signal.price;
      
      let pnl: number;
      if (trade.side === 'LONG') {
        pnl = exitValue - entryValue;
      } else {
        pnl = entryValue - exitValue;
      }
      
      const fees = exitValue * (config.commission / 100);
      const slippage = exitValue * (config.slippage / 100);
      const netPnl = pnl - fees - slippage;
      
      // Update trade
      trade.status = 'CLOSED';
      trade.currentPrice = signal.price;
      trade.realizedPnL = netPnl;
      trade.fees += fees;
      
      // Update portfolio
      portfolio.openTrades.splice(tradeIndex, 1);
      portfolio.closedTrades.push(trade);
      portfolio.currentCapital += exitValue + netPnl;
      portfolio.realizedPnL += netPnl;
      portfolio.updatedAt = Date.now();

      // Update performance metrics
      this.updatePerformanceMetrics(portfolio);

      this.emit('tradeClosed', { portfolio, trade });
      
      logger.info(`📝 Paper trade closed: ${trade.id} - P&L: ${netPnl.toFixed(2)}`);
      
      return true;

    } catch (error) {
      logger.error('❌ Failed to close paper trade:', error);
      return false;
    }
  }

  // Check and execute auto-close conditions
  private async checkAutoCloseConditions(): Promise<void> {
    try {
      for (const [portfolioId, portfolio] of this.portfolios) {
        const config = this.activeConfigs.get(portfolioId);
        if (!config) continue;

        for (const trade of portfolio.openTrades) {
          const shouldClose = this.shouldCloseTrade(trade, config);
          if (shouldClose.shouldClose) {
            await this.closeTrade(portfolio, config, {
              symbol: trade.symbol,
              action: 'CLOSE',
              strength: 1.0,
              reason: shouldClose.reason,
              timestamp: Date.now(),
              price: trade.currentPrice
            });
          }
        }
      }
    } catch (error) {
      logger.error('❌ Auto-close condition check failed:', error);
    }
  }

  private shouldCloseTrade(trade: PaperTrade, config: PaperTradingConfig): { shouldClose: boolean; reason: string } {
    // Check stop loss
    if (trade.stopLoss) {
      if (trade.side === 'LONG' && trade.currentPrice <= trade.stopLoss) {
        return { shouldClose: true, reason: 'Stop Loss' };
      }
      if (trade.side === 'SHORT' && trade.currentPrice >= trade.stopLoss) {
        return { shouldClose: true, reason: 'Stop Loss' };
      }
    }

    // Check take profit
    if (trade.takeProfit) {
      if (trade.side === 'LONG' && trade.currentPrice >= trade.takeProfit) {
        return { shouldClose: true, reason: 'Take Profit' };
      }
      if (trade.side === 'SHORT' && trade.currentPrice <= trade.takeProfit) {
        return { shouldClose: true, reason: 'Take Profit' };
      }
    }

    // Check trailing stop
    if (trade.trailingStop) {
      const trailingStop = trade.trailingStop;
      
      if (trade.side === 'LONG') {
        if (trade.currentPrice > (trailingStop.highestPrice || trade.entryPrice)) {
          trailingStop.highestPrice = trade.currentPrice;
          trailingStop.activated = true;
        }
        if (trailingStop.activated && trade.currentPrice <= (trailingStop.highestPrice! - trailingStop.distance)) {
          return { shouldClose: true, reason: 'Trailing Stop' };
        }
      } else {
        if (trade.currentPrice < (trailingStop.lowestPrice || trade.entryPrice)) {
          trailingStop.lowestPrice = trade.currentPrice;
          trailingStop.activated = true;
        }
        if (trailingStop.activated && trade.currentPrice >= (trailingStop.lowestPrice! + trailingStop.distance)) {
          return { shouldClose: true, reason: 'Trailing Stop' };
        }
      }
    }

    // Check time-based close
    if (config.autoClose.timeBased) {
      const timeInTrade = (Date.now() - trade.entryTime) / (1000 * 60 * 60); // hours
      if (timeInTrade >= config.autoClose.timeBased) {
        return { shouldClose: true, reason: 'Time Based' };
      }
    }

    return { shouldClose: false, reason: '' };
  }

  // Update portfolio values
  private async updatePortfolioValues(): Promise<void> {
    try {
      for (const [portfolioId, portfolio] of this.portfolios) {
        let totalUnrealizedPnL = 0;
        let totalValue = portfolio.currentCapital;

        // Update open trades
        for (const trade of portfolio.openTrades) {
          const currentPrice = this.priceFeeds.get(trade.symbol) || trade.currentPrice;
          trade.currentPrice = currentPrice;

          // Calculate unrealized P&L
          const entryValue = trade.size * trade.entryPrice;
          const currentValue = trade.size * currentPrice;
          
          let unrealizedPnL: number;
          if (trade.side === 'LONG') {
            unrealizedPnL = currentValue - entryValue;
          } else {
            unrealizedPnL = entryValue - currentValue;
          }
          
          trade.unrealizedPnL = unrealizedPnL;
          totalUnrealizedPnL += unrealizedPnL;
          totalValue += currentValue;
        }

        // Update portfolio
        portfolio.unrealizedPnL = totalUnrealizedPnL;
        portfolio.totalValue = totalValue;
        portfolio.totalPnL = portfolio.realizedPnL + totalUnrealizedPnL;
        portfolio.totalPnLPercent = (portfolio.totalPnL / portfolio.initialCapital) * 100;
        portfolio.updatedAt = Date.now();
      }
    } catch (error) {
      logger.error('❌ Portfolio value update failed:', error);
    }
  }

  private updatePerformanceMetrics(portfolio: PaperPortfolio): void {
    const closedTrades = portfolio.closedTrades;
    const totalTrades = closedTrades.length;
    
    if (totalTrades === 0) return;

    const winningTrades = closedTrades.filter(t => t.realizedPnL > 0);
    const losingTrades = closedTrades.filter(t => t.realizedPnL < 0);
    
    const winRate = totalTrades > 0 ? winningTrades.length / totalTrades : 0;
    
    const averageWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, t) => sum + t.realizedPnL, 0) / winningTrades.length : 0;
    
    const averageLoss = losingTrades.length > 0 ? 
      losingTrades.reduce((sum, t) => sum + t.realizedPnL, 0) / losingTrades.length : 0;
    
    const largestWin = winningTrades.length > 0 ? 
      Math.max(...winningTrades.map(t => t.realizedPnL)) : 0;
    
    const largestLoss = losingTrades.length > 0 ? 
      Math.min(...losingTrades.map(t => t.realizedPnL)) : 0;

    // Calculate max drawdown (simplified)
    let maxDrawdown = 0;
    let peak = portfolio.initialCapital;
    
    for (const trade of closedTrades) {
      const tradeValue = portfolio.initialCapital + trade.realizedPnL;
      if (tradeValue > peak) {
        peak = tradeValue;
      }
      const drawdown = (peak - tradeValue) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    // Calculate Sharpe ratio (simplified)
    const returns = closedTrades.map(t => t.realizedPnL / portfolio.initialCapital);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    portfolio.performance = {
      winRate,
      totalTrades,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      averageWin,
      averageLoss,
      largestWin,
      largestLoss,
      maxDrawdown,
      sharpeRatio
    };
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
      const symbols = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'DOT', 'MATIC', 'AVAX'];
      
      for (const symbol of symbols) {
        // Simulate price movement (in real implementation, get from price feed)
        const currentPrice = this.priceFeeds.get(symbol) || (symbol === 'BTC' ? 50000 : 1000);
        const priceChange = (Math.random() - 0.5) * currentPrice * 0.001; // 0.1% random change
        const newPrice = currentPrice + priceChange;
        
        this.priceFeeds.set(symbol, newPrice);
      }
    } catch (error) {
      logger.error('❌ Price update failed:', error);
    }
  }

  // Start portfolio updates
  private startPortfolioUpdates(): void {
    this.updateInterval = setInterval(async () => {
      await this.updatePortfolioValues();
      await this.checkAutoCloseConditions();
    }, 5000); // Update every 5 seconds
  }

  // Public methods
  getPortfolio(portfolioId: string): PaperPortfolio | null {
    return this.portfolios.get(portfolioId) || null;
  }

  getAllPortfolios(): PaperPortfolio[] {
    return Array.from(this.portfolios.values());
  }

  getPortfolioConfig(portfolioId: string): PaperTradingConfig | null {
    return this.activeConfigs.get(portfolioId) || null;
  }

  updatePortfolioConfig(portfolioId: string, config: Partial<PaperTradingConfig>): boolean {
    const existingConfig = this.activeConfigs.get(portfolioId);
    if (!existingConfig) return false;

    const updatedConfig = { ...existingConfig, ...config };
    this.activeConfigs.set(portfolioId, updatedConfig);
    
    logger.info(`📝 Portfolio config updated: ${portfolioId}`);
    return true;
  }

  deletePortfolio(portfolioId: string): boolean {
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) return false;

    this.portfolios.delete(portfolioId);
    this.activeConfigs.delete(portfolioId);
    
    this.emit('portfolioDeleted', portfolio);
    
    logger.info(`📝 Portfolio deleted: ${portfolioId}`);
    return true;
  }

  getCurrentPrice(symbol: string): number {
    return this.priceFeeds.get(symbol) || 0;
  }

  isEngineRunning(): boolean {
    return this.isRunning;
  }

  // Stop the engine
  async stop(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.isRunning = false;
    logger.info('📝 Paper Trading Engine stopped');
  }
}
