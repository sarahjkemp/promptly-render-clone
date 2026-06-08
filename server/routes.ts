import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { 
  insertArticleSchema, 
  insertHistoryRecordSchema,
  insertUserSchema,
  insertCompanyProfileSchema,
  insertCompanyDocumentSchema
} from "@shared/schema";
import { ZodError, z } from "zod";
import { processArticle } from "./articleProcessor";
import { DocumentProcessor } from "./documentProcessor";
import { generateMediaSuggestions } from "./openai";
import { validateCompanyContext } from "./middlewares/contextValidation";
import { fetchNewsForCompany } from "./news-fetcher";
import { handleStreamConnection, initializeStreamingEvents } from "./stream";
import { founderStorage } from "./founderStorage";
import { generateFounderPost } from "./founderPostEngine";
import multer from "multer";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['.pdf', '.docx', '.txt', '.xlsx', '.xls'];
      const allowedMimeTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      const extension = '.' + file.originalname.split('.').pop()?.toLowerCase();
      
      if (allowedTypes.includes(extension) || allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type. Supported types: ${allowedTypes.join(', ')}`));
      }
    }
  });

  // Initialize document processor
  const documentProcessor = new DocumentProcessor();
  
  // Initialize streaming events
  initializeStreamingEvents();

  // Health check route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Server-Sent Events endpoint for streaming updates
  app.get("/api/stream/:historyId", handleStreamConnection);

  // Get the current user's company profile
  app.get("/api/company-profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const userId = req.user!.id;
      const companyProfile = await storage.getCompanyProfileByUserId(userId);
      
      if (!companyProfile) {
        return res.status(404).json({ message: "Company profile not found" });
      }
      
      res.json(companyProfile);
    } catch (error) {
      console.error("Error fetching company profile:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Update company profile
  app.patch("/api/company-profile", async (req, res) => {
    console.log("➡️ Company profile update request received");
    console.log("🔑 Authentication status:", req.isAuthenticated());
    console.log("👤 User data:", req.user);
    console.log("📋 Request body:", req.body);
    console.log("🔍 Request headers:", req.headers);
    
    if (!req.isAuthenticated()) {
      console.warn("❌ Authentication failed for company profile update");
      return res.status(401).json({ message: "Authentication required" });
    }
    
    try {
      const userId = req.user!.id;
      console.log("🆔 User ID from session:", userId);
      
      const companyProfile = await storage.getCompanyProfileByUserId(userId);
      console.log("🏢 Found company profile:", companyProfile ? `ID: ${companyProfile.id}` : "Not found");
      
      if (!companyProfile) {
        console.warn("❌ Company profile not found for user:", userId);
        return res.status(404).json({ message: "Company profile not found" });
      }
      
      // Validate data with Zod schema
      const updateSchema = z.object({
        companyName: z.string().optional(),
        industry: z.string().optional(),
        industryCustom: z.string().optional(),
        companySize: z.string().optional(),
        tone: z.string().optional(),
        keywords: z.string().optional(),
        targetRegions: z.string().optional(),
        onboardingCompleted: z.boolean().optional(),
      });
      
      console.log("🔍 Validating request data with schema");
      let validatedData;
      try {
        validatedData = updateSchema.parse(req.body);
        console.log("✅ Data validation successful");
      } catch (validationError) {
        console.error("❌ Data validation failed:", validationError);
        throw validationError; // Re-throw to be caught by the outer try/catch
      }
      
      // Process the data for storage
      console.log("🔄 Processing data for database update");
      const dataToUpdate: any = {};
      
      // Process companyName field (stored as name in the DB)
      if (validatedData.companyName) {
        console.log("📝 Setting company name:", validatedData.companyName);
        dataToUpdate.name = validatedData.companyName;
      }
      
      // Copy other fields directly
      if (validatedData.industry) {
        console.log("📝 Setting industry:", validatedData.industry);
        dataToUpdate.industry = validatedData.industry;
        
        // Step 1: If industry is not "other", clear custom industry field
        if (validatedData.industry !== "other") {
          console.log("📝 Clearing custom industry (standard industry selected)");
          dataToUpdate.industryCustom = null;
        }
      }
      
      // Step 2: Handle custom industry field - process even if empty to allow clearing
      if (validatedData.industryCustom !== undefined) {
        console.log("📝 Setting custom industry:", validatedData.industryCustom);
        dataToUpdate.industryCustom = validatedData.industryCustom.trim() || null;
      }
      if (validatedData.companySize) {
        console.log("📝 Setting company size:", validatedData.companySize);
        dataToUpdate.companySize = validatedData.companySize;
      }
      if (validatedData.tone) {
        console.log("📝 Setting tone:", validatedData.tone);
        dataToUpdate.tone = validatedData.tone;
      }
      if (validatedData.onboardingCompleted !== undefined) {
        console.log("📝 Setting onboarding completed:", validatedData.onboardingCompleted);
        dataToUpdate.onboardingCompleted = validatedData.onboardingCompleted;
      }
      
      // Process arrays from strings - carefully handle different formats
      if (validatedData.keywords) {
        // Check if it's already an array (client might have processed it)
        if (Array.isArray(validatedData.keywords)) {
          console.log("📝 Using keywords array as provided:", validatedData.keywords);
          dataToUpdate.keywords = validatedData.keywords;
        } else {
          console.log("📝 Converting keywords string to array:", validatedData.keywords);
          // Handle empty string case
          dataToUpdate.keywords = validatedData.keywords.trim() 
            ? validatedData.keywords.split(',').map(k => k.trim()) 
            : [];
        }
      }
      
      if (validatedData.targetRegions) {
        // Check if it's already an array (client might have processed it)
        if (Array.isArray(validatedData.targetRegions)) {
          console.log("📝 Using targetRegions array as provided:", validatedData.targetRegions);
          dataToUpdate.targetRegions = validatedData.targetRegions;
        } else {
          console.log("📝 Converting targetRegions string to array:", validatedData.targetRegions);
          // Handle empty string case
          dataToUpdate.targetRegions = validatedData.targetRegions.trim() 
            ? validatedData.targetRegions.split(',').map(r => r.trim()) 
            : [];
        }
      }
      
      console.log("💾 Processed data to update:", dataToUpdate);
      
      // Update company profile
      console.log("🔄 Updating company profile in database:", companyProfile.id);
      const updatedProfile = await storage.updateCompanyProfile(companyProfile.id, dataToUpdate);
      
      console.log("✅ Company profile updated successfully:", updatedProfile);
      res.json(updatedProfile);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("❌ Zod validation error:", error.errors);
        return res.status(400).json({ 
          message: "Invalid data provided", 
          errors: error.errors 
        });
      }
      
      console.error("❌ Error updating company profile:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Update user profile
  app.patch("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    try {
      const userId = req.user!.id;
      console.log(`Updating user ${userId} with data:`, req.body);
      
      // Validate with Zod schema - only allow name and email updates
      const updateSchema = z.object({
        name: z.string().optional(),
        email: z.string().email().optional()
      });
      
      const validatedData = updateSchema.parse(req.body);
      console.log("Validated data:", validatedData);
      
      // Prepare data for storage
      const updateData: { name?: string; email?: string; username?: string } = {};
      if (validatedData.name) {
        updateData.name = validatedData.name;
      }
      
      // Process the email field separately
      if (validatedData.email) {
        updateData.email = validatedData.email;
        // Also update username to match email for backwards compatibility
        updateData.username = validatedData.email;
      }
      
      console.log("Data to be sent to storage:", updateData);
      
      // Update user profile
      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return user without password
      const { password, ...userWithoutPassword } = updatedUser;
      console.log("Sending updated user response:", userWithoutPassword);
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Invalid data provided", 
          errors: error.errors 
        });
      }
      
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const founderProfileSchema = z.object({
    name: z.string().min(2),
    title: z.string().optional().default(""),
    companyName: z.string().optional().default(""),
    bio: z.string().optional().default(""),
    voiceSummary: z.string().optional().default(""),
    voiceRules: z.string().optional().default(""),
    signatureMoves: z.array(z.string()).optional().default([]),
    antiPatterns: z.array(z.string()).optional().default([]),
    preferredTopics: z.array(z.string()).optional().default([]),
    sensitiveTopics: z.array(z.string()).optional().default([]),
    bannedWords: z.array(z.string()).optional().default([]),
    approvedPhrases: z.array(z.string()).optional().default([]),
    targetPeople: z.array(z.string()).optional().default([]),
    contentGoals: z.array(z.string()).optional().default([]),
  });

  const founderSourceSchema = z.object({
    title: z.string().min(2),
    sourceType: z.string().min(2),
    sourceUrl: z.string().url().optional().or(z.literal("")).or(z.null()),
    rawText: z.string().min(40),
    isApprovedForReuse: z.boolean().optional().default(true),
  });

  const founderGenerateSchema = z.object({
    sourceIds: z.array(z.number()).optional().default([]),
    rawInputTitle: z.string().optional().default(""),
    rawInputText: z.string().optional().default(""),
    objective: z.string().optional().default(""),
    audience: z.string().optional().default(""),
    draftShape: z.string().optional().default(""),
    sensitivityNotes: z.string().optional().default(""),
  }).refine((data) => {
    return data.sourceIds.length > 0 || (data.rawInputText && data.rawInputText.trim().length >= 40);
  }, {
    message: "Provide at least one saved source or 40+ characters of raw source material.",
    path: ["rawInputText"],
  });

  async function getOwnedFounder(founderId: number, userId: number) {
    const founder = await founderStorage.getFounder(founderId);
    if (!founder || founder.userId !== userId) {
      return undefined;
    }
    return founder;
  }

  app.get("/api/founders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const founders = await founderStorage.getFoundersByUserId(req.user!.id);
      res.json(founders);
    } catch (error) {
      console.error("Error fetching founders:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/founders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const parsed = founderProfileSchema.parse(req.body);
      const companyProfile = await storage.getCompanyProfileByUserId(req.user!.id);
      const founder = await founderStorage.createFounder({
        userId: req.user!.id,
        companyProfileId: companyProfile?.id ?? null,
        ...parsed,
      });
      res.status(201).json(founder);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid founder data", errors: error.errors });
      }
      console.error("Error creating founder:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/founders/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const founderId = parseInt(req.params.id);
      const founder = await getOwnedFounder(founderId, req.user!.id);
      if (!founder) {
        return res.status(404).json({ message: "Founder not found" });
      }

      const parsed = founderProfileSchema.partial().parse(req.body);
      const updated = await founderStorage.updateFounder(founderId, parsed);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid founder data", errors: error.errors });
      }
      console.error("Error updating founder:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/founders/:id/sources", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const founderId = parseInt(req.params.id);
      const founder = await getOwnedFounder(founderId, req.user!.id);
      if (!founder) {
        return res.status(404).json({ message: "Founder not found" });
      }

      const sources = await founderStorage.getSourcesByFounderId(founderId);
      res.json(sources);
    } catch (error) {
      console.error("Error fetching founder sources:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/founders/:id/sources", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const founderId = parseInt(req.params.id);
      const founder = await getOwnedFounder(founderId, req.user!.id);
      if (!founder) {
        return res.status(404).json({ message: "Founder not found" });
      }

      const parsed = founderSourceSchema.parse(req.body);
      const source = await founderStorage.createSource({
        founderId,
        title: parsed.title,
        sourceType: parsed.sourceType,
        sourceUrl: parsed.sourceUrl || null,
        rawText: parsed.rawText,
        isApprovedForReuse: parsed.isApprovedForReuse,
      });
      res.status(201).json(source);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid source data", errors: error.errors });
      }
      console.error("Error creating founder source:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/founders/:founderId/sources/:sourceId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const founderId = parseInt(req.params.founderId);
      const sourceId = parseInt(req.params.sourceId);
      const founder = await getOwnedFounder(founderId, req.user!.id);
      if (!founder) {
        return res.status(404).json({ message: "Founder not found" });
      }

      const source = await founderStorage.getSource(sourceId);
      if (!source || source.founderId !== founderId) {
        return res.status(404).json({ message: "Source not found" });
      }

      await founderStorage.deleteSource(sourceId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting founder source:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/founders/:id/drafts", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const founderId = parseInt(req.params.id);
      const founder = await getOwnedFounder(founderId, req.user!.id);
      if (!founder) {
        return res.status(404).json({ message: "Founder not found" });
      }

      const drafts = await founderStorage.getDraftsByFounderId(founderId);
      res.json(drafts);
    } catch (error) {
      console.error("Error fetching founder drafts:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/founders/:id/generate-post", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const founderId = parseInt(req.params.id);
      const founder = await getOwnedFounder(founderId, req.user!.id);
      if (!founder) {
        return res.status(404).json({ message: "Founder not found" });
      }

      const parsed = founderGenerateSchema.parse(req.body);
      const sources = [];

      for (const sourceId of parsed.sourceIds) {
        const source = await founderStorage.getSource(sourceId);
        if (source && source.founderId === founderId) {
          sources.push(source);
        }
      }

      const generated = await generateFounderPost({
        founder,
        sources,
        rawInputTitle: parsed.rawInputTitle,
        rawInputText: parsed.rawInputText,
        objective: parsed.objective,
        audience: parsed.audience,
        draftShape: parsed.draftShape,
        sensitivityNotes: parsed.sensitivityNotes,
      });

      const draft = await founderStorage.createDraft({
        founderId,
        title: generated.title,
        objective: generated.objective,
        audience: generated.audience,
        draftShape: generated.draftShape,
        sourceIds: parsed.sourceIds,
        selectedAngle: generated.selectedAngle,
        usedProofPoints: generated.usedProofPoints,
        riskFlags: generated.riskFlags,
        draftPrimary: generated.draftPrimary,
        draftHooks: generated.draftHooks,
        draftAltAngle: generated.draftAltAngle,
        draftFirstComment: generated.draftFirstComment,
        claimCheck: generated.claimCheck,
      });

      res.status(201).json(draft);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid generation request", errors: error.errors });
      }
      console.error("Error generating founder post:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Internal server error" });
    }
  });

  app.patch("/api/founder-drafts/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const draftId = parseInt(req.params.id);
      const draft = await founderStorage.getDraft(draftId);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      const founder = await getOwnedFounder(draft.founderId, req.user!.id);
      if (!founder) {
        return res.status(403).json({ message: "Permission denied" });
      }

      const parsed = z.object({
        approvedVersion: z.string().optional(),
        editorNotes: z.string().optional(),
        status: z.enum(["draft", "approved"]).optional(),
      }).parse(req.body);

      const updated = await founderStorage.updateDraft(draftId, {
        approvedVersion: parsed.approvedVersion ?? draft.approvedVersion,
        editorNotes: parsed.editorNotes ?? draft.editorNotes,
        status: parsed.status ?? draft.status,
      });

      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid draft update", errors: error.errors });
      }
      console.error("Error updating founder draft:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reprocess an existing article
  app.post("/api/articles/:id/reprocess", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const articleId = parseInt(req.params.id);
      const userId = req.user!.id;

      if (isNaN(articleId)) {
        return res.status(400).json({ message: "Invalid article ID" });
      }

      // Check if user owns this article
      const userOwnsData = await storage.checkUserOwnsData(userId, articleId);
      if (!userOwnsData) {
        return res.status(403).json({ message: "Permission denied" });
      }

      // Get the article to verify it exists
      const article = await storage.getArticle(articleId);
      if (!article) {
        return res.status(404).json({ message: "Article not found" });
      }

      // Create a new history record with pending status
      await storage.createHistoryRecord({
        articleId: articleId,
        status: "pending"
      });

      // Start reprocessing the article in the background
      setTimeout(() => {
        processArticle(articleId).catch(err => {
          console.error(`Background reprocessing error for article ${articleId}:`, err);
        });
      }, 100);

      res.json({ message: "Article reprocessing started", articleId });
    } catch (error) {
      console.error("Error reprocessing article:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reprocess article from history record ID (what the frontend actually calls)
  app.post("/api/article-history/:id/reprocess", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const historyId = parseInt(req.params.id);
      const userId = req.user!.id;

      if (isNaN(historyId)) {
        return res.status(400).json({ message: "Invalid history ID" });
      }

      // Get the history record to find the article ID
      const historyRecord = await storage.getHistoryRecord(historyId);
      if (!historyRecord) {
        return res.status(404).json({ message: "History record not found" });
      }

      // Check if user owns this article
      const userOwnsData = await storage.checkUserOwnsData(userId, historyRecord.articleId);
      if (!userOwnsData) {
        return res.status(403).json({ message: "Permission denied" });
      }

      // Get the article to verify it exists
      const article = await storage.getArticle(historyRecord.articleId);
      if (!article) {
        return res.status(404).json({ message: "Article not found" });
      }

      // Create a new history record with pending status
      const newHistoryRecord = await storage.createHistoryRecord({
        articleId: historyRecord.articleId,
        status: "pending"
      });

      // Start reprocessing the article in the background
      setTimeout(() => {
        processArticle(historyRecord.articleId).catch(err => {
          console.error(`Background reprocessing error for article ${historyRecord.articleId}:`, err);
        });
      }, 100);

      res.json({ 
        message: "Article reprocessing started", 
        articleId: historyRecord.articleId,
        historyId: newHistoryRecord.id 
      });
    } catch (error) {
      console.error("Error reprocessing article from history:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create a new article
  app.post("/api/articles", validateCompanyContext, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const companyProfile = req.companyProfile; // Provided by middleware

      // Handle document-only submissions by extracting content from documents
      const hasDocuments = req.body.selectedDocumentIds && req.body.selectedDocumentIds.length > 0;
      const hasBodyText = req.body.bodyText && req.body.bodyText.trim().length > 0;
      
      let bodyText = req.body.bodyText || "";
      
      // If no body text but documents are selected, extract content from documents
      if (!hasBodyText && hasDocuments) {
        try {
          // Get selected documents and extract meaningful content
          const selectedDocuments = [];
          for (const docId of req.body.selectedDocumentIds) {
            const doc = await storage.getCompanyDocument(docId);
            if (doc && doc.companyProfileId === companyProfile.id) {
              selectedDocuments.push(doc);
            }
          }
          
          if (selectedDocuments.length > 0) {
            // Extract first 400-500 characters of meaningful content from documents
            const extractedContent = selectedDocuments
              .map(doc => {
                const content = doc.extractedContent || '';
                // Remove extra whitespace and get meaningful excerpt
                const cleanContent = content.replace(/\s+/g, ' ').trim();
                return cleanContent.length > 100 ? cleanContent.substring(0, 500) : cleanContent;
              })
              .filter(content => content.length > 50) // Only include substantial content
              .join(' ');
            
            if (extractedContent.length > 50) {
              bodyText = extractedContent;
              console.log(`📄 Extracted ${extractedContent.length} characters from ${selectedDocuments.length} documents for processing`);
            } else {
              // Fallback to title-based placeholder if extraction fails
              bodyText = `Document-based content: ${req.body.title}`;
              console.warn('⚠️ Document content extraction yielded insufficient content, using title-based fallback');
            }
          }
        } catch (error) {
          console.error('❌ Error extracting document content:', error);
          // Fallback to placeholder if extraction fails
          bodyText = `Document-based content: ${req.body.title}`;
        }
      }

      // Enhanced content validation - ensure we have substantial content for quality generation
      const finalWordCount = bodyText.trim().split(/\s+/).filter((word: string) => word.length > 0).length;
      
      // Require either 100+ words OR valid documents
      if (finalWordCount < 100 && !hasDocuments) {
        return res.status(400).json({ 
          message: "Insufficient content for quality generation", 
          details: `Content has ${finalWordCount} words but requires minimum 100 words or selected documents for substantial PR content generation.`
        });
      }
      
      // Additional validation for very short inputs even with documents
      if (finalWordCount < 10 && hasDocuments) {
        console.log(`⚠️ Warning: Very minimal text (${finalWordCount} words) provided with documents - AI may produce generic content`);
      }

      // Validate the article data with Zod
      try {
        insertArticleSchema.parse({
          ...req.body,
          bodyText,
          companyProfileId: companyProfile.id
        });
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({ 
            message: "Validation error", 
            errors: error.errors 
          });
        }
        throw error;
      }

      // Create the article
      const article = await storage.createArticle({
        companyProfileId: companyProfile.id,
        title: req.body.title,
        bodyText,
        sourceType: req.body.sourceType || "CLIENT",  // Default to CLIENT for user uploads
        fetchType: "user"
      });

      // Create a history record for this article with pending status
      await storage.createHistoryRecord({
        articleId: article.id,
        status: "pending"
      });

      // Start processing the article in the background
      // Pass selected document IDs if provided
      // We don't await this call as we want it to happen asynchronously
      setTimeout(() => {
        processArticle(article.id, req.body.selectedDocumentIds).catch(err => {
          console.error(`Background processing error for article ${article.id}:`, err);
        });
      }, 100);

      res.status(201).json(article);
    } catch (error) {
      console.error("Error creating article:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get articles for the current user
  app.get("/api/articles", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const userId = req.user!.id;
      const companyProfile = await storage.getCompanyProfileByUserId(userId);
      
      if (!companyProfile) {
        return res.status(404).json({ message: "Company profile not found" });
      }
      
      // Extract query parameters for filtering
      const { fetchType, sourceType, limit } = req.query;
      
      let articles = await storage.getArticlesByCompanyId(companyProfile.id);
      
      // Apply filters if provided
      if (fetchType) {
        articles = articles.filter(article => article.fetchType === fetchType);
      }
      if (sourceType) {
        articles = articles.filter(article => article.sourceType === sourceType);
      }
      
      // Apply limit if provided
      if (limit) {
        const limitNum = parseInt(limit as string);
        if (!isNaN(limitNum)) {
          articles = articles.slice(0, limitNum);
        }
      }
      
      res.json(articles);
    } catch (error) {
      console.error("Error fetching articles:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get a specific article
  app.get("/api/articles/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const articleId = parseInt(req.params.id);
      console.log(`Fetching article with ID: ${articleId}`);
      
      if (isNaN(articleId)) {
        console.error(`Invalid article ID: ${req.params.id}`);
        return res.status(400).json({ message: "Invalid article ID" });
      }
      
      const article = await storage.getArticle(articleId);
      
      if (!article) {
        console.log(`Article not found with ID: ${articleId}`);
        return res.status(404).json({ message: "Article not found" });
      }
      
      // Check if user owns this article
      const userId = req.user!.id;
      const userOwnsData = await storage.checkUserOwnsData(userId, articleId);
      
      if (!userOwnsData) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      console.log(`Successfully fetched article: ${article.id} - ${article.title}`);
      res.json(article);
    } catch (error) {
      console.error("Error fetching article:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get processing status for an article
  app.get("/api/articles/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const articleId = parseInt(req.params.id);
      console.log(`Fetching status for article ID: ${articleId}`);
      
      const article = await storage.getArticle(articleId);
      
      if (!article) {
        console.log(`Article not found with ID: ${articleId}`);
        return res.status(404).json({ message: "Article not found" });
      }
      
      // Check if user owns this article
      const userId = req.user!.id;
      const userOwnsData = await storage.checkUserOwnsData(userId, articleId);
      
      if (!userOwnsData) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      // Get the latest history record for this article
      const historyRecords = await storage.getHistoryRecordsByArticleId(articleId);
      console.log(`History records found for article ${articleId}:`, historyRecords.length);
      
      const latestRecord = historyRecords[0];
      
      if (!latestRecord) {
        console.log(`No history records found for article ${articleId}`);
        return res.status(404).json({ message: "No processing records found" });
      }
      
      console.log(`Latest record for article ${articleId}:`, {
        id: latestRecord.id,
        status: latestRecord.status,
        hasError: !!latestRecord.errorMessage
      });
      
      res.json(latestRecord);
    } catch (error) {
      console.error("Error fetching article status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete an article
  app.delete("/api/articles/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const articleId = parseInt(req.params.id);
      
      if (isNaN(articleId)) {
        return res.status(400).json({ message: "Invalid article ID" });
      }
      
      const article = await storage.getArticle(articleId);
      
      if (!article) {
        return res.status(404).json({ message: "Article not found" });
      }
      
      // Check if user owns this article
      const userId = req.user!.id;
      const userOwnsData = await storage.checkUserOwnsData(userId, articleId);
      
      if (!userOwnsData) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      const success = await storage.deleteArticle(articleId);
      
      if (success) {
        res.json({ success: true, message: "Article deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete article" });
      }
    } catch (error) {
      console.error("Error deleting article:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * Formats Publishing Pack content for CMS copy-paste use
   * - Removes header and footer sections
   * - Removes italic auto-generated notes
   * - Escapes newlines in JSON-LD
   * - Wraps JSON-LD in <script> tags
   */
  function formatPublishingPackForCMS(rawContent: string | null): string | null {
    if (!rawContent) return null;

    let formatted = rawContent;

    // Remove header section (from start to first ---)
    formatted = formatted.replace(/^#[^\n]*\n[\s\S]*?---\n\n/, '');

    // Remove footer section (from **End of Publishing Pack** to end)
    formatted = formatted.replace(/---\n\n\*\*End of Publishing Pack\*\*[\s\S]*$/, '');

    // Remove italic auto-generated notes
    formatted = formatted.replace(/\n\*Auto-generated by OpenAI API based on .*?\.\*\n/g, '\n');

    // Find and format JSON-LD block
    const jsonLdMatch = formatted.match(/(### JSON-LD Schema\n```json\n)([\s\S]*?)(\n```)/);
    
    if (jsonLdMatch) {
      let jsonContent = jsonLdMatch[2];
      
      // Manually escape newlines in JSON string values
      // This approach avoids parsing JSON which fails on literal newlines
      jsonContent = jsonContent.replace(/"description":\s*"([^"]*(?:\n[^"]*)*?)"/g, (match, description) => {
        // Replace literal newlines with \n escape sequence
        const escapedDescription = description.replace(/\n/g, '\\n');
        return `"description": "${escapedDescription}"`;
      });
      
      // Replace the JSON block with script-wrapped version
      formatted = formatted.replace(
        jsonLdMatch[0],
        `### JSON-LD Schema\n\n<script type="application/ld+json">\n${jsonContent}\n</script>`
      );
    }

    return formatted;
  }

  // Get PR content for an article
  app.get("/api/articles/:id/content", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const articleId = parseInt(req.params.id);
      console.log(`Fetching content for article ID: ${articleId}`);
      
      if (isNaN(articleId)) {
        console.error(`Invalid article ID for content: ${req.params.id}`);
        return res.status(400).json({ message: "Invalid article ID" });
      }
      
      const article = await storage.getArticle(articleId);
      
      if (!article) {
        console.log(`Article not found for content with ID: ${articleId}`);
        return res.status(404).json({ message: "Article not found" });
      }
      
      // Check if user owns this article
      const userId = req.user!.id;
      const userOwnsData = await storage.checkUserOwnsData(userId, articleId);
      
      if (!userOwnsData) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      // Get all PR content for this article
      const prContents = await storage.getPrContentsByArticleId(articleId);
      console.log(`Found ${prContents.length} PR content items for article ${articleId}`);
      
      if (!prContents || prContents.length === 0) {
        console.log(`No content found for article ${articleId}`);
        return res.status(404).json({ message: "No content generated yet" });
      }
      
      try {
        // Organize content by type with enhanced formatting
        const summaryContent = prContents.find(content => content.type === 'summary')?.content || null;
        const anglesContent = prContents.find(content => content.type === 'angle')?.content;
        const outlineContent = prContents.find(content => content.type === 'outline')?.content;
        const articleContent = prContents.find(content => content.type === 'article')?.content;
        const emailContent = prContents.find(content => content.type === 'email')?.content;
        const publishingPackContent = prContents.find(content => content.type === 'publishing_pack')?.content || null;

        const organizedContent = {
          summary: summaryContent,
          angles: anglesContent ? JSON.parse(anglesContent) : null,
          outline: outlineContent ? JSON.parse(outlineContent) : null,
          article: articleContent ? JSON.parse(articleContent) : null,
          email: emailContent ? JSON.parse(emailContent) : null,
          publishingPack: formatPublishingPackForCMS(publishingPackContent),
        };
        
        console.log("Content organization complete, sending response");
        res.json(organizedContent);
      } catch (parseError) {
        console.error("Error parsing PR content:", parseError);
        return res.status(500).json({ message: "Error parsing content data" });
      }
    } catch (error) {
      console.error("Error fetching article content:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get media suggestions for an article
  app.get("/api/articles/:id/media-suggestions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const articleId = parseInt(req.params.id);
      
      if (isNaN(articleId)) {
        return res.status(400).json({ message: "Invalid article ID" });
      }

      console.log(`Generating media suggestions for article ID: ${articleId}`);
      
      const article = await storage.getArticle(articleId);
      
      if (!article) {
        return res.status(404).json({ message: "Article not found" });
      }
      
      // Check if user owns this article
      const userId = req.user!.id;
      const userOwnsData = await storage.checkUserOwnsData(userId, articleId);
      
      if (!userOwnsData) {
        return res.status(403).json({ message: "Permission denied" });
      }

      // Get company profile for keywords and target regions
      const companyProfile = await storage.getCompanyProfile(article.companyProfileId);
      
      if (!companyProfile) {
        return res.status(404).json({ message: "Company profile not found" });
      }

      // Generate media suggestions using OpenAI with web search
      const suggestions = await generateMediaSuggestions({
        articleTitle: article.title,
        articleBody: article.bodyText,
        companyKeywords: companyProfile.keywords || [],
        targetRegions: companyProfile.targetRegions || [],
        companyProfile: companyProfile
      });

      console.log(`Generated ${suggestions.journalists.length} journalist suggestions and ${suggestions.publications.length} publication suggestions`);
      res.json(suggestions);
    } catch (error: any) {
      console.error("Error generating media suggestions:", error);
      
      // Handle specific error types gracefully
      if (error.message?.includes('web_search') || error.message?.includes('search failed')) {
        return res.status(503).json({ 
          message: "Web search temporarily unavailable",
          type: "web_search_failed"
        });
      }
      
      res.status(500).json({ message: "Failed to generate media suggestions" });
    }
  });

  // Update PR content for an article
  app.put("/api/articles/:id/pr-content/:type", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const articleId = parseInt(req.params.id);
      const contentType = req.params.type;
      const userId = req.user!.id;
      
      if (isNaN(articleId)) {
        return res.status(400).json({ message: "Invalid article ID" });
      }

      // Validate content type - now includes 'article'
      const validTypes = ['summary', 'angle', 'outline', 'email', 'article'];
      if (!validTypes.includes(contentType)) {
        return res.status(400).json({ message: "Invalid content type" });
      }

      const article = await storage.getArticle(articleId);
      
      if (!article) {
        return res.status(404).json({ message: "Article not found" });
      }

      // Check if user owns this article
      const userOwnsData = await storage.checkUserOwnsData(userId, articleId);
      if (!userOwnsData) {
        return res.status(403).json({ message: "Permission denied" });
      }

      // Update the PR content
      const success = await storage.updatePrContent(articleId, contentType, JSON.stringify(req.body.content));
      
      if (success) {
        res.json({ message: "Content updated successfully" });
      } else {
        res.status(500).json({ message: "Failed to update content" });
      }
    } catch (error) {
      console.error("Error updating PR content:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Generate email separately using gpt-4.1-nano to avoid truncation issues
  app.post("/api/articles/:id/generate-email", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const articleId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      if (isNaN(articleId)) {
        return res.status(400).json({ message: "Invalid article ID" });
      }

      // Get article
      const article = await storage.getArticle(articleId);
      if (!article) {
        return res.status(404).json({ message: "Article not found" });
      }

      // Check ownership
      const userOwnsData = await storage.checkUserOwnsData(userId, articleId);
      if (!userOwnsData) {
        return res.status(403).json({ message: "Permission denied" });
      }

      // Get company profile for context
      const companyProfile = await storage.getCompanyProfile(article.companyProfileId);
      
      // Import the separate email generation function
      const { generateEmailSeparately } = await import("./openai.js");
      
      // Generate email using gpt-4.1-nano
      const emailResult = await generateEmailSeparately({
        articleTitle: article.title,
        articleBody: article.bodyText,
        companyName: companyProfile?.name ?? undefined,
        industry: companyProfile?.industry ?? undefined,
        brandTone: companyProfile?.tone ? [companyProfile.tone] : undefined,
        keyPhrases: companyProfile?.keywords ?? undefined,
        targetRegions: companyProfile?.targetRegions ?? undefined,
        articleId: articleId
      });

      // Save the email to database
      await storage.updatePrContent(articleId, 'email', JSON.stringify(emailResult));

      res.json({
        success: true,
        email: emailResult,
        message: "Email generated successfully using gpt-4.1-nano"
      });

    } catch (error) {
      console.error("Error generating email separately:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to generate email",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Reprocess an article (reset status and trigger processing)
  app.post("/api/article-history/:id/reprocess", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const historyId = parseInt(req.params.id);
      const historyRecord = await storage.getHistoryRecord(historyId);
      
      if (!historyRecord) {
        return res.status(404).json({ message: "History record not found" });
      }
      
      const article = await storage.getArticle(historyRecord.articleId);
      
      if (!article) {
        return res.status(404).json({ message: "Article not found" });
      }
      
      // Check if user owns this article
      const userId = req.user!.id;
      const userOwnsData = await storage.checkUserOwnsData(userId, article.id);
      
      if (!userOwnsData) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      // Update the history record to "pending" status
      await storage.updateHistoryRecord(historyId, {
        status: "pending", 
        errorMessage: null
      });
      
      // Create a new history record for tracking
      const newHistoryRecord = await storage.createHistoryRecord({
        articleId: article.id,
        status: "pending"
      });
      
      // Trigger the processing in the background
      setTimeout(() => {
        processArticle(article.id).catch(error => {
          console.error(`Error processing article ${article.id}:`, error);
        });
      }, 0);
      
      res.status(200).json({ message: "Article reprocessing started", historyId: newHistoryRecord.id });
    } catch (error) {
      console.error("Error reprocessing article:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Download results for an article in formatted text
  app.get("/api/articles/:id/download", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const articleId = parseInt(req.params.id);
      
      if (isNaN(articleId)) {
        return res.status(400).json({ message: "Invalid article ID" });
      }
      
      const article = await storage.getArticle(articleId);
      
      if (!article) {
        return res.status(404).json({ message: "Article not found" });
      }
      
      // Check if user owns this article
      const userId = req.user!.id;
      const userOwnsData = await storage.checkUserOwnsData(userId, articleId);
      
      if (!userOwnsData) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      // Fetch PR content
      const prContents = await storage.getPrContentsByArticleId(articleId);
      
      if (!prContents || prContents.length === 0) {
        return res.status(404).json({ message: "No content found for this article" });
      }
      
      // Organize content
      try {
        const summaryContent = prContents.find(content => content.type === 'summary')?.content || "";
        
        const anglesContent = prContents.find(content => content.type === 'angle')?.content 
          ? JSON.parse(prContents.find(content => content.type === 'angle')!.content) 
          : [];
          
        const outlineContent = prContents.find(content => content.type === 'outline')?.content 
          ? JSON.parse(prContents.find(content => content.type === 'outline')!.content) 
          : [];
          
        const emailContent = prContents.find(content => content.type === 'email')?.content 
          ? JSON.parse(prContents.find(content => content.type === 'email')!.content) 
          : { subject: "", body: "" };
          
        const articleContent = prContents.find(content => content.type === 'article')?.content 
          ? JSON.parse(prContents.find(content => content.type === 'article')!.content) 
          : null;
        
        // Format content as text
        let formattedContent = `# PR CONTENT FOR: ${article.title}\n\n`;
        formattedContent += `Date: ${new Date().toLocaleDateString()}\n\n`;
        
        formattedContent += `## SUMMARY\n\n${summaryContent}\n\n`;
        
        formattedContent += `## COMMENTARY ANGLES\n\n`;
        if (anglesContent && anglesContent.length) {
          anglesContent.forEach((angle: any, index: number) => {
            formattedContent += `### Angle ${index + 1}: ${angle.headline}\n\n${angle.paragraph || angle.commentary}\n\n`;
          });
        }
        
        formattedContent += `## THOUGHT LEADERSHIP OUTLINE\n\n`;
        if (outlineContent && outlineContent.length) {
          outlineContent.forEach((point: string, index: number) => {
            formattedContent += `${index + 1}. ${point}\n`;
          });
          formattedContent += `\n\n`;
        }
        
        // Add thought leadership article if available
        if (articleContent) {
          formattedContent += `## THOUGHT LEADERSHIP ARTICLE\n\n`;
          formattedContent += `Title: ${articleContent.title}\n\n${articleContent.content}\n\n`;
        }
        
        formattedContent += `## EMAIL PITCH\n\n`;
        formattedContent += `Subject: ${emailContent.subject}\n\n${emailContent.body}\n\n`;
        
        formattedContent += `## ORIGINAL ARTICLE\n\n${article.title}\n\n${article.bodyText}\n`;
        
        // Set headers for file download
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(article.title.substring(0, 30))}-PR-Content.txt`);
        
        res.send(formattedContent);
      } catch (parseError) {
        console.error("Error parsing PR content:", parseError);
        return res.status(500).json({ message: "Error parsing content data" });
      }
    } catch (error) {
      console.error("Error downloading article content:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get article history records with article data
  app.get("/api/article-history", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const userId = req.user!.id;
      const companyProfile = await storage.getCompanyProfileByUserId(userId);
      
      if (!companyProfile) {
        return res.status(404).json({ message: "Company profile not found" });
      }

      // Get all articles for this company
      const articles = await storage.getArticlesByCompanyId(companyProfile.id);
      
      if (!articles || articles.length === 0) {
        return res.json([]);
      }

      // Fetch history records for each article
      const articlesWithHistory = await Promise.all(articles.map(async (article) => {
        const historyRecords = await storage.getHistoryRecordsByArticleId(article.id);
        const latestRecord = historyRecords.length > 0 ? historyRecords[0] : null;
        
        return {
          article,
          status: latestRecord?.status || "unknown",
          errorMessage: latestRecord?.errorMessage,
          historyId: latestRecord?.id,
          updatedAt: latestRecord?.processedAt || article.createdAt
        };
      }));
      
      // Sort by date, newest first
      articlesWithHistory.sort((a, b) => {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return dateB - dateA;
      });
      
      res.json(articlesWithHistory);
    } catch (error) {
      console.error("Error fetching article history:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Document management routes
  
  // Upload a document with error handling middleware
  app.post("/api/companies/:id/documents", (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error("Multer upload error:", err);
        
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: "File too large (max 25 MB). Please upload a smaller file." });
        }
        
        if (err.message && err.message.includes('Unsupported file type')) {
          return res.status(400).json({ message: "Unsupported file type. Only PDF, DOCX, TXT, XLSX, and XLS are allowed." });
        }
        
        return res.status(400).json({ message: err.message || "File upload error" });
      }
      next();
    });
  }, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const companyId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // Check if user owns this company profile
      const companyProfile = await storage.getCompanyProfile(companyId);
      if (!companyProfile || companyProfile.userId !== userId) {
        return res.status(403).json({ message: "Permission denied" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Validate file size (double-check since multer should catch this)
      if (req.file.size === 0) {
        return res.status(400).json({ message: "Empty file not allowed. Please choose a valid document." });
      }

      // Validate file
      const validation = documentProcessor.validateFile(req.file.originalname, req.file.size);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error });
      }

      // Process the file
      const processed = await documentProcessor.processFile(req.file.buffer, req.file.originalname);
      
      // Create document record
      const document = await storage.createCompanyDocument({
        companyProfileId: companyId,
        title: req.body.title || req.file.originalname,
        documentType: req.body.documentType || "background",
        originalFilename: req.file.originalname,
        fileSize: req.file.size,
        extractedContent: processed.extractedContent,
        summary: processed.summary,
        keywords: processed.keywords,
      });

      res.status(201).json(document);
    } catch (error) {
      console.error("Document upload error:", error);
      
      // Handle specific multer errors
      if ((error as any).code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: "Your file is too large (max 25 MB)" });
      }
      
      if ((error as any).message && (error as any).message.includes('Unsupported file type')) {
        return res.status(400).json({ message: (error as any).message });
      }
      
      res.status(500).json({ message: "Failed to process document" });
    }
  });

  // Get documents for a company
  app.get("/api/companies/:id/documents", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const companyId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // Check if user owns this company profile
      const companyProfile = await storage.getCompanyProfile(companyId);
      if (!companyProfile || companyProfile.userId !== userId) {
        return res.status(403).json({ message: "Permission denied" });
      }

      const documents = await storage.getCompanyDocumentsByCompanyId(companyId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete a document
  app.delete("/api/documents/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const documentId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // Get document to check permissions
      const document = await storage.getCompanyDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user owns this document's company profile
      const companyProfile = await storage.getCompanyProfile(document.companyProfileId);
      if (!companyProfile || companyProfile.userId !== userId) {
        return res.status(403).json({ message: "Permission denied" });
      }

      const success = await storage.deleteCompanyDocument(documentId);
      if (success) {
        res.json({ message: "Document deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete document" });
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update PR content (for editable sections)
  app.put("/api/articles/:id/pr-content/:type", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const articleId = parseInt(req.params.id);
      const contentType = req.params.type;
      const userId = req.user!.id;
      
      // Validate content type (only allow editable types)
      if (!['article', 'email'].includes(contentType)) {
        return res.status(400).json({ message: "Invalid content type. Only 'article' and 'email' are editable." });
      }

      // Get article to check permissions
      const article = await storage.getArticle(articleId);
      if (!article) {
        return res.status(404).json({ message: "Article not found" });
      }

      // Check if user owns this article
      const userOwnsData = await storage.checkUserOwnsData(userId, articleId);
      if (!userOwnsData) {
        return res.status(403).json({ message: "Permission denied" });
      }

      // Update the PR content
      const success = await storage.updatePrContent(articleId, contentType, JSON.stringify(req.body.content));
      
      if (success) {
        res.json({ message: "Content updated successfully" });
      } else {
        res.status(500).json({ message: "Failed to update content" });
      }
    } catch (error) {
      console.error("Error updating PR content:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin-only routes
  app.get("/api/admin/stats", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as any;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      // Get real counts from database
      const users = await (storage as any).getAllUsers();
      const articles = await (storage as any).getAllArticles();
      
      const stats = {
        totalUsers: users.length,
        totalArticles: articles.length,
        systemStatus: "operational",
        lastFetchTime: new Date().toISOString()
      };
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as any;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const users = await (storage as any).getAllUsers();
      // Remove sensitive data before sending
      const safeUsers = users.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Manual news fetch endpoint for admin
  app.post("/api/admin/fetch-news", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as any;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { companyProfileId } = req.body;
      
      if (!companyProfileId) {
        return res.status(400).json({ message: "Company profile ID is required" });
      }

      console.log(`Admin ${user.email} triggered manual news fetch for company ${companyProfileId}`);

      const result = await fetchNewsForCompany(companyProfileId, 'manual');

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          articleId: result.articleId
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }
    } catch (error) {
      console.error("Error in manual news fetch:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch news",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get prompt for editing (admin only)
  app.get("/api/admin/prompts/:name", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as any;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { name } = req.params;
      const prompt = await storage.getPrompt(name);
      
      if (!prompt) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      
      res.json(prompt);
    } catch (error) {
      console.error("Error fetching prompt:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update prompt (admin only)
  app.patch("/api/admin/prompts/:name", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as any;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { name } = req.params;
      const { content, variables } = req.body;
      
      if (!content || content.trim() === '') {
        return res.status(400).json({ message: "Prompt content cannot be empty" });
      }
      
      const updatedPrompt = await storage.updatePrompt(name, { content, variables });
      
      if (!updatedPrompt) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      
      console.log(`Admin ${user.email} updated prompt: ${name}`);
      res.json(updatedPrompt);
    } catch (error) {
      console.error("Error updating prompt:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Test news fetch without saving (admin only)
  app.post("/api/admin/test-fetch", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as any;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { companyProfileId, promptContent } = req.body;
      
      if (!companyProfileId) {
        return res.status(400).json({ message: "Company profile ID is required" });
      }

      console.log(`Admin ${user.email} triggered test news fetch for company ${companyProfileId}`);

      // Import the test fetch function (will implement this next)
      const { testNewsSearch } = await import("./news-fetcher");
      const result = await testNewsSearch(companyProfileId, promptContent);

      res.json({
        success: true,
        testResult: result,
        message: "Test completed successfully"
      });
    } catch (error) {
      console.error("Error in test news fetch:", error);
      res.status(500).json({ 
        success: false,
        message: "Test failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Save test result as real article (admin only)
  app.post("/api/admin/save-test-result", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as any;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { companyProfileId, articleData } = req.body;
      
      if (!companyProfileId || !articleData) {
        return res.status(400).json({ message: "Company profile ID and article data are required" });
      }

      console.log(`Admin ${user.email} saving test result as real article for company ${companyProfileId}`);

      // Use existing article processing pipeline
      const result = await fetchNewsForCompany(companyProfileId, 'manual', articleData);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          articleId: result.articleId
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }
    } catch (error) {
      console.error("Error saving test result:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to save test result",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get cron job status (admin only)
  app.get("/api/admin/cron-jobs", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as any;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const cronJobs = await storage.getAllCronJobs();
      res.json(cronJobs);
    } catch (error) {
      console.error("Error getting cron jobs:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update cron job status (admin only)
  app.patch("/api/admin/cron-jobs/:name", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as any;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { name } = req.params;
      const updateData = req.body;
      
      const updatedJob = await storage.updateCronJob(name, updateData);
      
      if (updatedJob) {
        console.log(`Admin ${user.email} updated cron job ${name}:`, updateData);
        res.json(updatedJob);
      } else {
        res.status(404).json({ message: "Cron job not found" });
      }
    } catch (error) {
      console.error("Error updating cron job:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reset user password (admin only) - MVP version with automatic temporary password generation
  app.post("/api/admin/users/:userId/reset-password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as any;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { userId } = req.params;
      
      // Prevent admin from resetting their own password
      if (parseInt(userId) === user.id) {
        return res.status(400).json({ 
          message: "Cannot reset your own password. Use profile settings instead." 
        });
      }
      
      // Get target user
      const targetUser = await storage.getUser(parseInt(userId));
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Generate secure 16-character temporary password
      const { randomBytes, scrypt } = await import('crypto');
      const { promisify } = await import('util');
      const scryptAsync = promisify(scrypt);
      
      const tempPassword = randomBytes(8).toString('hex'); // 16 character hex string
      
      // Hash the temporary password
      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync(tempPassword, salt, 64)) as Buffer;
      const hashedPassword = `${buf.toString("hex")}.${salt}`;
      
      // Update password and set mustChangePassword flag
      const updatedUser = await storage.updateUser(parseInt(userId), {
        password: hashedPassword,
        mustChangePassword: true
      });
      
      if (updatedUser) {
        console.log(`Admin ${user.email} reset password for user ${targetUser.email}`);
        res.json({ 
          success: true, 
          message: `Password reset for ${targetUser.email}`,
          temporaryPassword: tempPassword,
          userEmail: targetUser.email
        });
      } else {
        res.status(500).json({ message: "Failed to update password" });
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Change user role (admin only)
  app.patch("/api/admin/users/:userId/role", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as any;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { userId } = req.params;
      const { role } = req.body;
      
      // Validate role
      if (!["admin", "editor", "viewer"].includes(role)) {
        return res.status(400).json({ 
          message: "Invalid role. Must be admin, editor, or viewer" 
        });
      }
      
      // Prevent admin from changing their own role
      if (parseInt(userId) === user.id) {
        return res.status(400).json({ 
          message: "Cannot change your own role" 
        });
      }
      
      // Get target user
      const targetUser = await storage.getUser(parseInt(userId));
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update role
      const updatedUser = await storage.updateUser(parseInt(userId), { role });
      
      if (updatedUser) {
        console.log(`Admin ${user.email} changed role for user ${targetUser.email} to ${role}`);
        res.json({ 
          success: true, 
          message: `Role updated to ${role}`,
          role: role
        });
      } else {
        res.status(500).json({ message: "Failed to update role" });
      }
    } catch (error) {
      console.error("Error changing user role:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}
