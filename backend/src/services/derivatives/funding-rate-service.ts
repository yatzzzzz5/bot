import ccxt from 'ccxt';

export interface FundingForecast {
  symbol: string;
  nextFundingRatePct: number;
  confidence: number;
  timeToFundingMin: number;
}

export class FundingRateService {
  private ex: any;
  constructor() { this.ex = new (ccxt as any).binance({ enableRateLimit: true }); }
  async initialize(): Promise<void> {}
  async forecast(symbol: string): Promise<FundingForecast> {
    // placeholder: use premium index or funding history if available
    const t = await this.ex.fetchFundingRate?.(`${symbol}/USDT`).catch(()=>null);
    const rate = t?.fundingRate ?? 0;
    const next = Math.max(-0.05, Math.min(0.05, Number(rate) * 100));
    return { symbol, nextFundingRatePct: next, confidence: 0.6, timeToFundingMin: 120 };
  }
}


