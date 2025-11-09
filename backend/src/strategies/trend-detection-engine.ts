import { logger } from '../utils/logger';

export interface MarketData {
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rsi: number;
  macd: number;
  bollingerUpper: number;
  bollingerLower: number;
  ema20: number;
  ema50: number;
  ema200: number;
  volatility: number;
}

export interface TrendSignal {
  symbol: string;
  type: 'BULLISH' | 'BEARISH' | 'REVERSAL_UP' | 'REVERSAL_DOWN' | 'SIDEWAYS';
  strength: number; // 0-100
  confidence: number; // 0-100
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  timeframe: string;
  reason: string;
  indicators: {
    rsi: number;
    macd: number;
    bollinger: number;
    ema: number;
    volume: number;
  };
}

export interface ReversalSignal {
  symbol: string;
  direction: 'UP' | 'DOWN';
  probability: number; // 0-100
  triggerPrice: number;
  targetPrice: number;
  stopLoss: number;
  confidence: number;
  reason: string;
  patterns: string[];
}

export class TrendDetectionEngine {
  private marketDataCache: Map<string, MarketData[]> = new Map();
  private trendHistory: Map<string, TrendSignal[]> = new Map();
  private reversalHistory: Map<string, ReversalSignal[]> = new Map();

  async initialize(): Promise<void> {
    logger.info('🔍 Initializing Trend Detection Engine...');
    logger.info('✅ Trend Detection Engine initialized');
  }

  async analyzeTrend(symbol: string, timeframe: string = '5m'): Promise<TrendSignal | null> {
    try {
      // Market data al
      const marketData = await this.getMarketData(symbol, timeframe);
      if (!marketData || marketData.length < 20) {
        return null;
      }

      // Trend analizi
      const trendAnalysis = this.detectTrend(marketData);
      const reversalAnalysis = this.analyzeReversalPatterns(marketData);
      const momentumAnalysis = this.analyzeMomentum(marketData);
      const volumeAnalysis = this.analyzeVolume(marketData);

      // Kombine analiz
      const combinedSignal = this.combineAnalyses(
        trendAnalysis,
        reversalAnalysis,
        momentumAnalysis,
        volumeAnalysis,
        marketData[marketData.length - 1]
      );

      if (combinedSignal) {
        // Trend geçmişine ekle
        const history = this.trendHistory.get(symbol) || [];
        history.push(combinedSignal);
        if (history.length > 100) history.shift(); // Son 100 sinyal
        this.trendHistory.set(symbol, history);
      }

      return combinedSignal;

    } catch (error) {
      logger.error(`❌ Error analyzing trend for ${symbol}:`, error);
      return null;
    }
  }

  async detectReversal(symbol: string, timeframe: string = '5m'): Promise<ReversalSignal | null> {
    try {
      const marketData = await this.getMarketData(symbol, timeframe);
      if (!marketData || marketData.length < 20) {
        return null;
      }

      const reversalSignal = this.analyzeReversalPatterns(marketData);
      
      if (reversalSignal) {
        // Reversal geçmişine ekle
        const history = this.reversalHistory.get(symbol) || [];
        history.push(reversalSignal);
        if (history.length > 50) history.shift(); // Son 50 reversal
        this.reversalHistory.set(symbol, history);
      }

      return reversalSignal;

    } catch (error) {
      logger.error(`❌ Error detecting reversal for ${symbol}:`, error);
      return null;
    }
  }

