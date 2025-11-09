const API_BASE_URL = 'http://localhost:5000/api';

// Helper function to make authenticated fetch requests
const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('authToken');
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  headers.set('Content-Type', 'application/json');
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });
  
  // If unauthorized, try to refresh token or redirect to login
  if (response.status === 401) {
    localStorage.removeItem('authToken');
    // Don't redirect automatically, let the component handle it
  }
  
  return response;
};

export const tradingService = {
  // Get bot status
  getBotStatus: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/trading/status`);
    if (!response.ok) throw new Error('Failed to fetch bot status');
    return response.json();
  },

  // Start trading bot
  startBot: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/trading/start`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to start bot');
    return response.json();
  },

  // Stop trading bot
  stopBot: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/trading/stop`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to stop bot');
    return response.json();
  },

  // Get active trading signals (aligned to backend GP route)
  getActiveSignals: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/guaranteed-profit/signals`);
    if (!response.ok) throw new Error('Failed to fetch signals');
    const data = await response.json();
    return data.signals || [];
  },

  // Get trading history
  getTradingHistory: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/analytics`);
    if (!response.ok) throw new Error('Failed to fetch trading history');
    return response.json();
  },

  // ===== ENHANCED AI SERVICES =====
  
  // Enhanced News Analysis
  getEnhancedNews: async (symbol: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/enhanced/news/${symbol}`);
    if (!response.ok) throw new Error('Failed to fetch enhanced news');
    return response.json();
  },

  // Enhanced Whale Tracking
  getEnhancedWhale: async (symbol: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/enhanced/whale/${symbol}`);
    if (!response.ok) throw new Error('Failed to fetch whale data');
    return response.json();
  },

  // Enhanced ML Predictions
  getEnhancedML: async (symbol: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/enhanced/ml/${symbol}`);
    if (!response.ok) throw new Error('Failed to fetch ML predictions');
    return response.json();
  },

  // Combined Enhanced Analysis
  getEnhancedAnalysis: async (symbol: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/enhanced/analysis/${symbol}`);
    if (!response.ok) throw new Error('Failed to fetch enhanced analysis');
    return response.json();
  },

  // ===== MICRO TRADING ENGINE =====
  
  // Get micro trading status
  getMicroTradingStatus: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/micro-trading/status`);
    if (!response.ok) throw new Error('Failed to fetch micro trading status');
    const json = await response.json();
    return json.data || json; // Return data object or full response
  },

  // Start micro trading
  startMicroTrading: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/micro-trading/start`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to start micro trading');
    return response.json();
  },

  // Stop micro trading
  stopMicroTrading: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/micro-trading/stop`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to stop micro trading');
    return response.json();
  },

  // Get micro trading performance
  getMicroTradingPerformance: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/micro-trading/performance`);
    if (!response.ok) throw new Error('Failed to fetch micro trading performance');
    const json = await response.json();
    return json.data || json; // Return data object or full response
  },

  // ===== CIRCUIT BREAKER SYSTEM =====
  
  // Get circuit breaker status
  getCircuitBreakerStatus: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/circuit-breaker/status`);
    if (!response.ok) throw new Error('Failed to fetch circuit breaker status');
    const json = await response.json();
    return json.data || json; // Return data object or full response
  },

  // Reset circuit breaker
  resetCircuitBreaker: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/circuit-breaker/reset`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    if (!response.ok) throw new Error('Failed to reset circuit breaker');
    return response.json();
  },

  // ===== PROFIT LOCK SYSTEM =====
  
  // Get profit lock status
  getProfitLockStatus: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/profit-lock/status`);
    if (!response.ok) throw new Error('Failed to fetch profit lock status');
    return response.json();
  },

  // Unlock profits
  unlockProfits: async (condition: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/profit-lock/unlock`, {
      method: 'POST',
      body: JSON.stringify({ condition })
    });
    if (!response.ok) throw new Error('Failed to unlock profits');
    return response.json();
  },

  // ===== MARKET REGIME DETECTION =====
  
  // Get market regime
  getMarketRegime: async (symbol: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/market-regime/${symbol}`);
    if (!response.ok) throw new Error('Failed to fetch market regime');
    const json = await response.json();
    return json.data || json; // Return data object or full response
  },

  // ===== ADAPTIVE POSITION SIZING =====
  
  // Get position sizing recommendation
  getPositionSizing: async (symbol: string, signal: any) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/position-sizing/calculate`, {
      method: 'POST',
      body: JSON.stringify({ symbol, signal })
    });
    if (!response.ok) throw new Error('Failed to calculate position sizing');
    return response.json();
  },

  // Intel endpoints
  getIntelNews: async (symbol: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/intel/news/${encodeURIComponent(symbol)}`);
    if (!response.ok) throw new Error('Failed to fetch intel news');
    return response.json();
  },
  getIntelSentiment: async (symbol: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/intel/sentiment/${encodeURIComponent(symbol)}`);
    if (!response.ok) throw new Error('Failed to fetch intel sentiment');
    return response.json();
  },
  getIntelAnomalies: async (params: { priceChangePct?: number; volumeZ?: number; newsCount?: number; flowDelta?: number }) => {
    const q = new URLSearchParams();
    if (params.priceChangePct != null) q.set('priceChangePct', String(params.priceChangePct));
    if (params.volumeZ != null) q.set('volumeZ', String(params.volumeZ));
    if (params.newsCount != null) q.set('newsCount', String(params.newsCount));
    if (params.flowDelta != null) q.set('flowDelta', String(params.flowDelta));
    const response = await authenticatedFetch(`${API_BASE_URL}/intel/anomalies?${q.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch anomalies');
    return response.json();
  },
  getIntelFlowNowcast: async (symbol: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/intel/flow/${encodeURIComponent(symbol)}`);
    if (!response.ok) throw new Error('Failed to fetch flow nowcast');
    return response.json();
  },

  // Regime-aware allocation endpoints
  getRegimeAllocation: async (capital: number = 100000) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/guaranteed-profit/regime-allocation?capital=${capital}`);
    if (!response.ok) throw new Error('Failed to fetch regime allocation');
    return response.json();
  },

  selectOptimalPreset: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/guaranteed-profit/select-optimal-preset`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to select optimal preset');
    return response.json();
  },

  getRegimePerformance: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/guaranteed-profit/regime-performance`);
    if (!response.ok) throw new Error('Failed to fetch regime performance');
    return response.json();
  },

  // TCA and Execution RL endpoints
  getTCAStats: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/execution/tca-stats`);
    if (!response.ok) throw new Error('Failed to fetch TCA stats');
    return response.json();
  },

  getVenuePerformance: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/execution/venue-performance`);
    if (!response.ok) throw new Error('Failed to fetch venue performance');
    return response.json();
  },

  getRLStats: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/execution/rl-stats`);
    if (!response.ok) throw new Error('Failed to fetch RL stats');
    return response.json();
  },

  executeWithTCA: async (params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    size: number;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH';
    marketVolatility?: number;
    liquidity?: number;
  }) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/execution/execute-with-tca`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
    if (!response.ok) throw new Error('Failed to execute with TCA');
    return response.json();
  },

  // Market Data Validation
  validateMarketData: async (symbol: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/validation/market-data/${encodeURIComponent(symbol)}`);
    if (!response.ok) throw new Error('Failed to validate market data');
    return response.json();
  },

  // Atomic Execution
  executeAtomicTransaction: async (orders: any[]) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/execution/atomic`, {
      method: 'POST',
      body: JSON.stringify({ orders })
    });
    if (!response.ok) throw new Error('Failed to execute atomic transaction');
    return response.json();
  },

  // Emergency Controls
  getEmergencyStatus: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/emergency/status`);
    if (!response.ok) throw new Error('Failed to fetch emergency status');
    return response.json();
  },

  triggerEmergencyStop: async (params: {
    type: 'SYSTEM' | 'SYMBOL' | 'EXCHANGE' | 'STRATEGY';
    reason: string;
    scope: string[];
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    initiatedBy: string;
  }) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/emergency/stop`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
    if (!response.ok) throw new Error('Failed to trigger emergency stop');
    return response.json();
  },

  checkTradingAllowed: async (symbol?: string, exchange?: string) => {
    const params = new URLSearchParams();
    if (symbol) params.append('symbol', symbol);
    if (exchange) params.append('exchange', exchange);
    
    const response = await authenticatedFetch(`${API_BASE_URL}/emergency/trading-allowed?${params}`);
    if (!response.ok) throw new Error('Failed to check trading status');
    return response.json();
  },

  // Dynamic Position Sizing
  calculatePositionSize: async (params: {
    symbol: string;
    accountBalance: number;
    riskPerTrade: number;
    entryPrice: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    volatility: number;
    marketRegime: 'TRENDING' | 'RANGING' | 'EVENT_DRIVEN' | 'UNKNOWN';
    confidence: number;
    liquidity: number;
    maxPositionSize: number;
    correlationRisk: number;
  }) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/position/calculate-size`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
    if (!response.ok) throw new Error('Failed to calculate position size');
    return response.json();
  },

  getRiskMetrics: async (symbol: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/position/risk-metrics/${encodeURIComponent(symbol)}`);
    if (!response.ok) throw new Error('Failed to fetch risk metrics');
    return response.json();
  },

  updateRiskMetrics: async (symbol: string, tradeOutcome: any) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/position/update-risk-metrics`, {
      method: 'POST',
      body: JSON.stringify({ symbol, tradeOutcome })
    });
    if (!response.ok) throw new Error('Failed to update risk metrics');
    return response.json();
  },

  calculatePortfolioRisk: async (positions: any[]) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/position/portfolio-risk`, {
      method: 'POST',
      body: JSON.stringify({ positions })
    });
    if (!response.ok) throw new Error('Failed to calculate portfolio risk');
    return response.json();
  },

  // Real-time P&L Tracking
  addPosition: async (position: {
    symbol: string;
    side: 'LONG' | 'SHORT';
    size: number;
    entryPrice: number;
    currentPrice: number;
    exchange: string;
    stopLoss?: number;
    takeProfit?: number;
    trailingStop?: any;
  }) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/position/add`, {
      method: 'POST',
      body: JSON.stringify(position)
    });
    if (!response.ok) throw new Error('Failed to add position');
    return response.json();
  },

  updatePosition: async (positionId: string, updates: any) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/position/${positionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update position');
    return response.json();
  },

  closePosition: async (positionId: string, exitPrice: number, reason?: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/position/${positionId}/close`, {
      method: 'POST',
      body: JSON.stringify({ exitPrice, reason })
    });
    if (!response.ok) throw new Error('Failed to close position');
    return response.json();
  },

  getPortfolioPnL: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/position/portfolio-pnl`);
    if (!response.ok) throw new Error('Failed to fetch portfolio P&L');
    return response.json();
  },

  getPosition: async (positionId: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/position/${positionId}`);
    if (!response.ok) throw new Error('Failed to fetch position');
    return response.json();
  },

  getPnLHistory: async (positionId: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/position/${positionId}/pnl-history`);
    if (!response.ok) throw new Error('Failed to fetch P&L history');
    return response.json();
  },

  getAutoCloseRules: async (positionId: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/position/${positionId}/auto-close-rules`);
    if (!response.ok) throw new Error('Failed to fetch auto-close rules');
    return response.json();
  },

  addAutoCloseRule: async (rule: {
    positionId: string;
    type: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP' | 'TIME_BASED' | 'VOLATILITY_BASED';
    condition: any;
    enabled: boolean;
  }) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/position/auto-close-rule`, {
      method: 'POST',
      body: JSON.stringify(rule)
    });
    if (!response.ok) throw new Error('Failed to add auto-close rule');
    return response.json();
  },

  getPositionStats: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/position/stats`);
    if (!response.ok) throw new Error('Failed to fetch position stats');
    return response.json();
  },

  // ===== BACKTESTING SERVICES =====

  // Run backtest
  runBacktest: async (config: any) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/backtesting/run`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Failed to run backtest');
    return response.json();
  },

  // Get backtest results
  getBacktestResults: async (backtestId: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/backtesting/results/${backtestId}`);
    if (!response.ok) throw new Error('Failed to get backtest results');
    return response.json();
  },

  // Get backtest history
  getBacktestHistory: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/backtesting/history`);
    if (!response.ok) throw new Error('Failed to get backtest history');
    return response.json();
  },

  // ===== PAPER TRADING SERVICES =====

  // Create paper trading portfolio
  createPaperPortfolio: async (config: any) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/paper-trading/portfolio`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Failed to create paper portfolio');
    return response.json();
  },

  // Execute paper trade
  executePaperTrade: async (portfolioId: string, signal: any) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/paper-trading/execute`, {
      method: 'POST',
      body: JSON.stringify({ portfolioId, signal })
    });
    if (!response.ok) throw new Error('Failed to execute paper trade');
    return response.json();
  },

  // Get paper portfolio
  getPaperPortfolio: async (portfolioId: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/paper-trading/portfolio/${portfolioId}`);
    if (!response.ok) throw new Error('Failed to get paper portfolio');
    return response.json();
  },

  // Get all paper portfolios
  getAllPaperPortfolios: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/paper-trading/portfolios`);
    if (!response.ok) throw new Error('Failed to get paper portfolios');
    return response.json();
  },

  // ===== LIQUIDITY AGGREGATION SERVICES =====

  // Get liquidity snapshot
  getLiquiditySnapshot: async (symbol: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/liquidity/snapshot/${symbol}`);
    if (!response.ok) throw new Error('Failed to get liquidity snapshot');
    return response.json();
  },

  // Generate smart route
  generateSmartRoute: async (symbol: string, side: 'BUY' | 'SELL', size: number) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/liquidity/route`, {
      method: 'POST',
      body: JSON.stringify({ symbol, side, size })
    });
    if (!response.ok) throw new Error('Failed to generate smart route');
    return response.json();
  },

  // Get liquidity metrics
  getLiquidityMetrics: async (symbol: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/liquidity/metrics/${symbol}`);
    if (!response.ok) throw new Error('Failed to get liquidity metrics');
    return response.json();
  },

  // Get all liquidity sources
  getAllLiquiditySources: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/liquidity/sources`);
    if (!response.ok) throw new Error('Failed to get liquidity sources');
    return response.json();
  },

  // ===== SLIPPAGE PROTECTION SERVICES =====

  // Analyze slippage
  analyzeSlippage: async (symbol: string, side: 'BUY' | 'SELL', size: number) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/slippage/analyze`, {
      method: 'POST',
      body: JSON.stringify({ symbol, side, size })
    });
    if (!response.ok) throw new Error('Failed to analyze slippage');
    return response.json();
  },

  // Create slippage protection
  createSlippageProtection: async (symbol: string, side: 'BUY' | 'SELL', size: number, config?: any) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/slippage/protection`, {
      method: 'POST',
      body: JSON.stringify({ symbol, side, size, config })
    });
    if (!response.ok) throw new Error('Failed to create slippage protection');
    return response.json();
  },

  // Get slippage protection
  getSlippageProtection: async (protectionId: string) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/slippage/protection/${protectionId}`);
    if (!response.ok) throw new Error('Failed to get slippage protection');
    return response.json();
  },

  // Get all slippage protections
  getAllSlippageProtections: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/slippage/protections`);
    if (!response.ok) throw new Error('Failed to get slippage protections');
    return response.json();
  }
};
