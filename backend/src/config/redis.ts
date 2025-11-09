import Redis from 'ioredis';
import { logger } from '../utils/logger';

let redisClient: Redis;

export async function connectRedis(): Promise<void> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });
    
    // Handle connection events
    redisClient.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });
    
    redisClient.on('error', (error) => {
      logger.error('❌ Redis connection error:', error);
    });
    
    redisClient.on('close', () => {
      logger.warn('⚠️ Redis connection closed');
    });
    
    redisClient.on('reconnecting', () => {
      logger.info('🔄 Redis reconnecting...');
    });
    
    // Test connection
    await redisClient.ping();
    logger.info('✅ Redis ping successful');
    
  } catch (error) {
    logger.error('❌ Failed to connect to Redis:', error);
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    if (redisClient) {
      await redisClient.quit();
      logger.info('✅ Redis disconnected successfully');
    }
  } catch (error) {
    logger.error('❌ Failed to disconnect from Redis:', error);
    throw error;
  }
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
}

// Cache helper functions
export async function setCache(key: string, value: any, ttl: number = 3600): Promise<void> {
  try {
    const serializedValue = JSON.stringify(value);
    await redisClient.setex(key, ttl, serializedValue);
  } catch (error) {
    logger.error(`❌ Failed to set cache for key ${key}:`, error);
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const value = await redisClient.get(key);
    if (value) {
      return JSON.parse(value) as T;
    }
    return null;
  } catch (error) {
    logger.error(`❌ Failed to get cache for key ${key}:`, error);
    return null;
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    await redisClient.del(key);
  } catch (error) {
    logger.error(`❌ Failed to delete cache for key ${key}:`, error);
  }
}

export async function clearCache(): Promise<void> {
  try {
    await redisClient.flushall();
    logger.info('✅ Cache cleared successfully');
  } catch (error) {
    logger.error('❌ Failed to clear cache:', error);
  }
}
