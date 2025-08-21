import { useState, useCallback, useRef, useEffect } from 'react';
import { Metrics, BenchmarkResult } from '@/types/metrics';

export const useMetrics = () => {
  const [metrics, setMetrics] = useState<Metrics>({
    latency: { median: 0, p95: 0 },
    serverLatency: 0,
    networkLatency: 0,
    fps: 0,
    bandwidth: { uplink: 0, downlink: 0 },
    framesProcessed: 0,
    timestamp: Date.now()
  });

  const [isRunning, setIsRunning] = useState(false);
  const startTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const latencyMeasurements = useRef<number[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateMetrics = useCallback(() => {
    const currentTime = Date.now();
    const elapsed = (currentTime - startTimeRef.current) / 1000;
    const currentFps = frameCountRef.current / Math.max(elapsed, 1);

    // Calculate median and P95 latency
    const sortedLatencies = [...latencyMeasurements.current].sort((a, b) => a - b);
    const median = sortedLatencies[Math.floor(sortedLatencies.length / 2)] || 0;
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p95 = sortedLatencies[p95Index] || 0;

    // Simulate bandwidth measurements
    const simulatedUplink = 200 + Math.random() * 100;
    const simulatedDownlink = 500 + Math.random() * 200;

    setMetrics({
      latency: { median, p95 },
      serverLatency: 15 + Math.random() * 10,
      networkLatency: 25 + Math.random() * 15,
      fps: currentFps,
      bandwidth: {
        uplink: simulatedUplink,
        downlink: simulatedDownlink
      },
      framesProcessed: frameCountRef.current,
      timestamp: currentTime
    });
  }, []);

  const recordFrameProcessed = useCallback((processingTime?: number) => {
    frameCountRef.current++;
    
    if (processingTime) {
      latencyMeasurements.current.push(processingTime);
      // Keep only last 100 measurements for efficiency
      if (latencyMeasurements.current.length > 100) {
        latencyMeasurements.current = latencyMeasurements.current.slice(-100);
      }
    }
  }, []);

  const startBenchmark = useCallback(() => {
    if (isRunning) return;

    setIsRunning(true);
    startTimeRef.current = Date.now();
    frameCountRef.current = 0;
    latencyMeasurements.current = [];

    // Update metrics every second
    intervalRef.current = setInterval(updateMetrics, 1000);
    
    console.log('Metrics benchmark started');
  }, [isRunning, updateMetrics]);

  const stopBenchmark = useCallback(() => {
    if (!isRunning) return;

    setIsRunning(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    console.log('Metrics benchmark stopped');
  }, [isRunning]);

  const exportMetrics = useCallback((): BenchmarkResult => {
    const duration = isRunning 
      ? (Date.now() - startTimeRef.current) / 1000 
      : 0;

    const result: BenchmarkResult = {
      duration,
      mode: 'wasm', // This should be passed from parent component
      metrics,
      samples: latencyMeasurements.current.length
    };

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `metrics-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('Metrics exported:', result);
    return result;
  }, [metrics, isRunning]);

  // Simulate real-time metrics updates
  useEffect(() => {
    if (isRunning) {
      const mockInterval = setInterval(() => {
        recordFrameProcessed(45 + Math.random() * 30);
      }, 1000 / 15); // Simulate 15 FPS processing

      return () => clearInterval(mockInterval);
    }
  }, [isRunning, recordFrameProcessed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    metrics,
    isRunning,
    startBenchmark,
    stopBenchmark,
    recordFrameProcessed,
    exportMetrics
  };
};
