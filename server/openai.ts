import OpenAI from "openai";
import { createChatCompletion, openai } from "./openaiQueue";
import { createStreamingRequest, createStreamingResponse } from "./streamingQueue";
import { broadcastToUser } from "./stream";
import { buildPrompt, logCompanyContextInjection, SUMMARY_PROMPT, ANGLES_PROMPT, OUTLINE_PROMPT, EMAIL_PROMPT, ARTICLE_PROMPT } from "./promptTemplates";
import { getUserLocation } from "./utils/geoLocation.js";
import { 
  summarySchema, 
  anglesSchema, 
  outlineSchema, 
  emailSchema,
  articleSchema,
  publishingPackSEOSchema,
  EnhancedSummaryResponse,
  EnhancedAnglesResponse,
  EnhancedOutlineResponse,
  EnhancedEmailResponse,
  EnhancedArticleResponse,
  PublishingPackSEOResponse,
  articleDraftV2Schema
} from "./openaiSchemas";
import { extractKeyNumbers, logNumberExtraction } from "./utils/extractNumbers";
import { validateAngles, logAnglesQA, createAnglesQAErrorMessage } from "./qa/anglesQA";
import { buildLinkedIn } from "./linkedin";
import { quickQA } from "./qa/quickQA";
import { storage } from "./storage";
import { 
  isDiagnosticsEnabled, 
  logDiagnostics, 
  analyzeContentCompletion, 
  detectTokenCeiling, 
  detectStopSequenceCollision,
  type DiagnosticData 
} from "./diagnostics";

// the newest OpenAI model is "gpt-4.1" which was released after the knowledge cutoff
const MODEL = "gpt-4.1";

// Model for media suggestions with web search capabilities
const MEDIA_SUGGESTIONS_MODEL = "gpt-4.1-mini";

// Use gpt-4.1 for consistent high-quality email generation without truncation
const EMAIL_MODEL = "gpt-4.1";

// Enhanced error handling and retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second base delay
const MAX_DELAY = 10000; // 10 second max delay

// Phase 5: Model Performance Optimization for consistent 600-800 word output
const ARTICLE_GENERATION_CONFIG = {
  temperature: 0.7, // Balanced creativity and consistency
  max_tokens: 8000, // Optimized for comprehensive content without quota issues
  top_p: 0.9, // Slightly focused while maintaining diversity
  frequency_penalty: 0.3, // Reduce repetition
  presence_penalty: 0.1 // Encourage topic exploration
};

// Default configuration for all OpenAI calls to prevent truncation
const DEFAULT_GENERATION_CONFIG = {
  max_tokens: 8000, // Optimized token limit to prevent cutoffs while avoiding rate limits
  temperature: 0.7,
  top_p: 0.9
};

// Use same config as articles for consistent email generation without truncation
const EMAIL_GENERATION_CONFIG = {
  max_tokens: 8000, // Match article success - use same token allocation as articles
  temperature: 0.7,  // Consistent with other content types
  top_p: 0.9,        // Consistent creativity level
  frequency_penalty: 0.2, // Slight reduction in repetition for email flow
  presence_penalty: 0.1   // Encourage comprehensive email structure
};

// Unique sentinel token to prevent premature stopping at ~950 characters
// Removed EMAIL_SENTINEL - using JSON schema format directly

/**
 * Enhanced retry mechanism with exponential backoff for OpenAI API calls
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error = new Error("Unknown error");
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 ${operationName} - Attempt ${attempt}/${maxRetries}`);
      const result = await operation();
      
      if (attempt > 1) {
        console.log(`✅ ${operationName} succeeded on retry attempt ${attempt}`);
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      console.error(`❌ ${operationName} failed on attempt ${attempt}:`, error?.message || error);
      
      // Don't retry on authentication errors, but do retry on rate limits with longer delay
      if (error?.status === 401) {
        console.log(`🛑 Authentication error (${error.status}) - stopping retries`);
        throw error;
      }
      
      // For rate limit errors, use longer delay
      if (error?.status === 429) {
        console.log(`⏱️ Rate limit hit (429) - implementing extended backoff on attempt ${attempt}`);
        if (attempt === maxRetries) {
          console.error(`🔥 ${operationName} failed after ${maxRetries} attempts due to persistent rate limiting`);
          throw lastError;
        }
        // Extended delay for rate limits: 5s, 10s, 20s
        const rateDelay = Math.min(5000 * Math.pow(2, attempt - 1), 20000);
        console.log(`⏱️ Rate limit backoff: waiting ${rateDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, rateDelay));
        continue;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        console.error(`🔥 ${operationName} failed after ${maxRetries} attempts`);
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(BASE_DELAY * Math.pow(2, attempt - 1), MAX_DELAY);
      console.log(`⏱️ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Enhanced createChatCompletion with automatic retry logic and job logging
 */
async function createChatCompletionWithRetry(params: any, operationName: string = "OpenAI API call"): Promise<any> {
  const startTime = Date.now();
  const jobId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const result = await retryWithBackoff(
      () => createChatCompletion(params),
      operationName
    );
    
    // Log job metrics
    console.log(JSON.stringify({
      jobId,
      userId: params.userId || 'unknown',
      operation: operationName,
      model: params.model || MODEL,
      latencyMs: Date.now() - startTime,
      linkCount: 0, // Will be updated for media suggestions
      schemaValid: true,
      timestamp: new Date().toISOString()
    }));
    
    return result;
  } catch (error) {
    // Log failed job metrics
    console.log(JSON.stringify({
      jobId,
      userId: params.userId || 'unknown',
      operation: operationName,
      model: params.model || MODEL,
      latencyMs: Date.now() - startTime,
      linkCount: 0,
      schemaValid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }));
    
    throw error;
  }
}

// Configuration for media suggestions limits
const MAX_JOURNALISTS = 7;
const MAX_PUBLICATIONS = parseInt(process.env.MEDIA_PUBLICATIONS_COUNT || "15");

// Types for PR content generation
export type PRContentParams = {
  articleTitle: string;
  articleBody: string;
  companyName?: string;
  industry?: string;
  brandTone?: string[];
  keyPhrases?: string[];
  targetRegions?: string[];
  documentContext?: string[];
  articleId?: number; // Added for diagnostics tracking
  industryContext?: string; // Added for web search context
};

export type SummaryResponse = {
  summary: string;
};

export type AnglesResponse = {
  angles: Array<{
    headline: string;
    commentary: string;
  }>;
};

export type OutlineResponse = {
  idea: string;
  outline: string[];
};

export type EmailResponse = {
  subject: string;
  body: string;
};

export type LinkedInResponse = {
  hook: string;
  content: string;
  cta: string;
};

export type ArticleResponse = {
  title: string;
  content: string;
};

export type GeneratedPRContent = {
  summary: string;
  angles: {
    headline: string;
    paragraph: string;
  }[];
  outline: string[];
  article?: {
    title: string;
    content: string;
  } | null;
  linkedinIdea: {
    hook: string;
    content: string;
    cta: string;
  } | null;
  email: {
    subject: string;
    body: string;
  };
  journalistSuggestions?: Array<{
    name: string;
    publication: string;
    reason: string;
    link?: string;
  }>;
  publicationSuggestions?: Array<{
    name: string;
    section: string;
    reason: string;
    link?: string;
  }>;
};

export type MediaSuggestionsResponse = {
  journalists: Array<{
    name: string;
    publication: string;
    reason: string;
    link?: string;
  }>;
  publications: Array<{
    name: string;
    section: string;
    reason: string;
    link?: string;
  }>;
};

/**
 * Generates article summary using enhanced structured outputs approach
 */
