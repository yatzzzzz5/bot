export interface AnomalySignal {
  ts: number;
  type: 'VOLUME_SPIKE' | 'PRICE_GAP' | 'NEWS_BURST' | 'FLOW_SURGE';
  severity: number; // 0..1
  details?: string;
}

export class AnomalyDetector {
  async initialize(): Promise<void> {}
  detect(inputs: { priceChangePct?: number; volumeZ?: number; newsCount?: number; flowDelta?: number; }): AnomalySignal[] {
    const out: AnomalySignal[] = [];
    if ((inputs.volumeZ ?? 0) > 3) out.push({ ts: Date.now(), type: 'VOLUME_SPIKE', severity: Math.min(1, (inputs.volumeZ || 0)/10) });
    if (Math.abs(inputs.priceChangePct || 0) > 1.5) out.push({ ts: Date.now(), type: 'PRICE_GAP', severity: Math.min(1, Math.abs(inputs.priceChangePct || 0)/10) });
    if ((inputs.newsCount ?? 0) > 5) out.push({ ts: Date.now(), type: 'NEWS_BURST', severity: Math.min(1, (inputs.newsCount || 0)/20) });
    if (Math.abs(inputs.flowDelta || 0) > 1000000) out.push({ ts: Date.now(), type: 'FLOW_SURGE', severity: 0.7 });
    return out;
  }
}