  private detectTrend(marketData: MarketData[]): {
    direction: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    strength: number;
    confidence: number;
  } {
    const recent = marketData.slice(-10);
    const older = marketData.slice(-20, -10);

    // EMA trend analizi
    const ema20Trend = this.calculateEMATrend(recent, 'ema20');
    const ema50Trend = this.calculateEMATrend(recent, 'ema50');
    
    // Price action analizi
    const priceTrend = this.analyzePriceAction(recent);
    
    // Bollinger Bands analizi
    const bollingerTrend = this.analyzeBollingerBands(recent);

    // Kombine trend skoru
    const trendScore = (ema20Trend + ema50Trend + priceTrend + bollingerTrend) / 4;

    let direction: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    let strength: number;
    let confidence: number;

    if (trendScore > 0.6) {
      direction = 'BULLISH';
      strength = Math.min(trendScore * 100, 100);
      confidence = this.calculateTrendConfidence(recent, 'BULLISH');
    } else if (trendScore < -0.6) {
      direction = 'BEARISH';
      strength = Math.min(Math.abs(trendScore) * 100, 100);
      confidence = this.calculateTrendConfidence(recent, 'BEARISH');
    } else {
      direction = 'SIDEWAYS';
      strength = 50;
      confidence = 60;
    }

    return { direction, strength, confidence };
  }

  private analyzeReversalPatterns(marketData: MarketData[]): ReversalSignal | null {
    const recent = marketData.slice(-5);
    const older = marketData.slice(-15, -5);

    // RSI divergence
    const rsiDivergence = this.detectRSIDivergence(recent, older);
    
    // MACD divergence
    const macdDivergence = this.detectMACDDivergence(recent, older);
    
    // Volume spike
    const volumeSpike = this.detectVolumeSpike(recent);
    
    // Support/Resistance break
    const supportResistance = this.detectSupportResistanceBreak(recent);

    // Kombine reversal skoru
    const reversalScore = (rsiDivergence + macdDivergence + volumeSpike + supportResistance) / 4;

    let probability: number;
    let direction: 'UP' | 'DOWN' | 'NONE';
    let confidence: number;

    if (reversalScore > 0.7) {
      probability = Math.min(reversalScore * 100, 95);
      direction = this.determineReversalDirection(recent);
      confidence = this.calculateReversalConfidence(recent);
    } else {
      probability = 0;
      direction = 'NONE';
      confidence = 0;
    }

    if (direction === 'NONE' || probability < 60) {
      return null;
    }

    const currentPrice = recent[recent.length - 1].close;
    const symbol = 'BTC'; // Default symbol, should be passed as parameter

    return {
      symbol,
      triggerPrice: currentPrice,
      targetPrice: direction === 'UP' ? currentPrice * 1.05 : currentPrice * 0.95,
      stopLoss: direction === 'UP' ? currentPrice * 0.98 : currentPrice * 1.02,
      probability,
      direction,
      confidence,
      reason: `Reversal detected with ${probability}% probability`,
      patterns: ['Technical Analysis']
    };
  }

  private analyzeMomentum(marketData: MarketData[]): {
    score: number;
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    strength: number;
  } {
    const recent = marketData.slice(-5);
    
    // RSI momentum
    const rsiMomentum = this.calculateRSIMomentum(recent);
    
    // MACD momentum
    const macdMomentum = this.calculateMACDMomentum(recent);
    
    // Price momentum
    const priceMomentum = this.calculatePriceMomentum(recent);
    
    // Volume momentum
    const volumeMomentum = this.calculateVolumeMomentum(recent);

    const momentumScore = (rsiMomentum + macdMomentum + priceMomentum + volumeMomentum) / 4;

    let direction: 'UP' | 'DOWN' | 'NEUTRAL';
    let strength: number;

    if (momentumScore > 0.3) {
      direction = 'UP';
      strength = Math.min(momentumScore * 100, 100);
    } else if (momentumScore < -0.3) {
      direction = 'DOWN';
      strength = Math.min(Math.abs(momentumScore) * 100, 100);
    } else {
      direction = 'NEUTRAL';
      strength = 50;
    }

    return { score: momentumScore, direction, strength };
  }

