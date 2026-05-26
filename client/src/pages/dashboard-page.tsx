 import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUserStore } from "@/lib/user-store";
import AppLayout from "@/components/layout/app-layout";
import QuickActions from "@/components/dashboard/quick-actions";
import RecentArticles from "@/components/dashboard/recent-articles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, Calendar, ExternalLink, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isNewsUIEnabled } from "@/lib/feature-flags";
import { apiRequest } from "@/lib/queryClient";

// Minimal onboarding state for the page to work
type MinimalOnboarding = {
  completed: boolean;
  company?: string;
};

export default function DashboardPage() {
  // Get user data from our global store
  const { user } = useUserStore();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [onboarding, setOnboarding] = useState<MinimalOnboarding>({
    completed: false,
    company: ""
  });

  // Fetch NEWS articles if NEWS UI is enabled
  const { data: newsArticles, isLoading: newsLoading } = useQuery({
    queryKey: ["/api/articles", "news"],
    queryFn: async () => {
      const response = await fetch("/api/articles?fetchType=auto&sourceType=NEWS&limit=10", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch news articles");
      return response.json();
    },
    enabled: isNewsUIEnabled()
  });

  // Commentary generation mutation
  const generateCommentaryMutation = useMutation({
    mutationFn: async (articleId: number) => {
      const response = await apiRequest("POST", `/api/articles/${articleId}/reprocess`);
      return response.json();
    },
    onSuccess: (data, articleId) => {
      toast({
        title: "Commentary generation started",
        description: "Processing your commentary. Redirecting to results...",
      });
      setLocation(`/results/${articleId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate commentary",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Log the user data to help debug name display issues
  useEffect(() => {
    console.log("Dashboard user data:", user);
  }, [user]);
  
  // Use the user's name if available, otherwise fall back to username or company
  const displayName = user?.name?.trim() || 
                     (user?.companyProfile?.name) || 
                     user?.email ||
                     user?.username || 
                     "Guest";

  // Disable onboarding redirect for MVP
  useEffect(() => {
    if (user) {
      console.log("Onboarding redirect disabled for MVP");
      
      // Automatically mark onboarding as completed if needed
      if (user.companyProfile && !user.companyProfile.onboardingCompleted) {
        // Update the onboarding status in the background
        fetch('/api/company-profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ onboardingCompleted: true }),
          credentials: 'include'
        }).then(res => {
          if (res.ok) {
            console.log("Automatically marked onboarding as completed");
          }
        }).catch(err => {
          console.error("Failed to update onboarding status:", err);
        });
      }
    }
  }, [user]);

  return (
    <AppLayout title="Dashboard">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8">
        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Welcome back, {displayName}
          </h1>
          <p className="text-gray-600">
            Ready to turn your proprietary data and assets into PR content? I can help you… PRomptly
          </p>
          <div className="mt-4">
            <a
              href="https://app.synapse.media/auth/login"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Pitch With Synapse!
            </a>
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* NEWS Articles Section - Conditional */}
        {isNewsUIEnabled() && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="h-5 w-5" />
                Latest Industry News
                <Badge variant="secondary" className="ml-auto">
                  {newsArticles?.length || 0} articles
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                Auto-fetched articles ready for commentary generation. Create thought leadership content based on industry news.
              </p>
              
              {newsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse border rounded-lg p-4">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : newsArticles && newsArticles.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {newsArticles.map((article: any) => (
                    <div key={article.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">{article.title}</h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(article.fetchedAt || article.createdAt).toLocaleDateString()}
                            </div>
                            {article.sourceUrl && (
                              <a 
                                href={article.sourceUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Source
                              </a>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => generateCommentaryMutation.mutate(article.id)}
                          disabled={generateCommentaryMutation.isPending}
                          className="flex items-center gap-2 min-w-fit"
                        >
                          <MessageSquare className="h-4 w-4" />
                          {generateCommentaryMutation.isPending ? "Processing..." : "Generate Commentary"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Newspaper className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No news articles available yet.</p>
                  <p className="text-sm">Articles will appear here when the automated news fetch runs.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Articles */}
        <RecentArticles />
      </div>
    </AppLayout>
  );
}
