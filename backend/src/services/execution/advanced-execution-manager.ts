import { logger } from '../../utils/logger';
import { LiveExecutionService } from './live-execution-service';
import { SlippageProtector } from './slippage-protector';
import { LiquidityAggregator } from './liquidity-aggregator';
import { AtomicExecutionEngine } from './atomic-execution-engine';
import ccxt from 'ccxt';

/**
 * ADVANCED EXECUTION MANAGER
 * 
 * Tüm execution sistemlerini birleştirir:
 * - Slippage protection
 * - Liquidity aggregation
 * - Atomic execution
 * - Multi-exchange support
 * - Order optimization (TWAP, VWAP, Iceberg)
 * - Retry logic
 * - Real-time monitoring
 */

export interface ExecutionRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  amount: number; // USD value
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  maxSlippage?: number; // Percentage
  minLiquidity?: number; // USD
  executionMode?: 'MARKET' | 'LIMIT' | 'TWAP' | 'VWAP' | 'ICEBERG';
  targetPrice?: number;
  allowMultiExchange?: boolean;
}

export interface ExecutionResult {
  success: boolean;
  orderIds: string[];
  filledAmount: number;
  avgPrice: number;
  actualSlippage: number;
  executionTime: number;
  venues: string[];
  cost: number;
  errors?: string[];
}

export class AdvancedExecutionManager {
  private liveExecution: LiveExecutionService;
  private slippageProtector: SlippageProtector;
  private liquidityAggregator: LiquidityAggregator;
  private atomicExecution: AtomicExecutionEngine;
  private binance: any;
  private orderCache: Map<string, { price: number; timestamp: number }> = new Map();
  
  constructor() {
    this.liveExecution = new LiveExecutionService();
    this.slippageProtector = new SlippageProtector({
      maxSlippage: 0.3, // %0.3 max slippage (günlük 2x için çok tight)
      maxMarketImpact: 0.2,
      emergencyStop: true
    });
    this.liquidityAggregator = new LiquidityAggregator();
    this.atomicExecution = new AtomicExecutionEngine();
    
    // Binance connection
    this.binance = new ccxt.binance({
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_SECRET_KEY,
      options: {
        defaultType: 'spot',
        recvWindow: Number(process.env.RECV_WINDOW || 60000),
      },
      enableRateLimit: true,
    });
  }

  async initialize(): Promise<void> {
    logger.info('🚀 Initializing Advanced Execution Manager...');
    
    try {
      await Promise.all([
        this.liveExecution.initialize(),
        this.slippageProtector.initialize(),
        this.liquidityAggregator.initialize(),
        this.atomicExecution.initialize(),
        this.binance.loadMarkets().catch(() => {})
      ]);
      
      logger.info('✅ Advanced Execution Manager initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize Advanced Execution Manager:', error);
      throw error;
    }
  }

