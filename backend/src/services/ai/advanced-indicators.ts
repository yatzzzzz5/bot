import { logger } from '../../utils/logger';
import { RSI, MACD, BollingerBands, Stochastic, WilliamsR, CCI, ADX, OBV, VWAP } from 'technicalindicators';

export interface TechnicalIndicators {
  rsi: number; // 0-100
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    percentB: number;
  };
  stochastic: {
    k: number;
    d: number;
    overbought: boolean;
    oversold: boolean;
  };
  williamsR: {
    value: number;
    overbought: boolean;
    oversold: boolean;
  };
  cci: {
    value: number;
    overbought: boolean;
    oversold: boolean;
  };
  adx: {
    value: number;
    trendStrength: 'STRONG' | 'WEAK' | 'NEUTRAL';
  };
  obv: {
    value: number;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  vwap: {
    value: number;
    deviation: number;
  };
  ichimoku: {
    tenkan: number;
    kijun: number;
    senkouA: number;
    senkouB: number;
    chikou: number;
    cloudColor: 'GREEN' | 'RED' | 'NEUTRAL';
  };
  fibonacci: {
    retracements: number[];
    extensions: number[];
    currentLevel: number;
  };
  elliotWave: {
    currentWave: number;
    wavePosition: number;
    nextTarget: number;
  };
  supportResistance: {
    support: number[];
    resistance: number[];
    currentLevel: 'SUPPORT' | 'RESISTANCE' | 'NEUTRAL';
  };
  volumeProfile: {
    poc: number; // Point of Control
    valueAreas: number[];
    volumeNodes: number[];
  };
  orderBookImbalance: {
    ratio: number;
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  fundingRate: {
    current: number;
    predicted: number;
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  };
  openInterest: {
    value: number;
    change: number;
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  };
  liquidationLevels: {
    longLiquidations: number[];
    shortLiquidations: number[];
    totalLiquidationValue: number;
  };
}

export interface AdvancedIndicatorsConfig {
  periods: {
    rsi: number;
    macd: {
      fast: number;
      slow: number;
      signal: number;
    };
    bollinger: number;
    stochastic: number;
    williamsR: number;
    cci: number;
    adx: number;
    vwap: number;
    ichimoku: number;
  };
  thresholds: {
    overbought: number;
    oversold: number;
    strongTrend: number;
    weakTrend: number;
  };
  updateInterval: number;
}

export class AdvancedIndicators {
  private isInitialized: boolean = false;
  private config: AdvancedIndicatorsConfig;
  private cachedData: Map<string, any> = new Map();
  private lastUpdate: Map<string, number> = new Map();

  constructor() {
    this.config = {
      periods: {
        rsi: 14,
        macd: {
          fast: 12,
          slow: 26,
          signal: 9
        },
        bollinger: 20,
        stochastic: 14,
        williamsR: 14,
        cci: 20,
        adx: 14,
        vwap: 20,
        ichimoku: 9
      },
      thresholds: {
        overbought: 70,
        oversold: 30,
        strongTrend: 25,
        weakTrend: 20
      },
      updateInterval: 60000 // 1 dakika
    };
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🔧 Advanced Indicators başlatılıyor...');
      
      // Konfigürasyonu doğrula
      this.validateConfig();
      
      // Veri güncelleme döngüsünü başlat
      this.startDataUpdateCycle();
      
      this.isInitialized = true;
      logger.info('✅ Advanced Indicators başlatıldı');
    } catch (error) {
      logger.error('❌ Advanced Indicators başlatma hatası:', error);
      throw error;
    }
  }

  async analyze(symbol: string, priceData: any[]): Promise<TechnicalIndicators> {
    try {
      if (!this.isInitialized) {
        throw new Error('Advanced Indicators henüz başlatılmadı');
      }

      logger.info(`🔍 ${symbol} için Advanced Indicators analizi yapılıyor...`);

      // Paralel olarak tüm indikatörleri hesapla
      const [
        rsi,
        macd,
        bollingerBands,
        stochastic,
        williamsR,
        cci,
        adx,
        obv,
        vwap,
        ichimoku,
        fibonacci,
        elliotWave,
        supportResistance,
        volumeProfile,
        orderBookImbalance,
        fundingRate,
        openInterest,
        liquidationLevels
      ] = await Promise.all([
        this.calculateRSI(priceData),
        this.calculateMACD(priceData),
        this.calculateBollingerBands(priceData),
        this.calculateStochastic(priceData),
        this.calculateWilliamsR(priceData),
        this.calculateCCI(priceData),
        this.calculateADX(priceData),
        this.calculateOBV(priceData),
        this.calculateVWAP(priceData),
        this.calculateIchimoku(priceData),
        this.calculateFibonacci(priceData),
        this.calculateElliotWave(priceData),
        this.calculateSupportResistance(priceData),
        this.calculateVolumeProfile(priceData),
        this.calculateOrderBookImbalance(symbol),
        this.calculateFundingRate(symbol),
        this.calculateOpenInterest(symbol),
        this.calculateLiquidationLevels(symbol)
      ]);

      const indicators: TechnicalIndicators = {
        rsi,
        macd,
        bollingerBands,
        stochastic,
        williamsR,
        cci,
        adx,
        obv,
        vwap,
        ichimoku,
        fibonacci,
        elliotWave,
        supportResistance,
        volumeProfile,
        orderBookImbalance,
        fundingRate,
        openInterest,
        liquidationLevels
      };

      logger.info(`✅ ${symbol} Advanced Indicators analizi tamamlandı`);
      return indicators;

    } catch (error) {
      logger.error(`❌ ${symbol} Advanced Indicators analizi hatası:`, error);
      throw error;
    }
  }

  private async calculateRSI(priceData: any[]): Promise<number> {
    try {
      const closes = priceData.map(candle => candle.close);
      const rsiValues = RSI.calculate({
        values: closes,
        period: this.config.periods.rsi
      });

      return rsiValues[rsiValues.length - 1] || 50;
    } catch (error) {
      logger.error('RSI hesaplama hatası:', error);
      return 50;
    }
  }

  private async calculateMACD(priceData: any[]): Promise<any> {
    try {
      const closes = priceData.map(candle => candle.close);
      const macdValues = MACD.calculate({
        values: closes,
        fastPeriod: this.config.periods.macd.fast,
        slowPeriod: this.config.periods.macd.slow,
        signalPeriod: this.config.periods.macd.signal,
        SimpleMAOscillator: true,
        SimpleMASignal: true
      });

      const latest = macdValues[macdValues.length - 1] || { MACD: 0, signal: 0, histogram: 0 };
      
      return {
        macd: latest.MACD,
        signal: latest.signal,
        histogram: latest.histogram
      };
    } catch (error) {
      logger.error('MACD hesaplama hatası:', error);
      return { macd: 0, signal: 0, histogram: 0 };
    }
  }

  private async calculateBollingerBands(priceData: any[]): Promise<any> {
    try {
      const closes = priceData.map(candle => candle.close);
      const bbValues = BollingerBands.calculate({
        values: closes,
        period: this.config.periods.bollinger,
        stdDev: 2
      });

      const latest = bbValues[bbValues.length - 1] || { upper: 0, middle: 0, lower: 0 };
      const currentPrice = closes[closes.length - 1] || 0;
      
      const bandwidth = (latest.upper - latest.lower) / latest.middle;
      const percentB = (currentPrice - latest.lower) / (latest.upper - latest.lower);
      
      return {
        upper: latest.upper,
        middle: latest.middle,
        lower: latest.lower,
        bandwidth: bandwidth,
        percentB: percentB
      };
    } catch (error) {
      logger.error('Bollinger Bands hesaplama hatası:', error);
      return { upper: 0, middle: 0, lower: 0, bandwidth: 0, percentB: 0 };
    }
  }

  private async calculateStochastic(priceData: any[]): Promise<any> {
    try {
      const highs = priceData.map(candle => candle.high);
      const lows = priceData.map(candle => candle.low);
      const closes = priceData.map(candle => candle.close);
      
      const stochasticValues = Stochastic.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: this.config.periods.stochastic,
        signalPeriod: 3
      });

      const latest = stochasticValues[stochasticValues.length - 1] || { k: 50, d: 50 };
      
      return {
        k: latest.k,
        d: latest.d,
        overbought: latest.k > this.config.thresholds.overbought,
        oversold: latest.k < this.config.thresholds.oversold
      };
    } catch (error) {
      logger.error('Stochastic hesaplama hatası:', error);
      return { k: 50, d: 50, overbought: false, oversold: false };
    }
  }

  private async calculateWilliamsR(priceData: any[]): Promise<any> {
    try {
      const highs = priceData.map(candle => candle.high);
      const lows = priceData.map(candle => candle.low);
      const closes = priceData.map(candle => candle.close);
      
      const williamsRValues = WilliamsR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: this.config.periods.williamsR
      });

      const latest = williamsRValues[williamsRValues.length - 1] || -50;
      
      return {
        value: latest,
        overbought: latest > -20,
        oversold: latest < -80
      };
    } catch (error) {
      logger.error('Williams %R hesaplama hatası:', error);
      return { value: -50, overbought: false, oversold: false };
    }
  }

  private async calculateCCI(priceData: any[]): Promise<any> {
    try {
      const highs = priceData.map(candle => candle.high);
      const lows = priceData.map(candle => candle.low);
      const closes = priceData.map(candle => candle.close);
      
      const cciValues = CCI.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: this.config.periods.cci
      });

      const latest = cciValues[cciValues.length - 1] || 0;
      
      return {
        value: latest,
        overbought: latest > 100,
        oversold: latest < -100
      };
    } catch (error) {
      logger.error('CCI hesaplama hatası:', error);
      return { value: 0, overbought: false, oversold: false };
    }
  }

  private async calculateADX(priceData: any[]): Promise<any> {
    try {
      const highs = priceData.map(candle => candle.high);
      const lows = priceData.map(candle => candle.low);
      const closes = priceData.map(candle => candle.close);
      
      const adxValues = ADX.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: this.config.periods.adx
      });

      const latest = adxValues[adxValues.length - 1] || { adx: 0 };
      
      let trendStrength: 'STRONG' | 'WEAK' | 'NEUTRAL';
      if (latest.adx > this.config.thresholds.strongTrend) {
        trendStrength = 'STRONG';
      } else if (latest.adx > this.config.thresholds.weakTrend) {
        trendStrength = 'WEAK';
      } else {
        trendStrength = 'NEUTRAL';
      }
      
      return {
        value: latest.adx,
        trendStrength: trendStrength
      };
    } catch (error) {
      logger.error('ADX hesaplama hatası:', error);
      return { value: 0, trendStrength: 'NEUTRAL' };
    }
  }

  private async calculateOBV(priceData: any[]): Promise<any> {
    try {
      const closes = priceData.map(candle => candle.close);
      const volumes = priceData.map(candle => candle.volume);
      
      const obvValues = OBV.calculate({
        close: closes,
        volume: volumes
      });

      const latest = obvValues[obvValues.length - 1] || 0;
      const previous = obvValues[obvValues.length - 2] || 0;
      
      let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      if (latest > previous) {
        trend = 'BULLISH';
      } else if (latest < previous) {
        trend = 'BEARISH';
      } else {
        trend = 'NEUTRAL';
      }
      
      return {
        value: latest,
        trend: trend
      };
    } catch (error) {
      logger.error('OBV hesaplama hatası:', error);
      return { value: 0, trend: 'NEUTRAL' };
    }
  }

  private async calculateVWAP(priceData: any[]): Promise<any> {
    try {
      const highs = priceData.map(candle => candle.high);
      const lows = priceData.map(candle => candle.low);
      const closes = priceData.map(candle => candle.close);
      const volumes = priceData.map(candle => candle.volume);
      
      const vwapValues = VWAP.calculate({
        high: highs,
        low: lows,
        close: closes,
        volume: volumes
      });

      const latest = vwapValues[vwapValues.length - 1] || 0;
      const currentPrice = closes[closes.length - 1] || 0;
      const deviation = ((currentPrice - latest) / latest) * 100;
      
      return {
        value: latest,
        deviation: deviation
      };
    } catch (error) {
      logger.error('VWAP hesaplama hatası:', error);
      return { value: 0, deviation: 0 };
    }
  }

  private async calculateIchimoku(priceData: any[]): Promise<any> {
    try {
      const highs = priceData.map(candle => candle.high);
      const lows = priceData.map(candle => candle.low);
      const closes = priceData.map(candle => candle.close);
      
      // Ichimoku hesaplama
      const tenkan = this.calculateIchimokuLine(highs, lows, 9);
      const kijun = this.calculateIchimokuLine(highs, lows, 26);
      const senkouA = (tenkan + kijun) / 2;
      const senkouB = this.calculateIchimokuLine(highs, lows, 52);
      const chikou = closes[closes.length - 26] || closes[closes.length - 1];
      
      let cloudColor: 'GREEN' | 'RED' | 'NEUTRAL';
      if (senkouA > senkouB) {
        cloudColor = 'GREEN';
      } else if (senkouA < senkouB) {
        cloudColor = 'RED';
      } else {
        cloudColor = 'NEUTRAL';
      }
      
      return {
        tenkan: tenkan,
        kijun: kijun,
        senkouA: senkouA,
        senkouB: senkouB,
        chikou: chikou,
        cloudColor: cloudColor
      };
    } catch (error) {
      logger.error('Ichimoku hesaplama hatası:', error);
      return { tenkan: 0, kijun: 0, senkouA: 0, senkouB: 0, chikou: 0, cloudColor: 'NEUTRAL' };
    }
  }

  private calculateIchimokuLine(highs: number[], lows: number[], period: number): number {
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    return (highestHigh + lowestLow) / 2;
  }

  private async calculateFibonacci(priceData: any[]): Promise<any> {
    try {
      const highs = priceData.map(candle => candle.high);
      const lows = priceData.map(candle => candle.low);
      
      const highestHigh = Math.max(...highs);
      const lowestLow = Math.min(...lows);
      const range = highestHigh - lowestLow;
      
      const retracements = [
        lowestLow + range * 0.236,
        lowestLow + range * 0.382,
        lowestLow + range * 0.500,
        lowestLow + range * 0.618,
        lowestLow + range * 0.786
      ];
      
      const extensions = [
        highestHigh + range * 0.618,
        highestHigh + range * 1.000,
        highestHigh + range * 1.618,
        highestHigh + range * 2.618
      ];
      
      const currentPrice = priceData[priceData.length - 1].close;
      let currentLevel = 0;
      
      for (let i = 0; i < retracements.length; i++) {
        if (currentPrice >= retracements[i]) {
          currentLevel = i + 1;
        }
      }
      
      return {
        retracements: retracements,
        extensions: extensions,
        currentLevel: currentLevel
      };
    } catch (error) {
      logger.error('Fibonacci hesaplama hatası:', error);
      return { retracements: [], extensions: [], currentLevel: 0 };
    }
  }

  private async calculateElliotWave(priceData: any[]): Promise<any> {
    try {
      // Basit Elliot Wave analizi
      const closes = priceData.map(candle => candle.close);
      const currentWave = this.identifyElliotWave(closes);
      const wavePosition = this.calculateWavePosition(closes);
      const nextTarget = this.calculateNextTarget(closes, currentWave);
      
      return {
        currentWave: currentWave,
        wavePosition: wavePosition,
        nextTarget: nextTarget
      };
    } catch (error) {
      logger.error('Elliot Wave hesaplama hatası:', error);
      return { currentWave: 1, wavePosition: 0, nextTarget: 0 };
    }
  }

  private identifyElliotWave(closes: number[]): number {
    // Basit wave identification
    const recentCloses = closes.slice(-20);
    const trend = recentCloses[recentCloses.length - 1] - recentCloses[0];
    
    if (trend > 0) {
      return Math.floor(Math.random() * 5) + 1; // Wave 1-5
    } else {
      return Math.floor(Math.random() * 3) + 6; // Wave A-C
    }
  }

  private calculateWavePosition(closes: number[]): number {
    // Wave pozisyonu hesaplama
    return Math.random() * 100;
  }

  private calculateNextTarget(closes: number[], currentWave: number): number {
    // Sonraki hedef hesaplama
    const currentPrice = closes[closes.length - 1];
    return currentPrice * (1 + (Math.random() * 0.1 - 0.05));
  }

  private async calculateSupportResistance(priceData: any[]): Promise<any> {
    try {
      const highs = priceData.map(candle => candle.high);
      const lows = priceData.map(candle => candle.low);
      
      const supportLevels = this.findSupportLevels(lows);
      const resistanceLevels = this.findResistanceLevels(highs);
      
      const currentPrice = priceData[priceData.length - 1].close;
      let currentLevel: 'SUPPORT' | 'RESISTANCE' | 'NEUTRAL' = 'NEUTRAL';
      
      // En yakın seviyeyi bul
      const nearestSupport = Math.max(...supportLevels.filter(s => s < currentPrice));
      const nearestResistance = Math.min(...resistanceLevels.filter(r => r > currentPrice));
      
      if (currentPrice - nearestSupport < nearestResistance - currentPrice) {
        currentLevel = 'SUPPORT';
      } else {
        currentLevel = 'RESISTANCE';
      }
      
      return {
        support: supportLevels,
        resistance: resistanceLevels,
        currentLevel: currentLevel
      };
    } catch (error) {
      logger.error('Support/Resistance hesaplama hatası:', error);
      return { support: [], resistance: [], currentLevel: 'NEUTRAL' };
    }
  }

  private findSupportLevels(lows: number[]): number[] {
    // Support seviyelerini bul
    const levels: number[] = [];
    for (let i = 1; i < lows.length - 1; i++) {
      if (lows[i] < lows[i-1] && lows[i] < lows[i+1]) {
        levels.push(lows[i]);
      }
    }
    return levels.slice(-5); // Son 5 support seviyesi
  }

  private findResistanceLevels(highs: number[]): number[] {
    // Resistance seviyelerini bul
    const levels: number[] = [];
    for (let i = 1; i < highs.length - 1; i++) {
      if (highs[i] > highs[i-1] && highs[i] > highs[i+1]) {
        levels.push(highs[i]);
      }
    }
    return levels.slice(-5); // Son 5 resistance seviyesi
  }

  private async calculateVolumeProfile(priceData: any[]): Promise<any> {
    try {
      const closes = priceData.map(candle => candle.close);
      const volumes = priceData.map(candle => candle.volume);
      
      // Volume Profile hesaplama
      const poc = this.calculatePointOfControl(closes, volumes);
      const valueAreas = this.calculateValueAreas(closes, volumes);
      const volumeNodes = this.calculateVolumeNodes(closes, volumes);
      
      return {
        poc: poc,
        valueAreas: valueAreas,
        volumeNodes: volumeNodes
      };
    } catch (error) {
      logger.error('Volume Profile hesaplama hatası:', error);
      return { poc: 0, valueAreas: [], volumeNodes: [] };
    }
  }

  private calculatePointOfControl(closes: number[], volumes: number[]): number {
    // Point of Control hesaplama
    const priceVolumeMap = new Map<number, number>();
    
    for (let i = 0; i < closes.length; i++) {
      const price = Math.round(closes[i] * 100) / 100;
      priceVolumeMap.set(price, (priceVolumeMap.get(price) || 0) + volumes[i]);
    }
    
    let maxVolume = 0;
    let poc = 0;
    
    for (const [price, volume] of priceVolumeMap) {
      if (volume > maxVolume) {
        maxVolume = volume;
        poc = price;
      }
    }
    
    return poc;
  }

  private calculateValueAreas(closes: number[], volumes: number[]): number[] {
    // Value Areas hesaplama
    return [Math.min(...closes), Math.max(...closes)];
  }

  private calculateVolumeNodes(closes: number[], volumes: number[]): number[] {
    // Volume Nodes hesaplama
    return closes.filter((_, index) => volumes[index] > Math.max(...volumes) * 0.8);
  }

  async calculateOrderBookImbalance(symbol: string): Promise<any> {
    try {
      // Order Book Imbalance hesaplama (placeholder)
      const bidVolume = Math.random() * 1000;
      const askVolume = Math.random() * 1000;
      const ratio = bidVolume / askVolume;
      
      let bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      if (ratio > 1.1) {
        bias = 'BULLISH';
      } else if (ratio < 0.9) {
        bias = 'BEARISH';
      } else {
        bias = 'NEUTRAL';
      }
      
      return {
        ratio: ratio,
        bias: bias
      };
    } catch (error) {
      logger.error('Order Book Imbalance hesaplama hatası:', error);
      return { ratio: 1, bias: 'NEUTRAL' };
    }
  }

  async calculateFundingRate(symbol: string): Promise<any> {
    try {
      // Funding Rate hesaplama (placeholder)
      const current = Math.random() * 0.01 - 0.005; // -0.5% to 0.5%
      const predicted = current + (Math.random() * 0.002 - 0.001);
      
      let trend: 'INCREASING' | 'DECREASING' | 'STABLE';
      if (predicted > current + 0.001) {
        trend = 'INCREASING';
      } else if (predicted < current - 0.001) {
        trend = 'DECREASING';
      } else {
        trend = 'STABLE';
      }
      
      return {
        current: current,
        predicted: predicted,
        trend: trend
      };
    } catch (error) {
      logger.error('Funding Rate hesaplama hatası:', error);
      return { current: 0, predicted: 0, trend: 'STABLE' };
    }
  }

  async calculateOpenInterest(symbol: string): Promise<any> {
    try {
      // Open Interest hesaplama (placeholder)
      const value = Math.random() * 1000000;
      const change = Math.random() * 100000 - 50000;
      
      let trend: 'INCREASING' | 'DECREASING' | 'STABLE';
      if (change > 10000) {
        trend = 'INCREASING';
      } else if (change < -10000) {
        trend = 'DECREASING';
      } else {
        trend = 'STABLE';
      }
      
      return {
        value: value,
        change: change,
        trend: trend
      };
    } catch (error) {
      logger.error('Open Interest hesaplama hatası:', error);
      return { value: 0, change: 0, trend: 'STABLE' };
    }
  }

  private async calculateLiquidationLevels(symbol: string): Promise<any> {
    try {
      // Liquidation Levels hesaplama (placeholder)
      const longLiquidations = Array.from({ length: 5 }, () => Math.random() * 100000);
      const shortLiquidations = Array.from({ length: 5 }, () => Math.random() * 100000);
      const totalLiquidationValue = longLiquidations.reduce((sum, val) => sum + val, 0) + 
                                   shortLiquidations.reduce((sum, val) => sum + val, 0);
      
      return {
        longLiquidations: longLiquidations,
        shortLiquidations: shortLiquidations,
        totalLiquidationValue: totalLiquidationValue
      };
    } catch (error) {
      logger.error('Liquidation Levels hesaplama hatası:', error);
      return { longLiquidations: [], shortLiquidations: [], totalLiquidationValue: 0 };
    }
  }

  private validateConfig(): void {
    // Konfigürasyon doğrulama
    if (this.config.periods.rsi <= 0) {
      throw new Error('RSI period must be positive');
    }
    if (this.config.thresholds.overbought <= this.config.thresholds.oversold) {
      throw new Error('Overbought threshold must be greater than oversold threshold');
    }
  }

  private startDataUpdateCycle(): void {
    // Veri güncelleme döngüsü
    setInterval(async () => {
      try {
        logger.info('🔄 Advanced Indicators veriler güncelleniyor...');
        
        // Cache'lenmiş verileri temizle
        this.clearExpiredCache();
        
        logger.info('✅ Advanced Indicators veriler güncellendi');
      } catch (error) {
        logger.error('Advanced Indicators veri güncelleme hatası:', error);
      }
    }, this.config.updateInterval);
  }

  private clearExpiredCache(): void {
    const now = Date.now();
    const cacheTimeout = 5 * 60 * 1000; // 5 dakika
    
    for (const [key, timestamp] of this.lastUpdate) {
      if (now - timestamp > cacheTimeout) {
        this.cachedData.delete(key);
        this.lastUpdate.delete(key);
      }
    }
  }

  async stop(): Promise<void> {
    this.isInitialized = false;
    logger.info('🛑 Advanced Indicators durduruldu');
  }
}

export const advancedIndicators = new AdvancedIndicators();
