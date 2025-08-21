import * as ort from 'onnxruntime-web';

// COCO class names
const CLASS_NAMES = [
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

let yoloSession: ort.InferenceSession | null = null;

// Initialize ONNX Runtime session
async function initializeModel() {
  try {
    // Set WASM paths for ONNX Runtime
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
    
    // Enable detailed logging for debugging
    ort.env.logLevel = 'info';
    
    console.log('Loading YOLOv5n model from /models/yolov5n.onnx...');
    
    yoloSession = await ort.InferenceSession.create('/models/yolov5n.onnx', { 
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
    
    console.log('✅ YOLOv5n model loaded successfully');
    console.log('Model input names:', yoloSession.inputNames);
    console.log('Model output names:', yoloSession.outputNames);
  } catch (error) {
    console.error('❌ Failed to load YOLOv5n model:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
}

// Preprocess image to YOLO input format
function preprocessImage(imageData: ImageData, inputSize = 640) {
  const { data, width, height } = imageData;
  
  // Calculate letterbox parameters
  const scale = Math.min(inputSize / width, inputSize / height);
  const nw = Math.round(width * scale);
  const nh = Math.round(height * scale);
  const dx = Math.floor((inputSize - nw) / 2);
  const dy = Math.floor((inputSize - nh) / 2);
  
  // Create letterboxed canvas
  const canvas = new OffscreenCanvas(inputSize, inputSize);
  const ctx = canvas.getContext('2d')!;
  
  // Fill with gray
  ctx.fillStyle = 'rgb(114, 114, 114)';
  ctx.fillRect(0, 0, inputSize, inputSize);
  
  // Create ImageData from input
  const inputCanvas = new OffscreenCanvas(width, height);
  const inputCtx = inputCanvas.getContext('2d')!;
  inputCtx.putImageData(imageData, 0, 0);
  
  // Draw resized image
  ctx.drawImage(inputCanvas, 0, 0, width, height, dx, dy, nw, nh);
  
  // Get processed image data
  const processedImageData = ctx.getImageData(0, 0, inputSize, inputSize);
  const processedData = processedImageData.data;
  
  // Convert to tensor format [1, 3, H, W]
  const tensorData = new Float32Array(inputSize * inputSize * 3);
  for (let i = 0, p = 0; i < processedData.length; i += 4) {
    const r = processedData[i] / 255.0;
    const g = processedData[i + 1] / 255.0;
    const b = processedData[i + 2] / 255.0;
    const j = p++;
    tensorData[j] = r;                          // R channel
    tensorData[j + inputSize * inputSize] = g;  // G channel
    tensorData[j + inputSize * inputSize * 2] = b; // B channel
  }
  
  return {
    tensor: new ort.Tensor('float32', tensorData, [1, 3, inputSize, inputSize]),
    scale,
    dx,
    dy,
    originalWidth: width,
    originalHeight: height
  };
}

// Non-maximum suppression
function nms(boxes: number[][], scores: number[], iouThreshold = 0.45) {
  const indices = [];
  const areas = boxes.map(box => (box[2] - box[0]) * (box[3] - box[1]));
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  
  while (order.length > 0) {
    const i = order[0];
    indices.push(i);
    
    const newOrder = [];
    for (let j = 1; j < order.length; j++) {
      const idx = order[j];
      const xx1 = Math.max(boxes[i][0], boxes[idx][0]);
      const yy1 = Math.max(boxes[i][1], boxes[idx][1]);
      const xx2 = Math.min(boxes[i][2], boxes[idx][2]);
      const yy2 = Math.min(boxes[i][3], boxes[idx][3]);
      
      const w = Math.max(0, xx2 - xx1);
      const h = Math.max(0, yy2 - yy1);
      const inter = w * h;
      const iou = inter / (areas[i] + areas[idx] - inter);
      
      if (iou <= iouThreshold) {
        newOrder.push(idx);
      }
    }
    order.splice(0, 1, ...newOrder);
  }
  
  return indices;
}

// Process YOLO output
function processOutput(output: ort.Tensor, scale: number, dx: number, dy: number, originalWidth: number, originalHeight: number) {
  const outputData = output.data as Float32Array;
  const [, , numDetections] = output.dims;
  
  const boxes = [];
  const scores = [];
  const classIds = [];
  
  // YOLOv8 output format: [batch, 84, 8400] where 84 = 4 coords + 80 classes
  for (let i = 0; i < numDetections; i++) {
    // Extract box coordinates (center format)
    const x = outputData[i];
    const y = outputData[i + numDetections];
    const w = outputData[i + 2 * numDetections];
    const h = outputData[i + 3 * numDetections];
    
    // Extract class scores
    let maxScore = 0;
    let maxClassId = 0;
    for (let j = 0; j < 80; j++) {
      const score = outputData[i + (4 + j) * numDetections];
      if (score > maxScore) {
        maxScore = score;
        maxClassId = j;
      }
    }
    
    if (maxScore > 0.25) {
      // Convert center format to corner format
      const x1 = x - w / 2;
      const y1 = y - h / 2;
      const x2 = x + w / 2;
      const y2 = y + h / 2;
      
      boxes.push([x1, y1, x2, y2]);
      scores.push(maxScore);
      classIds.push(maxClassId);
    }
  }
  
  // Apply NMS
  const keepIndices = nms(boxes, scores, 0.45);
  
  const detections = [];
  for (const idx of keepIndices) {
    let [x1, y1, x2, y2] = boxes[idx];
    
    // Unletterbox coordinates
    x1 = (x1 - dx) / scale;
    y1 = (y1 - dy) / scale;
    x2 = (x2 - dx) / scale;
    y2 = (y2 - dy) / scale;
    
    // Normalize to [0, 1]
    const xmin = Math.max(0, x1 / originalWidth);
    const ymin = Math.max(0, y1 / originalHeight);
    const xmax = Math.min(1, x2 / originalWidth);
    const ymax = Math.min(1, y2 / originalHeight);
    
    detections.push({
      label: CLASS_NAMES[classIds[idx]],
      score: scores[idx],
      xmin,
      ymin,
      xmax,
      ymax
    });
  }
  
  return detections;
}

// Worker message handler
self.onmessage = async function(event) {
  const { imageData, width, height, timestamp, frameId } = event.data;
  
  if (!yoloSession) {
    console.log('Initializing model for the first time...');
    await initializeModel();
  }
  
  if (!yoloSession) {
    console.log('⚠️ YOLOv5n model not loaded, using mock detections');
    // Enhanced mock detections that vary over time
    const mockDetections = [
      {
        label: 'person',
        score: 0.85 + Math.random() * 0.15,
        xmin: 0.1 + Math.random() * 0.05,
        ymin: 0.15 + Math.random() * 0.05,
        xmax: 0.35 + Math.random() * 0.05,
        ymax: 0.75 + Math.random() * 0.05
      },
      {
        label: 'cell phone',
        score: 0.70 + Math.random() * 0.20,
        xmin: 0.45 + Math.random() * 0.1,
        ymin: 0.2 + Math.random() * 0.1,
        xmax: 0.65 + Math.random() * 0.05,
        ymax: 0.4 + Math.random() * 0.05
      }
    ];
    
    // Randomly remove some detections to simulate real behavior
    const finalDetections = mockDetections.filter(() => Math.random() > 0.2);
    
    self.postMessage({
      detections: finalDetections,
      processingTime: 20 + Math.random() * 15,
      frameId,
      timestamp,
      mockMode: true
    });
    return;
  }
  
  try {
    const startTime = performance.now();
    
    // Create ImageData object
    const imgData = new ImageData(new Uint8ClampedArray(imageData), width, height);
    
    // Preprocess
    const { tensor, scale, dx, dy, originalWidth, originalHeight } = preprocessImage(imgData, 640);
    
    // Run inference
    const feeds: Record<string, ort.Tensor> = {};
    feeds[yoloSession.inputNames[0]] = tensor;
    const results = await yoloSession.run(feeds);
    
    // Process output
    const output = results[Object.keys(results)[0]];
    const detections = processOutput(output, scale, dx, dy, originalWidth, originalHeight);
    
    const processingTime = performance.now() - startTime;
    
    self.postMessage({
      detections,
      processingTime,
      frameId,
      timestamp
    });
  } catch (error) {
    console.error('YOLO inference error:', error);
    self.postMessage({
      detections: [],
      processingTime: 0,
      frameId,
      timestamp
    });
  }
};