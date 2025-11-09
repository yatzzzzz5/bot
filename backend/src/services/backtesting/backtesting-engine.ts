import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface BacktestConfig {
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  strategy: string;
  parameters: Record<string, any>;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  commission: number; // Percentage commission per trade
  slippage: number; // Percentage slippage per trade
  maxPositions: number;
  riskPerTrade: number; // Percentage of capital to risk per trade
  stopLoss: number; // Percentage stop loss
  takeProfit: number; // Percentage take profit
}

export interface BacktestResult {
  config: BacktestConfig;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  totalFees: number;
  totalSlippage: number;
  finalCapital: number;
  equityCurve: Array<{ timestamp: number; equity: number; drawdown: number }>;
  trades: BacktestTrade[];
  monthlyReturns: Array<{ month: string; return: number }>;
  riskMetrics: {
    var95: number;
    var99: number;
    expectedShortfall: number;
    beta: number;
    alpha: number;
    informationRatio: number;
  };
  performance: {
    startDate: string;
    endDate: string;
    duration: number;
    tradingDays: number;
    averageTradesPerDay: number;
    bestMonth: string;
    worstMonth: string;
    consecutiveWins: number;
    consecutiveLosses: number;
  };
}

export interface BacktestTrade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  pnlPercent: number;
  fees: number;
  slippage: number;
  duration: number;
  reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'SIGNAL' | 'TIME_BASED';
  drawdown: number;
}

export interface MarketData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
}

export interface Strategy {
  name: string;
  description: string;
  parameters: Record<string, any>;
  signals: (data: MarketData[], params: any) => Array<{
    timestamp: number;
    signal: 'BUY' | 'SELL' | 'HOLD';
    strength: number;
    reason: string;
  }>;
}

export class BacktestingEngine extends EventEmitter {
  private strategies: Map<string, Strategy> = new Map();
  private marketData: Map<string, MarketData[]> = new Map();
  private isRunning: boolean = false;

  constructor() {
    super();
    this.initializeDefaultStrategies();
  }

  async initialize(): Promise<void> {
    logger.info('📊 Initializing Backtesting Engine...');
    
    // Load historical data for common symbols
    await this.loadHistoricalData();
    
    logger.info('✅ Backtesting Engine initialized');
  }

