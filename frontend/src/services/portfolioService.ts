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
  
  if (response.status === 401) {
    localStorage.removeItem('authToken');
  }
  
  return response;
};

export const portfolioService = {
  // Get portfolio summary
  getPortfolio: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/portfolio`);
    if (!response.ok) throw new Error('Failed to fetch portfolio');
    return response.json();
  },

  // Get performance metrics (GP performance endpoint)
  getPerformance: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/guaranteed-profit/performance`);
    if (!response.ok) throw new Error('Failed to fetch performance');
    return response.json();
  },

  // Get risk metrics (position service)
  getRiskMetrics: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/position/risk-metrics/BTC`);
    if (!response.ok) throw new Error('Failed to fetch risk metrics');
    return response.json();
  },

  // Get portfolio positions (from GP portfolio route)
  getPositions: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/guaranteed-profit/portfolio`);
    if (!response.ok) throw new Error('Failed to fetch positions');
    const data = await response.json();
    return data.positions || [];
  },

  // Get portfolio history (reuse performance for now)
  getPortfolioHistory: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/guaranteed-profit/performance`);
    if (!response.ok) throw new Error('Failed to fetch portfolio history');
    return response.json();
  }
};
