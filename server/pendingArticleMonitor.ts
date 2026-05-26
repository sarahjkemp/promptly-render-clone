import { storage } from "./storage";
import { processArticle } from "./articleProcessor";

/**
 * Monitors and automatically processes articles stuck in pending status
 * Also resets articles stuck in processing status back to pending for retry
 */
export class PendingArticleMonitor {
  private readonly PENDING_TIMEOUT_MINUTES = 5;
  private readonly PROCESSING_TIMEOUT_MINUTES = 20; // Reset processing articles stuck for 20+ minutes
  private readonly MAX_CONCURRENT_PROCESSING = 2; // Limit concurrent processing to avoid rate limits
  private readonly PROCESSING_DELAY_MS = 5000; // 5 second delay between starting each article
  
  /**
   * Check for articles stuck in pending or processing status and handle them
   */
  async checkAndProcessStuckArticles(): Promise<void> {
    try {
      console.log("Checking for stuck articles...");
      
      // First, reset any articles stuck in processing back to pending
      const stuckProcessingArticles = await this.getStuckProcessingArticles();
      if (stuckProcessingArticles.length > 0) {
        console.log(`Found ${stuckProcessingArticles.length} articles stuck in processing - resetting to pending:`, 
          stuckProcessingArticles.map(a => `${a.id}: ${a.title}`));
        
        for (const article of stuckProcessingArticles) {
          await this.resetProcessingToPending(article.id);
        }
      }
      
      // Then, get articles that have been pending for more than the timeout
      const stuckPendingArticles = await this.getStuckPendingArticles();
      
      if (stuckPendingArticles.length === 0) {
        console.log("No stuck pending articles found.");
        return;
      }
      
      console.log(`Found ${stuckPendingArticles.length} articles stuck in pending status:`, 
        stuckPendingArticles.map(a => `${a.id}: ${a.title}`));
      
      // Process stuck articles with rate limiting safeguards
      const articlesToProcess = stuckPendingArticles.slice(0, this.MAX_CONCURRENT_PROCESSING);
      
      for (const article of articlesToProcess) {
        console.log(`Auto-processing stuck pending article ${article.id}: ${article.title}`);
        
        // Start processing (don't await to avoid blocking)
        processArticle(article.id).catch(error => {
          console.error(`Error auto-processing article ${article.id}:`, error);
        });
        
        // Longer delay between starting each processing to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, this.PROCESSING_DELAY_MS));
      }
      
      if (stuckPendingArticles.length > this.MAX_CONCURRENT_PROCESSING) {
        console.log(`Limited processing to ${this.MAX_CONCURRENT_PROCESSING} articles to avoid rate limits. ${stuckPendingArticles.length - this.MAX_CONCURRENT_PROCESSING} articles remain pending.`);
      }
      
      console.log(`Queued ${articlesToProcess.length} stuck articles for processing.`);
    } catch (error) {
      console.error("Error checking stuck articles:", error);
    }
  }
  
  /**
   * Get articles that have been stuck in pending status
   */
  private async getStuckPendingArticles(): Promise<Array<{id: number, title: string}>> {
    try {
      // Get all articles and check their status
      const articles = await storage.getAllArticles();
      const stuckArticles: Array<{id: number, title: string}> = [];
      
      for (const article of articles) {
        const historyRecords = await storage.getHistoryRecordsByArticleId(article.id);
        const latestRecord = historyRecords[0];
        
        if (latestRecord && 
            latestRecord.status === 'pending' && 
            latestRecord.processedAt) {
          const minutesAgo = (Date.now() - new Date(latestRecord.processedAt).getTime()) / (1000 * 60);
          
          if (minutesAgo > this.PENDING_TIMEOUT_MINUTES) {
            stuckArticles.push({
              id: article.id,
              title: article.title
            });
          }
        }
      }
      
      return stuckArticles.slice(0, 10); // Limit to 10 articles
    } catch (error) {
      console.error("Error querying stuck pending articles:", error);
      return [];
    }
  }
  
  /**
   * Get articles that have been stuck in processing status
   */
  private async getStuckProcessingArticles(): Promise<Array<{id: number, title: string}>> {
    try {
      const articles = await storage.getAllArticles();
      const stuckArticles: Array<{id: number, title: string}> = [];
      
      for (const article of articles) {
        const historyRecords = await storage.getHistoryRecordsByArticleId(article.id);
        const latestRecord = historyRecords[0];
        
        if (latestRecord && 
            latestRecord.status === 'processing' && 
            latestRecord.processedAt) {
          const minutesAgo = (Date.now() - new Date(latestRecord.processedAt).getTime()) / (1000 * 60);
          
          if (minutesAgo > this.PROCESSING_TIMEOUT_MINUTES) {
            stuckArticles.push({
              id: article.id,
              title: article.title
            });
          }
        }
      }
      
      return stuckArticles;
    } catch (error) {
      console.error("Error querying stuck processing articles:", error);
      return [];
    }
  }

  /**
   * Reset a stuck processing article back to pending status
   */
  private async resetProcessingToPending(articleId: number): Promise<void> {
    try {
      console.log(`Resetting article ${articleId} from processing back to pending`);
      
      // Create a new pending record to reset the article
      await storage.createHistoryRecord({
        articleId,
        status: 'pending'
      });
      
      console.log(`Successfully reset article ${articleId} to pending status`);
    } catch (error) {
      console.error(`Error resetting article ${articleId} to pending:`, error);
    }
  }

  /**
   * Start periodic monitoring
   */
  startMonitoring(intervalMinutes: number = 10): NodeJS.Timeout {
    console.log(`Starting article monitor (checking every ${intervalMinutes} minutes)`);
    console.log(`- Pending timeout: ${this.PENDING_TIMEOUT_MINUTES} minutes`);
    console.log(`- Processing timeout: ${this.PROCESSING_TIMEOUT_MINUTES} minutes`);
    
    // Run initial check
    this.checkAndProcessStuckArticles();
    
    // Set up periodic checks
    return setInterval(() => {
      this.checkAndProcessStuckArticles();
    }, intervalMinutes * 60 * 1000);
  }
}

// Export singleton instance
export const pendingArticleMonitor = new PendingArticleMonitor();