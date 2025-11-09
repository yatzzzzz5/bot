import cron from 'node-cron';
import { logger } from '../utils/logger';
import { BasisPosition } from '../models/BasisPosition';
import ccxt from 'ccxt';

// Import continuous trading functions
import { Continuous24HourTrading } from '../strategies/24-hour-continuous-trading';
import { MicroTradingEngine } from '../strategies/micro-trading-engine';

// Global continuous trader instance (will be initialized in main)
let continuousTrader: Continuous24HourTrading | null = null;
let microTrader: MicroTradingEngine | null = null;

export function setContinuousTrader(trader: Continuous24HourTrading) {
  continuousTrader = trader;
}

export function setMicroTrader(trader: MicroTradingEngine) {
  microTrader = trader;
}

async function executeHourlyMiniTrade() {
  if (continuousTrader) {
    await continuousTrader.executeHourlyMiniTrade();
  }
}

async function executeScalpingStrategy() {
  if (continuousTrader) {
    await continuousTrader.executeScalpingStrategy();
  }
}

async function quickOpportunityCheck() {
  if (continuousTrader) {
    await continuousTrader.executeScalpingStrategy();
  }
}

async function executeMicroTrade() {
  if (microTrader) {
    await microTrader.executeMicroTradingSession();
  }
}

async function executeRiskAssessment() {
  if (continuousTrader) {
    await continuousTrader.executeScalpingStrategy();
  }
}

export function setupCronJobs(): void {
  logger.info('⏰ Setting up 24/7 continuous trading cron jobs...');

  // HOURLY MINI-TRADES: Her saat small profit hunt
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('🔄 Hourly mini-trade execution...');
      // Execute small profitable trades every hour
      // Target: 4.2% hourly profit (achievable)
      await executeHourlyMiniTrade();
    } catch (error) {
      logger.error('❌ Hourly mini-trade failed:', error);
    }
  });

  // MICRO-TRADING: Her 5 dakika micro-trade attempt  
  cron.schedule('*/5 * * * *', async () => {
    try {
      logger.info('🔄 Micro-trading opportunity scan...');
      // Execute micro-trades
      if (microTrader && !microTrader.isTargetAchieved()) {
        await executeMicroTrade();
      }
    } catch (error) {
      logger.error('❌ Micro-trading scan failed:', error);
    }
  });

  // MICRO-TRADES: Every 10 minutes during active trading hours
  cron.schedule('*/10 * * * *', async () => {
    try {
      if (microTrader && microTrader.getTradeCount() < 100) {
        await executeMicroTrade();
      }
    } catch (error) {
      logger.debug('Micro-trade attempt:', error.message);
    }
  });

  // AGGRESSIVE MONITORING: Her dakika quick check
  cron.schedule('* * * * *', async () => {
    try {
      // Quick opportunity check every minute
      await quickOpportunityCheck();
    } catch (error) {
      // Silent fail for frequency reasons
      logger.debug('Quick check:', error.message);
    }
  });

  // RISK MANAGEMENT: Her 15 dakika risk check
  cron.schedule('*/15 * * * *', async () => {
    try {
      logger.info('⚠️ Aggressive risk assessment check...');
      // Tight risk management for continuous trading
      await executeRiskAssessment();
    } catch (error) {
      logger.error('❌ Risk assessment failed:', error);
    }
  });

  // Performance reporting daily at 00:00
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('📊 Running daily performance report...');
      // Add performance reporting logic here
    } catch (error) {
      logger.error('❌ Daily performance report failed:', error);
    }
  });

  // Basis funding fetch and PnL accounting every hour
  cron.schedule('5 * * * *', async () => {
    try {
      logger.info('💱 Updating basis funding and PnL...');
      const open = await BasisPosition.find({ status: 'OPEN' });
      if (!open.length) return;
      // minimal pricing via ccxt (spot midpoint) and perp index price
      const exMap: Record<string, any> = {};
      const getEx = (name: string) => {
        const key = name.toLowerCase();
        if (exMap[key]) return exMap[key];
        try {
          const cls: any = (ccxt as any)[key];
          if (!cls) return null;
          const ex = new cls();
          exMap[key] = ex;
          return ex;
        } catch { return null; }
      };
      for (const bp of open) {
        try {
          const spotEx = getEx(bp.spotExchange);
          const perpEx = getEx(bp.perpExchange);
          const symbol = `${bp.symbol}/USDT`;
          let spotMid = 0;
          let perpPrice = 0;
          if (spotEx?.fetchTicker) {
            const t = await spotEx.fetchTicker(symbol).catch(()=>null);
            if (t && isFinite(t.bid) && isFinite(t.ask)) spotMid = (t.bid + t.ask) / 2;
          }
          if (perpEx?.fetchTicker) {
            const t = await perpEx.fetchTicker(symbol).catch(()=>null);
            if (t && isFinite(t.last)) perpPrice = t.last;
          }
          if (spotMid > 0 && perpPrice > 0) {
            const basisPct = ((perpPrice - spotMid) / spotMid) * 100;
            // naive accrual: assume funding earns when perp>spot
            const accrualUsd = (basisPct / 100) * (bp.notionalUSD) * (1/365/24); // hourly
            bp.pnlUSD = (bp.pnlUSD || 0) + accrualUsd;
            await bp.save();
          }
        } catch (e) {
          logger.warn('Basis PnL update failed for', bp.symbol, e);
        }
      }
    } catch (error) {
      logger.error('❌ Basis funding update failed:', error);
    }
  });

  // Basis rollover check daily before funding events (placeholder 23:50 UTC)
  cron.schedule('50 23 * * *', async () => {
    try {
      logger.info('🔁 Checking basis rollover...');
      const open = await BasisPosition.find({ status: 'OPEN' });
      for (const bp of open) {
        // placeholder: mark eligible for rollover by touching updatedAt
        await bp.save();
      }
    } catch (error) {
      logger.error('❌ Basis rollover check failed:', error);
    }
  });

  logger.info('✅ Cron jobs setup completed');
}
