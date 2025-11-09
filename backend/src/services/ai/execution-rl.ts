import { logger } from '../../utils/logger';

export interface ExecutionState {
  symbol: string;
  size: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  marketVolatility: number;
  liquidity: number;
  timeOfDay: number; // 0-23 hour
  dayOfWeek: number; // 0-6
}

export interface ExecutionAction {
  executionMode: 'DIRECT' | 'TWAP' | 'ICEBERG';
  venue: string;
  parameters?: {
    twapSlices?: number;
    twapIntervalMs?: number;
    icebergPeak?: number;
  };
}

export interface ExecutionReward {
  cost: number;
  slippage: number;
  latency: number;
  success: boolean;
  marketImpact: number;
}

export interface QLearningState {
  state: string;
  action: string;
  qValue: number;
  visits: number;
  lastUpdated: Date;
}

export class ExecutionRL {
  private qTable: Map<string, QLearningState> = new Map();
  private learningRate: number = 0.1;
  private discountFactor: number = 0.9;
  private explorationRate: number = 0.2;
  private minExplorationRate: number = 0.05;
  private explorationDecay: number = 0.995;
  private stateHistory: Array<{ state: ExecutionState; action: ExecutionAction; reward: ExecutionReward }> = [];

  async initialize(): Promise<void> {
    logger.info('🤖 Initializing Execution RL...');
    logger.info('✅ Execution RL initialized');
  }

  // Get state representation as string
  private getStateKey(state: ExecutionState): string {
    // Discretize continuous variables for Q-learning
    const sizeBucket = Math.floor(Math.log10(state.size) * 2) / 2; // Log scale buckets
    const volatilityBucket = Math.floor(state.marketVolatility * 10) / 10; // 0.1 buckets
    const liquidityBucket = Math.floor(Math.log10(state.liquidity) * 2) / 2; // Log scale buckets
    const timeBucket = Math.floor(state.timeOfDay / 4); // 6-hour buckets
    const dayBucket = state.dayOfWeek;
    
    return `${state.symbol}_${sizeBucket}_${state.urgency}_${volatilityBucket}_${liquidityBucket}_${timeBucket}_${dayBucket}`;
  }

  // Get action representation as string
  private getActionKey(action: ExecutionAction): string {
    const params = action.parameters ? 
      `_${action.parameters.twapSlices || 0}_${action.parameters.twapIntervalMs || 0}_${action.parameters.icebergPeak || 0}` : '';
    return `${action.executionMode}_${action.venue}${params}`;
  }

  // Select action using epsilon-greedy policy
  selectAction(state: ExecutionState, availableActions: ExecutionAction[]): ExecutionAction {
    try {
      const stateKey = this.getStateKey(state);
      
      // Exploration vs Exploitation
      if (Math.random() < this.explorationRate) {
        // Exploration: random action
        const randomAction = availableActions[Math.floor(Math.random() * availableActions.length)];
        logger.info(`🎲 RL Exploration: selected ${randomAction.executionMode} on ${randomAction.venue}`);
        return randomAction;
      } else {
        // Exploitation: best known action
        let bestAction = availableActions[0];
        let bestQValue = -Infinity;
        
        for (const action of availableActions) {
          const actionKey = this.getActionKey(action);
          const qKey = `${stateKey}_${actionKey}`;
          const qState = this.qTable.get(qKey);
          const qValue = qState ? qState.qValue : 0;
          
          if (qValue > bestQValue) {
            bestQValue = qValue;
            bestAction = action;
          }
        }
        
        logger.info(`🎯 RL Exploitation: selected ${bestAction.executionMode} on ${bestAction.venue} (Q: ${bestQValue.toFixed(3)})`);
        return bestAction;
      }
    } catch (error) {
      logger.error('❌ RL action selection failed:', error);
      return availableActions[0] || { executionMode: 'DIRECT', venue: 'DEFAULT' };
    }
  }

  // Update Q-values based on experience
  updateQValue(
    state: ExecutionState, 
    action: ExecutionAction, 
    reward: ExecutionReward, 
    nextState?: ExecutionState
  ): void {
    try {
      const stateKey = this.getStateKey(state);
      const actionKey = this.getActionKey(action);
      const qKey = `${stateKey}_${actionKey}`;
      
      // Get current Q-value
      const currentQState = this.qTable.get(qKey) || {
        state: stateKey,
        action: actionKey,
        qValue: 0,
        visits: 0,
        lastUpdated: new Date()
      };
      
      // Calculate reward (normalized to -1 to 1)
      const normalizedReward = this.normalizeReward(reward);
      
      // Q-learning update
      let maxNextQ = 0;
      if (nextState) {
        const nextStateKey = this.getStateKey(nextState);
        // Find max Q-value for next state (simplified - would need available actions)
        for (const [key, qState] of this.qTable.entries()) {
          if (key.startsWith(nextStateKey)) {
            maxNextQ = Math.max(maxNextQ, qState.qValue);
          }
        }
      }
      
      // Q(s,a) = Q(s,a) + α[r + γ*max(Q(s',a')) - Q(s,a)]
      const newQValue = currentQState.qValue + this.learningRate * 
        (normalizedReward + this.discountFactor * maxNextQ - currentQState.qValue);
      
      // Update Q-table
      this.qTable.set(qKey, {
        state: stateKey,
        action: actionKey,
        qValue: newQValue,
        visits: currentQState.visits + 1,
        lastUpdated: new Date()
      });
      
      // Decay exploration rate
      this.explorationRate = Math.max(this.minExplorationRate, this.explorationRate * this.explorationDecay);
      
      // Store experience for analysis
      this.stateHistory.push({ state, action, reward });
      if (this.stateHistory.length > 1000) {
        this.stateHistory = this.stateHistory.slice(-1000);
      }
      
      logger.info(`📊 RL Update: ${qKey} Q: ${currentQState.qValue.toFixed(3)} → ${newQValue.toFixed(3)} (reward: ${normalizedReward.toFixed(3)})`);
    } catch (error) {
      logger.error('❌ RL Q-value update failed:', error);
    }
  }

