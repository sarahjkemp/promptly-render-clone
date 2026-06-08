import { createChatCompletion } from "./openaiQueue";
import type { FounderProfile, FounderSource } from "./founderStorage";

const MODEL = "gpt-4.1";

export interface FounderPostRequest {
  founder: FounderProfile;
  sources: FounderSource[];
  rawInputTitle?: string;
  rawInputText?: string;
  objective?: string;
  audience?: string;
  draftShape?: string;
  sensitivityNotes?: string;
}

export interface FounderPostResult {
  title: string;
  objective: string;
  audience: string;
  draftShape: string;
  selectedAngle: string;
  usedProofPoints: string[];
  riskFlags: string[];
  draftPrimary: string;
  draftHooks: string[];
  draftAltAngle: string | null;
  draftFirstComment: string | null;
  claimCheck: string[];
}

function safeJsonParse(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Founder Post Engine returned non-JSON output.");
  }
  return JSON.parse(match[0]);
}

function buildFounderContext(founder: FounderProfile) {
  return [
    `Founder: ${founder.name}`,
    `Title: ${founder.title || "N/A"}`,
    `Company: ${founder.companyName || "N/A"}`,
    founder.bio ? `Bio: ${founder.bio}` : "",
    founder.voiceSummary ? `Voice summary: ${founder.voiceSummary}` : "",
    founder.voiceRules ? `Voice rules: ${founder.voiceRules}` : "",
    founder.signatureMoves.length ? `Signature moves: ${founder.signatureMoves.join(" | ")}` : "",
    founder.antiPatterns.length ? `Anti-patterns: ${founder.antiPatterns.join(" | ")}` : "",
    founder.preferredTopics.length ? `Preferred topics: ${founder.preferredTopics.join(" | ")}` : "",
    founder.sensitiveTopics.length ? `Sensitive topics: ${founder.sensitiveTopics.join(" | ")}` : "",
    founder.bannedWords.length ? `Banned words: ${founder.bannedWords.join(", ")}` : "",
    founder.approvedPhrases.length ? `Approved phrases: ${founder.approvedPhrases.join(" | ")}` : "",
    founder.targetPeople.length ? `Target people / communities: ${founder.targetPeople.join(" | ")}` : "",
    founder.contentGoals.length ? `Content goals: ${founder.contentGoals.join(" | ")}` : "",
  ].filter(Boolean).join("\n");
}

function buildSourceContext(sources: FounderSource[], rawInputTitle?: string, rawInputText?: string) {
  const sourceBlocks = sources.map((source, index) => {
    return `SOURCE ${index + 1}
Title: ${source.title}
Type: ${source.sourceType}
URL: ${source.sourceUrl || "N/A"}
Content:
${source.rawText}`;
  });

  if (rawInputText && rawInputText.trim()) {
    sourceBlocks.push(`RAW INPUT
Title: ${rawInputTitle || "Untitled input"}
Content:
${rawInputText}`);
  }

  return sourceBlocks.join("\n\n");
}

export async function generateFounderPost(request: FounderPostRequest): Promise<FounderPostResult> {
  const founderContext = buildFounderContext(request.founder);
  const sourceContext = buildSourceContext(request.sources, request.rawInputTitle, request.rawInputText);

  const systemPrompt = `You are Founder Post Engine, an expert ghostwriter for high-stakes founder LinkedIn content.

Your job:
- turn messy source material into a world-class LinkedIn post
- preserve the founder's specific voice
- avoid generic AI-founder language
- identify proof points
- surface risks and claim checks

Rules:
- write for LinkedIn, with strong scannability
- keep the opening hook under 60 characters
- paragraphs should be short
- avoid fake warmth, cliché inspiration, and generic "future of AI" language
- do not use banned words or anti-patterns from the founder profile
- use concrete mechanism and proof, not vague opinion
- if a claim feels risky, list it in riskFlags and claimCheck
- if the source material is weak, still produce the strongest defensible angle

Return strict JSON only with this shape:
{
  "title": "short internal title",
  "objective": "authority|media attention|customer education|relationship-building|speaker positioning",
  "audience": "primary audience",
  "draftShape": "contrarian mechanism|field note|myth vs reality|response to current article|event reflection|media-targeting opinion post",
  "selectedAngle": "one-sentence angle",
  "usedProofPoints": ["proof point 1"],
  "riskFlags": ["risk 1"],
  "draftPrimary": "full LinkedIn post",
  "draftHooks": ["hook 1", "hook 2", "hook 3"],
  "draftAltAngle": "optional alternate angle or null",
  "draftFirstComment": "optional first-comment link line or null",
  "claimCheck": ["claim to verify 1"]
}`;

  const userPrompt = `FOUNDER PROFILE
${founderContext}

REQUEST
- Objective preference: ${request.objective || "infer the strongest objective"}
- Audience preference: ${request.audience || "infer the strongest audience"}
- Draft shape preference: ${request.draftShape || "infer the strongest shape"}
- Sensitivity notes: ${request.sensitivityNotes || "none provided"}

SOURCE MATERIAL
${sourceContext}`;

  const response = await createChatCompletion({
    model: MODEL,
    temperature: 0.7,
    max_tokens: 3500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const text = response.choices?.[0]?.message?.content || "";
  const parsed = safeJsonParse(text);

  return {
    title: parsed.title || "Founder Post Draft",
    objective: parsed.objective || request.objective || "authority",
    audience: parsed.audience || request.audience || "AI founders",
    draftShape: parsed.draftShape || request.draftShape || "contrarian mechanism",
    selectedAngle: parsed.selectedAngle || "",
    usedProofPoints: Array.isArray(parsed.usedProofPoints) ? parsed.usedProofPoints : [],
    riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags : [],
    draftPrimary: parsed.draftPrimary || "",
    draftHooks: Array.isArray(parsed.draftHooks) ? parsed.draftHooks.slice(0, 3) : [],
    draftAltAngle: parsed.draftAltAngle || null,
    draftFirstComment: parsed.draftFirstComment || null,
    claimCheck: Array.isArray(parsed.claimCheck) ? parsed.claimCheck : [],
  };
}
