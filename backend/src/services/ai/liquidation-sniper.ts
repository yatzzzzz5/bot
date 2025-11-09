import { logger } from '../../utils/logger';

export interface LiquidationOpportunity {
  symbol: string;
  side: 'LONG_LIQ' | 'SHORT_LIQ';
  notionalUSD: number;
  distancePct: number; // distance to trigger
  heatScore: number; // 0..100
  confidence: number; // 0..100
  expectedEdgePct: number; // expected scalp edge
  windowMs: number;
}

export class LiquidationSniper {
  async initialize(): Promise<void> {
    logger.info('🔭 LiquidationSniper initialized');
  }

  async findOpportunities(symbol: string): Promise<LiquidationOpportunity[]> {
    // Placeholder: integrate with perp OI/liquidations feed later
    return [];
  }
}


