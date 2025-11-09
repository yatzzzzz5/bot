export interface TradeRecord {
  symbol: string;
  pnlUsd: number;
  slippageBps?: number;
  latencyMs?: number;
  ts: number;
}

export interface SymbolStats {
  trades: number;
  wins: number;
  losses: number;
  netUsd: number;
  avgSlippageBps: number;
  avgLatencyMs: number;
}

export class PerformanceTracker {
  private bySymbol: Map<string, SymbolStats> = new Map();

  recordTrade(tr: TradeRecord): void {
    const prev = this.bySymbol.get(tr.symbol) || {
      trades: 0,
      wins: 0,
      losses: 0,
      netUsd: 0,
      avgSlippageBps: 0,
      avgLatencyMs: 0
    };
    const trades = prev.trades + 1;
    const wins = prev.wins + (tr.pnlUsd > 0 ? 1 : 0);
    const losses = prev.losses + (tr.pnlUsd <= 0 ? 1 : 0);
    const netUsd = prev.netUsd + tr.pnlUsd;
    const avgSlippageBps = tr.slippageBps != null ? (prev.avgSlippageBps * prev.trades + tr.slippageBps) / trades : prev.avgSlippageBps;
    const avgLatencyMs = tr.latencyMs != null ? (prev.avgLatencyMs * prev.trades + tr.latencyMs) / trades : prev.avgLatencyMs;
    this.bySymbol.set(tr.symbol, { trades, wins, losses, netUsd, avgSlippageBps, avgLatencyMs });
  }

  getStats(symbol: string): SymbolStats | undefined { return this.bySymbol.get(symbol); }

  shouldDisableSymbol(symbol: string, minTrades = 20, minWinRate = 0.45, maxAvgSlipBps = 25): boolean {
    const s = this.bySymbol.get(symbol);
    if (!s || s.trades < minTrades) return false;
    const winRate = s.trades ? s.wins / s.trades : 0;
    return winRate < minWinRate || s.avgSlippageBps > maxAvgSlipBps;
  }
}


