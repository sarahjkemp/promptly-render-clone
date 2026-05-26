import { CompanyDocument } from "@shared/schema";
import * as mammoth from "mammoth";
import * as XLSX from "xlsx";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

export interface ProcessedDocument {
  extractedContent: string;
  summary: string;
  keywords: string[];
  processedAt: Date;
}

export class DocumentProcessor {
  /**
   * Process an uploaded file and extract text content
   */
  async processFile(file: Buffer, filename: string): Promise<ProcessedDocument> {
    const extractedText = await this.extractText(file, filename);
    const summary = await this.generateSummary(extractedText);
    const keywords = this.extractKeywords(extractedText);
    
    return {
      extractedContent: extractedText,
      summary,
      keywords,
      processedAt: new Date()
    };
  }

  /**
   * Extract text from various file formats
   */
  private async extractText(file: Buffer, filename: string): Promise<string> {
    const extension = this.getFileExtension(filename).toLowerCase();
    
    try {
      switch (extension) {
        case '.pdf':
          return await this.extractFromPDF(file);
        case '.docx':
          return await this.extractFromDOCX(file);
        case '.txt':
          return file.toString('utf-8');
        case '.xlsx':
        case '.xls':
          return await this.extractFromExcel(file);
        default:
          throw new Error(`Unsupported file type: ${extension}`);
      }
    } catch (error: any) {
      console.error(`Error extracting text from ${filename}:`, error);
      throw new Error(`Failed to extract text from ${filename}: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Extract text from PDF files
   */
  private async extractFromPDF(file: Buffer): Promise<string> {
    try {
      const data = await pdfParse(file);
      return data.text || '';
    } catch (error: any) {
      console.error('PDF processing error:', error);
      
      // Specific error handling for different error types
      if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot resolve')) {
        throw new Error('PDF processing module unavailable. Please contact support.');
      }
      
      if (error.code === 'ENOENT' && error.message?.includes('test/data')) {
        throw new Error('PDF processing library initialization failed. Please try again.');
      }
      
      if (error.message?.includes('Invalid PDF') || error.message?.includes('PDF')) {
        throw new Error('Invalid or corrupted PDF file. Please try a different file.');
      }
      
      throw new Error(`PDF processing failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Extract text from DOCX files
   */
  private async extractFromDOCX(file: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer: file });
    return result.value || '';
  }

  /**
   * Extract text from Excel files (.xlsx and .xls)
   */
  private async extractFromExcel(file: Buffer): Promise<string> {
    try {
      // Read the workbook from buffer
      const workbook = XLSX.read(file, { type: 'buffer' });
      
      // Check if workbook has any sheets
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Excel file contains no sheets or is empty.');
      }
      
      // Get the first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Check if worksheet has any data
      if (!worksheet || Object.keys(worksheet).length === 0) {
        throw new Error('Excel sheet is empty. Please provide a file with data.');
      }
      
      // Convert sheet to CSV format for better text extraction
      // This handles formulas, numbers, and text uniformly
      const csvData = XLSX.utils.sheet_to_csv(worksheet, { 
        blankrows: false, // Skip blank rows
        strip: true // Strip leading/trailing whitespace
      });
      
      // If no data extracted, throw error
      if (!csvData || csvData.trim().length === 0) {
        throw new Error('Excel file contains no extractable text. Please check the file content.');
      }
      
      // Convert CSV to more readable plain text format
      // Replace commas with tabs for better readability
      const textData = csvData
        .split('\n')
        .map(row => row.replace(/,/g, '\t'))
        .join('\n')
        .trim();
      
      return textData;
    } catch (error: any) {
      console.error('Excel processing error:', error);
      
      // Specific error handling for different error types
      if (error.message?.includes('Unsupported file') || error.message?.includes('invalid')) {
        throw new Error('Invalid or corrupted Excel file. Please try a different file.');
      }
      
      if (error.message?.includes('empty') || error.message?.includes('no sheets')) {
        throw new Error(error.message);
      }
      
      if (error.message?.includes('password') || error.message?.includes('encrypted')) {
        throw new Error('Password-protected Excel files are not supported. Please upload an unprotected file.');
      }
      
      throw new Error(`Excel processing failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate a summary of the document content
   */
  private async generateSummary(content: string): Promise<string> {
    // For now, return first 300 characters as summary
    // This can be enhanced with AI summarization later
    const trimmed = content.trim();
    if (trimmed.length <= 300) {
      return trimmed;
    }
    
    // Find a good break point near 300 characters
    const breakPoint = trimmed.lastIndexOf(' ', 300);
    return trimmed.substring(0, breakPoint > 200 ? breakPoint : 300) + '...';
  }

  /**
   * Extract keywords from document content
   */
  private extractKeywords(content: string): string[] {
    // Simple keyword extraction - can be enhanced with NLP later
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Count word frequency
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    // Return top 10 most frequent words
    return Object.entries(wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Find documents relevant to an article
   */
  async findRelevantDocuments(articleContent: string, documents: CompanyDocument[]): Promise<string[]> {
    const articleKeywords = this.extractKeywords(articleContent);
    
    return documents
      .filter(doc => doc.isActive)
      .map(doc => ({
        doc,
        relevanceScore: this.calculateRelevance(articleKeywords, doc.keywords || [])
      }))
      .filter(item => item.relevanceScore > 0.2) // Only include reasonably relevant docs
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3) // Top 3 most relevant
      .map(item => this.formatDocumentContext(item.doc));
  }

  /**
   * Calculate relevance score between article and document keywords
   */
  private calculateRelevance(articleKeywords: string[], docKeywords: string[]): number {
    if (!docKeywords || docKeywords.length === 0) return 0;
    
    const matches = articleKeywords.filter(keyword => 
      docKeywords.some(docKeyword => 
        docKeyword.toLowerCase().includes(keyword.toLowerCase()) ||
        keyword.toLowerCase().includes(docKeyword.toLowerCase())
      )
    );
    
    return matches.length / Math.max(articleKeywords.length, docKeywords.length);
  }

  /**
   * Format document context for AI prompts
   */
  private formatDocumentContext(doc: CompanyDocument): string {
    return `Document: ${doc.title} (${doc.documentType})
Summary: ${doc.summary || 'No summary available'}
Key Content: ${this.extractRelevantExcerpts(doc.extractedContent || '', 200)}`;
  }

  /**
   * Extract relevant excerpts from document content
   */
  private extractRelevantExcerpts(content: string, maxLength: number): string {
    if (!content || content.length <= maxLength) {
      return content;
    }
    
    // Find good break points to extract meaningful excerpts
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    let excerpt = '';
    
    for (const sentence of sentences) {
      if ((excerpt + sentence).length > maxLength) {
        break;
      }
      excerpt += sentence.trim() + '. ';
    }
    
    return excerpt.trim() || content.substring(0, maxLength) + '...';
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    return filename.substring(filename.lastIndexOf('.'));
  }

  /**
   * Validate file type and size
   */
  validateFile(filename: string, fileSize: number): { valid: boolean; error?: string } {
    const extension = this.getFileExtension(filename).toLowerCase();
    const supportedTypes = ['.pdf', '.docx', '.txt', '.xlsx', '.xls'];
    const maxSize = 25 * 1024 * 1024; // 25MB
    
    if (!supportedTypes.includes(extension)) {
      return {
        valid: false,
        error: 'Unsupported file type. Only PDF, DOCX, TXT, XLSX, and XLS are allowed.'
      };
    }
    
    if (fileSize > maxSize) {
      return {
        valid: false,
        error: 'File too large (max 25 MB). Please upload a smaller file.'
      };
    }
    
    if (fileSize === 0) {
      return {
        valid: false,
        error: 'Empty file not allowed. Please choose a valid document.'
      };
    }
    
    return { valid: true };
  }
}
