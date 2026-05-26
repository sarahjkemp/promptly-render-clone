import {
  type User,
  type InsertUser,
  type CompanyProfile,
  type BrandGuide,
  type Article,
  type PrContent,
  type HistoryRecord,
  type ExportJob,
  type NotificationJob,
  type CompanyDocument,
  type InsertCompanyDocument,
  type Prompt,
  type InsertPrompt,
  type CronJob,
  type InsertCronJob,
  type SavedRecommendation,
  type InsertSavedRecommendation,
} from "@shared/schema";
import fs from "fs";
import path from "path";

type InsertCompanyProfile = {
  userId: number;
  name: string;
  industry?: string | null;
  industryCustom?: string | null;
  companySize?: string | null;
  keywords?: string[] | null;
  tone?: string | null;
  targetRegions?: string[] | null;
  onboardingCompleted?: boolean;
};

type InsertBrandGuide = {
  companyProfileId: number;
  fileUrl: string;
  extractedText?: string | null;
};

type InsertArticle = {
  companyProfileId: number;
  title: string;
  bodyText: string;
  sourceType?: "CLIENT" | "NEWS";
  fetchType?: "manual" | "auto" | "user";
  fetchedAt?: Date | null;
  sourceUrl?: string | null;
  isViewed?: boolean;
};

type InsertPrContent = {
  articleId: number;
  type: "summary" | "angle" | "outline" | "email" | "article" | "publishing_pack";
  content: string;
};

type InsertHistoryRecord = {
  articleId: number;
  status: "pending" | "processing" | "done" | "error";
  errorMessage?: string | null;
};

type InsertExportJob = {
  articleId: number;
  format: "csv" | "pdf";
  status: "pending" | "done" | "error";
  downloadUrl?: string | null;
};

type InsertNotificationJob = {
  companyProfileId: number;
  keywords: string[];
  frequency: "daily" | "weekly" | "monthly";
  nextRun: Date;
  status?: "active" | "paused";
};

function now() {
  return new Date();
}

const DATA_DIR = process.env.PROMPTLY_DATA_DIR || path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "storage.json");

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sortByDateDesc<T extends { createdAt?: Date; processedAt?: Date; uploadedAt?: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aDate = a.createdAt || a.processedAt || a.uploadedAt || new Date(0);
    const bDate = b.createdAt || b.processedAt || b.uploadedAt || new Date(0);
    return bDate.getTime() - aDate.getTime();
  });
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  getCompanyProfile(id: number): Promise<CompanyProfile | undefined>;
  getCompanyProfileByUserId(userId: number): Promise<CompanyProfile | undefined>;
  createCompanyProfile(data: InsertCompanyProfile): Promise<CompanyProfile>;
  updateCompanyProfile(id: number, data: Partial<InsertCompanyProfile>): Promise<CompanyProfile | undefined>;
  getBrandGuide(id: number): Promise<BrandGuide | undefined>;
  getBrandGuidesByCompanyId(companyId: number): Promise<BrandGuide[]>;
  createBrandGuide(data: InsertBrandGuide): Promise<BrandGuide>;
  getArticle(id: number): Promise<Article | undefined>;
  getArticlesByCompanyId(companyId: number): Promise<Article[]>;
  getAllArticles(): Promise<Article[]>;
  createArticle(data: InsertArticle): Promise<Article>;
  deleteArticle(id: number): Promise<boolean>;
  getPrContent(id: number): Promise<PrContent | undefined>;
  getPrContentsByArticleId(articleId: number): Promise<PrContent[]>;
  getPrContentByArticleIdAndType(articleId: number, type: string): Promise<PrContent | undefined>;
  createPrContent(data: InsertPrContent): Promise<PrContent>;
  updatePrContent(articleId: number, type: string, content: string): Promise<boolean>;
  getHistoryRecord(id: number): Promise<HistoryRecord | undefined>;
  getHistoryRecordsByArticleId(articleId: number): Promise<HistoryRecord[]>;
  createHistoryRecord(data: InsertHistoryRecord): Promise<HistoryRecord>;
  updateHistoryRecord(id: number, data: Partial<InsertHistoryRecord>): Promise<HistoryRecord | undefined>;
  getExportJob(id: number): Promise<ExportJob | undefined>;
  getExportJobsByArticleId(articleId: number): Promise<ExportJob[]>;
  createExportJob(data: InsertExportJob): Promise<ExportJob>;
  updateExportJob(id: number, data: Partial<InsertExportJob>): Promise<ExportJob | undefined>;
  getNotificationJob(id: number): Promise<NotificationJob | undefined>;
  getNotificationJobsByCompanyId(companyId: number): Promise<NotificationJob[]>;
  createNotificationJob(data: InsertNotificationJob): Promise<NotificationJob>;
  updateNotificationJob(id: number, data: Partial<InsertNotificationJob>): Promise<NotificationJob | undefined>;
  getCompanyDocument(id: number): Promise<CompanyDocument | undefined>;
  getCompanyDocumentsByCompanyId(companyId: number): Promise<CompanyDocument[]>;
  createCompanyDocument(data: InsertCompanyDocument): Promise<CompanyDocument>;
  updateCompanyDocument(id: number, data: Partial<InsertCompanyDocument>): Promise<CompanyDocument | undefined>;
  deleteCompanyDocument(id: number): Promise<boolean>;
  getPrompt(name: string): Promise<Prompt | undefined>;
  createPrompt(data: InsertPrompt): Promise<Prompt>;
  updatePrompt(name: string, data: Partial<InsertPrompt>): Promise<Prompt | undefined>;
  getCronJob(name: string): Promise<CronJob | undefined>;
  getAllCronJobs(): Promise<CronJob[]>;
  createCronJob(data: InsertCronJob): Promise<CronJob>;
  updateCronJob(name: string, data: Partial<InsertCronJob>): Promise<CronJob | undefined>;
  getSavedRecommendations(userId: number, articleId: number): Promise<SavedRecommendation[]>;
  saveRecommendation(data: InsertSavedRecommendation): Promise<SavedRecommendation>;
  removeSavedRecommendation(id: number): Promise<boolean>;
  getUserFavouriteRecommendations(userId: number): Promise<SavedRecommendation[]>;
  checkUserOwnsData(userId: number, articleId: number): Promise<boolean>;
  sessionStore: any;
}

