import { logger } from '../../utils/logger';
import { getCache, setCache } from '../../config/redis';

export interface PatternAnalysis {
  name: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  startPrice: number;
  endPrice: number;
  timestamp: Date;
}

export interface PricePoint {
  timestamp: number;
  price: number;
  volume: number;
}

export class PatternRecognizer {
  private patterns: Map<string, any>;

  constructor() {
    this.patterns = new Map();
  }

  async initialize(): Promise<void> {
    logger.info('🔍 Initializing Pattern Recognizer...');
    
    // Initialize pattern detection algorithms
    this.initializePatterns();
    
    logger.info('✅ Pattern Recognizer initialized');
  }

  async analyze(symbol: string): Promise<PatternAnalysis[]> {
    try {
      logger.info(`🔍 Analyzing patterns for ${symbol}`);
      
      // Check cache first
      const cacheKey = `patterns:${symbol}`;
      const cached = await getCache<PatternAnalysis[]>(cacheKey);
      if (cached) {
        logger.info(`📋 Using cached patterns for ${symbol}`);
        return cached;
      }

      // Get price data
      const priceData = await this.getPriceData(symbol);
      
      if (!priceData || priceData.length < 50) {
        throw new Error('Insufficient price data for pattern analysis');
      }

      // Detect patterns
      const patterns = await this.detectPatterns(priceData);

      // Cache result for 10 minutes
      await setCache(cacheKey, patterns, 600);
      
      logger.info(`✅ Pattern analysis completed for ${symbol}: ${patterns.length} patterns found`);
      return patterns;

    } catch (error) {
      logger.error(`❌ Failed to analyze patterns for ${symbol}:`, error);
      return [];
    }
  }

  private initializePatterns(): void {
    // Initialize pattern detection algorithms
    this.patterns.set('headAndShoulders', this.detectHeadAndShoulders.bind(this));
    this.patterns.set('inverseHeadAndShoulders', this.detectInverseHeadAndShoulders.bind(this));
    this.patterns.set('doubleTop', this.detectDoubleTop.bind(this));
    this.patterns.set('doubleBottom', this.detectDoubleBottom.bind(this));
    this.patterns.set('triangle', this.detectTriangle.bind(this));
    this.patterns.set('flag', this.detectFlag.bind(this));
    this.patterns.set('pennant', this.detectPennant.bind(this));
    this.patterns.set('wedge', this.detectWedge.bind(this));
  }

  private async getPriceData(symbol: string): Promise<PricePoint[]> {
    try {
      // For now, return mock data
      // In production, fetch from exchange API
      return this.generateMockPriceData(symbol);
      
    } catch (error) {
      logger.error(`❌ Failed to get price data for ${symbol}:`, error);
      throw error;
    }
  }

  private generateMockPriceData(symbol: string): PricePoint[] {
    const data: PricePoint[] = [];
    const basePrice = 50000;
    let currentPrice = basePrice;
    
    for (let i = 0; i < 100; i++) {
      // Generate realistic price movement with some patterns
      const change = (Math.random() - 0.5) * 0.05;
      currentPrice *= (1 + change);
      
      data.push({
        timestamp: Date.now() - (100 - i) * 60 * 60 * 1000, // Hourly data
        price: currentPrice,
        volume: Math.random() * 1000000 + 100000
      });
    }
    
    return data.reverse();
  }

