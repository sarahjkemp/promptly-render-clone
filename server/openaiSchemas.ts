// JSON Schema definitions for OpenAI structured outputs

export const summarySchema = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "A comprehensive 2-3 paragraph summary highlighting key points relevant to company positioning"
    }
  },
  required: ["summary"],
  additionalProperties: false
} as const;

export const anglesSchema = {
  type: "object",
  properties: {
    angles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          headline: {
            type: "string",
            description: "Compelling headline for this commentary angle"
          },
          commentary: {
            type: "string",
            description: "2-3 paragraphs of detailed, substantive commentary"
          }
        },
        required: ["headline", "commentary"],
        additionalProperties: false
      },
      minItems: 2,
      maxItems: 3
    }
  },
  required: ["angles"],
  additionalProperties: false
} as const;

export const outlineSchema = {
  type: "object",
  properties: {
    idea: {
      type: "string",
      description: "Compelling headline/title for the thought leadership piece"
    },
    outline: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 5,
      description: "Detailed talking points that build a cohesive narrative"
    }
  },
  required: ["idea", "outline"],
  additionalProperties: false
} as const;

export const emailSchema = {
  type: "object",
  properties: {
    subject: {
      type: "string",
      description: "Compelling, news-focused subject line (max 70 characters)"
    },
    body: {
      type: "string",
      description: "Professional email body with [Name] placeholder for personalization (approximately 200-250 words)"
    },
    hook_type: {
      type: "string",
      enum: ["breaking_news", "trend_analysis", "contrarian_view", "data_insight", "expert_perspective"],
      description: "Type of hook used to engage the journalist"
    }
  },
  required: ["subject", "body"],
  additionalProperties: false
} as const;

export const linkedinSchema = {
  type: "object",
  properties: {
    hook: {
      type: "string",
      description: "Compelling question or statement with emoji (max 80 characters)"
    },
    content: {
      type: "string",
      description: "Main content as bullet points or poll options with emojis"
    },
    cta: {
      type: "string",
      description: "Direct engagement request or call-to-action"
    }
  },
  required: ["hook", "content", "cta"],
  additionalProperties: false
} as const;

export const articleSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Compelling title for the thought leadership article"
    },
    content: {
      type: "string",
      description: "Complete article content, minimum 600-800 words, ready for publication with detailed analysis and insights"
    }
  },
  required: ["title", "content"],
  additionalProperties: false
} as const;

// Enhanced article schema with structured output validation (ArticleDraftV2)
export const articleDraftV2Schema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Article title, compelling and attention-grabbing"
    },
    content: {
      type: "string",
      description: "Complete article content, exactly 600-800 words, ready for publication"
    },
    hook_stat: {
      type: "string",
      description: "Opening statistical hook or compelling data point to grab attention"
    },
    stat_date: {
      type: "string",
      description: "Date/timeframe for the statistical hook (must be within 90 days)"
    },
    pitch_email: {
      type: "string",
      description: "Email pitch to journalists, minimum 120 characters"
    },
    byline_draft: {
      type: "string", 
      description: "Professional byline draft, minimum 400 characters"
    },
    word_count: {
      type: "number",
      description: "Exact word count of the article content (must be 600-800)",
      minimum: 600,
      maximum: 800
    }
  },
  required: ["title", "content", "hook_stat", "stat_date", "pitch_email", "byline_draft", "word_count"],
  additionalProperties: false
} as const;

// Combined schema for all PR content generation
export const prContentSchema = {
  type: "object",
  properties: {
    summary: {
      type: "object",
      properties: summarySchema.properties,
      required: summarySchema.required,
      additionalProperties: false
    },
    angles: {
      type: "object", 
      properties: anglesSchema.properties,
      required: anglesSchema.required,
      additionalProperties: false
    },
    outline: {
      type: "object",
      properties: outlineSchema.properties,
      required: outlineSchema.required,
      additionalProperties: false
    },
    article: {
      type: "object",
      properties: articleSchema.properties,
      required: articleSchema.required,
      additionalProperties: false
    },
    email: {
      type: "object",
      properties: emailSchema.properties,
      required: emailSchema.required,
      additionalProperties: false
    }
  },
  required: ["summary", "angles", "outline", "article", "email"],
  additionalProperties: false
} as const;

// Type definitions that match the schemas
export type EnhancedSummaryResponse = {
  summary: string;
  key_insights?: string[];
  relevance_score?: number;
};

export type EnhancedAnglesResponse = {
  angles: Array<{
    headline: string;
    commentary: string;
    strength?: "strong" | "moderate" | "weak";
  }>;
};

export type EnhancedOutlineResponse = {
  idea: string;
  outline: string[];
  target_audience?: string;
};

export type EnhancedEmailResponse = {
  subject: string;
  body: string;
  hook_type?: "breaking_news" | "trend_analysis" | "contrarian_view" | "data_insight" | "expert_perspective";
};

export type EnhancedArticleResponse = {
  title: string;
  content: string;
  word_count?: number;
  key_messages?: string[];
};

export type EnhancedPRContentResponse = {
  summary: EnhancedSummaryResponse;
  angles: EnhancedAnglesResponse;
  outline: EnhancedOutlineResponse;
  article: EnhancedArticleResponse;
  email: EnhancedEmailResponse;
};

// ArticleDraftV2 type definition for QA validation
export type ArticleDraftV2 = {
  title: string;
  content: string;
  hook_stat: string;
  stat_date: string;
  pitch_email: string;
  byline_draft: string;
  word_count: number;
  links?: Array<{
    title: string;
    url: string;
    is_alive: boolean;
  }>;
};

// Publishing Pack SEO schema
export const publishingPackSEOSchema = {
  type: "object",
  properties: {
    metaDescription: {
      type: "string",
      description: "SEO meta description (≤160 characters) summarizing the PR story"
    },
    keywords: {
      type: "string",
      description: "Comma-separated list of 5-7 relevant keywords or entities from the story"
    }
  },
  required: ["metaDescription", "keywords"],
  additionalProperties: false
};

export type PublishingPackSEOResponse = {
  metaDescription: string;
  keywords: string;
};