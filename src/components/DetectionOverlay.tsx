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

    // Wait for video to load before getting dimensions
    const updateCanvas = () => {
      const videoWidth = video.videoWidth || video.clientWidth || 640;
      const videoHeight = video.videoHeight || video.clientHeight || 480;
      
      // Set canvas resolution to match video
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      
      // Set canvas display size to match container
      canvas.style.width = '100%';
      canvas.style.height = '100%';

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
        ctx.lineWidth = 4;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.15)'; // Semi-transparent green

        // Draw bounding box
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);

        // Label background
        const labelText = `${label} ${(score * 100).toFixed(1)}%`;
        ctx.font = 'bold 16px Inter, system-ui, sans-serif';
        const textMetrics = ctx.measureText(labelText);
        const labelWidth = textMetrics.width + 16;
        const labelHeight = 28;

        // Label background - bright and visible
        ctx.fillStyle = '#00ff00'; // Bright green background
        ctx.fillRect(x, Math.max(0, y - labelHeight), labelWidth, labelHeight);

        // Label text - high contrast black text
        ctx.fillStyle = '#000000'; // Black text on green background
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, x + 8, Math.max(14, y - labelHeight / 2));
      });
    };

    // Update immediately if video has dimensions
    if (video.videoWidth && video.videoHeight) {
      updateCanvas();
    }

    // Also listen for video metadata changes
    const handleLoadedMetadata = () => {
      console.log('📺 Video metadata loaded, updating canvas dimensions');
      updateCanvas();
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    // Force update after a short delay for fallback
    const timeoutId = setTimeout(updateCanvas, 100);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      clearTimeout(timeoutId);
    };
  }, [detections, videoRef]);

  return (
    <canvas
      ref={overlayCanvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        position: 'absolute',
        top: 0,
        left: 0
      }}
    />
  );
};