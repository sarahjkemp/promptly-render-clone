import fs from "fs";
import path from "path";

const DATA_DIR = process.env.PROMPTLY_DATA_DIR || path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "founder-post-engine.json");

function now() {
  return new Date();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function reviveDate(value: any) {
  return value ? new Date(value) : value;
}

function sortByUpdatedDesc<T extends { updatedAt?: Date; createdAt?: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aDate = a.updatedAt || a.createdAt || new Date(0);
    const bDate = b.updatedAt || b.createdAt || new Date(0);
    return bDate.getTime() - aDate.getTime();
  });
}

export interface FounderProfile {
  id: number;
  userId: number;
  companyProfileId: number | null;
  name: string;
  title: string;
  companyName: string;
  bio: string;
  voiceSummary: string;
  voiceRules: string;
  signatureMoves: string[];
  antiPatterns: string[];
  preferredTopics: string[];
  sensitiveTopics: string[];
  bannedWords: string[];
  approvedPhrases: string[];
  targetPeople: string[];
  contentGoals: string[];
  generationDirectives: string;
  anglePriorityRules: string[];
  bannedOpenings: string[];
  hardRequirements: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FounderSource {
  id: number;
  founderId: number;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  rawText: string;
  isApprovedForReuse: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FounderDraft {
  id: number;
  founderId: number;
  title: string;
  objective: string;
  audience: string;
  draftShape: string;
  sourceIds: number[];
  selectedAngle: string;
  usedProofPoints: string[];
  riskFlags: string[];
  draftPrimary: string;
  draftHooks: string[];
  draftAltAngle: string | null;
  draftFirstComment: string | null;
  claimCheck: string[];
  status: "draft" | "approved";
  approvedVersion: string | null;
  editorNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertFounderProfile {
  userId: number;
  companyProfileId?: number | null;
  name: string;
  title?: string;
  companyName?: string;
  bio?: string;
  voiceSummary?: string;
  voiceRules?: string;
  signatureMoves?: string[];
  antiPatterns?: string[];
  preferredTopics?: string[];
  sensitiveTopics?: string[];
  bannedWords?: string[];
  approvedPhrases?: string[];
  targetPeople?: string[];
  contentGoals?: string[];
  generationDirectives?: string;
  anglePriorityRules?: string[];
  bannedOpenings?: string[];
  hardRequirements?: string[];
}

export interface InsertFounderSource {
  founderId: number;
  title: string;
  sourceType: string;
  sourceUrl?: string | null;
  rawText: string;
  isApprovedForReuse?: boolean;
}

export interface InsertFounderDraft {
  founderId: number;
  title: string;
  objective: string;
  audience: string;
  draftShape: string;
  sourceIds: number[];
  selectedAngle: string;
  usedProofPoints: string[];
  riskFlags: string[];
  draftPrimary: string;
  draftHooks: string[];
  draftAltAngle?: string | null;
  draftFirstComment?: string | null;
  claimCheck: string[];
  status?: "draft" | "approved";
  approvedVersion?: string | null;
  editorNotes?: string | null;
}

class FounderStorage {
  private ids = {
    founder: 1,
    source: 1,
    draft: 1,
  };

  private founders: FounderProfile[] = [];
  private sources: FounderSource[] = [];
  private drafts: FounderDraft[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!fs.existsSync(DATA_FILE)) return;
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw);
      this.ids = parsed.ids || this.ids;
      this.founders = (parsed.founders || []).map((item: any) => ({
        ...item,
        createdAt: reviveDate(item.createdAt),
        updatedAt: reviveDate(item.updatedAt),
      }));
      this.sources = (parsed.sources || []).map((item: any) => ({
        ...item,
        createdAt: reviveDate(item.createdAt),
        updatedAt: reviveDate(item.updatedAt),
      }));
      this.drafts = (parsed.drafts || []).map((item: any) => ({
        ...item,
        createdAt: reviveDate(item.createdAt),
        updatedAt: reviveDate(item.updatedAt),
      }));
    } catch (error) {
      console.error("Failed to load founder post engine data:", error);
    }
  }

