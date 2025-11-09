import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface EmergencyStop {
  id: string;
  type: 'SYSTEM' | 'SYMBOL' | 'EXCHANGE' | 'STRATEGY' | 'MANUAL';
  reason: string;
  timestamp: number;
  initiatedBy: string;
  scope: string[]; // Affected symbols, exchanges, or strategies
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'ACTIVE' | 'RESOLVED' | 'CANCELLED';
  autoResolve?: boolean;
  autoResolveTime?: number;
  actions: EmergencyAction[];
}

export interface EmergencyAction {
  type: 'CANCEL_ORDERS' | 'CLOSE_POSITIONS' | 'DISABLE_TRADING' | 'NOTIFY' | 'LOG';
  target: string; // Symbol, exchange, or 'ALL'
  parameters?: any;
  executed: boolean;
  executedAt?: number;
  result?: any;
}

export interface EmergencyMetrics {
  totalStops: number;
  activeStops: number;
  averageResolutionTime: number;
  stopsByType: Record<string, number>;
  stopsBySeverity: Record<string, number>;
  lastStopTime?: number;
}

export class EmergencyController extends EventEmitter {
  private activeStops: Map<string, EmergencyStop> = new Map();
  private stopHistory: EmergencyStop[] = [];
  private systemStatus: 'NORMAL' | 'WARNING' | 'EMERGENCY' | 'CRITICAL' = 'NORMAL';
  private tradingEnabled: boolean = true;
  private emergencyThresholds: Map<string, any> = new Map();
  private autoStopEnabled: boolean = true;
  private notificationChannels: string[] = [];

  constructor() {
    super();
    this.initializeEmergencyThresholds();
    this.setupAutoMonitoring();
  }

  async initialize(): Promise<void> {
    logger.info('🚨 Initializing Emergency Controller...');
    
    // Load previous emergency stops from storage (if any)
    await this.loadEmergencyHistory();
    
    // Setup monitoring intervals
    this.setupMonitoring();
    
    logger.info('✅ Emergency Controller initialized');
  }

  private initializeEmergencyThresholds(): void {
    this.emergencyThresholds.set('price_deviation', {
      threshold: 0.05, // 5%
      action: 'SYMBOL_STOP',
      severity: 'HIGH'
    });
    
    this.emergencyThresholds.set('volume_spike', {
      threshold: 10, // 10x normal volume
      action: 'SYMBOL_STOP',
      severity: 'MEDIUM'
    });
    
    this.emergencyThresholds.set('consecutive_losses', {
      threshold: 5,
      action: 'SYSTEM_STOP',
      severity: 'CRITICAL'
    });
    
    this.emergencyThresholds.set('daily_loss', {
      threshold: 0.1, // 10% daily loss
      action: 'SYSTEM_STOP',
      severity: 'CRITICAL'
    });
    
    this.emergencyThresholds.set('latency_spike', {
      threshold: 5000, // 5 seconds
      action: 'EXCHANGE_STOP',
      severity: 'HIGH'
    });
    
    this.emergencyThresholds.set('error_rate', {
      threshold: 0.2, // 20% error rate
      action: 'SYSTEM_STOP',
      severity: 'HIGH'
    });
  }

  private setupAutoMonitoring(): void {
    // Monitor system health every 5 seconds
    setInterval(() => {
      this.monitorSystemHealth();
    }, 5000);

    // Check for auto-resolve conditions every 30 seconds
    setInterval(() => {
      this.checkAutoResolve();
    }, 30000);
  }

