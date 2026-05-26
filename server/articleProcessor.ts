import { storage } from "./storage";
import { processArticleWithAI, generatePublishingPackSEO, buildPublishingPack } from "./openai";
import { DocumentProcessor } from "./documentProcessor";
import { PromptRouter } from "./promptRouter";

// Map to track processing status for articles
const processingArticles = new Map<number, boolean>();

/**
 * Processes an article and updates its PR content and history
 */
export async function processArticle(articleId: number, selectedDocumentIds?: number[]): Promise<void> {
  // Skip if already processing
  if (processingArticles.get(articleId)) {
    console.log(`Article ${articleId} is already being processed. Skipping.`);
    return;
  }

  try {
    // Mark article as processing
    processingArticles.set(articleId, true);
    
    // Update history to processing status
    await updateArticleStatus(articleId, "processing");
    
    // Get article data
    const article = await storage.getArticle(articleId);
    if (!article) {
      throw new Error(`Article ${articleId} not found`);
    }
    
    // Get company profile for additional context
    const companyProfile = await storage.getCompanyProfile(article.companyProfileId);
    
    // Get company documents for enhanced context
    let documentContext: string[] = [];
    if (companyProfile && selectedDocumentIds && selectedDocumentIds.length > 0) {
      // Get only the selected documents
      const selectedDocuments = [];
      for (const docId of selectedDocumentIds) {
        const doc = await storage.getCompanyDocument(docId);
        if (doc && doc.companyProfileId === companyProfile.id) {
          selectedDocuments.push(doc);
        }
      }
      
      // Format selected documents as context
      documentContext = selectedDocuments.map(doc => 
        `Document: ${doc.title}\n${doc.extractedContent}`
      );
    }
    
    // Get source-specific prompts
    const promptSet = PromptRouter.getPromptSet(article.sourceType || 'NEWS');
    
    // Get user ID for streaming queue context
    let userId: number | undefined;
    if (companyProfile) {
      userId = companyProfile.userId;
    }

    // Process the article with AI including document context and source-aware prompts
    const prContent = await processArticleWithAI(
      articleId,
      article.title,
      article.bodyText,
      companyProfile?.name || undefined,
      companyProfile?.industry || undefined,
      companyProfile?.tone ? [companyProfile.tone] : undefined,
      companyProfile?.keywords || undefined,
      companyProfile?.targetRegions || undefined,
      documentContext,
      promptSet,
      article.sourceType || 'NEWS',
      userId,
      companyProfile?.id
    );
    
    // Save the generated content
    await savePRContent(articleId, prContent);
    
    // Update history to done status
    await updateArticleStatus(articleId, "done");
    
    console.log(`Successfully processed article ${articleId}`);
  } catch (error: any) {
    console.error(`Error processing article ${articleId}:`, error);
    
    // Update history to error status
    await updateArticleStatus(articleId, "error", error?.message || "Unknown error");
  } finally {
    // Mark article as no longer processing
    processingArticles.delete(articleId);
  }
}

/**
 * Updates the status of an article in the history records
 */
async function updateArticleStatus(
  articleId: number, 
  status: "pending" | "processing" | "done" | "error", 
  errorMessage?: string
): Promise<void> {
  try {
    // Get the latest history record
    const historyRecords = await storage.getHistoryRecordsByArticleId(articleId);
    const latestRecord = historyRecords[0];
    
    if (latestRecord && latestRecord.status === "pending" && status === "processing") {
      // Update the existing record
      await storage.updateHistoryRecord(latestRecord.id, { status, errorMessage });
    } else {
      // Create a new record
      await storage.createHistoryRecord({
        articleId,
        status,
        errorMessage
      });
    }
  } catch (error) {
    console.error(`Error updating status for article ${articleId}:`, error);
  }
}

/**
 * Validates that all required content types are present
 */
function validateContentCompleteness(content: any): { isComplete: boolean; missing: string[] } {
  const requiredTypes = ['summary', 'angles', 'outline', 'email', 'article'];
  const missing: string[] = [];
  
  for (const type of requiredTypes) {
    if (!content[type]) {
      missing.push(type);
    }
  }
  
  return {
    isComplete: missing.length === 0,
    missing
  };
}

/**
 * Saves PR content to the database with validation
 */
async function savePRContent(articleId: number, content: any): Promise<void> {
  try {
    // Validate content completeness
    const validation = validateContentCompleteness(content);
    if (!validation.isComplete) {
      console.warn(`Incomplete content for article ${articleId}. Missing: ${validation.missing.join(', ')}`);
    }
    
    // Save summary
    if (content.summary) {
      await storage.createPrContent({
        articleId,
        type: "summary",
        content: content.summary
      });
    }
    
    // Save angles (as JSON string)
    if (content.angles) {
      await storage.createPrContent({
        articleId,
        type: "angle",
        content: JSON.stringify(content.angles)
      });
    }
    
    // Save outline (as JSON string)
    if (content.outline) {
      await storage.createPrContent({
        articleId,
        type: "outline",
        content: JSON.stringify(content.outline)
      });
    }
    
    // Save article content - now required for thought leadership
    if (content.article) {
      await storage.createPrContent({
        articleId,
        type: "article",
        content: JSON.stringify(content.article)
      });
      console.log(`Saved article content for article ${articleId}`);
    } else {
      console.warn(`Missing article content for article ${articleId} - will be generated in next processing cycle`);
    }
    
    // Save email (as JSON string)
    if (content.email) {
      await storage.createPrContent({
        articleId,
        type: "email",
        content: JSON.stringify(content.email)
      });
    }

    // Note: Media suggestions are NOT saved to database per Sprint 2a requirements
    // They are only returned in the JSON response
    
    // Generate and save Publishing Pack if we have summary and article
    if (content.summary && content.article?.title) {
      try {
        console.log(`📦 Generating Publishing Pack for article ${articleId}...`);
        
        // Add timeout protection (30 seconds max)
        const publishingPackPromise = (async () => {
          // Generate SEO metadata using OpenAI
          const seoData = await generatePublishingPackSEO(
            content.summary,
            content.article.title
          );
          
          // Build the complete Publishing Pack Markdown
          const publishingPack = buildPublishingPack(
            seoData,
            content.article.title,
            content.summary
          );
          
          return publishingPack;
        })();
        
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Publishing Pack generation timeout after 30s')), 30000)
        );
        
        const publishingPack = await Promise.race([publishingPackPromise, timeoutPromise]);
        
        // Save Publishing Pack to database
        await storage.createPrContent({
          articleId,
          type: "publishing_pack",
          content: publishingPack
        });
        
        console.log(`✅ Publishing Pack saved for article ${articleId}`);
      } catch (error) {
        console.error(`⚠️ Failed to generate Publishing Pack for article ${articleId}:`, error);
        // Don't throw - Publishing Pack is optional and shouldn't fail the entire process
      }
    } else {
      console.log(`ℹ️ Skipping Publishing Pack for article ${articleId} - missing summary or article title`);
    }
    
    // Log successful save with content summary
    const savedTypes = Object.keys(content).filter(key => 
      ['summary', 'angles', 'outline', 'email', 'article', 'publishing_pack'].includes(key) && content[key]
    );
    console.log(`Saved ${savedTypes.length}/6 content types for article ${articleId}: ${savedTypes.join(', ')}`);
    
  } catch (error) {
    console.error(`Error saving PR content for article ${articleId}:`, error);
    throw error;
  }
}