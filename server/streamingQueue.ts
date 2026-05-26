import OpenAI from "openai";
import { setTimeout as sleep } from "timers/promises";
import { EventEmitter } from "events";

// Configuration
const MAX_RETRIES = 3;
const INITIAL_TIMEOUT = 40000; // 40 seconds - matches non-streaming generation
const TIMEOUT_MULTIPLIER = 1.5; // 40s -> 60s -> 90s for comprehensive generation
const MAX_PARALLEL_REQUESTS = 2;
const RATE_LIMIT_BACKOFF = 2000; // 2 seconds backoff only when rate limited

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return openaiClient;
}

// Queue item interface
interface QueueItem {
  id: string;
  userId: number;
  companyId: number;
  articleId: number;
  contentType: 'summary' | 'angles' | 'outline' | 'email' | 'article';
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  retries: number;
  timeout: number;
  createdAt: Date;
}

// User context for fair scheduling
interface UserContext {
  userId: number;
  activeRequests: number;
  lastRequestTime: number;
  totalRequests: number;
  lastError?: string; // Track last error type for adaptive backoff
}

/**
 * Enhanced queue system with streaming support, fair scheduling, and progressive timeouts
 */
class StreamingQueue extends EventEmitter {
  private queue: QueueItem[] = [];
  private activeRequests = 0;
  private isProcessing = false;
  private userContexts = new Map<number, UserContext>();
  private currentUserIndex = 0;

