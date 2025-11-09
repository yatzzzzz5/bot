import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface LiquiditySource {
  id: string;
  name: string;
  type: 'CEX' | 'DEX' | 'OTC' | 'AGGREGATOR';
  baseUrl: string;
  apiKey?: string;
  secretKey?: string;
  passphrase?: string;
  isActive: boolean;
  priority: number; // Lower number = higher priority
  fees: {
    maker: number;
    taker: number;
    withdrawal: number;
  };
  limits: {
    minOrderSize: number;
    maxOrderSize: number;
    dailyLimit: number;
    rateLimit: number; // requests per minute
  };
  supportedPairs: string[];
  lastUpdate: number;
  latency: number; // Average latency in ms
  reliability: number; // Success rate (0-1)
}

export interface OrderBook {
  source: string;
  symbol: string;
  timestamp: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  midPrice: number;
  volume24h: number;
  lastUpdate: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  orders: number;
}

export interface LiquiditySnapshot {
  symbol: string;
  timestamp: number;
  sources: {
    [sourceId: string]: {
      bestBid: number;
      bestAsk: number;
      bidSize: number;
      askSize: number;
      spread: number;
      midPrice: number;
      volume24h: number;
      latency: number;
      reliability: number;
    };
  };
  aggregated: {
    bestBid: number;
    bestAsk: number;
    totalBidSize: number;
    totalAskSize: number;
    weightedMidPrice: number;
    effectiveSpread: number;
    totalVolume24h: number;
    sourceCount: number;
  };
}

export interface SmartRoute {
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  timestamp: number;
  routes: RouteSegment[];
  totalCost: number;
  totalFees: number;
  estimatedSlippage: number;
  executionTime: number; // Estimated execution time in ms
  confidence: number; // 0-1
  riskScore: number; // 0-1
}

export interface RouteSegment {
  source: string;
  size: number;
  price: number;
  fees: number;
  slippage: number;
  latency: number;
  priority: number;
}

export interface LiquidityMetrics {
  symbol: string;
  timestamp: number;
  depth: {
    level1: number; // Best bid/ask size
    level2: number; // Top 2 levels
    level3: number; // Top 3 levels
    level5: number; // Top 5 levels
    level10: number; // Top 10 levels
  };
  spread: {
    absolute: number;
    relative: number; // Percentage
    effective: number; // Weighted by size
  };
  volume: {
    spot24h: number;
    spot1h: number;
    futures24h: number;
    futures1h: number;
  };
  volatility: {
    price1h: number;
    price24h: number;
    volume1h: number;
    volume24h: number;
  };
  marketImpact: {
    small: number; // 0.1% of volume
    medium: number; // 1% of volume
    large: number; // 5% of volume
  };
}

export class LiquidityAggregator extends EventEmitter {
  private sources: Map<string, LiquiditySource> = new Map();
  private orderBooks: Map<string, Map<string, OrderBook>> = new Map();
  private liquiditySnapshots: Map<string, LiquiditySnapshot> = new Map();
  private metrics: Map<string, LiquidityMetrics> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    logger.info('🌊 Initializing Liquidity Aggregator...');
    
    // Initialize default sources
    await this.initializeDefaultSources();
    
    // Start order book updates
    this.startOrderBookUpdates();
    
    // Start liquidity monitoring
    this.startLiquidityMonitoring();
    
