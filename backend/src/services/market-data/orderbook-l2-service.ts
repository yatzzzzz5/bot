import { logger } from '../../utils/logger';
import WebSocket from 'ws';

export class OrderbookL2Service {
  private lastTopLiquidityUSD: Map<string, number> = new Map(); // symbol → liquidity
  private perExchangeTop: Map<string, Map<string, { liquidityUSD: number; spreadPct: number; lastTs: number; latencyMs: number }>> = new Map(); // exchange → symbol → snapshot
  private lastLatencyMs: number = 0;
  private lastHeartbeatAt: number = 0;
  private clockSkewMs: number = 0;
  private binanceWs: WebSocket | null = null;
  private okxWs: WebSocket | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private binanceBackoffMs = 500;
  private okxBackoffMs = 500;
  private pingTimerBinance: NodeJS.Timeout | null = null;
  private pingTimerOKX: NodeJS.Timeout | null = null;
  private micro: Map<string, { bidUsd: number; askUsd: number; imbalance: number; lastMsgAt: number; msgCountSec: number }> = new Map();

  async initialize(): Promise<void> {
    logger.info('📡 OrderbookL2Service initializing...');
    this.lastHeartbeatAt = Date.now();
    this.connectBinance();
    this.connectOKX();
  }

  async subscribeSymbol(symbol: string): Promise<void> {
    this.lastHeartbeatAt = Date.now();
    this.subscribedSymbols.add(symbol.toUpperCase());
    // send subscribe messages if sockets are open
    this.trySubscribeBinance(symbol);
    this.trySubscribeOKX(symbol);
  }

  async unsubscribeSymbol(symbol: string): Promise<void> {
    const sym = symbol.toUpperCase();
    this.subscribedSymbols.delete(sym);
    const bstream = `${sym.toLowerCase()}usdt@depth5@100ms`;
    if (this.binanceWs && this.binanceWs.readyState === WebSocket.OPEN) {
      try { this.binanceWs.send(JSON.stringify({ method: 'UNSUBSCRIBE', params: [bstream], id: Date.now() })); } catch {}
    }
    if (this.okxWs && this.okxWs.readyState === WebSocket.OPEN) {
      try { this.okxWs.send(JSON.stringify({ op: 'unsubscribe', args: [{ channel: 'books5', instId: `${sym}-USDT` }] })); } catch {}
    }
    for (const m of this.perExchangeTop.values()) m.delete(sym);
    this.lastTopLiquidityUSD.delete(sym);
  }

  refreshSubscriptions(): void {
    for (const sym of Array.from(this.subscribedSymbols)) {
      this.trySubscribeBinance(sym);
      this.trySubscribeOKX(sym);
    }
  }

  getTopLiquidityUSD(symbol: string, exchange?: string): number {
    if (exchange && this.perExchangeTop.get(exchange)?.get(symbol)) {
      return this.perExchangeTop.get(exchange)!.get(symbol)!.liquidityUSD;
    }
    return this.lastTopLiquidityUSD.get(symbol) ?? 15000;
  }

  getBestRoute(symbol: string): { exchange: string; liquidityUSD: number; spreadPct: number; latencyMs: number } | null {
    let best: { exchange: string; liquidityUSD: number; spreadPct: number; latencyMs: number } | null = null;
    for (const [ex, m] of this.perExchangeTop.entries()) {
      const snap = m.get(symbol);
      if (!snap) continue;
      // ignore stale snapshots (> 2000 ms)
      if (Date.now() - snap.lastTs > 2000) continue;
      const score = snap.liquidityUSD / Math.max(0.01, snap.spreadPct) - snap.latencyMs * 100; // simple score
      if (!best) best = { exchange: ex, ...snap };
      else {
        const bestScore = (best.liquidityUSD / Math.max(0.01, best.spreadPct)) - best.latencyMs * 100;
        if (score > bestScore) best = { exchange: ex, ...snap };
      }
    }
    return best;
  }

  getFreshness(): Record<string, { [exchange: string]: number }> {
    const out: Record<string, { [exchange: string]: number }> = {};
    for (const [ex, m] of this.perExchangeTop.entries()) {
      for (const [sym, snap] of m.entries()) {
        if (!out[sym]) out[sym] = {} as any;
        out[sym][ex] = Date.now() - (snap.lastTs || 0);
      }
    }
    return out;
  }

  // Microstructure
  getMicroMetrics(symbol: string): { imbalance: number; msgRate: number; bidUsd: number; askUsd: number } {
    const m = this.micro.get(symbol) || { bidUsd: 0, askUsd: 0, imbalance: 0, lastMsgAt: 0, msgCountSec: 0 };
    const msgRate = (Date.now() - m.lastMsgAt) < 1100 ? m.msgCountSec : 0;
    return { imbalance: m.imbalance || 0, msgRate, bidUsd: m.bidUsd || 0, askUsd: m.askUsd || 0 };
  }

