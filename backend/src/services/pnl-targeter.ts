import { logger } from '../utils/logger';

export interface PnlTargeterConfig {
  dailyMultiplier: number; // e.g. 2x
  minPerTradeUsd: number;  // floor per trade target
  maxPerTradeUsd: number;  // cap per trade target
}

export class PnlTargeter {
  private config: PnlTargeterConfig;
  private startEquity: number = 0;
  private dailyTargetUsd: number = 0;
  private realizedToday: number = 0;
  private tradesPlanned: number = 0;
  private tradesExecuted: number = 0;

  constructor(config: PnlTargeterConfig) {
    this.config = config;
  }

  startDay(startEquityUsd: number, plannedTrades: number): void {
    this.startEquity = Math.max(0, startEquityUsd);
    this.realizedToday = 0;
    this.tradesExecuted = 0;
    this.tradesPlanned = Math.max(1, plannedTrades);
    this.dailyTargetUsd = this.startEquity * Math.max(0, this.config.dailyMultiplier - 1);
    logger.info(`🎯 PnLTargeter day start: equity=$${this.startEquity.toFixed(2)}, target=$${this.dailyTargetUsd.toFixed(2)}, trades=${this.tradesPlanned}`);
  }

  recordTrade(realizedUsd: number): void {
    this.realizedToday += realizedUsd;
    this.tradesExecuted += 1;
  }

  isTargetMet(): boolean {
    return this.realizedToday >= this.dailyTargetUsd && this.dailyTargetUsd > 0;
  }

  remainingTargetUsd(): number {
    return Math.max(0, this.dailyTargetUsd - this.realizedToday);
  }

  remainingTradesBudget(): number {
    return Math.max(0, this.tradesPlanned - this.tradesExecuted);
  }

  // Dynamic per-trade target: remaining target spread over remaining trades with clamps
  getPerTradeTargetUsd(): number {
    const remaining = this.remainingTargetUsd();
    const remainingTrades = Math.max(1, this.remainingTradesBudget());
    const raw = remaining / remainingTrades;
    return Math.min(this.config.maxPerTradeUsd, Math.max(this.config.minPerTradeUsd, raw));
  }
}


