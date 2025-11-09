let latencyMs = 0;
let slipMultiplier = 1;
let wsDown = false;

export const chaos = {
  getLatencyMs: () => latencyMs,
  setLatencyMs: (ms: number) => { latencyMs = Math.max(0, ms|0); },
  getSlipMultiplier: () => slipMultiplier,
  setSlipMultiplier: (x: number) => { slipMultiplier = Math.max(0, Number(x) || 1); },
  isWsDown: () => wsDown,
  setWsDown: (down: boolean) => { wsDown = !!down; },
  reset: () => { latencyMs = 0; slipMultiplier = 1; wsDown = false; }
};


