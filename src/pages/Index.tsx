import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VideoPlayer } from '@/components/VideoPlayer';
import { MetricsDisplay } from '@/components/MetricsDisplay';
import { ConnectionPanel } from '@/components/ConnectionPanel';
import { DetectionOverlay } from '@/components/DetectionOverlay';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useObjectDetection } from '@/hooks/useObjectDetection';
import { useMetrics } from '@/hooks/useMetrics';
import { QrCode, Smartphone, Activity, Zap } from 'lucide-react';
import QRCode from 'qrcode-generator';

const Index = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<'server' | 'wasm'>('wasm');
  const [connectionUrl, setConnectionUrl] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const {
    localStream,
    remoteStream,
    peerConnection,
    isConnected,
    connect,
    disconnect
  } = useWebRTC();
  
  const {
    detections,
    isProcessing,
    startDetection,
    stopDetection
  } = useObjectDetection(mode);
  
  const {
    metrics,
    startBenchmark,
    stopBenchmark,
    exportMetrics
  } = useMetrics();

  useEffect(() => {
    // Generate connection URL and QR code with current domain
    const currentHost = window.location.host;
    const protocol = window.location.protocol;
    const url = `${protocol}//${currentHost}/phone`;
    setConnectionUrl(url);
  }, []);

  const handleStartSession = useCallback(async () => {
    try {
      await connect();
      await startDetection(remoteStream || localStream);
      setIsRecording(true);
      startBenchmark();
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  }, [connect, startDetection, remoteStream, localStream, startBenchmark]);

  const handleStopSession = useCallback(async () => {
    try {
      stopDetection();
      disconnect();
      setIsRecording(false);
      stopBenchmark();
    } catch (error) {
      console.error('Failed to stop session:', error);
    }
  }, [stopDetection, disconnect, stopBenchmark]);

  const generateQRCode = useCallback(() => {
    const qr = QRCode(0, 'M');
    qr.addData(connectionUrl);
    qr.make();
    return qr.createDataURL(8);
  }, [connectionUrl]);

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                WebRTC VLM Detection
              </h1>
              <p className="text-muted-foreground mt-2">
                Real-time multi-object detection via phone streaming
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-2">
                <Activity className="w-4 h-4" />
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              <Badge variant={mode === 'wasm' ? 'default' : 'outline'} className="gap-2">
                <Zap className="w-4 h-4" />
                {mode.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Video Stream Panel */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 bg-gradient-surface border-border shadow-elevation">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Live Stream</h2>
                <div className="flex gap-2">
                  <Button
                    variant={mode === 'wasm' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode('wasm')}
                  >
                    WASM Mode
                  </Button>
                  <Button
                    variant={mode === 'server' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode('server')}
                  >
                    Server Mode
                  </Button>
                </div>
              </div>
              
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border-2 border-dashed border-border">
                {(remoteStream || localStream) ? (
                  <div className="relative w-full h-full">
                    <VideoPlayer
                      ref={videoRef}
                      stream={remoteStream || localStream}
                      className="w-full h-full object-cover"
                    />
                    <DetectionOverlay
                      detections={detections}
                      videoRef={videoRef}
                      canvasRef={canvasRef}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Smartphone className="w-12 h-12 mb-4" />
                    <p>No video stream detected</p>
                    <p className="text-sm">Connect your phone to start streaming</p>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-4 mt-6">
                {!isRecording ? (
                  <Button 
                    onClick={handleStartSession}
                    size="lg"
                    className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
                  >
                    Start Detection
                  </Button>
                ) : (
                  <Button 
                    onClick={handleStopSession}
                    variant="destructive"
                    size="lg"
                  >
                    Stop Detection
                  </Button>
                )}
              </div>
            </Card>

            {/* Metrics Panel */}
            <MetricsDisplay 
              metrics={metrics}
              isProcessing={isProcessing}
              onExportMetrics={exportMetrics}
            />
          </div>

          {/* Connection Panel */}
          <div className="space-y-6">
            <ConnectionPanel
              connectionUrl={connectionUrl}
              qrCodeData={generateQRCode()}
              isConnected={isConnected}
              onConnect={connect}
              onDisconnect={disconnect}
            />

            {/* Detection Info */}
            <Card className="p-6 bg-gradient-surface border-border">
              <h3 className="text-lg font-semibold mb-4">Detection Info</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Objects Detected:</span>
                  <Badge variant="outline">{detections.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing:</span>
                  <Badge variant={isProcessing ? 'default' : 'secondary'}>
                    {isProcessing ? 'Active' : 'Idle'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mode:</span>
                  <Badge variant="outline">{mode.toUpperCase()}</Badge>
                </div>
              </div>

              {detections.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-3">Recent Detections:</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {detections.slice(0, 5).map((detection, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                        <span className="text-sm">{detection.label}</span>
                        <Badge variant="secondary" className="text-xs">
                          {(detection.score * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;