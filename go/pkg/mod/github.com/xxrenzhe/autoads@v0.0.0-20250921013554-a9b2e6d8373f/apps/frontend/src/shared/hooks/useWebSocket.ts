import { useEffect, useState } from 'react';

export const useWebSocket = (url: string) => {
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    // WebSocket logic
    return undefined;
  }, [url]);
  
  return { isConnected };
};

export const useWebSocketSubscription = (url: string, onMessage: (data: any) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    let ws: WebSocket;
    
    if (typeof window !== 'undefined') {
      ws = new WebSocket(url);
      
      ws.onopen = () => setIsConnected(true);
      ws.onclose = () => setIsConnected(false);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onMessage(data);
      };
      
      return () => {
        ws.close();
      };
    }
    
    return undefined;
  }, [url, onMessage]);
  
  return { isConnected };
};
