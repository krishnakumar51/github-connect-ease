#!/usr/bin/env python3
"""
WebRTC VLM Detection Backend Server
Handles server-side object detection inference
"""

import asyncio
import json
import time
from typing import List, Dict, Any
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import cv2
import numpy as np
from io import BytesIO
from PIL import Image
import logging
from .inference import ObjectDetector

app = FastAPI(title="WebRTC VLM Detection API")
logging.basicConfig(level=logging.INFO)
# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize detector
detector = ObjectDetector()

class DetectionRequest(BaseModel):
    timestamp: int

class DetectionResult(BaseModel):
    frame_id: str
    capture_ts: int
    recv_ts: int
    inference_ts: int
    detections: List[Dict[str, Any]]

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.get("/")
async def root():
    return {"message": "WebRTC VLM Detection API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": int(time.time() * 1000)}

@app.post("/api/detect")
async def detect_objects(
    image: UploadFile = File(...),
    timestamp: int = None
):
    """
    Detect objects in uploaded image frame
    """
    try:
        recv_ts = int(time.time() * 1000)
        capture_ts = timestamp or recv_ts
        
        # Read image
        image_data = await image.read()
        pil_image = Image.open(BytesIO(image_data))
        
        # Convert to numpy array
        img_array = np.array(pil_image)
        if len(img_array.shape) == 3 and img_array.shape[2] == 4:
            img_array = img_array[:, :, :3]  # Remove alpha channel
        
        # Run inference
        inference_start = int(time.time() * 1000)
        detections = await detector.detect(img_array)
        inference_ts = int(time.time() * 1000)
        
        result = DetectionResult(
            frame_id=f"frame_{capture_ts}",
            capture_ts=capture_ts,
            recv_ts=recv_ts,
            inference_ts=inference_ts,
            detections=detections
        )
        
        return result.dict()
        
    except Exception as e:
        return {
            "error": str(e),
            "frame_id": f"error_{int(time.time() * 1000)}",
            "capture_ts": timestamp or int(time.time() * 1000),
            "recv_ts": int(time.time() * 1000),
            "inference_ts": int(time.time() * 1000),
            "detections": []
        }

@app.websocket("/ws/detect")
async def websocket_detect(websocket: WebSocket):
    """
    WebSocket endpoint for real-time detection
    """
    await manager.connect(websocket)
    try:
        while True:
            # Receive image data
            data = await websocket.receive_bytes()
            
            recv_ts = int(time.time() * 1000)
            
            # Decode image
            img_array = np.frombuffer(data, dtype=np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            
            if img is not None:
                # Run inference
                inference_start = int(time.time() * 1000)
                detections = await detector.detect(img)
                inference_ts = int(time.time() * 1000)
                
                result = {
                    "frame_id": f"ws_frame_{recv_ts}",
                    "capture_ts": recv_ts - 50,  # Estimated capture time
                    "recv_ts": recv_ts,
                    "inference_ts": inference_ts,
                    "detections": detections
                }
                
                await manager.send_personal_message(
                    json.dumps(result), 
                    websocket
                )
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

@app.get("/api/models/info")
async def model_info():
    """
    Get information about loaded models
    """
    return {
        "models": [
            {
                "name": "YOLOv8n",
                "version": "8.0.0",
                "input_size": [640, 640],
                "classes": 80,
                "precision": "fp32"
            }
        ],
        "device": "cpu",
        "backend": "onnxruntime"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )