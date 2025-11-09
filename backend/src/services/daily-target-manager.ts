import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

interface DailyState {
  date: string;
  startEquity: number;
  targetEquity: number;
  realizedPnl: number;
  tradesExecuted: number;
  stopped: boolean;
}

export class DailyTargetManager {
  private readonly redisKeyPrefix = 'daily-target';
  private readonly targetMultiple: number;
  private readonly maxTradesPerDay: number | null;
  private isRunning: boolean = false;

  constructor(targetMultiple: number = 2.0, maxTradesPerDay: number | null = null) {
    this.targetMultiple = targetMultiple;
    this.maxTradesPerDay = (typeof maxTradesPerDay === 'number' && isFinite(maxTradesPerDay) && maxTradesPerDay > 0)
      ? Math.floor(maxTradesPerDay) : null;
  }

  async initialize(): Promise<void> {
    // nothing for now
  }

  async start(): Promise<void> {
    this.isRunning = true;
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  private todayKey(): string {
    const date = new Date().toISOString().split('T')[0];
    return `${this.redisKeyPrefix}:${date}`;
  }

  private async readState(): Promise<DailyState | null> {
    const client = getRedisClient();
    const raw = await client.get(this.todayKey());
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DailyState;
    } catch {
      return null;
    }
  }

  private async writeState(state: DailyState): Promise<void> {
    const client = getRedisClient();
    await client.set(this.todayKey(), JSON.stringify(state), 'EX', 60 * 60 * 24 * 2);
  }

  async ensureDayInitialized(currentEquity: number): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const existing = await this.readState();
    if (existing && existing.date === date) return;

    const startEquity = Math.max(0, Number(currentEquity || 0));
    const state: DailyState = {
      date,
      startEquity,
      targetEquity: startEquity * this.targetMultiple,
      realizedPnl: 0,
      tradesExecuted: 0,
      stopped: false
    };
    await this.writeState(state);
    logger.info(`🎯 Daily target initialized: start=${startEquity.toFixed(2)} target=${state.targetEquity.toFixed(2)}`);
  }

  async isTradingAllowed(currentEquity: number): Promise<{ allowed: boolean; reason?: string; state?: DailyState }> {
    if (!this.isRunning) return { allowed: true };
    const state = await this.readState();
    if (!state) return { allowed: true };
    if (state.stopped) return { allowed: false, reason: 'Daily target reached', state };

    const eq = Number(currentEquity || 0);
    if (eq >= state.targetEquity) {
      state.stopped = true;
      await this.writeState(state);
      return { allowed: false, reason: 'Daily target reached', state };
    }
    if (this.maxTradesPerDay != null && state.tradesExecuted >= this.maxTradesPerDay) {
      state.stopped = true;
      await this.writeState(state);
      return { allowed: false, reason: 'Max trades per day reached', state };
    }
    return { allowed: true, state };
  }

  async onTrade(tradeResult: any, currentEquity: number): Promise<DailyState | null> {
    const state = await this.readState();
    if (!state) return null;

    const pnl = Number((tradeResult?.pnlUsd ?? tradeResult?.pnl ?? 0) || 0);
    if (!Number.isNaN(pnl)) {
      state.realizedPnl += pnl;
    }
    state.tradesExecuted = (state.tradesExecuted || 0) + 1;

    const eq = Number(currentEquity || 0);
    if (eq >= state.targetEquity) {
      state.stopped = true;
    }
    if (this.maxTradesPerDay != null && state.tradesExecuted >= this.maxTradesPerDay) {
      state.stopped = true;
    }

    await this.writeState(state);
    return state;
  }

  async getStatus(): Promise<DailyState | null> {
    return await this.readState();
  }
}


