import { logger } from '../../utils/logger';
import { MarketDataValidator } from '../validation/market-data-validator';

export interface AtomicOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  amount: number;
  price?: number;
  exchange: string;
  type: 'MARKET' | 'LIMIT';
  timestamp: number;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  dependencies: string[]; // Order IDs that must complete first
  rollbackData?: any;
}

export interface AtomicTransaction {
  id: string;
  orders: AtomicOrder[];
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  startTime: number;
  endTime?: number;
  totalValue: number;
  expectedProfit: number;
  riskLevel: 'ZERO' | 'MINIMAL' | 'LOW' | 'MEDIUM';
  rollbackStrategy: 'IMMEDIATE' | 'GRACEFUL' | 'MANUAL';
}

export interface ExecutionResult {
  transactionId: string;
  success: boolean;
  executedOrders: string[];
  failedOrders: string[];
  totalProfit: number;
  executionTime: number;
  rollbackRequired: boolean;
  rollbackCompleted: boolean;
  errors: string[];
}

export class AtomicExecutionEngine {
  private activeTransactions: Map<string, AtomicTransaction> = new Map();
  private orderHistory: Map<string, AtomicOrder> = new Map();
  private marketValidator: MarketDataValidator;
  private maxExecutionTime: number = 30000; // 30 seconds
  private rollbackTimeout: number = 10000; // 10 seconds

  constructor() {
    this.marketValidator = new MarketDataValidator();
  }

  async initialize(): Promise<void> {
    logger.info('⚛️ Initializing Atomic Execution Engine...');
    await this.marketValidator.initialize();
    logger.info('✅ Atomic Execution Engine initialized');
  }