  private analyzeVolume(marketData: MarketData[]): {
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
    strength: number;
    spike: boolean;
  } {
    const recent = marketData.slice(-5);
    const older = marketData.slice(-10, -5);

    const recentAvgVolume = recent.reduce((sum, data) => sum + data.volume, 0) / recent.length;
    const olderAvgVolume = older.reduce((sum, data) => sum + data.volume, 0) / older.length;

    const volumeChange = (recentAvgVolume - olderAvgVolume) / olderAvgVolume;
    const volumeSpike = volumeChange > 1.5; // %150 artış

    let trend: 'INCREASING' | 'DECREASING' | 'STABLE';
    let strength: number;

    if (volumeChange > 0.2) {
      trend = 'INCREASING';
      strength = Math.min(volumeChange * 100, 100);
    } else if (volumeChange < -0.2) {
      trend = 'DECREASING';
      strength = Math.min(Math.abs(volumeChange) * 100, 100);
    } else {
      trend = 'STABLE';
      strength = 50;
    }

    return { trend, strength, spike: volumeSpike };
  }

  private combineAnalyses(
    trendAnalysis: any,
    reversalAnalysis: any,
    momentumAnalysis: any,
    volumeAnalysis: any,
    currentData: MarketData
  ): TrendSignal | null {
    
    // Sinyal gücü hesapla
    const signalStrength = this.calculateSignalStrength(
      trendAnalysis,
      reversalAnalysis,
      momentumAnalysis,
      volumeAnalysis
    );

    // Minimum güç eşiği
    if (signalStrength < 60) {
      return null;
    }

    // Sinyal tipi belirle
    let signalType: 'BULLISH' | 'BEARISH' | 'REVERSAL_UP' | 'REVERSAL_DOWN' | 'SIDEWAYS';
    
    if (reversalAnalysis.probability > 70) {
      signalType = reversalAnalysis.direction === 'UP' ? 'REVERSAL_UP' : 'REVERSAL_DOWN';
    } else if (trendAnalysis.direction === 'BULLISH') {
      signalType = 'BULLISH';
    } else if (trendAnalysis.direction === 'BEARISH') {
      signalType = 'BEARISH';
    } else {
      signalType = 'SIDEWAYS';
    }

    // Entry, target, stop loss hesapla
    const entryPrice = currentData.close;
    const { targetPrice, stopLoss } = this.calculateTargets(
      signalType,
      entryPrice,
      currentData.volatility
    );

    // Güven skoru
    const confidence = this.calculateOverallConfidence(
      trendAnalysis,
      reversalAnalysis,
      momentumAnalysis,
      volumeAnalysis
    );

    return {
      symbol: currentData.symbol,
      type: signalType,
      strength: signalStrength,
      confidence,
      entryPrice,
      targetPrice,
      stopLoss,
      timeframe: '5m',
      reason: this.generateReason(signalType, trendAnalysis, reversalAnalysis, momentumAnalysis),
      indicators: {
        rsi: currentData.rsi,
        macd: currentData.macd,
        bollinger: (currentData.bollingerUpper - currentData.bollingerLower) / currentData.close,
        ema: (currentData.ema20 - currentData.ema50) / currentData.close,
        volume: currentData.volume
      }
    };
  }

  // Helper methods
  private calculateEMATrend(data: MarketData[], emaType: string): number {
    const values = data.map(d => (d as any)[emaType]);
    const slope = (values[values.length - 1] - values[0]) / values[0];
    return Math.max(-1, Math.min(1, slope * 10));
  }

  private analyzePriceAction(data: MarketData[]): number {
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    const higherHighs = this.countHigherHighs(highs);
    const higherLows = this.countHigherLows(lows);
    const lowerHighs = this.countLowerHighs(highs);
    const lowerLows = this.countLowerLows(lows);

    const bullishSignals = higherHighs + higherLows;
    const bearishSignals = lowerHighs + lowerLows;

    return (bullishSignals - bearishSignals) / (bullishSignals + bearishSignals + 1);
  }

  private analyzeBollingerBands(data: MarketData[]): number {
    const recent = data[data.length - 1];
    const position = (recent.close - recent.bollingerLower) / 
                    (recent.bollingerUpper - recent.bollingerLower);
    
    if (position > 0.8) return -0.8; // Overbought
    if (position < 0.2) return 0.8;  // Oversold
    return 0; // Neutral
  }

