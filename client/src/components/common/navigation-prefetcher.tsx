/**
 * This component prefetches data for common navigation routes
 * to improve navigation performance and reduce page render times
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cacheConfig } from "@/lib/cacheConfig";
import { preloadDashboard, preloadHistory } from "@/lib/routePreloader";

export function NavigationPrefetcher() {
  const queryClient = useQueryClient();
  
  // Prefetch common data immediately on component mount
  useEffect(() => {
    // Start prefetching immediately without delay to ensure data is available
    console.log("Prefetching common data for faster navigation...");
    
    // Use the dedicated preloaders for main routes
    preloadDashboard(queryClient);
    preloadHistory(queryClient);
    
    // Prefetch additional data that might be needed across routes
    queryClient.prefetchQuery({
      queryKey: ['/api/user'],
      staleTime: cacheConfig.staleTimes.user,
      // Make sure to keep the data longer in cache
      gcTime: cacheConfig.cacheTime
    });
    
    // Set up periodic background refresh to keep data fresh without visible loading states
    const intervalId = setInterval(() => {
      // Silently refresh in background
      queryClient.invalidateQueries({
        queryKey: ['/api/articles'],
        refetchType: 'active' // Only refetch if query is active/being used
      });
      
      queryClient.invalidateQueries({
        queryKey: ['/api/article-history'],
        refetchType: 'active' // Only refetch if query is active/being used
      });
    }, 60000); // Refresh every minute in background
    
    return () => clearInterval(intervalId);
  }, [queryClient]);
  
  // This is a headless component (no UI)
  return null;
}