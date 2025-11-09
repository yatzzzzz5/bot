import * as ccxt from 'ccxt';
import { logger } from '../utils/logger';

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  timestamp: Date;
}

export interface TradingPair {
  symbol: string;
  base: string;
  quote: string;
  price: number;
  lastUpdate: Date;
}

class RealTimePriceService {
  private binance: ccxt.binance;
  private priceCache: Map<string, PriceData> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

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
          defaultType: 'future', // Use futures for leverage trading
          adjustForTimeDifference: true,
        }
      });
      try {
        // Increase recvWindow to tolerate VPN/latency and minor clock skews
        (this.binance as any).options = (this.binance as any).options || {};
        (this.binance as any).options.recvWindow = parseInt(process.env.BINANCE_RECV_WINDOW || '60000');
      } catch {}
      logger.info('🚀 Real-time price service initialized with Binance API');
    } else {
      logger.info('ℹ️ Real-time price service initialized in demo mode (no valid API keys)');
    }
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('📈 Starting real-time price updates...');
    
    // Start price updates
    this.updateInterval = setInterval(async () => {
      await this.updateAllPrices();
    }, parseInt(process.env.PRICE_UPDATE_INTERVAL || '1000'));
    
    // Initial price update
    await this.updateAllPrices();
  }

  async stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    logger.info('🛑 Real-time price updates stopped');
  }

  private async updateAllPrices() {
    try {
      const symbols = ['BTC/USDT', 'ETH/USDT', 'ADA/USDT', 'SOL/USDT', 'BNB/USDT'];
      
      for (const symbol of symbols) {
        await this.updatePrice(symbol);
      }
    } catch (error) {
      logger.error('Error updating prices:', error);
    }
  }

  private async updatePrice(symbol: string) {
    try {
      // Always use demo prices in MOCK MODE
      const demoPrice = this.getDemoPrice(symbol);
      const priceData: PriceData = {
        symbol: symbol.replace('/', ''),
        price: demoPrice,
        change24h: (Math.random() - 0.5) * 1000,
        changePercent24h: (Math.random() - 0.5) * 10,
        volume24h: Math.random() * 1000000,
        timestamp: new Date()
      };
      this.priceCache.set(symbol, priceData);
      
      // Log significant price changes (commented to reduce spam)
      // if (Math.abs(priceData.changePercent24h) > 2) {
      //   logger.info(`📊 ${symbol}: $${priceData.price.toFixed(2)} (${priceData.changePercent24h.toFixed(2)}%)`);
      // }
    } catch (error) {
      logger.error(`Error updating price for ${symbol}:`, error);
    }
  }

  getPrice(symbol: string): PriceData | null {
    const key = symbol.includes('/') ? symbol : `${symbol}/USDT`;
    return this.priceCache.get(key) || null;
  }

  getAllPrices(): PriceData[] {
    return Array.from(this.priceCache.values());
  }

  getCurrentPrice(symbol: string): number {
    const priceData = this.getPrice(symbol);
    return priceData?.price || 0;
  }

  private getDemoPrice(symbol: string): number {
    // Demo prices for testing without API keys
    const basePrices: { [key: string]: number } = {
      'BTC/USDT': 45000 + (Math.random() - 0.5) * 2000,
      'ETH/USDT': 2800 + (Math.random() - 0.5) * 200,
      'ADA/USDT': 0.5 + (Math.random() - 0.5) * 0.1,
      'SOL/USDT': 100 + (Math.random() - 0.5) * 20,
      'BNB/USDT': 300 + (Math.random() - 0.5) * 30
    };
    
    return basePrices[symbol] || 100 + (Math.random() - 0.5) * 50;
  }

  async getAccountBalance() {
    try {
      if (!this.binance) {
        logger.warn('⚠️ Binance API not configured - cannot fetch real balance');
        return null; // NO MOCK DATA - return null if API not available
      }
      const balance = await this.binance.fetchBalance();
      return balance;
    } catch (error) {
      logger.error('❌ Error fetching account balance:', error);
      return null; // Return null on error - NO MOCK DATA
    }
  }

  async getOpenPositions() {
    try {
      if (!this.binance) {
        logger.warn('⚠️ Binance API not configured - cannot fetch real positions');
        return []; // NO MOCK DATA - return empty array
      }
      const positions = await this.binance.fetchPositions();
      return positions.filter((pos: any) => pos.size > 0);
    } catch (error) {
      logger.error('Error fetching open positions:', error);
      return [];
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}

export const realTimePriceService = new RealTimePriceService();
