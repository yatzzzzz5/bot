import ccxt from 'ccxt';

export class EquityProvider {
  private ex: any;
  private quote: string;

  constructor(quote: string = 'USDT') {
    this.quote = quote.toUpperCase();
    this.ex = new ccxt.binance({
      enableRateLimit: true,
      options: { defaultType: 'spot' },
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_SECRET_KEY
    });
  }

  async initialize(): Promise<void> {
    try { await this.ex.loadMarkets(); } catch {}
  }

  async getEquityUsd(): Promise<number> {
    // Sum free + used balances valued in quote via last price
    const balances = await this.ex.fetchBalance();
    const total: Record<string, number> = balances.total || {};
    const tickers = await this.ex.fetchTickers();
    let equity = 0;
    for (const [asset, amount] of Object.entries(total)) {
      const amt = typeof amount === 'number' ? amount : Number(amount || 0);
      if (!amt || amt <= 0) continue;
      if (asset.toUpperCase() === this.quote) {
        equity += amt; // already in quote
        continue;
      }
      const sym = `${asset}/${this.quote}`;
      const t = tickers[sym];
      const px = t?.last || 0;
      if (px > 0) equity += amt * px;
    }
    return equity;
  }
}


