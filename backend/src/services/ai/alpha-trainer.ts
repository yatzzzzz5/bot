import { FeatureSnapshot } from '../../models/FeatureSnapshot';
import fs from 'fs';

export class AlphaTrainer {
  async trainAndSave(outputPath: string): Promise<void> {
    const recent = await FeatureSnapshot.find().sort({ ts: -1 }).limit(5000);
    if (!recent.length) {
      await fs.promises.writeFile(outputPath, JSON.stringify({ gbmBias: 0, xformBias: 0 }));
      return;
    }
    // Very simple label proxy: higher RSI and liquidity => bias up
    const avgRsi = avg(recent.map(r => (r.features?.rsi ?? 50)));
    const avgLiq = avg(recent.map(r => (r.features?.l2LiquidityUSD ?? 0)));
    const gbmBias = ((avgRsi - 50) / 200);
    const xformBias = Math.tanh((avgLiq - 20000) / 100000) * 0.05;
    const weights = { gbmBias, xformBias };
    await fs.promises.writeFile(outputPath, JSON.stringify(weights));
  }
}

function avg(xs: number[]): number { if (!xs.length) return 0; return xs.reduce((a,b)=>a+b,0)/xs.length; }