  private async detectPatterns(priceData: PricePoint[]): Promise<PatternAnalysis[]> {
    const patterns: PatternAnalysis[] = [];
    
    // Run all pattern detection algorithms
    for (const [patternName, detector] of this.patterns) {
      try {
        const result = await detector(priceData);
        if (result) {
          patterns.push(result);
        }
      } catch (error) {
        logger.error(`❌ Pattern detection failed for ${patternName}:`, error);
      }
    }
    
    // Sort by confidence
    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  private async detectHeadAndShoulders(priceData: PricePoint[]): Promise<PatternAnalysis | null> {
    try {
      // Simplified head and shoulders detection
      const prices = priceData.map(d => d.price);
      const highs = this.findLocalHighs(prices);
      
      if (highs.length >= 3) {
        const [left, head, right] = highs.slice(-3);
        
        // Check if it forms a head and shoulders pattern
        if (head > left && head > right && Math.abs(left - right) < head * 0.1) {
          const confidence = this.calculatePatternConfidence(prices, 'headAndShoulders');
          const neckline = Math.min(left, right);
          const target = neckline - (head - neckline);
          
          return {
            name: 'Head and Shoulders',
            direction: 'BEARISH',
            confidence,
            startPrice: head,
            endPrice: target,
            timestamp: new Date()
          };
        }
      }
      
      return null;
    } catch (error) {
      logger.error('❌ Head and shoulders detection failed:', error);
      return null;
    }
  }

  private async detectInverseHeadAndShoulders(priceData: PricePoint[]): Promise<PatternAnalysis | null> {
    try {
      // Simplified inverse head and shoulders detection
      const prices = priceData.map(d => d.price);
      const lows = this.findLocalLows(prices);
      
      if (lows.length >= 3) {
        const [left, head, right] = lows.slice(-3);
        
        // Check if it forms an inverse head and shoulders pattern
        if (head < left && head < right && Math.abs(left - right) < Math.abs(head) * 0.1) {
          const confidence = this.calculatePatternConfidence(prices, 'inverseHeadAndShoulders');
          const neckline = Math.max(left, right);
          const target = neckline + (neckline - head);
          
          return {
            name: 'Inverse Head and Shoulders',
            direction: 'BULLISH',
            confidence,
            startPrice: head,
            endPrice: target,
            timestamp: new Date()
          };
        }
      }
      
      return null;
    } catch (error) {
      logger.error('❌ Inverse head and shoulders detection failed:', error);
      return null;
    }
  }

  private async detectDoubleTop(priceData: PricePoint[]): Promise<PatternAnalysis | null> {
    try {
      const prices = priceData.map(d => d.price);
      const highs = this.findLocalHighs(prices);
      
      if (highs.length >= 2) {
        const [first, second] = highs.slice(-2);
        
        // Check if it forms a double top pattern
        if (Math.abs(first - second) < first * 0.05) {
          const confidence = this.calculatePatternConfidence(prices, 'doubleTop');
          const target = Math.min(...prices.slice(-20)) * 0.9;
          
          return {
            name: 'Double Top',
            direction: 'BEARISH',
            confidence,
            startPrice: Math.max(first, second),
            endPrice: target,
            timestamp: new Date()
          };
        }
      }
      
      return null;
    } catch (error) {
      logger.error('❌ Double top detection failed:', error);
      return null;
    }
  }

  private async detectDoubleBottom(priceData: PricePoint[]): Promise<PatternAnalysis | null> {
    try {
      const prices = priceData.map(d => d.price);
      const lows = this.findLocalLows(prices);
      
      if (lows.length >= 2) {
        const [first, second] = lows.slice(-2);
        
        // Check if it forms a double bottom pattern
        if (Math.abs(first - second) < first * 0.05) {
          const confidence = this.calculatePatternConfidence(prices, 'doubleBottom');
          const target = Math.max(...prices.slice(-20)) * 1.1;
          
          return {
            name: 'Double Bottom',
            direction: 'BULLISH',
            confidence,
            startPrice: Math.min(first, second),
            endPrice: target,
            timestamp: new Date()
          };
        }
      }
      
      return null;
    } catch (error) {
      logger.error('❌ Double bottom detection failed:', error);
      return null;
    }
  }

  private async detectTriangle(priceData: PricePoint[]): Promise<PatternAnalysis | null> {
    try {
      const prices = priceData.map(d => d.price);
      const highs = this.findLocalHighs(prices);
      const lows = this.findLocalLows(prices);
      
      if (highs.length >= 3 && lows.length >= 3) {
        // Check for triangle pattern (converging highs and lows)
        const highSlope = this.calculateSlope(highs.slice(-3));
        const lowSlope = this.calculateSlope(lows.slice(-3));
        
        if (Math.abs(highSlope) < 0.1 && Math.abs(lowSlope) < 0.1) {
          const confidence = this.calculatePatternConfidence(prices, 'triangle');
          const direction = highSlope < lowSlope ? 'BULLISH' : 'BEARISH';
          const target = direction === 'BULLISH' ? 
            Math.max(...prices) * 1.1 : Math.min(...prices) * 0.9;
          
          return {
            name: 'Triangle',
            direction,
            confidence,
            startPrice: direction === 'BULLISH' ? Math.min(...prices) : Math.max(...prices),
            endPrice: target,
            timestamp: new Date()
          };
        }
      }
      
      return null;
    } catch (error) {
      logger.error('❌ Triangle detection failed:', error);
      return null;
    }
  }

  private async detectFlag(priceData: PricePoint[]): Promise<PatternAnalysis | null> {
    // Simplified flag pattern detection
    return null;
  }

  private async detectPennant(priceData: PricePoint[]): Promise<PatternAnalysis | null> {
    // Simplified pennant pattern detection
    return null;
  }

  private async detectWedge(priceData: PricePoint[]): Promise<PatternAnalysis | null> {
    // Simplified wedge pattern detection
    return null;
  }

  private findLocalHighs(prices: number[]): number[] {
    const highs: number[] = [];
    
    for (let i = 1; i < prices.length - 1; i++) {
      if (prices[i] > prices[i - 1] && prices[i] > prices[i + 1]) {
        highs.push(prices[i]);
      }
    }
    
    return highs;
  }

  private findLocalLows(prices: number[]): number[] {
    const lows: number[] = [];
    
    for (let i = 1; i < prices.length - 1; i++) {
      if (prices[i] < prices[i - 1] && prices[i] < prices[i + 1]) {
        lows.push(prices[i]);
      }
    }
    
    return lows;
  }

  private calculateSlope(points: number[]): number {
    if (points.length < 2) return 0;
    
    const x1 = 0;
    const y1 = points[0];
    const x2 = points.length - 1;
    const y2 = points[points.length - 1];
    
    return (y2 - y1) / (x2 - x1);
  }

  private calculatePatternConfidence(prices: number[], patternType: string): number {
    try {
      // Calculate confidence based on pattern quality and market conditions
      const volatility = this.calculateVolatility(prices);
      const trend = this.calculateTrend(prices);
      
      let confidence = 0.7; // Base confidence
      
      // Adjust based on volatility
      if (volatility > 0.1) confidence *= 0.8;
      if (volatility < 0.02) confidence *= 0.9;
      
      // Adjust based on trend strength
      if (Math.abs(trend) > 0.05) confidence *= 1.1;
      
      return Math.max(0.1, Math.min(1, confidence));
      
    } catch (error) {
      logger.error('❌ Pattern confidence calculation failed:', error);
      return 0.5;
    }
  }

  private calculateVolatility(prices: number[]): number {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private calculateTrend(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const first = prices[0];
    const last = prices[prices.length - 1];
    
    return (last - first) / first;
  }
}