  private initializeDefaultStrategies(): void {
    // Moving Average Crossover Strategy
    this.strategies.set('MA_CROSSOVER', {
      name: 'Moving Average Crossover',
      description: 'Buy when short MA crosses above long MA, sell when it crosses below',
      parameters: {
        shortPeriod: 10,
        longPeriod: 30,
        minVolume: 1000000
      },
      signals: (data: MarketData[], params: any) => {
        const signals: Array<{ timestamp: number; signal: 'BUY' | 'SELL' | 'HOLD'; strength: number; reason: string }> = [];
        
        if (data.length < params.longPeriod) return signals;
        
        for (let i = params.longPeriod; i < data.length; i++) {
          const shortMA = this.calculateMA(data.slice(i - params.shortPeriod, i));
          const longMA = this.calculateMA(data.slice(i - params.longPeriod, i));
          const prevShortMA = this.calculateMA(data.slice(i - params.shortPeriod - 1, i - 1));
          const prevLongMA = this.calculateMA(data.slice(i - params.longPeriod - 1, i - 1));
          
          if (prevShortMA <= prevLongMA && shortMA > longMA && data[i].volume > params.minVolume) {
            signals.push({
              timestamp: data[i].timestamp,
              signal: 'BUY',
              strength: (shortMA - longMA) / longMA,
              reason: 'MA Crossover Bullish'
            });
          } else if (prevShortMA >= prevLongMA && shortMA < longMA && data[i].volume > params.minVolume) {
            signals.push({
              timestamp: data[i].timestamp,
              signal: 'SELL',
              strength: (longMA - shortMA) / longMA,
              reason: 'MA Crossover Bearish'
            });
          }
        }
        
        return signals;
      }
    });

    // RSI Strategy
    this.strategies.set('RSI_STRATEGY', {
      name: 'RSI Mean Reversion',
      description: 'Buy when RSI is oversold, sell when RSI is overbought',
      parameters: {
        rsiPeriod: 14,
        oversold: 30,
        overbought: 70,
        minVolume: 1000000
      },
      signals: (data: MarketData[], params: any) => {
        const signals: Array<{ timestamp: number; signal: 'BUY' | 'SELL' | 'HOLD'; strength: number; reason: string }> = [];
        
        if (data.length < params.rsiPeriod + 1) return signals;
        
        for (let i = params.rsiPeriod; i < data.length; i++) {
          const rsi = this.calculateRSI(data.slice(i - params.rsiPeriod, i + 1));
          const prevRsi = this.calculateRSI(data.slice(i - params.rsiPeriod - 1, i));
          
          if (prevRsi > params.oversold && rsi <= params.oversold && data[i].volume > params.minVolume) {
            signals.push({
              timestamp: data[i].timestamp,
              signal: 'BUY',
              strength: (params.oversold - rsi) / params.oversold,
              reason: 'RSI Oversold'
            });
          } else if (prevRsi < params.overbought && rsi >= params.overbought && data[i].volume > params.minVolume) {
            signals.push({
              timestamp: data[i].timestamp,
              signal: 'SELL',
              strength: (rsi - params.overbought) / (100 - params.overbought),
              reason: 'RSI Overbought'
            });
          }
        }
        
        return signals;
      }
    });

    // Bollinger Bands Strategy
    this.strategies.set('BOLLINGER_BANDS', {
      name: 'Bollinger Bands Mean Reversion',
      description: 'Buy when price touches lower band, sell when price touches upper band',
      parameters: {
        period: 20,
        stdDev: 2,
        minVolume: 1000000
      },
      signals: (data: MarketData[], params: any) => {
        const signals: Array<{ timestamp: number; signal: 'BUY' | 'SELL' | 'HOLD'; strength: number; reason: string }> = [];
        
        if (data.length < params.period) return signals;
        
        for (let i = params.period; i < data.length; i++) {
          const sma = this.calculateMA(data.slice(i - params.period, i));
          const stdDev = this.calculateStdDev(data.slice(i - params.period, i), sma);
          const upperBand = sma + (stdDev * params.stdDev);
          const lowerBand = sma - (stdDev * params.stdDev);
          
          if (data[i].low <= lowerBand && data[i].volume > params.minVolume) {
            signals.push({
              timestamp: data[i].timestamp,
              signal: 'BUY',
              strength: (lowerBand - data[i].low) / lowerBand,
              reason: 'Bollinger Lower Band Touch'
            });
          } else if (data[i].high >= upperBand && data[i].volume > params.minVolume) {
            signals.push({
              timestamp: data[i].timestamp,
              signal: 'SELL',
              strength: (data[i].high - upperBand) / upperBand,
              reason: 'Bollinger Upper Band Touch'
            });
          }
        }
        
        return signals;
      }
    });
  }

  private async loadHistoricalData(): Promise<void> {
    // Simulate loading historical data for common symbols
    const symbols = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL'];
    
    for (const symbol of symbols) {
      const data = this.generateMockHistoricalData(symbol);
      this.marketData.set(symbol, data);
    }
    
    logger.info(`📊 Loaded historical data for ${symbols.length} symbols`);
  }

  private generateMockHistoricalData(symbol: string): MarketData[] {
    const data: MarketData[] = [];
    const startTime = Date.now() - (365 * 24 * 60 * 60 * 1000); // 1 year ago
    const interval = 60 * 60 * 1000; // 1 hour intervals
    
    let price = symbol === 'BTC' ? 30000 : symbol === 'ETH' ? 2000 : 100;
    
    for (let i = 0; i < 8760; i++) { // 1 year of hourly data
      const timestamp = startTime + (i * interval);
      const change = (Math.random() - 0.5) * 0.02; // ±1% random change
      const open = price;
      const close = price * (1 + change);
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      const volume = Math.random() * 1000000 + 100000;
      
      data.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume,
        vwap: (high + low + close) / 3
      });
      
