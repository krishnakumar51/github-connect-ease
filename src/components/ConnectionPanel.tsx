import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { QrCode, Smartphone, Copy, Check, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ConnectionPanelProps {
  connectionUrl: string;
  qrCodeData: string;
  isConnected: boolean;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
}

export const ConnectionPanel: React.FC<ConnectionPanelProps> = ({
  connectionUrl,
  qrCodeData,
  isConnected,
  onConnect,
  onDisconnect
}) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(connectionUrl);
      setCopied(true);
      toast({
        title: "URL Copied",
        description: "Connection URL copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy URL to clipboard",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="p-6 bg-gradient-surface border-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          Phone Connection
        </h2>
        <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-2">
          {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {isConnected ? 'Connected' : 'Waiting'}
        </Badge>
      </div>

      {/* QR Code */}
      <div className="flex justify-center mb-6">
        <div className="p-4 bg-white rounded-lg shadow-inner">
          {qrCodeData && (
            <img 
              src={qrCodeData} 
              alt="Connection QR Code"
              className="w-48 h-48"
            />
          )}
        </div>
      </div>

      {/* Connection URL */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Connection URL
          </label>
          <div className="flex gap-2">
            <Input 
              value={connectionUrl}
              readOnly
              className="flex-1 font-mono text-sm"
            />
            <Button 
              onClick={copyToClipboard}
              variant="outline"
              size="icon"
              className="shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-4 mb-6 p-4 bg-muted rounded-lg">
        <h3 className="text-sm font-medium">Connection Instructions:</h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Scan the QR code with your phone camera</li>
          <li>Allow camera permissions when prompted</li>
          <li>Keep your phone and laptop on the same network</li>
          <li>Point your camera at objects to detect</li>
        </ol>
      </div>

      {/* Connection Controls */}
      <div className="flex gap-2">
        {!isConnected ? (
          <Button 
            onClick={onConnect}
            className="flex-1 bg-gradient-primary hover:shadow-glow transition-all duration-300"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Start Connection
          </Button>
        ) : (
          <Button 
            onClick={onDisconnect}
            variant="destructive"
            className="flex-1"
          >
            Disconnect
          </Button>
        )}
      </div>

      {/* Network Info */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Ensure both devices are on the same Wi-Fi network</p>
          <p>• Use Chrome on Android or Safari on iOS for best compatibility</p>
          <p>• If connection fails, try using ngrok for tunneling</p>
        </div>
      </div>
    </Card>
  );
};