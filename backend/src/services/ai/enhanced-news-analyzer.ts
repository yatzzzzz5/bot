import { logger } from '../../utils/logger';
import axios from 'axios';
import Sentiment from 'sentiment';

export interface NewsArticle {
  title: string;
  content: string;
  source: string;
  publishedAt: Date;
  url: string;
  sentiment: number;
  relevance: number;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface EnhancedNewsAnalysis {
  score: number; // -1 to 1
  confidence: number; // 0 to 1
  articles: NewsArticle[];
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  trendingTopics: string[];
  marketImpact: number; // 0 to 1
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: Date;
}

export class EnhancedNewsAnalyzer {
  private sentiment: Sentiment;
  private newsApiKey: string;
  private cryptoNewsApiKey: string;
  private coinTelegraphApiKey: string;
  private cryptoKeywords: string[];

  constructor() {
    this.sentiment = new Sentiment();
    this.newsApiKey = process.env.NEWS_API_KEY || '';
    this.cryptoNewsApiKey = process.env.CRYPTO_NEWS_API_KEY || '';
    this.coinTelegraphApiKey = process.env.COINTELEGRAPH_API_KEY || '';
    
    this.cryptoKeywords = [
      'bitcoin', 'btc', 'ethereum', 'eth', 'cryptocurrency', 'crypto',
      'blockchain', 'defi', 'nft', 'binance', 'coinbase', 'regulation',
      'sec', 'fed', 'inflation', 'adoption', 'institutional', 'whale',
      'mining', 'staking', 'yield', 'liquidity', 'trading', 'market'
    ];
  }

  async initialize(): Promise<void> {
    logger.info('📰 Initializing Enhanced News Analyzer...');
    
    if (!this.newsApiKey) {
      logger.debug('ℹ️ News API key not provided - using free sources only');
    }
    
    logger.info('✅ Enhanced News Analyzer initialized');
  }

  async analyze(symbol: string): Promise<EnhancedNewsAnalysis> {
    try {
      logger.info(`📰 Analyzing news for ${symbol}...`);

      // Collect news from multiple sources
      const [newsArticles, cryptoNews, coinTelegraphNews] = await Promise.all([
        this.fetchGeneralNews(symbol),
        this.fetchCryptoNews(symbol),
        this.fetchCoinTelegraphNews(symbol)
      ]);

      // Combine and deduplicate articles
      const allArticles = this.combineAndDeduplicateArticles([
        ...newsArticles,
        ...cryptoNews,
        ...coinTelegraphNews
      ]);

      // Analyze sentiment and impact
      const analyzedArticles = await this.analyzeArticles(allArticles, symbol);
      
      // Calculate overall sentiment
      const sentimentScore = this.calculateSentimentScore(analyzedArticles);
      
      // Extract trending topics
      const trendingTopics = this.extractTrendingTopics(analyzedArticles);
      
      // Assess market impact
      const marketImpact = this.assessMarketImpact(analyzedArticles, symbol);
      
      // Determine urgency
      const urgency = this.determineUrgency(analyzedArticles);

      const analysis: EnhancedNewsAnalysis = {
        score: sentimentScore.score,
        confidence: sentimentScore.confidence,
        articles: analyzedArticles,
        sentiment: sentimentScore.sentiment,
        trendingTopics,
        marketImpact,
        urgency,
        timestamp: new Date()
      };

      logger.info(`✅ News analysis completed: ${analysis.sentiment} (${analysis.score.toFixed(3)})`);
      return analysis;

    } catch (error) {
      logger.error(`❌ Failed to analyze news for ${symbol}:`, error);
      
      return {
        score: 0,
        confidence: 0,
        articles: [],
        sentiment: 'NEUTRAL',
        trendingTopics: [],
        marketImpact: 0,
        urgency: 'LOW',
        timestamp: new Date()
      };
    }
  }

  private async fetchGeneralNews(symbol: string): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];
    
    try {
      if (this.newsApiKey) {
        const response = await axios.get('https://newsapi.org/v2/everything', {
          params: {
            q: `${symbol} OR ${this.getSymbolKeywords(symbol)}`,
            apiKey: this.newsApiKey,
            language: 'en',
            sortBy: 'publishedAt',
            pageSize: 20,
            from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          }
        });

        articles.push(...this.parseNewsApiResponse(response.data));
      }
    } catch (error) {
      logger.debug('General news fetch failed:', error.message);
    }

