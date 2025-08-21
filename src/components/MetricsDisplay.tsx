import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Download, Activity, Clock, Zap, Wifi } from 'lucide-react';
import { Metrics } from '@/types/metrics';

interface MetricsDisplayProps {
  metrics: Metrics;
  isProcessing: boolean;
  onExportMetrics: () => void;
}

export const MetricsDisplay: React.FC<MetricsDisplayProps> = ({
  metrics,
  isProcessing,
  onExportMetrics
}) => {
  const formatLatency = (ms: number) => `${ms.toFixed(1)}ms`;
  const formatBandwidth = (kbps: number) => `${kbps.toFixed(1)} kbps`;

  return (
    <Card className="p-6 bg-gradient-surface border-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Performance Metrics
        </h2>
        <Button 
          onClick={onExportMetrics}
          variant="outline" 
          size="sm"
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Export JSON
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* End-to-End Latency */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            E2E Latency
          </div>
          <div className="space-y-1">
            <div className="text-lg font-semibold">{formatLatency(metrics.latency.median)}</div>
            <div className="text-xs text-muted-foreground">
              P95: {formatLatency(metrics.latency.p95)}
            </div>
          </div>
          <Progress 
            value={Math.min((metrics.latency.median / 200) * 100, 100)} 
            className="h-2"
          />
        </div>

        {/* Processing FPS */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="w-4 h-4" />
            Processing FPS
          </div>
          <div className="space-y-1">
            <div className="text-lg font-semibold">{metrics.fps.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">
              Target: 15 FPS
            </div>
          </div>
          <Progress 
            value={(metrics.fps / 30) * 100} 
            className="h-2"
          />
        </div>

        {/* Uplink Bandwidth */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wifi className="w-4 h-4" />
            Uplink
          </div>
          <div className="space-y-1">
            <div className="text-lg font-semibold">{formatBandwidth(metrics.bandwidth.uplink)}</div>
            <div className="text-xs text-muted-foreground">
              Upload rate
            </div>
          </div>
          <Progress 
            value={Math.min((metrics.bandwidth.uplink / 1000) * 100, 100)} 
            className="h-2"
          />
        </div>

        {/* Downlink Bandwidth */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wifi className="w-4 h-4" />
            Downlink
          </div>
          <div className="space-y-1">
            <div className="text-lg font-semibold">{formatBandwidth(metrics.bandwidth.downlink)}</div>
            <div className="text-xs text-muted-foreground">
              Download rate
            </div>
          </div>
          <Progress 
            value={Math.min((metrics.bandwidth.downlink / 1000) * 100, 100)} 
            className="h-2"
          />
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Network Performance</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Server Latency:</span>
              <span>{formatLatency(metrics.serverLatency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Network Latency:</span>
              <span>{formatLatency(metrics.networkLatency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frames Processed:</span>
              <span>{metrics.framesProcessed}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">System Status</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant={isProcessing ? 'default' : 'secondary'}>
              {isProcessing ? 'Processing' : 'Idle'}
            </Badge>
            <Badge variant={metrics.fps > 10 ? 'default' : 'destructive'}>
              {metrics.fps > 10 ? 'Good FPS' : 'Low FPS'}
            </Badge>
            <Badge variant={metrics.latency.median < 150 ? 'default' : 'destructive'}>
              {metrics.latency.median < 150 ? 'Low Latency' : 'High Latency'}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
};