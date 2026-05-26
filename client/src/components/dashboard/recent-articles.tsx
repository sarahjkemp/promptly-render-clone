import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Loader2, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Article } from "@shared/schema";
import { format } from "date-fns";
import { getCacheOptions, cacheConfig } from "@/lib/cacheConfig";
import { ArticleCard } from "@/components/ui/article-card";
import { ArticleMoreMenu } from "@/components/ui/article-more-menu";
import { UnderlinedButton } from "@/components/ui/underlined-button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getFriendlyErrorMessage } from "@/lib/errorTracker";
import { ArticleStatusBadge, type ArticleStatus } from "@/components/ui/article-status-badge";
import { ArticleTypeIndicator, type ArticleType } from "@/components/ui/article-type-indicator";

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

// Helper to get status badge variant and text based on status
const getStatusInfo = (status: string) => {
  switch (status) {
    case "done":
      return {
        variant: "outline" as const,
        className: "bg-green-50 text-green-700 border-green-200",
        icon: <CheckCircle className="h-3.5 w-3.5 mr-1" />,
        text: "Completed"
      };
    case "processing":
      return {
        variant: "outline" as const,
        className: "bg-primary-50 text-primary-700 border-primary-200",
        icon: <Clock className="h-3.5 w-3.5 mr-1 animate-pulse" />,
        text: "In Progress"
      };
    case "pending":
      return {
        variant: "outline" as const,
        className: "bg-yellow-50 text-yellow-700 border-yellow-200",
        icon: <Clock className="h-3.5 w-3.5 mr-1" />,
        text: "Pending"
      };
    case "error":
      return {
        variant: "outline" as const,
        className: "bg-red-50 text-red-700 border-red-200",
        icon: <AlertCircle className="h-3.5 w-3.5 mr-1" />,
        text: "Error"
      };
    default:
      return {
        variant: "outline" as const,
        className: "bg-gray-50 text-gray-700 border-gray-200",
        icon: <Clock className="h-3.5 w-3.5 mr-1" />,
        text: "Unknown"
      };
  }
};

// Type for article with status
type ArticleWithStatus = {
  article: Article;
  status: "pending" | "processing" | "done" | "error" | "unknown";
  errorMessage: string | null;
  historyId: number | null;
  updatedAt: string | Date;
};

// Helper to get the article status as a valid type
const getArticleStatusType = (status: string): "pending" | "processing" | "done" | "error" | "unknown" => {
  switch(status) {
    case "pending": return "pending";
    case "processing": return "processing";
    case "done": return "done";
    case "error": return "error";
    default: return "unknown";
  }
};

