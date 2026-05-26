/**
 * Local caching utility to reduce API calls and improve offline experience
 * This complements the TanStack Query caching but persists data between page refreshes
 */
const PREFIX = "promptly_";

// Cache expiry times (in milliseconds)
const EXPIRY = {
  articles: 1000 * 60 * 60 * 2, // 2 hours for articles list
  article: 1000 * 60 * 60 * 24, // 24 hours for individual articles
  content: 1000 * 60 * 60 * 24, // 24 hours for PR content
};

// Cache item with metadata
interface CacheItem<T> {
  value: T;
  timestamp: number;
  expiry: number;
}

/**
 * Save data to local cache with expiry
 */
export function saveToCache<T>(key: string, data: T, type: keyof typeof EXPIRY = 'article'): void {
  try {
    const cacheKey = `${PREFIX}${key}`;
    const item: CacheItem<T> = {
      value: data,
      timestamp: Date.now(),
      expiry: EXPIRY[type],
    };
    localStorage.setItem(cacheKey, JSON.stringify(item));
  } catch (error) {
    console.error('Error saving to cache:', error);
  }
}

/**
 * Get data from local cache, returns null if expired or not found
 */
export function getFromCache<T>(key: string): T | null {
  try {
    const cacheKey = `${PREFIX}${key}`;
    const itemStr = localStorage.getItem(cacheKey);
    if (!itemStr) return null;

    const item: CacheItem<T> = JSON.parse(itemStr);
    const now = Date.now();
    
    // Check if the item is expired
    if (now - item.timestamp > item.expiry) {
      localStorage.removeItem(cacheKey); // Clean up expired items
      return null;
    }
    
    return item.value;
  } catch (error) {
    console.error('Error reading from cache:', error);
    return null;
  }
}

/**
 * Clear specific cache entry
 */
export function clearCacheItem(key: string): void {
  try {
    const cacheKey = `${PREFIX}${key}`;
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.error('Error clearing cache item:', error);
  }
}

/**
 * Clear all cache entries
 */
export function clearAllCache(): void {
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

/**
 * Create cache key for an article
 */
export function createArticleCacheKey(articleId: string | number): string {
  return `article_${articleId}`;
}

/**
 * Create cache key for article content
 */
export function createContentCacheKey(articleId: string | number): string {
  return `content_${articleId}`;
}

/**
 * Create cache key for article status
 */
export function createStatusCacheKey(articleId: string | number): string {
  return `status_${articleId}`;
}