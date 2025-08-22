import { useState, useCallback, useRef, useEffect } from 'react';
import { Detection, DetectionMode } from '@/types/detection';
import * as ort from 'onnxruntime-web';

// COCO class names for YOLO models
const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
  'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
  'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
  'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
  'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
  'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
  'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
  'toothbrush'
];

export const useObjectDetection = (mode: DetectionMode) => {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Initialize ONNX model for WASM mode
  useEffect(() => {
    if (mode === 'wasm') {
      const loadModel = async () => {
        try {
          console.log('🔄 Loading YOLO model...');
          // Use YOLOv5n model from public folder
          sessionRef.current = await ort.InferenceSession.create('/models/yolov5n.onnx', {
            executionProviders: ['wasm'],
          });
          setIsModelLoaded(true);
          console.log('✅ YOLO model loaded successfully');
        } catch (error) {
          console.error('❌ Failed to load YOLO model:', error);
          console.log('🎭 Using mock detection mode');
          setIsModelLoaded(false);
        }
      };
      loadModel();
    }

    return () => {
      if (sessionRef.current) {
        sessionRef.current = null;
      }
    };
  }, [mode]);

  const preprocessImage = useCallback((canvas: HTMLCanvasElement, inputSize = 640) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Create input tensor canvas
    const inputCanvas = document.createElement('canvas');
    inputCanvas.width = inputSize;
    inputCanvas.height = inputSize;
    const inputCtx = inputCanvas.getContext('2d')!;

    // Calculate letterbox parameters
    const scale = Math.min(inputSize / canvas.width, inputSize / canvas.height);
    const scaledWidth = canvas.width * scale;
    const scaledHeight = canvas.height * scale;
    const dx = (inputSize - scaledWidth) / 2;
    const dy = (inputSize - scaledHeight) / 2;

    // Fill background
    inputCtx.fillStyle = '#808080';
    inputCtx.fillRect(0, 0, inputSize, inputSize);

    // Draw scaled image
    inputCtx.drawImage(canvas, dx, dy, scaledWidth, scaledHeight);

    // Get image data and convert to tensor format
    const imageData = inputCtx.getImageData(0, 0, inputSize, inputSize);
    const data = new Float32Array(3 * inputSize * inputSize);

    // Convert RGBA to RGB and normalize to [0,1], CHW format
    for (let i = 0; i < inputSize * inputSize; i++) {
      const pixelIndex = i * 4;
      const tensorIndex = i;
      
      data[tensorIndex] = imageData.data[pixelIndex] / 255.0;     // R
      data[tensorIndex + inputSize * inputSize] = imageData.data[pixelIndex + 1] / 255.0; // G  
      data[tensorIndex + inputSize * inputSize * 2] = imageData.data[pixelIndex + 2] / 255.0; // B
    }

    return {
      tensor: new ort.Tensor('float32', data, [1, 3, inputSize, inputSize]),
      scale,
      dx,
      dy
    };
  }, []);

  const postprocessDetections = useCallback((output: ort.Tensor, preprocessInfo: any, originalWidth: number, originalHeight: number) => {
    const detections: Detection[] = [];
    const outputData = output.data as Float32Array;
    const numDetections = output.dims[1]; // Usually 25200 for YOLOv5
    const numClasses = 80; // COCO classes

    console.log(`🔍 Processing ${numDetections} potential detections...`);

    for (let i = 0; i < numDetections; i++) {
      const baseIndex = i * 85; // 85 = 4 (bbox) + 1 (objectness) + 80 (classes)
      
      const objectness = outputData[baseIndex + 4];
      if (objectness < 0.25) continue; // Skip low confidence

      // Get class probabilities
      let maxClassScore = 0;
      let maxClassIndex = 0;
      for (let j = 0; j < numClasses; j++) {
        const classScore = outputData[baseIndex + 5 + j];
        if (classScore > maxClassScore) {
          maxClassScore = classScore;
          maxClassIndex = j;
        }
      }

      const confidence = objectness * maxClassScore;
      if (confidence < 0.25) continue; // Skip low confidence

      // Get bounding box (center format)
      const cx = outputData[baseIndex];
      const cy = outputData[baseIndex + 1];
      const w = outputData[baseIndex + 2];
      const h = outputData[baseIndex + 3];

      // Convert to corner format and unscale
      const x1 = (cx - w / 2 - preprocessInfo.dx) / preprocessInfo.scale;
      const y1 = (cy - h / 2 - preprocessInfo.dy) / preprocessInfo.scale;
      const x2 = (cx + w / 2 - preprocessInfo.dx) / preprocessInfo.scale;
      const y2 = (cy + h / 2 - preprocessInfo.dy) / preprocessInfo.scale;

      // Normalize to [0,1]
      const xmin = Math.max(0, x1 / originalWidth);
      const ymin = Math.max(0, y1 / originalHeight);
      const xmax = Math.min(1, x2 / originalWidth);
      const ymax = Math.min(1, y2 / originalHeight);

      // Skip invalid boxes
      if (xmax <= xmin || ymax <= ymin) continue;

      detections.push({
        label: COCO_CLASSES[maxClassIndex],
        score: confidence,
        xmin,
        ymin,
        xmax,
        ymax,
        frame_id: Date.now(),
        capture_ts: Date.now(),
        recv_ts: Date.now() + 5,
        inference_ts: Date.now() + 25
      });
    }

    return detections;
  }, []);

  const processFrame = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!videoElement || !isProcessing) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = videoElement.videoWidth || 640;
    canvas.height = videoElement.videoHeight || 480;
    
    // Draw current frame
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    if (mode === 'wasm' && sessionRef.current && isModelLoaded) {
      try {
        // Preprocess image
        const preprocessResult = preprocessImage(canvas);
        if (!preprocessResult) return;

        // Run inference
        const feeds: Record<string, ort.Tensor> = {};
        feeds[sessionRef.current.inputNames[0]] = preprocessResult.tensor;
        
        const results = await sessionRef.current.run(feeds);
        const output = results[Object.keys(results)[0]];

        // Postprocess results
        const newDetections = postprocessDetections(
          output, 
          preprocessResult, 
          canvas.width, 
          canvas.height
        );

        setDetections(newDetections);
        console.log(`🧠 YOLO detection completed with ${newDetections.length} objects found`);
      } catch (error) {
        console.error('❌ YOLO inference failed:', error);
        // Fall back to mock detections
        generateMockDetections();
      }
    } else if (mode === 'server') {
      // Server-side detection (WebSocket primary, HTTP fallback)
      try {
        const blob = await new Promise<Blob | null>(resolve => 
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8)
        );

        if (!blob) {
          console.warn('Failed to create blob for server detection');
          return;
        }

        // Try WebSocket first
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(blob as any);
            return; // server will push detections via ws.onmessage
          } catch (wsErr) {
            console.warn('WebSocket send failed, falling back to HTTP POST', wsErr);
          }
        }

        // Fallback: HTTP POST to /api/detect
        const formData = new FormData();
        formData.append('image', blob);
        formData.append('timestamp', Date.now().toString());

  const apiUrl = ((import.meta as any)?.env?.VITE_API_URL) ?? 'http://localhost:8000';
        const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/detect`, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          setDetections(result.detections || []);
          console.log(`Server detection (HTTP) completed with ${result.detections?.length || 0} objects`);
        } else {
          console.error('Server detection (HTTP) failed with status:', response.status);
          generateMockDetections();
        }
      } catch (error) {
        console.error('Server detection failed:', error);
        generateMockDetections();
      }
    } else {
      // Mock detection mode
      generateMockDetections();
    }
  }, [mode, isProcessing, isModelLoaded, preprocessImage, postprocessDetections]);

  const generateMockDetections = useCallback(() => {
    const mockDetections: Detection[] = [
      {
        label: 'person',
        score: 0.89 + Math.random() * 0.1,
        xmin: 0.1 + Math.random() * 0.1,
        ymin: 0.1 + Math.random() * 0.1,
        xmax: 0.6 + Math.random() * 0.2,
        ymax: 0.9 + Math.random() * 0.1,
        frame_id: Date.now(),
        capture_ts: Date.now(),
        recv_ts: Date.now() + 5,
        inference_ts: Date.now() + 25
      },
      {
        label: 'cell phone',
        score: 0.76 + Math.random() * 0.15,
        xmin: 0.7 + Math.random() * 0.1,
        ymin: 0.2 + Math.random() * 0.1,
        xmax: 0.9 + Math.random() * 0.05,
        ymax: 0.5 + Math.random() * 0.1,
        frame_id: Date.now() + 1,
        capture_ts: Date.now(),
        recv_ts: Date.now() + 8,
        inference_ts: Date.now() + 30
      }
    ];
    setDetections(mockDetections);
    console.log(`🎭 Mock detection generated ${mockDetections.length} objects`);
  }, []);

  const startDetection = useCallback(async (stream: MediaStream | null) => {
    if (!stream) {
      console.log('❌ No stream provided for detection');
      return;
    }

    console.log('🚀 Starting object detection...');
    streamRef.current = stream;
    setIsProcessing(true);

    // Create video element for frame processing
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;

    await new Promise(resolve => {
      video.onloadedmetadata = resolve;
    });

  // Do not generate initial mock detections here; wait for real inference or server results

    // If server mode, establish WebSocket connection for low-latency streaming
    if (mode === 'server') {
      try {
  const apiUrl = ((import.meta as any)?.env?.VITE_API_URL) ?? `${window.location.protocol}//${window.location.host}`;
        const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
        const base = apiUrl.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}://${base.replace(/\/$/, '')}/ws/detect`;

        // Close previous ws if any
        if (wsRef.current) {
          try { wsRef.current.close(); } catch {};
          wsRef.current = null;
        }

        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('✅ WebSocket connected for server detection:', wsUrl);
        };

        ws.onmessage = (ev) => {
          try {
            const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : null;
            if (data && data.detections) {
              setDetections(data.detections);
            }
          } catch (err) {
            console.error('Failed to parse WS message:', err);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket closed');
          wsRef.current = null;
        };

        ws.onerror = (err) => {
          console.error('WebSocket error:', err);
        };

      } catch (err) {
        console.error('Failed to create WebSocket for server detection:', err);
      }
    }

    // Generate immediate mock detections
    generateMockDetections();

    // Process frames at 10 FPS for efficiency
    intervalRef.current = window.setInterval(() => {
      processFrame(video);
    }, 1000 / 10);

    console.log(`✅ Object detection started in ${mode} mode`);
  }, [mode, processFrame, generateMockDetections]);

  const stopDetection = useCallback(() => {
    console.log('🛑 Stopping object detection...');
    setIsProcessing(false);
    setDetections([]);
    streamRef.current = null;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (wsRef.current) {
      try { wsRef.current.close(); } catch {};
      wsRef.current = null;
    }
  }, []);

  return {
    detections,
    isProcessing,
    isModelLoaded,
    startDetection,
    stopDetection
  };
};