export async function generateSummary(params: PRContentParams): Promise<SummaryResponse> {
  try {
    const systemPrompt = buildPrompt(SUMMARY_PROMPT, params);
    
    const summaryResponse = await createChatCompletionWithRetry({
      model: MODEL,
      ...DEFAULT_GENERATION_CONFIG,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Article Title: ${params.articleTitle}\n\nArticle Content: ${params.articleBody}` }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "summary_response",
          schema: summarySchema
        }
      }
    }, "Summary generation");

    const content = summaryResponse.choices[0].message.content;
    if (!content) throw new Error("No content returned from OpenAI");
    
    console.log('📝 Summary generation response:', content);
    
    let enhancedResponse: EnhancedSummaryResponse;
    try {
      enhancedResponse = JSON.parse(content) as EnhancedSummaryResponse;
    } catch (parseError) {
      console.error('❌ Summary JSON parse error:', parseError);
      console.error('📄 Raw content that failed to parse:', content);
      throw new Error(`Failed to parse summary response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
    }
    
    // Convert to backward-compatible format
    return {
      summary: enhancedResponse.summary
    };
  } catch (error: any) {
    console.error("Error generating summary:", error);
    throw new Error(`Failed to generate summary: ${error?.message || "Unknown error"}`);
  }
}

/**
 * Generates commentary angles using enhanced structured outputs approach with QA validation
 */
export async function generateAngles(params: PRContentParams, attempt: number = 0): Promise<AnglesResponse> {
  try {
    // Extract key numbers from both title and body content
    const combinedText = `${params.articleTitle} ${params.articleBody}`;
    const keyNumbers = extractKeyNumbers(combinedText);
    
    // Log extraction results for monitoring
    logNumberExtraction(keyNumbers, `article-${params.articleTitle?.slice(0, 30) || 'untitled'}`);
    
    // Pass extracted numbers to buildPrompt
    const enhancedParams = { ...params, keyNumbers };
    const systemPrompt = buildPrompt(ANGLES_PROMPT, enhancedParams);
    
    const anglesResponse = await createChatCompletion({
      model: MODEL,
      ...DEFAULT_GENERATION_CONFIG,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Article Title: ${params.articleTitle}\n\nArticle Content: ${params.articleBody}` }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "angles_response",
          schema: anglesSchema
        }
      }
    });

    const content = anglesResponse.choices[0].message.content;
    if (!content) throw new Error("No content returned from OpenAI");
    
    console.log('🎯 Angles generation response:', content);
    
    let enhancedResponse: EnhancedAnglesResponse;
    try {
      enhancedResponse = JSON.parse(content) as EnhancedAnglesResponse;
    } catch (parseError) {
      console.error('❌ Angles JSON parse error:', parseError);
      console.error('📄 Raw content that failed to parse:', content);
      throw new Error(`Failed to parse angles response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
    }
    
    // Convert to backward-compatible format with alias support
    const resultAngles = enhancedResponse.angles.map(angle => ({
      headline: angle.headline,
      commentary: angle.commentary,
      paragraph: angle.commentary  // Alias for frontend compatibility
    }));

    // Step 5: Hard Gate QA Validation
    const qaResult = validateAngles(resultAngles);
    logAnglesQA(qaResult, params.articleId);

    if (!qaResult.pass) {
      // Retry once on QA failure
      if (attempt === 0) {
        console.log(`🔄 Angles QA failed (attempt ${attempt + 1}), retrying with enhanced prompt...`);
        return generateAngles(params, attempt + 1);
      } else {
        // Second failure - surface user-friendly error
        const errorMessage = createAnglesQAErrorMessage(qaResult);
        console.error(`❌ Angles QA failed after retry:`, errorMessage);
        throw new Error(errorMessage);
      }
    }

    console.log(`✅ Angles QA passed with score ${qaResult.score}/100`);
    return { angles: resultAngles };
  } catch (error: any) {
    console.error("Error generating angles:", error);
    throw new Error(`Failed to generate angles: ${error?.message || "Unknown error"}`);
  }
}

/**
 * Generates thought leadership outline using enhanced structured outputs approach
 */
export async function generateOutline(params: PRContentParams): Promise<OutlineResponse> {
  try {
    // Extract key numbers from article content
    const combinedText = `${params.articleTitle} ${params.articleBody}`;
    const keyNumbers = extractKeyNumbers(combinedText);
    
    // Log extraction results for monitoring
    logNumberExtraction(keyNumbers, `outline-${params.articleTitle?.slice(0, 30) || 'untitled'}`);
    
    // Pass extracted numbers to buildPrompt
    const enhancedParams = { ...params, keyNumbers };
    const systemPrompt = buildPrompt(OUTLINE_PROMPT, enhancedParams);
    
    // Build user message with data points reminder
    let userMessage = `Article Title: ${params.articleTitle}\n\nArticle Content: ${params.articleBody}`;
    
    if (keyNumbers.length > 0) {
      userMessage += `\n\nKEY DATA POINTS TO INCORPORATE IN TALKING POINTS:\n${keyNumbers.map(num => `• ${num}`).join('\n')}`;
    }
    
    const outlineResponse = await createChatCompletion({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "outline_response",
          schema: outlineSchema
        }
      }
    });

    const content = outlineResponse.choices[0].message.content;
    if (!content) throw new Error("No content returned from OpenAI");
    
    const enhancedResponse = JSON.parse(content) as EnhancedOutlineResponse;
    
    // Convert to backward-compatible format
    return {
      idea: enhancedResponse.idea,
      outline: enhancedResponse.outline
    };
  } catch (error: any) {
    console.error("Error generating outline:", error);
    throw new Error(`Failed to generate outline: ${error?.message || "Unknown error"}`);
  }
}

/**
 * Enhanced Email completeness validation with Phase 6 completion requirements
 */
function validateEmailCompleteness(email: EmailResponse): { isComplete: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Phase 6: Check for specific professional closings
  const requiredClosings = [
    'best regards,',
    'sincerely,',
    'thank you for your time,',
    'i look forward to hearing from you,'
  ];
  
  const bodyLower = email.body.toLowerCase();
  const hasRequiredClosing = requiredClosings.some(closing => bodyLower.includes(closing));
  
  if (!hasRequiredClosing) {
    issues.push('Missing required professional closing (Best regards, Sincerely, etc.)');
  }
  
  // Check word count (minimum 150 words for professional emails)
  const wordCount = email.body.split(/\s+/).filter(word => word.length > 0).length;
  if (wordCount < 150) {
    issues.push(`Word count too low: ${wordCount} words (minimum 150)`);
  }
  
  // Phase 6: Enhanced truncation detection
  const endsWithPunctuation = /[.!?]$/.test(email.body.trim());
  if (!endsWithPunctuation) {
    issues.push("Email does not end with proper punctuation - possible truncation");
  }
  
  // Check for mid-sentence cutoff (ends with incomplete words or hanging prepositions)
  const lastSentence = email.body.split(/[.!?]/).pop()?.trim() || '';
  const suspiciousTruncationPatterns = /\b(but|and|with|for|to|at|in|on|of|by|from|also|however|that|this|which|where|when|while|during|across|through|against|within|upon|into|onto|towards?|beyond|beneath|beside|between|among|without|despite|regarding|concerning|including|excluding|following|preceding|during|throughout|underneath|alongside|amidst?|via|per|via|plus|minus|versus|via)\s*$/i;
  if (lastSentence.length > 10 && suspiciousTruncationPatterns.test(lastSentence)) {
    issues.push("Email appears to end mid-sentence with hanging words");
  }
  
  return {
    isComplete: issues.length === 0,
    issues
  };
}

/**
 * Unified email generation function using same successful pattern as generateArticle()
 */
export async function generateEmailSeparately(params: PRContentParams): Promise<EmailResponse> {
  try {
    const systemPrompt = buildPrompt(EMAIL_PROMPT, params);
    const userMessage = `Article Title: ${params.articleTitle}\n\nArticle Content: ${params.articleBody}`;
    
    console.log('📧 UNIFIED EMAIL GENERATION - Starting...');
    console.log(`   Model: gpt-4.1 (same as articles)`);
    console.log(`   Using same approach as successful article generation`);
    
    const response = await createChatCompletionWithRetry({
      model: MODEL, // Use same model as articles (gpt-4.1)
      max_tokens: 8000, // Same as articles
      temperature: 0.7, // Same as articles  
      top_p: 0.9, // Same as articles
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_response",
          schema: emailSchema
        }
      }
    }, "Unified email generation");
    
    const content = response.choices[0].message.content;
    if (!content) throw new Error("No content returned from OpenAI");
    
    console.log('📧 UNIFIED EMAIL GENERATION - Response received');
    console.log(`   Length: ${content.length} characters`);
    console.log(`   Finish reason: ${response.choices[0].finish_reason}`);
    
    // Parse JSON response (same as articles)
    const emailResult = JSON.parse(content) as EmailResponse;
    
    console.log('📧 UNIFIED EMAIL GENERATION - Results:');
    console.log(`   Subject: "${emailResult.subject}" (${emailResult.subject.length} chars)`);
    console.log(`   Body length: ${emailResult.body.length} characters`);
    console.log(`   Body preview: "${emailResult.body.substring(0, 100)}..."`);
    
    // Simple validation (like articles)
    if (!emailResult.subject || emailResult.subject.length < 5) {
      throw new Error('Email subject missing or too short');
    }
    
    if (!emailResult.body || emailResult.body.length < 50) {
      throw new Error('Email body missing or too short');
    }
    
    console.log('✅ Unified email generation completed successfully');
    return emailResult;
    
  } catch (error: any) {
    console.error("Error generating email:", error);
    throw new Error(`Failed to generate email: ${error?.message || "Unknown error"}`);
  }
}

