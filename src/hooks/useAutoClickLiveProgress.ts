'use client';

import { useEffect, useState } from 'react';

interface LiveProgressData {
  taskId: string;
  status: string;
  progress?: {
    total: {
      target: number;
      completed: number;
      percentage: number;
    };
    hourly?: {
      target: number;
      completed: number;
      failed: number;
      isRunning: boolean;
    };
    lastUpdate: string;
  };
  timestamp: string;
  error?: string;
}

export function useAutoClickLiveProgress(taskId: string, enabled: boolean = true) {
  const [data, setData] = useState<LiveProgressData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !taskId) {
      return;
    }

    let eventSource: EventSource | null = null;

    const connect = () => {
      try {
        eventSource = new EventSource(`/api/autoclick/tasks/${taskId}/live`);
        
        eventSource.onopen = () => {
          setIsConnected(true);
          setError(null);
        };

        eventSource.onmessage = (event) => {
          try {
            const parsedData: LiveProgressData = JSON.parse(event.data);
            setData(parsedData);
            setError(null);
          } catch (err) {
            console.error('Error parsing SSE data:', err);
            setError('Failed to parse progress data');
          }
        };

        eventSource.onerror = (err) => {
          console.error('EventSource error:', err);
          setIsConnected(false);
          setError('Connection lost');
          
          // 尝试重连
          if (eventSource) {
            eventSource.close();
          }
          
          // 5秒后重连
          setTimeout(connect, 5000);
        };

      } catch (err) {
        console.error('Failed to create EventSource:', err);
        setError('Failed to establish connection');
        setIsConnected(false);
      }
    };

    connect();

    // 清理函数
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [taskId, enabled]);

  return {
    data,
    isConnected,
    error,
    lastUpdate: data?.timestamp ? new Date(data.timestamp) : null
  };
}