    this.isRunning = true;
    logger.info('✅ Liquidity Aggregator initialized');
  }

  // Initialize default liquidity sources
  private async initializeDefaultSources(): Promise<void> {
    const defaultSources: LiquiditySource[] = [
      {
        id: 'binance',
        name: 'Binance',
        type: 'CEX',
        baseUrl: 'https://api.binance.com',
        isActive: true,
        priority: 1,
        fees: { maker: 0.001, taker: 0.001, withdrawal: 0.0005 },
        limits: { minOrderSize: 10, maxOrderSize: 1000000, dailyLimit: 10000000, rateLimit: 1200 },
        supportedPairs: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'],
        lastUpdate: Date.now(),
        latency: 50,
        reliability: 0.99
      },
      {
        id: 'coinbase',
        name: 'Coinbase Pro',
        type: 'CEX',
        baseUrl: 'https://api.pro.coinbase.com',
        isActive: true,
        priority: 2,
        fees: { maker: 0.005, taker: 0.005, withdrawal: 0.001 },
        limits: { minOrderSize: 10, maxOrderSize: 500000, dailyLimit: 5000000, rateLimit: 300 },
        supportedPairs: ['BTC-USD', 'ETH-USD', 'ADA-USD', 'SOL-USD'],
        lastUpdate: Date.now(),
        latency: 80,
        reliability: 0.98
      },
      {
        id: 'kraken',
        name: 'Kraken',
        type: 'CEX',
        baseUrl: 'https://api.kraken.com',
        isActive: true,
        priority: 3,
        fees: { maker: 0.0016, taker: 0.0026, withdrawal: 0.0005 },
        limits: { minOrderSize: 5, maxOrderSize: 200000, dailyLimit: 2000000, rateLimit: 60 },
        supportedPairs: ['XBTUSD', 'ETHUSD', 'ADAUSD', 'SOLUSD'],
        lastUpdate: Date.now(),
        latency: 100,
        reliability: 0.97
      },
      {
        id: 'uniswap_v3',
        name: 'Uniswap V3',
        type: 'DEX',
        baseUrl: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
        isActive: true,
        priority: 4,
        fees: { maker: 0.003, taker: 0.003, withdrawal: 0 },
        limits: { minOrderSize: 1, maxOrderSize: 10000000, dailyLimit: 50000000, rateLimit: 100 },
        supportedPairs: ['WETH-USDC', 'WETH-USDT', 'WBTC-WETH'],
        lastUpdate: Date.now(),
        latency: 200,
        reliability: 0.95
      },
      {
        id: 'sushiswap',
        name: 'SushiSwap',
        type: 'DEX',
        baseUrl: 'https://api.thegraph.com/subgraphs/name/sushiswap/exchange',
        isActive: true,
        priority: 5,
        fees: { maker: 0.003, taker: 0.003, withdrawal: 0 },
        limits: { minOrderSize: 1, maxOrderSize: 5000000, dailyLimit: 25000000, rateLimit: 100 },
        supportedPairs: ['WETH-USDC', 'WETH-USDT', 'WBTC-WETH'],
        lastUpdate: Date.now(),
        latency: 250,
        reliability: 0.93
      }
    ];

    for (const source of defaultSources) {
      this.sources.set(source.id, source);
    }

    logger.info(`🌊 Initialized ${defaultSources.length} liquidity sources`);
  }

  // Add new liquidity source
  async addSource(source: LiquiditySource): Promise<boolean> {
    try {
      this.sources.set(source.id, source);
      this.emit('sourceAdded', source);
      
      logger.info(`🌊 Liquidity source added: ${source.name} (${source.id})`);
      return true;

    } catch (error) {
      logger.error('❌ Failed to add liquidity source:', error);
      return false;
    }
  }

  // Remove liquidity source
  async removeSource(sourceId: string): Promise<boolean> {
    try {
      const source = this.sources.get(sourceId);
      if (!source) return false;

      this.sources.delete(sourceId);
      this.emit('sourceRemoved', source);
      
      logger.info(`🌊 Liquidity source removed: ${source.name} (${sourceId})`);
      return true;

    } catch (error) {
      logger.error('❌ Failed to remove liquidity source:', error);
      return false;
    }
  }

  // Update order book for a source
  async updateOrderBook(sourceId: string, symbol: string, orderBook: OrderBook): Promise<void> {
    try {
      if (!this.orderBooks.has(symbol)) {
        this.orderBooks.set(symbol, new Map());
      }

      const symbolOrderBooks = this.orderBooks.get(symbol)!;
      symbolOrderBooks.set(sourceId, orderBook);

      // Update source latency
      const source = this.sources.get(sourceId);
      if (source) {
        source.latency = Date.now() - orderBook.timestamp;
        source.lastUpdate = Date.now();
      }

      this.emit('orderBookUpdated', { sourceId, symbol, orderBook });

    } catch (error) {
      logger.error('❌ Failed to update order book:', error);
    }
  }

  // Get aggregated liquidity snapshot
  async getLiquiditySnapshot(symbol: string): Promise<LiquiditySnapshot | null> {
    try {
      const symbolOrderBooks = this.orderBooks.get(symbol);
      if (!symbolOrderBooks || symbolOrderBooks.size === 0) {
        return null;
      }

      const timestamp = Date.now();
      const sources: { [sourceId: string]: any } = {};
      let bestBid = 0;
      let bestAsk = Infinity;
      let totalBidSize = 0;
      let totalAskSize = 0;
      let weightedMidPrice = 0;
      let totalVolume24h = 0;
      let sourceCount = 0;

      // Process each source
      for (const [sourceId, orderBook] of symbolOrderBooks) {
        const source = this.sources.get(sourceId);
        if (!source || !source.isActive) continue;

        const bestBidLevel = orderBook.bids[0];
        const bestAskLevel = orderBook.asks[0];
        
        if (!bestBidLevel || !bestAskLevel) continue;

        const midPrice = (bestBidLevel.price + bestAskLevel.price) / 2;
        const spread = bestAskLevel.price - bestBidLevel.price;
        const relativeSpread = (spread / midPrice) * 100;

        sources[sourceId] = {
          bestBid: bestBidLevel.price,
          bestAsk: bestAskLevel.price,
          bidSize: bestBidLevel.size,
          askSize: bestAskLevel.size,
          spread: relativeSpread,
          midPrice,
          volume24h: orderBook.volume24h,
          latency: source.latency,
          reliability: source.reliability
        };

        // Update aggregated values
        if (bestBidLevel.price > bestBid) {
          bestBid = bestBidLevel.price;
        }
        if (bestAskLevel.price < bestAsk) {
          bestAsk = bestAskLevel.price;
        }

        totalBidSize += bestBidLevel.size;
        totalAskSize += bestAskLevel.size;
        totalVolume24h += orderBook.volume24h;
        sourceCount++;

        // Calculate weighted mid price
        const weight = source.reliability * (1 / (1 + source.latency / 1000));
        weightedMidPrice += midPrice * weight;
      }

      if (sourceCount === 0) return null;

      weightedMidPrice /= sourceCount;
      const effectiveSpread = bestAsk - bestBid;

      const snapshot: LiquiditySnapshot = {
        symbol,
        timestamp,
        sources,
        aggregated: {
          bestBid,
          bestAsk,
          totalBidSize,
          totalAskSize,
          weightedMidPrice,
          effectiveSpread,
          totalVolume24h,
          sourceCount
        }
      };

      this.liquiditySnapshots.set(symbol, snapshot);
      return snapshot;

    } catch (error) {
      logger.error('❌ Failed to get liquidity snapshot:', error);
      return null;
    }
  }

  // Generate smart routing
  async generateSmartRoute(
    symbol: string, 
    side: 'BUY' | 'SELL', 
    size: number
  ): Promise<SmartRoute | null> {
    try {
      const snapshot = await this.getLiquiditySnapshot(symbol);
      if (!snapshot) return null;

      const routes: RouteSegment[] = [];
      let remainingSize = size;
      let totalCost = 0;
      let totalFees = 0;
      let estimatedSlippage = 0;
      let executionTime = 0;
      let confidence = 1.0;
      let riskScore = 0.0;

      // Sort sources by priority and quality
      const sortedSources = Object.entries(snapshot.sources)
        .map(([sourceId, sourceData]) => {
          const source = this.sources.get(sourceId);
          if (!source) return null;

          const qualityScore = source.reliability * (1 / (1 + source.latency / 1000)) * (1 / (1 + sourceData.spread / 100));
          return { sourceId, sourceData, source, qualityScore };
        })
        .filter(item => item !== null)
        .sort((a, b) => b!.qualityScore - a!.qualityScore);

      // Allocate size across sources
      for (const item of sortedSources) {
        if (remainingSize <= 0) break;

        const { sourceId, sourceData, source } = item!;
        const availableSize = side === 'BUY' ? sourceData.askSize : sourceData.bidSize;
        const allocatedSize = Math.min(remainingSize, availableSize * 0.1); // Use max 10% of available liquidity

        if (allocatedSize <= 0) continue;

        const price = side === 'BUY' ? sourceData.bestAsk : sourceData.bestBid;
        const fees = allocatedSize * price * source.fees.taker;
        const slippage = this.calculateSlippage(allocatedSize, sourceData, side);
        const latency = source.latency;

        routes.push({
          source: sourceId,
          size: allocatedSize,
          price,
          fees,
          slippage,
          latency,
          priority: source.priority
        });

        totalCost += allocatedSize * price;
        totalFees += fees;
        estimatedSlippage += slippage;
        executionTime = Math.max(executionTime, latency);
        remainingSize -= allocatedSize;

        // Adjust confidence based on source quality
        confidence *= source.reliability;
        riskScore = Math.max(riskScore, 1 - source.reliability);
      }

      if (routes.length === 0) return null;

      const smartRoute: SmartRoute = {
        symbol,
        side,
        size,
        timestamp: Date.now(),
        routes,
        totalCost,
        totalFees,
        estimatedSlippage,
        executionTime,
        confidence,
        riskScore
      };

      this.emit('smartRouteGenerated', smartRoute);
      return smartRoute;

    } catch (error) {
      logger.error('❌ Failed to generate smart route:', error);
      return null;
    }
  }

  // Calculate slippage for a given size
  private calculateSlippage(size: number, sourceData: any, side: 'BUY' | 'SELL'): number {
    try {
      // Simplified slippage calculation based on order book depth
      const availableLiquidity = side === 'BUY' ? sourceData.askSize : sourceData.bidSize;
      const utilizationRatio = size / availableLiquidity;
      
      // Slippage increases exponentially with utilization
      const baseSlippage = sourceData.spread / 100;
      const slippageMultiplier = Math.pow(utilizationRatio, 2);
      
      return baseSlippage * slippageMultiplier;

    } catch (error) {
      logger.error('❌ Failed to calculate slippage:', error);
      return 0;
    }
  }

  // Get liquidity metrics
  async getLiquidityMetrics(symbol: string): Promise<LiquidityMetrics | null> {
    try {
      const snapshot = await this.getLiquiditySnapshot(symbol);
      if (!snapshot) return null;

      const timestamp = Date.now();
      const sources = Object.values(snapshot.sources);
      
      if (sources.length === 0) return null;

      // Calculate depth metrics
      const depth = {
        level1: snapshot.aggregated.totalBidSize + snapshot.aggregated.totalAskSize,
        level2: snapshot.aggregated.totalBidSize + snapshot.aggregated.totalAskSize,
        level3: snapshot.aggregated.totalBidSize + snapshot.aggregated.totalAskSize,
        level5: snapshot.aggregated.totalBidSize + snapshot.aggregated.totalAskSize,
        level10: snapshot.aggregated.totalBidSize + snapshot.aggregated.totalAskSize
      };

      // Calculate spread metrics
      const spread = {
        absolute: snapshot.aggregated.effectiveSpread,
        relative: (snapshot.aggregated.effectiveSpread / snapshot.aggregated.weightedMidPrice) * 100,
        effective: snapshot.aggregated.effectiveSpread
      };

      // Calculate volume metrics (simplified)
      const volume = {
        spot24h: snapshot.aggregated.totalVolume24h,
        spot1h: snapshot.aggregated.totalVolume24h / 24,
        futures24h: snapshot.aggregated.totalVolume24h * 0.3, // Assume 30% futures volume
        futures1h: (snapshot.aggregated.totalVolume24h * 0.3) / 24
      };

      // Calculate volatility metrics (simplified)
      const volatility = {
        price1h: 0.02, // 2% hourly volatility
        price24h: 0.05, // 5% daily volatility
        volume1h: 0.1, // 10% volume volatility
        volume24h: 0.2 // 20% volume volatility
      };

      // Calculate market impact
      const marketImpact = {
        small: this.calculateMarketImpact(volume.spot24h * 0.001, snapshot.aggregated.weightedMidPrice),
        medium: this.calculateMarketImpact(volume.spot24h * 0.01, snapshot.aggregated.weightedMidPrice),
        large: this.calculateMarketImpact(volume.spot24h * 0.05, snapshot.aggregated.weightedMidPrice)
      };

      const metrics: LiquidityMetrics = {
        symbol,
        timestamp,
        depth,
        spread,
        volume,
        volatility,
        marketImpact
      };

      this.metrics.set(symbol, metrics);
      return metrics;

    } catch (error) {
      logger.error('❌ Failed to get liquidity metrics:', error);
      return null;
    }
  }

  // Calculate market impact
  private calculateMarketImpact(size: number, price: number): number {
    try {
      // Simplified market impact calculation
      const value = size * price;
      const impact = Math.pow(value / 1000000, 0.5) * 0.001; // Square root impact model
      return Math.min(impact, 0.1); // Cap at 10%

    } catch (error) {
      logger.error('❌ Failed to calculate market impact:', error);
      return 0;
    }
  }

  // Start order book updates
  private startOrderBookUpdates(): void {
    this.updateInterval = setInterval(async () => {
      await this.updateAllOrderBooks();
    }, 1000); // Update every second
  }

  // Update all order books
  private async updateAllOrderBooks(): Promise<void> {
    try {
      for (const [sourceId, source] of this.sources) {
        if (!source.isActive) continue;

        for (const symbol of source.supportedPairs) {
          await this.fetchOrderBook(sourceId, symbol);
        }
      }
    } catch (error) {
      logger.error('❌ Order book update failed:', error);
    }
  }

  // Fetch order book from source
  private async fetchOrderBook(sourceId: string, symbol: string): Promise<void> {
    try {
      const source = this.sources.get(sourceId);
      if (!source) return;

      // Simulate order book data (in real implementation, call actual APIs)
      const orderBook: OrderBook = {
        source: sourceId,
        symbol,
        timestamp: Date.now(),
        bids: this.generateOrderBookLevels('bid', 10),
        asks: this.generateOrderBookLevels('ask', 10),
        spread: 0,
        midPrice: 0,
        volume24h: Math.random() * 1000000,
        lastUpdate: Date.now()
      };

      // Calculate spread and mid price
      if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
        orderBook.spread = orderBook.asks[0].price - orderBook.bids[0].price;
        orderBook.midPrice = (orderBook.bids[0].price + orderBook.asks[0].price) / 2;
      }

      await this.updateOrderBook(sourceId, symbol, orderBook);

    } catch (error) {
      logger.error(`❌ Failed to fetch order book from ${sourceId}:`, error);
    }
  }

  // Generate order book levels
  private generateOrderBookLevels(side: 'bid' | 'ask', count: number): OrderBookLevel[] {
    const levels: OrderBookLevel[] = [];
    const basePrice = side === 'bid' ? 50000 : 50010; // BTC price example
    
    for (let i = 0; i < count; i++) {
      const price = side === 'bid' ? 
        basePrice - (i * 10) : 
        basePrice + (i * 10);
      
      const size = Math.random() * 10 + 1;
      const orders = Math.floor(Math.random() * 5) + 1;
      
      levels.push({ price, size, orders });
    }
    
    return levels;
  }

  // Start liquidity monitoring
  private startLiquidityMonitoring(): void {
    setInterval(async () => {
      await this.updateLiquidityMetrics();
    }, 5000); // Update every 5 seconds
  }

  // Update liquidity metrics
  private async updateLiquidityMetrics(): Promise<void> {
    try {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'];
      
      for (const symbol of symbols) {
        await this.getLiquidityMetrics(symbol);
      }
    } catch (error) {
      logger.error('❌ Liquidity metrics update failed:', error);
    }
  }

  // Public methods
  getSource(sourceId: string): LiquiditySource | null {
    return this.sources.get(sourceId) || null;
  }

  getAllSources(): LiquiditySource[] {
    return Array.from(this.sources.values());
  }

  getOrderBook(symbol: string, sourceId?: string): OrderBook | Map<string, OrderBook> | null {
    if (sourceId) {
      const symbolOrderBooks = this.orderBooks.get(symbol);
      return symbolOrderBooks?.get(sourceId) || null;
    }
    return this.orderBooks.get(symbol) || null;
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
    logger.info('🌊 Liquidity Aggregator stopped');
  }
}
