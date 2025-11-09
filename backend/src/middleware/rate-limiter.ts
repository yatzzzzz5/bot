import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Simple in-memory rate limiter
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  // Looser defaults to support frontend polling
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 2000; // 2000 req/min per IP

  // Whitelist localhost and health/telemetry paths
  const isLocalhost = clientIP === '::1' || clientIP === '127.0.0.1' || clientIP?.includes('::ffff:127.0.0.1');
  const path = req.originalUrl || '';
  const whitelistPrefixes = [
    '/api/trading/status',
    '/api/circuit-breaker/status',
    '/api/micro-trading/status',
    '/api/micro-trading/performance',
    '/api/enhanced/analysis',
    '/api/profit-lock/status'
  ];
  const whitelisted = isLocalhost || whitelistPrefixes.some(p => path.startsWith(p));
  if (whitelisted) {
    return next();
  }

  // Get or create client record
  let clientRecord = requestCounts.get(clientIP);
  if (!clientRecord || now > clientRecord.resetTime) {
    clientRecord = { count: 0, resetTime: now + windowMs };
    requestCounts.set(clientIP, clientRecord);
  }

  // Check rate limit
  if (clientRecord.count >= maxRequests) {
    logger.warn(`Rate limit exceeded for IP: ${clientIP}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((clientRecord.resetTime - now) / 1000)
    });
    return;
  }

  // Increment request count
  clientRecord.count++;

  // Add rate limit headers
  res.set({
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': (maxRequests - clientRecord.count).toString(),
    'X-RateLimit-Reset': new Date(clientRecord.resetTime).toISOString()
  });

  next();
}

// Clean up old records periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(ip);
    }
  }
}, 60 * 1000); // Clean up every minute