    return articles;
  }

  private async fetchCryptoNews(symbol: string): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];
    
    try {
      // CryptoPanic API (free)
      const response = await axios.get('https://cryptopanic.com/api/v1/posts/', {
        params: {
          auth_token: this.cryptoNewsApiKey || 'free',
          currencies: symbol.replace('/USDT', '').replace('/USD', ''),
          public: true,
          filter: 'hot',
          kind: 'news'
        }
      });

      articles.push(...this.parseCryptoPanicResponse(response.data));
    } catch (error) {
      logger.debug('Crypto news fetch failed:', error.message);
    }

    return articles;
  }

  private async fetchCoinTelegraphNews(symbol: string): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];
    
    try {
      // CoinTelegraph RSS feed
      const response = await axios.get('https://cointelegraph.com/rss');
      articles.push(...this.parseRSSResponse(response.data, symbol));
    } catch (error) {
      logger.debug('CoinTelegraph fetch failed:', error.message);
    }

    return articles;
  }

  private parseNewsApiResponse(data: any): NewsArticle[] {
    return data.articles?.map((article: any) => ({
      title: article.title,
      content: article.description || article.content,
      source: article.source.name,
      publishedAt: new Date(article.publishedAt),
      url: article.url,
      sentiment: 0, // Will be calculated later
      relevance: 0, // Will be calculated later
      impact: 'MEDIUM' as const
    })) || [];
  }

  private parseCryptoPanicResponse(data: any): NewsArticle[] {
    return data.results?.map((post: any) => ({
      title: post.title,
      content: post.metadata?.description || post.title,
      source: post.source?.title || 'CryptoPanic',
      publishedAt: new Date(post.published_at),
      url: post.url,
      sentiment: 0,
      relevance: 0,
      impact: 'MEDIUM' as const
    })) || [];
  }

  private parseRSSResponse(data: string, symbol: string): NewsArticle[] {
    // Simple RSS parsing (in production, use proper RSS parser)
    const articles: NewsArticle[] = [];
    
    try {
      const items = data.match(/<item>[\s\S]*?<\/item>/g) || [];
      
      for (const item of items.slice(0, 10)) { // Limit to 10 articles
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
        
        if (titleMatch && linkMatch) {
          articles.push({
            title: titleMatch[1],
            content: titleMatch[1], // Use title as content for RSS
            source: 'CoinTelegraph',
            publishedAt: pubDateMatch ? new Date(pubDateMatch[1]) : new Date(),
            url: linkMatch[1],
            sentiment: 0,
            relevance: 0,
            impact: 'MEDIUM' as const
          });
        }
      }
    } catch (error) {
      logger.debug('RSS parsing failed:', error.message);
    }

    return articles;
  }

  private combineAndDeduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
    const seen = new Set<string>();
    const unique: NewsArticle[] = [];

    for (const article of articles) {
      const key = `${article.title.toLowerCase()}-${article.source}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(article);
      }
    }

    return unique.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }

  private async analyzeArticles(articles: NewsArticle[], symbol: string): Promise<NewsArticle[]> {
    return articles.map(article => {
      // Calculate sentiment
      const sentimentResult = this.sentiment.analyze(`${article.title} ${article.content}`);
      article.sentiment = sentimentResult.score / 10; // Normalize to -1 to 1

      // Calculate relevance
      article.relevance = this.calculateRelevance(article, symbol);

      // Determine impact
      article.impact = this.determineImpact(article);

      return article;
    });
  }

  private calculateRelevance(article: NewsArticle, symbol: string): number {
    const text = `${article.title} ${article.content}`.toLowerCase();
    const symbolLower = symbol.toLowerCase();
    
    let relevance = 0;
    
    // Direct symbol mention
    if (text.includes(symbolLower)) relevance += 0.8;
    
    // Related keywords
    const relatedKeywords = this.getSymbolKeywords(symbol);
    for (const keyword of relatedKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        relevance += 0.3;
      }
    }
    
    // Crypto keywords
    for (const keyword of this.cryptoKeywords) {
      if (text.includes(keyword)) {
        relevance += 0.1;
      }
    }
    
    return Math.min(1, relevance);
  }

  private determineImpact(article: NewsArticle): 'HIGH' | 'MEDIUM' | 'LOW' {
    const text = `${article.title} ${article.content}`.toLowerCase();
    
    const highImpactKeywords = [
      'regulation', 'sec', 'ban', 'approval', 'etf', 'institutional',
      'whale', 'billion', 'million', 'crash', 'surge', 'breakthrough'
    ];
    
    const mediumImpactKeywords = [
      'partnership', 'adoption', 'launch', 'update', 'upgrade',
      'trading', 'volume', 'price', 'market'
    ];
    
    for (const keyword of highImpactKeywords) {
      if (text.includes(keyword)) return 'HIGH';
    }
    
    for (const keyword of mediumImpactKeywords) {
      if (text.includes(keyword)) return 'MEDIUM';
    }
    
    return 'LOW';
  }

  private calculateSentimentScore(articles: NewsArticle[]): { score: number; confidence: number; sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' } {
    if (articles.length === 0) {
      return { score: 0, confidence: 0, sentiment: 'NEUTRAL' };
    }

    // Weight by relevance and recency
    const now = Date.now();
    const weightedScores = articles.map(article => {
      const ageHours = (now - article.publishedAt.getTime()) / (1000 * 60 * 60);
      const recencyWeight = Math.max(0.1, 1 - ageHours / 24); // Decay over 24 hours
      const relevanceWeight = article.relevance;
      const impactWeight = article.impact === 'HIGH' ? 2 : article.impact === 'MEDIUM' ? 1.5 : 1;
      
      return article.sentiment * recencyWeight * relevanceWeight * impactWeight;
    });

    const totalScore = weightedScores.reduce((sum, score) => sum + score, 0);
    const totalWeight = articles.reduce((sum, article) => {
      const ageHours = (now - article.publishedAt.getTime()) / (1000 * 60 * 60);
      const recencyWeight = Math.max(0.1, 1 - ageHours / 24);
      const relevanceWeight = article.relevance;
      const impactWeight = article.impact === 'HIGH' ? 2 : article.impact === 'MEDIUM' ? 1.5 : 1;
      
      return sum + recencyWeight * relevanceWeight * impactWeight;
    }, 0);

    const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const confidence = Math.min(1, articles.length / 10); // More articles = higher confidence

    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (avgScore > 0.2) sentiment = 'BULLISH';
    else if (avgScore < -0.2) sentiment = 'BEARISH';
    else sentiment = 'NEUTRAL';

    return { score: avgScore, confidence, sentiment };
  }

  private extractTrendingTopics(articles: NewsArticle[]): string[] {
    const topicCounts = new Map<string, number>();
    
    articles.forEach(article => {
      const text = `${article.title} ${article.content}`.toLowerCase();
      
      // Extract potential topics (simple keyword extraction)
      const words = (text.match(/\b[a-z]{4,}\b/g) || []) as string[];
      
      words.forEach(word => {
        if (this.cryptoKeywords.includes(word) || word.length > 4) {
          topicCounts.set(word, (topicCounts.get(word) || 0) + 1);
        }
      });
    });

    // Return top 5 trending topics
    return Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);
  }

  private assessMarketImpact(articles: NewsArticle[], symbol: string): number {
    const highImpactArticles = articles.filter(a => a.impact === 'HIGH').length;
    const mediumImpactArticles = articles.filter(a => a.impact === 'MEDIUM').length;
    const recentArticles = articles.filter(a => 
      Date.now() - a.publishedAt.getTime() < 6 * 60 * 60 * 1000 // Last 6 hours
    ).length;

    // Calculate impact score
    const impactScore = (highImpactArticles * 0.8 + mediumImpactArticles * 0.4) / articles.length;
    const recencyScore = Math.min(1, recentArticles / 5); // Normalize by 5 articles
    
    return (impactScore + recencyScore) / 2;
  }

  private determineUrgency(articles: NewsArticle[]): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    const criticalKeywords = ['crash', 'ban', 'hack', 'emergency', 'urgent'];
    const highKeywords = ['regulation', 'sec', 'whale', 'billion', 'surge'];
    
    const recentArticles = articles.filter(a => 
      Date.now() - a.publishedAt.getTime() < 2 * 60 * 60 * 1000 // Last 2 hours
    );

    for (const article of recentArticles) {
      const text = `${article.title} ${article.content}`.toLowerCase();
      
      for (const keyword of criticalKeywords) {
        if (text.includes(keyword)) return 'CRITICAL';
      }
      
      for (const keyword of highKeywords) {
        if (text.includes(keyword)) return 'HIGH';
      }
    }

    if (recentArticles.length > 5) return 'HIGH';
    if (recentArticles.length > 2) return 'MEDIUM';
    return 'LOW';
  }

  private getSymbolKeywords(symbol: string): string[] {
    const symbolMap: Record<string, string[]> = {
      'BTC/USDT': ['bitcoin', 'btc'],
      'ETH/USDT': ['ethereum', 'eth'],
      'BNB/USDT': ['binance', 'bnb'],
      'ADA/USDT': ['cardano', 'ada'],
      'DOGE/USDT': ['dogecoin', 'doge'],
      'SOL/USDT': ['solana', 'sol'],
      'XRP/USDT': ['ripple', 'xrp'],
      'MATIC/USDT': ['polygon', 'matic']
    };

    return symbolMap[symbol] || [symbol.toLowerCase()];
  }
}