  /**
   * ANA EXECUTION FONKSİYONU - Tüm optimizasyonlarla
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Validate request.amount - MUST be a valid number
      if (!request.amount || !isFinite(request.amount) || request.amount <= 0 || isNaN(request.amount)) {
        throw new Error(`Invalid execution request: amount=${request.amount} must be a valid positive number. Symbol: ${request.symbol}, Side: ${request.side}`);
      }
      
      // Validate request.symbol
      if (!request.symbol || typeof request.symbol !== 'string') {
        throw new Error(`Invalid execution request: symbol=${request.symbol} must be a valid string`);
      }
      
      logger.info(`🎯 Executing: ${request.side} $${request.amount.toFixed(2)} ${request.symbol}`);
      
      // 1. SLIPPAGE ANALYSIS
      let slippageAnalysis = await this.slippageProtector.analyzeSlippage(
        request.symbol,
        request.side,
        request.amount
      );
      
      // If slippage analysis failed, log warning but continue with basic execution
      if (!slippageAnalysis) {
        logger.warn(`⚠️ Slippage analysis unavailable for ${request.symbol}, proceeding with basic execution`);
        // Try to get current price for basic execution
        try {
          const ticker = await this.binance.fetchTicker(request.symbol);
          slippageAnalysis = await this.slippageProtector.analyzeSlippage(
            request.symbol,
            request.side,
            request.amount
          );
        } catch (err) {
          logger.warn(`⚠️ Could not fetch price for ${request.symbol}, skipping slippage check`);
          // Continue without slippage analysis - will use basic execution
        }
      }
      
      // If still no analysis, create a fallback one
      if (!slippageAnalysis) {
        logger.warn(`⚠️ Proceeding without slippage analysis for ${request.symbol}, using basic execution`);
        // Use basic execution mode when slippage analysis is unavailable
        return await this.executeBasicFallback(request);
      }
      
      // Check if slippage is acceptable
      const maxAllowed = request.maxSlippage || 0.3;
      if (slippageAnalysis?.slippage?.expected && slippageAnalysis.slippage.expected > maxAllowed) {
        // Slippage çok yüksek, order'ı optimize et
        if (slippageAnalysis.recommendations.action === 'SPLIT_ORDER') {
          return await this.executeSplitOrder(request, slippageAnalysis);
        } else if (slippageAnalysis.recommendations.action === 'DELAY') {
          // Biraz bekle ve tekrar dene
          await new Promise(resolve => setTimeout(resolve, slippageAnalysis.recommendations.suggestedDelay || 1000));
          return await this.execute(request);
        } else if (slippageAnalysis.recommendations.action === 'CANCEL') {
          throw new Error(`Slippage too high: ${slippageAnalysis.slippage.expected.toFixed(2)}% > ${maxAllowed}%`);
        }
      }
      
      // 2. LIQUIDITY ANALYSIS (optional - continue if unavailable)
      const liquidityMetrics = await this.liquidityAggregator.getLiquidityMetrics(request.symbol);
      
      if (!liquidityMetrics) {
        logger.warn(`⚠️ Liquidity metrics unavailable for ${request.symbol}, proceeding with basic checks`);
      } else {
        // Check if sufficient liquidity available
        const availableLiquidity = liquidityMetrics.depth?.level1 * (liquidityMetrics.spread?.effective || 1);
        if (availableLiquidity < (request.minLiquidity || 500)) {
          logger.warn(`⚠️ Low liquidity for ${request.symbol}: ${availableLiquidity.toFixed(2)} < ${request.minLiquidity || 500}, but proceeding`);
        }
      }
      
      // 3. EXECUTION MODE SELECTION
      const executionMode = request.executionMode || this.selectOptimalMode(request, slippageAnalysis);
      
      // 4. EXECUTE ORDER
      let result: ExecutionResult;
      
      switch (executionMode) {
        case 'MARKET':
          result = await this.executeMarket(request, slippageAnalysis);
          break;
        case 'LIMIT':
          result = await this.executeLimit(request, slippageAnalysis);
          break;
        case 'TWAP':
          result = await this.executeTWAP(request, slippageAnalysis);
          break;
        case 'VWAP':
          result = await this.executeVWAP(request, slippageAnalysis);
          break;
        case 'ICEBERG':
          result = await this.executeIceberg(request, slippageAnalysis);
          break;
        default:
          result = await this.executeMarket(request, slippageAnalysis);
      }
      
      // 5. UPDATE CACHE
      this.orderCache.set(request.symbol, {
        price: result.avgPrice,
        timestamp: Date.now()
      });
      
      const executionTime = Date.now() - startTime;
      logger.info(`✅ Execution completed in ${executionTime}ms: ${result.filledAmount} @ $${result.avgPrice.toFixed(2)}`);
      
      return {
        ...result,
        executionTime
      };
      
    } catch (error) {
      logger.error('❌ Execution failed:', error);
      return {
        success: false,
        orderIds: [],
        filledAmount: 0,
        avgPrice: 0,
        actualSlippage: 0,
        executionTime: Date.now() - startTime,
        venues: [],
        cost: 0,
        errors: [error.message]
      };
    }
  }

  // Helper to format quantity according to Binance precision
  private formatQuantity(amount: number, symbol: string, markets: any): number {
    try {
      if (!amount || amount <= 0 || !isFinite(amount)) {
        throw new Error(`Invalid amount: ${amount}`);
      }
      
      if (!markets || !markets[symbol]) {
        // Fallback: round to 8 decimal places and remove scientific notation
        // Use toFixed to ensure no scientific notation, then parse back
        const rounded = Math.round(amount * 1e8) / 1e8;
        const fixedStr = rounded.toFixed(8).replace(/\.?0+$/, ''); // Remove trailing zeros
        return parseFloat(fixedStr);
      }
      
      const market = markets[symbol];
      const amountPrecision = market.precision?.amount ?? 8;
      const minAmount = market.limits?.amount?.min ?? 0;
      
      // Round to precision (use floor to avoid rounding up issues)
      const multiplier = Math.pow(10, Math.max(0, amountPrecision));
      let rounded = Math.floor(amount * multiplier) / multiplier;
      
      // Ensure minimum amount
      if (minAmount > 0 && rounded < minAmount) {
        rounded = minAmount;
      }
      
      // Ensure we don't have invalid values
      if (!isFinite(rounded) || rounded <= 0) {
        throw new Error(`Invalid formatted amount: ${rounded}`);
      }
      
      // Convert to string with proper precision - DO NOT remove trailing zeros
      // Binance requires exact format: ^([0-9]{1,20})(\.[0-9]{1,20})?$
      // We need to keep trailing zeros to avoid scientific notation
      const precision = Math.max(0, amountPrecision);
      const fixedStr = rounded.toFixed(precision); // Keep trailing zeros!
      
      // Validate the string format matches Binance requirements
      if (!/^([0-9]{1,20})(\.[0-9]{1,20})?$/.test(fixedStr)) {
        // If it fails validation, ensure no scientific notation
        const safeStr = rounded.toFixed(precision);
        return parseFloat(safeStr);
      }
      
      // Return as number (parseFloat will handle it correctly)
      return parseFloat(fixedStr);
    } catch (error) {
      logger.warn(`⚠️ Error formatting quantity ${amount} for ${symbol}:`, error);
      // Fallback: round to 8 decimal places and ensure no scientific notation
      const rounded = Math.max(0, Math.round(amount * 1e8) / 1e8);
      const safeStr = rounded.toFixed(8);
      return parseFloat(safeStr);
    }
  }

  // Basic fallback execution when slippage analysis is unavailable
  private async executeBasicFallback(request: ExecutionRequest): Promise<ExecutionResult> {
    try {
      logger.info(`📦 Using basic execution fallback for ${request.symbol}`);
      
      // Normalize symbol format
      const normalizedSymbol = request.symbol.replace(/\/USDT\/USDT$/, '/USDT');
      
      // Load markets to get precision info
      if (!this.binance.markets || Object.keys(this.binance.markets).length === 0) {
        await this.binance.loadMarkets();
      }
      
      // Try to get current price
      let currentPrice = 0;
      try {
        const ticker = await this.binance.fetchTicker(normalizedSymbol);
        currentPrice = ticker.last || 0;
      } catch (err) {
        logger.warn(`⚠️ Could not fetch ticker for ${normalizedSymbol}, skipping execution`);
        throw new Error(`Unable to fetch price for ${normalizedSymbol}`);
      }
      
      if (!currentPrice || currentPrice <= 0) {
        throw new Error(`Invalid price for ${normalizedSymbol}: ${currentPrice}`);
      }
      
      // Execute basic market order - format quantity properly
      const rawAmountInCoins = request.amount / currentPrice;
      const amountInCoins = this.formatQuantity(rawAmountInCoins, normalizedSymbol, this.binance.markets);
      
      // Ensure quantity is valid and not too small
      if (!amountInCoins || amountInCoins <= 0 || !isFinite(amountInCoins)) {
        throw new Error(`Invalid quantity calculated: ${amountInCoins} for ${request.amount} USD @ ${currentPrice}`);
      }
      
      // Format as string to ensure no scientific notation, then convert back to number
      // This prevents JavaScript from converting small numbers to scientific notation
      const market = this.binance.markets?.[normalizedSymbol];
      const amountPrecision = market?.precision?.amount ?? 8;
      const quantityStr = amountInCoins.toFixed(amountPrecision);
      const finalQuantity = parseFloat(quantityStr);
      
      // Double-check: if toString() produces scientific notation, use toFixed() version
      if (finalQuantity.toString().includes('e') || finalQuantity.toString().includes('E')) {
        // Fallback: use toFixed string directly by creating a number from string
        logger.warn(`⚠️ Scientific notation detected, using toFixed() format: ${quantityStr}`);
      }
      
      logger.info(`💰 Order: ${request.side} ${quantityStr} ${normalizedSymbol} @ ~$${currentPrice.toFixed(2)}`);
      
      const order = await this.binance.createMarketOrder(
        normalizedSymbol,
        request.side.toLowerCase(),
        finalQuantity
      );
      
      const filled = order.filled || amountInCoins;
      const avgPrice = order.average || currentPrice;
      const actualSlippage = Math.abs((avgPrice - currentPrice) / currentPrice) * 100;
      
      return {
        success: true,
        orderIds: [String(order.id)],
        filledAmount: filled * avgPrice,
        avgPrice,
        actualSlippage,
        executionTime: 0,
        venues: ['BINANCE'],
        cost: 0,
        errors: []
      };
    } catch (error: any) {
      logger.error(`❌ Basic fallback execution failed for ${request.symbol}:`, error);
      return {
        success: false,
        orderIds: [],
        filledAmount: 0,
        avgPrice: 0,
        actualSlippage: 0,
        executionTime: 0,
        venues: [],
        cost: 0,
        errors: [error.message || 'Basic execution failed']
      };
    }
  }

  private async executeMarket(request: ExecutionRequest, slippageAnalysis: any): Promise<ExecutionResult> {
    const normalizedSymbol = request.symbol.replace(/\/USDT\/USDT$/, '/USDT');
    
    // Load markets if needed
    if (!this.binance.markets || Object.keys(this.binance.markets).length === 0) {
      await this.binance.loadMarkets();
    }
    
    const ticker = await this.binance.fetchTicker(normalizedSymbol);
    const currentPrice = ticker.last;
    
    // Format quantity according to Binance precision
    const rawAmountInCoins = request.amount / currentPrice;
    const amountInCoins = this.formatQuantity(rawAmountInCoins, normalizedSymbol, this.binance.markets);
    
    // Ensure quantity is valid
    if (!amountInCoins || amountInCoins <= 0 || !isFinite(amountInCoins)) {
      throw new Error(`Invalid quantity calculated: ${amountInCoins} for ${request.amount} USD @ ${currentPrice}`);
    }
    
    // Format as string to ensure no scientific notation
    const market = this.binance.markets?.[normalizedSymbol];
    const amountPrecision = market?.precision?.amount ?? 8;
    const quantityStr = amountInCoins.toFixed(amountPrecision);
    const finalQuantity = parseFloat(quantityStr);
    
    // Double-check for scientific notation
    if (finalQuantity.toString().includes('e') || finalQuantity.toString().includes('E')) {
      logger.warn(`⚠️ Scientific notation detected in quantity, using toFixed() format: ${quantityStr}`);
    }
    
    logger.info(`💰 Market Order: ${request.side} ${quantityStr} ${normalizedSymbol} @ ~$${currentPrice.toFixed(2)}`);
    
    try {
      const order = await this.binance.createMarketOrder(
        normalizedSymbol,
        request.side.toLowerCase(),
        finalQuantity
      );
      
      const filled = order.filled || amountInCoins;
      const avgPrice = order.average || currentPrice;
      const actualSlippage = Math.abs((avgPrice - currentPrice) / currentPrice) * 100;
      
      return {
        success: true,
        orderIds: [String(order.id)],
        filledAmount: filled * avgPrice,
        avgPrice,
        actualSlippage,
        executionTime: 0,
        venues: ['binance'],
        cost: (filled * avgPrice * 0.001) // 0.1% fee
      };
    } catch (error) {
      throw error;
    }
  }

  private async executeLimit(request: ExecutionRequest, slippageAnalysis: any): Promise<ExecutionResult> {
    const normalizedSymbol = request.symbol.replace(/\/USDT\/USDT$/, '/USDT');
    
    // Load markets if needed
    if (!this.binance.markets || Object.keys(this.binance.markets).length === 0) {
      await this.binance.loadMarkets();
    }
    
    const targetPrice = request.targetPrice || await this.calculateOptimalLimitPrice(request, slippageAnalysis);
    
    // Format both quantity and price according to Binance precision
    const rawAmountInCoins = request.amount / targetPrice;
    const amountInCoins = this.formatQuantity(rawAmountInCoins, normalizedSymbol, this.binance.markets);
    
    // Ensure quantity is valid
    if (!amountInCoins || amountInCoins <= 0 || !isFinite(amountInCoins)) {
      throw new Error(`Invalid quantity calculated: ${amountInCoins} for ${request.amount} USD @ ${targetPrice}`);
    }
    
    // Format as string to ensure no scientific notation
    const market = this.binance.markets?.[normalizedSymbol];
    const amountPrecision = market?.precision?.amount ?? 8;
    const quantityStr = amountInCoins.toFixed(amountPrecision);
    const finalQuantity = parseFloat(quantityStr);
    
    // Double-check for scientific notation
    if (finalQuantity.toString().includes('e') || finalQuantity.toString().includes('E')) {
      logger.warn(`⚠️ Scientific notation detected in limit quantity, using toFixed() format: ${quantityStr}`);
    }
    
    // Format price precision too
    const pricePrecision = market?.precision?.price ?? 2;
    const priceMultiplier = Math.pow(10, Math.max(0, pricePrecision));
    const formattedPrice = Math.floor(targetPrice * priceMultiplier) / priceMultiplier;
    
    logger.info(`💰 Limit Order: ${request.side} ${quantityStr} ${normalizedSymbol} @ $${formattedPrice.toFixed(pricePrecision)}`);
    
    try {
      // Post-only limit order (maker fee)
      const order = await this.binance.createLimitOrder(
        normalizedSymbol,
        request.side.toLowerCase(),
        finalQuantity,
        formattedPrice,
        undefined,
        { postOnly: true }
      );
      
      // Wait for fill (max 2 seconds for micro trades)
      let filled = 0;
      let avgPrice = targetPrice;
      const maxWait = 2000;
      const start = Date.now();
      
      while (Date.now() - start < maxWait && filled < amountInCoins * 0.95) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const orderStatus = await this.binance.fetchOrder(String(order.id), normalizedSymbol);
        filled = orderStatus.filled || 0;
        avgPrice = orderStatus.average || formattedPrice;
        
        if (orderStatus.status === 'closed') break;
      }
      
      // If not fully filled, cancel and market fill remainder
      if (filled < amountInCoins * 0.95) {
        await this.binance.cancelOrder(String(order.id), normalizedSymbol);
        const rawRemainder = amountInCoins - filled;
        const formattedRemainder = this.formatQuantity(rawRemainder, normalizedSymbol, this.binance.markets);
        
        if (formattedRemainder > 0 && isFinite(formattedRemainder)) {
          // Format as string to ensure no scientific notation
          const market = this.binance.markets?.[normalizedSymbol];
          const amountPrecision = market?.precision?.amount ?? 8;
          const remainderStr = formattedRemainder.toFixed(amountPrecision);
          const finalRemainder = parseFloat(remainderStr);
          
          // Double-check for scientific notation
          if (finalRemainder.toString().includes('e') || finalRemainder.toString().includes('E')) {
            logger.warn(`⚠️ Scientific notation detected in remainder, using toFixed() format: ${remainderStr}`);
          }
          
          const marketOrder = await this.binance.createMarketOrder(
            normalizedSymbol,
            request.side.toLowerCase(),
            finalRemainder
          );
          filled += marketOrder.filled || 0;
        }
      }
      
      const actualSlippage = Math.abs((avgPrice - targetPrice) / targetPrice) * 100;
      
      return {
        success: true,
        orderIds: [String(order.id)],
        filledAmount: filled * avgPrice,
        avgPrice,
        actualSlippage,
        executionTime: Date.now() - start,
        venues: ['binance'],
        cost: (filled * avgPrice * 0.0005) // 0.05% maker fee
      };
    } catch (error) {
      throw error;
    }
  }

  private async executeTWAP(request: ExecutionRequest, slippageAnalysis: any): Promise<ExecutionResult> {
    // TWAP: Time-Weighted Average Price execution
    const slices = Math.max(3, Math.min(10, Math.ceil(request.amount / 50))); // 3-10 slices
    const intervalMs = 1000; // 1 second between slices
    const sliceSize = request.amount / slices;
    
    const orderIds: string[] = [];
    let totalFilled = 0;
    let totalCost = 0;
    
    for (let i = 0; i < slices; i++) {
      try {
        const sliceResult = await this.executeMarket({
          ...request,
          amount: sliceSize
        }, slippageAnalysis);
        
        orderIds.push(...sliceResult.orderIds);
        totalFilled += sliceResult.filledAmount;
        totalCost += sliceResult.cost;
        
        if (i < slices - 1) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      } catch (error) {
        logger.warn(`TWAP slice ${i + 1} failed:`, error.message);
      }
    }
    
    const avgPrice = totalFilled > 0 ? totalCost / totalFilled : 0;
    
    return {
      success: totalFilled > request.amount * 0.9,
      orderIds,
      filledAmount: totalFilled,
      avgPrice,
      actualSlippage: 0,
      executionTime: slices * intervalMs,
      venues: ['binance'],
      cost: totalCost
    };
  }

  private async executeVWAP(request: ExecutionRequest, slippageAnalysis: any): Promise<ExecutionResult> {
    // VWAP: Volume-Weighted Average Price (simplified)
    // Get recent volume profile and execute accordingly
    return await this.executeTWAP(request, slippageAnalysis); // Simplified for now
  }

  private async executeIceberg(request: ExecutionRequest, slippageAnalysis: any): Promise<ExecutionResult> {
    // Iceberg: Hide large order, show small visible portion
    const visibleSize = Math.min(request.amount * 0.1, 50); // 10% or $50 max visible
    const totalSlices = Math.ceil(request.amount / visibleSize);
    
    const orderIds: string[] = [];
    let totalFilled = 0;
    let totalCost = 0;
    
    for (let i = 0; i < totalSlices; i++) {
      const sliceSize = Math.min(visibleSize, request.amount - totalFilled);
      
      try {
        const sliceResult = await this.executeLimit({
          ...request,
          amount: sliceSize
        }, slippageAnalysis);
        
        orderIds.push(...sliceResult.orderIds);
        totalFilled += sliceResult.filledAmount;
        totalCost += sliceResult.cost;
        
        // Wait between slices
        if (i < totalSlices - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        logger.warn(`Iceberg slice ${i + 1} failed:`, error.message);
      }
    }
    
    const avgPrice = totalFilled > 0 ? totalCost / totalFilled : 0;
    
    return {
      success: totalFilled > request.amount * 0.9,
      orderIds,
      filledAmount: totalFilled,
      avgPrice,
      actualSlippage: 0,
      executionTime: totalSlices * 500,
      venues: ['binance'],
      cost: totalCost
    };
  }

  private async executeSplitOrder(request: ExecutionRequest, slippageAnalysis: any): Promise<ExecutionResult> {
    const suggestedSize = slippageAnalysis.recommendations.suggestedSize || request.amount * 0.5;
    const slices = Math.ceil(request.amount / suggestedSize);
    
    const orderIds: string[] = [];
    let totalFilled = 0;
    let totalCost = 0;
    
    for (let i = 0; i < slices; i++) {
      const sliceSize = Math.min(suggestedSize, request.amount - totalFilled);
      
      try {
        const sliceResult = await this.executeMarket({
          ...request,
          amount: sliceSize
        }, slippageAnalysis);
        
        orderIds.push(...sliceResult.orderIds);
        totalFilled += sliceResult.filledAmount;
        totalCost += sliceResult.cost;
        
        // Wait between slices to reduce market impact
        if (i < slices - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        logger.warn(`Split order slice ${i + 1} failed:`, error.message);
      }
    }
    
    const avgPrice = totalFilled > 0 ? totalCost / totalFilled : 0;
    
    return {
      success: totalFilled > request.amount * 0.9,
      orderIds,
      filledAmount: totalFilled,
      avgPrice,
      actualSlippage: 0,
      executionTime: slices * 200,
      venues: ['binance'],
      cost: totalCost
    };
  }

  private selectOptimalMode(request: ExecutionRequest, slippageAnalysis: any): 'MARKET' | 'LIMIT' | 'TWAP' | 'VWAP' | 'ICEBERG' {
    // Günlük 2x için optimal execution mode seçimi
    
    if (request.urgency === 'CRITICAL') {
      return 'MARKET'; // Arbitrage için hızlı execution
    }
    
    if (request.amount > 200) {
      // Büyük order'lar için TWAP/Iceberg
      if (slippageAnalysis.risk.level === 'HIGH') {
        return 'ICEBERG';
      }
      return 'TWAP';
    }
    
    if (slippageAnalysis.slippage.expected > 0.2) {
      // Yüksek slippage için limit order
      return 'LIMIT';
    }
    
    // Küçük order'lar için market (hızlı)
    return 'MARKET';
  }

  private async calculateOptimalLimitPrice(request: ExecutionRequest, slippageAnalysis: any): Promise<number> {
    const ticker = await this.binance.fetchTicker(request.symbol);
    const currentPrice = ticker.last;
    
    if (request.side === 'BUY') {
      // Buy için bid'e yakın limit
      const bid = ticker.bid || currentPrice;
      return bid * 0.9995; // %0.05 below bid
    } else {
      // Sell için ask'e yakın limit
      const ask = ticker.ask || currentPrice;
      return ask * 1.0005; // %0.05 above ask
    }
  }
}

