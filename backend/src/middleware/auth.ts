import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Sabit kullanıcı adı ve şifre (sadece siz kullanacaksanız)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'crypto2024!';

export interface AuthRequest extends Request {
  user?: {
    username: string;
    authenticated: boolean;
  };
}

// Basit authentication middleware
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  // Skip auth for login, logout, verify, and health endpoints
  const path = req.path || req.originalUrl || '';
  const authExcludedPaths = ['/auth/login', '/auth/logout', '/auth/verify', '/health'];
  
  if (authExcludedPaths.some(excludedPath => path === excludedPath || path.startsWith(excludedPath) || path.includes(excludedPath))) {
    return next();
  }

  // Check for session token (stored in cookie or header)
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.authToken;

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  // Verify token (simple comparison - in production use JWT)
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [username, timestamp] = decoded.split(':');
    
    // Token expires after 24 hours
    const tokenAge = Date.now() - parseInt(timestamp || '0', 10);
    if (tokenAge > 24 * 60 * 60 * 1000) {
      res.status(401).json({
        success: false,
        error: 'Token expired'
      });
      return;
    }

    if (username === ADMIN_USERNAME) {
      req.user = {
        username,
        authenticated: true
      };
      next();
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token format'
    });
  }
}

// Login endpoint handler
export function handleLogin(username: string, password: string): { success: boolean; token?: string; error?: string } {
  // Debug logging with detailed info
  console.log('\n========== LOGIN ATTEMPT ==========');
  console.log(`Received Username: "${username}"`);
  console.log(`Expected Username: "${ADMIN_USERNAME}"`);
  console.log(`Username Match: ${username === ADMIN_USERNAME}`);
  console.log(`Received Password Length: ${password.length}`);
  console.log(`Expected Password Length: ${ADMIN_PASSWORD.length}`);
  console.log(`Password Match: ${password === ADMIN_PASSWORD}`);
  console.log(`Expected Password: "${ADMIN_PASSWORD}"`);
  console.log('====================================\n');
  
  logger.info(`🔐 Login attempt - Username: "${username}", Expected: "${ADMIN_USERNAME}", Match: ${username === ADMIN_USERNAME}`);
  logger.info(`🔐 Password check - Length: ${password.length}, Expected length: ${ADMIN_PASSWORD.length}, Match: ${password === ADMIN_PASSWORD}`);
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    // Generate simple token (username:timestamp in base64)
    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
    
    console.log('✅ LOGIN SUCCESSFUL');
    logger.info(`✅ User authenticated: ${username}`);
    return {
      success: true,
      token
    };
  } else {
    console.log('❌ LOGIN FAILED');
    logger.warn(`⚠️ Failed login attempt: ${username}`);
    logger.warn(`⚠️ Username match: ${username === ADMIN_USERNAME}, Password match: ${password === ADMIN_PASSWORD}`);
    return {
      success: false,
      error: 'Invalid username or password'
    };
  }
}

// Verify token helper
export function verifyToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [username, timestamp] = decoded.split(':');
    
    const tokenAge = Date.now() - parseInt(timestamp || '0', 10);
    if (tokenAge > 24 * 60 * 60 * 1000) {
      return false;
    }

    return username === ADMIN_USERNAME;
  } catch {
    return false;
  }
}

