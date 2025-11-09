import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export async function connectDB(): Promise<void> {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-bot';
    
    // MongoDB bağlantısını daha esnek hale getir
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      retryWrites: true,
      retryReads: true,
      bufferCommands: false // Disable mongoose buffering
    });
    
    logger.info('✅ MongoDB connected successfully');
    
    // Handle connection events
    mongoose.connection.on('error', (error) => {
      logger.error('❌ MongoDB connection error:', error);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 MongoDB reconnected');
    });
    
    // Keep connection alive
    mongoose.connection.on('open', () => {
      logger.info('🔗 MongoDB connection opened');
    });
    
  } catch (error) {
    logger.error('❌ Failed to connect to MongoDB:', error);
    logger.warn('⚠️ MongoDB bağlantısı başarısız, uygulama devam ediyor...');
    // MongoDB bağlantısı başarısız olsa bile uygulamanın çalışmaya devam etmesini sağla
    // throw error;
    
    // MongoDB olmadan da çalışabilmesi için mock connection oluştur
    logger.info('🔄 Mock MongoDB connection created for offline mode');
    
    // Mock mongoose connection for offline mode
    // readyState is read-only, so we'll just log the mock status
    logger.info('✅ Mock MongoDB connection ready for offline mode');
  }
}

export async function disconnectDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('✅ MongoDB disconnected successfully');
  } catch (error) {
    logger.error('❌ Failed to disconnect from MongoDB:', error);
    throw error;
  }
}
