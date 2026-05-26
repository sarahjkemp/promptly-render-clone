import { db } from './db.js';
import { articles, companyProfiles, prompts } from '../shared/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { processArticle } from './articleProcessor.js';
import { storage } from './storage.js';
import { getUserLocation, generateIndustryBias } from './utils/geoLocation.js';

interface SearchResult {
  title: string;
  content: string;
  url: string;
  publishedDate?: string;
}

interface FetchResult {
  success: boolean;
  articleId?: number;
  message: string;
  error?: string;
}

interface TestResult {
  searchResult: SearchResult | null;
  promptUsed: string;
  companyContext: {
    name: string;
    keywords: string[];
    targetRegions: string[];
  };
}

/**
 * Searches for a relevant news article using OpenAI web search
 * Uses database-sourced prompt or fallback to default
 */
async function searchForArticle(
  keywords: string[], 
  targetRegions: string[], 
  customPrompt?: string
): Promise<SearchResult | null> {
  try {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // Get the prompt from database or use default
    let prompt = customPrompt;
    if (!prompt) {
      try {
        const [dbPrompt] = await db
          .select()
          .from(prompts)
          .where(eq(prompts.name, 'news_fetch_prompt'))
          .limit(1);
        
        if (dbPrompt) {
          prompt = dbPrompt.content;
          console.log('Using database prompt for search');
        }
      } catch (error) {
        console.warn('Failed to fetch prompt from database, using fallback:', error);
      }
    }
    
    // Fallback to default prompt if no database prompt found
    if (!prompt) {
      prompt = `Find ONE recent news article relevant to these topics: {keywords}, focused on the following region(s): {targetRegions}.
- The article should be from a reputable source, published in the last 7 days.
- Prioritise substantial articles with real news value (avoid press releases or low-quality blogs).

Return a JSON object with:
{
  "title": "Title of the article",
  "content": "Summary or excerpt of the article", 
  "url": "Direct URL to the article",
  "publishedDate": "YYYY-MM-DD"
}

Additional requirements:
- If no suitable article is found, return: { "no_article_found": true }
- Do not include content from paywalled sources unless a free summary is available.
- Focus on news that a journalist or comms team would find useful for PR analysis.`;
      console.log('Using fallback default prompt');
    }
    
    // Replace variables in the prompt
    const processedPrompt = prompt
      .replace(/{keywords}/g, keywords.join(', '))
      .replace(/{targetRegions}/g, targetRegions.join(', '));
    
    // Use OpenAI's Responses API with web search capability
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        input: processedPrompt,
        tools: [{ 
          type: 'web_search_preview',
          user_location: {
            type: 'approximate',
            country: 'GB',
            region: 'UK'
          },
          search_context_size: 'medium'
        }],
        tool_choice: { type: 'web_search_preview' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error ${response.status}:`, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI Responses API data:', JSON.stringify(data, null, 2));
    
    // Parse the response to extract article data from the new API structure
    const messageOutput = data.output?.find((item: any) => item.type === 'message');
    
    if (!messageOutput || !messageOutput.content || !messageOutput.content[0]) {
      console.log('No message content in OpenAI response');
      return null;
    }
    
    const contentItem = messageOutput.content[0];
    const content = contentItem.text;
    const annotations = contentItem.annotations;
    
    if (!content) {
      console.log('No text content in response');
      return null;
    }

    // Try to extract JSON from the response
    try {
      // Look for JSON object in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const articleData = JSON.parse(jsonMatch[0]);
        if (articleData && articleData.title && articleData.content && articleData.url) {
          return {
            title: articleData.title,
            content: articleData.content,
            url: articleData.url,
            publishedDate: articleData.publishedDate
          } as SearchResult;
        }
      }
      
      // Extract article info from citations - this is the main approach for the Responses API
      if (annotations && annotations.length > 0) {
        const firstCitation = annotations[0];
        if (firstCitation.type === 'url_citation' && firstCitation.url && firstCitation.title) {
          // Extract a meaningful content snippet - first paragraph or first few sentences
          const sentences = content.split('.').slice(0, 3).join('.') + '.';
          const paragraphs = content.split('\n\n')[0] || sentences;
          
          console.log('Successfully extracted article:', firstCitation.title);
          
          return {
            title: firstCitation.title,
            content: paragraphs.length > 100 ? paragraphs : sentences,
            url: firstCitation.url,
            publishedDate: new Date().toISOString().split('T')[0]
          } as SearchResult;
        }
      }
    } catch (parseError) {
      console.log('Could not parse article data from OpenAI response');
      console.log('Raw content:', content);
    }

    return null;
  } catch (error) {
    console.error('Error searching for article:', error);
    throw error;
  }
}

/**
 * Checks if an article with the same title or URL already exists for this company
 */
async function isDuplicateArticle(companyProfileId: number, title: string, url?: string): Promise<boolean> {
  const existingArticles = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.companyProfileId, companyProfileId),
        eq(articles.title, title)
      )
    );

  if (existingArticles.length > 0) return true;

  if (url) {
    const existingByUrl = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.companyProfileId, companyProfileId),
          eq(articles.sourceUrl, url)
        )
      );
    return existingByUrl.length > 0;
  }

  return false;
}

/**
 * Processes a found article and generates all PR content
 * Reuses existing article processing pipeline
 */
async function processFoundArticle(
  searchResult: SearchResult,
  companyProfileId: number,
  fetchType: 'manual' | 'auto'
): Promise<number> {
  try {
    // Save the article to database
    const [newArticle] = await db
      .insert(articles)
      .values({
        companyProfileId,
        title: searchResult.title,
        bodyText: searchResult.content,
        fetchType,
        fetchedAt: new Date(),
        sourceUrl: searchResult.url,
        isViewed: false,
      })
      .returning();

    // Generate all PR content using existing pipeline
    await processArticle(newArticle.id);

    console.log(`Successfully processed ${fetchType} article: ${searchResult.title}`);
    return newArticle.id;
  } catch (error) {
    console.error('Error processing found article:', error);
    throw error;
  }
}

/**
 * Main fetch function that can be called by both scheduled jobs and manual admin triggers
 */
export async function fetchNewsForCompany(
  companyProfileId: number,
  fetchType: 'manual' | 'auto' = 'auto',
  preFoundArticle?: SearchResult
): Promise<FetchResult> {
  try {
    // Get company profile with keywords
    const [company] = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.id, companyProfileId));

    if (!company) {
      return {
        success: false,
        message: 'Company profile not found',
      };
    }

    if (!company.keywords || company.keywords.length === 0) {
      return {
        success: false,
        message: 'No keywords configured for this company',
      };
    }

    console.log(`Starting ${fetchType} news fetch for company: ${company.name}`);

    // Use pre-found article if provided, otherwise search for new one
    let searchResult: SearchResult;
    
    if (preFoundArticle) {
      searchResult = preFoundArticle;
    } else {
      const found = await searchForArticle(
        company.keywords,
        company.targetRegions || ['UK']
      );

      if (!found) {
        return {
          success: false,
          message: 'No relevant articles found matching your keywords',
        };
      }
      
      searchResult = found;
    }

    // Check for duplicates
    const isDuplicate = await isDuplicateArticle(
      companyProfileId,
      searchResult.title,
      searchResult.url
    );

    if (isDuplicate) {
      return {
        success: false,
        message: 'This article has already been processed',
      };
    }

    // Process the article
    const articleId = await processFoundArticle(searchResult, companyProfileId, fetchType);

    return {
      success: true,
      articleId,
      message: `Successfully fetched and processed: ${searchResult.title}`,
    };
  } catch (error) {
    console.error(`Error in ${fetchType} news fetch:`, error);
    return {
      success: false,
      message: 'Failed to fetch news',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetches news for all companies with configured keywords
 * Used by the scheduled job
 */
export async function fetchNewsForAllCompanies(): Promise<void> {
  try {
    console.log('Starting automated news fetch for all companies');

    // Get all companies with keywords
    const companies = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.onboardingCompleted, true));

    const results = [];

    for (const company of companies) {
      if (company.keywords && company.keywords.length > 0) {
        console.log(`Fetching news for company: ${company.name}`);
        const result = await fetchNewsForCompany(company.id, 'auto');
        results.push({ company: company.name, result });
        
        // Add delay between requests to avoid API rate limits
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.log(`Skipping company ${company.name}: No keywords configured`);
      }
    }

    console.log('Automated news fetch completed:', results);
  } catch (error) {
    console.error('Error in automated news fetch:', error);
  }
}

/**
 * Test news search without saving to database - for admin prompt testing
 */
export async function testNewsSearch(
  companyProfileId: number,
  customPrompt?: string
): Promise<TestResult> {
  try {
    // Get company profile with keywords
    const [company] = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.id, companyProfileId));

    if (!company) {
      throw new Error('Company profile not found');
    }

    if (!company.keywords || company.keywords.length === 0) {
      throw new Error('No keywords configured for this company');
    }

    const companyContext = {
      name: company.name,
      keywords: company.keywords,
      targetRegions: company.targetRegions || ['UK']
    };

    // Get prompt - use custom if provided, otherwise from database
    let promptContent = customPrompt;
    
    if (!promptContent) {
      const prompt = await storage.getPrompt('news_fetch_prompt');
      promptContent = prompt?.content || `Find ONE recent news article about {keywords} in {targetRegions} from the past week.`;
    }

    console.log(`Testing news search for company: ${company.name}`);

    // Search for article using the prompt (pass the prompt to ensure consistency)
    const searchResult = await searchForArticle(
      company.keywords,
      company.targetRegions || ['UK'],
      promptContent
    );

    return {
      searchResult,
      promptUsed: promptContent,
      companyContext
    };
  } catch (error) {
    console.error('Error in test news search:', error);
    throw error;
  }
}