  // Create atomic transaction with multiple orders
  async createAtomicTransaction(orders: Omit<AtomicOrder, 'id' | 'status' | 'timestamp'>[]): Promise<string> {
    try {
      const transactionId = `ATOMIC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Validate all orders before creating transaction
      const validatedOrders: AtomicOrder[] = [];
      let totalValue = 0;
      let expectedProfit = 0;

      for (const orderData of orders) {
        // Pre-execution validation
        const validation = await this.validateOrder(orderData);
        if (!validation.isValid) {
          throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
        }

        const order: AtomicOrder = {
          ...orderData,
          id: `${transactionId}_${validatedOrders.length}`,
          status: 'PENDING',
          timestamp: Date.now()
        };

        validatedOrders.push(order);
        totalValue += order.amount * (order.price || 0);
      }

      // Calculate expected profit
      expectedProfit = this.calculateExpectedProfit(validatedOrders);

      const transaction: AtomicTransaction = {
        id: transactionId,
        orders: validatedOrders,
        status: 'PENDING',
        startTime: Date.now(),
        totalValue,
        expectedProfit,
        riskLevel: this.assessRiskLevel(validatedOrders),
        rollbackStrategy: this.determineRollbackStrategy(validatedOrders)
      };

      this.activeTransactions.set(transactionId, transaction);
      
      logger.info(`✅ Atomic transaction created: ${transactionId} with ${orders.length} orders`);
      return transactionId;

    } catch (error) {
      logger.error('❌ Failed to create atomic transaction:', error);
      throw error;
    }
  }

  // Execute atomic transaction
  async executeAtomicTransaction(transactionId: string): Promise<ExecutionResult> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const startTime = Date.now();
    const executedOrders: string[] = [];
    const failedOrders: string[] = [];
    const errors: string[] = [];
    let rollbackRequired = false;
    let rollbackCompleted = false;

    try {
      logger.info(`🚀 Executing atomic transaction: ${transactionId}`);
      transaction.status = 'EXECUTING';

      // Execute orders in dependency order
      const executionOrder = this.determineExecutionOrder(transaction.orders);
      
      for (const order of executionOrder) {
        try {
          // Pre-execution market validation
          const marketValidation = await this.marketValidator.emergencyValidation(
            order.symbol,
            order.price || 0,
            order.exchange
          );

          if (!marketValidation) {
            throw new Error('Market validation failed - price deviation too high');
          }

          // Execute individual order
          const orderResult = await this.executeOrder(order);
          
          if (orderResult.success) {
            executedOrders.push(order.id);
            order.status = 'COMPLETED';
            logger.info(`✅ Order executed: ${order.id}`);
          } else {
            throw new Error(`Order execution failed: ${orderResult.error}`);
          }

        } catch (error) {
          logger.error(`❌ Order execution failed: ${order.id}`, error);
          order.status = 'FAILED';
          failedOrders.push(order.id);
          errors.push(`Order ${order.id}: ${error}`);
          
          // Determine if rollback is required
          if (this.shouldRollback(transaction, executedOrders, failedOrders)) {
            rollbackRequired = true;
            break;
          }
        }
      }

      // Check if all orders completed successfully
      if (failedOrders.length === 0) {
        transaction.status = 'COMPLETED';
        transaction.endTime = Date.now();
        logger.info(`✅ Atomic transaction completed: ${transactionId}`);
      } else {
        transaction.status = 'FAILED';
        rollbackRequired = true;
      }

      // Perform rollback if required
      if (rollbackRequired) {
        rollbackCompleted = await this.performRollback(transaction, executedOrders);
        if (rollbackCompleted) {
          transaction.status = 'ROLLED_BACK';
        }
      }

    } catch (error) {
      logger.error(`❌ Atomic transaction execution failed: ${transactionId}`, error);
      transaction.status = 'FAILED';
      errors.push(`Transaction execution error: ${error}`);
      rollbackRequired = true;
      
      // Emergency rollback
      rollbackCompleted = await this.performRollback(transaction, executedOrders);
    }

    const executionTime = Date.now() - startTime;
    const totalProfit = this.calculateActualProfit(transaction, executedOrders);

    const result: ExecutionResult = {
      transactionId,
      success: transaction.status === 'COMPLETED',
      executedOrders,
      failedOrders,
      totalProfit,
      executionTime,
      rollbackRequired,
      rollbackCompleted,
      errors
    };

    // Clean up completed transaction
    if (transaction.status === 'COMPLETED' || transaction.status === 'ROLLED_BACK') {
      this.activeTransactions.delete(transactionId);
    }

    return result;
  }

  // Validate individual order
  private async validateOrder(order: Omit<AtomicOrder, 'id' | 'status' | 'timestamp'>): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Basic validation
      if (!order.symbol || !order.side || order.amount <= 0) {
        errors.push('Invalid order parameters');
      }

      if (order.type === 'LIMIT' && (!order.price || order.price <= 0)) {
        errors.push('Limit order requires valid price');
      }

      // Market validation
      const marketValidation = await this.marketValidator.crossValidatePrices(order.symbol);
      if (marketValidation.validationScore < 0.7) {
        errors.push(`Low market validation score: ${marketValidation.validationScore.toFixed(3)}`);
      }

      // Risk validation
      if (order.amount > 1000000) { // $1M limit
        errors.push('Order amount exceeds maximum limit');
      }

      return { isValid: errors.length === 0, errors };

    } catch (error) {
      errors.push(`Validation error: ${error}`);
      return { isValid: false, errors };
    }
  }

  // Execute individual order (simulated)
  private async executeOrder(order: AtomicOrder): Promise<{ success: boolean; error?: string }> {
    try {
      // Simulate order execution
      order.status = 'EXECUTING';
      
      // Simulate execution delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
      
      // Simulate success/failure (95% success rate)
      const success = Math.random() > 0.05;
      
      if (success) {
        order.status = 'COMPLETED';
        this.orderHistory.set(order.id, order);
        return { success: true };
      } else {
        order.status = 'FAILED';
        return { success: false, error: 'Simulated execution failure' };
      }

    } catch (error) {
      order.status = 'FAILED';
      return { success: false, error: `Execution error: ${error}` };
    }
  }

  // Determine execution order based on dependencies
  private determineExecutionOrder(orders: AtomicOrder[]): AtomicOrder[] {
    const sorted: AtomicOrder[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (order: AtomicOrder) => {
      if (visiting.has(order.id)) {
        throw new Error('Circular dependency detected');
      }
      if (visited.has(order.id)) {
        return;
      }

      visiting.add(order.id);
      
      // Process dependencies first
      for (const depId of order.dependencies) {
        const depOrder = orders.find(o => o.id === depId);
        if (depOrder) {
          visit(depOrder);
        }
      }
      
      visiting.delete(order.id);
      visited.add(order.id);
      sorted.push(order);
    };

    for (const order of orders) {
      if (!visited.has(order.id)) {
        visit(order);
      }
    }

    return sorted;
  }

  // Determine if rollback is required
  private shouldRollback(transaction: AtomicTransaction, executedOrders: string[], failedOrders: string[]): boolean {
    // Rollback if any critical order failed
    const criticalOrders = transaction.orders.filter(o => o.dependencies.length > 0);
    const failedCriticalOrders = criticalOrders.filter(o => failedOrders.includes(o.id));
    
    if (failedCriticalOrders.length > 0) {
      return true;
    }

    // Rollback if too many orders failed
    const failureRate = failedOrders.length / transaction.orders.length;
    if (failureRate > 0.3) { // 30% failure threshold
      return true;
    }

    // Rollback if execution time exceeds limit
    const executionTime = Date.now() - transaction.startTime;
    if (executionTime > this.maxExecutionTime) {
      return true;
    }

    return false;
  }

  // Perform rollback of executed orders
  private async performRollback(transaction: AtomicTransaction, executedOrders: string[]): Promise<boolean> {
    try {
      logger.warn(`🔄 Performing rollback for transaction: ${transaction.id}`);
      
      const rollbackPromises = executedOrders.map(async (orderId) => {
        const order = transaction.orders.find(o => o.id === orderId);
        if (!order) return false;

        try {
          // Create opposite order for rollback
          const rollbackOrder: AtomicOrder = {
            id: `${orderId}_ROLLBACK`,
            symbol: order.symbol,
            side: order.side === 'BUY' ? 'SELL' : 'BUY',
            amount: order.amount,
            price: order.price,
            exchange: order.exchange,
            type: order.type,
            timestamp: Date.now(),
            status: 'PENDING',
            dependencies: []
          };

          // Execute rollback order
          const rollbackResult = await this.executeOrder(rollbackOrder);
          if (rollbackResult.success) {
            order.status = 'ROLLED_BACK';
            logger.info(`✅ Rollback completed for order: ${orderId}`);
            return true;
          } else {
            logger.error(`❌ Rollback failed for order: ${orderId}`);
            return false;
          }

        } catch (error) {
          logger.error(`❌ Rollback error for order: ${orderId}`, error);
          return false;
        }
      });

      const rollbackResults = await Promise.all(rollbackPromises);
      const successfulRollbacks = rollbackResults.filter(r => r).length;
      
      logger.info(`🔄 Rollback completed: ${successfulRollbacks}/${executedOrders.length} orders rolled back`);
      
      return successfulRollbacks === executedOrders.length;

    } catch (error) {
      logger.error('❌ Rollback execution failed:', error);
      return false;
    }
  }

  // Calculate expected profit
  private calculateExpectedProfit(orders: AtomicOrder[]): number {
    // Simplified profit calculation
    let totalProfit = 0;
    
    for (const order of orders) {
      if (order.side === 'BUY') {
        totalProfit -= order.amount * (order.price || 0);
      } else {
        totalProfit += order.amount * (order.price || 0);
      }
    }
    
    return totalProfit;
  }

  // Calculate actual profit
  private calculateActualProfit(transaction: AtomicTransaction, executedOrders: string[]): number {
    // Simplified actual profit calculation
    return transaction.expectedProfit * (executedOrders.length / transaction.orders.length);
  }

  // Assess risk level
  private assessRiskLevel(orders: AtomicOrder[]): 'ZERO' | 'MINIMAL' | 'LOW' | 'MEDIUM' {
    const totalValue = orders.reduce((sum, order) => sum + (order.amount * (order.price || 0)), 0);
    const dependencyCount = orders.reduce((sum, order) => sum + order.dependencies.length, 0);
    
    if (totalValue < 10000 && dependencyCount === 0) {
      return 'ZERO';
    } else if (totalValue < 50000 && dependencyCount < 2) {
      return 'MINIMAL';
    } else if (totalValue < 200000 && dependencyCount < 5) {
      return 'LOW';
    } else {
      return 'MEDIUM';
    }
  }

  // Determine rollback strategy
  private determineRollbackStrategy(orders: AtomicOrder[]): 'IMMEDIATE' | 'GRACEFUL' | 'MANUAL' {
    const riskLevel = this.assessRiskLevel(orders);
    
    switch (riskLevel) {
      case 'ZERO':
      case 'MINIMAL':
        return 'IMMEDIATE';
      case 'LOW':
        return 'GRACEFUL';
      case 'MEDIUM':
        return 'MANUAL';
      default:
        return 'MANUAL';
    }
  }

  // Get transaction status
  getTransactionStatus(transactionId: string): AtomicTransaction | null {
    return this.activeTransactions.get(transactionId) || null;
  }

  // Get all active transactions
  getActiveTransactions(): AtomicTransaction[] {
    return Array.from(this.activeTransactions.values());
  }

  // Get execution statistics
  getExecutionStats(): {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    rollbackRate: number;
    averageExecutionTime: number;
  } {
    const transactions = Array.from(this.activeTransactions.values());
    const total = transactions.length;
    const successful = transactions.filter(t => t.status === 'COMPLETED').length;
    const failed = transactions.filter(t => t.status === 'FAILED').length;
    const rolledBack = transactions.filter(t => t.status === 'ROLLED_BACK').length;
    
    const totalExecutionTime = transactions.reduce((sum, t) => {
      return sum + ((t.endTime || Date.now()) - t.startTime);
    }, 0);

    return {
      totalTransactions: total,
      successfulTransactions: successful,
      failedTransactions: failed,
      rollbackRate: total > 0 ? rolledBack / total : 0,
      averageExecutionTime: total > 0 ? totalExecutionTime / total : 0
    };
  }
}
