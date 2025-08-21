export interface Metrics {
  latency: {
    median: number;
    p95: number;
  };
  serverLatency: number;
  networkLatency: number;
  fps: number;
  bandwidth: {
    uplink: number;
    downlink: number;
  };
  framesProcessed: number;
  timestamp: number;
}

export interface BenchmarkResult {
  duration: number;
  mode: 'server' | 'wasm';
  metrics: Metrics;
  samples: number;
}