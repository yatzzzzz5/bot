import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface SlippageConfig {
  maxSlippage: number; // Maximum allowed slippage percentage
  maxMarketImpact: number; // Maximum market impact percentage
  maxOrderSize: number; // Maximum order size as percentage of daily volume
  timeDecay: number; // Slippage increase over time
  volatilityAdjustment: number; // Volatility-based slippage adjustment
  liquidityThreshold: number; // Minimum liquidity required
  emergencyStop: boolean; // Emergency stop on high slippage
}

export interface SlippageAnalysis {
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  timestamp: number;
  currentPrice: number;
  expectedPrice: number;
  slippage: {
    absolute: number;
    relative: number; // Percentage
    expected: number; // Expected slippage
    actual: number; // Actual slippage
    maxAllowed: number; // Maximum allowed slippage
  };
  marketImpact: {
    immediate: number; // Immediate market impact
    permanent: number; // Permanent market impact
    temporary: number; // Temporary market impact
    total: number; // Total market impact
  };
  liquidity: {
    available: number; // Available liquidity
    utilization: number; // Liquidity utilization percentage
    depth: number; // Order book depth
    spread: number; // Current spread
  };
  risk: {
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    score: number; // 0-1 risk score
    factors: string[]; // Risk factors
  };
  recommendations: {
    action: 'PROCEED' | 'REDUCE_SIZE' | 'SPLIT_ORDER' | 'DELAY' | 'CANCEL';
    reason: string;
    suggestedSize?: number;
    suggestedDelay?: number; // Delay in seconds
    alternativeRoutes?: string[];
  };
}

export interface SlippageProtection {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  timestamp: number;
  config: SlippageConfig;
  analysis: SlippageAnalysis;
  status: 'ACTIVE' | 'TRIGGERED' | 'EXPIRED' | 'CANCELLED';
  actions: SlippageAction[];
}

export interface SlippageAction {
  id: string;
  type: 'ALERT' | 'REDUCE_SIZE' | 'SPLIT_ORDER' | 'DELAY' | 'CANCEL' | 'EMERGENCY_STOP';
  timestamp: number;
  reason: string;
  details: any;
  executed: boolean;
}

export interface SlippageModel {
  symbol: string;
  timestamp: number;
  parameters: {
    baseSlippage: number;
    sizeImpact: number;
    timeImpact: number;
    volatilityImpact: number;
    liquidityImpact: number;
    spreadImpact: number;
  };
  accuracy: number; // Model accuracy (0-1)
  lastUpdate: number;
}

