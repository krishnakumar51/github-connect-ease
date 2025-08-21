# WebRTC VLM Multi-Object Detection

Real-time multi-object detection system that streams video from phone cameras via WebRTC and displays detection overlays in near real-time. Supports both server-side inference and on-device WASM processing.

## 🚀 Quick Start

**One-command setup:**

```bash
./start.sh
```

**For server-side inference:**

```bash
./start.sh --mode=server
```

**With phone connectivity (ngrok tunneling):**

```bash
./start.sh --ngrok
```

## 📱 Phone Connection Instructions

### Option 1: Same Network (Recommended)
1. Start the system: `./start.sh`
2. Open http://localhost:3000 on your laptop
3. Find your laptop's IP address:
   - **macOS:** System Preferences → Network
   - **Linux:** `ip addr` or `ifconfig`
   - **Windows:** `ipconfig`
4. On your phone, navigate to `http://YOUR_IP:3000`
5. Allow camera permissions when prompted

### Option 2: Ngrok Tunneling
1. Start with ngrok: `./start.sh --ngrok`
2. Scan the QR code displayed on the interface
3. Or use the provided ngrok URL directly

### Supported Browsers
- **Android:** Chrome (recommended)
- **iOS:** Safari
- Desktop: Chrome, Firefox, Edge

## 🏃 Benchmarking

Run a 30-second benchmark to collect metrics:

```bash
./bench/run_bench.sh --duration 30 --mode wasm
```

For server mode:

```bash
./bench/run_bench.sh --duration 30 --mode server
```

Results are saved to `bench/results/metrics-[timestamp].json`

## 🔧 Mode Switching

### WASM Mode (Default - Low Resource)
- On-device processing using ONNX Runtime Web
- Lower bandwidth usage
- Works without internet after initial load
- Suitable for modest hardware (Intel i5, 8GB RAM)

```bash
./start.sh --mode=wasm
```

### Server Mode (Higher Performance)
- Server-side inference with Python backend
- Higher accuracy potential
- Requires more server resources
- Better for high-throughput scenarios

```bash
./start.sh --mode=server
```

## 📊 API Contract

Detection results follow this JSON format:

```json
{
  "frame_id": "string_or_int",
  "capture_ts": 1690000000000,
  "recv_ts": 1690000000100,
  "inference_ts": 1690000000120,
  "detections": [
    {
      "label": "person",
      "score": 0.93,
      "xmin": 0.12,
      "ymin": 0.08,
      "xmax": 0.34,
      "ymax": 0.67
    }
  ]
}
```

Coordinates are normalized [0..1] for resolution independence.

## 🏗️ Architecture

```
┌─────────────────┐    WebRTC     ┌─────────────────┐
│  Phone Camera   │──────────────▶│   Browser UI    │
└─────────────────┘               └─────────────────┘
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │  Detection      │
                                  │  Engine         │
                                  │                 │
                                  │  ┌─────────────┐│
                                  │  │ WASM Mode   ││
                                  │  │ (On-device) ││
                                  │  └─────────────┘│
                                  │  ┌─────────────┐│
                                  │  │Server Mode  ││
                                  │  │(Python API) ││
                                  │  └─────────────┘│
                                  └─────────────────┘
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │  Real-time      │
                                  │  Overlay        │
                                  └─────────────────┘
```

## 🛠️ Development Setup

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Python 3.9+ (for backend development)

### Local Development

1. **Clone and setup:**
   ```bash
   git clone <repository>
   cd webrtc-vlm-detection
   chmod +x start.sh bench/run_bench.sh
   ```

2. **Frontend development:**
   ```bash
   npm install
   npm run dev
   ```

3. **Backend development:**
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

### Docker Development

```bash
# Build and run all services
docker-compose up --build

# Run specific services
docker-compose up frontend
docker-compose up backend

# View logs
docker-compose logs -f
```

## 📈 Performance Metrics

The system tracks:

- **End-to-End Latency:** `overlay_display_ts - capture_ts`
- **Server Latency:** `inference_ts - recv_ts` 
- **Network Latency:** `recv_ts - capture_ts`
- **Processing FPS:** Frames with detections per second
- **Bandwidth:** Uplink/downlink during operation

### Benchmark Results Format

```json
{
  "benchmark_info": {
    "duration_seconds": 30,
    "mode": "wasm",
    "frames_processed": 450
  },
  "latency_metrics": {
    "median_ms": 45,
    "p95_ms": 78
  },
  "performance_metrics": {
    "processed_fps": 15.0,
    "efficiency_percent": 100.0
  },
  "bandwidth_metrics": {
    "uplink_kbps": 250,
    "downlink_kbps": 500
  }
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Detection mode
MODE=wasm|server

# API endpoints (for frontend)
REACT_APP_API_URL=http://localhost:8000

# Model configuration (backend)
MODEL_PATH=/app/models/yolov8n.onnx
CONFIDENCE_THRESHOLD=0.5
```

### Low-Resource Optimizations

**WASM Mode Optimizations:**
- Input resolution: 320×240 (configurable)
- Processing rate: 10-15 FPS
- Frame queue: Drop old frames when overloaded
- Model: Quantized YOLOv8n (~6MB)

**Performance Tuning:**
```javascript
// Adjust in frontend config
const CONFIG = {
  targetFPS: 15,
  inputWidth: 320,
  inputHeight: 240,
  confidenceThreshold: 0.5,
  maxFrameQueue: 3
};
```

## 🚨 Troubleshooting

### Phone Won't Connect
- Ensure devices are on same Wi-Fi network
- Check firewall settings (ports 3000, 8000)
- Try ngrok mode: `./start.sh --ngrok`
- Use Chrome on Android, Safari on iOS

### High CPU Usage
- Switch to WASM mode: `./start.sh --mode=wasm`
- Reduce resolution in configuration
- Lower target FPS

### Misaligned Overlays
- Verify `capture_ts` timestamps are consistent
- Check video element dimensions match canvas
- Ensure coordinate normalization is correct

### WebRTC Issues
- Check browser console for WebRTC errors
- Visit `chrome://webrtc-internals/` for debugging
- Verify STUN server connectivity

### Performance Issues
```bash
# Check system resources
docker stats

# View detailed logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Run diagnostics
curl http://localhost:8000/health
curl http://localhost:3000
```

## 📦 Models & Assets

### WASM Mode
- Model: YOLOv8n ONNX (~6MB)
- Location: `frontend/public/models/yolov8n.onnx`
- Runtime: ONNX Runtime Web

### Server Mode  
- Model: YOLOv8n ONNX
- Location: `backend/models/yolov8n.onnx`
- Runtime: ONNX Runtime Python

Models are automatically downloaded during setup.

## 🔐 Security Considerations

- WebRTC uses DTLS encryption for media
- No persistent data storage by default
- CORS configured for development (adjust for production)
- Consider HTTPS/WSS for production deployment

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push branch: `git push origin feature/new-feature`
5. Submit pull request

---

## 📚 Additional Documentation

- [Performance Optimization Guide](docs/performance.md)
- [Deployment Guide](docs/deployment.md)  
- [API Reference](docs/api.md)
- [Troubleshooting Guide](docs/troubleshooting.md)