      price = close;
    }
    
    return data;
  }

  // Main backtesting method
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    try {
      logger.info(`📊 Starting backtest for ${config.symbol} with ${config.strategy} strategy...`);
      
      this.isRunning = true;
      this.emit('backtestStarted', config);
      
      const data = this.marketData.get(config.symbol);
      if (!data) {
        throw new Error(`No historical data found for ${config.symbol}`);
      }
      
      const strategy = this.strategies.get(config.strategy);
      if (!strategy) {
        throw new Error(`Strategy ${config.strategy} not found`);
      }
      
      // Filter data by date range
      const startTime = new Date(config.startDate).getTime();
      const endTime = new Date(config.endDate).getTime();
      const filteredData = data.filter(d => d.timestamp >= startTime && d.timestamp <= endTime);
      
      if (filteredData.length === 0) {
        throw new Error('No data available for the specified date range');
      }
      
      // Generate signals
      const signals = strategy.signals(filteredData, config.parameters);
      
      // Execute backtest
      const result = await this.executeBacktest(filteredData, signals, config);
      
      this.isRunning = false;
      this.emit('backtestCompleted', result);
      
      logger.info(`✅ Backtest completed: ${result.totalTrades} trades, ${result.winRate.toFixed(1)}% win rate`);
      
      return result;
      
    } catch (error) {
      this.isRunning = false;
      this.emit('backtestError', error);
      logger.error('❌ Backtest failed:', error);
      throw error;
    }
  }

  private async executeBacktest(
    data: MarketData[], 
    signals: Array<{ timestamp: number; signal: 'BUY' | 'SELL' | 'HOLD'; strength: number; reason: string }>, 
    config: BacktestConfig
  ): Promise<BacktestResult> {
    const trades: BacktestTrade[] = [];
    const equityCurve: Array<{ timestamp: number; equity: number; drawdown: number }> = [];
    
    let capital = config.initialCapital;
    let position: { side: 'LONG' | 'SHORT'; size: number; entryPrice: number; entryTime: number } | null = null;
    let peakEquity = capital;
    let maxDrawdown = 0;
    let totalFees = 0;
    let totalSlippage = 0;
    
    const winningTrades: number[] = [];
    const losingTrades: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const currentData = data[i];
      const signal = signals.find(s => s.timestamp === currentData.timestamp);
      
      // Update equity curve
      let currentEquity = capital;
      if (position) {
        const unrealizedPnL = this.calculateUnrealizedPnL(position, currentData.close);
        currentEquity += unrealizedPnL;
      }
      
      const drawdown = (peakEquity - currentEquity) / peakEquity;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      
      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }
      
      equityCurve.push({
        timestamp: currentData.timestamp,
        equity: currentEquity,
        drawdown
      });
      
      // Process signals
      if (signal && signal.signal !== 'HOLD') {
        if (position && signal.signal !== (position.side === 'LONG' ? 'BUY' : 'SELL')) {
          // Close existing position
          const trade = this.closePosition(position, currentData, config);
          trades.push(trade);
          capital += trade.pnl;
          totalFees += trade.fees;
          totalSlippage += trade.slippage;
          
          if (trade.pnl > 0) {
            winningTrades.push(trade.pnl);
          } else {
            losingTrades.push(trade.pnl);
          }
          
          position = null;
        }
        
        if (!position && trades.length < config.maxPositions) {
          // Open new position
          position = this.openPosition(signal, currentData, capital, config);
        }
      }
      
      // Check stop loss and take profit
      if (position) {
        const shouldClose = this.checkStopLossTakeProfit(position, currentData, config);
        if (shouldClose) {
          const trade = this.closePosition(position, currentData, config);
          trades.push(trade);
          capital += trade.pnl;
          totalFees += trade.fees;
          totalSlippage += trade.slippage;
          
          if (trade.pnl > 0) {
            winningTrades.push(trade.pnl);
          } else {
            losingTrades.push(trade.pnl);
          }
          
          position = null;
        }
      }
    }
    
    // Close any remaining position
    if (position) {
      const lastData = data[data.length - 1];
      const trade = this.closePosition(position, lastData, config);
      trades.push(trade);
      capital += trade.pnl;
      totalFees += trade.fees;
      totalSlippage += trade.slippage;
      
      if (trade.pnl > 0) {
        winningTrades.push(trade.pnl);
      } else {
        losingTrades.push(trade.pnl);
      }
    }
    
    // Calculate performance metrics
    const totalTrades = trades.length;
    const winningTradesCount = winningTrades.length;
    const losingTradesCount = losingTrades.length;
    const winRate = totalTrades > 0 ? winningTradesCount / totalTrades : 0;
    
    const totalReturn = (capital - config.initialCapital) / config.initialCapital;
    const duration = (new Date(config.endDate).getTime() - new Date(config.startDate).getTime()) / (365 * 24 * 60 * 60 * 1000);
    const annualizedReturn = Math.pow(1 + totalReturn, 1 / duration) - 1;
    
    const averageWin = winningTrades.length > 0 ? winningTrades.reduce((sum, w) => sum + w, 0) / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, l) => sum + l, 0) / losingTrades.length : 0;
    const profitFactor = Math.abs(averageLoss) > 0 ? (averageWin * winningTradesCount) / (Math.abs(averageLoss) * losingTradesCount) : 0;
    
    const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades) : 0;
    const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades) : 0;
    
    const sharpeRatio = this.calculateSharpeRatio(equityCurve);
    const sortinoRatio = this.calculateSortinoRatio(equityCurve);
    const calmarRatio = annualizedReturn / maxDrawdown;
    
    const riskMetrics = this.calculateRiskMetrics(equityCurve);
    const monthlyReturns = this.calculateMonthlyReturns(equityCurve, config.startDate, config.endDate);
    const performance = this.calculatePerformanceMetrics(trades, config);
    
    return {
      config,
      totalTrades,
      winningTrades: winningTradesCount,
      losingTrades: losingTradesCount,
      winRate,
      totalReturn,
      annualizedReturn,
      maxDrawdown,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      profitFactor,
      averageWin,
      averageLoss,
      largestWin,
      largestLoss,
      totalFees,
      totalSlippage,
      finalCapital: capital,
      equityCurve,
      trades,
      monthlyReturns,
      riskMetrics,
      performance
    };
  }

  private openPosition(
    signal: { timestamp: number; signal: 'BUY' | 'SELL' | 'HOLD'; strength: number; reason: string },
    data: MarketData,
    capital: number,
    config: BacktestConfig
  ): { side: 'LONG' | 'SHORT'; size: number; entryPrice: number; entryTime: number } {
    const positionSize = (capital * config.riskPerTrade) / 100;
    const size = positionSize / data.close;
    
    return {
      side: signal.signal === 'BUY' ? 'LONG' : 'SHORT',
      size,
      entryPrice: data.close,
      entryTime: data.timestamp
    };
  }

  private closePosition(
    position: { side: 'LONG' | 'SHORT'; size: number; entryPrice: number; entryTime: number },
    data: MarketData,
    config: BacktestConfig
  ): BacktestTrade {
    const entryValue = position.size * position.entryPrice;
    const exitValue = position.size * data.close;
    
    let pnl: number;
    if (position.side === 'LONG') {
      pnl = exitValue - entryValue;
    } else {
      pnl = entryValue - exitValue;
    }
    
    const fees = (entryValue + exitValue) * (config.commission / 100);
    const slippage = (entryValue + exitValue) * (config.slippage / 100);
    const netPnl = pnl - fees - slippage;
    
    const pnlPercent = (netPnl / entryValue) * 100;
    const duration = data.timestamp - position.entryTime;
    
    return {
      id: `TRADE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: config.symbol,
      side: position.side,
      entryTime: position.entryTime,
      exitTime: data.timestamp,
      entryPrice: position.entryPrice,
      exitPrice: data.close,
      size: position.size,
      pnl: netPnl,
      pnlPercent,
      fees,
      slippage,
      duration,
      reason: 'SIGNAL',
      drawdown: 0 // Will be calculated later
    };
  }

  private calculateUnrealizedPnL(
    position: { side: 'LONG' | 'SHORT'; size: number; entryPrice: number; entryTime: number },
    currentPrice: number
  ): number {
    const entryValue = position.size * position.entryPrice;
    const currentValue = position.size * currentPrice;
    
    if (position.side === 'LONG') {
      return currentValue - entryValue;
    } else {
      return entryValue - currentValue;
    }
  }

  private checkStopLossTakeProfit(
    position: { side: 'LONG' | 'SHORT'; size: number; entryPrice: number; entryTime: number },
    data: MarketData,
    config: BacktestConfig
  ): boolean {
    const entryPrice = position.entryPrice;
    const currentPrice = data.close;
    
    if (position.side === 'LONG') {
      const stopLossPrice = entryPrice * (1 - config.stopLoss / 100);
      const takeProfitPrice = entryPrice * (1 + config.takeProfit / 100);
      
      return currentPrice <= stopLossPrice || currentPrice >= takeProfitPrice;
    } else {
      const stopLossPrice = entryPrice * (1 + config.stopLoss / 100);
      const takeProfitPrice = entryPrice * (1 - config.takeProfit / 100);
      
      return currentPrice >= stopLossPrice || currentPrice <= takeProfitPrice;
    }
  }

  // Technical indicators
  private calculateMA(data: MarketData[]): number {
    return data.reduce((sum, d) => sum + d.close, 0) / data.length;
  }

  private calculateRSI(data: MarketData[]): number {
    if (data.length < 2) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }
    
    const avgGain = gains / (data.length - 1);
    const avgLoss = losses / (data.length - 1);
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateStdDev(data: MarketData[], mean: number): number {
    const variance = data.reduce((sum, d) => sum + Math.pow(d.close - mean, 2), 0) / data.length;
    return Math.sqrt(variance);
  }

  private calculateSharpeRatio(equityCurve: Array<{ timestamp: number; equity: number; drawdown: number }>): number {
    if (equityCurve.length < 2) return 0;
    
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const return_ = (equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity;
      returns.push(return_);
    }
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  private calculateSortinoRatio(equityCurve: Array<{ timestamp: number; equity: number; drawdown: number }>): number {
    if (equityCurve.length < 2) return 0;
    
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const return_ = (equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity;
      returns.push(return_);
    }
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);
    const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
    const downsideStdDev = Math.sqrt(downsideVariance);
    
    return downsideStdDev > 0 ? avgReturn / downsideStdDev : 0;
  }

  private calculateRiskMetrics(equityCurve: Array<{ timestamp: number; equity: number; drawdown: number }>): {
    var95: number;
    var99: number;
    expectedShortfall: number;
    beta: number;
    alpha: number;
    informationRatio: number;
  } {
    if (equityCurve.length < 2) {
      return {
        var95: 0,
        var99: 0,
        expectedShortfall: 0,
        beta: 0,
        alpha: 0,
        informationRatio: 0
      };
    }
    
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const return_ = (equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity;
      returns.push(return_);
    }
    
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const var95 = sortedReturns[Math.floor(sortedReturns.length * 0.05)];
    const var99 = sortedReturns[Math.floor(sortedReturns.length * 0.01)];
    
    const tailReturns = sortedReturns.slice(0, Math.floor(sortedReturns.length * 0.05));
    const expectedShortfall = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
    
    return {
      var95,
      var99,
      expectedShortfall,
      beta: 1.0, // Simplified - would need market data for proper calculation
      alpha: 0.0, // Simplified - would need market data for proper calculation
      informationRatio: 0.0 // Simplified - would need benchmark data for proper calculation
    };
  }

  private calculateMonthlyReturns(
    equityCurve: Array<{ timestamp: number; equity: number; drawdown: number }>,
    startDate: string,
    endDate: string
  ): Array<{ month: string; return: number }> {
    const monthlyReturns: Array<{ month: string; return: number }> = [];
    
    // Group by month and calculate returns
    const monthlyData = new Map<string, { start: number; end: number }>();
    
    for (const point of equityCurve) {
      const date = new Date(point.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { start: point.equity, end: point.equity });
      } else {
        const data = monthlyData.get(monthKey)!;
        data.end = point.equity;
      }
    }
    
    for (const [month, data] of monthlyData) {
      const return_ = (data.end - data.start) / data.start;
      monthlyReturns.push({ month, return: return_ });
    }
    
    return monthlyReturns.sort((a, b) => a.month.localeCompare(b.month));
  }

  private calculatePerformanceMetrics(trades: BacktestTrade[], config: BacktestConfig): {
    startDate: string;
    endDate: string;
    duration: number;
    tradingDays: number;
    averageTradesPerDay: number;
    bestMonth: string;
    worstMonth: string;
    consecutiveWins: number;
    consecutiveLosses: number;
  } {
    const startDate = config.startDate;
    const endDate = config.endDate;
    const duration = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
    const tradingDays = Math.floor(duration * 0.7); // Assume 70% trading days
    const averageTradesPerDay = trades.length / tradingDays;
    
    // Calculate consecutive wins/losses
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;
    
    for (const trade of trades) {
      if (trade.pnl > 0) {
        currentWins++;
        currentLosses = 0;
        consecutiveWins = Math.max(consecutiveWins, currentWins);
      } else {
        currentLosses++;
        currentWins = 0;
        consecutiveLosses = Math.max(consecutiveLosses, currentLosses);
      }
    }
    
    return {
      startDate,
      endDate,
      duration,
      tradingDays,
      averageTradesPerDay,
      bestMonth: 'N/A', // Would need monthly data
      worstMonth: 'N/A', // Would need monthly data
      consecutiveWins,
      consecutiveLosses
    };
  }

  // Public methods
  getAvailableStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  getAvailableSymbols(): string[] {
    return Array.from(this.marketData.keys());
  }

  addStrategy(strategy: Strategy): void {
    this.strategies.set(strategy.name, strategy);
    logger.info(`📊 Strategy added: ${strategy.name}`);
  }

  isBacktestRunning(): boolean {
    return this.isRunning;
  }
}
