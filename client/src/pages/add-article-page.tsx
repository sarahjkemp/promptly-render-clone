import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CompanyProfile } from "@shared/schema";
import { useUserStore } from "@/lib/user-store";
import { getProfileCompleteness, getProfileBadgeVariant, getProfileBadgeText } from "@/lib/profile-utils";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, CheckCircle2, X, Info, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentUpload } from "@/components/DocumentUpload";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Form validation schema with conditional validation
const createFormSchema = (selectedDocumentIds: number[]) => z.object({
  title: z.string().min(4, {
    message: "Project name must be at least 4 characters.",
  }),
  bodyText: z.string().optional(),
}).refine((data) => {
  // Calculate word count for better validation
  const wordCount = data.bodyText ? data.bodyText.trim().split(/\s+/).filter(word => word.length > 0).length : 0;
  
  // Require either substantial text (100+ words) OR selected documents
  const hasValidText = wordCount >= 100;
  const hasDocuments = selectedDocumentIds.length > 0;
  
  return hasValidText || hasDocuments;
}, {
  message: "Please provide substantial content (minimum 100 words) or select company documents to generate quality PR materials.",
  path: ["bodyText"], // Show error on the bodyText field
});

type FormValues = {
  title: string;
  bodyText?: string;
};

export default function AddArticlePage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useUserStore();
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState("upload");
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    return localStorage.getItem('profileBannerDismissed') === 'true';
  });

  // Default form values
  const defaultValues: FormValues = {
    title: "",
    bodyText: "",
  };

  // Setup form with validation
  const form = useForm<FormValues>({
    resolver: zodResolver(createFormSchema(selectedDocumentIds)),
    defaultValues,
  });

  // Update form validation when document selection changes
  useEffect(() => {
    form.clearErrors(); // Clear any existing validation errors
    // Re-trigger validation to apply new schema
    form.trigger();
  }, [selectedDocumentIds, form]);

  // Fetch company profile
  const { data: companyProfile, isLoading: isLoadingProfile } = useQuery<CompanyProfile>({
    queryKey: ["/api/company-profile"],
    enabled: !!user,
  });
  
  // Get profile completeness
  const profileCompleteness = getProfileCompleteness(companyProfile);

  // Fetch company documents
  const { data: documents = [], isLoading: isLoadingDocuments } = useQuery({
    queryKey: ["/api/companies", companyProfile?.id, "documents"],
    queryFn: async () => {
      if (!companyProfile?.id) return [];
      const response = await fetch(`/api/companies/${companyProfile.id}/documents`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
    enabled: !!companyProfile?.id,
  });

  // Create article mutation
  const createArticleMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Include selected document IDs in the request
      const requestBody = {
        ...values,
        selectedDocumentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined
      };
      
      // Use direct fetch with explicit credentials to ensure session cookie is sent
      const response = await fetch('/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error creating article:", errorData);
        throw new Error(errorData.message || "Failed to create article");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      toast({
        title: "Content submitted successfully",
        description: "Redirecting to results page...",
      });
      
      // Redirect to results page
      setLocation(`/results/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit content",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Document selection handlers
  const handleDocumentToggle = (documentId: number, checked: boolean) => {
    if (checked) {
      setSelectedDocumentIds(prev => [...prev, documentId]);
    } else {
      setSelectedDocumentIds(prev => prev.filter(id => id !== documentId));
    }
  };

  // Banner dismiss handler
  const handleBannerDismiss = () => {
    setBannerDismissed(true);
    localStorage.setItem('profileBannerDismissed', 'true');
  };

  // Handle successful document upload
  const handleUploadSuccess = () => {
    setActiveTab("manual");
    toast({
      title: "Document uploaded successfully",
      description: "You can now add your content manually or select uploaded company documents below.",
    });
  };

  // Check if industry is required and available for content generation
  const canSubmit = useMemo(() => {
    const hasValidIndustry = companyProfile?.industry?.trim() || companyProfile?.industryCustom?.trim();
    const formIsValid = form.formState.isValid;
    return hasValidIndustry && formIsValid && !createArticleMutation.isPending;
  }, [companyProfile, form.formState.isValid, createArticleMutation.isPending]);

  // Form submission handler
  function onSubmit(values: FormValues) {
    createArticleMutation.mutate(values);
  }

  return (
    <AppLayout title="Add Content">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Add Content</h1>
        <p className="text-gray-600 mt-2 text-sm">
          Upload documents or paste your text to transform it into PR-ready content
        </p>
      </div>

      {/* Profile Completeness Bar */}
      {companyProfile && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Profile Completeness</span>
            <span>{profileCompleteness.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
            <div 
              className="bg-[#4F39F6] h-2 rounded-full transition-all duration-300" 
              style={{ width: `${profileCompleteness.percentage}%` }}
            />
          </div>
          {profileCompleteness.percentage < 100 && (
            <p className="text-xs text-gray-500">
              Complete your profile for better content generation: {profileCompleteness.missingFields.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Industry Required Alert */}
      {companyProfile && !canSubmit && form.formState.isValid && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Industry information is required for content generation.{' '}
            <Button 
              variant="link" 
              className="p-0 h-auto text-[#4F39F6] hover:text-[#3D2BC4]" 
              onClick={() => setLocation('/settings')}
            >
              Update your profile
            </Button>
          </AlertDescription>
        </Alert>
      )}

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

      <div className="bg-card rounded-md border border-border shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-border px-4 sm:px-6 py-4">
            <TabsList className="grid w-full grid-cols-2 lg:w-96">
              <TabsTrigger 
                value="upload" 
                className="flex items-center justify-center text-sm"
                title="Upload a .pdf or .docx file to generate content"
              >
                <span className="hidden sm:inline">Document Upload</span>
                <span className="sm:hidden">Upload</span>
              </TabsTrigger>
              <TabsTrigger 
                value="manual" 
                className="flex items-center justify-center text-sm"
                title="Paste or type your content directly"
              >
                <span className="hidden sm:inline">Paste Text</span>
                <span className="sm:hidden">Paste</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="upload" className="p-4 sm:p-6">
            {companyProfile && (
              <DocumentUpload 
                companyId={companyProfile.id} 
                onUploadComplete={handleUploadSuccess}
              />
            )}
          </TabsContent>

          <TabsContent value="manual" className="p-4 sm:p-6 space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter a name for this project (e.g., 'Q4 Hybrid Work Study')" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Content text area */}
                <FormField
                  control={form.control}
                  name="bodyText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Text (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Paste your text here (articles, white papers, blog posts, etc.)..." 
                          className="min-h-[300px] p-4 resize-y"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        {(() => {
                          const currentText = form.watch("bodyText") || "";
                          const wordCount = currentText.trim().split(/\s+/).filter(word => word.length > 0).length;
                          const hasText = currentText.trim().length > 0;
                          const hasDocuments = selectedDocumentIds.length > 0;
                          
                          if (hasDocuments && hasText) {
                            return `${wordCount} words - Using your text as main content with documents as supporting context.`;
                          } else if (hasDocuments) {
                            return "Documents selected - you can leave text blank or add additional context.";
                          } else if (hasText) {
                            return `${wordCount} words - ${wordCount >= 100 ? 'Ready for quality content generation' : `Need ${100 - wordCount} more words for substantial content`}`;
                          } else {
                            return "Enter substantial content (100+ words) or select company documents for quality PR materials.";
                          }
                        })()}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Document Selection */}
                {documents.length > 0 && (
                  <div className="bg-muted/50 p-4 rounded-md space-y-3 border border-border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-medium text-foreground">Include Company Documents</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Select documents to include as context for more brand-aligned content generation.
                    </p>
                    
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {documents.map((doc: any) => (
                        <div 
                          key={doc.id} 
                          className="flex items-start gap-3 p-3 bg-background rounded border border-border hover:border-primary/20 transition-colors"
                        >
                          <Checkbox
                            id={`doc-${doc.id}`}
                            checked={selectedDocumentIds.includes(doc.id)}
                            onCheckedChange={(checked) => handleDocumentToggle(doc.id, !!checked)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <label 
                              htmlFor={`doc-${doc.id}`}
                              className="text-sm font-medium text-foreground cursor-pointer block"
                            >
                              {doc.title}
                            </label>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {doc.summary || 'No summary available'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {selectedDocumentIds.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-foreground bg-muted p-2 rounded">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{selectedDocumentIds.length} document{selectedDocumentIds.length !== 1 ? 's' : ''} selected for context</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Company profile options - displayed as info */}
                {companyProfile && (
                  <div className="bg-muted/50 p-4 rounded-md space-y-2 border border-border">
                    <h3 className="font-medium text-foreground">Company Profile Settings</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {companyProfile.tone && (
                        <div>
                          <p className="text-sm text-muted-foreground">Brand Tone</p>
                          <p className="text-base text-foreground">{companyProfile.tone}</p>
                        </div>
                      )}
                      
                      {companyProfile.keywords && companyProfile.keywords.length > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground">Brand Keywords</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {companyProfile.keywords.map((keyword, i) => (
                              <span key={i} className="bg-muted text-foreground px-2 py-1 rounded text-sm">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {(companyProfile.industry || companyProfile.industryCustom) && (
                        <div>
                          <p className="text-sm text-muted-foreground">Industry</p>
                          <p className="text-base text-foreground">{companyProfile.industryCustom || companyProfile.industry}</p>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground italic">
                      These settings will be used to generate content that matches your brand's voice.
                    </p>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full md:w-auto" 
                  disabled={!canSubmit}
                >
                  {createArticleMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate"
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}