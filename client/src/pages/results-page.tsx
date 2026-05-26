import * as React from "react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// Import types from shared schema
import { Article, HistoryRecord, CompanyProfile } from "@shared/schema";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ErrorMessage } from "@/components/ui/error-message";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, AlertCircle, Copy, RefreshCw, LayoutGrid, List, Info, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getCacheOptions, cacheConfig } from "@/lib/cacheConfig";
import { getFriendlyErrorMessage, trackApiError, resetErrorTracking } from "@/lib/errorTracker";
import MediaTargetsTab from "@/components/media-targets-tab";
import ResultsAccordion from "@/components/results-accordion";
import { useUserStore } from "@/lib/user-store";
import { getProfileCompleteness, getProfileBadgeVariant, getProfileBadgeText } from "@/lib/profile-utils";
import { Badge } from "@/components/ui/badge";
import { ArticleStatusBadge } from "@/components/ui/article-status-badge";
import { useStream } from "@/lib/useStream";
import { StreamingProgress, StreamingProgressCompact } from "@/components/ui/streaming-progress";

// Type definitions to ensure proper typing throughout component
interface PRContent {
  summary: string | null;
  angles: Array<{ headline: string; paragraph: string }> | null;
  outline: string[] | null;
  article: { title: string; content: string } | null;
  email: { subject: string; body: string } | null;
  publishingPack?: string | null;
}

// Type guard to check if processing status is done
function isProcessingDone(status: HistoryRecord | undefined): boolean {
  return status !== undefined && status.status === "done";
}

// Type guard to check if processing status is in error state
function isProcessingError(status: HistoryRecord | undefined): boolean {
  return status !== undefined && status.status === "error";
}

// Type guard to check if processing is in progress
function isProcessingActive(status: HistoryRecord | undefined): boolean {
  return status !== undefined && (status.status === "pending" || status.status === "processing");
}

