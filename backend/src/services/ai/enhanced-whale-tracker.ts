import { logger } from '../../utils/logger';
import axios from 'axios';

export interface WhaleTransaction {
  id: string;
  symbol: string;
  amount: number;
  value: number;
  type: 'BUY' | 'SELL' | 'TRANSFER';
  from: string;
  to: string;
  timestamp: Date;
  exchange?: string;
  confidence: number;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface WhaleAlert {
  id: string;
  symbol: string;
  transaction: WhaleTransaction;
  marketImpact: number;
  pricePrediction: {
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    timeframe: string;
  };
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: Date;
}

export interface WhaleAnalysis {
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  netFlow: number;
  topWhales: WhaleTransaction[];
  recentAlerts: WhaleAlert[];
  marketSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  timestamp: Date;
}

export class EnhancedWhaleTracker {
  private whaleAlertApiKey: string;
  private glassnodeApiKey: string;
  private etherscanApiKey: string;
  private trackedWallets: Set<string>;
  private whaleThresholds: Record<string, number>;

  constructor() {
    this.whaleAlertApiKey = process.env.WHALE_ALERT_API_KEY || '';
    this.glassnodeApiKey = process.env.GLASSNODE_API_KEY || '';
    this.etherscanApiKey = process.env.ETHERSCAN_API_KEY || '';
    
    this.trackedWallets = new Set();
    this.whaleThresholds = {
      'BTC': 100, // 100+ BTC
      'ETH': 1000, // 1000+ ETH
      'BNB': 10000, // 10K+ BNB
      'ADA': 1000000, // 1M+ ADA
      'DOGE': 10000000 // 10M+ DOGE
    };
  }

  async initialize(): Promise<void> {
    logger.info('🐋 Initializing Enhanced Whale Tracker...');
    
    // Load known whale wallets
    await this.loadKnownWhaleWallets();
    
    logger.info('✅ Enhanced Whale Tracker initialized');
  }

  async analyze(symbol: string): Promise<WhaleAnalysis> {
    try {
      logger.info(`🐋 Analyzing whale activity for ${symbol}...`);

      // Collect whale data from multiple sources
      const [whaleTransactions, whaleAlerts, onChainData] = await Promise.all([
        this.fetchWhaleTransactions(symbol),
        this.fetchWhaleAlerts(symbol),
        this.fetchOnChainData(symbol)
      ]);

      // Analyze whale patterns
      const analysis = this.analyzeWhalePatterns(whaleTransactions, whaleAlerts, onChainData, symbol);

      logger.info(`✅ Whale analysis completed: ${analysis.marketSentiment}`);
      return analysis;

    } catch (error) {
      logger.error(`❌ Failed to analyze whale activity for ${symbol}:`, error);
      
      return {
        totalVolume: 0,
        buyVolume: 0,
        sellVolume: 0,
        netFlow: 0,
        topWhales: [],
        recentAlerts: [],
        marketSentiment: 'NEUTRAL',
        confidence: 0,
        timestamp: new Date()
      };
    }
  }

  private async fetchWhaleTransactions(symbol: string): Promise<WhaleTransaction[]> {
    const transactions: WhaleTransaction[] = [];
    
    try {
      // Whale Alert API
      if (this.whaleAlertApiKey) {
        const response = await axios.get('https://api.whale-alert.io/v1/transactions', {
          params: {
            api_key: this.whaleAlertApiKey,
            currency: symbol.replace('/USDT', '').replace('/USD', ''),
            min_value: 500000, // $500K+ transactions
            limit: 50
          }
        });

        transactions.push(...this.parseWhaleAlertResponse(response.data));
      }

      // Glassnode API for on-chain data
      if (this.glassnodeApiKey) {
        const glassnodeData = await this.fetchGlassnodeData(symbol);
        transactions.push(...glassnodeData);
      }

    } catch (error) {
      logger.debug('Whale transactions fetch failed:', error.message);
    }

    return transactions;
  }

  private async fetchWhaleAlerts(symbol: string): Promise<WhaleAlert[]> {
    const alerts: WhaleAlert[] = [];
    
    try {
      // Check for recent large transactions
      const recentTransactions = await this.fetchRecentLargeTransactions(symbol);
      
      for (const transaction of recentTransactions) {
        const alert = await this.createWhaleAlert(transaction, symbol);
        if (alert) {
          alerts.push(alert);
        }
      }

    } catch (error) {
      logger.debug('Whale alerts fetch failed:', error.message);
    }

    return alerts;
  }

