import { logger } from '../utils/logger';
import { TradingSignal, MarketAnalysis } from '../services/ai-engine';
import { ExchangeConnector } from '../services/exchanges/exchange-connector';
import { DynamicPositionSizer, PositionSizingParams } from '../services/position/dynamic-position-sizer';

export interface MomentumReversalConfig {
  targetCoins: string[]; // ['BTC', 'ETH', 'SOL', 'BNB', 'ADA']
  dailyTargetMultiplier: number; // 2.0 = 2x günlük hedef
  maxPositionsPerCoin: number; // 3-5 pozisyon per coin
  quickProfitTarget: number; // %0.5-2 hızlı kar hedefi
  stopLossPercentage: number; // %1-3 stop loss
  maxDailyLoss: number; // %5 max günlük kayıp
  trendDetectionSensitivity: number; // 0.1-0.5 trend hassasiyeti
  reversalDetectionThreshold: number; // %2-5 reversal tespit eşiği
  executionSpeed: 'ULTRA_FAST' | 'FAST' | 'NORMAL'; // İşlem hızı
}

export interface TrendAnalysis {
  symbol: string;
  currentTrend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  trendStrength: number; // 0-100
  reversalProbability: number; // 0-100
  momentumScore: number; // -100 to +100
  supportLevel: number;
  resistanceLevel: number;
  nextMoveDirection: 'UP' | 'DOWN' | 'UNKNOWN';
  confidence: number; // 0-100
}

export interface QuickTrade {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  positionSize: number;
  expectedProfit: number;
  riskReward: number;
  confidence: number;
  timeframe: string; // '1m', '5m', '15m'
  reason: string;
}

export class MomentumReversalBot {
  private config: MomentumReversalConfig;
  private exchangeConnector: ExchangeConnector;
  private positionSizer: DynamicPositionSizer;
  private activeTrades: Map<string, QuickTrade[]> = new Map();
  private dailyPnL: number = 0;
  private dailyTarget: number = 0;
  private currentBalance: number = 100; // $100 başlangıç
  private trendCache: Map<string, TrendAnalysis> = new Map();
  private lastAnalysisTime: Map<string, number> = new Map();

  constructor(config: MomentumReversalConfig) {
    this.config = config;
    this.exchangeConnector = new ExchangeConnector();
    this.positionSizer = new DynamicPositionSizer();
    this.dailyTarget = this.currentBalance * (config.dailyTargetMultiplier - 1);
  }

  async initialize(): Promise<void> {
    await this.exchangeConnector.initialize();
    await this.positionSizer.initialize();
    
    // Her coin için trend analizi başlat
    for (const coin of this.config.targetCoins) {
      this.trendCache.set(coin, await this.analyzeTrend(coin));
    }
  }

  async startTrading(): Promise<void> {
    // Her 30 saniyede bir piyasa analizi
    setInterval(async () => {
      await this.scanAndExecute();
    }, 30000);

    // Her 5 saniyede bir pozisyon kontrolü
    setInterval(async () => {
      await this.manageActiveTrades();
    }, 5000);
  }

  private async scanAndExecute(): Promise<void> {
    try {
      // Günlük hedefe ulaşıldı mı kontrol et
      if (this.dailyPnL >= this.dailyTarget) {
        return;
      }

      // Her coin için analiz yap
      for (const coin of this.config.targetCoins) {
        await this.analyzeAndTrade(coin);
      }

    } catch (error) {
      logger.error('❌ Error in scan and execute:', error);
    }
  }

  private async analyzeAndTrade(symbol: string): Promise<void> {
    try {
      // Trend analizi yap
      const trendAnalysis = await this.analyzeTrend(symbol);
      this.trendCache.set(symbol, trendAnalysis);

      // Mevcut pozisyon sayısını kontrol et
      const activeTrades = this.activeTrades.get(symbol) || [];
      if (activeTrades.length >= this.config.maxPositionsPerCoin) {
        return;
      }

      // Trading sinyali oluştur
      const tradeSignal = await this.generateTradeSignal(symbol, trendAnalysis);
      
      if (tradeSignal) {
        await this.executeQuickTrade(tradeSignal);
      }

    } catch (error) {
      logger.error(`❌ Error analyzing ${symbol}:`, error);
    }
  }

  private async analyzeTrend(symbol: string): Promise<TrendAnalysis> {
    try {
      // Gerçek piyasa verilerini al (mock data şimdilik)
      const marketData = await this.getMarketData(symbol);
      
      // Trend analizi
      const trend = this.detectTrend(marketData);
      const reversal = this.detectReversal(marketData);
      const momentum = this.calculateMomentum(marketData);
      
      // Support/Resistance seviyeleri
      const support = this.calculateSupport(marketData);
      const resistance = this.calculateResistance(marketData);
      
      // Bir sonraki hareket yönü
      const nextMove = this.predictNextMove(trend, reversal, momentum);
      
      // Güven skoru
      const confidence = this.calculateConfidence(trend, reversal, momentum);

      return {
        symbol,
        currentTrend: trend.direction,
        trendStrength: trend.strength,
        reversalProbability: reversal.probability,
        momentumScore: momentum.score,
        supportLevel: support,
        resistanceLevel: resistance,
        nextMoveDirection: nextMove,
        confidence
      };

    } catch (error) {
      logger.error(`❌ Error analyzing trend for ${symbol}:`, error);
      return this.getDefaultTrendAnalysis(symbol);
    }
  }

