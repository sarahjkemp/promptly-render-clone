import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, Users, Building2, AlertCircle, ExternalLink, Heart, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Type definitions for media suggestions
interface MediaSuggestionsResponse {
  journalists: Array<{
    name: string;
    publication: string;
    reason: string;
    link?: string;
  }>;
  publications: Array<{
    name: string;
    section: string;
    reason: string;
    link?: string;
  }>;
}

interface MediaTargetsTabProps {
  articleId: string | null;
}

interface SavedRecommendation {
  id: number;
  recommendationType: 'journalist' | 'publication';
  recommendationData: {
    name: string;
    publication?: string;
    section?: string;
    reason: string;
    link?: string;
  };
  isFavourited: boolean;
}

export default function MediaTargetsTab({ articleId }: MediaTargetsTabProps) {
  const { toast } = useToast();
  const [hasTriggered, setHasTriggered] = useState(false);
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);

  // Fetch media suggestions - only enabled when user has triggered the generation
  const { 
    data: mediaSuggestions, 
    isLoading, 
    error,
    refetch,
    isRefetching
  } = useQuery<MediaSuggestionsResponse>({
    queryKey: [`/api/articles/${articleId}/media-suggestions`],
    enabled: !!articleId && hasTriggered,
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch saved recommendations for this article
  const { data: savedRecommendations } = useQuery<SavedRecommendation[]>({
    queryKey: [`/api/recommendations`, articleId],
    queryFn: async () => {
      const response = await fetch(`/api/recommendations?articleId=${articleId}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch saved recommendations");
      return response.json();
    },
    enabled: !!articleId,
  });

  // Save recommendation mutation
  const saveRecommendationMutation = useMutation({
    mutationFn: async ({ recommendationType, recommendationData }: {
      recommendationType: 'journalist' | 'publication';
      recommendationData: any;
    }) => {
      const response = await apiRequest("POST", "/api/recommendations/save", {
        articleId: parseInt(articleId!),
        recommendationType,
        recommendationData,
        isFavourited: true
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/recommendations`, articleId] });
      toast({ title: "Recommendation saved successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save recommendation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Remove recommendation mutation
  const removeRecommendationMutation = useMutation({
    mutationFn: async (recommendationId: number) => {
      const response = await apiRequest("DELETE", `/api/recommendations/${recommendationId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/recommendations`, articleId] });
      toast({ title: "Recommendation removed successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove recommendation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Handle generate suggestions button click
  const handleGenerateSuggestions = () => {
    setHasTriggered(true);
    refetch();
  };

  // Handle retry after web search failure
  const handleRetry = () => {
    refetch();
  };

  // Copy individual item to clipboard
  const copyItem = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${type} copied to clipboard` });
  };

  // Check if a recommendation is saved
  const isRecommendationSaved = (type: 'journalist' | 'publication', data: any) => {
    return savedRecommendations?.some(rec => 
      rec.recommendationType === type &&
      rec.recommendationData.name === data.name &&
      (type === 'journalist' ? rec.recommendationData.publication === data.publication : rec.recommendationData.section === data.section)
    );
  };

  // Get saved recommendation ID
  const getSavedRecommendationId = (type: 'journalist' | 'publication', data: any) => {
    const saved = savedRecommendations?.find(rec => 
      rec.recommendationType === type &&
      rec.recommendationData.name === data.name &&
      (type === 'journalist' ? rec.recommendationData.publication === data.publication : rec.recommendationData.section === data.section)
    );
    return saved?.id;
  };

  // Handle save/unsave recommendation
  const handleSaveRecommendation = (type: 'journalist' | 'publication', data: any) => {
    const isSaved = isRecommendationSaved(type, data);
    
    if (isSaved) {
      const savedId = getSavedRecommendationId(type, data);
      if (savedId) {
        removeRecommendationMutation.mutate(savedId);
      }
    } else {
      saveRecommendationMutation.mutate({
        recommendationType: type,
        recommendationData: data
      });
    }
  };

  // Copy all suggestions to clipboard
  const copyAllSuggestions = () => {
    if (!mediaSuggestions) return;
    
    let text = "MEDIA TARGETS\n\n";
    
    if (mediaSuggestions.journalists.length > 0) {
      text += "JOURNALISTS:\n";
      mediaSuggestions.journalists.forEach((journalist, index) => {
        text += `${index + 1}. ${journalist.name} - ${journalist.publication}\n`;
        text += `   ${journalist.reason}\n\n`;
      });
    }
    
    if (mediaSuggestions.publications.length > 0) {
      text += "PUBLICATIONS:\n";
      mediaSuggestions.publications.forEach((publication, index) => {
        text += `${index + 1}. ${publication.name} (${publication.section})\n`;
        text += `   ${publication.reason}\n\n`;
      });
    }
    
    navigator.clipboard.writeText(text);
    toast({ title: "All suggestions copied to clipboard" });
  };

  // Check if this is a web search failure
  const isWebSearchError = error && 
    (error as any)?.message?.includes('web_search') || 
    (error as any)?.response?.data?.type === 'web_search_failed';

  // Initial state - show generate button
  if (!hasTriggered) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium">Media Targets</h2>
        </div>
        
        <div className="text-center py-8">
          <div className="mb-4">
            <Users className="h-12 w-12 text-gray-700 mx-auto mb-2" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Find Relevant Journalists & Publications
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Generate a curated list of journalists and publications who would be interested in your story, 
              based on current industry coverage and your company themes.
            </p>
          </div>
          
          <Button 
            onClick={handleGenerateSuggestions}
            className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2"
          >
            Generate Media Suggestions
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading || isRefetching) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium">Media Targets</h2>
        </div>
        
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-700 mb-4" />
          <h3 className="text-lg font-medium text-center">Finding relevant media contacts...</h3>
          <p className="text-gray-600 text-sm text-center mt-2">
            Searching for journalists and publications that cover your industry
          </p>
        </div>
      </div>
    );
  }

  // Web search error state
  if (isWebSearchError) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium">Media Targets</h2>
        </div>
        
        <Alert variant="info">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-3">
              <div>
                <strong>Web search temporarily unavailable</strong>
                <p className="mt-1">
                  We're unable to search for current journalist information right now. 
                  This could be due to temporary service limitations.
                </p>
              </div>
              <Button 
                onClick={handleRetry}
                variant="outline"
                size="sm"
                className="text-amber-700 border-amber-300 hover:bg-amber-100"
              >
                Try Again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // General error state
  if (error && !isWebSearchError) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium">Media Targets</h2>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-3">
              <div>
                <strong>Unable to generate suggestions</strong>
                <p className="mt-1">
                  {(error as any)?.message || "An unexpected error occurred. Please try again."}
                </p>
              </div>
              <Button 
                onClick={handleRetry}
                variant="outline"
                size="sm"
              >
                Try Again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Success state - show suggestions
  if (mediaSuggestions) {
    const filteredJournalists = showFavouritesOnly 
      ? mediaSuggestions.journalists.filter(j => isRecommendationSaved('journalist', j))
      : mediaSuggestions.journalists;
    
    const filteredPublications = showFavouritesOnly 
      ? mediaSuggestions.publications.filter(p => isRecommendationSaved('publication', p))
      : mediaSuggestions.publications;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-lg font-medium">Media Targets</h2>
          <div className="flex items-center gap-2">
            <Button
              variant={showFavouritesOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFavouritesOnly(!showFavouritesOnly)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              {showFavouritesOnly ? "Show All" : "Favourites Only"}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-gray-900 border-gray-300 hover:bg-gray-50"
              onClick={copyAllSuggestions}
            >
              <Copy className="h-4 w-4 mr-1" /> Copy All
            </Button>
          </div>
        </div>

        {/* Journalists Section */}
        {mediaSuggestions.journalists.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-gray-700" />
              <h3 className="text-md font-medium">Journalists ({mediaSuggestions.journalists.length})</h3>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
              {mediaSuggestions.journalists.map((journalist, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className="font-medium text-gray-900 truncate">{journalist.name}</h4>
                      <p className="text-sm text-gray-600 font-medium truncate">{journalist.publication}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyItem(
                        `${journalist.name} - ${journalist.publication}\n${journalist.reason}${journalist.link ? `\n${journalist.link}` : ''}`,
                        "Journalist info"
                      )}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 break-words mb-3">{journalist.reason}</p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {journalist.link ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(journalist.link, '_blank', 'noopener,noreferrer')}
                          className="text-xs text-gray-900 border-gray-300 hover:bg-gray-50 flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Explore
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`https://www.google.com/search?q="${journalist.name}"+"%22${journalist.publication}%22"+LinkedIn+profile+author+byline`, '_blank', 'noopener,noreferrer')}
                          className="text-xs text-gray-600 border-gray-200 hover:bg-gray-50 flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Find Contact
                        </Button>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSaveRecommendation('journalist', journalist)}
                      className={`p-1 h-6 w-6 ${isRecommendationSaved('journalist', journalist) ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-red-500'}`}
                      disabled={saveRecommendationMutation.isPending || removeRecommendationMutation.isPending}
                    >
                      <Heart className={`h-3 w-3 ${isRecommendationSaved('journalist', journalist) ? 'fill-current' : ''}`} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Publications Section */}
        {mediaSuggestions.publications.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-gray-700" />
              <h3 className="text-md font-medium">Publications ({mediaSuggestions.publications.length})</h3>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
              {mediaSuggestions.publications.map((publication, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className="font-medium text-gray-900 truncate">{publication.name}</h4>
                      <p className="text-sm text-gray-600 font-medium truncate">{publication.section}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyItem(
                        `${publication.name} (${publication.section})\n${publication.reason}${publication.link ? `\n${publication.link}` : ''}`,
                        "Publication info"
                      )}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 break-words mb-3">{publication.reason}</p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {publication.link ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(publication.link, '_blank', 'noopener,noreferrer')}
                          className="text-xs text-gray-900 border-gray-300 hover:bg-gray-50 flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Explore
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`https://www.google.com/search?q=site:${publication.name.toLowerCase().replace(/\s+/g, '')}.com+"${publication.section}"+editorial+guidelines+tips+submit+contact`, '_blank', 'noopener,noreferrer')}
                          className="text-xs text-gray-600 border-gray-200 hover:bg-gray-50 flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Find Submission
                        </Button>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSaveRecommendation('publication', publication)}
                      className={`p-1 h-6 w-6 ${isRecommendationSaved('publication', publication) ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-red-500'}`}
                      disabled={saveRecommendationMutation.isPending || removeRecommendationMutation.isPending}
                    >
                      <Heart className={`h-3 w-3 ${isRecommendationSaved('publication', publication) ? 'fill-current' : ''}`} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {mediaSuggestions.journalists.length === 0 && mediaSuggestions.publications.length === 0 && (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No suggestions found</h3>
            <p className="text-gray-600 mb-4">
              We couldn't find specific journalists or publications for this article.
            </p>
            <Button 
              onClick={handleRetry}
              variant="outline"
              size="sm"
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    );
  }

  return null;
}