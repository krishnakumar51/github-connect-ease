import { useEffect, useRef, useCallback } from "react"
import Webcam from "react-webcam"

const videoConstraints = {
  width: 640,
  height: 480,
  facingMode: "environment",
}

const WasmCamera = () => {
  const webcamRef = useRef<Webcam>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    // Initialize YOLO Worker with WASM
    try {
      workerRef.current = new Worker(
        new URL("../workers/wasmYoloWorker.ts", import.meta.url),
        { type: "module" }
      )

      workerRef.current.onmessage = (event) => {
        const { status, output, error } = event.data

        if (error) {
          console.error("WASM Worker error:", error)
          return
        }

        if (status === "complete") {
          const detections = JSON.parse(output)
          console.log("🎯 WASM Detections:", detections)
          drawDetections(detections, 640, 480)
        }
      }

      console.log("✅ WASM Worker initialized")
    } catch (error) {
      console.error("❌ Failed to initialize WASM Worker:", error)
    }

    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  const base64ToUint8Array = (base64: string) => {
    const binaryString = window.atob(base64.split(",")[1])
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }

  const drawDetections = (detections: any[], width: number, height: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")

    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      canvas.width = width
      canvas.height = height

      detections.forEach((detection) => {
        const [label, bbox] = detection
        const { xmin, xmax, ymin, ymax, confidence } = bbox

        // YOLOv13-style colorful boxes
        const colors = [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', 
          '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43'
        ]
        const colorIndex = label.charCodeAt(0) % colors.length
        const color = colors[colorIndex]

        ctx.strokeStyle = color
        ctx.lineWidth = 3
        ctx.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin)

        // Semi-transparent fill
        ctx.fillStyle = color + '30'
        ctx.fillRect(xmin, ymin, xmax - xmin, ymax - ymin)

        // Label background
        ctx.fillStyle = color
        const labelText = `${label} (${(confidence * 100).toFixed(1)}%)`
        ctx.font = "bold 14px Inter, Arial, sans-serif"
        const textMetrics = ctx.measureText(labelText)
        const labelWidth = textMetrics.width + 12
        const labelHeight = 20

        ctx.fillRect(xmin, Math.max(0, ymin - labelHeight), labelWidth, labelHeight)

        // Label text
        ctx.fillStyle = "#FFFFFF"
        ctx.fillText(labelText, xmin + 6, Math.max(14, ymin - 6))

        // Confidence indicator
        const indicatorSize = 6
        ctx.beginPath()
        ctx.arc(xmax - 10, ymin + 10, indicatorSize, 0, 2 * Math.PI)
        ctx.fillStyle = confidence > 0.8 ? '#00FF00' : confidence > 0.6 ? '#FFA500' : '#FF4444'
        ctx.fill()
      })
    }
  }

  const processFrameWithWorker = useCallback(() => {
    if (webcamRef.current && workerRef.current) {
      const imageSrc = webcamRef.current.getScreenshot({ width: 640, height: 480 })
      
      if (imageSrc) {
        console.log("📸 Capturing frame for WASM processing")
        const imageData = base64ToUint8Array(imageSrc)

        workerRef.current.postMessage({
          imageData,
          confidence: 0.5,
          iouThreshold: 0.5,
        })
      } else {
        console.log("❌ Failed to capture webcam image")
      }
    }
  }, [])

  useEffect(() => {
    // Process frames at 2 FPS for WASM (slower but more stable)
    const interval = setInterval(() => {
      processFrameWithWorker()
    }, 500)
    
    return () => clearInterval(interval)
  }, [processFrameWithWorker])

  return (
    <div className="relative w-[640px] h-[480px] mx-auto border-2 border-primary rounded-lg overflow-hidden">
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={videoConstraints}
        className="absolute top-0 left-0 w-full h-full object-cover z-10"
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full z-20 pointer-events-none"
      />
      <div className="absolute bottom-2 left-2 z-30 bg-black/50 text-white px-2 py-1 rounded text-sm">
        🧠 WASM + YOLOv8 Live Detection
      </div>
    </div>
  )
}

export default WasmCamera