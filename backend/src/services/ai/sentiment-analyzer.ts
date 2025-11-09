import Sentiment from 'sentiment';
import axios from 'axios';
import { logger } from '../../utils/logger';
import { getCache, setCache } from '../../config/redis';

export interface SentimentAnalysis {
  score: number; // -1 to 1 (negative to positive)
  confidence: number; // 0 to 1
  sources: string[];
  timestamp: Date;
}

export class SentimentAnalyzer {
  private sentiment: Sentiment;
  private newsApiKey: string;
  private twitterApiKey: string;

  constructor() {
    this.sentiment = new Sentiment();
    this.newsApiKey = process.env.NEWS_API_KEY || '7a55617ad41649298de712252c5a4b4a';
    this.twitterApiKey = process.env.TWITTER_API_KEY || '';
  }

  async initialize(): Promise<void> {
    logger.info('🧠 Initializing Sentiment Analyzer...');
    
    // Test API keys (silent mode - only debug log)
    if (!this.newsApiKey) {
      logger.debug('ℹ️ News API key not found, news sentiment analysis will be limited');
    }
    
    if (!this.twitterApiKey) {
      logger.debug('ℹ️ Twitter API key not found, social sentiment analysis will be limited');
    }
    
    logger.info('✅ Sentiment Analyzer initialized');
  }

  async analyze(symbol: string): Promise<SentimentAnalysis> {
    try {
      logger.info(`🔍 Analyzing sentiment for ${symbol}`);
      
      // Check cache first
      const cacheKey = `sentiment:${symbol}`;
      const cached = await getCache<SentimentAnalysis>(cacheKey);
      if (cached) {
        logger.info(`📋 Using cached sentiment for ${symbol}`);
        return cached;
      }

      // Collect sentiment data from multiple sources
      const [newsSentiment, socialSentiment, redditSentiment] = await Promise.all([
        this.analyzeNewsSentiment(symbol),
        this.analyzeSocialSentiment(symbol),
        this.analyzeRedditSentiment(symbol)
      ]);

      // Combine sentiment scores
      const combinedScore = this.combineSentimentScores([
        newsSentiment,
        socialSentiment,
        redditSentiment
      ]);

      const analysis: SentimentAnalysis = {
        score: combinedScore.score,
        confidence: combinedScore.confidence,
        sources: ['news', 'social', 'reddit'],
        timestamp: new Date()
      };

      // Cache result for 15 minutes
      await setCache(cacheKey, analysis, 900);
      
      logger.info(`✅ Sentiment analysis completed for ${symbol}: ${analysis.score.toFixed(3)}`);
      return analysis;

    } catch (error) {
      logger.error(`❌ Failed to analyze sentiment for ${symbol}:`, error);
      
      // Return neutral sentiment on error
      return {
        score: 0,
        confidence: 0,
        sources: [],
        timestamp: new Date()
      };
    }
  }

  private async analyzeNewsSentiment(symbol: string): Promise<{ score: number; confidence: number }> {
    try {
      if (!this.newsApiKey) {
        return { score: 0, confidence: 0 };
      }

      const query = `${symbol} cryptocurrency`;
      const response = await axios.get(`https://newsapi.org/v2/everything`, {
        params: {
          q: query,
          apiKey: this.newsApiKey,
          language: 'en',
          sortBy: 'publishedAt',
          pageSize: 20
        }
      });

      const articles = response.data.articles || [];
      let totalScore = 0;
      let validArticles = 0;

      for (const article of articles) {
        const text = `${article.title} ${article.description}`;
        const result = this.sentiment.analyze(text);
        
        // Normalize score to -1 to 1 range
        const normalizedScore = Math.max(-1, Math.min(1, result.score / 10));
        totalScore += normalizedScore;
        validArticles++;
      }

      const averageScore = validArticles > 0 ? totalScore / validArticles : 0;
      const confidence = Math.min(1, validArticles / 20); // More articles = higher confidence

      return { score: averageScore, confidence };

    } catch (error) {
      logger.error(`❌ News sentiment analysis failed for ${symbol}:`, error);
      return { score: 0, confidence: 0 };
    }
  }

  private async analyzeSocialSentiment(symbol: string): Promise<{ score: number; confidence: number }> {
    try {
      // For now, return neutral sentiment
      // In production, integrate with Twitter API, Telegram, etc.
      return { score: 0, confidence: 0 };

    } catch (error) {
      logger.error(`❌ Social sentiment analysis failed for ${symbol}:`, error);
      return { score: 0, confidence: 0 };
    }
  }

  private async analyzeRedditSentiment(symbol: string): Promise<{ score: number; confidence: number }> {
    try {
      // Analyze Reddit posts and comments
      const subreddits = ['cryptocurrency', 'bitcoin', 'altcoin'];
      let totalScore = 0;
      let totalPosts = 0;

      for (const subreddit of subreddits) {
        try {
          const response = await axios.get(
            `https://www.reddit.com/r/${subreddit}/search.json`,
            {
              params: {
                q: symbol,
                sort: 'hot',
                limit: 10
              },
              headers: {
                'User-Agent': 'CryptoBot/1.0'
              }
            }
          );

          const posts = response.data.data?.children || [];
          
          for (const post of posts) {
            const text = `${post.data.title} ${post.data.selftext}`;
            const result = this.sentiment.analyze(text);
            
            // Normalize score
            const normalizedScore = Math.max(-1, Math.min(1, result.score / 10));
            totalScore += normalizedScore;
            totalPosts++;
          }

        } catch (error) {
          logger.warn(`⚠️ Failed to fetch from r/${subreddit}:`, error);
        }
      }

      const averageScore = totalPosts > 0 ? totalScore / totalPosts : 0;
      const confidence = Math.min(1, totalPosts / 30);

      return { score: averageScore, confidence };

    } catch (error) {
      logger.error(`❌ Reddit sentiment analysis failed for ${symbol}:`, error);
      return { score: 0, confidence: 0 };
    }
  }

  private combineSentimentScores(sentiments: Array<{ score: number; confidence: number }>): { score: number; confidence: number } {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const sentiment of sentiments) {
      const weight = sentiment.confidence;
      weightedSum += sentiment.score * weight;
      totalWeight += weight;
    }

    const combinedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const averageConfidence = sentiments.reduce((sum, s) => sum + s.confidence, 0) / sentiments.length;

    return {
      score: Math.max(-1, Math.min(1, combinedScore)),
      confidence: averageConfidence
    };
  }

  // Real-time sentiment monitoring
  async startRealTimeMonitoring(symbol: string, callback: (sentiment: SentimentAnalysis) => void): Promise<void> {
    setInterval(async () => {
      try {
        const sentiment = await this.analyze(symbol);
        callback(sentiment);
      } catch (error) {
        logger.error(`❌ Real-time sentiment monitoring failed for ${symbol}:`, error);
      }
    }, 5 * 60 * 1000); // Update every 5 minutes
  }
}