class MemoryStorage implements IStorage {
  sessionStore: any = null;

  private ids = {
    user: 2,
    companyProfile: 2,
    brandGuide: 1,
    article: 1,
    prContent: 1,
    historyRecord: 1,
    exportJob: 1,
    notificationJob: 1,
    companyDocument: 1,
    prompt: 2,
    cronJob: 2,
    recommendation: 1,
  };

  private users: User[] = [{
    id: 1,
    name: "Sarah Kemp",
    email: "sarah@example.com",
    username: "sarah@example.com",
    password: "not-used",
    role: "admin",
    mustChangePassword: false,
    createdAt: now(),
  }];

  private companyProfiles: CompanyProfile[] = [{
    id: 1,
    userId: 1,
    name: "SJK Labs",
    industry: "Public Relations",
    industryCustom: null,
    companySize: "1-10",
    keywords: ["AI visibility", "PR strategy", "thought leadership"],
    tone: "authoritative",
    targetRegions: ["UK", "US"],
    onboardingCompleted: true,
    createdAt: now(),
  }];

  private brandGuides: BrandGuide[] = [];
  private articles: Article[] = [];
  private prContents: PrContent[] = [];
  private historyRecords: HistoryRecord[] = [];
  private exportJobs: ExportJob[] = [];
  private notificationJobs: NotificationJob[] = [];
  private companyDocuments: CompanyDocument[] = [];
  private prompts: Prompt[] = [{
    id: 1,
    name: "news_fetch_prompt",
    content: `Find ONE recent news article relevant to these topics: {keywords}, focused on the following region(s): {targetRegions}.
- The article should be from a reputable source, published in the last 7 days.
- Prioritise substantial articles with real news value.

Return a JSON object with:
{
  "title": "Title of the article",
  "content": "Summary or excerpt of the article",
  "url": "Direct URL to the article",
  "publishedDate": "YYYY-MM-DD"
}`,
    variables: null,
    createdAt: now(),
    updatedAt: now(),
  }];
  private cronJobs: CronJob[] = [{
    id: 1,
    name: "weekly_news_fetch",
    enabled: true,
    lastRun: null,
    lastStatus: null,
    lastError: null,
    nextRun: now(),
    createdAt: now(),
  }];
  private savedRecommendations: SavedRecommendation[] = [];

  constructor() {
    this.load();
  }

  private reviveDate(value: any) {
    return value ? new Date(value) : value;
  }