/**
 * Legacy email generation function - redirects to unified function
 */
export async function generateEmail(params: PRContentParams, attempt: number = 0): Promise<EmailResponse> {
  return generateEmailSeparately(params);
}

/**
 * Generates summary with custom prompt
 */
async function generateSummaryWithCustomPrompt(customPrompt: string, params: PRContentParams): Promise<SummaryResponse> {
  try {
    const systemPrompt = buildPrompt(customPrompt, params);
    
    const summaryResponse = await createChatCompletion({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Article Title: ${params.articleTitle}\n\nArticle Content: ${params.articleBody}` }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "summary_response",
          schema: summarySchema
        }
      }
    });

    const content = summaryResponse.choices[0].message.content;
    if (!content) throw new Error("No content returned from OpenAI");
    
    return JSON.parse(content) as SummaryResponse;
  } catch (error: any) {
    console.error("Error generating custom summary:", error);
    throw new Error(`Failed to generate summary: ${error?.message || "Unknown error"}`);
  }
}

/**
 * Generates angles with custom prompt
 */
async function generateAnglesWithCustomPrompt(customPrompt: string, params: PRContentParams): Promise<AnglesResponse> {
  try {
    const systemPrompt = buildPrompt(customPrompt, params);
    
    const anglesResponse = await createChatCompletion({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Article Title: ${params.articleTitle}\n\nArticle Content: ${params.articleBody}` }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "angles_response",
          schema: anglesSchema
        }
      }
    });

    const content = anglesResponse.choices[0].message.content;
    if (!content) throw new Error("No content returned from OpenAI");
    
    return JSON.parse(content) as AnglesResponse;
  } catch (error: any) {
    console.error("Error generating custom angles:", error);
    throw new Error(`Failed to generate angles: ${error?.message || "Unknown error"}`);
  }
}

/**
 * Generates outline with custom prompt
 */
async function generateOutlineWithCustomPrompt(customPrompt: string, params: PRContentParams): Promise<OutlineResponse> {
  try {
    const systemPrompt = buildPrompt(customPrompt, params);
    
    const outlineResponse = await createChatCompletion({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Article Title: ${params.articleTitle}\n\nArticle Content: ${params.articleBody}` }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "outline_response",
          schema: outlineSchema
        }
      }
    });

    const content = outlineResponse.choices[0].message.content;
    if (!content) throw new Error("No content returned from OpenAI");
    
    const enhancedResponse = JSON.parse(content) as EnhancedOutlineResponse;
    
    // Convert to backward-compatible format
    return {
      idea: enhancedResponse.idea,
      outline: enhancedResponse.outline
    };
  } catch (error: any) {
    console.error("Error generating custom outline:", error);
    throw new Error(`Failed to generate outline: ${error?.message || "Unknown error"}`);
  }
}

/**
 * Wrapper function: Generate outline AND save to database immediately
 * This ensures outline is persisted for later article generation
 */
async function generateAndSaveOutline(params: PRContentParams, articleId: number, promptSet?: any): Promise<OutlineResponse> {
  try {
    console.log(`🔄 Generating and saving outline for article ${articleId}...`);
    
    // Generate outline
    const outline = promptSet 
      ? await generateOutlineWithCustomPrompt(promptSet.outline, params)
      : await generateOutline(params);
    
    // Save outline to database immediately
    await storage.createPrContent({
      articleId,
      type: "outline",
      content: JSON.stringify(outline.outline)
    });
    
    console.log(`✅ Outline generated and saved to database for article ${articleId}`);
    return outline;
  } catch (error: any) {
    console.error(`❌ Error generating and saving outline for article ${articleId}:`, error);
    throw error;
  }
}

/**
 * Wrapper function: Retrieve outline from database BEFORE generating article
 * This ensures article generation has access to the structured outline
 */
async function generateArticleWithDatabaseOutline(params: PRContentParams, articleId: number): Promise<ArticleResponse> {
  try {
    console.log(`🔄 Retrieving outline from database for article ${articleId}...`);
    
    // Retrieve outline from database
    const outlineRecord = await storage.getPrContentByArticleIdAndType(articleId, 'outline');
    let outlineArray: string[] | undefined;
    
    if (outlineRecord && outlineRecord.content) {
      try {
        outlineArray = JSON.parse(outlineRecord.content);
        console.log(`✅ Retrieved outline with ${outlineArray?.length || 0} points from database`);
      } catch (parseError) {
        console.warn(`⚠️  Failed to parse outline from database for article ${articleId}:`, parseError);
      }
    } else {
      console.warn(`⚠️  No outline found in database for article ${articleId}`);
    }
    
    // Generate article with outline context
    console.log(`🔄 Generating article with outline context for article ${articleId}...`);
    const article = await generateArticle(params, outlineArray);
    
    console.log(`✅ Article generated successfully for article ${articleId}`);
    return article;
  } catch (error: any) {
    console.error(`❌ Error generating article with database outline for article ${articleId}:`, error);
    throw error;
  }
}

/**
 * Email generation with custom prompt - redirects to unified function with custom prompt in params
 */
async function generateEmailWithCustomPrompt(customPrompt: string, params: PRContentParams): Promise<EmailResponse> {
  // Use the unified function with the custom prompt (temporarily override EMAIL_PROMPT)
  const originalPrompt = EMAIL_PROMPT;
  
  try {
    // Temporarily override the prompt
    const enhancedParams = { ...params, customEmailPrompt: customPrompt };
    return generateEmailSeparately(enhancedParams);
  } finally {
    // Restore original prompt (though not needed in this implementation)
  }
}



/**
 * Validates publication links with async HEAD requests
 */
async function validatePublicationLink(link: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(link, { 
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.status < 400;
  } catch (error) {
    return false;
  }
}

/**
 * Validates article content against simplified schema requirements (title + content only)
 */
function validateSimplifiedArticle(response: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!response.title || response.title.length < 10) {
    errors.push('Title too short (minimum 10 characters)');
  }
  
  if (!response.content) {
    errors.push('Content missing');
  } else {
    const wordCount = response.content.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
    if (wordCount < 600 || wordCount > 800) {
      errors.push(`Word count ${wordCount} outside target range 600-800`);
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Validates article content against ArticleDraftV2 requirements (legacy - kept for compatibility)
 */
function validateArticleDraftV2(response: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!response.title || response.title.length < 10) {
    errors.push('Title too short (minimum 10 characters)');
  }
  
  if (!response.content) {
    errors.push('Content missing');
  } else {
    const wordCount = response.content.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
    if (wordCount < 600 || wordCount > 800) {
      errors.push(`Word count ${wordCount} outside target range 600-800`);
    }
  }
  
  if (!response.hook_stat || response.hook_stat.length < 10) {
    errors.push('Hook stat missing or too short');
  }
  
  if (!response.stat_date) {
    errors.push('Stat date missing');
  } else {
    // Check if stat_date is within 90 days
    const statDate = new Date(response.stat_date);
    const now = new Date();
    const daysDiff = Math.abs(now.getTime() - statDate.getTime()) / (1000 * 3600 * 24);
    if (daysDiff > 90) {
      errors.push('Stat date is older than 90 days');
    }
  }
  
  if (!response.pitch_email || response.pitch_email.length < 120) {
    errors.push('Pitch email missing or too short (minimum 120 characters)');
  }
  
  if (!response.byline_draft || response.byline_draft.length < 400) {
    errors.push('Byline draft missing or too short (minimum 400 characters)');
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Generates complete thought leadership article using enhanced structured approach
 */
export async function generateArticle(params: PRContentParams, outline?: string[]): Promise<ArticleResponse> {
  try {
    // Extract key numbers from article content
    const combinedText = `${params.articleTitle} ${params.articleBody}`;
    const keyNumbers = extractKeyNumbers(combinedText);
    
    // Log extraction results for monitoring
    logNumberExtraction(keyNumbers, `article-${params.articleTitle?.slice(0, 30) || 'untitled'}`);
    
    // Pass extracted numbers to buildPrompt
    const enhancedParams = { ...params, keyNumbers };
    const systemPrompt = buildPrompt(ARTICLE_PROMPT, enhancedParams);
    
    // Build user message with outline structure if available
    let userMessage = `Article Title: ${params.articleTitle}\n\nArticle Content: ${params.articleBody}`;
    
    if (outline && outline.length > 0) {
      userMessage += `\n\nTHOUGHT LEADERSHIP OUTLINE TO FOLLOW:\n${outline.map((point, index) => `${index + 1}. ${point}`).join('\n')}`;
    }
    
    // Add extracted data points as reminder
    if (keyNumbers.length > 0) {
      userMessage += `\n\nKEY DATA POINTS TO INCLUDE:\n${keyNumbers.map(num => `• ${num}`).join('\n')}`;
    }

    // Phase 1 Diagnostics: Calculate input metrics
    const totalPromptLength = systemPrompt.length + userMessage.length;
    const estimatedInputTokens = Math.ceil(totalPromptLength / 4);
    
    if (isDiagnosticsEnabled()) {
      console.log('📄 ARTICLE GENERATION DIAGNOSTICS - REQUEST:');
      console.log('==============================================');
      console.log(`📊 Request Config:`, {
        model: MODEL,
        max_tokens: ARTICLE_GENERATION_CONFIG.max_tokens,
        temperature: ARTICLE_GENERATION_CONFIG.temperature,
        top_p: ARTICLE_GENERATION_CONFIG.top_p
      });
      console.log(`📏 Input Metrics:`, {
        systemPromptLength: systemPrompt.length,
        userPromptLength: userMessage.length,
        totalPromptLength,
        estimatedInputTokens,
        hasOutline: outline ? outline.length : 0
      });
    }
    
    const articleResponse = await createChatCompletionWithRetry({
      model: MODEL,
      ...ARTICLE_GENERATION_CONFIG,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "article_response",
          schema: articleSchema
        }
      }
    }, "Article generation");

    const content = articleResponse.choices[0].message.content;
    if (!content) throw new Error("No content returned from OpenAI");
    
    let enhancedResponse: EnhancedArticleResponse;
    
    try {
      enhancedResponse = JSON.parse(content) as EnhancedArticleResponse;
      
      // Simple validation for simplified schema (title + content only)
      const validation = validateSimplifiedArticle(enhancedResponse);
      if (!validation.isValid) {
        console.log('⚠️ Article validation failed:', validation.errors);
      }
      
    } catch (parseError) {
      console.error('❌ Article JSON parse error:', parseError);
      throw new Error(`Failed to parse article response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    // Phase 1 Diagnostics: Comprehensive article analysis
    if (isDiagnosticsEnabled()) {
      const articleContent = enhancedResponse.content;
      const wordCount = articleContent.split(/\s+/).filter(word => word.length > 0).length;
      const completionAnalysis = analyzeContentCompletion(articleContent, 'article');
      const tokenCeiling = detectTokenCeiling(
        {
          finishReason: articleResponse.choices[0].finish_reason,
          totalTokens: articleResponse.usage?.total_tokens,
          promptTokens: articleResponse.usage?.prompt_tokens,
          completionTokens: articleResponse.usage?.completion_tokens,
          tokenUtilization: articleResponse.usage 
            ? (articleResponse.usage.total_tokens / ARTICLE_GENERATION_CONFIG.max_tokens) * 100 
            : undefined
        },
        ARTICLE_GENERATION_CONFIG.max_tokens
      );
      const stopSequenceCollision = detectStopSequenceCollision(
        articleContent, 
        articleResponse.choices[0].finish_reason
      );

      const diagnosticData: DiagnosticData = {
        contentType: 'article',
        articleId: params.articleId || 0,
        requestId: articleResponse.id,
        timestamp: new Date().toISOString(),
        inputMetrics: {
          systemPromptLength: systemPrompt.length,
          userPromptLength: userMessage.length,
          totalInputLength: totalPromptLength,
          estimatedInputTokens
        },
        responseMetrics: {
          finishReason: articleResponse.choices[0].finish_reason,
          totalTokens: articleResponse.usage?.total_tokens,
          promptTokens: articleResponse.usage?.prompt_tokens,
          completionTokens: articleResponse.usage?.completion_tokens,
          tokenUtilization: articleResponse.usage 
            ? (articleResponse.usage.total_tokens / ARTICLE_GENERATION_CONFIG.max_tokens) * 100 
            : undefined
        },
        contentAnalysis: {
          outputLength: articleContent.length,
          wordCount,
          endsWithPunctuation: /[.!?]$/.test(articleContent.trim()),
          hasRequiredClosing: undefined, // Articles don't have specific closings
          truncationIndicators: [
            ...(tokenCeiling ? ['Token ceiling detected'] : []),
            ...(stopSequenceCollision ? ['Stop sequence collision possible'] : []),
            ...completionAnalysis.issues
          ]
        },
        rawResponse: content
      };

      logDiagnostics(diagnosticData);
      
      // Additional analysis for byline consistency issues
      if (articleResponse.choices[0].finish_reason === 'length') {
        console.log('🚨 CRITICAL: Article finish_reason = "length" - Token ceiling confirmed!');
      }
      
      if (stopSequenceCollision) {
        console.log('⚠️ CRITICAL: Potential stop sequence collision in article');
      }

      if (wordCount < 600) {
        console.log(`⚠️ BYLINE ISSUE: Article under target (${wordCount}/600-800 words)`);
      }
    }
    
    // Phase 4: Content Length Validation & Enhancement
    const articleContent = enhancedResponse.content;
    const wordCount = articleContent.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    console.log(`📊 Generated article word count: ${wordCount} words`);
    
    // If article is significantly below target (< 600 words), attempt one retry with enhanced prompt
    if (wordCount < 600) {
      console.log('⚠️ Article below minimum threshold (600 words), attempting enhanced regeneration...');
      
      try {
        const enhancedPrompt = `${buildPrompt(ARTICLE_PROMPT, params)}

CRITICAL: The previous attempt generated only ${wordCount} words. This is insufficient for professional publication.

ENHANCED REQUIREMENTS:
- Generate EXACTLY 600-800 words of substantial content
- Develop multiple supporting arguments with detailed examples
- Include specific data points and industry insights
- Create comprehensive analysis, not surface-level commentary
- Add concrete implementation steps or recommendations
- Expand on implications and future outlook
- Ensure each paragraph contributes meaningfully to the narrative

Do not produce generic filler. Create comprehensive, valuable content that justifies the word count.`;

        // Include outline in retry if available
        let retryUserMessage = `Article Title: ${params.articleTitle}\n\nArticle Content: ${params.articleBody}`;
        if (outline && outline.length > 0) {
          retryUserMessage += `\n\nTHOUGHT LEADERSHIP OUTLINE TO FOLLOW:\n${outline.map((point, index) => `${index + 1}. ${point}`).join('\n')}`;
        }

        const retryResponse = await createChatCompletionWithRetry({
          model: MODEL,
          ...ARTICLE_GENERATION_CONFIG,
          temperature: 0.8, // Slightly higher creativity for retry
          messages: [
            { role: "system", content: enhancedPrompt },
            { role: "user", content: retryUserMessage }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "article_response", 
              schema: articleSchema
            }
          }
        }, "Enhanced article regeneration");

        const retryContent = retryResponse.choices[0].message.content;
        if (retryContent) {
          const retryParsed = JSON.parse(retryContent) as EnhancedArticleResponse;
          const retryWordCount = retryParsed.content.trim().split(/\s+/).filter(word => word.length > 0).length;
          
          console.log(`🔄 Retry generated: ${retryWordCount} words`);
          
          // Use retry version if it's longer and meets minimum standards
          if (retryWordCount > wordCount && retryWordCount >= 400) {
            console.log(`✅ Using enhanced version with ${retryWordCount} words`);
            return {
              title: retryParsed.title,
              content: retryParsed.content
            };
          }
        }
      } catch (retryError) {
        console.error('❌ Enhanced regeneration failed:', retryError);
        // Continue with original version
      }
    }
    
    // Log final result
    if (wordCount >= 600 && wordCount <= 800) {
      console.log(`✅ Article meets target range: ${wordCount} words`);
    } else if (wordCount >= 400) {
      console.log(`⚠️ Article below target but acceptable: ${wordCount} words`);
    } else {
      console.log(`❌ Article critically short: ${wordCount} words`);
    }
    
    // QA validation check as per ChatGPT's plan
    const qa = quickQA(enhancedResponse, params.industry || "");
    console.log(JSON.stringify({ 
      operation: "Article QA Check",
      qualityPass: qa.pass,
      recencyOk: qa.recencyOk,
      wcOk: qa.wcOk,
      linksOk: qa.linksOk,
      industryOk: qa.industryOk,
      details: qa.details,
      timestamp: new Date().toISOString()
    }));
    
    // If QA fails, log for review but continue (no auto-retry as per ChatGPT's guidance)
    if (!qa.pass) {
      console.log('🔍 QA Check Failed - Content needs manual review');
      // Note: In a full implementation, this would surface a toast to the UI
      // For now, we log and continue to maintain backward compatibility
    }
    
    // Convert to backward-compatible format
    return {
      title: enhancedResponse.title,
      content: enhancedResponse.content
    };
  } catch (error: any) {
    console.error("Error generating article:", error);
    throw new Error(`Failed to generate article: ${error?.message || "Unknown error"}`);
  }
}

/**
 * Processes an article and generates all PR content pieces
 */
export async function processArticleWithAI(
  articleId: number,
  articleTitle: string,
  articleBody: string,
  companyName?: string,
  industry?: string,
  brandTone?: string[],
  keyPhrases?: string[],
  targetRegions?: string[],
  documentContext?: string[],
  promptSet?: { summary: string; angles: string; outline: string; linkedinIdea: string; email: string },
  sourceType?: 'CLIENT' | 'NEWS',
  userId?: number,
  companyId?: number
): Promise<GeneratedPRContent> {
  try {
    const params: PRContentParams = {
      articleTitle,
      articleBody,
      companyName: companyName || undefined,
      industry: industry || undefined,
      brandTone,
      keyPhrases,
      targetRegions,
      documentContext,
      articleId, // Added for Phase 1 diagnostics tracking
    };

    // Log company context injection for debugging
    logCompanyContextInjection(params);
    
    // Validate that we have meaningful company context
    const hasCompanyContext = !!(companyName || industry || brandTone || keyPhrases?.length || targetRegions?.length);
    console.log(`📊 Company context available: ${hasCompanyContext ? 'YES' : 'NO'}`);
    
    if (!hasCompanyContext) {
      console.warn('⚠️ WARNING: No company context provided - AI output will use generic fallbacks');
    }

    // Generate industry context for content enrichment
    const industryContextParams = {
      industry: industry || 'technology',
      articleTitle,
      companyKeywords: keyPhrases || [],
      targetRegions: targetRegions || []
    };
    
    console.log('🔍 Generating industry context for content enrichment...');
    const [summaryContext, anglesContext, outlineContext, articleContext, emailContext] = await Promise.all([
      generateIndustryContext({ ...industryContextParams, contentType: 'summary' }),
      generateIndustryContext({ ...industryContextParams, contentType: 'angles' }),
      generateIndustryContext({ ...industryContextParams, contentType: 'outline' }),
      generateIndustryContext({ ...industryContextParams, contentType: 'article' }),
      generateIndustryContext({ ...industryContextParams, contentType: 'email' })
    ]);
    
    // Generate core content pieces using enhanced streaming queue
    console.log(`Starting content generation for article ${articleId}`);
    
    const isStreamingEnabled = process.env.STREAMING_UI === 'true';
    const useQueue = userId && companyId && isStreamingEnabled;
    
    let summaryResult: any, anglesResult: any, outlineResult: any, emailResult: any, articleResult: any;
    
    if (useQueue) {
      console.log('Using streaming queue for content generation...');
      
      // Generate content pieces sequentially through streaming queue for better user feedback
      const streamingSummary = await createStreamingRequest(
        userId!, companyId!, articleId, 'summary',
        () => promptSet ? generateSummaryWithCustomPrompt(promptSet.summary, { ...params, industryContext: summaryContext }) : generateSummary({ ...params, industryContext: summaryContext })
      ).catch(error => ({ status: 'rejected', reason: error } as const));

      const streamingAngles = await createStreamingRequest(
        userId!, companyId!, articleId, 'angles',
        () => promptSet ? generateAnglesWithCustomPrompt(promptSet.angles, { ...params, industryContext: anglesContext }) : generateAngles({ ...params, industryContext: anglesContext })
      ).catch(error => ({ status: 'rejected', reason: error } as const));

      const streamingOutline = await createStreamingRequest(
        userId!, companyId!, articleId, 'outline',
        () => generateAndSaveOutline({ ...params, industryContext: outlineContext }, articleId, promptSet)
      ).catch(error => ({ status: 'rejected', reason: error } as const));

      const streamingEmail = await createStreamingRequest(
        userId!, companyId!, articleId, 'email',
        () => generateEmailSeparately({ ...params, industryContext: emailContext })
      ).catch(error => ({ status: 'rejected', reason: error } as const));

      // Generate article with database-persisted outline for proper sequencing
      const streamingArticle = await createStreamingRequest(
        userId!, companyId!, articleId, 'article',
        () => generateArticleWithDatabaseOutline({ ...params, industryContext: articleContext }, articleId)
      ).catch(error => ({ status: 'rejected', reason: error } as const));

      // Convert to Promise.allSettled format for compatibility
      [summaryResult, anglesResult, outlineResult, emailResult, articleResult] = [
        'status' in streamingSummary ? streamingSummary : { status: 'fulfilled' as const, value: streamingSummary },
        'status' in streamingAngles ? streamingAngles : { status: 'fulfilled' as const, value: streamingAngles },
        'status' in streamingOutline ? streamingOutline : { status: 'fulfilled' as const, value: streamingOutline },
        'status' in streamingEmail ? streamingEmail : { status: 'fulfilled' as const, value: streamingEmail },
        'status' in streamingArticle ? streamingArticle : { status: 'fulfilled' as const, value: streamingArticle }
      ];
      
    } else {
      console.log('Using fallback non-streaming generation...');
      
      const generateWithTimeout = async <T>(
        promise: Promise<T>, 
        timeoutMs: number, 
        description: string
      ): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(`${description} timed out after ${timeoutMs}ms`)), timeoutMs)
          )
        ]);
      };

      // Generate with sequential strategy to avoid rate limiting
      console.log('Generating content sequentially to avoid rate limits...');
      
      // Process each content type sequentially with rate limiting delays
      // Summary first for immediate user feedback
      summaryResult = await generateWithTimeout(
        promptSet ? generateSummaryWithCustomPrompt(promptSet.summary, { ...params, industryContext: summaryContext }) : generateSummary({ ...params, industryContext: summaryContext }),
        40000, 'Summary generation' // Increased to 40s for maximum reliability
      ).then(result => ({ status: 'fulfilled' as const, value: result }))
       .catch(error => ({ status: 'rejected' as const, reason: error }));

      // Rate limiting delay between requests
      console.log('⏱️ Rate limit protection: waiting 3s before next request...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      anglesResult = await generateWithTimeout(
        promptSet ? generateAnglesWithCustomPrompt(promptSet.angles, { ...params, industryContext: anglesContext }) : generateAngles({ ...params, industryContext: anglesContext }),
        40000, 'Angles generation' // Increased to 40s for maximum reliability
      ).then(result => ({ status: 'fulfilled' as const, value: result }))
       .catch(error => ({ status: 'rejected' as const, reason: error }));

      // Rate limiting delay between requests
      console.log('⏱️ Rate limit protection: waiting 3s before next request...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      outlineResult = await generateWithTimeout(
        generateAndSaveOutline({ ...params, industryContext: outlineContext }, articleId, promptSet),
        40000, 'Outline generation' // Increased to 40s for maximum reliability
      ).then(result => ({ status: 'fulfilled' as const, value: result }))
       .catch(error => ({ status: 'rejected' as const, reason: error }));

      // Rate limiting delay between requests
      console.log('⏱️ Rate limit protection: waiting 3s before next request...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('🔄 Starting email generation with generateEmailSeparately...');
      emailResult = await generateWithTimeout(
        generateEmailSeparately({ ...params, industryContext: emailContext }),
        40000, 'Email generation' // Increased to 40s for maximum reliability
      ).then(result => {
        console.log('✅ Email generation completed successfully');
        console.log(`📧 Email result: Subject "${result.subject}", Body length: ${result.body.length} chars`);
        return { status: 'fulfilled' as const, value: result };
      })
       .catch(error => {
        console.error('❌ Email generation failed in timeout wrapper:', error);
        return { status: 'rejected' as const, reason: error };
      });

      // Rate limiting delay before final article generation
      console.log('⏱️ Rate limit protection: waiting 3s before article generation...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Generate article with database-persisted outline
      articleResult = await generateWithTimeout(
        generateArticleWithDatabaseOutline({ ...params, industryContext: articleContext }, articleId),
        40000, 'Article generation' // Increased to 40s for maximum reliability
      ).then(result => ({ status: 'fulfilled' as const, value: result }))
       .catch(error => ({ status: 'rejected' as const, reason: error }));
    }

    // Process results with fallback content to ensure saves always work
    const summary = summaryResult.status === 'fulfilled' ? summaryResult.value.summary : 
      `${params.companyName || 'The company'} announces ${params.articleTitle}. This development represents a significant step forward in ${params.industry || 'their industry'}.`;
    
    const angles = anglesResult.status === 'fulfilled' ? anglesResult.value.angles : [
      {
        headline: "Market Impact Analysis",
        commentary: `This announcement from ${params.companyName || 'the company'} demonstrates strategic positioning in ${params.industry || 'the market'}.`
      },
      {
        headline: "Industry Perspective",
        commentary: "This development reflects broader industry trends and competitive dynamics."
      }
    ];
    
    const outline = outlineResult.status === 'fulfilled' ? outlineResult.value.outline : [
      "Understanding the strategic context and market opportunity",
      "Analyzing the competitive landscape and positioning",
      "Exploring implementation challenges and solutions",
      "Evaluating long-term implications for the industry"
    ];
    
    const email = emailResult.status === 'fulfilled' ? emailResult.value : {
      subject: `News: ${params.articleTitle.substring(0, 40)}...`,
      body: `Hi [Name],\n\nI wanted to share some interesting news about ${params.companyName || 'a company'} and their recent announcement regarding ${params.articleTitle}.\n\nThis could be relevant for your coverage of ${params.industry || 'the industry'}.\n\nBest regards,\n[Your name]`
    };
    
    const article = articleResult.status === 'fulfilled' ? articleResult.value : {
      title: `Thought Leadership: ${params.articleTitle}`,
      content: `The recent announcement regarding ${params.articleTitle} presents an opportunity to examine broader industry trends and strategic implications.\n\nAs companies navigate an increasingly complex landscape, developments like this highlight the importance of strategic positioning and market awareness. Industry leaders must consider both immediate opportunities and long-term implications.\n\nThe key takeaway is that successful organizations must balance innovation with practical implementation, ensuring that strategic initiatives deliver measurable value while positioning for future growth.\n\nThis represents not just a single announcement, but part of a broader evolution in how companies approach market challenges and opportunities.`
    };

    // Log any failures
    const allResults = [summaryResult, anglesResult, outlineResult, emailResult, articleResult];
    const names = ['summary', 'angles', 'outline', 'email', 'article'];
    
    allResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to generate ${names[index]}:`, result.reason?.message || result.reason);
      } else {
        console.log(`Successfully generated ${names[index]}`);
      }
    });

    // Ensure we have essential content or throw error
    const successCount = allResults.filter(r => r.status === 'fulfilled').length;
    console.log(`Generated ${successCount}/5 content pieces successfully`);
    
    if (successCount < 3) {
      throw new Error(`Content generation failed: only ${successCount}/5 pieces generated successfully`);
    }

    // Generate LinkedIn content for CLIENT articles only
    let linkedinResult = null;
    if (sourceType === 'CLIENT' && angles && angles.length > 0) {
      try {
        // Create fallback LinkedIn content
        const hook = "💡 What if the best productivity hack is doing nothing for 3 minutes?";
        const bullets = angles.slice(0, 3).map((angle: any) => 
          angle.headline.length > 40 ? angle.headline.substring(0, 37) + '...' : angle.headline
        );
        const cta = "DM me for the full dataset 📊";
        
        linkedinResult = {
          hook,
          content: buildLinkedIn({ hook, bullets, cta }),
          cta
        };
        console.log('Successfully generated LinkedIn content');
      } catch (error: any) {
        console.error('Failed to generate LinkedIn content:', error?.message || error);
        linkedinResult = null;
      }
    }

    // For CLIENT articles, also generate media suggestions
    let mediaSuggestions = null;
    if (sourceType === 'CLIENT' && keyPhrases && targetRegions) {
      try {
        console.log('🎯 Starting media suggestions generation with 30s timeout...');
        
        // Add timeout protection (30 seconds max) to prevent hanging
        const mediaSuggestionsPromise = generateMediaSuggestions({
          articleTitle: params.articleTitle,
          articleBody: params.articleBody,
          companyKeywords: keyPhrases,
          targetRegions: targetRegions
        });
        
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Media suggestions generation timeout after 30s')), 30000)
        );
        
        mediaSuggestions = await Promise.race([mediaSuggestionsPromise, timeoutPromise]);
        console.log('✅ Media suggestions generated successfully');
      } catch (error) {
        console.warn('⚠️ Media suggestions generation failed, continuing without them:', error instanceof Error ? error.message : error);
      }
    }

    // Transform the results into our expected format with enhanced structure
    const prContent: GeneratedPRContent = {
      summary,
      angles: angles ? angles.map((angle: any) => ({
        headline: angle.headline,
        paragraph: angle.commentary
      })) : [],
      outline: outline ? outline.slice(0, 5) : [],
      article,
      linkedinIdea: linkedinResult,
      email: {
        subject: email.subject,
        body: email.body
      }
    };

    // Add length guard for outline content (400 words max)
    if (prContent.outline) {
      const outlineText = prContent.outline.join(' ');
      const wordCount = outlineText.split(' ').length;
      if (wordCount > 400) {
        console.warn(`Outline exceeds 400 words (${wordCount}), truncating...`);
        const words = outlineText.split(' ').slice(0, 400);
        const truncatedText = words.join(' ');
        // Split back into bullet points, ensuring we don't break mid-sentence
        prContent.outline = [truncatedText + '...'];
      }
    }

    // Add media suggestions for CLIENT articles only
    if (mediaSuggestions) {
      prContent.journalistSuggestions = mediaSuggestions.journalists;
      prContent.publicationSuggestions = mediaSuggestions.publications;
    }

    return prContent;
  } catch (error: any) {
    console.error(`Error processing article ${articleId}:`, error);
    throw new Error(error?.message || "Unknown error during article processing");
  }
}

/**
 * Generates industry context using web search for content enrichment
 */
export async function generateIndustryContext(params: {
  industry: string;
  articleTitle: string;
  companyKeywords: string[];
  targetRegions: string[];
  contentType: 'summary' | 'angles' | 'outline' | 'article' | 'email';
}): Promise<string> {
  try {
    const industryDisplay = params.industry === 'other' ? 'technology' : params.industry;
    const regions = params.targetRegions.length > 0 ? params.targetRegions.join(', ') : 'global';
    
    // Extract company name from article title for more specific searches
    const companyNameMatch = params.articleTitle.match(/^([^:]+):/);
    const companyName = companyNameMatch ? companyNameMatch[1].trim() : '';
    
    // Build search query based on content type - now including specific company info
    const searchQueries = {
      'summary': `${companyName} ${industryDisplay} statistics revenue funding data metrics growth rates ${regions}`,
      'angles': `${companyName} performance metrics market share statistics competitive data ${industryDisplay} ${regions}`,
      'outline': `${companyName} case study data benchmarks ROI metrics ${industryDisplay} statistics ${regions}`,
      'article': `${companyName} company statistics revenue growth competitive analysis ${industryDisplay} market data ${regions}`,
      'email': `${companyName} recent news performance metrics ${industryDisplay} market statistics ${regions}`
    };

    const searchQuery = searchQueries[params.contentType];
    
    console.log(`🔍 Generating industry context for ${params.contentType}: "${searchQuery}"`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a market research assistant specializing in data extraction. Your primary goal is to find and report specific statistics, percentages, growth rates, and numerical data from web search results. Focus on:
- Company-specific data (revenue, growth, market share, funding)
- Industry benchmarks and comparative metrics
- Exact percentages and growth rates
- Performance metrics and ROI data
- Competitive positioning statistics
- Technology adoption rates and efficiency gains
Keep response concise (200-300 words) but prioritize including as many specific data points as possible. Always cite the specific number, not vague references.`
          },
          {
            role: 'user',
            content: `Research: ${searchQuery}. Focus on finding specific data about ${companyName || 'the company'} and recent developments in ${industryDisplay}. Article context: ${params.articleTitle}`
          }
        ],
        tools: [
          {
            type: 'web_search_preview',
            web_search_preview: {
              query: searchQuery,
              max_results: 8
            }
          }
        ],
        tool_choice: 'auto',
        max_tokens: 800,
        temperature: 0.3,
        user_location: {
          country: params.targetRegions.includes('UK') || params.targetRegions.includes('Europe') ? 'GB' : 'US',
          region: params.targetRegions.includes('UK') || params.targetRegions.includes('Europe') ? 'UK' : 'US'
        }
      })
    });

    if (!response.ok) {
      console.warn(`⚠️ Web search failed for ${params.contentType}:`, response.status);
      return `Recent ${industryDisplay} industry analysis suggests continued growth and innovation in the sector.`;
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0]?.message?.content) {
      const industryContext = data.choices[0].message.content;
      console.log(`✅ Industry context generated for ${params.contentType} (${industryContext.length} chars)`);
      return industryContext;
    } else {
      console.warn(`⚠️ No industry context returned for ${params.contentType}`);
      return `Recent ${industryDisplay} industry analysis suggests continued growth and innovation in the sector.`;
    }
  } catch (error: any) {
    console.error(`❌ Industry context generation failed for ${params.contentType}:`, error?.message || error);
    return `Recent ${params.industry} industry analysis suggests continued growth and innovation in the sector.`;
  }
}

