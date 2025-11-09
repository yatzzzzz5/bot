export interface BankrollScalerConfig {
  baseRiskBp: number;        // e.g. 50 bp = 0.5% risk per trade
  maxOpenRiskPct: number;    // e.g. 2% of equity
  maxConcurrent: number;     // e.g. 3 concurrent positions
}

export class BankrollScaler {
  private config: BankrollScalerConfig;
  private equity: number = 0;
  private openRiskUsd: number = 0;
  private openPositions: number = 0;

  constructor(config: BankrollScalerConfig) {
    this.config = config;
  }

  setEquity(currentEquityUsd: number): void {
    this.equity = Math.max(0, currentEquityUsd);
  }

  canOpenNewPosition(): boolean {
    const maxOpenRiskUsd = (this.config.maxOpenRiskPct / 100) * this.equity;
    return this.openPositions < this.config.maxConcurrent && this.openRiskUsd < maxOpenRiskUsd;
  }

  // Return per-trade risk budget in USD based on equity and remaining room
  getPerTradeRiskUsd(): number {
    const base = (this.config.baseRiskBp / 10000) * this.equity;
    const maxOpenRiskUsd = (this.config.maxOpenRiskPct / 100) * this.equity;
    const remaining = Math.max(0, maxOpenRiskUsd - this.openRiskUsd);
    return Math.min(base, remaining);
  }

  onPositionOpened(riskUsd: number): void {
    this.openPositions += 1;
    this.openRiskUsd += Math.max(0, riskUsd);
  }

  onPositionClosed(realizedPnlUsd: number, releasedRiskUsd: number): void {
    this.openPositions = Math.max(0, this.openPositions - 1);
    this.openRiskUsd = Math.max(0, this.openRiskUsd - Math.max(0, releasedRiskUsd));
    this.equity = Math.max(0, this.equity + realizedPnlUsd);
  }
}


