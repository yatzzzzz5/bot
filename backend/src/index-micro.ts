import 'dotenv/config';
import { MicroTradingEngine, MicroTradingConfig } from './strategies/micro-trading-engine';
import { logger } from './utils/logger';
import ccxt from 'ccxt';
import { ProOrchestrator } from './services/orchestrator/pro-orchestrator';
import { MarketMakingModule } from './services/strategies/market-making';
import { TriangularArbModule } from './services/strategies/triangular-arbitrage';
import { FundingCaptureModule } from './services/strategies/funding-capture';
import { MultiKillSwitch } from './services/risk/multi-kill-switch';
import { EquityProvider } from './services/portfolio/equity-provider';

function bool(v: string | undefined, d = false): boolean {
  if (v == null) return d;
  const s = v.toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y';
}

function num(v: string | undefined, d: number): number { const n = Number(v); return isFinite(n) ? n : d; }

async function main() {
  console.log('[BOOT] index-micro starting...');
  const startingCapital = num(process.env.START_CAPITAL_USD, 100);
  const dailyMultiplier = num(process.env.DAILY_MULTIPLIER, 2); // 2x target
  const dailyTargetAmount = startingCapital * Math.max(0, dailyMultiplier - 1);

  let symbols: string[] = [];
  if (bool(process.env.AUTO_SYMBOLS, false)) {
    try {
      const quote = (process.env.QUOTE || 'USDT').toUpperCase();
      const topN = num(process.env.TOP_SYMBOLS_N, 5);
      const ex = new ccxt.binance({ enableRateLimit: true, options: { defaultType: 'spot' } });
      await ex.loadMarkets();
      const tickers = await ex.fetchTickers();
      const candidates = Object.entries(tickers)
        .filter(([sym, t]: any) => sym.endsWith(`/${quote}`) && (t?.quoteVolume ?? 0) > 0)
        .sort((a: any, b: any) => (b[1].quoteVolume ?? 0) - (a[1].quoteVolume ?? 0))
        .slice(0, topN)
        .map(([sym]) => sym);
      symbols = candidates.length ? candidates : ['BTC/USDT'];
      logger.info(`Auto-selected symbols: ${symbols.join(', ')}`);
    } catch (e) {
      logger.warn('AUTO_SYMBOLS failed, falling back to SYMBOLS env or BTC/USDT');
    }
  }
  if (symbols.length === 0) {
    const symbolsEnv = process.env.SYMBOLS || 'BTC/USDT';
    symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean);
  }

  const config: MicroTradingConfig = {
    startingCapital,
    dailyTargetAmount,
    totalTradesPerDay: num(process.env.TOTAL_TRADES_PER_DAY, 120),
    targetPerTrade: num(process.env.TARGET_PER_TRADE_USD, 1),
    maxLossPerTrade: num(process.env.MAX_LOSS_PER_TRADE_USD, 0.5),
    allowedDailyLosses: num(process.env.ALLOWED_DAILY_LOSSES, 50),
    symbols,
    minIntervalMs: num(process.env.MIN_INTERVAL_MS, 60_000),
    makerFirst: bool(process.env.MAKER_FIRST, true),
    ladderLevels: num(process.env.LADDER_LEVELS, 3),
    ladderStepBps: num(process.env.LADDER_STEP_BPS, 2),
    ladderEachPct: num(process.env.LADDER_EACH_PCT, 0.34),
    timeboxMs: num(process.env.TIMEBOX_MS, 4000),
    maxSpreadBps: num(process.env.MAX_SPREAD_BPS, 15),
    minDepthUsd: num(process.env.MIN_DEPTH_USD, 200),
    tradeCategories: {
      scalping: bool(process.env.CAT_SCALPING, true),
      arbitrage: bool(process.env.CAT_ARBITRAGE, false),
      momentUm: bool(process.env.CAT_MOMENTUM, true),
      newsBased: bool(process.env.CAT_NEWS, false),
      patternBased: bool(process.env.CAT_PATTERN, false)
    }
  };

  const mode = (process.env.STRATEGY_MODE || 'MICRO').toUpperCase();
  console.log(`[BOOT] MODE=${mode}`);
  if (mode === 'PRO') {
    const eqProvider = new EquityProvider(process.env.QUOTE || 'USDT');
    await eqProvider.initialize();
    const kill = new MultiKillSwitch({
      maxDailyDrawdownPct: num(process.env.MAX_DAILY_DRAWDOWN_PCT, 5),
      maxConsecutiveLosses: num(process.env.MAX_CONSECUTIVE_LOSSES, 8),
      maxAvgSlippageBps: num(process.env.MAX_AVG_SLIPPAGE_BPS, 25),
      maxLatencyMs: num(process.env.MAX_LATENCY_MS, 250)
    }, startingCapital);

    const orch = new ProOrchestrator({
      dailyTargetUsd: dailyTargetAmount,
      startEquityUsd: startingCapital,
      minIntervalMs: config.minIntervalMs!,
      progressIntervalMs: num(process.env.PROGRESS_LOG_MS, 60000),
      symbols,
      enableMicroScalper: true,
      enableMarketMaking: true,
      enableTriangularArb: true,
      enableFundingCapture: true,
      getEquityUsd: async () => eqProvider.getEquityUsd(),
      killSwitch: kill
    });

    // Register strategies
    orch.register(new MarketMakingModule({
      symbols,
      targetSpreadBps: Number(process.env.MM_TARGET_SPREAD_BPS || 5),
      maxInventoryUsd: Number(process.env.MM_MAX_INVENTORY_USD || 300),
      ladderLevels: Number(process.env.MM_LADDER_LEVELS || 2),
      ladderStepBps: Number(process.env.MM_LADDER_STEP_BPS || 2),
      timeboxMs: Number(process.env.MM_TIMEBOX_MS || 3000)
    }));

    orch.register(new TriangularArbModule({ symbols, minEdgeBps: Number(process.env.TRI_ARB_MIN_EDGE_BPS || 8), maxChain: Number(process.env.TRI_ARB_MAX_CHAIN || 6) }));
    orch.register(new FundingCaptureModule({ symbols, minFundingPct: Number(process.env.FUND_MIN_PCT || 0.05) }));

    await orch.initialize();
    console.log('[BOOT] Pro orchestrator initialized, running session...');
    await orch.runSession();
  } else {
    const engine = new MicroTradingEngine(config);
    console.log('[BOOT] Micro engine initializing...');
    await engine.initialize();
    console.log('[BOOT] Micro engine initialized. Executing session...');
    await engine.executeMicroTradingSession();
    console.log('[BOOT] Micro session finished. Generating report...');
    await engine.generateDailyReport();
    console.log('[BOOT] Report generated.');
  }
}

main().catch((err) => {
  logger.error('Fatal error in micro engine:', err);
  process.exit(1);
});