  private calculateRSIMomentum(data: MarketData[]): number {
    const rsiValues = data.map(d => d.rsi);
    const rsiSlope = (rsiValues[rsiValues.length - 1] - rsiValues[0]) / 10;
    
    if (rsiValues[rsiValues.length - 1] > 70) return -0.5; // Overbought
    if (rsiValues[rsiValues.length - 1] < 30) return 0.5;  // Oversold
    return rsiSlope;
  }

  private calculateMACDMomentum(data: MarketData[]): number {
    const macdValues = data.map(d => d.macd);
    const macdSlope = (macdValues[macdValues.length - 1] - macdValues[0]) / 10;
    return Math.max(-1, Math.min(1, macdSlope));
  }

  private calculatePriceMomentum(data: MarketData[]): number {
    const closes = data.map(d => d.close);
    const priceChange = (closes[closes.length - 1] - closes[0]) / closes[0];
    return Math.max(-1, Math.min(1, priceChange * 10));
  }

  private calculateVolumeMomentum(data: MarketData[]): number {
    const volumes = data.map(d => d.volume);
    const volumeChange = (volumes[volumes.length - 1] - volumes[0]) / volumes[0];
    return Math.max(-1, Math.min(1, volumeChange / 5));
  }

  private detectRSIDivergence(recent: MarketData[], older: MarketData[]): number {
    // Simplified RSI divergence detection
    const recentRSI = recent.map(d => d.rsi);
    const recentPrices = recent.map(d => d.close);
    const olderRSI = older.map(d => d.rsi);
    const olderPrices = older.map(d => d.close);

    const priceTrend = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
    const rsiTrend = (recentRSI[recentRSI.length - 1] - recentRSI[0]) / recentRSI[0];

    // Divergence: price and RSI moving in opposite directions
    if (priceTrend > 0 && rsiTrend < 0) return 0.8; // Bearish divergence
    if (priceTrend < 0 && rsiTrend > 0) return 0.8; // Bullish divergence
    return 0;
  }

  private detectMACDDivergence(recent: MarketData[], older: MarketData[]): number {
    // Similar to RSI divergence but with MACD
    const recentMACD = recent.map(d => d.macd);
    const recentPrices = recent.map(d => d.close);
    const olderMACD = older.map(d => d.macd);
    const olderPrices = older.map(d => d.close);

    const priceTrend = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
    const macdTrend = (recentMACD[recentMACD.length - 1] - recentMACD[0]) / Math.abs(recentMACD[0]);

    if (priceTrend > 0 && macdTrend < 0) return 0.7;
    if (priceTrend < 0 && macdTrend > 0) return 0.7;
    return 0;
  }

  private detectVolumeSpike(data: MarketData[]): number {
    const volumes = data.map(d => d.volume);
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume;
    
    return volumeRatio > 2 ? 0.8 : 0; // 2x volume spike
  }

  private detectSupportResistanceBreak(data: MarketData[]): number {
    const recent = data[data.length - 1];
    const support = recent.bollingerLower;
    const resistance = recent.bollingerUpper;
    const price = recent.close;

    if (price < support) return 0.6; // Support break (bearish)
    if (price > resistance) return 0.6; // Resistance break (bullish)
    return 0;
  }

  private calculateTargets(
    signalType: string,
    entryPrice: number,
    volatility: number
  ): { targetPrice: number; stopLoss: number } {
    const multiplier = volatility * 2; // 2x volatility for targets

    let targetPrice: number;
    let stopLoss: number;

    switch (signalType) {
      case 'BULLISH':
      case 'REVERSAL_UP':
        targetPrice = entryPrice * (1 + multiplier);
        stopLoss = entryPrice * (1 - multiplier * 0.5);
        break;
      case 'BEARISH':
      case 'REVERSAL_DOWN':
        targetPrice = entryPrice * (1 - multiplier);
        stopLoss = entryPrice * (1 + multiplier * 0.5);
        break;
      default:
        targetPrice = entryPrice;
        stopLoss = entryPrice;
    }

    return { targetPrice, stopLoss };
  }

