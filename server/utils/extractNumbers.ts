/**
 * Numerical extraction utility for identifying statistics and data points
 * in article content for data-driven angle generation
 */

// Enhanced pattern for detecting various number formats including years, currencies, and ranges
const NUMBER_PATTERN = /(?:\$|€|£)?(?:\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:%|percent|million|billion|thousand|k|m|b)?|\d{4}(?:\s*-\s*\d{4})?/gi;

// Pattern for years (4-digit numbers between 1900-2099)
const YEAR_PATTERN = /\b(19\d{2}|20\d{2})\b/g;

// Pattern for ordinals (1st, 2nd, 3rd, etc.)
const ORDINAL_PATTERN = /\b\d+(?:st|nd|rd|th)\b/gi;

/**
 * Extracts key numbers and statistics from text content
 * @param text - Content to scan for numerical data
 * @returns Array of unique numerical values found, limited to top 10 for better coverage
 */
export function extractKeyNumbers(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Extract all numerical matches from different patterns
  const numberMatches = text.match(NUMBER_PATTERN) || [];
  const yearMatches = text.match(YEAR_PATTERN) || [];
  const ordinalMatches = text.match(ORDINAL_PATTERN) || [];
  
  // Combine all matches
  const allMatches = [...numberMatches, ...yearMatches, ...ordinalMatches];
  
  // Normalize and filter matches
  const processedMatches = allMatches.map(match => {
    // Clean up the match
    let cleaned = match.trim();
    
    // Convert shorthand (k, m, b) to full numbers for sorting
    if (/k$/i.test(cleaned)) {
      cleaned = cleaned.replace(/k$/i, ',000');
    } else if (/m$/i.test(cleaned)) {
      cleaned = cleaned.replace(/m$/i, ' million');
    } else if (/b$/i.test(cleaned)) {
      cleaned = cleaned.replace(/b$/i, ' billion');
    }
    
    return cleaned;
  });
  
  // Deduplicate matches
  const uniqueNumbers = [...new Set(processedMatches)];
  
  // Categorize and score numbers for relevance
  const scoredNumbers = uniqueNumbers.map(num => {
    let score = 0;
    const cleanNum = num.replace(/[,$€£]/g, '');
    const numValue = parseFloat(cleanNum);
    
    // Percentages are highly relevant
    if (num.includes('%') || /percent/i.test(num)) score += 100;
    
    // Large numbers (millions, billions) are very relevant
    if (/million|billion/i.test(num)) score += 80;
    
    // Currency values are relevant
    if (/[$€£]/.test(num)) score += 60;
    
    // Years (especially recent) are moderately relevant
    if (/^(19|20)\d{2}$/.test(cleanNum)) {
      score += 40;
      if (numValue >= 2020) score += 20; // Recent years more relevant
    }
    
    // Ordinals can be relevant for rankings
    if (/st|nd|rd|th$/i.test(num)) score += 30;
    
    // Larger numbers generally more relevant
    if (numValue >= 1000000) score += 50;
    else if (numValue >= 1000) score += 30;
    else if (numValue >= 100) score += 20;
    else if (numValue >= 10) score += 10;
    
    return { number: num, score };
  });
  
  // Sort by score and return top 10 for better coverage
  const sortedNumbers = scoredNumbers
    .sort((a, b) => b.score - a.score)
    .map(item => item.number);
  
  return sortedNumbers.slice(0, 10);
}

/**
 * Log numerical extraction results for monitoring
 * @param numbers - Extracted numbers array
 * @param source - Source identifier for logging
 */
export function logNumberExtraction(numbers: string[], source: string): void {
  console.log(`🔢 Numbers found in ${source}:`, {
    count: numbers.length,
    numbers: numbers,
    source: source
  });
}