export interface BorrowVenueRate {
  venue: string;
  base: string;
  borrowApyPct: number;
}

export class BorrowRateOptimizer {
  private table: BorrowVenueRate[] = [];
  async initialize(): Promise<void> {
    // seed mock table; extend with real venues later
    this.table = [
      { venue: 'Binance', base: 'USDT', borrowApyPct: 8 },
      { venue: 'OKX', base: 'USDT', borrowApyPct: 6 },
      { venue: 'Binance', base: 'BTC', borrowApyPct: 3 },
      { venue: 'OKX', base: 'BTC', borrowApyPct: 2.5 }
    ];
  }
  getBestBorrow(base: string): BorrowVenueRate | null {
    const rows = this.table.filter(r => r.base === base.toUpperCase());
    if (!rows.length) return null;
    return rows.sort((a,b)=>a.borrowApyPct - b.borrowApyPct)[0];
  }
}