  private async fetchOnChainData(symbol: string): Promise<any> {
    try {
      if (symbol.includes('ETH') && this.etherscanApiKey) {
        // Ethereum on-chain data
        const response = await axios.get('https://api.etherscan.io/api', {
          params: {
            module: 'account',
            action: 'txlist',
            address: '0x0000000000000000000000000000000000000000', // Placeholder
            startblock: 0,
            endblock: 99999999,
            page: 1,
            offset: 100,
            sort: 'desc',
            apikey: this.etherscanApiKey
          }
        });

        return response.data;
      }
    } catch (error) {
      logger.debug('On-chain data fetch failed:', error.message);
    }

    return null;
  }

  private parseWhaleAlertResponse(data: any): WhaleTransaction[] {
    return data.transactions?.map((tx: any) => ({
      id: tx.hash,
      symbol: tx.symbol,
      amount: tx.amount,
      value: tx.value_usd,
      type: tx.from?.owner_type === 'exchange' ? 'SELL' : 'BUY',
      from: tx.from?.address || 'unknown',
      to: tx.to?.address || 'unknown',
      timestamp: new Date(tx.timestamp * 1000),
      exchange: tx.from?.owner_type === 'exchange' ? tx.from?.owner : undefined,
      confidence: 0.8,
      impact: tx.value_usd > 10000000 ? 'HIGH' : tx.value_usd > 1000000 ? 'MEDIUM' : 'LOW'
    })) || [];
  }

  private async fetchGlassnodeData(symbol: string): Promise<WhaleTransaction[]> {
    const transactions: WhaleTransaction[] = [];
    
    try {
      if (symbol.includes('BTC')) {
        // Bitcoin whale movements
        const response = await axios.get('https://api.glassnode.com/v1/metrics/market/price_usd_close', {
          params: {
            a: 'BTC',
            api_key: this.glassnodeApiKey
          }
        });

        // Parse Glassnode response and create whale transactions
        // This is simplified - in production, you'd parse actual whale movement data
      }
    } catch (error) {
      logger.debug('Glassnode fetch failed:', error.message);
    }

    return transactions;
  }

  private async fetchRecentLargeTransactions(symbol: string): Promise<WhaleTransaction[]> {
    const transactions: WhaleTransaction[] = [];
    
    try {
      // Simulate recent large transactions based on market data
      // In production, this would fetch from blockchain APIs
      const threshold = this.whaleThresholds[symbol.replace('/USDT', '')] || 1000;
      
      // Mock data for demonstration
      transactions.push({
        id: `mock_${Date.now()}`,
        symbol,
        amount: threshold * 2,
        value: threshold * 2 * 50000, // Mock price
        type: Math.random() > 0.5 ? 'BUY' : 'SELL',
        from: '0x' + Math.random().toString(16).substr(2, 40),
        to: '0x' + Math.random().toString(16).substr(2, 40),
        timestamp: new Date(),
        confidence: 0.7,
        impact: 'MEDIUM'
      });

    } catch (error) {
      logger.debug('Recent transactions fetch failed:', error.message);
    }

    return transactions;
  }

  private async createWhaleAlert(transaction: WhaleTransaction, symbol: string): Promise<WhaleAlert | null> {
    try {
      // Calculate market impact
      const marketImpact = this.calculateMarketImpact(transaction, symbol);
      
      // Predict price direction
      const pricePrediction = this.predictPriceDirection(transaction, symbol);
      
      // Determine urgency
      const urgency = this.determineUrgency(transaction, marketImpact);

      return {
        id: `alert_${transaction.id}`,
        symbol,
        transaction,
        marketImpact,
        pricePrediction,
        urgency,
        timestamp: new Date()
      };

    } catch (error) {
      logger.debug('Whale alert creation failed:', error.message);
      return null;
    }
  }

  private analyzeWhalePatterns(
    transactions: WhaleTransaction[],
    alerts: WhaleAlert[],
    onChainData: any,
    symbol: string
  ): WhaleAnalysis {
    
    // Calculate volumes
    const totalVolume = transactions.reduce((sum, tx) => sum + tx.value, 0);
    const buyVolume = transactions
      .filter(tx => tx.type === 'BUY')
      .reduce((sum, tx) => sum + tx.value, 0);
    const sellVolume = transactions
      .filter(tx => tx.type === 'SELL')
      .reduce((sum, tx) => sum + tx.value, 0);
    
    const netFlow = buyVolume - sellVolume;
    
    // Get top whales (largest transactions)
    const topWhales = transactions
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    
    // Determine market sentiment
    const marketSentiment = this.determineMarketSentiment(netFlow, transactions, alerts);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(transactions.length, alerts.length);

    return {
      totalVolume,
      buyVolume,
      sellVolume,
      netFlow,
      topWhales,
      recentAlerts: alerts.slice(0, 5), // Top 5 recent alerts
      marketSentiment,
      confidence,
      timestamp: new Date()
    };
  }