  private calculateSignalStrength(
    trendAnalysis: any,
    reversalAnalysis: any,
    momentumAnalysis: any,
    volumeAnalysis: any
  ): number {
    let strength = 0;

    // Trend strength
    strength += trendAnalysis.strength * 0.3;
    
    // Reversal probability
    strength += reversalAnalysis.probability * 0.2;
    
    // Momentum strength
    strength += momentumAnalysis.strength * 0.2;
    
    // Volume confirmation
    strength += volumeAnalysis.strength * 0.1;
    
    // Volume spike bonus
    if (volumeAnalysis.spike) strength += 20;

    return Math.min(strength, 100);
  }

  private calculateOverallConfidence(
    trendAnalysis: any,
    reversalAnalysis: any,
    momentumAnalysis: any,
    volumeAnalysis: any
  ): number {
    const trendConfidence = trendAnalysis.confidence;
    const reversalConfidence = reversalAnalysis.confidence;
    const momentumConfidence = momentumAnalysis.strength;
    const volumeConfidence = volumeAnalysis.strength;

    return (trendConfidence + reversalConfidence + momentumConfidence + volumeConfidence) / 4;
  }

  private generateReason(
    signalType: string,
    trendAnalysis: any,
    reversalAnalysis: any,
    momentumAnalysis: any
  ): string {
    const reasons: string[] = [];

    if (trendAnalysis.direction !== 'SIDEWAYS') {
      reasons.push(`${trendAnalysis.direction} trend (${trendAnalysis.strength.toFixed(0)}%)`);
    }

    if (reversalAnalysis.probability > 50) {
      reasons.push(`Reversal signal (${reversalAnalysis.probability.toFixed(0)}%)`);
    }

    if (momentumAnalysis.direction !== 'NEUTRAL') {
      reasons.push(`${momentumAnalysis.direction} momentum`);
    }

    return `${signalType} signal: ${reasons.join(', ')}`;
  }

  // Pattern detection methods
  private detectDoublePattern(data: MarketData[]): string | null {
    // Simplified double bottom/top detection
    const lows = data.map(d => d.low);
    const highs = data.map(d => d.high);
    
    const minLow = Math.min(...lows);
    const maxHigh = Math.max(...highs);
    
    const lowCount = lows.filter(l => Math.abs(l - minLow) / minLow < 0.01).length;
    const highCount = highs.filter(h => Math.abs(h - maxHigh) / maxHigh < 0.01).length;
    
    if (lowCount >= 2) return 'DOUBLE_BOTTOM';
    if (highCount >= 2) return 'DOUBLE_TOP';
    return null;
  }

  private detectHeadShoulders(data: MarketData[]): string | null {
    // Simplified head and shoulders detection
    if (data.length < 5) return null;
    
    const highs = data.map(d => d.high);
    const maxHigh = Math.max(...highs);
    const maxIndex = highs.indexOf(maxHigh);
    
    // Check for three peaks with middle one being highest
    if (maxIndex > 1 && maxIndex < highs.length - 1) {
      const leftPeak = Math.max(...highs.slice(0, maxIndex));
      const rightPeak = Math.max(...highs.slice(maxIndex + 1));
      
      if (maxHigh > leftPeak && maxHigh > rightPeak && 
          Math.abs(leftPeak - rightPeak) / leftPeak < 0.02) {
        return 'HEAD_SHOULDERS';
      }
    }
    
    return null;
  }

  private checkVolumeConfirmation(data: MarketData[]): boolean {
    const volumes = data.map(d => d.volume);
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const currentVolume = volumes[volumes.length - 1];
    
    return currentVolume > avgVolume * 1.5; // 50% above average
  }

  private determineReversalDirection(data: MarketData[]): 'UP' | 'DOWN' {
    const recent = data[data.length - 1];
    const rsi = recent.rsi;
    
    if (rsi < 30) return 'UP';   // Oversold -> Up reversal
    if (rsi > 70) return 'DOWN'; // Overbought -> Down reversal
    
    // Fallback to price action
    const priceChange = (recent.close - data[0].close) / data[0].close;
    return priceChange > 0 ? 'DOWN' : 'UP';
  }

