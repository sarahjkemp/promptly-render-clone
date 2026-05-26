/**
 * Error tracking utility to help manage API errors and provide better fallbacks
 */

// Track error counts
const errorCounts: Record<string, number> = {};

// Maximum consecutive errors before showing error banners
const MAX_CONSECUTIVE_ERRORS = 3;

// Maximum time window for grouping errors (in milliseconds)
const ERROR_WINDOW = 60 * 1000; // 1 minute

// Last error timestamps
const lastErrorTimes: Record<string, number> = {};

/**
 * Track an API error occurrence for a specific endpoint
 * @returns Boolean indicating if the error should be displayed to the user
 */
export function trackApiError(endpoint: string): boolean {
  const now = Date.now();
  const lastTime = lastErrorTimes[endpoint] || 0;
  
  // Reset count if too much time has passed since last error
  if (now - lastTime > ERROR_WINDOW) {
    errorCounts[endpoint] = 1;
  } else {
    // Increment error count
    errorCounts[endpoint] = (errorCounts[endpoint] || 0) + 1;
  }
  
  // Update last error time
  lastErrorTimes[endpoint] = now;
  
  // Return true if we should show the error to the user
  return errorCounts[endpoint] >= MAX_CONSECUTIVE_ERRORS;
}

/**
 * Reset error tracking for an endpoint
 */
export function resetErrorTracking(endpoint: string): void {
  delete errorCounts[endpoint];
  delete lastErrorTimes[endpoint];
}

/**
 * Get a friendly error message based on API errors
 */
export function getFriendlyErrorMessage(error: any): string {
  if (!error) return "An unknown error occurred.";
  
  // Parse error message
  let message = error.message || String(error);
  
  // Handle common error types with user-friendly messages
  if (message.includes('NetworkError') || message.includes('Failed to fetch')) {
    return "Network connection error. Please check your internet connection and try again.";
  }
  
  if (message.includes('Timeout') || message.includes('timeout')) {
    return "The request took too long to complete. Please try again later.";
  }
  
  if (message.includes('401') || message.includes('Unauthorized')) {
    return "Your session may have expired. Please log in again.";
  }
  
  if (message.includes('403') || message.includes('Forbidden')) {
    return "You don't have permission to access this resource.";
  }
  
  if (message.includes('404') || message.includes('Not Found')) {
    return "The requested resource could not be found.";
  }
  
  if (message.includes('500') || message.includes('Internal Server Error')) {
    return "A server error occurred. Please try again later.";
  }
  
  if (message.includes('Content generation error')) {
    return "There was a problem generating content. Our AI service may be experiencing high demand. Please try again shortly.";
  }
  
  if (message.includes('rate limit') || message.toLowerCase().includes('429') || message.toLowerCase().includes('too many requests')) {
    return "Our AI service is currently busy. We'll automatically retry your request in a few seconds or you can try again manually after a short wait. Your article will remain in the queue and no additional charges will apply.";
  }
  
  if (message.includes('openai') || message.includes('OpenAI')) {
    return "Processing service temporarily unavailable. We'll automatically retry your request in a few seconds. Your content remains saved and will be processed when the service is available.";
  }
  
  // Return the original message if we can't create a friendly one
  return message;
}