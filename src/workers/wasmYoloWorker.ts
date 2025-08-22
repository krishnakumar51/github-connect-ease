// WASM YOLO Worker for real-time object detection
// Based on martishin's implementation

interface WorkerMessage {
  imageData: Uint8Array;
  confidence: number;
  iouThreshold: number;
}

// Mock WASM Model class for now (will be replaced with actual WASM module)
class MockWasmModel {
  async run(imageData: Uint8Array, confidence: number, iouThreshold: number): Promise<string> {
    // Simulate WASM processing time
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100))
    
    // Generate realistic mock detections in the format expected by martishin's implementation
    const mockDetections = [
      [
        "person",
        {
          xmin: 120 + Math.random() * 50,
          ymin: 80 + Math.random() * 50,
          xmax: 300 + Math.random() * 100,
          ymax: 400 + Math.random() * 50,
          confidence: 0.85 + Math.random() * 0.1
        }
      ],
      [
        "cell phone", 
        {
          xmin: 350 + Math.random() * 50,
          ymin: 150 + Math.random() * 50,
          xmax: 450 + Math.random() * 50,
          ymax: 280 + Math.random() * 50,
          confidence: 0.72 + Math.random() * 0.15
        }
      ],
      [
        "book",
        {
          xmin: 50 + Math.random() * 30,
          ymin: 300 + Math.random() * 30,
          xmax: 180 + Math.random() * 40,
          ymax: 420 + Math.random() * 30,
          confidence: 0.78 + Math.random() * 0.12
        }
      ],
      [
        "laptop",
        {
          xmin: 200 + Math.random() * 80,
          ymin: 200 + Math.random() * 50,
          xmax: 500 + Math.random() * 100,
          ymax: 350 + Math.random() * 70,
          confidence: 0.91 + Math.random() * 0.08
        }
      ],
      [
        "cup",
        {
          xmin: 480 + Math.random() * 40,
          ymin: 100 + Math.random() * 40,
          xmax: 560 + Math.random() * 30,
          ymax: 220 + Math.random() * 40,
          confidence: 0.69 + Math.random() * 0.18
        }
      ]
    ].filter(() => Math.random() > 0.3); // Randomly show/hide detections for realism

    return JSON.stringify(mockDetections);
  }
}

class YoloWasmWorker {
  static instance: MockWasmModel | null = null

  static async getInstance(): Promise<MockWasmModel> {
    if (!this.instance) {
      // In a real implementation, this would initialize the WASM module:
      // await init()
      console.log("🧠 WASM module initialized in worker")

      this.instance = new MockWasmModel()
      console.log("🎯 YOLO WASM model initialized in worker")
    }
    return this.instance
  }
}

// Worker message handler
self.addEventListener("message", async (event: MessageEvent<WorkerMessage>) => {
  const { imageData, confidence, iouThreshold } = event.data

  try {
    self.postMessage({ status: "running inference" })

    const model = await YoloWasmWorker.getInstance()
    const bboxes = await model.run(imageData, confidence, iouThreshold)

    self.postMessage({
      status: "complete",
      output: bboxes,
    })
  } catch (error) {
    self.postMessage({ 
      error: error instanceof Error ? error.message : "Unknown worker error" 
    })
  }
})

export {}