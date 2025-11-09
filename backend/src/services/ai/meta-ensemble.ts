import type { AlphaPrediction } from './alpha-models';

export interface EnsembleResult {
  symbol: string;
  ts: number;
  probUp: number;
  weights: Record<string, number>;
}

export class MetaEnsemble {
  private recentScores: Map<string, { sharpeLike: number }> = new Map(); // model -> score

  async initialize(): Promise<void> {}

  updatePerformance(model: string, pnl: number): void {
    const prev = this.recentScores.get(model)?.sharpeLike ?? 0;
    const upd = prev * 0.9 + (pnl >= 0 ? 0.1 : -0.1);
    this.recentScores.set(model, { sharpeLike: upd });
  }

  blend(preds: AlphaPrediction[]): EnsembleResult | null {
    if (!preds || preds.length === 0) return null;
    const weightsRaw: number[] = preds.map(p => 1 + Math.max(-0.9, Math.min(0.9, (this.recentScores.get(p.model)?.sharpeLike ?? 0))));
    const sum = weightsRaw.reduce((a,b)=>a+b,0) || 1;
    const weights = preds.reduce((acc, p, idx) => { acc[p.model] = weightsRaw[idx] / sum; return acc; }, {} as Record<string, number>);
    const prob = preds.reduce((acc, p, idx) => acc + p.probUp * (weightsRaw[idx] / sum), 0);
    return { symbol: preds[0].symbol, ts: Date.now(), probUp: prob, weights };
  }
}


