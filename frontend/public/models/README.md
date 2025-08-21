# ONNX Models Directory

This directory should contain the YOLOv8n ONNX model file.

## Getting the YOLOv8n ONNX Model

### Option 1: Export from Ultralytics YOLOv8
```bash
pip install ultralytics
```

```python
from ultralytics import YOLO

# Load a YOLOv8n PyTorch model
model = YOLO('yolov8n.pt')

# Export the model to ONNX format
model.export(format='onnx')
```

### Option 2: Download from Hugging Face
Visit: https://huggingface.co/Ultralytics/YOLOv8/tree/main
Download the yolov8n.pt file and convert it using the method above.

### Option 3: Use pre-converted ONNX models
Check community repositories like:
- https://github.com/ultralytics/ultralytics
- https://github.com/ibaiGorordo/ONNX-YOLOv8-Object-Detection

## File Structure
Place the model file as:
```
frontend/public/models/yolov8n.onnx
```

The web worker will automatically load this model for WASM inference.