  private calculateReversalConfidence(data: MarketData[]): number {
    const recent = data[data.length - 1];
    const rsi = recent.rsi;
    
    // Higher confidence for extreme RSI values
    if (rsi < 20 || rsi > 80) return 85;
    if (rsi < 30 || rsi > 70) return 75;
    return 60;
  }

  private calculateReversalTarget(direction: 'UP' | 'DOWN', currentPrice: number): number {
    const targetPercent = 0.02; // 2% target
    return direction === 'UP' 
      ? currentPrice * (1 + targetPercent)
      : currentPrice * (1 - targetPercent);
  }

  private calculateReversalStopLoss(direction: 'UP' | 'DOWN', currentPrice: number): number {
    const stopPercent = 0.015; // 1.5% stop loss
    return direction === 'UP'
      ? currentPrice * (1 - stopPercent)
      : currentPrice * (1 + stopPercent);
  }

  // Utility methods
  private countHigherHighs(highs: number[]): number {
    let count = 0;
    for (let i = 1; i < highs.length; i++) {
      if (highs[i] > highs[i-1]) count++;
    }
    return count;
  }

  private countHigherLows(lows: number[]): number {
    let count = 0;
    for (let i = 1; i < lows.length; i++) {
      if (lows[i] > lows[i-1]) count++;
    }
    return count;
  }

  private countLowerHighs(highs: number[]): number {
    let count = 0;
    for (let i = 1; i < highs.length; i++) {
      if (highs[i] < highs[i-1]) count++;
    }
    return count;
  }

  private countLowerLows(lows: number[]): number {
    let count = 0;
    for (let i = 1; i < lows.length; i++) {
      if (lows[i] < lows[i-1]) count++;
    }
    return count;
  }

  private calculateTrendConfidence(data: MarketData[], direction: string): number {
    // Simplified confidence calculation
    const rsi = data[data.length - 1].rsi;
    const macd = data[data.length - 1].macd;
    
    let confidence = 50;
    
    if (direction === 'BULLISH') {
      if (rsi > 50 && macd > 0) confidence += 20;
      if (rsi > 60) confidence += 10;
    } else if (direction === 'BEARISH') {
      if (rsi < 50 && macd < 0) confidence += 20;
      if (rsi < 40) confidence += 10;
    }
    
    return Math.min(confidence, 95);
  }

  // Mock data methods (replace with real API calls)
  private async getMarketData(symbol: string, timeframe: string): Promise<MarketData[]> {
    // Mock market data - replace with real API
    const mockData: MarketData[] = [];
    const basePrice = symbol === 'BTC' ? 50000 : symbol === 'ETH' ? 3000 : 100;
    
    for (let i = 0; i < 20; i++) {
      const price = basePrice * (1 + (Math.random() - 0.5) * 0.1);
      mockData.push({
        symbol,
        timestamp: Date.now() - (20 - i) * 300000, // 5 min intervals
        open: price,
        high: price * 1.01,
        low: price * 0.99,
        close: price * (1 + (Math.random() - 0.5) * 0.02),
        volume: 1000000 + Math.random() * 500000,
        rsi: 30 + Math.random() * 40,
        macd: (Math.random() - 0.5) * 100,
        bollingerUpper: price * 1.02,
        bollingerLower: price * 0.98,
        ema20: price * 1.001,
        ema50: price * 0.999,
        ema200: price * 0.998,
        volatility: 0.02 + Math.random() * 0.03
      });
    }
    
    return mockData;
  }

  // Public methods for monitoring
  getTrendHistory(symbol: string): TrendSignal[] {
    return this.trendHistory.get(symbol) || [];
  }

  getReversalHistory(symbol: string): ReversalSignal[] {
    return this.reversalHistory.get(symbol) || [];
  }

  getMarketDataCache(symbol: string): MarketData[] {
    return this.marketDataCache.get(symbol) || [];
  }
}
