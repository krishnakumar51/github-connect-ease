#!/bin/bash

# WebRTC VLM Detection - Start Script
# Usage: ./start.sh [--mode=wasm|server] [--ngrok] [--build] [--logs]

set -e

# Default configuration
MODE="wasm"
USE_NGROK=false
REBUILD=false
SHOW_LOGS=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --mode=*)
            MODE="${arg#*=}"
            shift
            ;;
        --ngrok)
            USE_NGROK=true
            shift
            ;;
        --build)
            REBUILD=true
            shift
            ;;
        --logs)
            SHOW_LOGS=true
            shift
            ;;
        --help)
            echo "Usage: ./start.sh [options]"
            echo "Options:"
            echo "  --mode=wasm|server  Set detection mode (default: wasm)"
            echo "  --ngrok            Enable ngrok tunneling for phone access"
            echo "  --build            Force rebuild containers"
            echo "  --logs             Show container logs after startup"
            echo "  --help             Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate mode
if [[ "$MODE" != "wasm" && "$MODE" != "server" ]]; then
    echo "Error: Mode must be 'wasm' or 'server'"
    exit 1
fi

echo "🚀 Starting WebRTC VLM Detection System"
echo "Mode: $MODE"
echo "Ngrok: $USE_NGROK"
echo ""

# Check dependencies
echo "📋 Checking dependencies..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

if [[ "$USE_NGROK" == true ]] && ! command -v ngrok &> /dev/null; then
    echo "⚠️  Ngrok is not installed. Installing ngrok..."
    # Add ngrok installation commands for different platforms
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install ngrok/ngrok/ngrok
        else
            echo "❌ Please install Homebrew or install ngrok manually"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
        echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
        sudo apt update && sudo apt install ngrok
    fi
fi

echo "✅ Dependencies check complete"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p backend/models
mkdir -p frontend/public/models
mkdir -p bench/results

# Download models if needed
echo "📦 Checking models..."
if [[ ! -f "frontend/public/models/yolov8n.onnx" ]] && [[ "$MODE" == "wasm" ]]; then
    echo "⬇️  Downloading YOLOv8n model for WASM mode..."
    curl -L -o frontend/public/models/yolov8n.onnx \
        "https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.onnx" || \
        echo "⚠️  Model download failed, will use mock detection"
fi

# Set environment variables
export MODE=$MODE

# Build and start containers
if [[ "$REBUILD" == true ]]; then
    echo "🔨 Rebuilding containers..."
    docker-compose down
    docker-compose build --no-cache
fi

echo "🐳 Starting Docker containers..."
if [[ "$MODE" == "server" ]]; then
    docker-compose up -d
else
    # WASM mode - frontend only
    docker-compose up -d frontend
fi

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Health check
echo "🏥 Performing health checks..."
if [[ "$MODE" == "server" ]]; then
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Backend service is healthy"
    else
        echo "❌ Backend service health check failed"
        docker-compose logs backend
        exit 1
    fi
fi

if curl -f http://localhost:3001 > /dev/null 2>&1; then
    echo "✅ Frontend service is healthy"
else
    echo "❌ Frontend service health check failed"
    docker-compose logs frontend
    exit 1
fi

# Setup ngrok if requested
NGROK_URL=""
if [[ "$USE_NGROK" == true ]]; then
    echo "🌐 Setting up ngrok tunnel..."
    ngrok http 3001 > /tmp/ngrok.log 2>&1 &
    NGROK_PID=$!
    
    # Wait for ngrok to start
    sleep 5
    
    # Get ngrok URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    url = data['tunnels'][0]['public_url']
    print(url)
except:
    print('Failed to get ngrok URL')
")
    
    if [[ "$NGROK_URL" == "Failed to get ngrok URL" ]] || [[ -z "$NGROK_URL" ]]; then
        echo "❌ Failed to setup ngrok tunnel"
        kill $NGROK_PID 2>/dev/null || true
        USE_NGROK=false
    else
        echo "✅ Ngrok tunnel active: $NGROK_URL"
    fi
fi

# Print connection information
echo ""
echo "🎉 WebRTC VLM Detection System is running!"
echo ""
echo "📱 Connection Information:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🖥️  Local access:     http://localhost:3001"

if [[ "$USE_NGROK" == true ]] && [[ ! -z "$NGROK_URL" ]]; then
    echo "📱 Phone access:     $NGROK_URL"
    echo ""
    echo "📋 Phone Instructions:"
    echo "   1. Open your phone's camera app"
    echo "   2. Scan the QR code displayed on the web interface"
    echo "   3. Or manually navigate to: $NGROK_URL"
    echo "   4. Allow camera permissions when prompted"
else
    echo "🏠 Network access:    http://[YOUR_IP]:3001"
    echo ""
    echo "📋 Phone Instructions:"
    echo "   1. Find your computer's IP address:"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "      macOS: System Preferences → Network"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "      Linux: ip addr show or ifconfig"
    else
        echo "      Windows: ipconfig"
    fi
    echo "   2. Replace [YOUR_IP] with actual IP (e.g., http://192.168.1.100:3001)"
    echo "   3. Navigate to this URL on your phone"
    echo "   4. Allow camera permissions when prompted"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚙️  Configuration:"
echo "   • Detection mode: $MODE"
echo "   • Frontend:       http://localhost:3001"
if [[ "$MODE" == "server" ]]; then
    echo "   • Backend API:    http://localhost:8000"
    echo "   • API docs:       http://localhost:8000/docs"
fi
echo ""

# Benchmarking instructions
echo "📊 Benchmarking:"
echo "   Run benchmark:    ./bench/run_bench.sh --duration 30 --mode $MODE"
echo "   Results will be saved to: bench/results/metrics-[timestamp].json"
echo ""

# Show logs if requested
if [[ "$SHOW_LOGS" == true ]]; then
    echo "📜 Container logs:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    docker-compose logs
fi

# Save cleanup function for ngrok only
cleanup() {
    echo ""
    echo "🧹 Shutting down..."
    if [[ "$USE_NGROK" == true ]] && [[ ! -z "$NGROK_PID" ]]; then
        kill $NGROK_PID 2>/dev/null || true
        echo "✅ Ngrok stopped"
    fi
    echo "✅ Cleanup complete"
}

# Keep script running for ngrok or exit cleanly for background mode
if [[ "$USE_NGROK" == true ]] && [[ ! -z "$NGROK_URL" ]]; then
    # Register cleanup function only for ngrok mode
    trap cleanup EXIT
    echo "🔄 System running... Press Ctrl+C to stop"
    wait
else
    echo "🔄 System is running in background"
    echo "   Use 'docker-compose logs -f' to view logs"
    echo "   Use 'docker-compose down' to stop"
    echo ""
    echo "✅ Containers will continue running until manually stopped"
fi