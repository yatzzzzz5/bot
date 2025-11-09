import { logger } from '../../utils/logger';

export interface BasisCarryOpp {
  symbol: string;
  spotExchange: string;
  perpExchange: string;
  annualizedBasisPct: number; // annualized
  fundingRatePct: number; // 8h or 1h converted
  expectedNetPct: number; // net after fees
  windowHours: number;
  confidence: number; // 0..100
  risk: 'LOW' | 'MEDIUM';
}

export class BasisCarry {
  async initialize(): Promise<void> {
    logger.info('📐 BasisCarry initialized');
  }

  async findOpportunities(symbol: string): Promise<BasisCarryOpp[]> {
    // Placeholder: requires spot/perp price and funding schedule
    return [];
  }
}


