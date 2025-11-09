import { RSI, MACD, BollingerBands, SMA, EMA } from 'technicalindicators';
import { logger } from '../../utils/logger';
import { getCache, setCache } from '../../config/redis';

export interface TechnicalAnalysis {
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  sma: {
    sma20: number;
    sma50: number;
    sma200: number;
  };
  ema: {
    ema12: number;
    ema26: number;
  };
  confidence: number;
  timestamp: Date;
}

export interface PriceData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class TechnicalAnalyzer {
  private ccxt: any;

  constructor() {
    // Initialize CCXT for price data
    this.ccxt = null;
  }

  async initialize(): Promise<void> {
    logger.info('📊 Initializing Technical Analyzer...');
    
    try {
      // Initialize CCXT if available
      if (typeof require !== 'undefined') {
        const ccxt = require('ccxt');
        this.ccxt = ccxt;
      }
      
      logger.info('✅ Technical Analyzer initialized');
    } catch (error) {
      logger.warn('⚠️ CCXT not available, using mock data');
    }
  }

  async analyze(symbol: string): Promise<TechnicalAnalysis> {
    try {
      logger.info(`📊 Analyzing technical indicators for ${symbol}`);
      
      // Check cache first
      const cacheKey = `technical:${symbol}`;
      const cached = await getCache<TechnicalAnalysis>(cacheKey);
      if (cached) {
        logger.info(`📋 Using cached technical analysis for ${symbol}`);
        return cached;
      }

      // Get price data
      const priceData = await this.getPriceData(symbol);
      
      if (!priceData || priceData.length < 200) {
        throw new Error('Insufficient price data for technical analysis');
      }

      // Calculate indicators
      const rsi = this.calculateRSI(priceData);
      const macd = this.calculateMACD(priceData);
      const bollingerBands = this.calculateBollingerBands(priceData);
      const sma = this.calculateSMA(priceData);
      const ema = this.calculateEMA(priceData);

      // Calculate confidence based on data quality
      const confidence = this.calculateConfidence(priceData);

      const analysis: TechnicalAnalysis = {
        rsi,
        macd,
        bollingerBands,
        sma,
        ema,
        confidence,
        timestamp: new Date()
      };

      // Cache result for 5 minutes
      await setCache(cacheKey, analysis, 300);
      
      logger.info(`✅ Technical analysis completed for ${symbol}`);
      return analysis;

    } catch (error) {
      logger.error(`❌ Failed to analyze technical indicators for ${symbol}:`, error);
      
      // Return default analysis on error
      return {
        rsi: 50,
        macd: { macd: 0, signal: 0, histogram: 0 },
        bollingerBands: { upper: 0, middle: 0, lower: 0 },
        sma: { sma20: 0, sma50: 0, sma200: 0 },
        ema: { ema12: 0, ema26: 0 },
        confidence: 0,
        timestamp: new Date()
      };
    }
  }

  private async getPriceData(symbol: string): Promise<PriceData[]> {
    try {
      // For now, return mock data
      // In production, fetch from exchange API
      return this.generateMockPriceData(symbol);
      
    } catch (error) {
      logger.error(`❌ Failed to get price data for ${symbol}:`, error);
      throw error;
    }
  }

  private generateMockPriceData(symbol: string): PriceData[] {
    const data: PriceData[] = [];
    const basePrice = 50000; // Mock base price
    let currentPrice = basePrice;
    
    for (let i = 0; i < 200; i++) {
      // Generate realistic price movement
      const change = (Math.random() - 0.5) * 0.1; // ±5% change
      currentPrice *= (1 + change);
      
      const high = currentPrice * (1 + Math.random() * 0.02);
      const low = currentPrice * (1 - Math.random() * 0.02);
      const open = currentPrice * (1 + (Math.random() - 0.5) * 0.01);
      const close = currentPrice;
      const volume = Math.random() * 1000000 + 100000;
      
      data.push({
        timestamp: Date.now() - (200 - i) * 24 * 60 * 60 * 1000, // Daily data
        open,
        high,
        low,
        close,
        volume
      });
    }
    
    return data.reverse(); // Oldest first
  }

  private calculateRSI(priceData: PriceData[]): number {
    try {
      const closes = priceData.map(d => d.close);
      const rsiValues = RSI.calculate({ values: closes, period: 14 });
      return rsiValues[rsiValues.length - 1] || 50;
    } catch (error) {
      logger.error('❌ RSI calculation failed:', error);
      return 50;
    }
  }

