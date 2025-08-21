export interface Detection {
  label: string;
  score: number;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  frame_id?: string | number;
  capture_ts?: number;
  recv_ts?: number;
  inference_ts?: number;
}

export interface DetectionResult {
  frame_id: string | number;
  capture_ts: number;
  recv_ts: number;
  inference_ts: number;
  detections: Detection[];
}

export type DetectionMode = 'server' | 'wasm';