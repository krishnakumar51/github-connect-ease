import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  stream: MediaStream | null;
  className?: string;
  onMetadata?: (metadata: { width: number; height: number; duration: number }) => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ stream, className, onMetadata }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => videoRef.current!);

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !stream) return;

      video.srcObject = stream;
      
      const handleLoadedMetadata = () => {
        onMetadata?.({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration
        });
      };

      const handleCanPlay = () => {
        video.play().catch(console.error);
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('canplay', handleCanPlay);

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('canplay', handleCanPlay);
      };
    }, [stream, onMetadata]);

    return (
      <video
        ref={videoRef}
        className={cn(
          "w-full h-full object-cover rounded-lg",
          "border-2 border-stream-border shadow-elevation",
          className
        )}
        autoPlay
        playsInline
        muted
      />
    );
  }
);