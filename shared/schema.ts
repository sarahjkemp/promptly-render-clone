import { pgTable, text, serial, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// User entity with role-based permissions
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "editor", "viewer"] }).default("editor").notNull(),
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Company profiles for brand guidelines and settings
export const companyProfiles = pgTable("company_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  industry: text("industry"),
  industryCustom: text("industry_custom"), // Custom industry when "Other" is selected
  companySize: text("company_size"),
  keywords: text("keywords").array(), // Array of brand keywords
  tone: text("tone"), // Brand tone/voice
  targetRegions: text("target_regions").array(), // Array of target regions
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Brand guides uploaded by users
export const brandGuides = pgTable("brand_guides", {
  id: serial("id").primaryKey(),
  companyProfileId: integer("company_profile_id").notNull().references(() => companyProfiles.id),
  fileUrl: text("file_url").notNull(),
  extractedText: text("extracted_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Articles imported by users
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  companyProfileId: integer("company_profile_id").notNull().references(() => companyProfiles.id),
  title: text("title").notNull(),
  bodyText: text("body_text").notNull(),
  fetchType: text("fetch_type", { enum: ["manual", "auto", "user"] }).default("user").notNull(),
  sourceType: text("source_type", { enum: ["CLIENT", "NEWS"] }).default("NEWS").notNull(),
  fetchedAt: timestamp("fetched_at"),
  sourceUrl: text("source_url"),
  isViewed: boolean("is_viewed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// PR content generated from articles
export const prContents = pgTable("pr_contents", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => articles.id),
  type: text("type", { enum: ["summary", "angle", "outline", "article", "email", "publishing_pack"] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// History records of article processing
export const historyRecords = pgTable("history_records", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => articles.id),
  status: text("status", { enum: ["pending", "processing", "done", "error"] }).notNull(),
  errorMessage: text("error_message"),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

// Export jobs for articles
export const exportJobs = pgTable("export_jobs", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => articles.id),
  format: text("format", { enum: ["csv", "pdf"] }).notNull(),
  status: text("status", { enum: ["pending", "done", "error"] }).notNull(),
  downloadUrl: text("download_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Notification jobs for keyword monitoring
export const notificationJobs = pgTable("notification_jobs", {
  id: serial("id").primaryKey(),
  companyProfileId: integer("company_profile_id").notNull().references(() => companyProfiles.id),
  keywords: text("keywords").array().notNull(),
  frequency: text("frequency", { enum: ["daily", "weekly", "monthly"] }).default("weekly").notNull(),
  nextRun: timestamp("next_run").notNull(),
  status: text("status", { enum: ["active", "paused"] }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Company documents for enhanced content generation
export const companyDocuments = pgTable("company_documents", {
  id: serial("id").primaryKey(),
  companyProfileId: integer("company_profile_id").notNull().references(() => companyProfiles.id),
  title: text("title").notNull(),
  documentType: text("document_type", { enum: ["brand_guide", "messaging", "research", "background", "data"] }).notNull(),
  originalFilename: text("original_filename").notNull(),
  fileSize: integer("file_size").notNull(),
  extractedContent: text("extracted_content"),
  summary: text("summary"), // AI-generated summary for quick reference
  keywords: text("keywords").array(), // extracted keywords for relevance matching
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// Prompts for configurable AI-powered workflows
export const prompts = pgTable("prompts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // e.g., "news_fetch_prompt"
  content: text("content").notNull(), // The actual prompt template
  variables: text("variables"), // JSON string of variable definitions and defaults
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Cron job management for scheduled tasks
export const cronJobs = pgTable("cron_jobs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // e.g., "weekly_news_fetch"
  enabled: boolean("enabled").default(true).notNull(),
  lastRun: timestamp("last_run"),
  lastStatus: text("last_status", { enum: ["success", "error", "running"] }),
  lastError: text("last_error"),
  nextRun: timestamp("next_run"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Saved media recommendations for users
export const savedRecommendations = pgTable("saved_recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  articleId: integer("article_id").notNull().references(() => articles.id),
  recommendationType: text("recommendation_type", { enum: ["journalist", "publication"] }).notNull(),
  recommendationData: text("recommendation_data").notNull(), // JSON string
  isFavourited: boolean("is_favourited").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define relations for better type safety
export const usersRelations = relations(users, ({ one, many }) => ({
  companyProfile: one(companyProfiles, {
    fields: [users.id],
    references: [companyProfiles.userId],
  }),
  savedRecommendations: many(savedRecommendations),
}));

export const companyProfilesRelations = relations(companyProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [companyProfiles.userId],
    references: [users.id],
  }),
  brandGuides: many(brandGuides),
  articles: many(articles),
  notificationJobs: many(notificationJobs),
  companyDocuments: many(companyDocuments),
}));

export const savedRecommendationsRelations = relations(savedRecommendations, ({ one }) => ({
  user: one(users, {
    fields: [savedRecommendations.userId],
    references: [users.id],
  }),
  article: one(articles, {
    fields: [savedRecommendations.articleId],
    references: [articles.id],
  }),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  companyProfile: one(companyProfiles, {
    fields: [articles.companyProfileId],
    references: [companyProfiles.id],
  }),
  prContents: many(prContents),
  historyRecords: many(historyRecords),
  exportJobs: many(exportJobs),
  savedRecommendations: many(savedRecommendations),
}));

export const brandGuidesRelations = relations(brandGuides, ({ one }) => ({
  companyProfile: one(companyProfiles, {
    fields: [brandGuides.companyProfileId],
    references: [companyProfiles.id],
  }),
}));

export const prContentsRelations = relations(prContents, ({ one }) => ({
  article: one(articles, {
    fields: [prContents.articleId],
    references: [articles.id],
  }),
}));

export const historyRecordsRelations = relations(historyRecords, ({ one }) => ({
  article: one(articles, {
    fields: [historyRecords.articleId],
    references: [articles.id],
  }),
}));

export const exportJobsRelations = relations(exportJobs, ({ one }) => ({
  article: one(articles, {
    fields: [exportJobs.articleId],
    references: [articles.id],
  }),
}));

export const notificationJobsRelations = relations(notificationJobs, ({ one }) => ({
  companyProfile: one(companyProfiles, {
    fields: [notificationJobs.companyProfileId],
    references: [companyProfiles.id],
  }),
}));

export const companyDocumentsRelations = relations(companyDocuments, ({ one }) => ({
  companyProfile: one(companyProfiles, {
    fields: [companyDocuments.companyProfileId],
    references: [companyProfiles.id],
  }),
}));

// Create insertion schemas
export const insertUserSchema = createInsertSchema(users, {
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
});

export const insertCompanyProfileSchema = createInsertSchema(companyProfiles, {
  keywords: z.array(z.string()).optional(),
  targetRegions: z.array(z.string()).optional(),
  industryCustom: z.string().optional(),
});

export const insertBrandGuideSchema = createInsertSchema(brandGuides);
export const insertArticleSchema = createInsertSchema(articles).extend({
  sourceType: z.enum(["CLIENT", "NEWS"]).default("NEWS"),
});
export const insertPrContentSchema = createInsertSchema(prContents);
export const insertHistoryRecordSchema = createInsertSchema(historyRecords);
export const insertExportJobSchema = createInsertSchema(exportJobs);
export const insertNotificationJobSchema = createInsertSchema(notificationJobs);
export const insertCompanyDocumentSchema = createInsertSchema(companyDocuments, {
  keywords: z.array(z.string()).optional(),
});

export const insertPromptSchema = createInsertSchema(prompts);
export const insertCronJobSchema = createInsertSchema(cronJobs);
export const insertSavedRecommendationSchema = createInsertSchema(savedRecommendations);

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type CompanyProfile = typeof companyProfiles.$inferSelect;
export type BrandGuide = typeof brandGuides.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type PrContent = typeof prContents.$inferSelect;
export type HistoryRecord = typeof historyRecords.$inferSelect;
export type ExportJob = typeof exportJobs.$inferSelect;
export type NotificationJob = typeof notificationJobs.$inferSelect;
export type CompanyDocument = typeof companyDocuments.$inferSelect;
export type InsertCompanyDocument = z.infer<typeof insertCompanyDocumentSchema>;
export type Prompt = typeof prompts.$inferSelect;
export type InsertPrompt = z.infer<typeof insertPromptSchema>;
export type CronJob = typeof cronJobs.$inferSelect;
export type InsertCronJob = z.infer<typeof insertCronJobSchema>;
export type SavedRecommendation = typeof savedRecommendations.$inferSelect;
export type InsertSavedRecommendation = z.infer<typeof insertSavedRecommendationSchema>;
