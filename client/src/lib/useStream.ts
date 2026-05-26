import { useEffect, useRef, useState, useCallback } from 'react';

// Stream event types
interface StreamEvent {
  type: string;
  data: any;
}

interface QueuePositionEvent {
  position: number;
  totalInQueue: number;
  contentType: string;
}

interface ContentStartEvent {
  contentType: string;
}

interface ContentCompleteEvent {
  contentType: string;
  result: any;
}

interface ContentRetryEvent {
  contentType: string;
  attempt: number;
  reason: 'timeout' | 'rate_limit';
}

interface ContentErrorEvent {
  contentType: string;
  error: string;
}

// Hook state
interface StreamState {
  isConnected: boolean;
  queuePosition: number | null;
  totalInQueue: number | null;
  processingStage: string | null;
  completedContent: Record<string, any>;
  retryAttempts: Record<string, number>;
  errors: Record<string, string>;
  connectionError: string | null;
  isPollingFallback: boolean;
}

/**
 * Custom hook for handling Server-Sent Events streaming
 */
export function useStream(historyId: number | string, enabled: boolean = true) {
  const [state, setState] = useState<StreamState>({
    isConnected: false,
    queuePosition: null,
    totalInQueue: null,
    processingStage: null,
    completedContent: {},
    retryAttempts: {},
    errors: {},
    connectionError: null,
    isPollingFallback: false
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sseFailTimeRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Clear connection state
  const clearConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Check article status via API (fallback when SSE fails)
  const checkArticleStatus = useCallback(async () => {
    if (!historyId) return null;
    
    try {
      // Extract article ID from history record
      const historyResponse = await fetch(`/api/article-history`, {
        credentials: 'include'
      });
      
      if (!historyResponse.ok) return null;
      
      const historyData = await historyResponse.json();
      const historyRecord = historyData.find((record: any) => record.id === Number(historyId));
      
      if (!historyRecord?.article?.id) return null;
      
      const statusResponse = await fetch(`/api/articles/${historyRecord.article.id}/status`, {
        credentials: 'include'
      });
      
      if (!statusResponse.ok) return null;
      
      return await statusResponse.json();
    } catch (error) {
      console.error('Failed to check article status:', error);
      return null;
    }
  }, [historyId]);

  // Start polling fallback
  const startPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) return; // Already polling
    
    console.log('Starting polling fallback due to SSE connection failure');
    setState(prev => ({ ...prev, isPollingFallback: true }));
    
    pollingIntervalRef.current = setInterval(async () => {
      const status = await checkArticleStatus();
      
      if (status && status.status === 'done') {
        console.log('Polling detected completion, stopping fallback');
        setState(prev => ({ 
          ...prev, 
          processingStage: null,
          isPollingFallback: false
        }));
        
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    }, 10000); // Poll every 10 seconds
  }, [checkArticleStatus]);

  // Stop polling fallback
  const stopPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setState(prev => ({ ...prev, isPollingFallback: false }));
  }, []);



  // Attempt reconnection with exponential backoff
  const attemptReconnect = useCallback(() => {
    // Track when SSE first failed
    if (!sseFailTimeRef.current) {
      sseFailTimeRef.current = Date.now();
    }
    
    // Check if SSE has been failing for more than 30 seconds
    const failDuration = Date.now() - sseFailTimeRef.current;
    if (failDuration > 30000 && !pollingIntervalRef.current) {
      console.log('SSE failed for 30+ seconds, starting polling fallback');
      startPollingFallback();
    }
    
    if (reconnectAttempts.current < maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      console.log(`Attempting SSE reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttempts.current++;
        connectToStream();
      }, delay);
    } else {
      setState(prev => ({
        ...prev,
        connectionError: 'Connection unstable - checking status automatically',
        isConnected: false
      }));
    }
  }, [startPollingFallback]);

  // Connect to SSE stream
  const connectToStream = useCallback(() => {
    if (!enabled || !historyId) return;

    const streamUrl = `/api/stream/${historyId}`;
    console.log(`Connecting to SSE stream: ${streamUrl}`);

    try {
      const eventSource = new EventSource(streamUrl, {
        withCredentials: true
      });

      eventSourceRef.current = eventSource;

      // Connection established
      eventSource.addEventListener('connected', () => {
        console.log('SSE connection established');
        reconnectAttempts.current = 0;
        sseFailTimeRef.current = null; // Reset failure tracking
        
        // Stop polling fallback if it was running
        if (pollingIntervalRef.current) {
          console.log('SSE reconnected, stopping polling fallback');
          stopPollingFallback();
        }
        
        setState(prev => ({
          ...prev,
          isConnected: true,
          connectionError: null,
          isPollingFallback: false
        }));
      });

      // Queue position updates
      eventSource.addEventListener('queue-position', (event) => {
        const data: QueuePositionEvent = JSON.parse(event.data);
        setState(prev => ({
          ...prev,
          queuePosition: data.position,
          totalInQueue: data.totalInQueue
        }));
      });

      // Content generation start
      eventSource.addEventListener('content-start', (event) => {
        const data: ContentStartEvent = JSON.parse(event.data);
        setState(prev => ({
          ...prev,
          processingStage: data.contentType,
          errors: { ...prev.errors, [data.contentType]: '' }
        }));
      });

      // Content generation complete
      eventSource.addEventListener('content-complete', (event) => {
        const data: ContentCompleteEvent = JSON.parse(event.data);
        setState(prev => ({
          ...prev,
          completedContent: {
            ...prev.completedContent,
            [data.contentType]: data.result
          },
          processingStage: prev.processingStage === data.contentType ? null : prev.processingStage
        }));
      });

      // Content retry
      eventSource.addEventListener('content-retry', (event) => {
        const data: ContentRetryEvent = JSON.parse(event.data);
        setState(prev => ({
          ...prev,
          retryAttempts: {
            ...prev.retryAttempts,
            [data.contentType]: data.attempt
          }
        }));
      });

      // Content error
      eventSource.addEventListener('content-error', (event) => {
        const data: ContentErrorEvent = JSON.parse(event.data);
        setState(prev => ({
          ...prev,
          errors: {
            ...prev.errors,
            [data.contentType]: data.error
          },
          processingStage: prev.processingStage === data.contentType ? null : prev.processingStage
        }));
      });

      // Keep-alive ping
      eventSource.addEventListener('ping', () => {
        // Just acknowledge the ping, no state updates needed
      });

      // Handle connection errors
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setState(prev => ({ ...prev, isConnected: false }));
        
        if (eventSource.readyState === EventSource.CLOSED) {
          console.log('SSE connection closed, attempting reconnect...');
          attemptReconnect();
        }
      };

    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      setState(prev => ({
        ...prev,
        connectionError: 'Failed to establish streaming connection',
        isConnected: false
      }));
      attemptReconnect();
    }
  }, [enabled, historyId, attemptReconnect]);

  // Initialize connection
  useEffect(() => {
    if (enabled && historyId) {
      connectToStream();
    }

    return () => {
      clearConnection();
    };
  }, [enabled, historyId, connectToStream, clearConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearConnection();
    };
  }, [clearConnection]);

  // Helper functions
  const getQueueStatus = () => {
    if (state.queuePosition && state.totalInQueue) {
      return `Position ${state.queuePosition} of ${state.totalInQueue} in queue`;
    }
    return null;
  };

  const getProcessingStatus = () => {
    if (state.processingStage) {
      const retryCount = state.retryAttempts[state.processingStage] || 0;
      const retryText = retryCount > 0 ? ` (attempt ${retryCount + 1})` : '';
      return `Generating ${state.processingStage}${retryText}...`;
    }
    return null;
  };

  const getCompletedCount = () => {
    return Object.keys(state.completedContent).length;
  };

  const hasErrors = () => {
    return Object.values(state.errors).some(error => error.length > 0);
  };

  // Manual status check function (for button)
  const manualStatusCheck = useCallback(async () => {
    console.log('Manual status check triggered');
    const status = await checkArticleStatus();
    
    if (status) {
      if (status.status === 'done') {
        setState(prev => ({ 
          ...prev, 
          processingStage: null,
          connectionError: null,
          isPollingFallback: false
        }));
        stopPollingFallback();
      } else {
        // Try to reconnect SSE
        connectToStream();
      }
    }
  }, [checkArticleStatus, stopPollingFallback, connectToStream]);

  return {
    // Connection state
    isConnected: state.isConnected,
    connectionError: state.connectionError,
    isPollingFallback: state.isPollingFallback,
    
    // Queue information
    queuePosition: state.queuePosition,
    totalInQueue: state.totalInQueue,
    queueStatus: getQueueStatus(),
    
    // Processing state
    processingStage: state.processingStage,
    processingStatus: getProcessingStatus(),
    
    // Content state
    completedContent: state.completedContent,
    completedCount: getCompletedCount(),
    
    // Error state
    errors: state.errors,
    hasErrors: hasErrors(),
    
    // Retry information
    retryAttempts: state.retryAttempts,
    
    // Manual functions
    reconnect: connectToStream,
    checkStatus: manualStatusCheck
  };
}