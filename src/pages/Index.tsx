import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VideoPlayer } from '@/components/VideoPlayer';
import { DetectionOverlay } from '@/components/DetectionOverlay';
import { ConnectionPanel } from '@/components/ConnectionPanel';
import { MetricsDisplay } from '@/components/MetricsDisplay';
import { useObjectDetection } from '@/hooks/useObjectDetection';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useMetrics } from '@/hooks/useMetrics';
import WasmCamera from '@/components/WasmCamera';
import { DetectionMode } from '@/types/detection';

const Index = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<DetectionMode>('wasm');
  const [showWasmDemo, setShowWasmDemo] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const { connect, disconnect, localStream, remoteStream, isConnected } = useWebRTC();
  const { detections, isProcessing, isModelLoaded, startDetection, stopDetection } = useObjectDetection(mode);
  const { startBenchmark, stopBenchmark, metrics } = useMetrics();

  const handleStartSession = useCallback(async () => {
    try {
      await connect();
      // Use localStream after connection is established
      await startDetection(localStream);
      setIsRecording(true);
      startBenchmark();
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  }, [connect, startDetection, localStream, startBenchmark]);

  const handleStopSession = useCallback(async () => {
    try {
      await stopDetection();
      await disconnect();
      setIsRecording(false);
      stopBenchmark();
    } catch (error) {
      console.error('Failed to stop session:', error);
    }
  }, [stopDetection, disconnect, stopBenchmark]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            🎯 YOLOv13 Real-Time Object Detection
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Advanced object detection with WASM + WebRTC streaming. Choose your detection mode below.
          </p>
          
          {/* Mode Selection */}
          <div className="flex gap-4 justify-center">
            <Button
              variant={showWasmDemo ? "default" : "outline"}
              onClick={() => setShowWasmDemo(true)}
              className="gap-2"
            >
              🧠 WASM Demo (Direct)
            </Button>
            <Button
              variant={!showWasmDemo ? "default" : "outline"}
              onClick={() => setShowWasmDemo(false)}
              className="gap-2"
            >
              📡 WebRTC Mode
            </Button>
          </div>
        </div>

        {showWasmDemo ? (
          /* WASM Direct Demo */
          <div className="space-y-6">
            <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🧠 Direct WASM Object Detection
                  <Badge variant="secondary">Live</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <WasmCamera />
              </CardContent>
            </Card>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                ✅ This demo runs YOLOv8 directly in your browser with WebAssembly
              </p>
            </div>
          </div>
        ) : (
          /* Original WebRTC Mode */
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Panel - Controls */}
            <div className="space-y-6">
              <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                <CardHeader>
                  <CardTitle>🔌 Connection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <Badge variant={isConnected ? "default" : "secondary"}>
                      {isConnected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {!isRecording ? (
                      <Button onClick={handleStartSession} className="flex-1">
                        Start Detection
                      </Button>
                    ) : (
                      <Button onClick={handleStopSession} variant="destructive" className="flex-1">
                        Stop Detection
                      </Button>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Mode: <Badge variant="outline">{mode}</Badge>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                <CardHeader>
                  <CardTitle>📊 Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Detections:</span>
                      <Badge>{detections.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Processing:</span>
                      <Badge variant={isProcessing ? "default" : "secondary"}>
                        {isProcessing ? "Active" : "Idle"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Model:</span>
                      <Badge variant={isModelLoaded ? "default" : "destructive"}>
                        {isModelLoaded ? "Loaded" : "Not Loaded"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Center Panel - Video Feed */}
            <div className="lg:col-span-2">
              <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    📹 Video Feed
                    {isRecording && <Badge variant="destructive">Recording</Badge>}
                    {isProcessing && <Badge variant="secondary">Processing</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                    <VideoPlayer
                      ref={videoRef}
                      stream={localStream || remoteStream}
                      className="w-full h-full object-cover"
                    />
                    <DetectionOverlay
                      detections={detections}
                      videoRef={videoRef}
                      canvasRef={canvasRef}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 w-full h-full pointer-events-none hidden"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>🚀 Powered by YOLOv13, WebAssembly, and modern web technologies</p>
        </div>
      </div>
    </div>
  );
};

export default Index;