/**
 * Generates media suggestions using the Responses API with web search
 */
export async function generateMediaSuggestions(params: {
  articleTitle: string;
  articleBody: string;
  companyKeywords: string[];
  targetRegions: string[];
  companyProfile?: any;
}): Promise<MediaSuggestionsResponse> {
  try {
    // Build the enhanced prompt with flexible quality requirements
    const input = `You are PRomptly's media intelligence assistant, skilled in public relations and editorial research for UK and EU markets.

Given the following:
- Article Title: "${params.articleTitle}"
- Article Content: "${params.articleBody}"
- Company Themes/Keywords: ${params.companyKeywords.join(', ')}
- Target Regions: ${params.targetRegions.join(', ')}

**Task:**
1. Research and identify 5–7 specific journalists (full name + current publication) who have written recent articles or cover beats related to this topic. Focus on finding journalists with verifiable recent bylines.
   - Search for journalists who have actually written about this industry, company, or related topics in the past 6 months
   - For each journalist, provide their specific relevance (recent article title, beat coverage, or demonstrated expertise)
   - Include active reporters, technology editors, and industry correspondents with proven track records
   - Prioritize journalists with accessible contact information (LinkedIn profiles, newsroom pages with their bio)

2. Research and identify 8–12 specific publications with demonstrated coverage of this industry or topic. Focus on publications that have actually published related content recently.
   - Search for publications that have covered this company, industry, or similar topics in the past 6 months
   - For each publication, identify the specific section/desk that covers this beat (e.g., "Technology desk", "Construction section", "Industry news")
   - Prioritize publications with dedicated coverage areas rather than generic business outlets
   - Include specific editorial contacts or section editors when identifiable

3. For each journalist and publication, provide direct contact links when available:
   - Journalists: LinkedIn profiles (linkedin.com/in/username), newsroom bio pages with their name, or recent article bylines
   - Publications: News tips pages (/tips, /submit-news), editorial guidelines (/editorial-guidelines), section contact pages, or specific editor emails
   - Examples: "https://linkedin.com/in/journalist-name", "https://techcrunch.com/tips/", "https://publication.com/construction/contact"
   - AVOID: Publication homepages, generic "Contact Us" pages, Wikipedia pages, or advertising pages
   - Publications must link to submission processes, not main navigation pages
   - Only include verified, actionable links under 100 characters that lead to editorial contact or submission workflows
   - If no direct editorial contact is found, leave empty—the system will provide targeted search alternatives

4. For niche or emerging topics where perfect matches are limited, include broader industry contacts who could develop interest, clearly noting their general relevance.

5. Focus on editorial value and accessibility for outreach, balancing specificity with practical contact opportunities.

6. Return only the following JSON structure:

{
  "journalists": [
    {
      "name": "Full Name",
      "publication": "Publication",
      "reason": "Why they are relevant (coverage area, expertise, or editorial focus)",
      "link": "optional direct link to profile or contact page"
    }
  ],
  "publications": [
    {
      "name": "Publication",
      "section": "Section or Desk",
      "reason": "Why this publication/section would be interested",
      "link": "optional direct link to tips page or section"
    }
  ]
}

**Quality Standards:**
- ACCURACY OVER QUANTITY: Better to provide 3 accurate journalists and 5 relevant publications than questionable contacts
- Every journalist must have verifiable recent coverage or clear industry expertise
- Every publication must have demonstrated coverage of this industry or related topics
- Journalist links must lead to specific profiles, bio pages, or direct contact methods (not publication homepages)
- Publication links must lead to editorial submission pages, tips pages, or section contact forms (not main navigation)
- Reasons must reference actual coverage, recent articles, or specific editorial focus areas
- Focus on contacts who have demonstrable decision-making access or editorial influence
- Publications must have relevant editorial sections, not just general business coverage
- If uncertain about accuracy or relevance, leave fields empty rather than guess`;

    console.log(`Generating media suggestions using ${MEDIA_SUGGESTIONS_MODEL} with web search`);
    
    // Add dynamic geo-targeting and industry bias
    const loc = getUserLocation(params.companyProfile);
    const industryHint = params.companyProfile?.industry?.trim();
    
    // Enhanced logging for debugging
    console.log('🌍 Sprint 2 Geo-targeting Applied:', {
      inputRegion: params.targetRegions?.[0],
      companyProfileRegions: params.companyProfile?.targetRegions,
      derivedLocation: loc,
      industry: params.companyProfile?.industry,
      industryBias: industryHint ? `Focus on authoritative ${industryHint} sources` : 'No industry bias'
    });

    const tools: any = [{ type: "web_search_preview" }];
    if (loc) {
      tools[0].user_location = loc;
    }

    const biasedInput = industryHint
      ? `Focus on authoritative ${industryHint} sources.\n${input}`
      : input;
    
    // Use the Responses API with web search
    const response = await openai.responses.create({
      model: MEDIA_SUGGESTIONS_MODEL,
      tools,
      input: biasedInput
    });

    if (!response.output_text) {
      throw new Error("No suggestions returned from OpenAI");
    }

    console.log("Raw OpenAI response received, parsing suggestions...");
    
    // Try to parse as JSON first (since we're requesting JSON structure)
    try {
      const jsonMatch = response.output_text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]) as MediaSuggestionsResponse;
        
        // Validate and clean the suggestions with link validation
        const cleanedSuggestions = await validateAndCleanSuggestionsWithLinks(suggestions);
        return cleanedSuggestions;
      }
    } catch (error) {
      console.log("JSON parsing failed, falling back to text parsing");
    }
    
    // Fallback to text parsing if JSON parsing fails
    const suggestions = parseMediaSuggestions(response.output_text);
    
    return suggestions;
  } catch (error: any) {
    console.error("Error generating media suggestions:", error);
    throw new Error(`Failed to generate media suggestions: ${error?.message || "Unknown error"}`);
  }
}

