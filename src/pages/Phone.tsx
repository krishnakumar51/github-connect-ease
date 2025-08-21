import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, CameraOff, Wifi, WifiOff, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useObjectDetection } from '@/hooks/useObjectDetection';
import { DetectionOverlay } from '@/components/DetectionOverlay';

const Phone = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  
  // Prefer server mode if a backend URL is provided (Vite env)
  const preferredMode = ((import.meta as any)?.env?.VITE_API_URL) ? 'server' : 'wasm';
  const { detections, isProcessing, startDetection, stopDetection } = useObjectDetection(preferredMode as any);

  const startCamera = async () => {
    try {
      setError('');
      
      // Check for HTTPS requirement
      const isHttps = window.location.protocol === 'https:';
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (!isHttps && !isLocalhost) {
        throw new Error('Camera access requires HTTPS. Please use HTTPS or access via localhost.');
      }
      
      // Enhanced camera access check with better error handling
      if (!navigator.mediaDevices) {
        throw new Error('This browser does not support camera access. Please use a modern browser.');
      }
      
      if (!navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser.');
      }

      console.log('🎥 Requesting camera access...');

      // More flexible camera constraints with fallbacks
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Prefer back camera but allow front
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      };

      let mediaStream: MediaStream;
      try {
        console.log('Trying advanced camera constraints...');
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Advanced camera constraints successful');
      } catch (err) {
        // Fallback to basic constraints if advanced ones fail
        console.warn('Advanced camera constraints failed, falling back to basic:', err);
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
          console.log('✅ Basic camera constraints successful');
        } catch (basicErr) {
          console.error('❌ Both advanced and basic camera constraints failed:', basicErr);
          throw basicErr;
        }
      }

      setStream(mediaStream);
      console.log('📱 Camera stream created:', mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for video to be ready before starting detection
        videoRef.current.onloadedmetadata = () => {
          console.log('📹 Video metadata loaded, starting detection...');
          startDetection(mediaStream);
        };
      } else {
        console.log('🔍 Starting detection directly...');
        startDetection(mediaStream);
      }

      toast({
        title: "Camera Started",
        description: "Successfully connected to camera with object detection",
      });

    } catch (err) {
      let errorMessage = 'Failed to access camera';
      
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Provide more helpful error messages
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Camera permission denied. Please allow camera access and try again.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (err.name === 'NotSupportedError') {
          errorMessage = 'Camera not supported. Please use HTTPS or a supported browser.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Camera is already in use by another application.';
        }
      }
      
      setError(errorMessage);
      
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    stopDetection();
    setError('');

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    toast({
      title: "Camera Stopped",
      description: "Camera stream has been stopped",
    });
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="min-h-screen bg-gradient-surface p-4">
      {/* Header */}
      <header className="mb-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Smartphone className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Phone Camera
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Stream your camera to the detection system
          </p>
        </div>
      </header>

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="p-3 text-center bg-gradient-surface border-border">
          <div className="flex items-center justify-center gap-2 mb-1">
            {stream ? (
              <Camera className="w-5 h-5 text-success" />
            ) : (
              <CameraOff className="w-5 h-5 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">Camera</span>
          </div>
          <Badge variant={stream ? 'default' : 'secondary'}>
            {stream ? 'Active' : 'Stopped'}
          </Badge>
        </Card>

        <Card className="p-3 text-center bg-gradient-surface border-border">
          <div className="flex items-center justify-center gap-2 mb-1">
            {isProcessing ? (
              <Wifi className="w-5 h-5 text-success" />
            ) : (
              <WifiOff className="w-5 h-5 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">Detection</span>
          </div>
          <Badge variant={isProcessing ? 'default' : 'secondary'}>
            {isProcessing ? 'Active' : 'Waiting'}
          </Badge>
        </Card>
      </div>

      {/* Video Stream */}
      <Card className="mb-6 overflow-hidden bg-gradient-surface border-border">
        <div className="aspect-video bg-muted relative">
          {stream ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Detection Overlay */}
              <DetectionOverlay 
                detections={detections}
                videoRef={videoRef}
                canvasRef={canvasRef}
              />
              {/* Detection Counter */}
              {detections.length > 0 && (
                <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground px-2 py-1 rounded-md text-xs font-medium">
                  {detections.length} detection{detections.length !== 1 ? 's' : ''}
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <CameraOff className="w-12 h-12 mb-4" />
              <p className="text-lg font-medium mb-2">Camera Stopped</p>
                <p className="text-sm text-center px-4">
                Tap "Start Camera" below to begin streaming — using {preferredMode.toUpperCase()} inference
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="mb-6 p-4 bg-destructive/10 border-destructive/20">
          <p className="text-destructive text-sm font-medium mb-1">Camera Error</p>
          <p className="text-destructive/80 text-sm">{error}</p>
        </Card>
      )}

      {/* Controls */}
      <div className="space-y-4">
        {!stream ? (
          <Button 
            onClick={startCamera}
            size="lg"
            className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
          >
            <Camera className="w-5 h-5 mr-2" />
            Start Camera
          </Button>
        ) : (
          <Button 
            onClick={stopCamera}
            variant="destructive"
            size="lg"
            className="w-full"
          >
            <CameraOff className="w-5 h-5 mr-2" />
            Stop Camera
          </Button>
        )}

        {/* Instructions */}
        <Card className="p-4 bg-muted">
          <h3 className="font-medium mb-2">Instructions:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Allow camera access when prompted</li>
            <li>• Point camera at objects to detect</li>
            <li>• Keep phone steady for best results</li>
            <li>• Ensure good lighting conditions</li>
            <li>• Uses on-device WASM inference</li>
          </ul>
        </Card>

        {/* Detection Status */}
        {isProcessing && (
          <Card className="p-4 bg-success/10 border-success/20">
            <p className="text-success text-sm font-medium mb-1">
              ✅ Object Detection Active
            </p>
            <p className="text-success/80 text-sm">
              Processing camera stream with WASM inference
            </p>
            {detections.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-success/70">
                  Latest detections: {detections.map(d => `${d.label} (${Math.round(d.score * 100)}%)`).join(', ')}
                </p>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center">
        <p className="text-xs text-muted-foreground">
          WebRTC VLM Detection System
        </p>
      </footer>
    </div>
  );
};

export default Phone;