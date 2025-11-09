import { logger } from '../../utils/logger';

export interface OrchestratorConfig {
  dailyTargetUsd: number;
  startEquityUsd?: number;
  minIntervalMs: number;
  progressIntervalMs?: number;
  symbols: string[];
  // feature flags
  enableMicroScalper: boolean;
  enableMarketMaking: boolean;
  enableTriangularArb: boolean;
  enableFundingCapture: boolean;
  // optional equity provider for auto-stop
  getEquityUsd?: () => Promise<number>;
  // optional kill-switch
  killSwitch?: { shouldStop: (currentEquityUsd: number) => boolean };
}

export interface StrategyModule {
  name: string;
  initialize(): Promise<void>;
  runTick(): Promise<void>;
  getStats?(): Record<string, any>;
}

export class ProOrchestrator {
  private config: OrchestratorConfig;
  private strategies: StrategyModule[] = [];
  private lastTick = 0;
  private lastProgress = 0;

  constructor(config: OrchestratorConfig) {
    this.config = config;
  }

  register(strategy: StrategyModule): void {
    this.strategies.push(strategy);
  }

  async initialize(): Promise<void> {
    for (const s of this.strategies) {
      try { await s.initialize(); } catch (e) { logger.error(`Orchestrator init failed for ${s.name}`, e); }
    }
    logger.info(`✅ Pro Orchestrator initialized with ${this.strategies.length} strategies`);
  }

  async runSession(durationMs = 24 * 60 * 60 * 1000): Promise<void> {
    logger.info('🚀 Pro Orchestrator session starting');
    const start = Date.now();
    while ((Date.now() - start) < durationMs) {
      const now = Date.now();
      // kill-switch pre-check
      if (this.config.getEquityUsd && this.config.killSwitch) {
        try {
          const eq = await this.config.getEquityUsd();
          if (this.config.killSwitch.shouldStop(eq)) {
            logger.warn('⛔ Kill-switch triggered. Stopping orchestrator.');
            break;
          }
        } catch {}
      }
      if (now - this.lastTick >= this.config.minIntervalMs) {
        for (const s of this.strategies) {
          try { await s.runTick(); } catch (e) { logger.warn(`Strategy tick error [${s.name}]`, e); }
        }
        this.lastTick = now;
      }

      // Progress logging and auto-stop when daily target is reached
      const pi = this.config.progressIntervalMs ?? 60_000;
      if (this.config.getEquityUsd && now - this.lastProgress >= pi) {
        try {
          const eq = await this.config.getEquityUsd();
          const startEq = this.config.startEquityUsd ?? 0;
          const realized = Math.max(0, eq - startEq);
          const remaining = Math.max(0, this.config.dailyTargetUsd - realized);
          logger.info(`🎯 Progress: realized=$${realized.toFixed(2)} remaining=$${remaining.toFixed(2)}`);
          this.lastProgress = now;
          if (realized >= this.config.dailyTargetUsd && this.config.dailyTargetUsd > 0) {
            logger.info('✅ Daily target reached. Stopping orchestrator.');
            break;
          }
        } catch (e) {
          // ignore equity provider errors
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }
    logger.info('✅ Pro Orchestrator session ended');
  }
}


