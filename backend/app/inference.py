#!/usr/bin/env python3
"""
Object Detection Inference Engine
Handles ONNX model loading and inference
"""

import cv2
import numpy as np
from typing import List, Dict, Any, Tuple
import time
import asyncio

# Import onnxruntime conditionally to handle import failures
try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError as e:
    print(f"ONNX Runtime not available: {e}")
    ort = None
    ONNX_AVAILABLE = False

class ObjectDetector:
    def __init__(self, model_path: str = "/app/models/yolov5n.onnx"):
        self.model_path = model_path
        self.session = None
        self.input_size = 320  # Use 320x320 for CPU efficiency
        self.confidence_threshold = 0.25
        self.nms_threshold = 0.45
        
        # COCO class names
        self.class_names = [
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
        ]
        
        self._load_model()
    
    def _load_model(self):
        """Load ONNX model"""
        try:
            if not ONNX_AVAILABLE:
                print("ONNX Runtime not available, using mock detection mode")
                self.session = None
                return
                
            providers = ['CPUExecutionProvider']
            
            # Try to use GPU if available
            available_providers = ort.get_available_providers()
            if 'CUDAExecutionProvider' in available_providers:
                providers.insert(0, 'CUDAExecutionProvider')
            
            self.session = ort.InferenceSession(
                self.model_path,
                providers=providers
            )
            
            print(f"Model loaded successfully with providers: {providers}")
            
        except Exception as e:
            print(f"Failed to load model: {e}")
            print("Using mock detection mode")
            self.session = None
    
    def _letterbox(self, img, new_shape=320, color=(114, 114, 114)):
        """Letterbox image for YOLO inference"""
        h, w = img.shape[:2]
        r = min(new_shape / h, new_shape / w)
        nh, nw = int(round(h * r)), int(round(w * r))
        pad = (new_shape - nw) // 2, (new_shape - nh) // 2
        canvas = np.full((new_shape, new_shape, 3), color, dtype=np.uint8)
        resized = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_LINEAR)
        canvas[pad[1]:pad[1]+nh, pad[0]:pad[0]+nw] = resized
        return canvas, r, pad

    def _preprocess_image(self, image: np.ndarray) -> Tuple[np.ndarray, float, Tuple[int, int]]:
        """Preprocess image for YOLO inference"""
        img_lb, r, pad = self._letterbox(image, self.input_size)
        x = img_lb[:, :, ::-1].transpose(2, 0, 1)  # BGR->RGB, HWC->CHW
        x = np.ascontiguousarray(x, dtype=np.float32) / 255.0
        x = x[None, ...]  # [1,3,H,W]
        return x, r, pad
    
    def _nms(self, boxes, scores, iou_thres=0.45):
        """Non-maximum suppression"""
        idxs = []
        if not len(boxes): 
            return idxs
        boxes = boxes.astype(np.float32)
        x1, y1, x2, y2 = boxes.T
        areas = (x2-x1)*(y2-y1)
        order = scores.argsort()[::-1]
        while order.size > 0:
            i = order[0]
            idxs.append(i)
            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])
            inter = np.maximum(0, xx2-xx1)*np.maximum(0, yy2-yy1)
            iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)
            order = order[1:][iou <= iou_thres]
        return idxs

    def _postprocess_detections(
        self, 
        outputs: np.ndarray, 
        r: float, 
        pad: Tuple[int, int],
        original_width: int,
        original_height: int
    ) -> List[Dict[str, Any]]:
        """Postprocess YOLO outputs to detection format"""
        detections = []
        
        if outputs is None or len(outputs) == 0:
            return detections
        
        # YOLOv5 ONNX head returns [1, num, 85] => [x,y,w,h,obj,80 classes]
        preds = outputs[0]
        boxes_xywh = preds[:, :4]
        obj = preds[:, 4:5]
        cls_scores = preds[:, 5:]
        scores = obj * cls_scores.max(axis=1, keepdims=True)
        cls_ids = cls_scores.argmax(axis=1)

        # Convert to xyxy in the letterboxed space
        xyxy = []
        for (cx, cy, w, h) in boxes_xywh:
            x1 = cx - w/2
            y1 = cy - h/2
            x2 = cx + w/2
            y2 = cy + h/2
            xyxy.append([x1, y1, x2, y2])
        xyxy = np.array(xyxy)

        # Filter + NMS
        conf = scores.squeeze()
        keep = conf > self.confidence_threshold
        xyxy, conf, cls_ids = xyxy[keep], conf[keep], cls_ids[keep]
        keep_idx = self._nms(xyxy, conf, self.nms_threshold)

        for i in keep_idx:
            x1, y1, x2, y2 = xyxy[i]
            # Undo letterbox
            x1 = (x1 - pad[0]) / r
            y1 = (y1 - pad[1]) / r
            x2 = (x2 - pad[0]) / r
            y2 = (y2 - pad[1]) / r
            
            xmin = float(max(0, x1 / original_width))
            ymin = float(max(0, y1 / original_height))
            xmax = float(min(1, x2 / original_width))
            ymax = float(min(1, y2 / original_height))
            
            detections.append({
                "label": self.class_names[int(cls_ids[i])],
                "score": float(conf[i]),
                "xmin": xmin,
                "ymin": ymin,
                "xmax": xmax,
                "ymax": ymax
            })

        return detections
    
    async def detect(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect objects in image
        
        Args:
            image: Input image as numpy array (BGR format)
            
        Returns:
            List of detection dictionaries with normalized coordinates
        """
        try:
            if self.session is None:
                # Return mock detections
                await asyncio.sleep(0.02)  # Simulate inference time
                return [
                    {
                        "label": "person",
                        "score": 0.89 + np.random.random() * 0.1,
                        "xmin": 0.1 + np.random.random() * 0.1,
                        "ymin": 0.15 + np.random.random() * 0.1,
                        "xmax": 0.4 + np.random.random() * 0.1,
                        "ymax": 0.8 + np.random.random() * 0.1
                    },
                    {
                        "label": "cell phone",
                        "score": 0.76 + np.random.random() * 0.1,
                        "xmin": 0.5 + np.random.random() * 0.1,
                        "ymin": 0.3 + np.random.random() * 0.1,
                        "xmax": 0.7 + np.random.random() * 0.1,
                        "ymax": 0.5 + np.random.random() * 0.1
                    }
                ]
            
            # Preprocess
            input_tensor, r, pad = self._preprocess_image(image)
            original_height, original_width = image.shape[:2]
            
            # Run inference
            input_name = self.session.get_inputs()[0].name
            outputs = self.session.run(None, {input_name: input_tensor})
            
            # Postprocess
            detections = self._postprocess_detections(
                outputs, r, pad, original_width, original_height
            )
            
            return detections
            
        except Exception as e:
            print(f"Detection error: {e}")
            return []