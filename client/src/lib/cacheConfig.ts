/**
 * Centralized cache configuration for the application
 * This ensures consistent caching strategies across components
 * and improves navigation performance
 */

// Stale times in milliseconds
const STALE_TIMES = {
  articles: 1000 * 30,             // 30 seconds for article list (decreased for more frequent updates)
  article: 1000 * 60,              // 1 minute for article details
  articleStatus: 0,                // Always consider status stale to force refresh
  articleContent: 1000 * 60 * 5,   // 5 minutes for processed content
  historyList: 1000 * 30,          // 30 seconds for history list
  user: 1000 * 60 * 5,             // 5 minutes for user profile
};

// Refetch intervals in milliseconds
const REFETCH_INTERVALS = {
  articles: 1000 * 30,             // 30 seconds for article list
  article: 1000 * 30,              // 30 seconds for article details
  articleStatus: 1000,             // Poll every 1 second during processing
  articleStatusDone: 1000 * 5,     // Poll every 5 seconds even when complete
  articleContent: 1000 * 30,       // 30 seconds for content refresh
  historyList: 1000 * 30,          // 30 seconds for history list
  user: 1000 * 60,                 // 1 minute for user profile
};

// Cache keys for consistent query key structure
const QUERY_KEYS = {
  articles: () => ['/api/articles'],
  article: (id: string | number) => ['/api/articles', id.toString()],
  articleStatus: (id: string | number) => ['/api/article-history', id.toString(), 'status'],
  articleContent: (id: string | number) => ['/api/articles', id.toString(), 'content'],
  historyList: (companyId?: string | number) => 
    companyId ? ['/api/article-history', companyId.toString()] : ['/api/article-history'],
  user: () => ['/api/user'],
};

// Cache time for prefetched data (how long to keep in cache)
const CACHE_TIME = 1000 * 60 * 60; // 1 hour

// Export configuration
export const cacheConfig = {
  staleTimes: STALE_TIMES,
  refetchIntervals: REFETCH_INTERVALS,
  queryKeys: QUERY_KEYS,
  cacheTime: CACHE_TIME,
};

/**
 * Helper function to generate query options with appropriate caching
 */
export function getCacheOptions(cacheType: keyof typeof cacheConfig.staleTimes) {
  return {
    staleTime: cacheConfig.staleTimes[cacheType],
    refetchInterval: cacheConfig.refetchIntervals[cacheType],
    gcTime: cacheConfig.cacheTime, // Keep in cache longer for better navigation
  };
}

/**
 * Helper function to generate prefetch options 
 * Used for preloading data for navigation
 */
export function getPrefetchOptions(cacheType: keyof typeof cacheConfig.staleTimes) {
  return {
    staleTime: cacheConfig.staleTimes[cacheType],
    gcTime: cacheConfig.cacheTime, 
  };
}