  private load() {
    try {
      if (!fs.existsSync(DATA_FILE)) return;
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw);
      this.ids = parsed.ids || this.ids;
      this.users = (parsed.users || this.users).map((item: any) => ({ ...item, createdAt: this.reviveDate(item.createdAt) }));
      this.companyProfiles = (parsed.companyProfiles || this.companyProfiles).map((item: any) => ({ ...item, createdAt: this.reviveDate(item.createdAt) }));
      this.brandGuides = (parsed.brandGuides || []).map((item: any) => ({ ...item, createdAt: this.reviveDate(item.createdAt) }));
      this.articles = (parsed.articles || []).map((item: any) => ({
        ...item,
        createdAt: this.reviveDate(item.createdAt),
        fetchedAt: this.reviveDate(item.fetchedAt),
      }));
      this.prContents = (parsed.prContents || []).map((item: any) => ({ ...item, createdAt: this.reviveDate(item.createdAt) }));
      this.historyRecords = (parsed.historyRecords || []).map((item: any) => ({ ...item, processedAt: this.reviveDate(item.processedAt) }));
      this.exportJobs = (parsed.exportJobs || []).map((item: any) => ({ ...item, createdAt: this.reviveDate(item.createdAt) }));
      this.notificationJobs = (parsed.notificationJobs || []).map((item: any) => ({
        ...item,
        createdAt: this.reviveDate(item.createdAt),
        nextRun: this.reviveDate(item.nextRun),
      }));
      this.companyDocuments = (parsed.companyDocuments || []).map((item: any) => ({ ...item, uploadedAt: this.reviveDate(item.uploadedAt) }));
      this.prompts = (parsed.prompts || this.prompts).map((item: any) => ({
        ...item,
        createdAt: this.reviveDate(item.createdAt),
        updatedAt: this.reviveDate(item.updatedAt),
      }));
      this.cronJobs = (parsed.cronJobs || this.cronJobs).map((item: any) => ({
        ...item,
        createdAt: this.reviveDate(item.createdAt),
        lastRun: this.reviveDate(item.lastRun),
        nextRun: this.reviveDate(item.nextRun),
      }));
      this.savedRecommendations = (parsed.savedRecommendations || []).map((item: any) => ({ ...item, createdAt: this.reviveDate(item.createdAt) }));
    } catch (error) {
      console.error("Failed to load storage file:", error);
    }
  }

  private save() {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify({
        ids: this.ids,
        users: this.users,
        companyProfiles: this.companyProfiles,
        brandGuides: this.brandGuides,
        articles: this.articles,
        prContents: this.prContents,
        historyRecords: this.historyRecords,
        exportJobs: this.exportJobs,
        notificationJobs: this.notificationJobs,
        companyDocuments: this.companyDocuments,
        prompts: this.prompts,
        cronJobs: this.cronJobs,
        savedRecommendations: this.savedRecommendations,
      }, null, 2));
    } catch (error) {
      console.error("Failed to save storage file:", error);
    }
  }

  private nextId(key: keyof MemoryStorage["ids"]) {
    const value = this.ids[key];
    this.ids[key] += 1;
    return value;
  }

  async getUser(id: number) { return clone(this.users.find((x) => x.id === id)); }
  async getUserByUsername(username: string) { return clone(this.users.find((x) => x.username === username)); }
  async getAllUsers() { return clone(this.users); }
  async createUser(user: InsertUser) {
    const created: User = { id: this.nextId("user"), createdAt: now(), mustChangePassword: false, ...user };
    this.users.push(created);
    this.save();
    return clone(created);
  }
  async updateUser(id: number, data: Partial<InsertUser>) {
    const user = this.users.find((x) => x.id === id);
    if (!user) return undefined;
    Object.assign(user, data);
    this.save();
    return clone(user);
  }
  async getCompanyProfile(id: number) { return clone(this.companyProfiles.find((x) => x.id === id)); }
  async getCompanyProfileByUserId(userId: number) { return clone(this.companyProfiles.find((x) => x.userId === userId)); }
  async createCompanyProfile(data: InsertCompanyProfile) {
    const created: CompanyProfile = {
      id: this.nextId("companyProfile"),
      createdAt: now(),
      industry: null,
      industryCustom: null,
      companySize: null,
      keywords: [],
      tone: null,
      targetRegions: [],
      onboardingCompleted: false,
      ...data,
    };
    this.companyProfiles.push(created);
    this.save();
    return clone(created);
  }
  async updateCompanyProfile(id: number, data: Partial<InsertCompanyProfile>) {
    const profile = this.companyProfiles.find((x) => x.id === id);
    if (!profile) return undefined;
    Object.assign(profile, data);
    this.save();
    return clone(profile);
  }
  async getBrandGuide(id: number) { return clone(this.brandGuides.find((x) => x.id === id)); }
  async getBrandGuidesByCompanyId(companyId: number) { return clone(this.brandGuides.filter((x) => x.companyProfileId === companyId)); }
  async createBrandGuide(data: InsertBrandGuide) {
    const created: BrandGuide = { id: this.nextId("brandGuide"), createdAt: now(), extractedText: null, ...data };
    this.brandGuides.push(created);
    this.save();
    return clone(created);
  }
  async getArticle(id: number) { return clone(this.articles.find((x) => x.id === id)); }
  async getArticlesByCompanyId(companyId: number) { return clone(sortByDateDesc(this.articles.filter((x) => x.companyProfileId === companyId))); }
  async getAllArticles() { return clone(sortByDateDesc(this.articles)); }
  async createArticle(data: InsertArticle) {
    const created: Article = {
      id: this.nextId("article"),
      createdAt: now(),
      fetchedAt: data.fetchedAt ?? null,
      sourceUrl: data.sourceUrl ?? null,
      isViewed: data.isViewed ?? false,
      fetchType: data.fetchType ?? "user",
      sourceType: data.sourceType ?? "NEWS",
      ...data,
    };
    this.articles.push(created);
    this.save();
    return clone(created);
  }
  async deleteArticle(id: number) {
    this.articles = this.articles.filter((x) => x.id !== id);
    this.prContents = this.prContents.filter((x) => x.articleId !== id);
    this.historyRecords = this.historyRecords.filter((x) => x.articleId !== id);
    this.save();
    return true;
  }
  async getPrContent(id: number) { return clone(this.prContents.find((x) => x.id === id)); }
  async getPrContentsByArticleId(articleId: number) { return clone(sortByDateDesc(this.prContents.filter((x) => x.articleId === articleId))); }
  async getPrContentByArticleIdAndType(articleId: number, type: string) {
    const found = sortByDateDesc(this.prContents.filter((x) => x.articleId === articleId && x.type === type as any))[0];
    return clone(found);
  }
  async createPrContent(data: InsertPrContent) {
    const existing = this.prContents.find((x) => x.articleId === data.articleId && x.type === data.type);
    if (existing) {
      existing.content = data.content;
      existing.createdAt = now();
      this.save();
      return clone(existing);
    }
    const created: PrContent = { id: this.nextId("prContent"), createdAt: now(), ...data };
    this.prContents.push(created);
    this.save();
    return clone(created);
  }
  async updatePrContent(articleId: number, type: string, content: string) {
    const item = this.prContents.find((x) => x.articleId === articleId && x.type === type as any);
    if (!item) return false;
    item.content = content;
    this.save();
    return true;
  }
  async getHistoryRecord(id: number) { return clone(this.historyRecords.find((x) => x.id === id)); }
  async getHistoryRecordsByArticleId(articleId: number) { return clone(sortByDateDesc(this.historyRecords.filter((x) => x.articleId === articleId))); }
  async createHistoryRecord(data: InsertHistoryRecord) {
    const created: HistoryRecord = { id: this.nextId("historyRecord"), processedAt: now(), errorMessage: null, ...data };
    this.historyRecords.push(created);
    this.save();
    return clone(created);
  }
  async updateHistoryRecord(id: number, data: Partial<InsertHistoryRecord>) {
    const item = this.historyRecords.find((x) => x.id === id);
    if (!item) return undefined;
    Object.assign(item, data);
    this.save();
    return clone(item);
  }
  async getExportJob(id: number) { return clone(this.exportJobs.find((x) => x.id === id)); }
  async getExportJobsByArticleId(articleId: number) { return clone(this.exportJobs.filter((x) => x.articleId === articleId)); }
  async createExportJob(data: InsertExportJob) {
    const created: ExportJob = { id: this.nextId("exportJob"), createdAt: now(), downloadUrl: null, ...data };
    this.exportJobs.push(created);
    this.save();
    return clone(created);
  }
  async updateExportJob(id: number, data: Partial<InsertExportJob>) {
    const item = this.exportJobs.find((x) => x.id === id);
    if (!item) return undefined;
    Object.assign(item, data);
    this.save();
    return clone(item);
  }
  async getNotificationJob(id: number) { return clone(this.notificationJobs.find((x) => x.id === id)); }
  async getNotificationJobsByCompanyId(companyId: number) { return clone(this.notificationJobs.filter((x) => x.companyProfileId === companyId)); }
  async createNotificationJob(data: InsertNotificationJob) {
    const created: NotificationJob = { id: this.nextId("notificationJob"), createdAt: now(), status: data.status ?? "active", ...data };
    this.notificationJobs.push(created);
    this.save();
    return clone(created);
  }
  async updateNotificationJob(id: number, data: Partial<InsertNotificationJob>) {
    const item = this.notificationJobs.find((x) => x.id === id);
    if (!item) return undefined;
    Object.assign(item, data);
    this.save();
    return clone(item);
  }
  async getCompanyDocument(id: number) { return clone(this.companyDocuments.find((x) => x.id === id)); }
  async getCompanyDocumentsByCompanyId(companyId: number) {
    return clone(sortByDateDesc(this.companyDocuments.filter((x) => x.companyProfileId === companyId && x.isActive)));
  }
  async createCompanyDocument(data: InsertCompanyDocument) {
    const created: CompanyDocument = {
      id: this.nextId("companyDocument"),
      uploadedAt: now(),
      isActive: true,
      extractedContent: null,
      summary: null,
      keywords: [],
      ...data,
    };
    this.companyDocuments.push(created);
    this.save();
    return clone(created);
  }
  async updateCompanyDocument(id: number, data: Partial<InsertCompanyDocument>) {
    const item = this.companyDocuments.find((x) => x.id === id);
    if (!item) return undefined;
    Object.assign(item, data);
    this.save();
    return clone(item);
  }
  async deleteCompanyDocument(id: number) {
    const item = this.companyDocuments.find((x) => x.id === id);
    if (!item) return false;
    item.isActive = false;
    this.save();
    return true;
  }
  async getPrompt(name: string) { return clone(this.prompts.find((x) => x.name === name)); }
  async createPrompt(data: InsertPrompt) {
    const created: Prompt = { id: this.nextId("prompt"), createdAt: now(), updatedAt: now(), variables: null, ...data };
    this.prompts.push(created);
    this.save();
    return clone(created);
  }
  async updatePrompt(name: string, data: Partial<InsertPrompt>) {
    const item = this.prompts.find((x) => x.name === name);
    if (!item) return undefined;
    Object.assign(item, data, { updatedAt: now() });
    this.save();
    return clone(item);
  }
  async getCronJob(name: string) { return clone(this.cronJobs.find((x) => x.name === name)); }
  async getAllCronJobs() { return clone(this.cronJobs); }
  async createCronJob(data: InsertCronJob) {
    const created: CronJob = {
      id: this.nextId("cronJob"),
      createdAt: now(),
      enabled: true,
      lastRun: null,
      lastStatus: null,
      lastError: null,
      nextRun: null,
      ...data,
    };
    this.cronJobs.push(created);
    this.save();
    return clone(created);
  }
  async updateCronJob(name: string, data: Partial<InsertCronJob>) {
    const item = this.cronJobs.find((x) => x.name === name);
    if (!item) return undefined;
    Object.assign(item, data);
    this.save();
    return clone(item);
  }
  async getSavedRecommendations(userId: number, articleId: number) {
    return clone(this.savedRecommendations.filter((x) => x.userId === userId && x.articleId === articleId));
  }
  async saveRecommendation(data: InsertSavedRecommendation) {
    const created: SavedRecommendation = { id: this.nextId("recommendation"), createdAt: now(), isFavourited: true, ...data };
    this.savedRecommendations.push(created);
    this.save();
    return clone(created);
  }
  async removeSavedRecommendation(id: number) {
    this.savedRecommendations = this.savedRecommendations.filter((x) => x.id !== id);
    this.save();
    return true;
  }
  async getUserFavouriteRecommendations(userId: number) {
    return clone(this.savedRecommendations.filter((x) => x.userId === userId && x.isFavourited));
  }
  async checkUserOwnsData(userId: number, articleId: number) {
    const article = this.articles.find((x) => x.id === articleId);
    if (!article) return false;
    const profile = this.companyProfiles.find((x) => x.id === article.companyProfileId);
    return profile?.userId === userId;
  }
}

export const storage = new MemoryStorage();
