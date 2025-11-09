export interface TradingSignal {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  strength: 'WEAK' | 'MEDIUM' | 'STRONG';
  confidence: number;
  reason: string;
  timestamp: string;
}

export interface MarketAnalysis {
  symbol: string;
  timestamp: string;
  sentiment: {
    score: number;
    confidence: number;
    sources: string[];
  };
  technical: {
    rsi: number;
    macd: {
      macd: number;
      signal: number;
      histogram: number;
    };
    bollingerBands: {
      upper: number;
      middle: number;
      lower: number;
    };
    confidence: number;
  };
  patterns: Array<{
    name: string;
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: number;
  }>;
  riskScore: number;
  signals: TradingSignal[];
  confidence: number;
}