export default function ResultsPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'tabs' | 'accordion'>('accordion');
  const { user } = useUserStore();
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    return localStorage.getItem('profileBannerDismissed') === 'true';
  });
  
  // Use Wouter's route parameters instead of manually parsing the URL
  // This properly works with the /results/:articleId route format
  const [, params] = useLocation();
  
  // Get article ID from URL path parameter
  const [articleId, setArticleId] = useState<string | null>(() => {
    // Extract the article ID from the path
    const pathSegments = window.location.pathname.split('/');
    const id = pathSegments.length >= 3 ? pathSegments[2] : null;
    console.log("Initial articleId from URL:", id);
    return id;
  });
  
  // Update articleId when URL changes with improved logging
  useEffect(() => {
    // Extract the article ID from the path
    const pathSegments = window.location.pathname.split('/');
    const newArticleId = pathSegments.length >= 3 ? pathSegments[2] : null;
    console.log("URL changed, new articleId:", newArticleId, "current:", articleId);
    
    if (newArticleId !== articleId) {
      console.log("Updating articleId state to:", newArticleId);
      setArticleId(newArticleId);
      
      // Clear any error toast messages when changing content
      toast({
        title: "Loading content",
        description: "Retrieving content information...",
      });
    }
  }, [articleId, toast]);
  
  // Polling interval in milliseconds
  const POLL_INTERVAL = 3000;

  // Fetch company profile for banner
  const { data: companyProfile } = useQuery<CompanyProfile>({
    queryKey: ["/api/company-profile"],
    enabled: !!user,
  });
  
  // Get profile completeness
  const profileCompleteness = getProfileCompleteness(companyProfile);

  // Banner dismiss handler
  const handleBannerDismiss = () => {
    setBannerDismissed(true);
    localStorage.setItem('profileBannerDismissed', 'true');
  };
  
  // Fetch article data with centralized cache configuration and explicit fetch function
  const { 
    data: article, 
    isLoading: isLoadingArticle, 
    error: articleError,
    refetch: refetchArticle
  } = useQuery<Article>({
    queryKey: cacheConfig.queryKeys.article(articleId || ''),
    queryFn: async () => {
      const response = await fetch(`/api/articles/${articleId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch article: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("Fetched article data:", { id: data.id, title: data.title, bodyTextLength: data.bodyText?.length || 0 });
      return data;
    },
    enabled: !!articleId,
    retry: 3,
    staleTime: cacheConfig.staleTimes.article,
    refetchInterval: false
  });
  
  // Log article data and errors
  useEffect(() => {
    if (article) {
      console.log("Article data loaded:", {
        id: article.id,
        title: article.title,
        hasContent: !!article.bodyText,
        bodyTextLength: article.bodyText?.length || 0
      });
    } else if (articleError) {
      console.error("Failed to load article data:", articleError);
      toast({
        title: "Error Loading Article",
        description: articleError instanceof Error 
          ? articleError.message 
          : "Could not load article data. Please try again.",
        variant: "destructive"
      });
    }
  }, [article, articleError, toast]);
  
  // Fetch processing status with polling using centralized config
  const { 
    data: processingStatus, 
    isLoading: isLoadingStatus,
    error: statusError,
    refetch: refetchStatus
  } = useQuery<HistoryRecord>({
    queryKey: [`/api/articles/${articleId}/status`],
    enabled: !!articleId,
    staleTime: cacheConfig.staleTimes.articleStatus,
    // Use standard polling interval - adaptive polling would require a type cast
    refetchInterval: cacheConfig.refetchIntervals.articleStatus as number,
    retry: 3
  });
  
  // Enhanced debug logging for processing status
  useEffect(() => {
    if (processingStatus) {
      console.log("Processing status:", processingStatus.status);
      // If status is done, log that we're going to fetch content
      if (processingStatus.status === "done") {
        console.log("Status is done, fetching content");
      }
    } else {
      console.log("No processing status available yet");
    }
  }, [processingStatus]);
  
  // Handle status fetch error with tracking and automatic retry
  useEffect(() => {
    if (statusError) {
      console.error("Error fetching article status:", statusError);
      
      // Check for specific error types
      const errorMsg = statusError instanceof Error ? statusError.message : String(statusError);
      const isRateLimit = errorMsg.includes('rate limit') || errorMsg.toLowerCase().includes('429');
      const isOpenAIError = errorMsg.includes('openai') || errorMsg.includes('OpenAI');
      
      // Track API error to determine if we should show user notification
      const endpoint = `article-status-${articleId}`;
      if (trackApiError(endpoint)) {
        toast({
          title: isRateLimit ? "Service Busy" : "Processing Status Issue",
          description: getFriendlyErrorMessage(statusError),
          variant: "destructive",
          duration: 5000,
          action: (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                refetchStatus();
                toast({
                  title: "Retrying",
                  description: "Checking article status again...",
                  duration: 2000
                });
              }}
            >
              Retry Now
            </Button>
          )
        });
        
        // Set up automatic retry after 3 seconds
        const retryTimeout = setTimeout(() => {
          console.log("Automatically retrying status check...");
          refetchStatus();
        }, 3000);
        
        return () => clearTimeout(retryTimeout);
      }
    } else if (processingStatus) {
      // Reset error tracking when successful
      resetErrorTracking(`article-status-${articleId}`);
    }
  }, [statusError, processingStatus, articleId, toast, refetchStatus]);
  
  // Fetch PR content with centralized caching configuration
  const { 
    data: prContent, 
    isLoading: isLoadingContent,
    refetch: refetchContent,
    error: contentError,
    isRefetching: isRefetchingContent
  } = useQuery<PRContent>({
    queryKey: [`/api/articles/${articleId}/content`],
    enabled: !!articleId && isProcessingDone(processingStatus),
    staleTime: cacheConfig.staleTimes.articleContent,
    refetchInterval: false,
    retry: 3
  });
  
  // Handle content error with automatic retry and improved user messaging
  useEffect(() => {
    if (contentError) {
      console.error("Failed to load PR content:", contentError);
      
      // Check for specific error types
      const errorMsg = contentError instanceof Error ? contentError.message : String(contentError);
      const isRateLimit = errorMsg.includes('rate limit') || errorMsg.toLowerCase().includes('429');
      const isOpenAIError = errorMsg.includes('openai') || errorMsg.includes('OpenAI');
      
      toast({
        title: isRateLimit ? "Service Busy" : "Content Loading Issue",
        description: getFriendlyErrorMessage(contentError),
        variant: "destructive",
        duration: 5000
      });
      
      // Set up an automatic retry after 3 seconds
      const retryTimeout = setTimeout(() => {
        console.log("Automatically retrying content load...");
        toast({
          title: "Retrying",
          description: "Attempting to load your content again...",
          duration: 2000
        });
        refetchContent();
      }, 3000);
      
      return () => clearTimeout(retryTimeout);
    }
  }, [contentError, refetchContent, toast]);
  
  // Enhanced debug logging for PR content
  useEffect(() => {
    if (prContent) {
      console.log("PR content received:", {
        hasSummary: !!prContent.summary,
        hasAngles: !!prContent.angles,
        hasOutline: !!prContent.outline,
        hasEmail: !!prContent.email
      });
      
      // Log detailed content for debugging
      console.log("Summary content:", prContent.summary);
      console.log("Angles content:", prContent.angles);
      console.log("Outline content:", prContent.outline);
      console.log("Email content:", prContent.email);
    } else {
      console.log("No PR content available yet");
    }
  }, [prContent]);
  
  // Handle content fetch error with tracking
  useEffect(() => {
    if (contentError) {
      console.error("Error fetching article content:", contentError);
      
      // Track API error to determine if we should show user notification
      const endpoint = `article-content-${articleId}`;
      if (trackApiError(endpoint)) {
        toast({
          title: "Error loading content",
          description: getFriendlyErrorMessage(contentError),
          variant: "destructive",
          action: (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                refetchContent();
                toast({
                  title: "Retrying",
                  description: "Attempting to load content again..."
                });
              }}
            >
              Retry
            </Button>
          )
        });
      }
    } else if (prContent) {
      // Reset error tracking when successful
      resetErrorTracking(`article-content-${articleId}`);
    }
  }, [contentError, prContent, articleId, refetchContent, toast]);
  
  // Effect for triggering refetch when status changes
  useEffect(() => {
    if (processingStatus?.status === "done") {
      console.log("Status is done, fetching content");
      refetchContent();
    }
  }, [processingStatus?.status, refetchContent]);
  
  // CRITICAL: Initialize streaming hook BEFORE any early returns to maintain hook order
  const isStreamingEnabled = import.meta.env.VITE_STREAMING_UI === 'true';
  const streamingData = useStream(
    processingStatus?.id || 0, 
    isStreamingEnabled && isProcessingActive(processingStatus)
  );

  // Function for retrying processing if there was an error
  // Create mutation for reprocessing articles with proper error handling and auto-retry for rate limits
  const reprocessMutation = useMutation({
    mutationFn: async () => {
      if (!processingStatus?.id) {
        throw new Error("Cannot reprocess: No history record found");
      }
      
      try {
        // Use direct fetch with explicit credentials to ensure session cookie is sent
        const response = await fetch(`/api/article-history/${processingStatus.id}/reprocess`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error("Error reprocessing article:", errorData);
          throw new Error(errorData.message || "Failed to reprocess article");
        }
        
        return response;
      } catch (error: any) {
        // Auto-retry logic for rate limit errors
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
          
          // Try one more time with direct fetch
          const retryResponse = await fetch(`/api/article-history/${processingStatus.id}/reprocess`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include'
          });
          
          if (!retryResponse.ok) {
            const errorData = await retryResponse.json();
            throw new Error(errorData.message || "Failed to reprocess article");
          }
          
          return retryResponse;
        }
        
        // For other errors, just propagate them
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/article-history', articleId, 'status'] });
      toast({
        title: "Reprocessing started",
        description: "Your content is being reprocessed. You'll see results shortly."
      });
    },
    onError: (error) => {
      console.error("Error reprocessing article:", error);
      toast({
        title: "Reprocessing failed",
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    }
  });

  // Enhanced retry handler using the mutation
  const handleRetry = async () => {
    if (!articleId) return;
    
    if (processingStatus?.id) {
      // If we have a history record, use the proper reprocess endpoint
      reprocessMutation.mutate();
    } else {
      // Fallback to creating a new article if no history record is found
      try {
        toast({
          title: "Retrying article processing...",
          description: "Please wait while we try again."
        });
        
        // Create a new article as a fallback method
        await apiRequest("POST", "/api/articles", {
          title: article?.title || "Retry Processing",
          bodyText: article?.bodyText || ""
        });
        
        // Refetch the status
        refetchStatus();
        
        toast({
          title: "Processing restarted",
          description: "Your article is being processed again."
        });
      } catch (error: any) {
        toast({
          title: "Error restarting processing",
          description: getFriendlyErrorMessage(error),
          variant: "destructive"
        });
      }
    }
  };

  // Function to render the loading state for content
  const renderContentLoading = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-[#4F39F6] mb-4" />
      <h3 className="text-lg font-medium text-center">Almost there—your content is being generated</h3>
      <p className="text-gray-600 text-sm text-center mt-2">
        We're working on transforming your content into PR-ready materials
      </p>
    </div>
  );

  // Function to render error state for content sections using standardized error component
  const renderContentError = (section: string, retryFn: () => void, isRetrying: boolean = false) => (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-gray-700 mb-2">
        Unable to load {section}
      </h3>
      <ErrorMessage
        message="This section couldn't be retrieved. The content may still be processing."

        variant="block"
        size="md"
      />
    </div>
  );

  // Handle loading states
  if (isLoadingArticle) {
    return (
      <AppLayout title="Content Results">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-[#4F39F6] mb-4" />
          <h2 className="text-xl font-medium">Loading content details...</h2>
        </div>
      </AppLayout>
    );
  }

  // Handle error states with more helpful information
  if (articleError || !articleId) {
    return (
      <AppLayout title="Error">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-medium text-red-700 mb-2">Error Loading Results</h2>
          <p className="text-red-600 mb-4">
            {articleError 
              ? getFriendlyErrorMessage(articleError) 
              : "No article ID provided. Please select an article from the dashboard."
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <Button 
              variant="outline" 
              onClick={() => {
                if (articleId) {
                  refetchArticle();
                  toast({
                    title: "Retrying",
                    description: "Attempting to load the article again..."
                  });
                }
              }}
              disabled={!articleId}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Try Again
            </Button>
            <Button onClick={() => setLocation("/")}>
              Return to Dashboard
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Determine if content is ready to display using type guards
  const isContentReady = isProcessingDone(processingStatus) && prContent;
  
  // Determine processing states using type guards
  const hasProcessingError = isProcessingError(processingStatus);
  const isInProgress = isProcessingActive(processingStatus);

  // Render content
  return (
    <AppLayout title={article?.title || "Content Results"}>
      {/* Persistent back button */}
      <div className="mb-6">
        <Button
          variant="ghost"
          className="pl-0 flex items-center text-gray-600"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
      <div className="mb-5 max-w-3xl">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{article?.title || "Processing Content"}</h1>
            <p className="text-gray-700 mt-1 text-sm">
              View the processed PR ready content from your content
            </p>
            <div className="h-1 w-12 mt-2 rounded-full bg-[#111827]"></div>
          </div>
          {/* Status badge with retry functionality */}
          {processingStatus && (
            <ArticleStatusBadge 
              status={processingStatus.status}
              errorMessage={processingStatus.errorMessage}
              onClick={processingStatus.status === 'error' ? handleRetry : undefined}
              className="ml-4"
            />
          )}
        </div>
      </div>
      {/* View Mode Toggle */}
      <div className="mb-6 flex justify-end">
        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('tabs')}
            className={viewMode === 'tabs' 
              ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm' 
              : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Tabs
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('accordion')}
            className={viewMode === 'accordion' 
              ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm' 
              : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'}
          >
            <List className="h-4 w-4 mr-1" />
            Flow
          </Button>
        </div>
      </div>

      {/* Profile Transparency Banner */}
      {companyProfile && !bannerDismissed && (
        <Alert variant="info" className="mb-6 profile-banner">
          <Info className="h-4 w-4" />
          <AlertDescription className="profile-banner-content">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
              <div className="flex items-center gap-3">
                <span className="text-gray-700">
                  <span className="font-medium">Using your saved profile:</span>{' '}
                  {[
                    companyProfile.tone && `${companyProfile.tone}`,
                    (companyProfile.industryCustom || companyProfile.industry) && `${companyProfile.industryCustom || companyProfile.industry}`,
                    companyProfile.targetRegions && companyProfile.targetRegions.length > 0 && companyProfile.targetRegions.join(', '),
                    companyProfile.keywords && companyProfile.keywords.length > 0 && companyProfile.keywords.slice(0, 3).join(', ') + (companyProfile.keywords.length > 3 ? '...' : '')
                  ].filter(Boolean).join(' • ')}
                </span>
                <Badge variant={getProfileBadgeVariant(profileCompleteness)} className="text-xs">
                  {getProfileBadgeText(profileCompleteness)}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBannerDismiss}
                className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 p-1 h-auto mobile-touch-target profile-banner-dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      {article && (
        <div className="container mx-auto max-w-5xl">
          {/* Generated content with tabs */}
          <div className="w-full">
            {/* Processing Status with enhanced UX and streaming support */}
            {isInProgress && (
              <div className="bg-white rounded-md shadow-sm" data-testid="processing-status">
                {isStreamingEnabled ? (
                  <StreamingProgress
                    isConnected={streamingData.isConnected}
                    connectionError={streamingData.connectionError}
                    queueStatus={streamingData.queueStatus}
                    processingStatus={streamingData.processingStatus}
                    completedCount={streamingData.completedCount}
                    totalExpected={5}
                    hasErrors={streamingData.hasErrors}
                    isPollingFallback={streamingData.isPollingFallback}
                    onReconnect={streamingData.reconnect}
                    onCheckStatus={streamingData.checkStatus}
                    className="m-0"
                  />
                ) : (
                  <div className="p-6">
                    <h2 className="text-lg font-medium mb-4">Processing Status</h2>
                    <div className="flex items-center space-x-4 p-4 bg-[#F4F4F5] rounded-md border border-[#E4E4E7]">
                      <Loader2 className="h-8 w-8 animate-spin text-[#171717]" />
                      <div>
                        <h3 className="font-medium">Our Agent is Searching</h3>
                        <p className="text-gray-600 text-sm">
                          Grab a cuppa while we prepare your content. This may take a few minutes.
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-4">
                      Creating personalized summaries, press angles, email drafts, and more based on your company profile. 
                      Feel free to stay on this page or return later.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Simple error state - retry handled by badge only */}
            {hasProcessingError && (
              <div className="bg-white rounded-md shadow-sm p-6" data-testid="processing-error">
                <div className="text-center py-8">
                  <h2 className="text-lg font-medium mb-2">Ready to try again</h2>
                  <p className="text-gray-600 mb-4">
                    Use the "Try again" option above to restart content generation.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setLocation('/')}
                    className="border-gray-200"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
                  </Button>
                </div>
              </div>
            )}
            
            {/* Content Interface - Conditional Rendering */}
            {isContentReady && (
              <div>
                {viewMode === 'accordion' ? (
                  <ResultsAccordion
                    prContent={prContent ? { ...prContent, publishingPack: prContent.publishingPack ?? null } : null}
                    article={article}
                    articleId={articleId}
                    contentError={contentError}
                    isRefetchingContent={isRefetchingContent}
                    refetchContent={refetchContent}
                  />
                ) : (
                  <div className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow duration-200">
                    <Tabs defaultValue="summary" className="w-full">
                      <div className="px-6 py-4 border-b bg-gray-50/50">
                        <TabsList className="grid grid-cols-7 w-full h-12 bg-gray-100 rounded-lg p-1 max-w-full overflow-x-auto">
                          <TabsTrigger value="original" className="text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">Original</TabsTrigger>
                          <TabsTrigger value="summary" className="text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">Summary</TabsTrigger>
                          <TabsTrigger value="angles" className="text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">Angles</TabsTrigger>
                          <TabsTrigger value="outline" className="text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">Outline</TabsTrigger>
                          <TabsTrigger value="article" className="text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">Post</TabsTrigger>
                          <TabsTrigger value="email" className="text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">Email</TabsTrigger>
                          <TabsTrigger value="media-targets" className="text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">Media</TabsTrigger>
                        </TabsList>
                      </div>
                  
                  {/* Original Article Tab */}
                  <TabsContent value="original" className="p-6 focus:outline-none">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-medium">Original Article</h2>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[#171717] border-[#171717] hover:bg-[#F4F4F5]"
                        onClick={() => {
                          if (article?.bodyText) {
                            navigator.clipboard.writeText(article.bodyText);
                            toast({ title: "Article copied to clipboard" });
                          }
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" /> Copy
                      </Button>
                    </div>
                    {article?.bodyText ? (
                      <div className="prose max-w-none">
                        <p className="text-gray-700 whitespace-pre-line">{article.bodyText}</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center p-6 bg-gray-50 rounded-md">
                        <Loader2 className="h-6 w-6 text-gray-400 mr-2 animate-spin" />
                        <span className="text-gray-500">Loading article content...</span>
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Summary Tab */}
                  <TabsContent value="summary" className="p-3 sm:p-6 focus:outline-none">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-medium">Summary</h2>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[#171717] border-[#171717] hover:bg-[#F4F4F5]"
                        onClick={() => {
                          if (prContent?.summary) {
                            navigator.clipboard.writeText(prContent.summary);
                            toast({ title: "Summary copied to clipboard" });
                          }
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" /> Copy
                      </Button>
                    </div>
                    
                    {prContent?.summary ? (
                      <div className="prose max-w-none">
                        <p className="text-gray-700 whitespace-pre-line">{prContent.summary}</p>
                      </div>
                    ) : contentError ? (
                      renderContentError("summary", refetchContent, isRefetchingContent)
                    ) : (
                      renderContentLoading()
                    )}
                  </TabsContent>
                  
                  {/* Angles Tab */}
                  <TabsContent value="angles" className="p-3 sm:p-6 focus:outline-none">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-medium">Commentary Angles</h2>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[#171717] border-[#171717] hover:bg-[#F4F4F5]"
                        onClick={() => {
                          if (prContent?.angles && prContent.angles.length > 0) {
                            const text = prContent.angles.map(angle => 
                              `${angle.headline}\n${angle.paragraph}\n`
                            ).join("\n");
                            navigator.clipboard.writeText(text);
                            toast({ title: "Angles copied to clipboard" });
                          }
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" /> Copy
                      </Button>
                    </div>
                    
                    {prContent?.angles && prContent.angles.length > 0 ? (
                      <div className="space-y-4">
                        {prContent.angles.map((angle, index) => (
                          <div key={index} className="p-4 bg-[#FAFAFA] rounded-md border border-[#D4D4D8]">
                            <h3 className="font-medium text-gray-900 mb-2">{angle.headline}</h3>
                            <p className="text-gray-700 whitespace-pre-line">{angle.paragraph}</p>
                          </div>
                        ))}
                      </div>
                    ) : contentError ? (
                      renderContentError("angles", refetchContent, isRefetchingContent)
                    ) : (
                      renderContentLoading()
                    )}
                  </TabsContent>
                  
                  {/* Outline Tab */}
                  <TabsContent value="outline" className="p-3 sm:p-6 focus:outline-none">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-medium">Thought Leadership Outline</h2>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[#171717] border-[#171717] hover:bg-[#F4F4F5]"
                        onClick={() => {
                          if (prContent?.outline) {
                            const text = prContent.outline.join("\n");
                            navigator.clipboard.writeText(text);
                            toast({ title: "Outline copied to clipboard" });
                          }
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" /> Copy
                      </Button>
                    </div>
                    
                    {prContent?.outline && prContent.outline.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-3">
                        {prContent.outline.map((item, index) => (
                          <li key={index} className="text-gray-700">{item}</li>
                        ))}
                      </ul>
                    ) : contentError ? (
                      renderContentError("outline", refetchContent, isRefetchingContent)
                    ) : (
                      renderContentLoading()
                    )}
                  </TabsContent>
                  
                  {/* Article Tab */}
                  <TabsContent value="article" className="p-3 sm:p-6 focus:outline-none">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-medium">Thought Leadership Post</h2>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[#171717] border-[#171717] hover:bg-[#F4F4F5]"
                        onClick={() => {
                          if (prContent?.article) {
                            const text = `${prContent.article.title}\n\n${prContent.article.content}`;
                            navigator.clipboard.writeText(text);
                            toast({ title: "Article copied to clipboard" });
                          }
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" /> Copy
                      </Button>
                    </div>
                    
                    {prContent?.article ? (
                      <div className="space-y-4">
                        <div className="border-b border-gray-200 pb-4">
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">{prContent.article.title}</h3>
                          <span className="text-sm text-gray-500">600-800 word thought leadership article</span>
                        </div>
                        <div className="prose max-w-none">
                          <div className="text-gray-700 whitespace-pre-line leading-relaxed">
                            {prContent.article.content}
                          </div>
                        </div>
                      </div>
                    ) : contentError ? (
                      renderContentError("article", refetchContent, isRefetchingContent)
                    ) : (
                      renderContentLoading()
                    )}
                  </TabsContent>
                  
                  {/* Email Tab */}
                  <TabsContent value="email" className="p-3 sm:p-6 focus:outline-none">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-medium">Pitch Email Draft</h2>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[#171717] border-[#171717] hover:bg-[#F4F4F5]"
                        onClick={() => {
                          if (prContent?.email) {
                            const text = `Subject: ${prContent.email.subject}\n\n${prContent.email.body}`;
                            navigator.clipboard.writeText(text);
                            toast({ title: "Email copied to clipboard" });
                          }
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" /> Copy Email
                      </Button>
                    </div>
                    
                    {prContent?.email ? (
                      <div className="border border-[#D4D4D8] rounded-md bg-[#FAFAFA]">
                        <div className="border-b border-[#D4D4D8] p-4">
                          <span className="text-gray-500 text-sm font-medium mr-2">Subject:</span>
                          <span className="text-gray-900 font-medium">{prContent.email.subject}</span>
                        </div>
                        <div className="p-4">
                          <div className="prose max-w-none">
                            <p className="text-gray-700 whitespace-pre-line">{prContent.email.body}</p>
                          </div>
                        </div>
                      </div>
                    ) : contentError ? (
                      renderContentError("email", refetchContent, isRefetchingContent)
                    ) : (
                      renderContentLoading()
                    )}
                  </TabsContent>
                  
                      {/* Media Targets Tab */}
                      <TabsContent value="media-targets" className="p-6 focus:outline-none">
                        <MediaTargetsTab articleId={articleId} />
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
