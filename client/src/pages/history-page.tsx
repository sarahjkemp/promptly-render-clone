import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Article } from "@shared/schema";
import AppLayout from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UnderlinedButton } from "@/components/ui/underlined-button";
import { ErrorMessage } from "@/components/ui/error-message";

import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Eye, RotateCw, Clock, AlertCircle, CheckCircle, Loader2, FileText, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ArticleMoreMenu } from "@/components/ui/article-more-menu";
import { ArticleCard } from "@/components/ui/article-card";
import { ArticleStatusBadge } from "@/components/ui/article-status-badge";
import { getCacheOptions, cacheConfig } from "@/lib/cacheConfig";
import { getFriendlyErrorMessage, trackApiError, resetErrorTracking } from "@/lib/errorTracker";
import { preloadArticleResult } from "@/lib/routePreloader";

// Types for the article history data
type ArticleHistoryItem = {
  article: Article;
  status: "pending" | "processing" | "done" | "error" | "unknown";
  errorMessage: string | null;
  historyId: number | null;
  updatedAt: string | Date;
};

// Helper to truncate text
const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

// Helper to format date
const formatDate = (dateString: string | Date) => {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return format(date, 'MMM d, yyyy');
  } catch (error) {
    return String(dateString);
  }
};



export default function HistoryPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [lastReprocessedHistoryId, setLastReprocessedHistoryId] = useState<number | null>(null);
  
  // Fetch article history with centralized cache configuration
  // Use the cache options for history list with better performance settings
  const { 
    data: articleHistory, 
    isLoading,
    isFetching, 
    error, 
    refetch 
  } = useQuery<ArticleHistoryItem[]>({
    queryKey: cacheConfig.queryKeys.historyList(),
    ...getCacheOptions("historyList"),
    // Keep the data in cache longer to improve navigation performance
    gcTime: cacheConfig.cacheTime,
    // Fetch only if stale - relies on cache to improve performance
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    // Key perf improvement - use the previous data as placeholder while loading
    placeholderData: (prev) => prev, // This is equivalent to keepPreviousData in v4
  });
  
  // Mutation for reprocessing an article with improved retry
  const reprocessMutation = useMutation({
    mutationFn: async (historyId: number) => {
      try {
        const response = await apiRequest("POST", `/api/article-history/${historyId}/reprocess`);
        return response;
      } catch (error: any) {
        // Handle rate limit errors with retry
        if (error.message && 
            (error.message.includes('rate limit') || 
             error.message.toLowerCase().includes('429'))) {
          
          // Notify user of retry attempt
          toast({
            title: "Processing service busy",
            description: "Waiting 3 seconds before automatically retrying...",
          });
          
          // Wait for 3 seconds
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Try one more time
          return await apiRequest("POST", `/api/article-history/${historyId}/reprocess`);
        }
        
        // For other errors, just propagate them
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate the history data cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/article-history"] });
      toast({
        title: "Reprocessing started",
        description: "The article is being reprocessed."
      });
    },
    onError: (error: Error) => {
      console.error("Failed to reprocess article:", error);
      toast({
        title: "Processing Error",
        description: getFriendlyErrorMessage(error),
        variant: "destructive",
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              if (lastReprocessedHistoryId) {
                reprocessMutation.mutate(lastReprocessedHistoryId);
              }
            }}
            disabled={!lastReprocessedHistoryId}
          >
            Retry
          </Button>
        )
      });
    }
  });
  
  // Handle view article result - enhanced with query caching
  const handleViewArticle = (articleId: number) => {
    console.log("Navigating to article with ID:", articleId);
    
    // Prepare the content by prefetching it if possible
    const item = articleHistory?.find(item => item.article.id === articleId);
    
    // Only navigate when we confirm an item exists
    if (item) {
      // Pre-populate the query cache with this article to avoid loading it again
      // This helps solve the "Processing Article" issue by ensuring data is available
      queryClient.setQueryData(["/api/articles", String(articleId)], item.article);
      
      // If status is completed, also prefetch the latest status
      if (item.status === "done") {
        // Create a history record object from the item data
        const historyRecord = {
          id: item.historyId || 0, // Use historyId if available, or fallback to 0
          articleId: item.article.id,
          status: item.status,
          errorMessage: item.errorMessage,
          createdAt: item.updatedAt || new Date().toISOString() // Use updatedAt as createdAt
        };
        queryClient.setQueryData(
          ["/api/articles", String(articleId), "status"], 
          historyRecord
        );
      }
      
      // Navigate using wouter (primary method)
      setLocation(`/results/${articleId}`);
      
      // Fallback navigation if wouter fails
      setTimeout(() => {
        if (!window.location.pathname.includes(`/results/${articleId}`)) {
          window.location.href = `/results/${articleId}`;
        }
      }, 100);
    } else {
      console.error("Article not found in history:", articleId);
      toast({
        title: "Navigation Error",
        description: "Unable to find the requested article in history.",
        variant: "destructive"
      });
    }
  };
  
  // Handle reprocess article with improved feedback
  const handleReprocessArticle = (historyId: number) => {
    // Set the history ID being reprocessed for visual feedback
    setLastReprocessedHistoryId(historyId);
    
    // Show toast notification for better user feedback
    toast({
      title: "Reprocessing started",
      description: "Attempting to reprocess your article...",
    });
    
    // Start the reprocessing mutation
    reprocessMutation.mutate(historyId);
  };
  
  // Handle add new article
  const handleAddArticle = () => {
    setLocation("/add-content");
  };
  
  // Render skeleton loader
  const renderSkeletonLoader = () => (
    <>
      {!isMobile ? (
        // Desktop skeleton
        <div className="w-full">
          <div className="flex items-center space-x-4 p-4">
            <Skeleton className="h-12 w-12 rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
          <div className="border-t border-gray-100">
            <div className="flex items-center justify-between p-4">
              <Skeleton className="h-4 w-[100px]" />
              <div className="flex space-x-2">
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Mobile skeleton
        <Card className="mb-4">
          <div className="p-4">
            <div className="flex space-x-3">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-3 space-x-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        </Card>
      )}
    </>
  );
  
  // Empty state component
  const EmptyState = () => (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-4">
        <FileText className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No Content Yet</h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        You haven't processed any content yet. Click 'Add New' to get started.
      </p>
      <UnderlinedButton 
        onClick={handleAddArticle}
        icon={<Plus className="h-4 w-4" />}
        className="text-base"
      >
        Add New
      </UnderlinedButton>
    </div>
  );
  
  return (
    <AppLayout title="Content History">
      <div className="mb-8 max-w-3xl">
        <h1 className="text-2xl font-semibold text-gray-900">Content History</h1>
        <p className="text-gray-600 mt-2 text-sm">
          View and manage all your previously processed content
        </p>
      </div>
      
      {/* Action buttons */}
      <div className="flex justify-between items-center mb-6">
        <div>
          {!isLoading && articleHistory && articleHistory.length > 0 && (
            <p className="text-sm text-gray-600">
              Showing {articleHistory.length} item{articleHistory.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <UnderlinedButton 
          onClick={handleAddArticle}
          icon={<Plus className="h-3.5 w-3.5" />}
          className="text-sm"
        >
          Add New
        </UnderlinedButton>
      </div>
      
      {/* Error State with standardized messaging */}
      {error && (
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex flex-col">
            <h3 className="font-medium text-red-800 mb-3">Error Loading History</h3>
            <ErrorMessage 
              message={getFriendlyErrorMessage(error)}

              variant="block"
              size="md"
            />
            <Button 
              size="sm" 
              onClick={() => setLocation("/")}
              className="mt-4 self-start"
            >
              Return to Dashboard
            </Button>
          </div>
        </Card>
      )}
      
      {/* Loading State */}
      {isLoading && (
        <Card>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={i > 0 ? "border-t border-gray-100" : ""}>
              {renderSkeletonLoader()}
            </div>
          ))}
        </Card>
      )}
      
      {/* Empty State */}
      {!isLoading && !error && (!articleHistory || articleHistory.length === 0) && (
        <Card className="border border-gray-200 rounded-md">
          <EmptyState />
        </Card>
      )}
      
      {/* Content History List - Desktop */}
      {!isLoading && !error && articleHistory && articleHistory.length > 0 && !isMobile && (
        <Card className="border border-gray-200 rounded-md overflow-hidden">
          <Table className="table-fixed">
            <colgroup>
              <col style={{ width: '50%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="font-medium text-gray-500 px-3">Article</TableHead>
                <TableHead className="font-medium text-gray-500 px-3">Date</TableHead>
                <TableHead className="font-medium text-gray-500 px-3">Status</TableHead>
                <TableHead className="text-center font-medium text-gray-500 px-3">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Limit to first 50 items for better performance */}
              {articleHistory.slice(0, 50).map((item) => {
                
                return (
                  <TableRow 
                    key={`${item.article.id}-${item.historyId || 'history'}`}
                    className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                    onClick={() => item.status !== "pending" && item.status !== "processing" && handleViewArticle(item.article.id)}
                    onMouseEnter={() => {
                      // Preload article data on hover for faster navigation
                      if (item.status === "done") {
                        preloadArticleResult(queryClient, item.article.id);
                      }
                    }}
                  >
                    <TableCell className="px-3 py-3">
                      <div className="flex items-center min-w-0">
                        <div className="h-8 w-8 flex-shrink-0 rounded bg-gray-100 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="ml-3 min-w-0 flex-1">
                          <div 
                            className={`text-sm font-medium text-gray-900 ${item.status !== "pending" && item.status !== "processing" ? "hover:text-primary-700 text-primary-600 cursor-pointer" : "opacity-70"} text-left truncate`}
                            title={item.article.title}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.status !== "pending" && item.status !== "processing") {
                                handleViewArticle(item.article.id);
                              }
                            }}
                          >
                            {item.article.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 truncate">
                            {item.article.bodyText}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-xs text-gray-600">
                      {formatDate(item.updatedAt)}
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <ArticleStatusBadge 
                        status={item.status}
                        errorMessage={item.errorMessage}
                        onClick={item.status === "error" && item.historyId ? () => handleReprocessArticle(item.historyId!) : undefined}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <ArticleMoreMenu
                        articleId={item.article.id}
                        articleText={item.article.bodyText}
                        historyId={item.historyId}
                        isProcessing={item.status === "pending" || item.status === "processing"}
                        onReprocess={handleReprocessArticle}
                        isPending={reprocessMutation.isPending}
                        className="h-8 w-8"
                        onView={() => handleViewArticle(item.article.id)}
                        canView={item.status !== "pending" && item.status !== "processing"}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      
      {/* Content History List - Mobile */}
      {!isLoading && !error && articleHistory && articleHistory.length > 0 && isMobile && (
        <div className="space-y-4">
          {articleHistory.map((item) => (
            <ArticleCard
              key={`${item.article.id}-${item.historyId}`}
              article={item.article}
              status={item.status}
              updatedAt={item.updatedAt}
              historyId={item.historyId}
              errorMessage={item.errorMessage}
              onClick={() => handleViewArticle(item.article.id)}
              onReprocess={handleReprocessArticle}
              isProcessing={item.status === "pending" || item.status === "processing"}
              isPending={reprocessMutation.isPending}
            />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