export default function RecentArticles() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch articles data with centralized cache configuration
  const { data: articles, isLoading: isLoadingArticles, error: articlesError } = useQuery<Article[]>({
    queryKey: cacheConfig.queryKeys.articles(),
    ...getCacheOptions('articles'), // Use centralized cache config
  });
  
  // Fetch article history to get status information
  const { data: articleHistory, isLoading: isLoadingHistory, error: historyError } = useQuery<ArticleWithStatus[]>({
    queryKey: cacheConfig.queryKeys.historyList(),
    ...getCacheOptions("historyList"),
    enabled: !!articles && articles.length > 0, // Only fetch if we have articles
  });

  // Direct user to add content page
  const handleAddArticle = () => {
    setLocation("/add-content");
  };
  
  // Direct user to article results page
  const handleViewArticle = (articleId: number) => {
    setLocation(`/results/${articleId}`);
  };
  
  // Define a combined loading state
  const isLoading = isLoadingArticles || isLoadingHistory;
  const error = articlesError || historyError;
  
  // Helper to get article status from history data
  const getArticleStatus = (articleId: number) => {
    if (!articleHistory) return { status: "unknown", historyId: null, errorMessage: null };
    
    const historyItem = articleHistory.find(item => item.article.id === articleId);
    if (!historyItem) return { status: "unknown", historyId: null, errorMessage: null };
    
    return {
      status: historyItem.status,
      historyId: historyItem.historyId,
      errorMessage: historyItem.errorMessage,
      updatedAt: historyItem.updatedAt
    };
  };
  
  // Mutation for reprocessing
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
        description: "Your content is being reprocessed."
      });
    },
    onError: (error: Error) => {
      console.error("Failed to reprocess article:", error);
      toast({
        title: "Processing Error",
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    }
  });
  
  // Handle reprocessing an article
  const handleReprocessArticle = (historyId: number) => {
    reprocessMutation.mutate(historyId);
  };
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-gray-900">Recent Content</h2>
        <UnderlinedButton 
          onClick={handleAddArticle}
          icon={<Plus className="h-3.5 w-3.5" />}
          className="text-sm"
        >
          Add New
        </UnderlinedButton>
      </div>
      
      <Card className="overflow-hidden border bg-card shadow-sm hover:shadow-md transition-shadow duration-200 rounded-lg">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
            <p className="text-sm text-gray-600">Loading content...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 mx-auto flex items-center justify-center mb-3">
              <FileText className="h-5 w-5 text-red-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">Error Loading Content</h3>
            <p className="text-xs text-gray-600 mb-4">Unable to load your recent content.</p>
            <Button size="sm" onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        ) : articles && articles.length > 0 ? (
          <div className="overflow-hidden">
            {/* Desktop view */}
            <table className="w-full hidden lg:table table-fixed">
              <colgroup>
                <col style={{ width: '50%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Content</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {articles.map((article) => {
                  const { status: statusStr, historyId, errorMessage } = getArticleStatus(article.id);
                  const status = getArticleStatusType(statusStr);
                  const { className, icon, text } = getStatusInfo(status);
                  const isProcessing = status === "pending" || status === "processing";
                  const isError = status === "error";
                  
                  return (
                    <tr 
                      key={article.id} 
                      className="hover:bg-gray-50/80 transition-colors duration-200 cursor-pointer group"
                      onClick={() => handleViewArticle(article.id)}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center min-w-0">
                          <div className="relative h-9 w-9 flex-shrink-0 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="ml-4 min-w-0 flex-1">
                            <div 
                              className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors duration-150 text-left truncate cursor-pointer group-hover:text-blue-600"
                              title={article.title}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewArticle(article.id);
                              }}
                            >
                              {article.title}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 truncate">
                              {truncateText(article.bodyText || "", 40)}
                            </div>
                            {isError && errorMessage && (
                              <div className="mt-1 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded px-2 py-1 truncate">
                                {truncateText(getFriendlyErrorMessage(errorMessage), 40)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 font-medium">
                        {formatDate(article.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${className} py-1 px-2.5 font-medium rounded-full`}
                        >
                          {icon} {text}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <ArticleMoreMenu
                          articleId={article.id}
                          articleText={article.bodyText || ""}
                          historyId={historyId}
                          isProcessing={isProcessing}
                          onReprocess={handleReprocessArticle}
                          isPending={reprocessMutation.isPending}
                          className="h-8 w-8"
                          onView={() => handleViewArticle(article.id)}
                          canView={!isProcessing && !isError}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile/Tablet view */}
            <div className="lg:hidden space-y-4 p-3">
              {articles.map((article) => {
                const { status: statusStr, historyId, errorMessage } = getArticleStatus(article.id);
                const status = getArticleStatusType(statusStr);
                const isProcessing = status === "pending" || status === "processing";
                return (
                  <ArticleCard
                    key={article.id}
                    article={{
                      id: article.id,
                      title: article.title,
                      bodyText: article.bodyText,
                      fetchType: article.fetchType,
                      fetchedAt: article.fetchedAt ? new Date(article.fetchedAt).toISOString() : undefined,
                      isViewed: article.isViewed
                    }}
                    status={status}
                    updatedAt={article.createdAt}
                    historyId={historyId}
                    errorMessage={errorMessage}
                    onClick={() => handleViewArticle(article.id)}
                    onReprocess={handleReprocessArticle}
                    isProcessing={isProcessing}
                    isPending={reprocessMutation.isPending}
                    className="border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 mx-auto flex items-center justify-center mb-6">
              <FileText className="h-7 w-7 text-gray-800" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to create content?</h3>
            <p className="text-sm text-gray-600 mb-8 max-w-sm mx-auto">Start by adding your first article to generate professional PR ready content.</p>
            <Button 
              onClick={handleAddArticle}
              className="bg-gray-900 hover:bg-gray-800 text-white shadow-sm hover:shadow transition-all duration-200"
            >
              <Plus className="h-4 w-4 mr-2" />
              Get started
            </Button>
          </div>
        )}
      </Card>
      
      {/* View All Button - only show if we have articles */}
      {articles && articles.length > 0 && (
        <div className="mt-6 text-center">
          <Button 
            variant="outline" 
            onClick={() => setLocation("/history")}
            className="text-sm border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
          >
            View All Content
          </Button>
        </div>
      )}
    </div>
  );
}
