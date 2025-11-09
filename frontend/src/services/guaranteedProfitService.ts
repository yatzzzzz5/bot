import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Types
export interface GuaranteedSignal {
  symbol: string;
  action: 'LONG' | 'SHORT' | 'CLOSE' | 'ARBITRAGE' | 'FLASH_LOAN' | 'MEV' | 'YIELD_FARM';
  confidence: number;
  expectedProfit: number;
  riskLevel: 'ZERO' | 'MINIMAL' | 'LOW' | 'MEDIUM';
  timeframe: string;
  reason: string;
  stopLoss?: number;
  takeProfit?: number;
  entryPrice?: number;
  exitPrice?: number;
  arbitrageExchanges?: string[];
  flashLoanAmount?: number;
  mevOpportunity?: string;
  yieldProtocol?: string;
}

export interface TradingSettings {
  autoTrading: boolean;
  maxInvestment: number;
  riskLevel: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  minConfidence: number;
  maxPositions: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  arbitrageEnabled: boolean;
  flashLoanEnabled: boolean;
  mevEnabled: boolean;
  yieldFarmingEnabled: boolean;
}

export interface Portfolio {
  totalValue: number;
  cash: number;
  activePositions: number;
  totalProfit: number;
  riskLevel: string;
  positions: any[];
}

export interface Performance {
  totalProfit: number;
  dailyProfit: number;
  dailyProfitPercentage: number;
  successRate: number;
  totalTrades: number;
  averageProfit: number;
  winRate: number;
  lossRate: number;
}

export interface TradeResult {
  success: boolean;
  profit: number;
  message: string;
  tradeId: string;
  timestamp: Date;
}

export interface ExecutionOptions {
  maxSlippagePct?: number;
  minLiquidityUSD?: number;
  postOnly?: boolean;
  ioc?: boolean;
}

// API Client
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for authentication
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      // Don't redirect automatically - let the component handle it gracefully
      console.warn('⚠️ Authentication expired, please login again');
    }
    return Promise.reject(error);
  }
);