  /**
   * Add a streaming request to the queue with user context
   */
  async enqueue<T>(
    userId: number,
    companyId: number, 
    articleId: number,
    contentType: 'summary' | 'angles' | 'outline' | 'email' | 'article',
    fn: () => Promise<T>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = `${articleId}-${contentType}-${Date.now()}`;
      
      const queueItem: QueueItem = {
        id,
        userId,
        companyId,
        articleId,
        contentType,
        execute: fn,
        resolve,
        reject,
        retries: 0,
        timeout: INITIAL_TIMEOUT,
        createdAt: new Date()
      };

      // Add to queue
      this.queue.push(queueItem);
      
      // Update user context
      this.updateUserContext(userId);
      
      // Emit queue position event
      this.emitQueuePosition(queueItem);
      
      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queue with fair scheduling across users
   */
  private async processQueue() {
    this.isProcessing = true;

    while (this.queue.length > 0) {
      // Respect parallel request limit
      if (this.activeRequests >= MAX_PARALLEL_REQUESTS) {
        await sleep(100);
        continue;
      }

      // Get next request using fair scheduling
      const request = this.getNextRequest();
      if (!request) {
        await sleep(100);
        continue;
      }

      // Remove from queue
      const index = this.queue.findIndex(item => item.id === request.id);
      if (index !== -1) {
        this.queue.splice(index, 1);
      }

      // Adaptive backoff: only delay if last error was rate limiting
      const userContext = this.userContexts.get(request.userId);
      if (userContext) {
        const now = Date.now();
        const timeSinceLastRequest = now - userContext.lastRequestTime;
        
        // Only apply backoff if we previously hit a rate limit
        if (userContext.lastError === 'rate_limit_exceeded' && timeSinceLastRequest < RATE_LIMIT_BACKOFF) {
          await sleep(RATE_LIMIT_BACKOFF - timeSinceLastRequest);
        }
        
        userContext.lastRequestTime = now;
        // Clear the error after applying backoff
        userContext.lastError = undefined;
      }

      this.activeRequests++;
      
      // Execute request with timeout and streaming
      this.executeStreamingRequest(request).finally(() => {
        this.activeRequests--;
      });
    }

    this.isProcessing = false;
  }

  /**
   * Execute a streaming request with progressive timeout handling
   */
  private async executeStreamingRequest(request: QueueItem) {
    try {
      // Emit processing start
      this.emit('content-start', {
        articleId: request.articleId,
        contentType: request.contentType,
        userId: request.userId
      });

      // Execute with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Request timeout after ${request.timeout}ms`)), request.timeout);
      });

      console.log(`🔄 Executing ${request.contentType} for article ${request.articleId}...`);
      
      const result = await Promise.race([
        request.execute(),
        timeoutPromise
      ]);
      
      console.log(`✅ ${request.contentType} completed successfully for article ${request.articleId}`);

      // Emit completion
      this.emit('content-complete', {
        articleId: request.articleId,
        contentType: request.contentType,
        userId: request.userId,
        result
      });

      request.resolve(result);

    } catch (error: any) {
      console.error(`Error executing ${request.contentType} for article ${request.articleId}:`, error);

      const isTimeout = error?.message?.includes('timeout');
      const isRateLimit = error?.message?.includes('rate limit') || 
                        error?.message?.includes('429') ||
                        error?.message?.includes('too many requests');
      
      // Track rate limit errors for adaptive backoff
      if (isRateLimit) {
        const userContext = this.userContexts.get(request.userId);
        if (userContext) {
          userContext.lastError = 'rate_limit_exceeded';
        }
      }

      const shouldRetry = (isTimeout || isRateLimit) && request.retries < MAX_RETRIES;

      if (shouldRetry) {
        // Progressive timeout increase with higher maximum for comprehensive generation
        request.timeout = Math.min(request.timeout * TIMEOUT_MULTIPLIER, 90000);
        request.retries++;

        const delay = isRateLimit ? 
          1000 * Math.pow(2, request.retries) : // Exponential backoff for rate limits
          500; // Quick retry for timeouts

        console.log(`Retrying ${request.contentType} for article ${request.articleId} in ${delay}ms (attempt ${request.retries}/${MAX_RETRIES}, timeout: ${request.timeout}ms)`);

        await sleep(delay);
        
        // Re-queue with updated parameters
        this.queue.unshift(request);
        
        // Emit retry event
        this.emit('content-retry', {
          articleId: request.articleId,
          contentType: request.contentType,
          userId: request.userId,
          attempt: request.retries,
          reason: isTimeout ? 'timeout' : 'rate_limit'
        });

      } else {
        // Emit error
        this.emit('content-error', {
          articleId: request.articleId,
          contentType: request.contentType,
          userId: request.userId,
          error: error.message
        });

        request.reject(error);
      }
    }
  }

  /**
   * Get next request using fair round-robin scheduling
   */
  private getNextRequest(): QueueItem | null {
    if (this.queue.length === 0) return null;

    // Get unique user IDs from queue
    const userIds = [...new Set(this.queue.map(item => item.userId))];
    if (userIds.length === 0) return null;

    // Round-robin through users
    const targetUserId = userIds[this.currentUserIndex % userIds.length];
    this.currentUserIndex++;

    // Find oldest request from target user
    const userRequests = this.queue
      .filter(item => item.userId === targetUserId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return userRequests[0] || this.queue[0]; // Fallback to oldest request
  }

  /**
   * Update user context for tracking
   */
  private updateUserContext(userId: number) {
    if (!this.userContexts.has(userId)) {
      this.userContexts.set(userId, {
        userId,
        activeRequests: 0,
        lastRequestTime: 0,
        totalRequests: 0
      });
    }
    
    const context = this.userContexts.get(userId)!;
    context.totalRequests++;
  }

  /**
   * Emit queue position for user feedback
   */
  private emitQueuePosition(item: QueueItem) {
    const position = this.queue.findIndex(q => q.id === item.id) + 1;
    const totalInQueue = this.queue.length;
    
    this.emit('queue-position', {
      articleId: item.articleId,
      userId: item.userId,
      position,
      totalInQueue,
      contentType: item.contentType
    });
  }

  /**
   * Get queue status for monitoring
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      userContexts: Object.fromEntries(this.userContexts),
      isProcessing: this.isProcessing
    };
  }
}

// Create singleton instance
export const streamingQueue = new StreamingQueue();

/**
 * Enhanced OpenAI request function with streaming support
 */
export async function createStreamingRequest<T>(
  userId: number,
  companyId: number,
  articleId: number,
  contentType: 'summary' | 'angles' | 'outline' | 'email' | 'article',
  requestFn: () => Promise<T>
): Promise<T> {
  return streamingQueue.enqueue(userId, companyId, articleId, contentType, requestFn);
}

/**
 * Create OpenAI responses with streaming enabled
 */
export async function createStreamingResponse(
  params: any,
  onChunk?: (chunk: string) => void
): Promise<any> {
  const isStreamingEnabled = process.env.STREAMING_UI === 'true';
  
  if (isStreamingEnabled && onChunk) {
    // Use streaming
    const stream: any = await getOpenAIClient().responses.create({
      ...params,
      stream: true
    });

    let fullContent = '';
    
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta' && event.delta) {
        const chunk = event.delta;
        fullContent += chunk;
        onChunk(chunk);
      } else if (event.type === 'response.completed') {
        // Stream complete
        break;
      } else if (event.type === 'error') {
        throw new Error(event.error?.message || 'Streaming error');
      }
    }

    return { output_text: fullContent };
  } else {
    // Use non-streaming
    return await getOpenAIClient().responses.create({
      ...params,
      stream: false
    });
  }
}