  // Normalize reward to -1 to 1 range
  private normalizeReward(reward: ExecutionReward): number {
    try {
      // Cost component (lower is better)
      const costComponent = Math.max(-1, Math.min(1, -reward.cost * 1000)); // Scale and invert
      
      // Slippage component (lower is better)
      const slippageComponent = Math.max(-1, Math.min(1, -reward.slippage * 1000)); // Scale and invert
      
      // Latency component (lower is better)
      const latencyComponent = Math.max(-1, Math.min(1, -reward.latency / 1000)); // Scale and invert
      
      // Success component (higher is better)
      const successComponent = reward.success ? 0.5 : -0.5;
      
      // Market impact component (lower is better)
      const impactComponent = Math.max(-1, Math.min(1, -reward.marketImpact * 1000)); // Scale and invert
      
      // Weighted combination
      const weights = {
        cost: 0.3,
        slippage: 0.25,
        latency: 0.15,
        success: 0.2,
        impact: 0.1
      };
      
      return (
        costComponent * weights.cost +
        slippageComponent * weights.slippage +
        latencyComponent * weights.latency +
        successComponent * weights.success +
        impactComponent * weights.impact
      );
    } catch (error) {
      logger.error('❌ Reward normalization failed:', error);
      return 0;
    }
  }

  // Get Q-table statistics
  getQTableStats(): {
    totalStates: number;
    avgQValue: number;
    explorationRate: number;
    topActions: Array<{ state: string; action: string; qValue: number; visits: number }>;
  } {
    const qStates = Array.from(this.qTable.values());
    
    if (qStates.length === 0) {
      return {
        totalStates: 0,
        avgQValue: 0,
        explorationRate: this.explorationRate,
        topActions: []
      };
    }
    
    const avgQValue = qStates.reduce((sum, state) => sum + state.qValue, 0) / qStates.length;
    
    // Get top 10 actions by Q-value
    const topActions = qStates
      .sort((a, b) => b.qValue - a.qValue)
      .slice(0, 10)
      .map(state => ({
        state: state.state,
        action: state.action,
        qValue: state.qValue,
        visits: state.visits
      }));
    
    return {
      totalStates: qStates.length,
      avgQValue,
      explorationRate: this.explorationRate,
      topActions
    };
  }

  // Get learning progress
  getLearningProgress(): {
    totalExperiences: number;
    recentPerformance: number;
    explorationPhase: 'HIGH' | 'MEDIUM' | 'LOW';
  } {
    const recentExperiences = this.stateHistory.slice(-100);
    const recentPerformance = recentExperiences.length > 0 ? 
      recentExperiences.reduce((sum, exp) => sum + this.normalizeReward(exp.reward), 0) / recentExperiences.length : 0;
    
    let explorationPhase: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (this.explorationRate > 0.15) {
      explorationPhase = 'HIGH';
    } else if (this.explorationRate > 0.08) {
      explorationPhase = 'MEDIUM';
    }
    
    return {
      totalExperiences: this.stateHistory.length,
      recentPerformance,
      explorationPhase
    };
  }

  // Generate available actions for a given state
  generateAvailableActions(state: ExecutionState, availableVenues: string[]): ExecutionAction[] {
    const actions: ExecutionAction[] = [];
    
    for (const venue of availableVenues) {
      // DIRECT execution
      actions.push({
        executionMode: 'DIRECT',
        venue
      });
      
      // TWAP execution (for larger orders)
      if (state.size > 10000) {
        actions.push({
          executionMode: 'TWAP',
          venue,
          parameters: {
            twapSlices: 3,
            twapIntervalMs: 200
          }
        });
      }
      
      // ICEBERG execution (for very large orders)
      if (state.size > 50000) {
        actions.push({
          executionMode: 'ICEBERG',
          venue,
          parameters: {
            icebergPeak: state.size / 3
          }
        });
      }
    }
    
    return actions;
  }

  // Reset learning (for testing or fresh start)
  resetLearning(): void {
    this.qTable.clear();
    this.stateHistory = [];
    this.explorationRate = 0.2;
    logger.info('🔄 RL learning reset');
  }
}
