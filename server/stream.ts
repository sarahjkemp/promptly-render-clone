import { Request, Response } from "express";
import { streamingQueue } from "./streamingQueue";

// SSE connection management
const connections = new Map<string, Response>();

/**
 * Server-Sent Events endpoint for real-time processing updates
 */
export function handleStreamConnection(req: Request, res: Response) {
  const historyId = req.params.historyId;
  const userId = req.user?.id;

  if (!req.isAuthenticated() || !userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const connectionId = `${userId}-${historyId}-${Date.now()}`;
  connections.set(connectionId, res);

  // Send initial connection confirmation
  sendSSEEvent(res, 'connected', { historyId, userId });

  // Clean up on client disconnect
  req.on('close', () => {
    connections.delete(connectionId);
    console.log(`SSE connection closed: ${connectionId}`);
  });

  // Keep connection alive
  const keepAliveInterval = setInterval(() => {
    if (connections.has(connectionId)) {
      sendSSEEvent(res, 'ping', { timestamp: Date.now() });
    } else {
      clearInterval(keepAliveInterval);
    }
  }, 30000); // Ping every 30 seconds
}

/**
 * Send SSE event to client
 */
function sendSSEEvent(res: Response, event: string, data: any) {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (error) {
    console.error('Error sending SSE event:', error);
  }
}

/**
 * Broadcast event to all connections for a specific user and article
 */
export function broadcastToUser(userId: number, articleId: number, event: string, data: any) {
  for (const [connectionId, res] of connections.entries()) {
    if (connectionId.startsWith(`${userId}-`)) {
      sendSSEEvent(res, event, { ...data, articleId });
    }
  }
}

/**
 * Initialize streaming queue event listeners
 */
export function initializeStreamingEvents() {
  // Queue position updates
  streamingQueue.on('queue-position', (data) => {
    broadcastToUser(data.userId, data.articleId, 'queue-position', {
      position: data.position,
      totalInQueue: data.totalInQueue,
      contentType: data.contentType
    });
  });

  // Content generation start
  streamingQueue.on('content-start', (data) => {
    broadcastToUser(data.userId, data.articleId, 'content-start', {
      contentType: data.contentType
    });
  });

  // Content generation complete
  streamingQueue.on('content-complete', (data) => {
    broadcastToUser(data.userId, data.articleId, 'content-complete', {
      contentType: data.contentType,
      result: data.result
    });
  });

  // Content retry
  streamingQueue.on('content-retry', (data) => {
    broadcastToUser(data.userId, data.articleId, 'content-retry', {
      contentType: data.contentType,
      attempt: data.attempt,
      reason: data.reason
    });
  });

  // Content error
  streamingQueue.on('content-error', (data) => {
    broadcastToUser(data.userId, data.articleId, 'content-error', {
      contentType: data.contentType,
      error: data.error
    });
  });

  console.log('Streaming events initialized');
}

/**
 * Get connection status for monitoring
 */
export function getConnectionStatus() {
  return {
    activeConnections: connections.size,
    connectionIds: Array.from(connections.keys())
  };
}