  private async generateTradeSignal(symbol: string, analysis: TrendAnalysis): Promise<QuickTrade | null> {
    try {
      // Yüksek güven skoru gerekli
      if (analysis.confidence < 70) {
        return null;
      }

      // Trend ve momentum analizi
      const shouldGoLong = analysis.nextMoveDirection === 'UP' && 
                           analysis.momentumScore > 20 && 
                           analysis.trendStrength > 60;

      const shouldGoShort = analysis.nextMoveDirection === 'DOWN' && 
                            analysis.momentumScore < -20 && 
                            analysis.trendStrength > 60;

      if (!shouldGoLong && !shouldGoShort) {
        return null;
      }

      // Pozisyon boyutu hesapla
      const positionSize = await this.calculatePositionSize(symbol, analysis);
      
      // Entry, target, stop loss fiyatları
      const entryPrice = await this.getCurrentPrice(symbol);
      const direction = shouldGoLong ? 'LONG' : 'SHORT';
      
      const targetPrice = direction === 'LONG' 
        ? entryPrice * (1 + this.config.quickProfitTarget / 100)
        : entryPrice * (1 - this.config.quickProfitTarget / 100);
        
      const stopLoss = direction === 'LONG'
        ? entryPrice * (1 - this.config.stopLossPercentage / 100)
        : entryPrice * (1 + this.config.stopLossPercentage / 100);

      const expectedProfit = Math.abs(targetPrice - entryPrice) * positionSize;
      const riskAmount = Math.abs(entryPrice - stopLoss) * positionSize;
      const riskReward = expectedProfit / riskAmount;

      // Risk/Reward oranı kontrolü
      if (riskReward < 1.5) {
        return null;
      }

      return {
        symbol,
        direction,
        entryPrice,
        targetPrice,
        stopLoss,
        positionSize,
        expectedProfit,
        riskReward,
        confidence: analysis.confidence,
        timeframe: '5m',
        reason: `${direction} signal: ${analysis.currentTrend} trend, momentum: ${analysis.momentumScore.toFixed(1)}`
      };

    } catch (error) {
      logger.error(`❌ Error generating trade signal for ${symbol}:`, error);
      return null;
    }
  }

  private async executeQuickTrade(trade: QuickTrade): Promise<void> {
    try {
      // Pozisyonu aç
      const success = await this.openPosition(trade);
      
      if (success) {
        // Aktif trade listesine ekle
        const activeTrades = this.activeTrades.get(trade.symbol) || [];
        activeTrades.push(trade);
        this.activeTrades.set(trade.symbol, activeTrades);
      }

    } catch (error) {
      // Sessiz hata yönetimi
    }
  }

  private async manageActiveTrades(): Promise<void> {
    try {
      for (const [symbol, trades] of this.activeTrades.entries()) {
        for (let i = trades.length - 1; i >= 0; i--) {
          const trade = trades[i];
          const currentPrice = await this.getCurrentPrice(symbol);
          
          // Take profit kontrolü
          if (this.shouldTakeProfit(trade, currentPrice)) {
            await this.closePosition(symbol, trade, currentPrice, 'TAKE_PROFIT');
            trades.splice(i, 1);
            continue;
          }
          
          // Stop loss kontrolü
          if (this.shouldStopLoss(trade, currentPrice)) {
            await this.closePosition(symbol, trade, currentPrice, 'STOP_LOSS');
            trades.splice(i, 1);
            continue;
          }
          
          // Timeout kontrolü (5 dakika max)
          if (Date.now() - (trade as any).timestamp > 300000) {
            await this.closePosition(symbol, trade, currentPrice, 'TIMEOUT');
            trades.splice(i, 1);
          }
        }
      }

    } catch (error) {
      logger.error('❌ Error managing active trades:', error);
    }
  }

  private shouldTakeProfit(trade: QuickTrade, currentPrice: number): boolean {
    if (trade.direction === 'LONG') {
      return currentPrice >= trade.targetPrice;
    } else {
      return currentPrice <= trade.targetPrice;
    }
  }

  private shouldStopLoss(trade: QuickTrade, currentPrice: number): boolean {
    if (trade.direction === 'LONG') {
      return currentPrice <= trade.stopLoss;
    } else {
      return currentPrice >= trade.stopLoss;
    }
  }

