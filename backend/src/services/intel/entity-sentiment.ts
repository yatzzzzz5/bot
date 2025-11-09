export interface EntitySentimentScore {
  entity: string;
  score: number; // -1..1
  count: number;
}

export class EntitySentimentService {
  async initialize(): Promise<void> {}
  async scoreEntities(symbol: string, headlines: { headline: string }[]): Promise<EntitySentimentScore[]> {
    const avg = headlines.length ? Math.min(1, Math.max(-1, headlines.length * 0.01)) : 0;
    return [ { entity: symbol, score: avg, count: headlines.length } ];
  }
}