  estimateFillProbability(symbol: string, side: 'BUY' | 'SELL'): number {
    const best = this.getBestRoute(symbol);
    const micro = this.getMicroMetrics(symbol);
    const spread = Math.max(0.01, best?.spreadPct || 0.05);
    const imb = micro.imbalance || 0;
    const base = 0.5 + (side === 'BUY' ? -imb : imb) * 0.25; // if bid-side heavy, sells fill easier
    const spreadPenalty = Math.min(0.25, spread / 2);
    const prob = Math.min(0.99, Math.max(0.01, base - spreadPenalty));
    return prob;
  }

  // Monitoring
  setLastLatencyMs(ms: number) { this.lastLatencyMs = ms; }
  getLastLatencyMs(): number { return this.lastLatencyMs; }
  getLastHeartbeatAt(): number { return this.lastHeartbeatAt; }
  setClockSkewMs(ms: number) { this.clockSkewMs = ms; }
  getClockSkewMs(): number { return this.clockSkewMs; }

  // --- Private helpers ---
  private connectBinance(): void {
    try {
      const streams = Array.from(this.subscribedSymbols).map(s => `${s.toLowerCase()}usdt@depth5@100ms`).join('/');
      const url = streams.length ? `wss://stream.binance.com:9443/stream?streams=${streams}` : `wss://stream.binance.com:9443/ws`;
      this.binanceWs = new WebSocket(url);
      const startedAt = Date.now();
      this.binanceWs.on('open', () => {
        this.lastLatencyMs = Date.now() - startedAt;
        this.lastHeartbeatAt = Date.now();
        logger.info('🟢 Binance WS connected');
        this.binanceBackoffMs = 500; // reset backoff
        if (this.pingTimerBinance) clearInterval(this.pingTimerBinance);
        this.pingTimerBinance = setInterval(() => {
          try { this.binanceWs?.ping?.(); } catch {}
        }, 15000);
        // subscribe for any symbols added post-connect
        for (const sym of this.subscribedSymbols) this.trySubscribeBinance(sym);
      });
      this.binanceWs.on('message', (data: WebSocket.RawData) => {
        this.lastHeartbeatAt = Date.now();
        try {
          const msg = JSON.parse(data.toString());
          const payload = msg.data || msg;
          const stream: string | undefined = msg.stream;
          const symbol = stream ? String(stream).split('@')[0].replace('usdt','').toUpperCase() : undefined;
          if (!symbol || !payload || !payload.bids || !payload.asks) return;
          const bestBid = Number(payload.bids[0]?.[0]);
          const bidQty = Number(payload.bids[0]?.[1]);
          const bestAsk = Number(payload.asks[0]?.[0]);
          const askQty = Number(payload.asks[0]?.[1]);
          if (!isFinite(bestBid) || !isFinite(bestAsk)) return;
          const mid = (bestBid + bestAsk) / 2;
          const depthUsd = (bidQty + askQty) * mid;
          // microstructure aggregates
          let bidUsd = 0; let askUsd = 0;
          for (let i=0;i<Math.min(5, payload.bids.length);i++) bidUsd += Number(payload.bids[i][0]) * Number(payload.bids[i][1]);
          for (let i=0;i<Math.min(5, payload.asks.length);i++) askUsd += Number(payload.asks[i][0]) * Number(payload.asks[i][1]);
          const imb = (bidUsd + askUsd) > 0 ? (bidUsd - askUsd) / (bidUsd + askUsd) : 0;
          const m = this.micro.get(symbol) || { bidUsd: 0, askUsd: 0, imbalance: 0, lastMsgAt: 0, msgCountSec: 0 };
          const now = Date.now();
          m.bidUsd = bidUsd; m.askUsd = askUsd; m.imbalance = imb;
          if (now - m.lastMsgAt < 1000) m.msgCountSec += 1; else m.msgCountSec = 1;
          m.lastMsgAt = now;
          this.micro.set(symbol, m);
          if (!this.perExchangeTop.has('Binance')) this.perExchangeTop.set('Binance', new Map());
          this.perExchangeTop.get('Binance')!.set(symbol, {
            liquidityUSD: depthUsd,
            spreadPct: Math.max(0, (bestAsk - bestBid) / mid * 100),
            lastTs: Date.now(),
            latencyMs: this.lastLatencyMs
          });
          // update overall top liquidity hint
          const cur = this.lastTopLiquidityUSD.get(symbol) || 0;
          this.lastTopLiquidityUSD.set(symbol, Math.max(cur, depthUsd));
        } catch {}
      });
      this.binanceWs.on('close', () => {
        logger.warn('🔴 Binance WS disconnected, will retry');
        if (this.pingTimerBinance) { clearInterval(this.pingTimerBinance); this.pingTimerBinance = null; }
        const wait = Math.min(15000, this.binanceBackoffMs);
        this.binanceBackoffMs = Math.min(15000, this.binanceBackoffMs * 2);
        setTimeout(() => this.connectBinance(), wait);
      });
      this.binanceWs.on('error', () => {
        logger.warn('⚠️ Binance WS error');
      });
    } catch (e) {
      logger.error('Failed to connect Binance WS', e);
    }
  }

