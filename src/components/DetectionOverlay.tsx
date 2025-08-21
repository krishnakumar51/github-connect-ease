import { useEffect, useRef } from 'react';
import { Detection } from '@/types/detection';

interface DetectionOverlayProps {
  detections: Detection[];
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export const DetectionOverlay: React.FC<DetectionOverlayProps> = ({
  detections,
  videoRef,
  canvasRef
}) => {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) {
      console.log('❌ Canvas or video not available for overlay');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('❌ Canvas context not available');
      return;
    }

    // Set canvas dimensions to match video
    const videoWidth = video.videoWidth || video.clientWidth || 640;
    const videoHeight = video.videoHeight || video.clientHeight || 480;
    
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    console.log(`🎨 Drawing ${detections.length} detections on ${canvas.width}x${canvas.height} canvas`);

    // Draw detection boxes
    detections.forEach((detection, index) => {
      const { xmin, ymin, xmax, ymax, label, score } = detection;
      
      // Convert normalized coordinates to pixel coordinates
      const x = xmin * canvas.width;
      const y = ymin * canvas.height;
      const width = (xmax - xmin) * canvas.width;
      const height = (ymax - ymin) * canvas.height;

      console.log(`📦 Detection ${index}: ${label} at (${x.toFixed(1)}, ${y.toFixed(1)}) size ${width.toFixed(1)}x${height.toFixed(1)}`);

      // Box styling - bright and visible
      ctx.strokeStyle = '#00ff00'; // Bright green for visibility
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(0, 255, 0, 0.1)'; // Semi-transparent green

      // Draw bounding box
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);

      // Label background
      const labelText = `${label} ${(score * 100).toFixed(1)}%`;
      ctx.font = '14px Inter, system-ui, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const labelWidth = textMetrics.width + 12;
      const labelHeight = 24;

      // Label background - bright and visible
      ctx.fillStyle = '#00ff00'; // Bright green background
      ctx.fillRect(x, y - labelHeight, labelWidth, labelHeight);

      // Label text - high contrast black text
      ctx.fillStyle = '#000000'; // Black text on green background
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, x + 6, y - labelHeight / 2);
    });
  }, [detections, videoRef]);

  return (
    <canvas
      ref={overlayCanvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover'
      }}
    />
  );
};