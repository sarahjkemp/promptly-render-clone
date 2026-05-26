import { 
  SYSTEM_PROMPT_BASE, 
  SUMMARY_PROMPT, 
  ANGLES_PROMPT, 
  EMAIL_PROMPT 
} from './promptTemplates';

interface PromptSet {
  summary: string;
  angles: string;
  outline: string;
  linkedinIdea: string;
  email: string;
}

export class PromptRouter {
  static getPromptSet(sourceType: 'CLIENT' | 'NEWS'): PromptSet {
    const baseContext = SYSTEM_PROMPT_BASE;
    
    // Feature flag: Use unified angles template for CLIENT mode
    const useUnifiedAngles = process.env.USE_UNIFIED_ANGLES === 'true';
    
    if (sourceType === 'CLIENT') {
      return {
        summary: `${baseContext}

This is CLIENT-AUTHORED content. Generate a compelling summary that:
- Highlights key findings, statistics, and achievements from the content
- Positions the company as a leader in their industry 
- Focuses on quantifiable achievements and industry-first positioning
- Keeps it to one punchy paragraph with concrete data points
- Uses only factual information explicitly provided in the article

🚫 CRITICAL: NEVER write "On [DATE]", "In [MONTH]", "Recently in [YEAR]" or any specific dates/periods. Use "recently", "the company announced", "new developments show" instead. NO FABRICATED DATES OR STATISTICS.`,

        angles: useUnifiedAngles ? ANGLES_PROMPT : `${baseContext}

Generate 2-3 distinct PR angles in headline format. Each angle should be a punchy, curiosity-driven headline that positions the client's expertise:

Format: "[SUBJECT] beat [ALTERNATIVE]: [PERCENTAGE]%" or "[INSIGHT]: [STATISTIC] [OUTCOME]"

Examples:
- "Micro-breaks beat standing desks: 3-minute pauses boost output 12%"
- "Gen Z's mood KPI: 30% drop in stress after guided resets" 
- "From perk to profit: firms saved £2.4m in absenteeism"

Keep headlines under 60 characters. Focus on contrasts, surprising statistics, and business impact.`,

        outline: `${baseContext}

Create a thought leadership outline (maximum 400 words) based on the article. Provide:
- A compelling headline/title for the piece
- 3-5 key talking points that demonstrate industry expertise
- Points should build a cohesive narrative
- Focus on insights, not just opinions
- Include specific data points where possible

Format as structured sections with clear headings.`,

        linkedinIdea: `Generate LinkedIn content formatted as hook + bullets + CTA`,

        email: `${baseContext}

[BUSINESS CONTEXT]
Company: {companyName}
Industry: {industry}  
Brand Tone: {brandTone}
Key Focus Areas: {keyPhrases}
Target Markets: {targetRegions}
{documentContext}

Draft a COMPLETE journalist-ready pitch email. Format your response EXACTLY as:

SUBJECT: [Your subject line - max 70 characters]

BODY:
[Complete email body here]

Requirements:
- Subject: Data-driven news angle (e.g., "New data: 95% reduction in manual weeding time")
- Body: 200-250 words with editorial tone:
  - Greeting: "Hi [Name],"
  - Opening: Start with the MOST IMPRESSIVE STATISTIC from the article as your hook
  - Context: 2-3 sentences explaining why this matters to their readers
  - Evidence: Include 2-3 additional data points that support the story
  - Offer: Specific value (exclusive data, expert interview, case study access)
  - Call-to-action: One clear next step
  - Sign-off: "Best regards," followed by "[Your Name]"

Editorial tone guidelines:
- Write like a fellow journalist sharing a tip, not a PR person selling
- Focus on the story value, not company promotion
- Use phrases like "This could interest your readers..." or "New data shows..."
- Avoid superlatives unless backed by specific data

🚫 CRITICAL: NEVER fabricate dates or statistics. Use only data from the article.

MUST end with proper closing and signature. NEVER stop mid-sentence.`
      };
    } else {
      // NEWS mode prompts for external content commentary
      return {
        summary: `${baseContext}

Generate a summary that:
- Highlights key events, announcements, and findings from the content
- Focuses on the impact and implications for the industry
- Uses factual reporting tone with concrete implications
- Keeps it to one punchy paragraph
- Uses only factual information explicitly provided in the article

🚫 CRITICAL: NEVER write "On [DATE]", "In [MONTH]", "Recently in [YEAR]" or any specific dates/periods. Use "recently", "the organization announced", "new developments show" instead. NO FABRICATED DATES OR STATISTICS.`,

        angles: `${baseContext}

Generate 2-3 commentary angles in headline format for this external news:

Format: "[IMPLICATION]: [SPECIFIC IMPACT]" or "[CHALLENGE/OPPORTUNITY]: [OUTCOME]"

Examples:
- "90-day filing trap: UK founders must prep for EU audits"
- "Tier-2 risk (HR AI) could face biggest compliance bill"
- "The sleeper opportunity: Act-ready models win 2026 EU tenders"

Keep headlines under 60 characters. Focus on business implications and actionable insights.`,

        outline: `${baseContext}

Create a commentary outline (maximum 400 words) responding to this external news. Provide:
- A compelling response headline that positions company expertise
- 3-5 key commentary points that demonstrate industry knowledge
- Focus on implications and actionable insights
- Connect the news to broader industry trends

Format as structured sections with clear headings.`,

        linkedinIdea: `Generate LinkedIn content formatted as hook + poll/bullets + CTA`,

        email: `${baseContext}

Draft a commentary email about this news. Format your response EXACTLY as:

SUBJECT: [Your subject line - max 70 characters]

BODY:
[Complete email body here]

Requirements:
- Subject: Data-driven news angle (e.g., "Agricultural AI breakthrough: 95% labor reduction")
- Body: 200-250 words with editorial tone:
  - Greeting: "Hi [Name],"
  - Opening: Start with the MOST IMPRESSIVE STATISTIC from the article as your hook
  - Context: 2-3 sentences explaining industry implications
  - Evidence: Include 2-3 additional data points that support the impact
  - Expertise offer: Position company as thought leader (exclusive analysis, expert commentary, data insights)
  - Call-to-action: One clear next step
  - Sign-off: "Best regards," followed by "[Your Name]"

Editorial tone guidelines:
- Write like an industry analyst sharing insights, not promoting
- Focus on market impact and what it means for the sector
- Use phrases like "This development could reshape..." or "The data suggests..."
- Let statistics tell the story

🚫 CRITICAL: NEVER fabricate dates or statistics. Use only data from the article.

MUST end with proper closing and signature. NEVER stop mid-sentence.`
      };
    }
  }
}