  private calculateMACD(priceData: PriceData[]): { macd: number; signal: number; histogram: number } {
    try {
      const closes = priceData.map(d => d.close);
      const macdValues = MACD.calculate({
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
      });
      
      const lastMACD = macdValues[macdValues.length - 1];
      return {
        macd: lastMACD?.MACD || 0,
        signal: lastMACD?.signal || 0,
        histogram: lastMACD?.histogram || 0
      };
    } catch (error) {
      logger.error('❌ MACD calculation failed:', error);
      return { macd: 0, signal: 0, histogram: 0 };
    }
  }

  private calculateBollingerBands(priceData: PriceData[]): { upper: number; middle: number; lower: number } {
    try {
      const closes = priceData.map(d => d.close);
      const bbValues = BollingerBands.calculate({
        values: closes,
        period: 20,
        stdDev: 2
      });
      
      const lastBB = bbValues[bbValues.length - 1];
      return {
        upper: lastBB?.upper || 0,
        middle: lastBB?.middle || 0,
        lower: lastBB?.lower || 0
      };
    } catch (error) {
      logger.error('❌ Bollinger Bands calculation failed:', error);
      return { upper: 0, middle: 0, lower: 0 };
    }
  }

  private calculateSMA(priceData: PriceData[]): { sma20: number; sma50: number; sma200: number } {
    try {
      const closes = priceData.map(d => d.close);
      
      const sma20Values = SMA.calculate({ values: closes, period: 20 });
      const sma50Values = SMA.calculate({ values: closes, period: 50 });
      const sma200Values = SMA.calculate({ values: closes, period: 200 });
      
      return {
        sma20: sma20Values[sma20Values.length - 1] || 0,
        sma50: sma50Values[sma50Values.length - 1] || 0,
        sma200: sma200Values[sma200Values.length - 1] || 0
      };
    } catch (error) {
      logger.error('❌ SMA calculation failed:', error);
      return { sma20: 0, sma50: 0, sma200: 0 };
    }
  }

  private calculateEMA(priceData: PriceData[]): { ema12: number; ema26: number } {
    try {
      const closes = priceData.map(d => d.close);
      
      const ema12Values = EMA.calculate({ values: closes, period: 12 });
      const ema26Values = EMA.calculate({ values: closes, period: 26 });
      
      return {
        ema12: ema12Values[ema12Values.length - 1] || 0,
        ema26: ema26Values[ema26Values.length - 1] || 0
      };
    } catch (error) {
      logger.error('❌ EMA calculation failed:', error);
      return { ema12: 0, ema26: 0 };
    }
  }

  private calculateConfidence(priceData: PriceData[]): number {
    try {
      // Calculate confidence based on data quality and volatility
      const closes = priceData.map(d => d.close);
      const volumes = priceData.map(d => d.volume);
      
      // Check for sufficient data
      if (closes.length < 200) return 0.5;
      
      // Check for reasonable price range
      const priceRange = Math.max(...closes) - Math.min(...closes);
      const avgPrice = closes.reduce((sum, price) => sum + price, 0) / closes.length;
      const priceVolatility = priceRange / avgPrice;
      
      // Check for reasonable volume
      const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
      const volumeConsistency = volumes.filter(v => v > avgVolume * 0.5).length / volumes.length;
      
      // Calculate confidence score
      let confidence = 0.8; // Base confidence
      
      if (priceVolatility > 0.5) confidence *= 0.8; // High volatility reduces confidence
      if (volumeConsistency < 0.7) confidence *= 0.9; // Low volume consistency reduces confidence
      
      return Math.max(0.1, Math.min(1, confidence));
      
    } catch (error) {
      logger.error('❌ Confidence calculation failed:', error);
      return 0.5;
    }
  }

  // Generate trading signals based on technical analysis
  generateSignals(analysis: TechnicalAnalysis): string[] {
    const signals: string[] = [];
    
    // RSI signals
    if (analysis.rsi < 30) {
      signals.push('RSI_OVERSOLD');
    } else if (analysis.rsi > 70) {
      signals.push('RSI_OVERBOUGHT');
    }
    
    // MACD signals
    if (analysis.macd.histogram > 0 && analysis.macd.macd > analysis.macd.signal) {
      signals.push('MACD_BULLISH');
    } else if (analysis.macd.histogram < 0 && analysis.macd.macd < analysis.macd.signal) {
      signals.push('MACD_BEARISH');
    }
    
    // Moving average signals
    if (analysis.sma.sma20 > analysis.sma.sma50 && analysis.sma.sma50 > analysis.sma.sma200) {
      signals.push('GOLDEN_CROSS');
    } else if (analysis.sma.sma20 < analysis.sma.sma50 && analysis.sma.sma50 < analysis.sma.sma200) {
      signals.push('DEATH_CROSS');
    }
    
    return signals;
  }
}
