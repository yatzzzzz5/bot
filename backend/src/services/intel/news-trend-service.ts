export interface NewsEvent {
  ts: number;
  source: string;
  headline: string;
  sentiment: number; // -1..1
  entities?: string[];
}

export class NewsTrendService {
  async initialize(): Promise<void> {}
  async fetchRecent(symbol: string): Promise<NewsEvent[]> {
    // placeholder; integrate premium APIs later
    return [
      { ts: Date.now()-60000, source: 'feed', headline: `${symbol} positive dev update`, sentiment: 0.4, entities: [symbol] }
    ];
  }
}


