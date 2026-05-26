/**
 * Enhanced Diagnostics System for Content Generation Analysis
 * Phase 1: Comprehensive logging and multi-content type analysis
 */

export interface DiagnosticData {
  contentType: string;
  articleId: number;
  requestId: string;
  timestamp: string;
  inputMetrics: {
    systemPromptLength: number;
    userPromptLength: number;
    totalInputLength: number;
    estimatedInputTokens: number;
  };
  responseMetrics: {
    finishReason: string;
    totalTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    tokenUtilization?: number;
  };
  contentAnalysis: {
    outputLength: number;
    wordCount: number;
    endsWithPunctuation: boolean;
    hasRequiredClosing?: boolean;
    truncationIndicators: string[];
  };
  rawResponse?: string; // For JSON schema impact analysis
}

export interface ContentCompletionAnalysis {
  isComplete: boolean;
  issues: string[];
  truncationType?: 'mid-sentence' | 'missing-closing' | 'incomplete-thought';
  severity: 'low' | 'medium' | 'high';
}

/**
 * Enhanced diagnostics feature flag check
 */
export function isDiagnosticsEnabled(): boolean {
  return process.env.ENHANCED_DIAGNOSTICS === 'true';
}

/**
 * Comprehensive content completion analysis
 */
export function analyzeContentCompletion(content: string, contentType: string): ContentCompletionAnalysis {
  const issues: string[] = [];
  let truncationType: 'mid-sentence' | 'missing-closing' | 'incomplete-thought' | undefined;
  
  // Check for mid-sentence truncation
  const endsWithPunctuation = /[.!?]$/.test(content.trim());
  if (!endsWithPunctuation) {
    issues.push('Does not end with proper punctuation');
    truncationType = 'mid-sentence';
  }
  
  // Check for hanging words/prepositions (ChatGPT's recommendation)
  const lastSentence = content.split(/[.!?]/).pop()?.trim() || '';
  const suspiciousTruncationPatterns = /\b(but|and|with|for|to|at|in|on|of|by|from|also|however|that|this|which|where|when|while|during|across|through|against|within|upon|into|onto|towards?|beyond|beneath|beside|between|among|without|despite|regarding|concerning|including|excluding|following|preceding|during|throughout|underneath|alongside|amidst?|via|per|plus|minus|versus)\s*$/i;
  
  if (lastSentence.length > 10 && suspiciousTruncationPatterns.test(lastSentence)) {
    issues.push('Appears to end mid-sentence with hanging words');
    truncationType = 'mid-sentence';
  }
  
  // Email-specific checks
  if (contentType === 'email') {
    const requiredClosings = [
      'best regards',
      'sincerely',
      'thank you for your time',
      'look forward to hearing from you'
    ];
    
    const contentLower = content.toLowerCase();
    const hasRequiredClosing = requiredClosings.some(closing => contentLower.includes(closing));
    
    if (!hasRequiredClosing) {
      issues.push('Missing required professional closing');
      truncationType = 'missing-closing';
    }
  }
  
  // Article-specific checks (for byline issues)
  if (contentType === 'article') {
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount < 600) {
      issues.push(`Article too short: ${wordCount} words (target: 600-800)`);
      truncationType = 'incomplete-thought';
    }
  }
  
  // Determine severity
  let severity: 'low' | 'medium' | 'high' = 'low';
  if (truncationType === 'mid-sentence') severity = 'high';
  else if (truncationType === 'missing-closing') severity = 'medium';
  else if (issues.length > 0) severity = 'low';
  
  return {
    isComplete: issues.length === 0,
    issues,
    truncationType,
    severity
  };
}

/**
 * Enhanced diagnostic logging for OpenAI responses
 */
export function logDiagnostics(data: DiagnosticData): void {
  if (!isDiagnosticsEnabled()) return;
  
  console.log('\n🔬 ENHANCED DIAGNOSTICS - PHASE 1');
  console.log('=====================================');
  console.log(`📝 Content Type: ${data.contentType.toUpperCase()}`);
  console.log(`🎯 Article ID: ${data.articleId}`);
  console.log(`🆔 Request ID: ${data.requestId}`);
  console.log(`⏰ Timestamp: ${data.timestamp}`);
  
  console.log('\n📊 INPUT METRICS:');
  console.log('------------------');
  console.log(`System Prompt: ${data.inputMetrics.systemPromptLength} chars`);
  console.log(`User Prompt: ${data.inputMetrics.userPromptLength} chars`);
  console.log(`Total Input: ${data.inputMetrics.totalInputLength} chars`);
  console.log(`Est. Input Tokens: ${data.inputMetrics.estimatedInputTokens}`);
  
  console.log('\n📈 RESPONSE METRICS:');
  console.log('--------------------');
  console.log(`Finish Reason: ${data.responseMetrics.finishReason}`);
  if (data.responseMetrics.totalTokens) {
    console.log(`Total Tokens: ${data.responseMetrics.totalTokens}`);
    console.log(`Prompt Tokens: ${data.responseMetrics.promptTokens}`);
    console.log(`Completion Tokens: ${data.responseMetrics.completionTokens}`);
    console.log(`Token Utilization: ${data.responseMetrics.tokenUtilization?.toFixed(1)}%`);
  }
  
  console.log('\n🔍 CONTENT ANALYSIS:');
  console.log('--------------------');
  console.log(`Output Length: ${data.contentAnalysis.outputLength} chars`);
  console.log(`Word Count: ${data.contentAnalysis.wordCount} words`);
  console.log(`Ends with Punctuation: ${data.contentAnalysis.endsWithPunctuation ? 'YES' : 'NO'}`);
  if (data.contentAnalysis.hasRequiredClosing !== undefined) {
    console.log(`Has Required Closing: ${data.contentAnalysis.hasRequiredClosing ? 'YES' : 'NO'}`);
  }
  
  if (data.contentAnalysis.truncationIndicators.length > 0) {
    console.log('\n⚠️ TRUNCATION INDICATORS:');
    data.contentAnalysis.truncationIndicators.forEach(indicator => {
      console.log(`  • ${indicator}`);
    });
  }
  
  if (data.rawResponse) {
    console.log(`\n📄 Raw Response Length: ${data.rawResponse.length} chars`);
    console.log(`📄 Last 100 chars: "${data.rawResponse.slice(-100)}"`);
  }
  
  console.log('\n=====================================\n');
}

/**
 * Token ceiling detection based on ChatGPT's analysis
 */
export function detectTokenCeiling(responseMetrics: DiagnosticData['responseMetrics'], maxTokens: number): boolean {
  if (!responseMetrics.totalTokens) return false;
  
  const utilizationThreshold = 90; // 90% utilization suggests token ceiling
  const utilization = (responseMetrics.totalTokens / maxTokens) * 100;
  
  return utilization > utilizationThreshold || responseMetrics.finishReason === 'length';
}

/**
 * Stop sequence collision detection
 */
export function detectStopSequenceCollision(content: string, finishReason: string): boolean {
  if (finishReason !== 'stop') return false;
  
  // Common problematic patterns that might trigger early stops
  const suspiciousPatterns = [
    /\n\n—/,           // Double newline with dash
    /\n\n\*/,          // Double newline with asterisk  
    /\n\n[A-Z]/,       // Double newline with capital letter
    /\.\.\./,          // Ellipsis
    /—$/,              // Ends with dash
    /\n\n$/            // Ends with double newline
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(content));
}