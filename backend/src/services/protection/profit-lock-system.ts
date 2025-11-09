import { logger } from '../../utils/logger';

export interface ProfitLockConfig {
  lockThresholds: number[];        // Profit % thresholds to lock (e.g., [0.1, 0.2, 0.5])
  lockPercentages: number[];       // % of profit to lock at each threshold (e.g., [0.3, 0.5, 0.7])
  maxLockedPercentage: number;     // Maximum % of portfolio that can be locked (e.g., 0.8)
  unlockConditions: string[];      // Conditions to unlock profits (e.g., ['DAILY_RESET', 'MANUAL'])
  emergencyUnlockThreshold: number; // Loss % to unlock for emergency (e.g., 0.15)
}

export interface ProfitLock {
  id: string;
  amount: number;                 // Amount locked in USD
  percentage: number;             // % of portfolio locked
  lockedAt: Date;
  threshold: number;              // Profit threshold that triggered lock
  unlockConditions: string[];
  isEmergencyUnlocked: boolean;
}

export interface ProfitLockStatus {
  totalLocked: number;            // Total locked amount in USD
  lockedPercentage: number;       // % of portfolio locked
  availableForTrading: number;    // Amount available for trading
  locks: ProfitLock[];
  canLockMore: boolean;
  emergencyUnlockAvailable: boolean;
}

export class ProfitLockSystem {
  private config: ProfitLockConfig;
  private locks: Map<string, ProfitLock> = new Map();
  private portfolioValue: number = 100; // Starting value
  private peakValue: number = 100;
  private dailyProfit: number = 0;

  constructor(config?: Partial<ProfitLockConfig>) {
    this.config = {
      lockThresholds: [0.1, 0.2, 0.5, 1.0],      // 10%, 20%, 50%, 100% profit
      lockPercentages: [0.2, 0.3, 0.5, 0.7],       // Lock 20%, 30%, 50%, 70% of profit
      maxLockedPercentage: 0.8,                     // Max 80% of portfolio locked
      unlockConditions: ['DAILY_RESET', 'MANUAL'],
      emergencyUnlockThreshold: 0.15,               // 15% loss triggers emergency unlock
      ...config
    };
  }

  async initialize(): Promise<void> {
    logger.info('🛡️ Initializing Profit Lock System...');
    this.resetDailyLocks();
    logger.info('✅ Profit Lock System initialized');
  }

  async checkAndLockProfits(currentValue: number): Promise<ProfitLockStatus> {
    try {
      this.portfolioValue = currentValue;
      
      // Update peak value
      if (currentValue > this.peakValue) {
        this.peakValue = currentValue;
      }

      // Calculate current profit percentage
      const profitPercentage = (currentValue - 100) / 100; // Assuming $100 starting value
      this.dailyProfit = profitPercentage;

      logger.info(`💰 Checking profit locks. Current profit: ${(profitPercentage * 100).toFixed(2)}%`);

      // Check each threshold
      for (let i = 0; i < this.config.lockThresholds.length; i++) {
        const threshold = this.config.lockThresholds[i];
        const lockPercentage = this.config.lockPercentages[i];
        
        if (profitPercentage >= threshold) {
          await this.lockProfitAtThreshold(threshold, lockPercentage, profitPercentage);
        }
      }

      // Check for emergency unlock conditions
      await this.checkEmergencyUnlock();

      return this.getStatus();

    } catch (error) {
      logger.error('❌ Error checking profit locks:', error);
      return this.getStatus();
    }
  }

  private async lockProfitAtThreshold(
    threshold: number,
    lockPercentage: number,
    currentProfit: number
  ): Promise<void> {
    const lockId = `lock_${threshold}_${Date.now()}`;
    
    // Check if we already have a lock for this threshold
    const existingLock = Array.from(this.locks.values()).find(
      lock => lock.threshold === threshold && !lock.isEmergencyUnlocked
    );
    
    if (existingLock) {
      logger.debug(`🔒 Lock already exists for threshold ${threshold}`);
      return;
    }

    // Calculate profit amount to lock
    const profitAmount = (currentProfit - threshold) * 100; // Convert to USD
    const amountToLock = profitAmount * lockPercentage;
    
    // Check if we can lock more
    const currentLockedPercentage = this.getLockedPercentage();
    if (currentLockedPercentage + (amountToLock / this.portfolioValue) > this.config.maxLockedPercentage) {
      logger.warn(`⚠️ Cannot lock more profits - max percentage reached`);
      return;
    }

    const lock: ProfitLock = {
      id: lockId,
      amount: amountToLock,
      percentage: (amountToLock / this.portfolioValue) * 100,
      lockedAt: new Date(),
      threshold,
      unlockConditions: [...this.config.unlockConditions],
      isEmergencyUnlocked: false
    };

    this.locks.set(lockId, lock);
    
    logger.info(`🔒 Profit locked: $${amountToLock.toFixed(2)} at ${(threshold * 100).toFixed(0)}% threshold`);
  }