  private async closePosition(symbol: string, trade: QuickTrade, exitPrice: number, reason: string): Promise<void> {
    try {
      // P&L hesapla
      const pnl = this.calculatePnL(trade, exitPrice);
      this.dailyPnL += pnl;
      this.currentBalance += pnl;

      // Pozisyonu kapat (gerçek borsa API'si burada kullanılacak)
      await this.closePositionOnExchange(symbol, trade);

    } catch (error) {
      // Sessiz hata yönetimi
    }
  }

  private calculatePnL(trade: QuickTrade, exitPrice: number): number {
    const priceDiff = exitPrice - trade.entryPrice;
    const multiplier = trade.direction === 'LONG' ? 1 : -1;
    return priceDiff * multiplier * trade.positionSize;
  }

  // Trend detection methods
  private detectTrend(marketData: any): { direction: 'BULLISH' | 'BEARISH' | 'SIDEWAYS', strength: number } {
    // Mock trend detection - gerçek implementasyon gerekli
    const priceChange = (marketData.currentPrice - marketData.openPrice) / marketData.openPrice;
    
    if (priceChange > 0.02) return { direction: 'BULLISH', strength: 80 };
    if (priceChange < -0.02) return { direction: 'BEARISH', strength: 80 };
    return { direction: 'SIDEWAYS', strength: 40 };
  }

  private detectReversal(marketData: any): { probability: number } {
    // Mock reversal detection
    const volatility = marketData.volatility || 0.03;
    const probability = Math.min(volatility * 100, 90);
    return { probability };
  }

  private calculateMomentum(marketData: any): { score: number } {
    // Mock momentum calculation
    const rsi = marketData.rsi || 50;
    const score = (rsi - 50) * 2; // -100 to +100
    return { score };
  }

  private calculateSupport(marketData: any): number {
    return marketData.currentPrice * 0.98; // %2 support
  }

  private calculateResistance(marketData: any): number {
    return marketData.currentPrice * 1.02; // %2 resistance
  }

  private predictNextMove(trend: any, reversal: any, momentum: any): 'UP' | 'DOWN' | 'UNKNOWN' {
    if (momentum.score > 30 && trend.direction === 'BULLISH') return 'UP';
    if (momentum.score < -30 && trend.direction === 'BEARISH') return 'DOWN';
    if (reversal.probability > 70) return trend.direction === 'BULLISH' ? 'DOWN' : 'UP';
    return 'UNKNOWN';
  }

  private calculateConfidence(trend: any, reversal: any, momentum: any): number {
    let confidence = 50;
    
    confidence += trend.strength * 0.3;
    confidence += Math.abs(momentum.score) * 0.2;
    confidence += reversal.probability * 0.1;
    
    return Math.min(Math.max(confidence, 0), 100);
  }

  private async calculatePositionSize(symbol: string, analysis: TrendAnalysis): Promise<number> {
    // Günlük hedefe göre pozisyon boyutu ayarla
    const remainingTarget = this.dailyTarget - this.dailyPnL;
    const maxPositionSize = Math.min(remainingTarget * 0.1, this.currentBalance * 0.05);
    
    // Güven skoruna göre ayarla
    const confidenceMultiplier = analysis.confidence / 100;
    return maxPositionSize * confidenceMultiplier;
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    // Mock price - gerçek API'den gelecek
    return 50000; // BTC mock price
  }

  private async getMarketData(symbol: string): Promise<any> {
    // Mock market data - gerçek API'den gelecek
    return {
      currentPrice: 50000,
      openPrice: 49500,
      volatility: 0.03,
      rsi: 65,
      volume: 1000000
    };
  }

  private async openPosition(trade: QuickTrade): Promise<boolean> {
    // Mock position opening - gerçek borsa API'si
    (trade as any).timestamp = Date.now();
    return true;
  }

  private async closePositionOnExchange(symbol: string, trade: QuickTrade): Promise<void> {
    // Mock position closing - gerçek borsa API'si
  }

  private getDefaultTrendAnalysis(symbol: string): TrendAnalysis {
    return {
      symbol,
      currentTrend: 'SIDEWAYS',
      trendStrength: 50,
      reversalProbability: 50,
      momentumScore: 0,
      supportLevel: 0,
      resistanceLevel: 0,
      nextMoveDirection: 'UNKNOWN',
      confidence: 50
    };
  }

  // Public methods for monitoring
  getDailyStatus(): {
    currentBalance: number;
    dailyPnL: number;
    dailyTarget: number;
    targetProgress: number;
    activeTrades: number;
    totalTrades: number;
  } {
    const totalTrades = Array.from(this.activeTrades.values()).flat().length;
    
    return {
      currentBalance: this.currentBalance,
      dailyPnL: this.dailyPnL,
      dailyTarget: this.dailyTarget,
      targetProgress: (this.dailyPnL / this.dailyTarget) * 100,
      activeTrades: totalTrades,
      totalTrades: totalTrades
    };
  }

  getActiveTrades(): Map<string, QuickTrade[]> {
    return this.activeTrades;
  }

  getTrendAnalysis(symbol: string): TrendAnalysis | null {
    return this.trendCache.get(symbol) || null;
  }
}
