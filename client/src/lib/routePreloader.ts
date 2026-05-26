/**
 * Route preloader utility
 * Used to preload data for common routes to improve navigation performance
 */
import { QueryClient } from "@tanstack/react-query";
import { cacheConfig, getPrefetchOptions } from "./cacheConfig";

type PreloadOptions = {
  articleId?: string | number;
  companyId?: string | number;
};

/**
 * Preloads data for the dashboard route
 */
export function preloadDashboard(queryClient: QueryClient) {
  console.log("Preloading dashboard data...");
  
  // Prefetch article list
  queryClient.prefetchQuery({
    queryKey: cacheConfig.queryKeys.articles(),
    ...getPrefetchOptions("articles")
  });
  
  // Prefetch user data
  queryClient.prefetchQuery({
    queryKey: cacheConfig.queryKeys.user(),
    ...getPrefetchOptions("user")
  });
}

/**
 * Preloads data for the history page
 */
export function preloadHistory(queryClient: QueryClient, options?: PreloadOptions) {
  console.log("Preloading history data...");
  
  // Prefetch history list
  queryClient.prefetchQuery({
    queryKey: cacheConfig.queryKeys.historyList(options?.companyId),
    ...getPrefetchOptions("historyList")
  });
}

/**
 * Preloads data for a specific article result page
 */
export function preloadArticleResult(queryClient: QueryClient, articleId: string | number) {
  console.log(`Preloading article result data for article ${articleId}...`);
  
  // Prefetch article data
  queryClient.prefetchQuery({
    queryKey: cacheConfig.queryKeys.article(articleId),
    ...getPrefetchOptions("article")
  });
  
  // Prefetch article status
  queryClient.prefetchQuery({
    queryKey: cacheConfig.queryKeys.articleStatus(articleId),
    ...getPrefetchOptions("articleStatus")
  });
  
  // Prefetch article content
  queryClient.prefetchQuery({
    queryKey: cacheConfig.queryKeys.articleContent(articleId),
    ...getPrefetchOptions("articleContent")
  });
}