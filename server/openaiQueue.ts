import OpenAI from "openai";
import { setTimeout as sleep } from "timers/promises";

// Configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_PARALLEL_REQUESTS = 5; // Maximum parallel requests to OpenAI API
const MIN_REQUEST_INTERVAL = 0; // Minimum time between requests in ms

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

// Queue for managing OpenAI requests
class OpenAIRequestQueue {
  private queue: Array<{
    execute: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    retries: number;
  }> = [];
  private activeRequests = 0;
  private lastRequestTime = 0;
  private isProcessing = false;

  /**
   * Add a request to the queue
   */
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: fn,
        resolve,
        reject,
        retries: 0
      });
      
      // Start processing the queue if it's not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the queue of requests
   */
  private async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      // Respect parallel request limit
      if (this.activeRequests >= MAX_PARALLEL_REQUESTS) {
        await sleep(100); // Wait a bit before checking again
        continue;
      }
      
      // Respect minimum request interval
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await sleep(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
      }
      
      // Get the next request from the queue
      const request = this.queue.shift();
      if (!request) continue;
      
      this.activeRequests++;
      this.lastRequestTime = Date.now();
      
      // Execute the request
      this.executeRequest(request).finally(() => {
        this.activeRequests--;
      });
    }
    
    this.isProcessing = false;
  }

  /**
   * Execute a request with retry capability
   */
  private async executeRequest(request: {
    execute: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    retries: number;
  }) {
    try {
      const result = await request.execute();
      request.resolve(result);
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('rate limit') || 
                        error?.message?.includes('429') ||
                        error?.message?.includes('too many requests');
      
      const shouldRetry = isRateLimit && request.retries < MAX_RETRIES;
      
      if (shouldRetry) {
        // Exponential backoff
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, request.retries);
        console.log(`Rate limit exceeded. Retrying in ${delay}ms (attempt ${request.retries + 1}/${MAX_RETRIES})`);
        
        await sleep(delay);
        
        // Put the request back in the queue with incremented retry count
        this.queue.unshift({
          ...request,
          retries: request.retries + 1
        });
      } else {
        request.reject(error);
      }
    }
  }
}

// Create a singleton instance
const openaiQueue = new OpenAIRequestQueue();

/**
 * Sends a throttled request to OpenAI's chat completions API
 */
export async function createChatCompletion(params: OpenAI.ChatCompletionCreateParams): Promise<any> {
  return openaiQueue.enqueue(async () => {
    try {
      console.log(`Executing OpenAI API request (model: ${params.model})`);
      const openai = getOpenAIClient();
      // Set stream to false to ensure we get a ChatCompletion object
      const result = await openai.chat.completions.create({
        ...params,
        stream: false
      });
      return result;
    } catch (error: any) {
      const errorMessage = error?.message || "Unknown OpenAI API error";
      console.error(`OpenAI API error: ${errorMessage}`, error);
      
      // Add more context to the error for better debugging
      if (error?.message?.includes('rate limit')) {
        error.message = `OpenAI rate limit exceeded: ${error.message}`;
      } else if (error?.status === 429) {
        error.message = `OpenAI rate limit exceeded (429 status): ${error.message}`;
      }
      
      throw error;
    }
  });
}

// Export a lazy getter for direct access if needed
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return Reflect.get(getOpenAIClient() as any, prop);
  }
});
