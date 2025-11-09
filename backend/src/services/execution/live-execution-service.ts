import { logger } from '../../utils/logger';
import { TCAAnalyzer, TransactionCost } from './tca-analyzer';
import { ExecutionRL, ExecutionState, ExecutionAction, ExecutionReward } from '../ai/execution-rl';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ccxt = require('ccxt');

export interface ApiKeys {
  exchange: string;
  key: string;
  secret: string;
  passphrase?: string;
}

export interface LiveOrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  type: 'MARKET' | 'LIMIT';
  size: number; // base units or notional, implementation specific
  price?: number;
  postOnly?: boolean;
  ioc?: boolean;
}

export class LiveExecutionService {
  private apiKeys: Map<string, ApiKeys> = new Map();
  private lastStatus: Record<string, any> = {};
  private clients: Map<string, any> = new Map();
  private exchangeOptions: Map<string, { testnet?: boolean; defaultType?: 'spot' | 'future' | 'swap' }> = new Map();
  private tcaAnalyzer: TCAAnalyzer;
  private executionRL: ExecutionRL;

  constructor() {
    this.tcaAnalyzer = new TCAAnalyzer();
    this.executionRL = new ExecutionRL();
  }
  // Allow external wiring to set per-exchange options (testnet, defaultType)
  setExchangeOptions(exchange: string, opts: { testnet?: boolean; defaultType?: 'spot' | 'future' | 'swap' }): void {
    this.exchangeOptions.set(exchange, opts || {});
    const id = exchange;
    const client = this.clients.get(id);
    if (client && typeof client.setSandboxMode === 'function' && opts?.testnet) {
      try { client.setSandboxMode(true); } catch {}
    }
  }

  // For derivatives exchanges: set leverage on Bybit/OKX/Binance futures when possible
  async setLeverage(exchange: string, symbol: string, leverage: number): Promise<void> {
    const client = this.clients.get(exchange);
    if (!client) return;
    const exId = (client?.id || '').toLowerCase();
    const norm = this['normalizeSymbol'](symbol);
    try {
      if (exId.includes('bybit') && client.setLeverage) {
        await client.setLeverage(leverage, norm).catch(()=>{});
      } else if (exId.includes('okx') && client.setLeverage) {
        await client.setLeverage(leverage, norm).catch(()=>{});
      } else if (exId.includes('binance') && client.fapiPrivate_post_leverage) {
        // binance futures raw endpoint fallback
        const market = client.market(norm);
        await client.fapiPrivate_post_leverage({ symbol: market?.id, leverage }).catch(()=>{});
      }
    } catch {}
  }

  async initialize(): Promise<void> {
    logger.info('🛰️ LiveExecutionService initializing...');
    await this.tcaAnalyzer.initialize();
    await this.executionRL.initialize();
    // Apply default leverage to all initialized clients if configured
    const defLev = Number(process.env.DEFAULT_LEVERAGE || '0');
    if (isFinite(defLev) && defLev > 0) {
      for (const ex of Array.from(this.apiKeys.keys())) {
        try { await this.setLeverage(ex, 'BTC/USDT', defLev); } catch {}
      }
    }
    logger.info('✅ LiveExecutionService initialized with TCA and RL');
  }

  setApiKeys(keys: ApiKeys): void {
    this.apiKeys.set(keys.exchange, keys);
    logger.info(`🔑 API keys set for ${keys.exchange}`);
    try {
      const id = keys.exchange.toLowerCase();
      if (!id || !ccxt[id]) {
        logger.warn(`Unsupported exchange id for ccxt: ${keys.exchange}`);
        return;
      }
      const opts = this.exchangeOptions.get(keys.exchange) || {};
      const client = new ccxt[id]({
        apiKey: keys.key,
        secret: keys.secret,
        password: keys.passphrase,
        enableRateLimit: true,
        options: {
          defaultType: opts.defaultType || 'spot'
        }
      });
      if (opts.testnet && client.setSandboxMode) client.setSandboxMode(true);
      this.clients.set(keys.exchange, client);
    } catch (e) {
      logger.error('Failed to init ccxt client:', e);
    }
  }