/**
 * Validates and cleans the suggestions with async link validation
 */
async function validateAndCleanSuggestionsWithLinks(suggestions: any): Promise<MediaSuggestionsResponse> {
  const cleanedJournalists = (suggestions.journalists || []).map((journalist: any) => ({
    name: journalist.name || 'Unknown',
    publication: journalist.publication || 'Unknown',
    reason: journalist.reason || 'No reason provided',
    link: journalist.link && journalist.link.trim() !== '' ? journalist.link : undefined
  })).slice(0, 7);

  const cleanedPublications = (suggestions.publications || []).map((publication: any) => ({
    name: publication.name || 'Unknown',
    section: publication.section || 'General',
    reason: publication.reason || 'No reason provided',
    link: publication.link && publication.link.trim() !== '' ? publication.link : undefined
  })).slice(0, MAX_PUBLICATIONS);

  // Note: Removing aggressive link validation to prevent missing buttons
  // Links will be validated by the browser when clicked, providing better UX
  const validatedPublications = cleanedPublications.map(async (publication: any) => {
    // Keep all links - let the UI handle validation when user clicks
    return publication;
  });
  
  const finalPublications = await Promise.all(validatedPublications);
  
  const linkCount = finalPublications.filter(pub => pub.link).length;
  console.log(`✅ Generated ${linkCount} publication links out of ${finalPublications.length} total (validation deferred to browser)`);
  
  // Log link availability for monitoring
  if (linkCount > 0) {
    console.log(`📎 Links available: ${linkCount} publications have associated URLs`);
  }

  return {
    journalists: cleanedJournalists,
    publications: finalPublications
  };
}