  private save() {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify({
        ids: this.ids,
        founders: this.founders,
        sources: this.sources,
        drafts: this.drafts,
      }, null, 2));
    } catch (error) {
      console.error("Failed to save founder post engine data:", error);
    }
  }

  private nextId(key: keyof FounderStorage["ids"]) {
    const value = this.ids[key];
    this.ids[key] += 1;
    return value;
  }

  async getFoundersByUserId(userId: number) {
    return clone(sortByUpdatedDesc(this.founders.filter((founder) => founder.userId === userId)));
  }

  async getFounder(id: number) {
    return clone(this.founders.find((founder) => founder.id === id));
  }

  async createFounder(data: InsertFounderProfile) {
    const created: FounderProfile = {
      id: this.nextId("founder"),
      userId: data.userId,
      companyProfileId: data.companyProfileId ?? null,
      name: data.name,
      title: data.title ?? "",
      companyName: data.companyName ?? "",
      bio: data.bio ?? "",
      voiceSummary: data.voiceSummary ?? "",
      voiceRules: data.voiceRules ?? "",
      signatureMoves: data.signatureMoves ?? [],
      antiPatterns: data.antiPatterns ?? [],
      preferredTopics: data.preferredTopics ?? [],
      sensitiveTopics: data.sensitiveTopics ?? [],
      bannedWords: data.bannedWords ?? [],
      approvedPhrases: data.approvedPhrases ?? [],
      targetPeople: data.targetPeople ?? [],
      contentGoals: data.contentGoals ?? [],
      generationDirectives: data.generationDirectives ?? "",
      anglePriorityRules: data.anglePriorityRules ?? [],
      bannedOpenings: data.bannedOpenings ?? [],
      hardRequirements: data.hardRequirements ?? [],
      createdAt: now(),
      updatedAt: now(),
    };
    this.founders.push(created);
    this.save();
    return clone(created);
  }

  async updateFounder(id: number, data: Partial<InsertFounderProfile>) {
    const founder = this.founders.find((item) => item.id === id);
    if (!founder) return undefined;
    Object.assign(founder, data, { updatedAt: now() });
    this.save();
    return clone(founder);
  }

  async getSourcesByFounderId(founderId: number) {
    return clone(sortByUpdatedDesc(this.sources.filter((source) => source.founderId === founderId)));
  }

  async getSource(id: number) {
    return clone(this.sources.find((source) => source.id === id));
  }

  async createSource(data: InsertFounderSource) {
    const created: FounderSource = {
      id: this.nextId("source"),
      founderId: data.founderId,
      title: data.title,
      sourceType: data.sourceType,
      sourceUrl: data.sourceUrl ?? null,
      rawText: data.rawText,
      isApprovedForReuse: data.isApprovedForReuse ?? true,
      createdAt: now(),
      updatedAt: now(),
    };
    this.sources.push(created);
    this.save();
    return clone(created);
  }

  async deleteSource(id: number) {
    const before = this.sources.length;
    this.sources = this.sources.filter((source) => source.id !== id);
    this.save();
    return this.sources.length !== before;
  }

  async getDraftsByFounderId(founderId: number) {
    return clone(sortByUpdatedDesc(this.drafts.filter((draft) => draft.founderId === founderId)));
  }

  async getDraft(id: number) {
    return clone(this.drafts.find((draft) => draft.id === id));
  }

  async createDraft(data: InsertFounderDraft) {
    const created: FounderDraft = {
      id: this.nextId("draft"),
      founderId: data.founderId,
      title: data.title,
      objective: data.objective,
      audience: data.audience,
      draftShape: data.draftShape,
      sourceIds: data.sourceIds,
      selectedAngle: data.selectedAngle,
      usedProofPoints: data.usedProofPoints,
      riskFlags: data.riskFlags,
      draftPrimary: data.draftPrimary,
      draftHooks: data.draftHooks,
      draftAltAngle: data.draftAltAngle ?? null,
      draftFirstComment: data.draftFirstComment ?? null,
      claimCheck: data.claimCheck,
      status: data.status ?? "draft",
      approvedVersion: data.approvedVersion ?? null,
      editorNotes: data.editorNotes ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.drafts.push(created);
    this.save();
    return clone(created);
  }

  async updateDraft(id: number, data: Partial<FounderDraft>) {
    const draft = this.drafts.find((item) => item.id === id);
    if (!draft) return undefined;
    Object.assign(draft, data, { updatedAt: now() });
    this.save();
    return clone(draft);
  }
}

export const founderStorage = new FounderStorage();
