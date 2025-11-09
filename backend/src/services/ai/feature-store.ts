import { OrderbookL2Service } from '../market-data/orderbook-l2-service';
import { FeatureSnapshot } from '../../models/FeatureSnapshot';

export interface FeatureVector {
  symbol: string;
  ts: number;
  // microstructure
  l2LiquidityUSD?: number;
  l2SpreadPct?: number;
  // simple technicals
  rsi?: number;
  macd?: number;
  vol24h?: number;
  // off-chain sentiment
  sentimentScore?: number;
  // on-chain
  activeAddresses?: number;
}

export class FeatureStore {
  constructor(private l2?: OrderbookL2Service) {}

  async initialize(): Promise<void> {}

  async buildFeatures(symbol: string, ctx: {
    indicators?: { rsi?: number; macd?: { macd: number } };
    offChain?: { sentimentScore?: number };
    onChain?: { activeAddresses?: number };
    vol24h?: number;
  }): Promise<FeatureVector> {
    const liq = this.l2?.getTopLiquidityUSD?.(symbol) ?? 0;
    const best = this.l2?.getBestRoute?.(symbol) || null;
    const fv: FeatureVector = {
      symbol,
      ts: Date.now(),
      l2LiquidityUSD: liq,
      l2SpreadPct: best?.spreadPct,
      rsi: ctx.indicators?.rsi,
      macd: ctx.indicators?.macd?.macd,
      vol24h: ctx.vol24h,
      sentimentScore: ctx.offChain?.sentimentScore,
      activeAddresses: ctx.onChain?.activeAddresses
    };
    try {
      await FeatureSnapshot.create({ symbol, ts: new Date(fv.ts), features: fv });
    } catch {}
    return fv;
  }
}