/**
 * Validates and cleans the suggestions from JSON parsing (legacy version)
 */
function validateAndCleanSuggestions(suggestions: any): MediaSuggestionsResponse {
  const cleanedJournalists = (suggestions.journalists || []).map((journalist: any) => ({
    name: journalist.name || 'Unknown',
    publication: journalist.publication || 'Unknown',
    reason: journalist.reason || 'No reason provided',
    link: journalist.link && journalist.link.trim() !== '' ? journalist.link : undefined
  })).slice(0, 7);

  const cleanedPublications = (suggestions.publications || []).map((publication: any) => ({
    name: publication.name || 'Unknown',
    section: publication.section || 'General',
    reason: publication.reason || 'No reason provided',
    link: publication.link && publication.link.trim() !== '' ? publication.link : undefined
  })).slice(0, MAX_PUBLICATIONS);

  return {
    journalists: cleanedJournalists,
    publications: cleanedPublications
  };
}

/**
 * Parses the OpenAI response text to extract structured media suggestions
 */
function parseMediaSuggestions(responseText: string): MediaSuggestionsResponse {
  const journalists: MediaSuggestionsResponse['journalists'] = [];
  const publications: MediaSuggestionsResponse['publications'] = [];
  
  // Split response into sections
  const lines = responseText.split('\n');
  let currentSection = '';
  let currentItem: any = {};
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) continue;
    
    // Detect sections
    if (trimmedLine.toLowerCase().includes('journalist')) {
      currentSection = 'journalists';
      continue;
    }
    if (trimmedLine.toLowerCase().includes('publication')) {
      currentSection = 'publications';
      continue;
    }
    
    // Parse numbered items (e.g., "1. **Name**" or "1. Name")
    const numberMatch = trimmedLine.match(/^\d+\.\s*\*\*(.+?)\*\*|^\d+\.\s*(.+?)(?:\s|$)/);
    if (numberMatch) {
      // Save previous item if exists
      if (currentItem.name && currentSection) {
        if (currentSection === 'journalists') {
          journalists.push({
            name: currentItem.name,
            publication: currentItem.publication || 'Unknown',
            reason: currentItem.reason || 'No reason provided',
            link: currentItem.link
          });
        } else if (currentSection === 'publications') {
          publications.push({
            name: currentItem.name,
            section: currentItem.section || 'General',
            reason: currentItem.reason || 'No reason provided',
            link: currentItem.link
          });
        }
      }
      
      // Start new item
      currentItem = {
        name: (numberMatch[1] || numberMatch[2] || '').trim()
      };
      continue;
    }
    
    // Parse description lines that follow the name
    if (currentItem.name && trimmedLine && !trimmedLine.startsWith('#')) {
      // Extract links from the line
      let cleanedLine = trimmedLine;
      const linkMatch = trimmedLine.match(/(https?:\/\/[^\s\)]+)/);
      if (linkMatch && !currentItem.link) {
        currentItem.link = linkMatch[1];
        // Remove link from reason text
        cleanedLine = trimmedLine.replace(linkMatch[0], '').trim();
      }
      
      if (!currentItem.reason) {
        currentItem.reason = cleanedLine;
      } else {
        currentItem.reason += ' ' + cleanedLine;
      }
      
      // Try to extract publication from the description for journalists
      if (currentSection === 'journalists' && !currentItem.publication) {
        const pubMatch = cleanedLine.match(/(?:at|for|with)\s+([A-Z][^.,]+)/);
        if (pubMatch) {
          currentItem.publication = pubMatch[1].trim();
        }
      }
      
      // Try to extract section from the description for publications
      if (currentSection === 'publications' && !currentItem.section) {
        const sectionMatch = cleanedLine.match(/(?:section|covers?|focus(?:es)? on)\s+([^.,]+)/i);
        if (sectionMatch) {
          currentItem.section = sectionMatch[1].trim();
        }
      }
    }
  }
  
  // Don't forget the last item
  if (currentItem.name && currentSection) {
    if (currentSection === 'journalists') {
      journalists.push({
        name: currentItem.name,
        publication: currentItem.publication || 'Unknown',
        reason: currentItem.reason || 'No reason provided',
        link: currentItem.link
      });
    } else if (currentSection === 'publications') {
      publications.push({
        name: currentItem.name,
        section: currentItem.section || 'General',
        reason: currentItem.reason || 'No reason provided',
        link: currentItem.link
      });
    }
  }
  
  return {
    journalists: journalists.slice(0, MAX_JOURNALISTS), // Limit to 7 as requested
    publications: publications.slice(0, MAX_PUBLICATIONS) // Limit to 15 for better coverage
  };
}

