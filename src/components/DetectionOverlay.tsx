import React, { useEffect, useRef } from 'react';
import { Detection } from '@/types/detection';

// YOLOv13-inspired color palette for detections
const DETECTION_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF',
  '#5F27CD', '#00D2D3', '#FF9F43', '#10AC84', '#EE5A24', '#0ABDE3', '#C44569',
  '#F8B500', '#6C5CE7', '#A55EEA', '#26D0CE', '#FD79A8', '#E17055', '#81ECEC',
  '#74B9FF', '#0984E3', '#B2BEC3', '#DDD', '#636E72', '#2D3436'
];

interface DetectionOverlayProps {
  detections: Detection[];
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

// Hash function for consistent color assignment based on class name
const getColorForClass = (className: string): string => {
  let hash = 0;
  for (let i = 0; i < className.length; i++) {
    hash = className.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DETECTION_COLORS[Math.abs(hash) % DETECTION_COLORS.length];
};

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

      // Draw detections with YOLOv13-style visualization
      detections.forEach((detection, index) => {
        const { xmin, ymin, xmax, ymax, label, score } = detection;
        
        // Convert normalized coordinates to pixel coordinates
        const x = xmin * canvas.width;
        const y = ymin * canvas.height;
        const width = (xmax - xmin) * canvas.width;
        const height = (ymax - ymin) * canvas.height;

        console.log(`📦 Detection ${index}: ${label} at (${x.toFixed(1)}, ${y.toFixed(1)}) size ${width.toFixed(1)}x${height.toFixed(1)}`);

        // Get consistent color for this class
        const color = getColorForClass(label);
        
        // Convert hex to RGB for alpha blending
        const hexToRgb = (hex: string) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          } : { r: 0, g: 255, b: 0 };
        };
        
        const rgb = hexToRgb(color);

        // Draw filled background with low opacity
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
        ctx.fillRect(x, y, width, height);

        // Draw border with higher opacity
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Prepare label text
        const labelText = `${label} ${(score * 100).toFixed(1)}%`;
        ctx.font = 'bold 14px Inter, system-ui, sans-serif';
        
        // Measure text for background
        const textMetrics = ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const textHeight = 16;
        const padding = 8;
        
        // Calculate label position (above the box, or below if near top)
        const labelY = y > textHeight + padding ? y - padding : y + height + textHeight + padding;
        const labelX = x;

        // Draw label background
        ctx.fillStyle = color;
        ctx.fillRect(labelX, labelY - textHeight, textWidth + padding * 2, textHeight + padding);

        // Draw label text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, labelX + padding, labelY - textHeight/2);

        // Draw confidence indicator (small filled circle)
        const confidence = score;
        const indicatorSize = 8;
        const indicatorX = x + width - indicatorSize - 6;
        const indicatorY = y + 6;
        
        ctx.beginPath();
        ctx.arc(indicatorX, indicatorY + indicatorSize/2, indicatorSize/2, 0, 2 * Math.PI);
        ctx.fillStyle = confidence > 0.8 ? '#00FF00' : confidence > 0.6 ? '#FFA500' : '#FF4444';
        ctx.fill();
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