  getStatus() {
    return {
      exchanges: Array.from(this.apiKeys.keys()),
      lastStatus: this.lastStatus
    };
  }

  // TCA and RL integrated execution
  async executeWithTCA(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    size: number;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH';
    marketVolatility?: number;
    liquidity?: number;
  }): Promise<{
    orderId: string;
    status: 'FILLED' | 'PARTIAL' | 'REJECTED';
    filledSize: number;
    avgPrice?: number;
    executionMode: string;
    venue: string;
    cost: number;
  }> {
    try {
      const { symbol, side, size, urgency, marketVolatility = 0.02, liquidity = 1000000 } = params;
      
      // Get available venues
      const availableVenues = Array.from(this.apiKeys.keys());
      if (availableVenues.length === 0) {
        throw new Error('No available venues');
      }

      // Create execution state for RL
      const executionState: ExecutionState = {
        symbol,
        size,
        urgency,
        marketVolatility,
        liquidity,
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay()
      };

      // Get RL recommendation
      const availableActions = this.executionRL.generateAvailableActions(executionState, availableVenues);
      const rlAction = this.executionRL.selectAction(executionState, availableActions);
      
      // Get TCA recommendation
      const tcaRecommendation = this.tcaAnalyzer.getExecutionRecommendation({
        symbol,
        size,
        availableVenues,
        urgency
      });

      // Choose between RL and TCA (or combine them)
      const finalAction = this.combineRecommendations(rlAction, tcaRecommendation);
      
      logger.info(`🎯 Execution decision: ${finalAction.executionMode} on ${finalAction.venue} (RL: ${rlAction.executionMode}, TCA: ${tcaRecommendation.executionMode})`);

      // Execute the order
      const startTime = Date.now();
      let result: any;
      
      const orderRequest: LiveOrderRequest = {
        symbol,
        side: side as any,
        type: finalAction.executionMode === 'DIRECT' ? 'MARKET' : 'LIMIT',
        size,
        postOnly: false,
        ioc: urgency === 'HIGH'
      };

      switch (finalAction.executionMode) {
        case 'DIRECT':
          result = await this.placeOrder(finalAction.venue, orderRequest);
          break;
        case 'TWAP':
          result = await this.placeTWAP(
            finalAction.venue, 
            orderRequest, 
            finalAction.parameters?.twapSlices || 3,
            finalAction.parameters?.twapIntervalMs || 200
          );
          break;
        case 'ICEBERG':
          result = await this.placeIceberg(
            finalAction.venue,
            orderRequest,
            finalAction.parameters?.icebergPeak || size / 3
          );
          break;
        default:
          result = await this.placeOrder(finalAction.venue, orderRequest);
      }

      const endTime = Date.now();
      const latency = endTime - startTime;

      // Calculate costs and record TCA data
      const cost = this.calculateExecutionCost(result, orderRequest, latency);
      const transactionCost: TransactionCost = {
        venue: finalAction.venue,
        symbol,
        size,
        timestamp: new Date(),
        executionMode: finalAction.executionMode,
        actualCost: cost.total,
        expectedCost: tcaRecommendation.expectedCost,
        slippage: cost.slippage,
        fees: cost.fees,
        latency,
        success: result.status !== 'REJECTED'
      };

      this.tcaAnalyzer.recordTransactionCost(transactionCost);

      // Update RL with reward
      const reward: ExecutionReward = {
        cost: cost.total,
        slippage: cost.slippage,
        latency,
        success: result.status !== 'REJECTED',
        marketImpact: cost.marketImpact
      };

      this.executionRL.updateQValue(executionState, finalAction, reward);

      return {
        ...result,
        executionMode: finalAction.executionMode,
        venue: finalAction.venue,
        cost: cost.total
      };

    } catch (error) {
      logger.error('❌ TCA execution failed:', error);
      // Fallback to direct execution
      const fallbackResult = await this.placeOrder('DEFAULT', {
        symbol: params.symbol,
        side: params.side as any,
        type: 'MARKET',
        size: params.size
      });
      
      return {
        ...fallbackResult,
        executionMode: 'DIRECT',
        venue: 'DEFAULT',
        cost: 0.01
      };
    }
  }

  // Combine RL and TCA recommendations
  private combineRecommendations(rlAction: ExecutionAction, tcaRecommendation: any): ExecutionAction {
    // Simple combination: prefer TCA for cost-sensitive decisions, RL for learning
    const tcaConfidence = tcaRecommendation.confidence;
    const rlConfidence = 0.7; // Assume moderate RL confidence
    
    if (tcaConfidence > rlConfidence) {
      return {
        executionMode: tcaRecommendation.executionMode,
        venue: tcaRecommendation.venue
      };
    } else {
      return rlAction;
    }
  }

  // Calculate execution cost
  private calculateExecutionCost(result: any, request: LiveOrderRequest, latency: number): {
    total: number;
    slippage: number;
    fees: number;
    marketImpact: number;
  } {
    // Simplified cost calculation
    const basePrice = request.price || 50000; // Default price for calculation
    const filledPrice = result.avgPrice || basePrice;
    const slippage = Math.abs(filledPrice - basePrice) / basePrice;
    const fees = request.size * filledPrice * 0.001; // 0.1% fee estimate
    const marketImpact = Math.min(0.01, request.size / 1000000); // Size impact
    const total = slippage + fees + (latency / 1000) * 0.0001; // Include latency cost

    return {
      total,
      slippage,
      fees,
      marketImpact
    };
  }

  // Get TCA statistics
  getTCAStats() {
    return this.tcaAnalyzer.getTCAStats();
  }

  // Get RL statistics
  getRLStats() {
    return {
      qTable: this.executionRL.getQTableStats(),
      learning: this.executionRL.getLearningProgress()
    };
  }

  // Get venue performance
  getVenuePerformance() {
    return this.tcaAnalyzer.getVenuePerformance();
  }

  async placeOrder(exchange: string, req: LiveOrderRequest): Promise<{ orderId: string; status: 'FILLED' | 'PARTIAL' | 'REJECTED'; filledSize: number; avgPrice?: number; }>{
    const client = this.clients.get(exchange);
    if (!client) {
      logger.warn(`No client for ${exchange}`);
      return { orderId: 'REJ_'+Date.now(), status: 'REJECTED', filledSize: 0 };
    }
            const symbol = req.symbol;
    const params: any = {};
    const makerOnlyDefault = String(process.env.MAKER_ONLY_DEFAULT || '').toLowerCase();
    if (req.postOnly || makerOnlyDefault === 'true' || makerOnlyDefault === '1') params.postOnly = true;
    if (req.ioc) params.timeInForce = 'IOC';
    const side = (req.side === 'SELL' || req.side === 'SHORT') ? 'sell' : 'buy';
    const type = req.type.toLowerCase();
    // Enforce maker-only defaults for LIMIT orders when venue supports it
    if (type === 'limit') {
      const exId = (client?.id || '').toLowerCase();
      // Bybit/OKX/Binance futures allow post-only via params
      if (exId.includes('bybit') || exId.includes('okx') || exId.includes('binance')) {
        params.postOnly = params.postOnly ?? true;
      }
    }
    // Preflight: markets/precision/balances
    try { if (!client.markets) await client.loadMarkets(); } catch {}
    const market = client.markets?.[symbol];
    const roundTo = (v: number, p: number) => { const m = Math.pow(10, Math.max(0, p)); return Math.round(v * m) / m; };
    const amountPrecision = market?.precision?.amount ?? 6;
    const pricePrecision = market?.precision?.price ?? 2;
    const minAmount = market?.limits?.amount?.min ?? 0;
    const amount = roundTo(req.size, amountPrecision);
    const price = req.price != null ? roundTo(req.price, pricePrecision) : undefined;
    if (minAmount && amount < minAmount) {
      logger.warn(`Amount below min ${amount} < ${minAmount} for ${symbol}`);
      return { orderId: 'REJ_'+Date.now(), status: 'REJECTED', filledSize: 0 };
    }
    try {
      const [base, quote] = symbol.split('/');
      const bal = await client.fetchBalance();
      if (side === 'buy' && quote) {
        const px = price ?? (market?.info?.last || market?.info?.close || undefined);
        if (px) {
          const need = amount * px;
          const free = bal.total?.[quote] ?? bal.free?.[quote] ?? 0;
          if (free && need > free) logger.warn(`Low ${quote} balance: need ${need} > free ${free}`);
        }
      } else if (base) {
        const free = bal.total?.[base] ?? bal.free?.[base] ?? 0;
        if (free && amount > free) logger.warn(`Low ${base} balance: sell ${amount} > free ${free}`);
      }
    } catch {}
    let attempt = 0;
    const maxRetries = 3;
    const backoff = (ms: number) => new Promise(res => setTimeout(res, ms));
    while (attempt < maxRetries) {
      try {
        const order = await client.createOrder(symbol, type, side, amount, price, params);
        const filled = order.filled ?? 0;
        const status = (order.status && order.status.toUpperCase() === 'CLOSED') ? 'FILLED' : (filled > 0 && filled < (order.amount ?? req.size) ? 'PARTIAL' : 'FILLED');
        const avg = order.average ?? order.price ?? undefined;
        const res = { orderId: String(order.id || ('LIV_'+Date.now())), status, filledSize: filled, avgPrice: avg } as const;
        this.lastStatus = { exchange, req, res };
        return { ...res };
      } catch (e) {
        attempt++;
        logger.warn(`placeOrder error (attempt ${attempt}):`, (e as any).message || e);
        if (attempt >= maxRetries) break;
        await backoff(200 * attempt);
      }
    }
    return { orderId: 'REJ_'+Date.now(), status: 'REJECTED', filledSize: 0 };
  }

  async placeTWAP(exchange: string, req: LiveOrderRequest, slices: number, intervalMs: number): Promise<{ orderId: string; filledSize: number; }> {
    const perSlice = req.size / Math.max(1, slices);
    let filled = 0;
    for (let i=0;i<slices;i++) {
      let sliceReq = { ...req, size: perSlice };
      if (req.type === 'LIMIT') {
        try {
          const client = this.clients.get(exchange);
          if (client) {
            if (!client.markets) await client.loadMarkets();
            const sym = req.symbol.includes('/') ? req.symbol : `${req.symbol}/USDT`;
            const t = await client.fetchTicker(sym).catch(()=>null);
            if (t && t.bid && t.ask) {
              const mid = (t.bid + t.ask) / 2;
              if (req.side === 'BUY' || req.side === 'LONG') sliceReq.price = Math.min(req.price ?? mid, t.ask);
              else sliceReq.price = Math.max(req.price ?? mid, t.bid);
            }
          }
        } catch {}
      }
      const r = await this.placeOrder(exchange, sliceReq);
      filled += r.filledSize;
      await new Promise(res => setTimeout(res, Math.max(50, intervalMs)));
    }
    return { orderId: 'TWAP_'+Date.now(), filledSize: filled };
  }

  async placeIceberg(exchange: string, req: LiveOrderRequest, peakSize: number): Promise<{ orderId: string; filledSize: number; }>{
    let remaining = req.size;
    let filled = 0;
    while (remaining > 0) {
      const size = Math.min(remaining, peakSize);
      const r = await this.placeOrder(exchange, { ...req, size });
      filled += r.filledSize;
      remaining -= r.filledSize;
      if (r.status === 'REJECTED' || r.filledSize === 0) break;
    }
    return { orderId: 'ICB_'+Date.now(), filledSize: filled };
  }
}

// helpers
LiveExecutionService.prototype['normalizeExchangeId'] = function (exchange: string): string | null {
  const map: Record<string, string> = {
    Binance: 'binance',
    OKX: 'okx',
    Deribit: 'deribit',
    Bybit: 'bybit'
  };
  return map[exchange] ?? null;
};

LiveExecutionService.prototype['getClient'] = function (exchange: string): any | null {
  return this.clients.get(exchange) ?? null;
};

LiveExecutionService.prototype['normalizeSymbol'] = function (symbol: string): string {
  // basic normalization: BTC -> BTC/USDT; ETH -> ETH/USDT
  if (symbol.includes('/')) return symbol;
  return `${symbol}/USDT`;
};


