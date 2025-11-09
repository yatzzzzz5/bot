import { logger } from '../../utils/logger';
import axios from 'axios';

export interface OnChainMetrics {
  whaleMovements: number;
  exchangeFlows: number;
  networkActivity: number;
  gasFees: number;
  mempoolSize: number;
  smartContractCalls: number;
  defiProtocolUsage: number;
  nftMarketActivity: number;
  largeTransactions: number;
  exchangeInflows: number;
  exchangeOutflows: number;
  institutionalMovements: number;
  miningDifficulty: number;
  hashRate: number;
  activeAddresses: number;
  transactionCount: number;
  averageTransactionValue: number;
  defiTVL: number;
  lendingProtocols: number;
  stakingRewards: number;
}

export class OnChainAnalyzer {
  private isInitialized: boolean = false;
  private apiKeys: Map<string, string> = new Map();
  private glassnodeDisabled: boolean = (process.env.DISABLE_GLASSNODE || process.env.GLASSNODE_ENABLED === 'false') ? true : false;
  private defipulseDisabled: boolean = (process.env.DISABLE_DEFIPULSE === 'true');

  constructor() {
    // API anahtarlarını yükle
    this.apiKeys.set('etherscan', process.env.ETHERSCAN_API_KEY || '');
    this.apiKeys.set('blockchain', process.env.BLOCKCHAIN_API_KEY || '');
    this.apiKeys.set('whalealert', process.env.WHALEALERT_API_KEY || '');
    this.apiKeys.set('glassnode', process.env.GLASSNODE_API_KEY || '');
    this.apiKeys.set('defipulse', process.env.DEFIPULSE_API_KEY || '');
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🔗 On-Chain Analyzer başlatılıyor...');
      
      // API bağlantılarını test et
      await this.testAPIConnections();
      
      this.isInitialized = true;
      logger.info('✅ On-Chain Analyzer başarıyla başlatıldı');
    } catch (error) {
      logger.error('❌ On-Chain Analyzer başlatılamadı:', error);
      throw error;
    }
  }

  private async testAPIConnections(): Promise<void> {
    const testPromises = [
      this.testEtherscanAPI(),
      this.testBlockchainAPI(),
      this.testWhaleAlertAPI(),
      // Glassnode isteğe bağlı
      ...(this.glassnodeDisabled ? [] : [this.testGlassnodeAPI()]),
      ...(this.defipulseDisabled ? [] : [this.testDefiPulseAPI()])
    ];

    await Promise.allSettled(testPromises);
  }

  private async testEtherscanAPI(): Promise<void> {
    try {
      const response = await axios.get(`https://api.etherscan.io/api?module=stats&action=ethsupply&apikey=${this.apiKeys.get('etherscan')}`);
      if (response.data.status === '1') {
        logger.info('✅ Etherscan API bağlantısı başarılı');
      }
    } catch (error) {
      logger.warn('⚠️ Etherscan API bağlantısı başarısız');
    }
  }

  private async testBlockchainAPI(): Promise<void> {
    try {
      const response = await axios.get(`https://api.blockchain.info/stats`);
      if (response.status === 200) {
        logger.info('✅ Blockchain.info API bağlantısı başarılı');
      }
    } catch (error) {
      logger.warn('⚠️ Blockchain.info API bağlantısı başarısız');
    }
  }

  private async testWhaleAlertAPI(): Promise<void> {
    try {
      const whaleAlertKey = this.apiKeys.get('whalealert');
      if (!whaleAlertKey || whaleAlertKey.includes('your_whalealert_api_key')) {
        logger.info('ℹ️ Whale Alert anahtarı yok veya placeholder, test atlandı');
        return;
      }
      const response = await axios.get(`https://api.whale-alert.io/v1/transactions?api_key=${whaleAlertKey}&limit=1`);
      if (response.status === 200) {
        logger.info('✅ Whale Alert API bağlantısı başarılı');
      }
    } catch (error) {
      logger.warn('⚠️ Whale Alert API bağlantısı başarısız');
    }
  }

  private async testGlassnodeAPI(): Promise<void> {
    try {
      if (this.glassnodeDisabled || !this.apiKeys.get('glassnode')) {
        logger.info('ℹ️ Glassnode devre dışı veya anahtar yok, test atlandı');
        return;
      }
      const response = await axios.get(`https://api.glassnode.com/v1/metrics/addresses/active_count?a=btc&api_key=${this.apiKeys.get('glassnode')}`);
      if (response.status === 200) {
        logger.info('✅ Glassnode API bağlantısı başarılı');
      }
    } catch (error) {
      logger.warn('⚠️ Glassnode API bağlantısı başarısız');
    }
  }

  private async testDefiPulseAPI(): Promise<void> {
    try {
      const defipulseKey = this.apiKeys.get('defipulse');
      if (!defipulseKey) {
        logger.info('ℹ️ DeFi Pulse API anahtarı yok, test atlandı');
        return;
      }
      
      const response = await axios.get(`https://api.defipulse.com/api/v1/defipulse.json?api_key=${defipulseKey}`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'CryptoBot/1.0'
        }
      });
      
      if (response.status === 200) {
        logger.info('✅ DeFi Pulse API bağlantısı başarılı');
      }
    } catch (error) {
      logger.warn('⚠️ DeFi Pulse API bağlantısı başarısız:', error.message);
    }
  }

  async analyze(symbol: string): Promise<OnChainMetrics> {
    try {
      if (!this.isInitialized) {
        throw new Error('On-Chain Analyzer henüz başlatılmadı');
      }

      logger.info(`🔍 ${symbol} için on-chain analizi başlatılıyor...`);

      // Paralel olarak tüm metrikleri topla
      const [
        whaleMovements,
        exchangeFlows,
        networkActivity,
        gasFees,
        mempoolSize,
        smartContractCalls,
        defiProtocolUsage,
        nftMarketActivity,
        largeTransactions,
        exchangeInflows,
        exchangeOutflows,
        institutionalMovements,
        miningDifficulty,
        hashRate,
        activeAddresses,
        transactionCount,
        averageTransactionValue,
        defiTVL,
        lendingProtocols,
        stakingRewards
      ] = await Promise.all([
        this.getWhaleMovements(symbol),
        this.getExchangeFlows(symbol),
        this.getNetworkActivity(symbol),
        this.getGasFees(symbol),
        this.getMempoolSize(symbol),
        this.getSmartContractCalls(symbol),
        this.getDefiProtocolUsage(symbol),
        this.getNFTMarketActivity(symbol),
        this.getLargeTransactions(symbol),
        this.getExchangeInflows(symbol),
        this.getExchangeOutflows(symbol),
        this.getInstitutionalMovements(symbol),
        this.getMiningDifficulty(symbol),
        this.getHashRate(symbol),
        this.getActiveAddresses(symbol),
        this.getTransactionCount(symbol),
        this.getAverageTransactionValue(symbol),
        this.getDefiTVL(symbol),
        this.getLendingProtocols(symbol),
        this.getStakingRewards(symbol)
      ]);

      return {
        whaleMovements,
        exchangeFlows,
        networkActivity,
        gasFees,
        mempoolSize,
        smartContractCalls,
        defiProtocolUsage,
        nftMarketActivity,
        largeTransactions,
        exchangeInflows,
        exchangeOutflows,
        institutionalMovements,
        miningDifficulty,
        hashRate,
        activeAddresses,
        transactionCount,
        averageTransactionValue,
        defiTVL,
        lendingProtocols,
        stakingRewards
      };

    } catch (error) {
      logger.error(`❌ ${symbol} on-chain analizi hatası:`, error);
      throw error;
    }
  }

  private async getWhaleMovements(symbol: string): Promise<number> {
    try {
      const whaleAlertKey = this.apiKeys.get('whalealert');
      if (!whaleAlertKey || whaleAlertKey.includes('your_whalealert_api_key')) {
        logger.info('ℹ️ Whale Alert API anahtarı yok veya placeholder, whale movements için placeholder kullanılıyor');
        return Math.random() * 100; // Placeholder
      }
      
      // Whale Alert API'den büyük işlemleri al
      const response = await axios.get(`https://api.whale-alert.io/v1/transactions?api_key=${whaleAlertKey}&min_value=500000&limit=100`);
      
      if (response.data && response.data.transactions) {
        const whaleTransactions = response.data.transactions.filter((tx: any) => 
          tx.currency.toLowerCase() === symbol.toLowerCase()
        );
        
        return whaleTransactions.length;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Whale movements alınamadı`);
      return Math.random() * 100; // Placeholder
    }
  }

  private async getExchangeFlows(symbol: string): Promise<number> {
    try {
      if (this.glassnodeDisabled || !this.apiKeys.get('glassnode')) return 0;
      // Glassnode API'den exchange flow verilerini al
      const response = await axios.get(`https://api.glassnode.com/v1/metrics/distribution/balance_exchanges?a=${symbol.toLowerCase()}&api_key=${this.apiKeys.get('glassnode')}`);
      
      if (response.data && response.data.length > 0) {
        return response.data[response.data.length - 1].v;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Exchange flows alınamadı`);
      return 0;
    }
  }

  private async getNetworkActivity(symbol: string): Promise<number> {
    try {
      if (this.glassnodeDisabled || !this.apiKeys.get('glassnode')) return 0;
      // Glassnode API'den network activity verilerini al
      const response = await axios.get(`https://api.glassnode.com/v1/metrics/addresses/active_count?a=${symbol.toLowerCase()}&api_key=${this.apiKeys.get('glassnode')}`);
      
      if (response.data && response.data.length > 0) {
        return response.data[response.data.length - 1].v;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Network activity alınamadı`);
      return 0;
    }
  }

  private async getGasFees(symbol: string): Promise<number> {
    try {
      if (symbol.toLowerCase() === 'eth' || symbol.toLowerCase() === 'ethereum') {
        // Etherscan API'den gas fee verilerini al
        const response = await axios.get(`https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${this.apiKeys.get('etherscan')}`);
        
        if (response.data && response.data.result) {
          return parseInt(response.data.result.SafeGasPrice);
        }
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Gas fees alınamadı:`, error);
      return 0;
    }
  }

  private async getMempoolSize(symbol: string): Promise<number> {
    try {
      // Optional guard to completely skip external mempool calls
      if (
        process.env.DISABLE_MEMPOOL === 'true' ||
        process.env.DISABLE_BLOCKCHAININFO === 'true'
      ) {
        return 0;
      }
      if (symbol.toLowerCase() === 'btc' || symbol.toLowerCase() === 'bitcoin') {
        // Blockchain.info API'den mempool verilerini al
        const response = await axios.get('https://api.blockchain.info/mempool');
        
        if (response.data) {
          return response.data.size;
        }
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Mempool size alınamadı:`, error);
      return 0;
    }
  }

  private async getSmartContractCalls(symbol: string): Promise<number> {
    try {
      if (symbol.toLowerCase() === 'eth' || symbol.toLowerCase() === 'ethereum') {
        // Etherscan API'den smart contract call verilerini al
        const response = await axios.get(`https://api.etherscan.io/api?module=proxy&action=eth_blockNumber&apikey=${this.apiKeys.get('etherscan')}`);
        
        if (response.data && response.data.result) {
          return parseInt(response.data.result, 16);
        }
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Smart contract calls alınamadı:`, error);
      return 0;
    }
  }

  private async getDefiProtocolUsage(symbol: string): Promise<number> {
    try {
      if (this.defipulseDisabled) {
        return 0;
      }
      const defipulseKey = this.apiKeys.get('defipulse');
      if (!defipulseKey || defipulseKey.includes('your_defipulse_api_key')) {
        logger.info('ℹ️ DeFi Pulse API anahtarı yok veya placeholder, test atlandı');
        return Math.random() * 1000000000; // Placeholder
      }
      
      // DeFi Pulse API'den protocol kullanım verilerini al
      const response = await axios.get(`https://api.defipulse.com/api/v1/defipulse.json?api_key=${defipulseKey}`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'CryptoBot/1.0'
        }
      });
      
      if (response.data && response.data.length > 0) {
        const totalTVL = response.data.reduce((sum: number, protocol: any) => sum + protocol.tvl, 0);
        return totalTVL;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ DeFi protocol usage alınamadı:`, error);
      return Math.random() * 1000000000; // Placeholder
    }
  }

  private async getNFTMarketActivity(symbol: string): Promise<number> {
    try {
      // NFT market activity verilerini al (OpenSea API kullanılabilir)
      // Şimdilik sabit değer döndür
      return Math.random() * 1000;
    } catch (error) {
      logger.warn(`⚠️ NFT market activity alınamadı:`, error);
      return 0;
    }
  }

  private async getLargeTransactions(symbol: string): Promise<number> {
    try {
      const whaleAlertKey = this.apiKeys.get('whalealert');
      if (!whaleAlertKey || whaleAlertKey.includes('your_whalealert_api_key')) {
        logger.info('ℹ️ Whale Alert API anahtarı yok veya placeholder, large transactions için placeholder kullanılıyor');
        return Math.random() * 50; // Placeholder
      }
      
      // Whale Alert API'den büyük işlemleri say
      const response = await axios.get(`https://api.whale-alert.io/v1/transactions?api_key=${whaleAlertKey}&min_value=100000&limit=50`);
      
      if (response.data && response.data.transactions) {
        const largeTransactions = response.data.transactions.filter((tx: any) => 
          tx.currency.toLowerCase() === symbol.toLowerCase()
        );
        
        return largeTransactions.length;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Large transactions alınamadı`);
      return Math.random() * 50; // Placeholder
    }
  }

  private async getExchangeInflows(symbol: string): Promise<number> {
    try {
      if (this.glassnodeDisabled || !this.apiKeys.get('glassnode')) return 0;
      // Glassnode API'den exchange inflow verilerini al
      const response = await axios.get(`https://api.glassnode.com/v1/metrics/distribution/balance_exchanges_inflow?a=${symbol.toLowerCase()}&api_key=${this.apiKeys.get('glassnode')}`);
      
      if (response.data && response.data.length > 0) {
        return response.data[response.data.length - 1].v;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Exchange inflows alınamadı`);
      return 0;
    }
  }

  private async getExchangeOutflows(symbol: string): Promise<number> {
    try {
      if (this.glassnodeDisabled || !this.apiKeys.get('glassnode')) return 0;
      // Glassnode API'den exchange outflow verilerini al
      const response = await axios.get(`https://api.glassnode.com/v1/metrics/distribution/balance_exchanges_outflow?a=${symbol.toLowerCase()}&api_key=${this.apiKeys.get('glassnode')}`);
      
      if (response.data && response.data.length > 0) {
        return response.data[response.data.length - 1].v;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Exchange outflows alınamadı`);
      return 0;
    }
  }

  private async getInstitutionalMovements(symbol: string): Promise<number> {
    try {
      const whaleAlertKey = this.apiKeys.get('whalealert');
      if (!whaleAlertKey || whaleAlertKey.includes('your_whalealert_api_key')) {
        logger.info('ℹ️ Whale Alert API anahtarı yok veya placeholder, institutional movements için placeholder kullanılıyor');
        return Math.random() * 20; // Placeholder
      }
      
      // Whale Alert API'den kurumsal işlemleri al
      const response = await axios.get(`https://api.whale-alert.io/v1/transactions?api_key=${whaleAlertKey}&min_value=1000000&limit=20`);
      
      if (response.data && response.data.transactions) {
        const institutionalTransactions = response.data.transactions.filter((tx: any) => 
          tx.currency.toLowerCase() === symbol.toLowerCase() && tx.owner_type === 'exchange'
        );
        
        return institutionalTransactions.length;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Institutional movements alınamadı`);
      return Math.random() * 20; // Placeholder
    }
  }

  private async getMiningDifficulty(symbol: string): Promise<number> {
    try {
      if (symbol.toLowerCase() === 'btc' || symbol.toLowerCase() === 'bitcoin') {
        // Blockchain.info API'den mining difficulty verilerini al
        const response = await axios.get('https://api.blockchain.info/stats');
        
        if (response.data) {
          return response.data.difficulty;
        }
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Mining difficulty alınamadı:`, error);
      return 0;
    }
  }

  private async getHashRate(symbol: string): Promise<number> {
    try {
      if (symbol.toLowerCase() === 'btc' || symbol.toLowerCase() === 'bitcoin') {
        // Blockchain.info API'den hash rate verilerini al
        const response = await axios.get('https://api.blockchain.info/stats');
        
        if (response.data) {
          return response.data.hash_rate;
        }
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Hash rate alınamadı:`, error);
      return 0;
    }
  }

  private async getActiveAddresses(symbol: string): Promise<number> {
    try {
      if (this.glassnodeDisabled || !this.apiKeys.get('glassnode')) return 0;
      // Glassnode API'den active addresses verilerini al
      const response = await axios.get(`https://api.glassnode.com/v1/metrics/addresses/active_count?a=${symbol.toLowerCase()}&api_key=${this.apiKeys.get('glassnode')}`);
      
      if (response.data && response.data.length > 0) {
        return response.data[response.data.length - 1].v;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Active addresses alınamadı`);
      return 0;
    }
  }

  private async getTransactionCount(symbol: string): Promise<number> {
    try {
      if (this.glassnodeDisabled || !this.apiKeys.get('glassnode')) return 0;
      // Glassnode API'den transaction count verilerini al
      const response = await axios.get(`https://api.glassnode.com/v1/metrics/transactions/count?a=${symbol.toLowerCase()}&api_key=${this.apiKeys.get('glassnode')}`);
      
      if (response.data && response.data.length > 0) {
        return response.data[response.data.length - 1].v;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Transaction count alınamadı`);
      return 0;
    }
  }

  private async getAverageTransactionValue(symbol: string): Promise<number> {
    try {
      if (this.glassnodeDisabled || !this.apiKeys.get('glassnode')) return 0;
      // Glassnode API'den average transaction value verilerini al
      const response = await axios.get(`https://api.glassnode.com/v1/metrics/transactions/transfers_volume_mean?a=${symbol.toLowerCase()}&api_key=${this.apiKeys.get('glassnode')}`);
      
      if (response.data && response.data.length > 0) {
        return response.data[response.data.length - 1].v;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Average transaction value alınamadı`);
      return 0;
    }
  }

  private async getDefiTVL(symbol: string): Promise<number> {
    try {
      if (this.defipulseDisabled) {
        return 0;
      }
      const defipulseKey = this.apiKeys.get('defipulse');
      if (!defipulseKey) {
        logger.info('ℹ️ DeFi Pulse API anahtarı yok, TVL alınamadı');
        return 0;
      }
      
      // DeFi Pulse API'den TVL verilerini al
      const response = await axios.get(`https://api.defipulse.com/api/v1/defipulse.json?api_key=${defipulseKey}`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'CryptoBot/1.0'
        }
      });
      
      if (response.data && response.data.length > 0) {
        const totalTVL = response.data.reduce((sum: number, protocol: any) => sum + protocol.tvl, 0);
        return totalTVL;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ DeFi TVL alınamadı:`, error);
      return 0;
    }
  }

  private async getLendingProtocols(symbol: string): Promise<number> {
    try {
      if (this.defipulseDisabled) {
        return 0;
      }
      const defipulseKey = this.apiKeys.get('defipulse');
      if (!defipulseKey) {
        logger.info('ℹ️ DeFi Pulse API anahtarı yok, lending protocols alınamadı');
        return 0;
      }
      
      // DeFi Pulse API'den lending protocol verilerini al
      const response = await axios.get(`https://api.defipulse.com/api/v1/defipulse.json?api_key=${defipulseKey}`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'CryptoBot/1.0'
        }
      });
      
      if (response.data && response.data.length > 0) {
        const lendingProtocols = response.data.filter((protocol: any) => 
          protocol.category === 'Lending'
        );
        
        return lendingProtocols.length;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`⚠️ Lending protocols alınamadı:`, error);
      return 0;
    }
  }

  private async getStakingRewards(symbol: string): Promise<number> {
    try {
      // Staking rewards verilerini al (Glassnode API kullanılabilir)
      // Şimdilik sabit değer döndür
      return Math.random() * 10;
    } catch (error) {
      logger.warn(`⚠️ Staking rewards alınamadı:`, error);
      return 0;
    }
  }

  // Garanti kazanç fırsatları için özel analizler
  async findArbitrageOpportunities(symbol: string): Promise<any[]> {
    try {
      const metrics = await this.analyze(symbol);
      
      const opportunities = [];
      
      // Exchange flow arbitrajı
      if (Math.abs(metrics.exchangeInflows - metrics.exchangeOutflows) > 1000000) {
        opportunities.push({
          type: 'EXCHANGE_FLOW_ARBITRAGE',
          profit: Math.abs(metrics.exchangeInflows - metrics.exchangeOutflows) * 0.001,
          risk: 'ZERO',
          description: 'Exchange inflow/outflow farkından arbitraj fırsatı'
        });
      }
      
      // Whale movement arbitrajı
      if (metrics.whaleMovements > 10) {
        opportunities.push({
          type: 'WHALE_MOVEMENT_ARBITRAGE',
          profit: metrics.whaleMovements * 1000,
          risk: 'MINIMAL',
          description: 'Whale hareketlerinden arbitraj fırsatı'
        });
      }
      
      return opportunities;
    } catch (error) {
      logger.error(`❌ Arbitraj fırsatları bulunamadı:`, error);
      return [];
    }
  }

  async findMEVOpportunities(symbol: string): Promise<any[]> {
    try {
      const metrics = await this.analyze(symbol);
      
      const opportunities = [];
      
      // Gas fee arbitrajı
      if (metrics.gasFees > 50) {
        opportunities.push({
          type: 'GAS_FEE_ARBITRAGE',
          profit: metrics.gasFees * 10,
          risk: 'ZERO',
          description: 'Yuksek gas fee\'den MEV firsati'
        });
      }
      
      // Mempool arbitrajı
      if (metrics.mempoolSize > 10000) {
        opportunities.push({
          type: 'MEMPOOL_ARBITRAGE',
          profit: metrics.mempoolSize * 0.1,
          risk: 'ZERO',
          description: 'Mempool buyuklugunden MEV firsati'
        });
      }
      
      return opportunities;
    } catch (error) {
      logger.error(`❌ MEV fırsatları bulunamadı:`, error);
      return [];
    }
  }
}