  private async checkEmergencyUnlock(): Promise<void> {
    const currentLoss = Math.max(0, (100 - this.portfolioValue) / 100); // Convert to percentage
    
    if (currentLoss >= this.config.emergencyUnlockThreshold) {
      logger.warn(`🚨 Emergency unlock triggered! Loss: ${(currentLoss * 100).toFixed(2)}%`);
      
      // Unlock all profits for emergency
      for (const [lockId, lock] of this.locks.entries()) {
        if (!lock.isEmergencyUnlocked) {
          lock.isEmergencyUnlocked = true;
          logger.info(`🔓 Emergency unlocked: $${lock.amount.toFixed(2)}`);
        }
      }
    }
  }

  async unlockProfits(condition: string, lockIds?: string[]): Promise<number> {
    try {
      let totalUnlocked = 0;
      
      if (lockIds) {
        // Unlock specific locks
        for (const lockId of lockIds) {
          const lock = this.locks.get(lockId);
          if (lock && lock.unlockConditions.includes(condition)) {
            totalUnlocked += lock.amount;
            this.locks.delete(lockId);
            logger.info(`🔓 Unlocked specific profit: $${lock.amount.toFixed(2)}`);
          }
        }
      } else {
        // Unlock all locks matching condition
        for (const [lockId, lock] of this.locks.entries()) {
          if (lock.unlockConditions.includes(condition)) {
            totalUnlocked += lock.amount;
            this.locks.delete(lockId);
            logger.info(`🔓 Unlocked profit: $${lock.amount.toFixed(2)}`);
          }
        }
      }

      logger.info(`🔓 Total unlocked: $${totalUnlocked.toFixed(2)}`);
      return totalUnlocked;

    } catch (error) {
      logger.error('❌ Error unlocking profits:', error);
      return 0;
    }
  }

  async resetDailyLocks(): Promise<void> {
    // Unlock all daily locks
    const unlocked = await this.unlockProfits('DAILY_RESET');
    
    // Reset counters
    this.dailyProfit = 0;
    this.peakValue = this.portfolioValue;
    
    logger.info(`🔄 Daily profit locks reset. Unlocked: $${unlocked.toFixed(2)}`);
  }

  getStatus(): ProfitLockStatus {
    const totalLocked = Array.from(this.locks.values())
      .filter(lock => !lock.isEmergencyUnlocked)
      .reduce((sum, lock) => sum + lock.amount, 0);
    
    const lockedPercentage = (totalLocked / this.portfolioValue) * 100;
    const availableForTrading = this.portfolioValue - totalLocked;
    const canLockMore = lockedPercentage < this.config.maxLockedPercentage * 100;
    
    const activeLocks = Array.from(this.locks.values())
      .filter(lock => !lock.isEmergencyUnlocked);

    return {
      totalLocked,
      lockedPercentage,
      availableForTrading,
      locks: activeLocks,
      canLockMore,
      emergencyUnlockAvailable: this.dailyProfit < -this.config.emergencyUnlockThreshold
    };
  }

  // Get available trading capital (portfolio - locked profits)
  getAvailableTradingCapital(): number {
    const status = this.getStatus();
    return status.availableForTrading;
  }

  // Get locked profit percentage
  getLockedPercentage(): number {
    const status = this.getStatus();
    return status.lockedPercentage;
  }

  // Check if we can make a trade of given size
  canMakeTrade(tradeSize: number): boolean {
    const available = this.getAvailableTradingCapital();
    return tradeSize <= available;
  }

  // Get profit protection level (0-1)
  getProfitProtectionLevel(): number {
    const status = this.getStatus();
    return status.lockedPercentage / 100;
  }

  // Update portfolio value
  updatePortfolioValue(value: number): void {
    this.portfolioValue = value;
  }

  // Manual unlock (for emergency situations)
  async manualUnlockAll(): Promise<number> {
    return await this.unlockProfits('MANUAL');
  }

  // Update configuration
  updateConfig(newConfig: Partial<ProfitLockConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('⚙️ Profit Lock System configuration updated');
  }

  // Get lock history
  getLockHistory(): ProfitLock[] {
    return Array.from(this.locks.values());
  }

  // Check if emergency unlock is active
  isEmergencyUnlockActive(): boolean {
    return Array.from(this.locks.values()).some(lock => lock.isEmergencyUnlocked);
  }
}