  private calculateMarketImpact(transaction: WhaleTransaction, symbol: string): number {
    // Calculate impact based on transaction size relative to market cap
    const marketCap = this.getEstimatedMarketCap(symbol);
    const impactRatio = transaction.value / marketCap;
    
    // Normalize impact (0-1 scale)
    return Math.min(1, impactRatio * 1000000); // Scale factor
  }

  private predictPriceDirection(transaction: WhaleTransaction, symbol: string): {
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    timeframe: string;
  } {
    let direction: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 0.5;
    
    // Simple prediction based on transaction type and size
    if (transaction.type === 'BUY' && transaction.value > 1000000) {
      direction = 'UP';
      confidence = Math.min(0.8, 0.5 + (transaction.value / 10000000));
    } else if (transaction.type === 'SELL' && transaction.value > 1000000) {
      direction = 'DOWN';
      confidence = Math.min(0.8, 0.5 + (transaction.value / 10000000));
    }

    return {
      direction,
      confidence,
      timeframe: '1-4 hours'
    };
  }

  private determineUrgency(transaction: WhaleTransaction, marketImpact: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    if (transaction.value > 50000000 && marketImpact > 0.1) return 'CRITICAL';
    if (transaction.value > 10000000 && marketImpact > 0.05) return 'HIGH';
    if (transaction.value > 1000000) return 'MEDIUM';
    return 'LOW';
  }

  private determineMarketSentiment(
    netFlow: number,
    transactions: WhaleTransaction[],
    alerts: WhaleAlert[]
  ): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    
    // Analyze net flow
    if (netFlow > 10000000) return 'BULLISH';
    if (netFlow < -10000000) return 'BEARISH';
    
    // Analyze recent alerts
    const bullishAlerts = alerts.filter(a => a.pricePrediction.direction === 'UP').length;
    const bearishAlerts = alerts.filter(a => a.pricePrediction.direction === 'DOWN').length;
    
    if (bullishAlerts > bearishAlerts * 1.5) return 'BULLISH';
    if (bearishAlerts > bullishAlerts * 1.5) return 'BEARISH';
    
    return 'NEUTRAL';
  }

  private calculateConfidence(transactionCount: number, alertCount: number): number {
    // More data = higher confidence
    const dataScore = Math.min(1, (transactionCount + alertCount) / 20);
    return dataScore;
  }

  private getEstimatedMarketCap(symbol: string): number {
    // Estimated market caps (simplified)
    const marketCaps: Record<string, number> = {
      'BTC': 800000000000, // $800B
      'ETH': 300000000000, // $300B
      'BNB': 50000000000,  // $50B
      'ADA': 20000000000,  // $20B
      'DOGE': 10000000000  // $10B
    };

    return marketCaps[symbol.replace('/USDT', '')] || 1000000000; // Default $1B
  }

  private async loadKnownWhaleWallets(): Promise<void> {
    // Load known whale wallet addresses
    const knownWhales = [
      '0x28C6c06298d514Db089934071355E5743bf21d60', // Binance 14
      '0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549', // Binance 15
      '0x56Eddb7aa87536c09CCc2793473599fD21A8b17F', // Binance 16
      '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // Uniswap
      '0x6B175474E89094C44Da98b954EedeAC495271d0F'  // DAI
    ];

    knownWhales.forEach(wallet => this.trackedWallets.add(wallet));
    
    logger.info(`🐋 Loaded ${this.trackedWallets.size} known whale wallets`);
  }

  // Public methods for external use
  async getWhaleAlerts(symbol: string, limit: number = 10): Promise<WhaleAlert[]> {
    const analysis = await this.analyze(symbol);
    return analysis.recentAlerts.slice(0, limit);
  }

  async getTopWhales(symbol: string, limit: number = 10): Promise<WhaleTransaction[]> {
    const analysis = await this.analyze(symbol);
    return analysis.topWhales.slice(0, limit);
  }

  async getMarketSentiment(symbol: string): Promise<'BULLISH' | 'BEARISH' | 'NEUTRAL'> {
    const analysis = await this.analyze(symbol);
    return analysis.marketSentiment;
  }
}
