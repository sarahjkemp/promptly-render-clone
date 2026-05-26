import { useState, useEffect, useCallback, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUserStore } from "@/lib/user-store";
import { CompanyProfile } from "@shared/schema";
import { getProfileCompleteness, getProfileBadgeVariant, getProfileBadgeText } from "@/lib/profile-utils";

import AppLayout from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, InfoIcon, SaveIcon, Loader2 } from "lucide-react";

// Form schema for profile settings
const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
});

// Form schema for company settings
const companyFormSchema = z.object({
  companyName: z.string().min(2, { message: "Company name must be at least 2 characters." }),
  industry: z.string().optional(),
  industryCustom: z.string().optional(),
  companySize: z.string().optional(),
  tone: z.string().optional(),
  keywords: z.string().optional(),
  targetRegions: z.string().optional(),
});

export default function SettingsPage() {
  // Get user data from our centralized store
  const { user } = useUserStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  const [showCustomIndustry, setShowCustomIndustry] = useState(false);
  
  // Fetch current company profile data
  const { 
    data: companyProfile, 
    isLoading: isLoadingCompany,
    refetch: refetchCompany 
  } = useQuery<CompanyProfile>({
    queryKey: ['/api/company-profile'],
    enabled: !!user,
    staleTime: 1000 * 30, // 30 seconds
  });

  // Get profile completeness after companyProfile is available
  const profileCompleteness = useMemo(() => {
    return getProfileCompleteness(companyProfile);
  }, [companyProfile]);
  
  // Initialize custom industry visibility based on current value
  useEffect(() => {
    if (companyProfile) {
      setShowCustomIndustry(companyProfile.industry === "other");
    }
  }, [companyProfile]);

  // Initialize profile form with current values
  const profileForm = useForm({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || user?.username || "",
    },
  });
  
  // Update form values when user data changes
  useEffect(() => {
    if (user) {
      profileForm.setValue('name', user.name || "");
      profileForm.setValue('email', user.email || user.username || "");
    }
  }, [user, profileForm]);

  // Initialize company form with data once it's loaded
  const companyForm = useForm({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      companyName: companyProfile?.name || "",
      industry: companyProfile?.industry || "",
      industryCustom: companyProfile?.industryCustom || "",
      companySize: companyProfile?.companySize || "",
      tone: companyProfile?.tone || "",
      keywords: Array.isArray(companyProfile?.keywords) ? companyProfile.keywords.join(", ") : "",
      targetRegions: Array.isArray(companyProfile?.targetRegions) ? companyProfile.targetRegions.join(", ") : "",
    },
  });
  
  // Update company form values when company profile data changes
  useEffect(() => {
    if (companyProfile) {
      companyForm.setValue('companyName', companyProfile.name || "");
      companyForm.setValue('industry', companyProfile.industry || "");
      companyForm.setValue('industryCustom', companyProfile.industryCustom || "");
      companyForm.setValue('companySize', companyProfile.companySize || "");
      companyForm.setValue('tone', companyProfile.tone || "");
      companyForm.setValue('keywords', Array.isArray(companyProfile.keywords) ? companyProfile.keywords.join(", ") : "");
      companyForm.setValue('targetRegions', Array.isArray(companyProfile.targetRegions) ? companyProfile.targetRegions.join(", ") : "");
    }
  }, [companyProfile, companyForm]);

  // Manual refresh function for both user and company data
  const refreshData = useCallback(() => {
    console.log("Manually refreshing settings data");
    queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    queryClient.invalidateQueries({ queryKey: ['/api/company-profile'] });
  }, [queryClient]);
  
  // Force query refresh on mount
  useEffect(() => {
    refreshData();
    
    // Set up a refresh every minute while the page is open
    const refreshInterval = setInterval(refreshData, 60000);
    return () => clearInterval(refreshInterval);
  }, [refreshData]);

  // We're now handling form updates in the useEffect hooks above

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: z.infer<typeof profileFormSchema>) => {
      // Add logging to see what we're sending
      console.log("Submitting profile update:", profileData);
      
      // Use direct fetch with explicit credentials to ensure session cookie is sent
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error updating user profile:", errorData);
        throw new Error(errorData.message || "Failed to update profile");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
        variant: "success",
      });
      
      // Update both the query cache and our global store
      queryClient.setQueryData(['/api/user'], data);
      useUserStore.getState().setUser(data);
      
      // Force the form to update with new values (important for email changes)
      setTimeout(() => {
        console.log("Updating profile form with new data:", data);
        profileForm.reset({
          name: data.name || "",
          email: data.email || data.username || "",
        });
        // Force refresh of all user data
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      }, 300);
    },
    onError: (error) => {
      toast({
        title: "Failed to update profile",
        description: "There was an error updating your profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Company update mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (companyData: z.infer<typeof companyFormSchema>) => {
      // Enhanced logging to help debug auth issues
      console.log("⏳ Submitting company update - START", companyData);
      
      // Log auth status before making the request
      console.log("🔐 Auth check before company update");
      try {
        const authCheck = await fetch('/api/user', {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (authCheck.ok) {
          const userData = await authCheck.json();
          console.log("✅ Auth check passed - user is authenticated:", userData.username);
        } else {
          console.warn("⚠️ Auth check failed - not authenticated before company update");
        }
      } catch (error) {
        console.error("❌ Error during auth check before company update:", error);
      }
      
      // Process arrays from comma-separated strings but keep as strings on client-side
      // Let the server handle the array conversion to prevent processing twice
      const processedData = {
        ...companyData,
        // Send as strings, let server handle array conversion
        keywords: companyData.keywords?.trim() || "",
        targetRegions: companyData.targetRegions?.trim() || "",
      };
      
      console.log("📤 Sending company data:", processedData);
      
      // Enhanced request options for debugging
      const requestOptions = {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest' // Helps identify AJAX requests
        },
        body: JSON.stringify(processedData),
        credentials: 'include' as RequestCredentials
      };
      
      console.log("🚀 Sending request to /api/company-profile with options:", {
        method: requestOptions.method,
        headers: requestOptions.headers,
        credentials: requestOptions.credentials
      });
      
      // Use direct fetch with explicit credentials to ensure session cookie is sent
      const response = await fetch('/api/company-profile', requestOptions);
      
      console.log("📩 Received response:", {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Error updating company profile:", errorData);
        
        // Check authentication status after failure
        try {
          const postAuthCheck = await fetch('/api/user', { credentials: 'include' });
          if (postAuthCheck.ok) {
            console.log("🤔 User still authenticated after failed request");
          } else {
            console.warn("⚠️ User not authenticated after failed request - session may have been lost");
          }
        } catch (e) {
          console.error("❌ Error checking auth after failure:", e);
        }
        
        throw new Error(errorData.message || "Failed to update company settings");
      }
      
      const data = await response.json();
      console.log("✅ Company update successful - response:", data);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Company settings updated",
        description: "Your company settings have been updated successfully.",
        variant: "success",
      });
      
      // Update query cache
      queryClient.setQueryData(['/api/company-profile'], data);
      
      // Set timeout to ensure UI is updated after data changes
      setTimeout(() => {
        console.log("Refreshing company data after update");
        // Invalidate all company profile data
        queryClient.invalidateQueries({ queryKey: ['/api/company-profile'] });
        // Also invalidate user data as it might include company info
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        // Explicitly trigger a refetch
        refetchCompany();
        // Also ensure our user store is updated with the latest user data including company profile
        fetch('/api/user', { credentials: 'include' })
          .then(res => res.json())
          .then(userData => {
            useUserStore.getState().setUser(userData);
          })
          .catch(err => console.error('Failed to update user store after company update:', err));
      }, 500);
    },
    onError: (error) => {
      toast({
        title: "Failed to update company settings",
        description: "There was an error updating your company settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Profile form submission handler
  const onProfileSubmit = (values: z.infer<typeof profileFormSchema>) => {
    console.log("Profile form submitted with values:", values);
    updateProfileMutation.mutate(values);
  };

  // Company form submission handler
  const onCompanySubmit = (values: z.infer<typeof companyFormSchema>) => {
    console.log("Company form submitted with values:", values);
    updateCompanyMutation.mutate(values);
  };

  return (
    <AppLayout title="Settings">
      <div className="mb-8 max-w-3xl">
        <h1 className="text-2xl font-semibold text-gray-900">Account Settings</h1>
        <p className="text-gray-600 mt-2 text-sm">
          Don't forget to add company information. It will be used to generate the right angles for your PR ready content!
        </p>
      </div>

      <div className="max-w-4xl space-y-8">
        <Tabs defaultValue="profile" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-12 bg-muted rounded-lg p-1">
            <TabsTrigger value="profile" className="flex items-center justify-center text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <span className="hidden sm:inline">Personal Profile</span>
              <span className="sm:hidden">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="company" className="flex items-center justify-center text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <span className="hidden sm:inline">Company Profile</span>
              <span className="sm:hidden">Company</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card className="border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Personal Information</CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  Update your personal information and account settings
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                    <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your name" className="bg-background" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="your@email.com" className="bg-white" {...field} />
                          </FormControl>
                          <FormDescription>
                            This email is used for account login
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-start mt-6">
                      <Button
                        type="submit"
                        className="flex items-center gap-2"
                        disabled={updateProfileMutation.isPending}
                      >
                        {updateProfileMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <SaveIcon className="h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Account Preferences</CardTitle>
                <CardDescription>
                  Manage your notification and display settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between py-2">
                  <div className="flex flex-col">
                    <h3 className="text-sm font-medium">Email Notifications</h3>
                    <p className="text-xs text-gray-500">Receive emails about your activity</p>
                  </div>
                  <Switch disabled />
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between py-2">
                  <div className="flex flex-col">
                    <h3 className="text-sm font-medium">Marketing Emails</h3>
                    <p className="text-xs text-gray-500">Receive emails about new features</p>
                  </div>
                  <Switch disabled />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Company Profile</CardTitle>
                    <CardDescription>
                      Update your company information
                    </CardDescription>
                  </div>
                  <Badge variant={getProfileBadgeVariant(profileCompleteness)}>
                    {getProfileBadgeText(profileCompleteness)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingCompany ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <Form {...companyForm}>
                    <form onSubmit={companyForm.handleSubmit(onCompanySubmit)} className="space-y-6">
                      <FormField
                        control={companyForm.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Acme PR Agency" className="bg-white" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={companyForm.control}
                          name="industry"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Industry</FormLabel>
                              <Select 
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  setShowCustomIndustry(value === "other");
                                  if (value !== "other") {
                                    companyForm.setValue("industryCustom", "");
                                  }
                                }} 
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select industry" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="pr_agency">PR Agency</SelectItem>
                                  <SelectItem value="tech">Technology</SelectItem>
                                  <SelectItem value="healthcare">Healthcare</SelectItem>
                                  <SelectItem value="finance">Financial Services</SelectItem>
                                  <SelectItem value="education">Education</SelectItem>
                                  <SelectItem value="retail">Retail</SelectItem>
                                  <SelectItem value="other">Other - please specify</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Custom Industry Input */}
                        {showCustomIndustry && (
                          <FormField
                            control={companyForm.control}
                            name="industryCustom"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Custom Industry</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Enter your industry (e.g., EdTech, GovTech, PropTech)"
                                    className="bg-white"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Specify your industry to help us tailor content recommendations
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        
                        <FormField
                          control={companyForm.control}
                          name="companySize"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Size</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select size" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="1-10">1-10 employees</SelectItem>
                                  <SelectItem value="11-50">11-50 employees</SelectItem>
                                  <SelectItem value="51-200">51-200 employees</SelectItem>
                                  <SelectItem value="201-500">201-500 employees</SelectItem>
                                  <SelectItem value="500+">500+ employees</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={companyForm.control}
                        name="tone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Brand Tone</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select tone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="professional">Professional</SelectItem>
                                <SelectItem value="casual">Casual</SelectItem>
                                <SelectItem value="formal">Formal</SelectItem>
                                <SelectItem value="technical">Technical</SelectItem>
                                <SelectItem value="friendly">Friendly</SelectItem>
                                <SelectItem value="authoritative">Authoritative</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              This helps tailor generated content to match your brand voice
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={companyForm.control}
                        name="keywords"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Brand Keywords</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="innovation, sustainability, quality"
                                className="bg-white"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Separate keywords with commas
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={companyForm.control}
                        name="targetRegions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target Regions</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="North America, Europe, Asia"
                                className="bg-white"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Separate regions with commas
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex justify-start mt-6">
                        <Button
                          type="submit"
                          className="flex items-center gap-2"
                          disabled={updateCompanyMutation.isPending}
                        >
                          {updateCompanyMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <SaveIcon className="h-4 w-4" />
                              Save Company Profile
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>

          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}