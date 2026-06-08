import { createChatCompletion } from "./openaiQueue";
import type { FounderProfile, FounderSource } from "./founderStorage";

const MODEL = "gpt-4.1";
const MAX_DRAFT_PASSES = 2;

const SLOP_PATTERNS = [
  /everyone thinks/i,
  /most people think/i,
  /the real problem is/i,
  /it'?s not .+ it'?s .+/i,
  /in reality/i,
  /what people miss/i,
  /the future of ai/i,
  /everyone talks about/i,
  /most people talk about/i,
];

const SUMMARY_ENDING_PATTERNS = [
  /quality starts/i,
  /the real bottleneck/i,
  /the future of ai/i,
  /the system, not the/i,
];

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

export interface FounderSourceSeed {
  title: string;
  sourceType: string;
  rawText: string;
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

function findSlopIssues(text: string) {
  const issues: string[] = [];
  const trimmed = text.trim();
  const firstParagraph = trimmed.split(/\n\s*\n/)[0] || trimmed;
  const paragraphs = trimmed.split(/\n\s*\n/).filter(Boolean);
  const lastParagraph = paragraphs[paragraphs.length - 1] || trimmed;

  if (SLOP_PATTERNS.some((pattern) => pattern.test(firstParagraph))) {
    issues.push("The opening uses a generic AI-thinkpiece pattern or cliché contrarian setup.");
  }

  if (/^[^.\n!?]{0,80}\.\s+[A-Z][^.\n!?]{0,80}\.$/m.test(firstParagraph)) {
    issues.push("The opening reads like a neat two-sentence slogan pair instead of natural founder writing.");
  }

  if ((trimmed.match(/\bactually\b/gi) || []).length >= 2) {
    issues.push('The draft leans on explanatory filler like "actually".');
  }

  if ((trimmed.match(/\bjust\b/gi) || []).length >= 4) {
    issues.push('The draft uses too much softening filler such as "just".');
  }

  const hasDigit = /\d/.test(trimmed);
  const hasEvidenceLanguage = /\b(acceptance rate|delivery rate|revenue|tasks|samples|capacity|proof point|interview|quote|saw|seen|worked on|measured|accepted|paper|benchmark|peer review|contract|investors?|researchers?)\b/i.test(trimmed);
  if (!hasDigit && !hasEvidenceLanguage) {
    issues.push("The draft lacks obvious data, evidence, or a credible proof signal.");
  }

  if (!/[“"']/.test(trimmed) && !hasDigit) {
    issues.push("The draft does not appear to contain a quote, a number, or another hard proof anchor.");
  }

  if (SUMMARY_ENDING_PATTERNS.some((pattern) => pattern.test(lastParagraph))) {
    issues.push("The ending reads like a generic summary line instead of a specific founder conclusion.");
  }

  return issues;
}

function sanitizeHooks(hooks: string[]) {
  return hooks.map((hook) => hook.trim()).filter(Boolean).slice(0, 3);
}

async function requestFounderDraft(systemPrompt: string, userPrompt: string) {
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
  return safeJsonParse(text);
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

The bar:
- the draft must feel publishable, not merely sensible
- it should read like a real founder with firsthand knowledge, not a polished observer
- it must contain a hard proof anchor: a number, a quote, a concrete operational detail, or a specific observed mechanism
- it should make one sharp point, not attempt a complete essay

Rules:
- write for LinkedIn, with strong scannability
- keep the opening hook under 60 characters
- paragraphs should be short
- avoid fake warmth, cliché inspiration, and generic "future of AI" language
- do not use banned words or anti-patterns from the founder profile
- use concrete mechanism and proof, not vague opinion
- every post must contain at least one credible insight
- include data, numbers, proof points, or specific evidence wherever the source material allows
- if the source does not support a number, use a concrete operational detail, observed mechanism, direct quote, or lived-experience proof instead
- do not produce empty thought leadership or broad commentary without evidence
- if a claim feels risky, list it in riskFlags and claimCheck
- if the source material is weak, still produce the strongest defensible angle
- do not open with generic AI-slop framing such as "everyone thinks", "most people think", "everyone talks about", "the real problem is", "what people miss", or "it's not X, it's Y"
- do not write in neat, polished contrast pairs that sound like a LinkedIn think piece
- do not sound like a commentator summarising a trend from the outside
- do not smooth the language so much that it stops sounding like a real person
- prefer one sharp observation, one mechanism, and one proof point over a tidy abstract argument
- use occasional asymmetry, friction, and spoken texture when it helps the writing feel human
- if a line could have been written by any AI founder, rewrite it to be more founder-specific
- do not end with a generic moral or high-level summary sentence
- when possible, start from a fact, quote, anecdote, or concrete observation rather than an abstract thesis
- use the strongest source detail early

Preferred post shape:
1. Open with a concrete fact, quote, or observed problem
2. Explain the mechanism plainly
3. Show why it matters operationally
4. End with a sharp, specific line or question

Bad opening example:
- "Most training data pipelines still run on factory logic"

Better opening example:
- "I've been on projects where most of the created work got discarded before it ever became usable."

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

  let parsed = await requestFounderDraft(systemPrompt, userPrompt);
  let issues = findSlopIssues(String(parsed.draftPrimary || ""));

  if (issues.length > 0) {
    const repairPrompt = `${userPrompt}

CRITICAL REVISION TASK
Your previous draft sounded too AI-written.

Problems to fix:
- ${issues.join("\n- ")}

Rewrite the post so it feels more like a real founder speaking from lived experience.
Keep the underlying idea, but remove the cliché framing and over-balanced sentence rhythm.
Make sure the revised version contains at least one credible proof point, data point, direct quote, operational detail, or other clear evidence signal.
Move the strongest source detail earlier.
If the ending sounds like a generic summary, replace it with something more specific and more founder-like.
Return the same strict JSON shape.`;

    parsed = await requestFounderDraft(systemPrompt, repairPrompt);
    issues = findSlopIssues(String(parsed.draftPrimary || ""));
  }

  return {
    title: parsed.title || "Founder Post Draft",
    objective: parsed.objective || request.objective || "authority",
    audience: parsed.audience || request.audience || "AI founders",
    draftShape: parsed.draftShape || request.draftShape || "contrarian mechanism",
    selectedAngle: parsed.selectedAngle || "",
    usedProofPoints: Array.isArray(parsed.usedProofPoints) ? parsed.usedProofPoints : [],
    riskFlags: Array.isArray(parsed.riskFlags) ? [...parsed.riskFlags, ...(issues.length > 0 ? ["Draft may still read too polished or generic; manual review recommended."] : [])] : issues.length > 0 ? ["Draft may still read too polished or generic; manual review recommended."] : [],
    draftPrimary: parsed.draftPrimary || "",
    draftHooks: Array.isArray(parsed.draftHooks) ? sanitizeHooks(parsed.draftHooks) : [],
    draftAltAngle: parsed.draftAltAngle || null,
    draftFirstComment: parsed.draftFirstComment || null,
    claimCheck: Array.isArray(parsed.claimCheck) ? parsed.claimCheck : [],
  };
}

export async function splitFounderSourceIntoSeeds(input: {
  founder: FounderProfile;
  title: string;
  sourceType: string;
  sourceUrl?: string | null;
  rawText: string;
}): Promise<FounderSourceSeed[]> {
  const systemPrompt = `You are helping a founder-content operator split one long source into several reusable post seeds.

Your job:
- read a long source document
- identify 3 to 7 distinct LinkedIn-worthy post angles
- rewrite each angle as a clean source note for drafting
- make each source note specific and usable

Rules:
- each seed should represent one distinct post idea
- do not output generic summaries
- each seed should be 3 to 6 sentences
- preserve the founder's perspective where possible
- remove noise, repetition, handles, and PR filler
- keep wording plain and usable for an AI drafting system

Return strict JSON only in this shape:
{
  "seeds": [
    {
      "title": "short source-bank title",
      "sourceType": "post-seed",
      "rawText": "cleaned source note"
    }
  ]
}`;

  const founderContext = buildFounderContext(input.founder);
  const userPrompt = `FOUNDER PROFILE
${founderContext}

SOURCE TITLE
${input.title}

SOURCE TYPE
${input.sourceType}

SOURCE TEXT
${input.rawText}`;

  const response = await createChatCompletion({
    model: MODEL,
    temperature: 0.5,
    max_tokens: 3000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const text = response.choices?.[0]?.message?.content || "";
  const parsed = safeJsonParse(text);
  const seeds = Array.isArray(parsed.seeds) ? parsed.seeds : [];

  return seeds
    .filter((seed: any) => seed?.title && seed?.rawText)
    .slice(0, 7)
    .map((seed: any) => ({
      title: String(seed.title).trim(),
      sourceType: "post-seed",
      rawText: String(seed.rawText).trim(),
    }));
}