  // Manual emergency stop
  async triggerEmergencyStop(params: {
    type: 'SYSTEM' | 'SYMBOL' | 'EXCHANGE' | 'STRATEGY';
    reason: string;
    scope: string[];
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    initiatedBy: string;
    autoResolve?: boolean;
    autoResolveTime?: number;
  }): Promise<string> {
    try {
      const stopId = `EMERGENCY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const emergencyStop: EmergencyStop = {
        id: stopId,
        type: params.type,
        reason: params.reason,
        timestamp: Date.now(),
        initiatedBy: params.initiatedBy,
        scope: params.scope,
        severity: params.severity,
        status: 'ACTIVE',
        autoResolve: params.autoResolve || false,
        autoResolveTime: params.autoResolveTime,
        actions: this.generateEmergencyActions(params.type, params.scope, params.severity)
      };

      // Execute emergency actions
      await this.executeEmergencyActions(emergencyStop);
      
      // Store emergency stop
      this.activeStops.set(stopId, emergencyStop);
      this.stopHistory.push(emergencyStop);
      
      // Update system status
      this.updateSystemStatus(emergencyStop.severity);
      
      // Emit event
      this.emit('emergencyStop', emergencyStop);
      
      // Send notifications
      await this.sendEmergencyNotifications(emergencyStop);
      
      logger.warn(`🚨 Emergency stop triggered: ${stopId} - ${params.reason}`);
      return stopId;

    } catch (error) {
      logger.error('❌ Failed to trigger emergency stop:', error);
      throw error;
    }
  }

  // Auto-trigger emergency stop based on conditions
  async checkEmergencyConditions(metrics: {
    priceDeviation?: number;
    volumeSpike?: number;
    consecutiveLosses?: number;
    dailyLoss?: number;
    latency?: number;
    errorRate?: number;
    symbol?: string;
    exchange?: string;
  }): Promise<void> {
    try {
      for (const [condition, threshold] of this.emergencyThresholds) {
        const value = metrics[condition as keyof typeof metrics];
        if (value === undefined) continue;

        if (this.shouldTriggerEmergency(condition, Number(value), threshold)) {
          const scope = this.determineScope(condition, metrics);
          const reason = this.generateReason(condition, Number(value), threshold);
          
          await this.triggerEmergencyStop({
            type: threshold.action.split('_')[0] as any,
            reason,
            scope,
            severity: threshold.severity,
            initiatedBy: 'SYSTEM',
            autoResolve: condition !== 'consecutive_losses' && condition !== 'daily_loss'
          });
        }
      }
    } catch (error) {
      logger.error('❌ Emergency condition check failed:', error);
    }
  }

  // Execute emergency actions
  private async executeEmergencyActions(emergencyStop: EmergencyStop): Promise<void> {
    for (const action of emergencyStop.actions) {
      try {
        const result = await this.executeAction(action, emergencyStop);
        action.executed = true;
        action.executedAt = Date.now();
        action.result = result;
        
        logger.info(`✅ Emergency action executed: ${action.type} for ${action.target}`);
      } catch (error) {
        logger.error(`❌ Emergency action failed: ${action.type} for ${action.target}`, error);
        action.executed = false;
        action.result = { error: error.message };
      }
    }
  }

  // Execute individual emergency action
  private async executeAction(action: EmergencyAction, emergencyStop: EmergencyStop): Promise<any> {
    switch (action.type) {
      case 'CANCEL_ORDERS':
        return await this.cancelOrders(action.target);
      
      case 'CLOSE_POSITIONS':
        return await this.closePositions(action.target);
      
      case 'DISABLE_TRADING':
        return await this.disableTrading(action.target);
      
      case 'NOTIFY':
        return await this.sendNotification(action.target, emergencyStop);
      
      case 'LOG':
        return await this.logEmergency(emergencyStop);
      
      default:
        throw new Error(`Unknown emergency action: ${action.type}`);
    }
  }

  // Cancel orders
  private async cancelOrders(target: string): Promise<any> {
    // Simulate order cancellation
    logger.warn(`🛑 Cancelling orders for: ${target}`);
    
    // In real implementation, this would:
    // 1. Get all active orders for the target
    // 2. Send cancel requests to exchanges
    // 3. Verify cancellations
    // 4. Update order status
    
    return {
      cancelled: Math.floor(Math.random() * 10) + 1,
      failed: Math.floor(Math.random() * 2),
      target
    };
  }

  // Close positions
  private async closePositions(target: string): Promise<any> {
    // Simulate position closure
    logger.warn(`🛑 Closing positions for: ${target}`);
    
    // In real implementation, this would:
    // 1. Get all open positions for the target
    // 2. Create market orders to close positions
    // 3. Monitor execution
    // 4. Update position status
    
    return {
      closed: Math.floor(Math.random() * 5) + 1,
      failed: Math.floor(Math.random() * 2),
      target
    };
  }

  // Disable trading
  private async disableTrading(target: string): Promise<any> {
    if (target === 'ALL') {
      this.tradingEnabled = false;
      logger.warn('🛑 Trading disabled system-wide');
    } else {
      // Disable trading for specific target
      logger.warn(`🛑 Trading disabled for: ${target}`);
    }
    
    return {
      tradingEnabled: this.tradingEnabled,
      target
    };
  }

  // Send notification
  private async sendNotification(target: string, emergencyStop: EmergencyStop): Promise<any> {
    const message = `🚨 EMERGENCY STOP: ${emergencyStop.reason}\n` +
                   `Type: ${emergencyStop.type}\n` +
                   `Severity: ${emergencyStop.severity}\n` +
                   `Scope: ${emergencyStop.scope.join(', ')}\n` +
                   `Time: ${new Date(emergencyStop.timestamp).toISOString()}`;
    
    logger.warn(`📢 Emergency notification: ${message}`);
    
    // In real implementation, this would send to:
    // - Telegram
    // - Discord
    // - Email
    // - SMS
    // - Slack
    
    return {
      sent: true,
      channels: this.notificationChannels,
      message
    };
  }

  // Log emergency
  private async logEmergency(emergencyStop: EmergencyStop): Promise<any> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      emergencyStop,
      systemStatus: this.systemStatus,
      tradingEnabled: this.tradingEnabled
    };
    
    logger.warn('📝 Emergency logged:', logEntry);
    
    // In real implementation, this would:
    // 1. Write to emergency log file
    // 2. Send to monitoring system
    // 3. Store in database
    
    return logEntry;
  }

  // Generate emergency actions based on type and severity
  private generateEmergencyActions(
    type: string, 
    scope: string[], 
    severity: string
  ): EmergencyAction[] {
    const actions: EmergencyAction[] = [];

    // Always log emergency
    actions.push({
      type: 'LOG',
      target: 'SYSTEM',
      executed: false
    });

    // Always notify
    actions.push({
      type: 'NOTIFY',
      target: 'ALL',
      executed: false
    });

    // Add actions based on severity
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      actions.push({
        type: 'CANCEL_ORDERS',
        target: scope.includes('ALL') ? 'ALL' : scope[0],
        executed: false
      });

      actions.push({
        type: 'CLOSE_POSITIONS',
        target: scope.includes('ALL') ? 'ALL' : scope[0],
        executed: false
      });

      if (type === 'SYSTEM') {
        actions.push({
          type: 'DISABLE_TRADING',
          target: 'ALL',
          executed: false
        });
      }
    }

    return actions;
  }

  // Check if emergency should be triggered
  private shouldTriggerEmergency(condition: string, value: number, threshold: any): boolean {
    switch (condition) {
      case 'price_deviation':
        return value > threshold.threshold;
      case 'volume_spike':
        return value > threshold.threshold;
      case 'consecutive_losses':
        return value >= threshold.threshold;
      case 'daily_loss':
        return value >= threshold.threshold;
      case 'latency_spike':
        return value > threshold.threshold;
      case 'error_rate':
        return value > threshold.threshold;
      default:
        return false;
    }
  }

  // Determine scope for emergency
  private determineScope(condition: string, metrics: any): string[] {
    if (metrics.symbol) return [metrics.symbol];
    if (metrics.exchange) return [metrics.exchange];
    return ['ALL'];
  }

  // Generate reason for emergency
  private generateReason(condition: string, value: number, threshold: any): string {
    const conditionNames: Record<string, string> = {
      'price_deviation': 'Price Deviation',
      'volume_spike': 'Volume Spike',
      'consecutive_losses': 'Consecutive Losses',
      'daily_loss': 'Daily Loss',
      'latency_spike': 'Latency Spike',
      'error_rate': 'Error Rate'
    };

    return `${conditionNames[condition] || condition}: ${value} (threshold: ${threshold.threshold})`;
  }

  // Update system status
  private updateSystemStatus(severity: string): void {
    switch (severity) {
      case 'CRITICAL':
        this.systemStatus = 'CRITICAL';
        break;
      case 'HIGH':
        this.systemStatus = 'EMERGENCY';
        break;
      case 'MEDIUM':
        this.systemStatus = 'WARNING';
        break;
      case 'LOW':
        this.systemStatus = 'WARNING';
        break;
    }
  }

  // Monitor system health
  private async monitorSystemHealth(): Promise<void> {
    try {
      // Check for stuck emergency stops
      const now = Date.now();
      for (const [stopId, stop] of this.activeStops) {
        if (stop.autoResolve && stop.autoResolveTime && now > stop.autoResolveTime) {
          await this.resolveEmergencyStop(stopId, 'Auto-resolved after timeout');
        }
      }

      // Check if system should return to normal
      if (this.activeStops.size === 0 && this.systemStatus !== 'NORMAL') {
        this.systemStatus = 'NORMAL';
        this.tradingEnabled = true;
        this.emit('systemNormal');
      }

    } catch (error) {
      logger.error('❌ System health monitoring failed:', error);
    }
  }

  // Check auto-resolve conditions
  private async checkAutoResolve(): Promise<void> {
    // Implementation for checking if emergency conditions have resolved
    // This would monitor the same metrics that triggered the emergency
    // and automatically resolve if conditions return to normal
  }

  // Resolve emergency stop
  async resolveEmergencyStop(stopId: string, reason: string): Promise<boolean> {
    try {
      const stop = this.activeStops.get(stopId);
      if (!stop) {
        logger.warn(`⚠️ Emergency stop not found: ${stopId}`);
        return false;
      }

      stop.status = 'RESOLVED';
      this.activeStops.delete(stopId);
      
      logger.info(`✅ Emergency stop resolved: ${stopId} - ${reason}`);
      
      this.emit('emergencyResolved', { stopId, reason, stop });
      return true;

    } catch (error) {
      logger.error('❌ Failed to resolve emergency stop:', error);
      return false;
    }
  }

  // Cancel emergency stop
  async cancelEmergencyStop(stopId: string, reason: string): Promise<boolean> {
    try {
      const stop = this.activeStops.get(stopId);
      if (!stop) {
        logger.warn(`⚠️ Emergency stop not found: ${stopId}`);
        return false;
      }

      stop.status = 'CANCELLED';
      this.activeStops.delete(stopId);
      
      logger.info(`✅ Emergency stop cancelled: ${stopId} - ${reason}`);
      
      this.emit('emergencyCancelled', { stopId, reason, stop });
      return true;

    } catch (error) {
      logger.error('❌ Failed to cancel emergency stop:', error);
      return false;
    }
  }

  // Send emergency notifications
  private async sendEmergencyNotifications(emergencyStop: EmergencyStop): Promise<void> {
    // Implementation for sending notifications to various channels
    // This would integrate with the existing alert system
  }

  // Load emergency history
  private async loadEmergencyHistory(): Promise<void> {
    // Implementation for loading previous emergency stops from storage
  }

  // Setup monitoring
  private setupMonitoring(): void {
    // Implementation for setting up additional monitoring
  }

  // Get emergency status
  getEmergencyStatus(): {
    systemStatus: string;
    tradingEnabled: boolean;
    activeStops: number;
    lastStop?: EmergencyStop;
  } {
    const lastStop = this.stopHistory.length > 0 ? this.stopHistory[this.stopHistory.length - 1] : undefined;
    
    return {
      systemStatus: this.systemStatus,
      tradingEnabled: this.tradingEnabled,
      activeStops: this.activeStops.size,
      lastStop
    };
  }

  // Get emergency metrics
  getEmergencyMetrics(): EmergencyMetrics {
    const stopsByType: Record<string, number> = {};
    const stopsBySeverity: Record<string, number> = {};
    
    for (const stop of this.stopHistory) {
      stopsByType[stop.type] = (stopsByType[stop.type] || 0) + 1;
      stopsBySeverity[stop.severity] = (stopsBySeverity[stop.severity] || 0) + 1;
    }

    const resolvedStops = this.stopHistory.filter(s => s.status === 'RESOLVED');
    const averageResolutionTime = resolvedStops.length > 0 
      ? resolvedStops.reduce((sum, stop) => sum + (stop.timestamp - stop.timestamp), 0) / resolvedStops.length
      : 0;

    return {
      totalStops: this.stopHistory.length,
      activeStops: this.activeStops.size,
      averageResolutionTime,
      stopsByType,
      stopsBySeverity,
      lastStopTime: this.stopHistory.length > 0 ? this.stopHistory[this.stopHistory.length - 1].timestamp : undefined
    };
  }

  // Get active emergency stops
  getActiveEmergencyStops(): EmergencyStop[] {
    return Array.from(this.activeStops.values());
  }

  // Check if trading is allowed
  isTradingAllowed(symbol?: string, exchange?: string): boolean {
    if (!this.tradingEnabled) return false;
    
    // Check for active emergency stops that affect the symbol/exchange
    for (const stop of this.activeStops.values()) {
      if (stop.scope.includes('ALL') || 
          (symbol && stop.scope.includes(symbol)) ||
          (exchange && stop.scope.includes(exchange))) {
        return false;
      }
    }
    
    return true;
  }
}
