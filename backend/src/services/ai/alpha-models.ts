export interface AlphaPrediction {
  symbol: string;
  ts: number;
  model: string;
  probUp: number; // [0,1]
  horizonMin: number;
}

export class AlphaModels {
  private weights: { gbmBias: number; xformBias: number } = { gbmBias: 0, xformBias: 0 };

  async initialize(): Promise<void> {
    try {
      // load lightweight biases from env or defaults
      const gb = Number(process.env.ALPHA_GBM_BIAS || 0);
      const xf = Number(process.env.ALPHA_XFORM_BIAS || 0);
      if (isFinite(gb)) this.weights.gbmBias = gb;
      if (isFinite(xf)) this.weights.xformBias = xf;
      const path = process.env.ALPHA_WEIGHTS_PATH;
      if (path) {
        try {
          const raw = require('fs').readFileSync(path, 'utf8');
          const w = JSON.parse(raw);
          if (typeof w.gbmBias === 'number') this.weights.gbmBias = w.gbmBias;
          if (typeof w.xformBias === 'number') this.weights.xformBias = w.xformBias;
        } catch {}
      }
    } catch {}
  }

  async trainGBM(_features: any[]): Promise<void> {}
  async trainTransformer(_features: any[]): Promise<void> {}

  async predict(features: { symbol: string } & Record<string, any>): Promise<AlphaPrediction[]> {
    const base = Math.min(0.9, Math.max(0.1, 0.5 + ((features.rsi ?? 50) - 50) / 200));
    return [
      { symbol: features.symbol, ts: Date.now(), model: 'gbm', probUp: Math.min(0.99, Math.max(0.01, base + this.weights.gbmBias)), horizonMin: 15 },
      { symbol: features.symbol, ts: Date.now(), model: 'transformer', probUp: Math.min(0.99, Math.max(0.01, base * 0.9 + 0.05 + this.weights.xformBias)), horizonMin: 30 }
    ];
  }
}