export class SlippageProtector extends EventEmitter {
  private config: SlippageConfig;
  private protections: Map<string, SlippageProtection> = new Map();
  private models: Map<string, SlippageModel> = new Map();
  private priceFeeds: Map<string, number> = new Map();
  private orderBooks: Map<string, any> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config?: Partial<SlippageConfig>) {
    super();
    
    this.config = {
      maxSlippage: 0.5, // 0.5% max slippage
      maxMarketImpact: 0.3, // 0.3% max market impact
      maxOrderSize: 0.1, // 10% of daily volume
      timeDecay: 0.1, // 0.1% slippage increase per minute
      volatilityAdjustment: 0.2, // 20% volatility adjustment
      liquidityThreshold: 10000, // $10k minimum liquidity
      emergencyStop: true
    };

    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async initialize(): Promise<void> {
    logger.info('🛡️ Initializing Slippage Protector...');
    
    // Initialize default models
    await this.initializeDefaultModels();
    
    // Start monitoring
    this.startMonitoring();
    
    this.isRunning = true;
    logger.info('✅ Slippage Protector initialized');
  }

  // Initialize default slippage models
  private async initializeDefaultModels(): Promise<void> {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'];
    
    for (const symbol of symbols) {
      const model: SlippageModel = {
        symbol,
        timestamp: Date.now(),
        parameters: {
          baseSlippage: 0.05, // 0.05% base slippage
          sizeImpact: 0.1, // 0.1% per 1% of volume
          timeImpact: 0.01, // 0.01% per minute
          volatilityImpact: 0.2, // 0.2% per 1% volatility
          liquidityImpact: 0.05, // 0.05% per 10% liquidity change
          spreadImpact: 0.1 // 0.1% per 0.1% spread
        },
        accuracy: 0.85,
        lastUpdate: Date.now()
      };

      this.models.set(symbol, model);
    }

    logger.info(`🛡️ Initialized ${symbols.length} slippage models`);
  }

  // Analyze slippage for a trade
  async analyzeSlippage(
    symbol: string, 
    side: 'BUY' | 'SELL', 
    size: number
  ): Promise<SlippageAnalysis | null> {
    try {
      // Normalize symbol format (remove duplicate /USDT)
      const normalizedSymbol = symbol.replace(/\/USDT\/USDT$/, '/USDT');
      
      const currentPrice = this.priceFeeds.get(normalizedSymbol) || this.priceFeeds.get(symbol) || 0;
      const orderBook = this.orderBooks.get(normalizedSymbol) || this.orderBooks.get(symbol);
      const model = this.models.get(normalizedSymbol) || this.models.get(symbol);
      
      // If missing data, return a basic fallback analysis instead of null
      if (!currentPrice || !orderBook || !model) {
        logger.warn(`⚠️ Missing data for slippage analysis: ${symbol}, using fallback analysis`);
        
        // Return a basic fallback analysis with conservative estimates
        return this.createFallbackAnalysis(normalizedSymbol || symbol, side, size, currentPrice || 0);
      }

      const timestamp = Date.now();
      const analysisSymbol = normalizedSymbol || symbol;
      
      // Calculate expected slippage
      const expectedSlippage = this.calculateExpectedSlippage(analysisSymbol, side, size, model);
      
      // Calculate market impact
      const marketImpact = this.calculateMarketImpact(analysisSymbol, side, size, orderBook);
      
      // Analyze liquidity
      const liquidity = this.analyzeLiquidity(analysisSymbol, side, size, orderBook);
      
      // Assess risk
      const risk = this.assessRisk(expectedSlippage, marketImpact, liquidity);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(
        expectedSlippage, 
        marketImpact, 
        liquidity, 
        risk
      );

      const analysis: SlippageAnalysis = {
        symbol: analysisSymbol,
        side,
        size,
        timestamp,
        currentPrice,
        expectedPrice: side === 'BUY' ? 
          currentPrice * (1 + expectedSlippage.relative / 100) : 
          currentPrice * (1 - expectedSlippage.relative / 100),
        slippage: {
          absolute: expectedSlippage.absolute,
          relative: expectedSlippage.relative,
          expected: expectedSlippage.relative,
          actual: 0, // Will be updated after execution
          maxAllowed: this.config.maxSlippage
        },
        marketImpact,
        liquidity,
        risk,
        recommendations
      };

      this.emit('slippageAnalyzed', analysis);
      return analysis;

    } catch (error) {
      logger.error('❌ Failed to analyze slippage:', error);
      // Return fallback analysis on error instead of null
      return this.createFallbackAnalysis(symbol, side, size, 0);
    }
  }

  // Create fallback analysis when data is missing
  private createFallbackAnalysis(
    symbol: string,
    side: 'BUY' | 'SELL',
    size: number,
    currentPrice: number
  ): SlippageAnalysis {
    // Use conservative estimates when data is missing
    const estimatedPrice = currentPrice || 1; // Fallback price
    const conservativeSlippage = 0.2; // %0.2 conservative slippage estimate
    
    return {
      symbol,
      side,
      size,
      timestamp: Date.now(),
      currentPrice: estimatedPrice,
      expectedPrice: side === 'BUY' 
        ? estimatedPrice * (1 + conservativeSlippage / 100)
        : estimatedPrice * (1 - conservativeSlippage / 100),
      slippage: {
        absolute: estimatedPrice * (conservativeSlippage / 100),
        relative: conservativeSlippage,
        expected: conservativeSlippage,
        actual: 0,
        maxAllowed: this.config.maxSlippage
      },
      marketImpact: {
        immediate: 0.05,
        permanent: 0.02,
        temporary: 0.03,
        total: 0.1
      },
      liquidity: {
        available: size * 10, // Conservative estimate
        utilization: 10, // 10% utilization
        depth: size * 5,
        spread: 0.1 // 0.1% spread
      },
      risk: {
        level: 'MEDIUM',
        score: 0.5,
        factors: ['Missing market data - using conservative estimates']
      },
      recommendations: {
        action: 'PROCEED',
        reason: 'Fallback analysis - proceeding with caution',
        suggestedSize: size,
        suggestedDelay: 0
      }
    };
  }

  // Calculate expected slippage
  private calculateExpectedSlippage(
    symbol: string, 
    side: 'BUY' | 'SELL', 
    size: number, 
    model: SlippageModel
  ): { absolute: number; relative: number } {
    try {
      const currentPrice = this.priceFeeds.get(symbol) || 0;
      const orderBook = this.orderBooks.get(symbol);
      
      if (!currentPrice || !orderBook) {
        return { absolute: 0, relative: 0 };
      }

      // Base slippage
      let slippage = model.parameters.baseSlippage;
      
      // Size impact
      const volume24h = orderBook.volume24h || 1000000;
      const sizeRatio = (size * currentPrice) / volume24h;
      slippage += model.parameters.sizeImpact * sizeRatio * 100;
      
      // Time impact (simplified)
      const timeInMarket = 1; // Assume 1 minute
      slippage += model.parameters.timeImpact * timeInMarket;
      
      // Volatility impact
      const volatility = this.calculateVolatility(symbol);
      slippage += model.parameters.volatilityImpact * volatility;
      
      // Liquidity impact
      const liquidityRatio = this.calculateLiquidityRatio(symbol, size);
      slippage += model.parameters.liquidityImpact * (1 - liquidityRatio) * 10;
      
      // Spread impact
      const spread = this.calculateSpread(symbol);
      slippage += model.parameters.spreadImpact * spread * 10;

      const absoluteSlippage = currentPrice * (slippage / 100);
      
      return {
        absolute: absoluteSlippage,
        relative: slippage
      };

    } catch (error) {
      logger.error('❌ Failed to calculate expected slippage:', error);
      return { absolute: 0, relative: 0 };
    }
  }

  // Calculate market impact
  private calculateMarketImpact(
    symbol: string, 
    side: 'BUY' | 'SELL', 
    size: number, 
    orderBook: any
  ): { immediate: number; permanent: number; temporary: number; total: number } {
    try {
      const currentPrice = this.priceFeeds.get(symbol) || 0;
      const orderValue = size * currentPrice;
      
      // Immediate impact (simplified)
      const immediateImpact = Math.pow(orderValue / 1000000, 0.5) * 0.001;
      
      // Permanent impact (simplified)
      const permanentImpact = immediateImpact * 0.3;
      
      // Temporary impact (simplified)
      const temporaryImpact = immediateImpact * 0.7;
      
      const totalImpact = immediateImpact + permanentImpact + temporaryImpact;
      
      return {
        immediate: immediateImpact * 100, // Convert to percentage
        permanent: permanentImpact * 100,
        temporary: temporaryImpact * 100,
        total: totalImpact * 100
      };

    } catch (error) {
      logger.error('❌ Failed to calculate market impact:', error);
      return { immediate: 0, permanent: 0, temporary: 0, total: 0 };
    }
  }

  // Analyze liquidity
  private analyzeLiquidity(
    symbol: string, 
    side: 'BUY' | 'SELL', 
    size: number, 
    orderBook: any
  ): { available: number; utilization: number; depth: number; spread: number } {
    try {
      const currentPrice = this.priceFeeds.get(symbol) || 0;
      const orderValue = size * currentPrice;
      
      // Available liquidity (simplified)
      const availableLiquidity = side === 'BUY' ? 
        orderBook.asks?.reduce((sum: number, level: any) => sum + level.size * level.price, 0) || 0 :
        orderBook.bids?.reduce((sum: number, level: any) => sum + level.size * level.price, 0) || 0;
      
      // Utilization ratio
      const utilization = availableLiquidity > 0 ? (orderValue / availableLiquidity) * 100 : 0;
      
      // Order book depth (simplified)
      const depth = orderBook.bids?.length || 0 + orderBook.asks?.length || 0;
      
      // Spread
      const spread = orderBook.spread || 0;
      
      return {
        available: availableLiquidity,
        utilization,
        depth,
        spread
      };

    } catch (error) {
      logger.error('❌ Failed to analyze liquidity:', error);
      return { available: 0, utilization: 0, depth: 0, spread: 0 };
    }
  }

  // Assess risk
  private assessRisk(
    slippage: { absolute: number; relative: number },
    marketImpact: { immediate: number; permanent: number; temporary: number; total: number },
    liquidity: { available: number; utilization: number; depth: number; spread: number }
  ): { level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; score: number; factors: string[] } {
    try {
      let riskScore = 0;
      const factors: string[] = [];
      
      // Slippage risk
      if (slippage.relative > this.config.maxSlippage) {
        riskScore += 0.4;
        factors.push('High slippage');
      } else if (slippage.relative > this.config.maxSlippage * 0.5) {
        riskScore += 0.2;
        factors.push('Moderate slippage');
      }
      
      // Market impact risk
      if (marketImpact.total > this.config.maxMarketImpact) {
        riskScore += 0.3;
        factors.push('High market impact');
      } else if (marketImpact.total > this.config.maxMarketImpact * 0.5) {
        riskScore += 0.15;
        factors.push('Moderate market impact');
      }
      
      // Liquidity risk
      if (liquidity.utilization > 50) {
        riskScore += 0.2;
        factors.push('High liquidity utilization');
      } else if (liquidity.utilization > 25) {
        riskScore += 0.1;
        factors.push('Moderate liquidity utilization');
      }
      
      if (liquidity.available < this.config.liquidityThreshold) {
        riskScore += 0.1;
        factors.push('Low liquidity');
      }
      
      // Determine risk level
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      if (riskScore >= 0.7) {
        riskLevel = 'CRITICAL';
      } else if (riskScore >= 0.5) {
        riskLevel = 'HIGH';
      } else if (riskScore >= 0.3) {
        riskLevel = 'MEDIUM';
      } else {
        riskLevel = 'LOW';
      }
      
      return {
        level: riskLevel,
        score: riskScore,
        factors
      };

    } catch (error) {
      logger.error('❌ Failed to assess risk:', error);
      return { level: 'LOW', score: 0, factors: [] };
    }
  }

  // Generate recommendations
  private generateRecommendations(
    slippage: { absolute: number; relative: number },
    marketImpact: { immediate: number; permanent: number; temporary: number; total: number },
    liquidity: { available: number; utilization: number; depth: number; spread: number },
    risk: { level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; score: number; factors: string[] }
  ): { action: 'PROCEED' | 'REDUCE_SIZE' | 'SPLIT_ORDER' | 'DELAY' | 'CANCEL'; reason: string; suggestedSize?: number; suggestedDelay?: number; alternativeRoutes?: string[] } {
    try {
      // Critical risk - cancel or emergency stop
      if (risk.level === 'CRITICAL') {
        return {
          action: 'CANCEL',
          reason: 'Critical risk detected: ' + risk.factors.join(', '),
          alternativeRoutes: ['Reduce size', 'Split order', 'Wait for better liquidity']
        };
      }
      
      // High risk - reduce size or split order
      if (risk.level === 'HIGH') {
        if (slippage.relative > this.config.maxSlippage) {
          return {
            action: 'REDUCE_SIZE',
            reason: 'High slippage risk',
            suggestedSize: liquidity.available * 0.1 // Use 10% of available liquidity
          };
        }
        
        if (marketImpact.total > this.config.maxMarketImpact) {
          return {
            action: 'SPLIT_ORDER',
            reason: 'High market impact risk',
            suggestedSize: liquidity.available * 0.05 // Use 5% of available liquidity
          };
        }
      }
      
      // Medium risk - proceed with caution or delay
      if (risk.level === 'MEDIUM') {
        if (liquidity.utilization > 25) {
          return {
            action: 'DELAY',
            reason: 'Moderate liquidity utilization',
            suggestedDelay: 60 // Wait 1 minute
          };
        }
        
        return {
          action: 'PROCEED',
          reason: 'Acceptable risk level'
        };
      }
      
      // Low risk - proceed
      return {
        action: 'PROCEED',
        reason: 'Low risk level'
      };

    } catch (error) {
      logger.error('❌ Failed to generate recommendations:', error);
      return {
        action: 'CANCEL',
        reason: 'Error in recommendation generation'
      };
    }
  }

  // Create slippage protection
  async createProtection(
    symbol: string, 
    side: 'BUY' | 'SELL', 
    size: number,
    customConfig?: Partial<SlippageConfig>
  ): Promise<string | null> {
    try {
      const analysis = await this.analyzeSlippage(symbol, side, size);
      if (!analysis) return null;

      const config = customConfig ? { ...this.config, ...customConfig } : this.config;
      
      const protection: SlippageProtection = {
        id: `SLIPPAGE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol,
        side,
        size,
        timestamp: Date.now(),
        config,
        analysis,
        status: 'ACTIVE',
        actions: []
      };

      this.protections.set(protection.id, protection);
      
      // Check if protection should be triggered immediately
      if (analysis.recommendations.action === 'CANCEL') {
        await this.triggerProtection(protection.id, 'ALERT', 'High risk detected');
      }
      
      this.emit('protectionCreated', protection);
      
      logger.info(`🛡️ Slippage protection created: ${protection.id} for ${symbol}`);
      
      return protection.id;

    } catch (error) {
      logger.error('❌ Failed to create slippage protection:', error);
      return null;
    }
  }

  // Trigger protection action
  async triggerProtection(
    protectionId: string, 
    actionType: 'ALERT' | 'REDUCE_SIZE' | 'SPLIT_ORDER' | 'DELAY' | 'CANCEL' | 'EMERGENCY_STOP',
    reason: string,
    details?: any
  ): Promise<boolean> {
    try {
      const protection = this.protections.get(protectionId);
      if (!protection) return false;

      const action: SlippageAction = {
        id: `ACTION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: actionType,
        timestamp: Date.now(),
        reason,
        details: details || {},
        executed: false
      };

      protection.actions.push(action);
      protection.status = 'TRIGGERED';
      
      // Execute action based on type
      switch (actionType) {
        case 'ALERT':
          await this.executeAlert(protection, action);
          break;
        case 'REDUCE_SIZE':
          await this.executeReduceSize(protection, action);
          break;
        case 'SPLIT_ORDER':
          await this.executeSplitOrder(protection, action);
          break;
        case 'DELAY':
          await this.executeDelay(protection, action);
          break;
        case 'CANCEL':
          await this.executeCancel(protection, action);
          break;
        case 'EMERGENCY_STOP':
          await this.executeEmergencyStop(protection, action);
          break;
      }

      action.executed = true;
      
      this.emit('protectionTriggered', { protection, action });
      
      logger.info(`🛡️ Protection action triggered: ${actionType} for ${protectionId}`);
      
      return true;

    } catch (error) {
      logger.error('❌ Failed to trigger protection:', error);
      return false;
    }
  }

  // Execute alert action
  private async executeAlert(protection: SlippageProtection, action: SlippageAction): Promise<void> {
    try {
      // Send alert notification
      this.emit('slippageAlert', {
        protection,
        action,
        message: `Slippage alert for ${protection.symbol}: ${action.reason}`
      });
      
      logger.warn(`🛡️ Slippage alert: ${action.reason} for ${protection.symbol}`);

    } catch (error) {
      logger.error('❌ Failed to execute alert:', error);
    }
  }

  // Execute reduce size action
  private async executeReduceSize(protection: SlippageProtection, action: SlippageAction): Promise<void> {
    try {
      const suggestedSize = protection.analysis.recommendations.suggestedSize;
      if (suggestedSize && suggestedSize < protection.size) {
        protection.size = suggestedSize;
        
        // Re-analyze with new size
        const newAnalysis = await this.analyzeSlippage(protection.symbol, protection.side, protection.size);
        if (newAnalysis) {
          protection.analysis = newAnalysis;
        }
        
        logger.info(`🛡️ Order size reduced to ${suggestedSize} for ${protection.symbol}`);
      }

    } catch (error) {
      logger.error('❌ Failed to execute reduce size:', error);
    }
  }

  // Execute split order action
  private async executeSplitOrder(protection: SlippageProtection, action: SlippageAction): Promise<void> {
    try {
      const suggestedSize = protection.analysis.recommendations.suggestedSize;
      if (suggestedSize && suggestedSize < protection.size) {
        const numSplits = Math.ceil(protection.size / suggestedSize);
        
        // Create multiple smaller orders
        for (let i = 0; i < numSplits; i++) {
          const splitSize = Math.min(suggestedSize, protection.size - (i * suggestedSize));
          if (splitSize > 0) {
            await this.createProtection(protection.symbol, protection.side, splitSize, protection.config);
          }
        }
        
        logger.info(`🛡️ Order split into ${numSplits} parts for ${protection.symbol}`);
      }

    } catch (error) {
      logger.error('❌ Failed to execute split order:', error);
    }
  }

  // Execute delay action
  private async executeDelay(protection: SlippageProtection, action: SlippageAction): Promise<void> {
    try {
      const delay = protection.analysis.recommendations.suggestedDelay || 60;
      
      // Set timeout to re-evaluate
      setTimeout(async () => {
        const newAnalysis = await this.analyzeSlippage(protection.symbol, protection.side, protection.size);
        if (newAnalysis) {
          protection.analysis = newAnalysis;
          
          if (newAnalysis.recommendations.action === 'PROCEED') {
            protection.status = 'ACTIVE';
            logger.info(`🛡️ Protection delay completed for ${protection.symbol}`);
          }
        }
      }, delay * 1000);
      
      logger.info(`🛡️ Order delayed for ${delay} seconds for ${protection.symbol}`);

    } catch (error) {
      logger.error('❌ Failed to execute delay:', error);
    }
  }

  // Execute cancel action
  private async executeCancel(protection: SlippageProtection, action: SlippageAction): Promise<void> {
    try {
      protection.status = 'CANCELLED';
      
      this.emit('orderCancelled', {
        protection,
        action,
        reason: 'Slippage protection triggered cancellation'
      });
      
      logger.info(`🛡️ Order cancelled due to slippage protection for ${protection.symbol}`);

    } catch (error) {
      logger.error('❌ Failed to execute cancel:', error);
    }
  }

  // Execute emergency stop action
  private async executeEmergencyStop(protection: SlippageProtection, action: SlippageAction): Promise<void> {
    try {
      protection.status = 'CANCELLED';
      
      this.emit('emergencyStop', {
        protection,
        action,
        reason: 'Emergency stop triggered by slippage protection'
      });
      
      logger.error(`🛡️ EMERGENCY STOP: Slippage protection for ${protection.symbol}`);

    } catch (error) {
      logger.error('❌ Failed to execute emergency stop:', error);
    }
  }

  // Helper methods
  private calculateVolatility(symbol: string): number {
    // Simplified volatility calculation
    return 0.02; // 2% volatility
  }

  private calculateLiquidityRatio(symbol: string, size: number): number {
    // Simplified liquidity ratio calculation
    return 0.8; // 80% liquidity ratio
  }

  private calculateSpread(symbol: string): number {
    // Simplified spread calculation
    return 0.001; // 0.1% spread
  }

  // Start monitoring
  private startMonitoring(): void {
    this.updateInterval = setInterval(async () => {
      await this.monitorProtections();
    }, 1000); // Monitor every second
  }

  // Monitor active protections
  private async monitorProtections(): Promise<void> {
    try {
      for (const [protectionId, protection] of this.protections) {
        if (protection.status !== 'ACTIVE') continue;

        // Re-analyze slippage
        const newAnalysis = await this.analyzeSlippage(protection.symbol, protection.side, protection.size);
        if (!newAnalysis) continue;

        // Check if protection should be triggered
        if (newAnalysis.recommendations.action !== 'PROCEED') {
          await this.triggerProtection(
            protectionId, 
            newAnalysis.recommendations.action as any, 
            newAnalysis.recommendations.reason
          );
        }

        // Update analysis
        protection.analysis = newAnalysis;
      }
    } catch (error) {
      logger.error('❌ Protection monitoring failed:', error);
    }
  }

  // Public methods
  getProtection(protectionId: string): SlippageProtection | null {
    return this.protections.get(protectionId) || null;
  }

  getAllProtections(): SlippageProtection[] {
    return Array.from(this.protections.values());
  }

  getModel(symbol: string): SlippageModel | null {
    return this.models.get(symbol) || null;
  }

  updateModel(symbol: string, model: Partial<SlippageModel>): boolean {
    const existingModel = this.models.get(symbol);
    if (!existingModel) return false;

    const updatedModel = { ...existingModel, ...model };
    this.models.set(symbol, updatedModel);
    
    logger.info(`🛡️ Slippage model updated for ${symbol}`);
    return true;
  }

  updateConfig(config: Partial<SlippageConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('🛡️ Slippage protection config updated');
  }

  isEngineRunning(): boolean {
    return this.isRunning;
  }

  // Stop the engine
  async stop(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.isRunning = false;
    logger.info('🛡️ Slippage Protector stopped');
  }
}
