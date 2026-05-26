/**
 * Utility functions to normalize error messages for better user experience
 */

interface ErrorMessageConfig {
  message: string;
  actionText?: string;
  isRetryable: boolean;
}

/**
 * Converts technical error messages to user-friendly ones
 */
export function normalizeErrorMessage(errorMessage: string): ErrorMessageConfig {
  const lowercaseError = errorMessage.toLowerCase();
  
  // Processing timeout errors
  if (lowercaseError.includes('timeout') || lowercaseError.includes('processing timeout')) {
    return {
      message: "This is taking longer than expected. Let's give it another try.",
      actionText: "Try again",
      isRetryable: true
    };
  }
  
  // OpenAI/API rate limit errors
  if (lowercaseError.includes('rate limit') || lowercaseError.includes('429')) {
    return {
      message: "The service is experiencing high demand. Please wait a moment and try again.",
      actionText: "Try again in 30s",
      isRetryable: true
    };
  }
  
  // Content generation errors
  if (lowercaseError.includes('content generation') || lowercaseError.includes('openai')) {
    return {
      message: "The content generator needs another attempt. This usually works on retry.",
      actionText: "Generate again",
      isRetryable: true
    };
  }
  
  // Network/connection errors
  if (lowercaseError.includes('network') || lowercaseError.includes('connection') || lowercaseError.includes('fetch')) {
    return {
      message: "We're having trouble connecting. Please check your connection and try again.",
      actionText: "Retry",
      isRetryable: true
    };
  }
  
  // Authentication errors
  if (lowercaseError.includes('unauthorized') || lowercaseError.includes('401') || lowercaseError.includes('authentication')) {
    return {
      message: "Your session needs to be refreshed. Click to reload the page.",
      actionText: "Refresh page",
      isRetryable: false
    };
  }
  
  // Permission errors
  if (lowercaseError.includes('forbidden') || lowercaseError.includes('403') || lowercaseError.includes('permission')) {
    return {
      message: "You need different permissions for this action. Please contact your administrator.",
      actionText: undefined,
      isRetryable: false
    };
  }
  
  // Server errors
  if (lowercaseError.includes('500') || lowercaseError.includes('server error') || lowercaseError.includes('internal')) {
    return {
      message: "The server had a temporary hiccup. This usually resolves quickly.",
      actionText: "Try once more",
      isRetryable: true
    };
  }
  
  // Default case - clean up the message but keep it recognizable
  const cleanMessage = errorMessage
    .replace(/^Error:?\s*/i, '') // Remove "Error:" prefix
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
    
  // Capitalize first letter if needed
  const normalizedMessage = cleanMessage.charAt(0).toUpperCase() + cleanMessage.slice(1);
  
  return {
    message: normalizedMessage,
    actionText: "Try again",
    isRetryable: true
  };
}

/**
 * Checks if an error is retryable based on common patterns
 */
export function isRetryableError(errorMessage: string): boolean {
  const config = normalizeErrorMessage(errorMessage);
  return config.isRetryable;
}

/**
 * Gets appropriate action text for an error
 */
export function getErrorActionText(errorMessage: string): string | undefined {
  const config = normalizeErrorMessage(errorMessage);
  return config.actionText;
}