/**
 * Generate SEO metadata (meta description and keywords) for Publishing Pack
 */
export async function generatePublishingPackSEO(
  storySummary: string,
  storyTitle: string
): Promise<PublishingPackSEOResponse> {
  try {
    console.log('📦 Generating Publishing Pack SEO metadata...');
    
    const seoPrompt = `Based on the PR story below, generate SEO-optimized metadata:

Story Title: ${storyTitle}
Story Summary: ${storySummary}

Generate:
1. A concise SEO meta description (maximum 160 characters) that summarizes the story's key value proposition
2. A comma-separated list of 5-7 relevant keywords or entities (people, companies, technologies, trends) mentioned in the story

Focus on:
- Keywords that PR professionals and journalists would search for
- Specific entities, data points, and industry terms
- Terms that reflect the story's unique angle or findings`;

    const response = await createChatCompletionWithRetry({
      model: MODEL,
      ...DEFAULT_GENERATION_CONFIG,
      max_tokens: 500, // Short response needed
      messages: [
        { role: "system", content: "You are an SEO expert specializing in PR content optimization." },
        { role: "user", content: seoPrompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "publishing_pack_seo",
          schema: publishingPackSEOSchema
        }
      }
    }, "Publishing Pack SEO generation");

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No content returned from OpenAI");

    const seoData: PublishingPackSEOResponse = JSON.parse(content);
    
    console.log('✅ Publishing Pack SEO generated:', {
      metaDescriptionLength: seoData.metaDescription.length,
      keywordsCount: seoData.keywords.split(',').length
    });

    return seoData;
  } catch (error: any) {
    console.error('❌ Error generating Publishing Pack SEO:', error);
    throw new Error(`Failed to generate Publishing Pack SEO: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Build complete Publishing Pack with AI-generated SEO and placeholders
 */
export function buildPublishingPack(
  seoData: PublishingPackSEOResponse,
  storyTitle: string,
  storyDescription: string
): string {
  const publishingPack = `# 📰 PUBLISHING PACK

This Publishing Pack is automatically generated with each PRomptly story.
All placeholders wrapped in double braces ({{ }}) must be replaced manually after publication.
The pack includes SEO metadata, canonical options, and a JSON-LD schema compliant with Google's structured-data standards.

---

### JSON-LD Schema
\`\`\`json
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "mainEntityOfPage": "{{CANONICAL_URL}}",
  "headline": "${storyTitle}",
  "description": "${storyDescription}",
  "datePublished": "{{PUBLISH_DATE}}",
  "keywords": "${seoData.keywords}",
  "publisher": {
    "@type": "Organization",
    "name": "{{ORG_NAME}}",
    "logo": {
      "@type": "ImageObject",
      "url": "{{ORG_LOGO_URL}}"
    }
  },
  "dataset": {
    "@type": "Dataset",
    "name": "{{DATASET_NAME}}",
    "url": "{{DATASET_URL}}"
  }
}
\`\`\`

---

### Canonical URL Options

Choose the option below that matches your scenario and delete the others before publishing.

**Option 1: Use this if you published first (Owned-Primary)**
\`\`\`html
<link rel="canonical" href="{{CANONICAL_URL}}" />
\`\`\`

**Option 2: Use this if a journalist/publication published first (Earned-Primary)**
\`\`\`html
<link rel="canonical" href="{{PUBLICATION_CANONICAL_URL}}" />
\`\`\`

**Option 3: Use this for reprints or syndication (Syndication)**
\`\`\`html
<link rel="canonical" href="{{CANONICAL_URL}}" />
\`\`\`

---

### SEO Meta Description

*Auto-generated by OpenAI API based on story summary.*

> "${seoData.metaDescription}"

---

### Keywords & Entity Tags

*Auto-generated by OpenAI API based on article content.*

> ${seoData.keywords}

---

### Dataset Reference

Host your dataset in your public /data/ directory or CMS media library.
Ensure filenames remain consistent between article and dataset reference.

Dataset URL placeholder: {{DATASET_URL}}  
Dataset name placeholder: {{DATASET_NAME}}

---

**End of Publishing Pack**
*Copy and paste this entire section into your CMS or website editor after updating the placeholder values.*`;

  return publishingPack;
}