  private trySubscribeBinance(symbol: string): void {
    const ws = this.binanceWs;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      const stream = `${symbol.toLowerCase()}usdt@depth5@100ms`;
      // Binance multiplex subscribe
      ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: [stream], id: Date.now() }));
    } catch {}
  }

  private connectOKX(): void {
    try {
      this.okxWs = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
      const startedAt = Date.now();
      this.okxWs.on('open', () => {
        this.lastLatencyMs = Date.now() - startedAt;
        this.lastHeartbeatAt = Date.now();
        logger.info('🟢 OKX WS connected');
        this.okxBackoffMs = 500;
        if (this.pingTimerOKX) clearInterval(this.pingTimerOKX);
        this.pingTimerOKX = setInterval(() => {
          try { this.okxWs?.send?.(JSON.stringify({ op: 'ping' })); } catch {}
        }, 15000);
        for (const sym of this.subscribedSymbols) this.trySubscribeOKX(sym);
      });
      this.okxWs.on('message', (data: WebSocket.RawData) => {
        this.lastHeartbeatAt = Date.now();
        try {
          const msg = JSON.parse(data.toString());
          if (msg.event === 'subscribe' || msg.event === 'pong' || msg.action === 'pong') return;
          const arg = msg.arg;
          const dataArr = msg.data;
          if (!arg || !dataArr || !Array.isArray(dataArr) || !dataArr.length) return;
          const instId: string = arg.instId; // e.g., BTC-USDT
          const symbol = instId?.split('-')[0]?.toUpperCase();
          const book = dataArr[0];
          const bestBid = Number(book.bids?.[0]?.[0]);
          const bidQty = Number(book.bids?.[0]?.[1]);
          const bestAsk = Number(book.asks?.[0]?.[0]);
          const askQty = Number(book.asks?.[0]?.[1]);
          if (!symbol || !isFinite(bestBid) || !isFinite(bestAsk)) return;
          const mid = (bestBid + bestAsk) / 2;
          const depthUsd = (bidQty + askQty) * mid;
          // microstructure aggregates
          let bidUsd = 0; let askUsd = 0;
          for (let i=0;i<Math.min(5, (book.bids||[]).length);i++) bidUsd += Number(book.bids[i][0]) * Number(book.bids[i][1]);
          for (let i=0;i<Math.min(5, (book.asks||[]).length);i++) askUsd += Number(book.asks[i][0]) * Number(book.asks[i][1]);
          const imb = (bidUsd + askUsd) > 0 ? (bidUsd - askUsd) / (bidUsd + askUsd) : 0;
          const m = this.micro.get(symbol) || { bidUsd: 0, askUsd: 0, imbalance: 0, lastMsgAt: 0, msgCountSec: 0 };
          const now = Date.now();
          m.bidUsd = bidUsd; m.askUsd = askUsd; m.imbalance = imb;
          if (now - m.lastMsgAt < 1000) m.msgCountSec += 1; else m.msgCountSec = 1;
          m.lastMsgAt = now;
          this.micro.set(symbol, m);
          if (!this.perExchangeTop.has('OKX')) this.perExchangeTop.set('OKX', new Map());
          this.perExchangeTop.get('OKX')!.set(symbol, {
            liquidityUSD: depthUsd,
            spreadPct: Math.max(0, (bestAsk - bestBid) / mid * 100),
            lastTs: Date.now(),
            latencyMs: this.lastLatencyMs
          });
          const cur = this.lastTopLiquidityUSD.get(symbol) || 0;
          this.lastTopLiquidityUSD.set(symbol, Math.max(cur, depthUsd));
        } catch {}
      });
      this.okxWs.on('close', () => {
        logger.warn('🔴 OKX WS disconnected, will retry');
        if (this.pingTimerOKX) { clearInterval(this.pingTimerOKX); this.pingTimerOKX = null; }
        const wait = Math.min(15000, this.okxBackoffMs);
        this.okxBackoffMs = Math.min(15000, this.okxBackoffMs * 2);
        setTimeout(() => this.connectOKX(), wait);
      });
      this.okxWs.on('error', () => {
        logger.warn('⚠️ OKX WS error');
      });
    } catch (e) {
      logger.error('Failed to connect OKX WS', e);
    }
  }

  private trySubscribeOKX(symbol: string): void {
    const ws = this.okxWs;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      const msg = {
        op: 'subscribe',
        args: [{ channel: 'books5', instId: `${symbol.toUpperCase()}-USDT` }]
      };
      ws.send(JSON.stringify(msg));
      // OKX ping/pong keepalive
      ws.send(JSON.stringify({ op: 'ping' }));
    } catch {}
  }
}