export const guaranteedProfitService = {
  // Get active signals
  getActiveSignals: async (): Promise<GuaranteedSignal[]> => {
    try {
      const response = await apiClient.get('/guaranteed-profit/signals');
      return response.data;
    } catch (error) {
      console.error('Error fetching signals:', error);
      throw error;
    }
  },

  // Get combined opportunities (all strategies) for a symbol
  getOpportunities: async (symbol: string): Promise<{
    arbitrage: any[];
    mev: any[];
    flashLoan: any[];
    yield: any[];
    liquidation: any[];
    optionsVolArb: any[];
    funding?: { symbol: string; nextFundingRatePct: number; confidence: number; timeToFundingMin: number } | null;
    borrowBest?: { venue: string; base: string; borrowApyPct: number } | null;
    options?: any[];
    news?: any[];
    entities?: any[];
    flow?: any;
    anomalies?: any[];
  }> => {
    try {
      const response = await apiClient.get(`/guaranteed-profit/opportunities/${symbol}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      throw error;
    }
  },

  // Get signal for specific symbol
  getSignalForSymbol: async (symbol: string): Promise<GuaranteedSignal | null> => {
    try {
      const response = await apiClient.get(`/guaranteed-profit/signals/${symbol}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching signal for symbol:', error);
      throw error;
    }
  },

  // Toggle Speed Mode
  toggleSpeedMode: async (enabled: boolean): Promise<{ enabled: boolean }> => {
    try {
      const response = await apiClient.post('/guaranteed-profit/speed-mode', { enabled });
      return response.data;
    } catch (error) {
      console.error('Error toggling speed mode:', error);
      throw error;
    }
  },

  // Execute a signal
  executeSignal: async (params: {
    signal: GuaranteedSignal;
    amount: number;
    auto: boolean;
    options?: ExecutionOptions;
  }): Promise<TradeResult> => {
    try {
      const response = await apiClient.post('/guaranteed-profit/execute', params);
      return response.data;
    } catch (error) {
      console.error('Error executing signal:', error);
      throw error;
    }
  },

  // Toggle auto trading
  toggleAutoTrading: async (params: {
    enabled: boolean;
    settings: TradingSettings;
  }): Promise<{ autoTrading: boolean }> => {
    try {
      const response = await apiClient.post('/guaranteed-profit/auto-trading', params);
      return response.data;
    } catch (error) {
      console.error('Error toggling auto trading:', error);
      throw error;
    }
  },

  // Update trading settings
  updateSettings: async (settings: TradingSettings): Promise<void> => {
    try {
      await apiClient.put('/guaranteed-profit/settings', settings);
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  },

  // Get portfolio data
  getPortfolio: async (): Promise<Portfolio> => {
    try {
      const response = await apiClient.get('/guaranteed-profit/portfolio');
      return response.data;
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      throw error;
    }
  },

  // Get performance data
  getPerformance: async (): Promise<Performance> => {
    try {
      const response = await apiClient.get('/guaranteed-profit/performance');
      return response.data;
    } catch (error) {
      console.error('Error fetching performance:', error);
      throw error;
    }
  },

  // Get arbitrage opportunities
  getArbitrageOpportunities: async (symbol: string): Promise<any[]> => {
    try {
      const response = await apiClient.get(`/guaranteed-profit/arbitrage/${symbol}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching arbitrage opportunities:', error);
      throw error;
    }
  },

  // Get MEV opportunities
  getMEVOpportunities: async (symbol: string): Promise<any[]> => {
    try {
      const response = await apiClient.get(`/guaranteed-profit/mev/${symbol}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching MEV opportunities:', error);
      throw error;
    }
  },

  // Get flash loan opportunities
  getFlashLoanOpportunities: async (symbol: string): Promise<any[]> => {
    try {
      const response = await apiClient.get(`/guaranteed-profit/flash-loan/${symbol}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching flash loan opportunities:', error);
      throw error;
    }
  },

  // Get yield farming opportunities
  getYieldFarmingOpportunities: async (symbol: string): Promise<any[]> => {
    try {
      const response = await apiClient.get(`/guaranteed-profit/yield-farming/${symbol}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching yield farming opportunities:', error);
      throw error;
    }
  },

  // Start real-time monitoring
  startRealTimeMonitoring: async (symbol: string): Promise<void> => {
    try {
      await apiClient.post(`/guaranteed-profit/monitoring/start/${symbol}`);
    } catch (error) {
      console.error('Error starting real-time monitoring:', error);
      throw error;
    }
  },

  // Stop real-time monitoring
  stopRealTimeMonitoring: async (symbol: string): Promise<void> => {
    try {
      await apiClient.post(`/guaranteed-profit/monitoring/stop/${symbol}`);
    } catch (error) {
      console.error('Error stopping real-time monitoring:', error);
      throw error;
    }
  },

  // Get trading history
  getTradingHistory: async (params: {
    symbol?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<any[]> => {
    try {
      const response = await apiClient.get('/guaranteed-profit/history', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching trading history:', error);
      throw error;
    }
  },

  // Get risk analysis
  getRiskAnalysis: async (symbol: string): Promise<any> => {
    try {
      const response = await apiClient.get(`/guaranteed-profit/risk-analysis/${symbol}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching risk analysis:', error);
      throw error;
    }
  },

  // Get market analysis
  getMarketAnalysis: async (symbol: string): Promise<any> => {
    try {
      const response = await apiClient.get(`/guaranteed-profit/market-analysis/${symbol}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching market analysis:', error);
      throw error;
    }
  },

  // Get on-chain metrics
  getOnChainMetrics: async (symbol: string): Promise<any> => {
    try {
      const response = await apiClient.get(`/guaranteed-profit/on-chain-metrics/${symbol}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching on-chain metrics:', error);
      throw error;
    }
  },

  // Get off-chain metrics
  getOffChainMetrics: async (symbol: string): Promise<any> => {
    try {
      const response = await apiClient.get(`/guaranteed-profit/off-chain-metrics/${symbol}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching off-chain metrics:', error);
      throw error;
    }
  },

  // Get technical indicators
  getTechnicalIndicators: async (symbol: string): Promise<any> => {
    try {
      const response = await apiClient.get(`/guaranteed-profit/technical-indicators/${symbol}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching technical indicators:', error);
      throw error;
    }
  },

  // Get fundamental metrics
  getFundamentalMetrics: async (symbol: string): Promise<any> => {
    try {
      const response = await apiClient.get(`/guaranteed-profit/fundamental-metrics/${symbol}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching fundamental metrics:', error);
      throw error;
    }
  },

  // Execute arbitrage
  executeArbitrage: async (params: {
    symbol: string;
    buyExchange: string;
    sellExchange: string;
    amount: number;
  }): Promise<TradeResult> => {
    try {
      const response = await apiClient.post('/guaranteed-profit/execute-arbitrage', params);
      return response.data;
    } catch (error) {
      console.error('Error executing arbitrage:', error);
      throw error;
    }
  },

  // Execute flash loan
  executeFlashLoan: async (params: {
    symbol: string;
    platform: string;
    amount: number;
    arbitrageParams: any;
  }): Promise<TradeResult> => {
    try {
      const response = await apiClient.post('/guaranteed-profit/execute-flash-loan', params);
      return response.data;
    } catch (error) {
      console.error('Error executing flash loan:', error);
      throw error;
    }
  },

  // Execute MEV
  executeMEV: async (params: {
    symbol: string;
    type: string;
    targetTx: string;
    amount: number;
  }): Promise<TradeResult> => {
    try {
      const response = await apiClient.post('/guaranteed-profit/execute-mev', params);
      return response.data;
    } catch (error) {
      console.error('Error executing MEV:', error);
      throw error;
    }
  },

  // Execute yield farming
  executeYieldFarming: async (params: {
    symbol: string;
    protocol: string;
    amount: number;
    duration: number;
  }): Promise<TradeResult> => {
    try {
      const response = await apiClient.post('/guaranteed-profit/execute-yield-farming', params);
      return response.data;
    } catch (error) {
      console.error('Error executing yield farming:', error);
      throw error;
    }
  },

  // Get system status
  getSystemStatus: async (): Promise<any> => {
    try {
      const response = await apiClient.get('/guaranteed-profit/system-status');
      return response.data;
    } catch (error) {
      console.error('Error fetching system status:', error);
      throw error;
    }
  },

  // Get alerts
  getAlerts: async (): Promise<any[]> => {
    try {
      const response = await apiClient.get('/guaranteed-profit/alerts');
      return response.data;
    } catch (error) {
      console.error('Error fetching alerts:', error);
      throw error;
    }
  },

  // Get monitoring data
  getMonitoring: async (): Promise<any> => {
    try {
      const response = await apiClient.get('/guaranteed-profit/monitoring');
      return response.data;
    } catch (error) {
      console.error('Error fetching monitoring:', error);
      throw error;
    }
  },

  // Set active A/B preset
  setPreset: async (key: 'MICRO_SAFE' | 'SPEED'): Promise<{ activePreset: string }> => {
    try {
      const response = await apiClient.post('/guaranteed-profit/preset', { key });
      return response.data;
    } catch (error) {
      console.error('Error setting preset:', error);
      throw error;
    }
  },

  // Basis carry automation
  openBasis: async (params: { symbol: string; spotExchange: string; perpExchange: string; notionalUSD: number; }): Promise<any> => {
    try {
      const response = await apiClient.post('/guaranteed-profit/basis/open', params);
      return response.data;
    } catch (error) {
      console.error('Error opening basis carry:', error);
      throw error;
    }
  },
  closeBasis: async (params: { symbol: string; spotExchange: string; perpExchange: string; }): Promise<any> => {
    try {
      const response = await apiClient.post('/guaranteed-profit/basis/close', params);
      return response.data;
    } catch (error) {
      console.error('Error closing basis carry:', error);
      throw error;
    }
  },
  rolloverBasis: async (params: { symbol: string; perpExchange: string; }): Promise<any> => {
    try {
      const response = await apiClient.post('/guaranteed-profit/basis/rollover', params);
      return response.data;
    } catch (error) {
      console.error('Error rolling basis carry:', error);
      throw error;
    }
  },

  // List basis positions
  getBasisList: async (): Promise<any[]> => {
    try {
      const response = await apiClient.get('/guaranteed-profit/basis/list');
      return response.data;
    } catch (error) {
      console.error('Error fetching basis list:', error);
      throw error;
    }
  },

  // Deep health
  getHealthDeep: async (): Promise<any> => {
    try {
      const response = await apiClient.get('/health/deep');
      return response.data;
    } catch (error) {
      console.error('Error fetching deep health:', error);
      throw error;
    }
  },

  // Chaos controls
  chaosLatency: async (ms: number): Promise<any> => {
    try {
      const response = await apiClient.post('/chaos/latency', { ms });
      return response.data;
    } catch (error) {
      console.error('Error setting chaos latency:', error);
      throw error;
    }
  },
  chaosSlippage: async (x: number): Promise<any> => {
    try {
      const response = await apiClient.post('/chaos/slippage', { x });
      return response.data;
    } catch (error) {
      console.error('Error setting chaos slippage:', error);
      throw error;
    }
  },
  chaosWsDown: async (): Promise<any> => {
    try {
      const response = await apiClient.post('/chaos/ws-down');
      return response.data;
    } catch (error) {
      console.error('Error setting chaos ws-down:', error);
      throw error;
    }
  },
  chaosReset: async (): Promise<any> => {
    try {
      const response = await apiClient.post('/chaos/reset');
      return response.data;
    } catch (error) {
      console.error('Error resetting chaos:', error);
      throw error;
    }
  },

  // Dismiss alert
  dismissAlert: async (alertId: string): Promise<void> => {
    try {
      await apiClient.delete(`/guaranteed-profit/alerts/${alertId}`);
    } catch (error) {
      console.error('Error dismissing alert:', error);
      throw error;
    }
  },

  // Get notifications
  getNotifications: async (): Promise<any[]> => {
    try {
      const response = await apiClient.get('/guaranteed-profit/notifications');
      return response.data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  },

  // Mark notification as read
  markNotificationAsRead: async (notificationId: string): Promise<void> => {
    try {
      await apiClient.put(`/guaranteed-profit/notifications/${notificationId}/read`);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  // Get logs
  getLogs: async (params: {
    level?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<any[]> => {
    try {
      const response = await apiClient.get('/guaranteed-profit/logs', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching logs:', error);
      throw error;
    }
  },

  // Export data
  exportData: async (params: {
    type: 'trades' | 'signals' | 'performance' | 'portfolio';
    format: 'csv' | 'json' | 'xlsx';
    startDate?: string;
    endDate?: string;
  }): Promise<Blob> => {
    try {
      const response = await apiClient.get('/guaranteed-profit/export', {
        params,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  },

  // Backup settings
  backupSettings: async (): Promise<Blob> => {
    try {
      const response = await apiClient.get('/guaranteed-profit/backup', {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error backing up settings:', error);
      throw error;
    }
  },

  // Restore settings
  restoreSettings: async (backupFile: File): Promise<void> => {
    try {
      const formData = new FormData();
      formData.append('backup', backupFile);
      await apiClient.post('/guaranteed-profit/restore', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
    } catch (error) {
      console.error('Error restoring settings:', error);
      throw error;
    }
  }
};

export default guaranteedProfitService;
