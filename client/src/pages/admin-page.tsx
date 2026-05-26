import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Shield, Users, FileText, Activity, Settings, RotateCcw, CheckCircle, AlertCircle, Edit, TestTube, Save, Clock, Play, Pause, Lock } from "lucide-react";
import AppLayout from "@/components/layout/app-layout";
import { AdminOnly } from "@/components/auth/role-guard";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { PasswordResetModal } from "@/components/admin/password-reset-modal";

type AdminStats = {
  totalUsers: number;
  totalArticles: number;
  systemStatus: string;
  lastFetchTime: string;
};

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

type Prompt = {
  id: number;
  name: string;
  content: string;
  variables: string;
  createdAt: string;
  updatedAt: string;
};

type TestResult = {
  searchResult: {
    title: string;
    content: string;
    url: string;
    publishedDate?: string;
  } | null;
  promptUsed: string;
  companyContext: {
    name: string;
    keywords: string[];
    targetRegions: string[];
  };
};

type CronJob = {
  id: number;
  name: string;
  enabled: boolean;
  lastRun?: string | null;
  lastStatus?: "success" | "error" | "running" | null;
  lastError?: string | null;
  nextRun?: string | null;
  createdAt: string;
};

export default function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for prompt editing
  const [editedPrompt, setEditedPrompt] = useState<string>("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  
  // State for password reset modal
  const [passwordResetUser, setPasswordResetUser] = useState<{
    id: number;
    name: string;
    email: string;
  } | null>(null);

  const { data: adminStats, isLoading, error } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    retry: 1
  });

  const { data: users, isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    retry: 1
  });

  // Fetch cron jobs status
  const { data: cronJobs, isLoading: cronJobsLoading } = useQuery<CronJob[]>({
    queryKey: ["/api/admin/cron-jobs"],
    retry: 1
  });

  // Get current user for role comparison
  const { data: currentUser } = useQuery<{ id: number; email: string; role: string }>({
    queryKey: ["/api/user"],
    retry: 1
  });

  // Fetch the news fetch prompt
  const { data: prompt, isLoading: promptLoading } = useQuery<Prompt>({
    queryKey: ["/api/admin/prompts", "news_fetch_prompt"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/prompts/news_fetch_prompt");
      return response.json();
    }
  });

  // Set edited prompt when prompt data is loaded
  useEffect(() => {
    if (prompt && !editedPrompt) {
      setEditedPrompt(prompt.content);
    }
  }, [prompt, editedPrompt]);

  // Update prompt mutation
  const updatePromptMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("PATCH", "/api/admin/prompts/news_fetch_prompt", { 
        content,
        variables: prompt?.variables || ""
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Prompt updated",
        description: "News fetch prompt has been successfully updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompts", "news_fetch_prompt"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "Failed to update prompt",
      });
    },
  });

  // Test fetch mutation
  const testFetchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/test-fetch", { 
        companyProfileId: 2, // Moove company for testing
        promptContent: editedPrompt 
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setTestResult(data.testResult);
      toast({
        title: "Test completed",
        description: "Prompt test completed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Test failed",
        description: error.message || "Failed to test prompt",
      });
    },
  });

  // Save test result mutation
  const saveTestResultMutation = useMutation({
    mutationFn: async () => {
      if (!testResult?.searchResult) throw new Error("No test result to save");
      const response = await apiRequest("POST", "/api/admin/save-test-result", { 
        companyProfileId: 2,
        articleData: testResult.searchResult
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Article saved",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setTestResult(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: error.message || "Failed to save test result",
      });
    },
  });

  const fetchNewsMutation = useMutation({
    mutationFn: async (companyProfileId: number) => {
      const response = await apiRequest("POST", "/api/admin/fetch-news", { companyProfileId });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "News fetch successful",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "News fetch failed",
        description: error.message || "Failed to fetch news article",
      });
    },
  });

  // Toggle cron job status
  const toggleCronJobMutation = useMutation({
    mutationFn: async ({ name, enabled }: { name: string; enabled: boolean }) => {
      const response = await apiRequest("PATCH", `/api/admin/cron-jobs/${name}`, { enabled });
      return response.json();
    },
    onSuccess: (data: CronJob) => {
      toast({
        title: data.enabled ? "Scheduled job enabled" : "Scheduled job paused",
        description: data.enabled ? "Automated news fetch will run as scheduled" : "Automated news fetch has been paused",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cron-jobs"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update scheduled job",
        description: error.message || "Failed to update job status",
      });
    },
  });

  // Change user role
  const changeUserRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: number; newRole: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role: newRole });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "User role updated",
        description: `Role changed to ${data.role}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update user role",
        description: error.message || "Failed to change user role",
      });
    },
  });

  const handleManualFetch = () => {
    // Use the current user's company profile ID (assuming admin has one)
    // For demo purposes, using company profile ID 2 (Moove company from the admin user)
    fetchNewsMutation.mutate(2);
  };

  // Helper function to get role badge styling
  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'editor':
        return 'bg-blue-100 text-blue-800';
      case 'viewer':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <AppLayout title="Admin Panel">
      <AdminOnly 
        fallback={
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Shield className="h-16 w-16 text-gray-300 mb-4" />
            <h2 className="text-xl font-medium text-gray-600 mb-2">Admin Access Required</h2>
            <p className="text-gray-500">You don't have permission to access this area.</p>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">System overview and management</p>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <Activity className="h-3 w-3 mr-1" />
              Admin Access
            </Badge>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-800">Failed to load admin statistics</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border bg-card shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-700">Total Users</CardTitle>
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{(adminStats as AdminStats)?.totalUsers || 0}</div>
                  <p className="text-sm text-gray-500 mt-1">Registered accounts</p>
                </CardContent>
              </Card>

              <Card className="border bg-card shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-700">Total Articles</CardTitle>
                  <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{(adminStats as AdminStats)?.totalArticles || 0}</div>
                  <p className="text-sm text-gray-500 mt-1">Content pieces processed</p>
                </CardContent>
              </Card>

              <Card className="border bg-card shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-700">System Status</CardTitle>
                  <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600 capitalize">
                    {(adminStats as AdminStats)?.systemStatus || "Unknown"}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">All systems operational</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Prompt Management Laboratory */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                News Search Prompt Laboratory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                Edit, test, and preview the news search prompt used by both manual and automated fetches. Changes here update the system-wide prompt.
              </p>
              
              <Tabs defaultValue="edit" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="edit">Edit Prompt</TabsTrigger>
                  <TabsTrigger value="test">Test & Preview</TabsTrigger>
                  <TabsTrigger value="live">Live Articles</TabsTrigger>
                </TabsList>
                
                <TabsContent value="edit" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="prompt-content">Prompt Content</Label>
                    {promptLoading ? (
                      <div className="h-40 bg-gray-100 rounded animate-pulse"></div>
                    ) : (
                      <Textarea
                        id="prompt-content"
                        placeholder="Enter your news search prompt..."
                        value={editedPrompt}
                        onChange={(e) => setEditedPrompt(e.target.value)}
                        rows={12}
                        className="font-mono text-sm"
                      />
                    )}
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Available Variables:</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-mono bg-blue-100 px-2 py-1 rounded">{"{keywords}"}</span>
                        <p className="text-blue-700 mt-1">Company keywords array</p>
                      </div>
                      <div>
                        <span className="font-mono bg-blue-100 px-2 py-1 rounded">{"{targetRegions}"}</span>
                        <p className="text-blue-700 mt-1">Target regions array</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Current Context (Moove Company):</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Keywords:</span>
                        <p className="text-gray-600">mobility, fintech, financial inclusion, autonomous vehicles</p>
                      </div>
                      <div>
                        <span className="font-medium">Target Regions:</span>
                        <p className="text-gray-600">UK</p>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => updatePromptMutation.mutate(editedPrompt)}
                    disabled={updatePromptMutation.isPending || !editedPrompt.trim()}
                    className="w-full sm:w-auto"
                  >
                    {updatePromptMutation.isPending ? (
                      <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {updatePromptMutation.isPending ? "Saving..." : "Save Prompt"}
                  </Button>
                </TabsContent>
                
                <TabsContent value="test" className="space-y-4">
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h4 className="font-medium text-yellow-900 mb-2">Preview Mode</h4>
                    <p className="text-yellow-800 text-sm">
                      Test your prompt without saving any articles to the database. Results are shown below for review.
                    </p>
                  </div>
                  
                  <Button 
                    onClick={() => testFetchMutation.mutate()}
                    disabled={testFetchMutation.isPending || !editedPrompt.trim()}
                    className="w-full sm:w-auto"
                  >
                    {testFetchMutation.isPending ? (
                      <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4 mr-2" />
                    )}
                    {testFetchMutation.isPending ? "Testing..." : "Test Search Prompt"}
                  </Button>
                  
                  {testResult && (
                    <div className="space-y-4">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <h4 className="font-medium text-green-900 mb-2">Test Results</h4>
                        {testResult.searchResult ? (
                          <div className="space-y-3">
                            <div>
                              <span className="font-medium text-green-800">Article Found:</span>
                              <h5 className="font-semibold text-gray-900 mt-1">{testResult.searchResult.title}</h5>
                              <p className="text-gray-600 text-sm mt-2 line-clamp-3">{testResult.searchResult.content}</p>
                              <a 
                                href={testResult.searchResult.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm underline mt-2 inline-block"
                              >
                                View Source Article
                              </a>
                            </div>
                            
                            <div className="flex gap-2 pt-2">
                              <Button 
                                onClick={() => saveTestResultMutation.mutate()}
                                disabled={saveTestResultMutation.isPending}
                                size="sm"
                              >
                                {saveTestResultMutation.isPending ? (
                                  <RotateCcw className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Save className="h-3 w-3 mr-1" />
                                )}
                                Save This Article
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setTestResult(null)}
                              >
                                Discard
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-green-800">No articles found matching the current prompt and keywords.</p>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="live" className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2">Production Article Fetch</h4>
                    <p className="text-blue-800 text-sm">
                      Create and process a real article using the current saved prompt. This will be added to the system.
                    </p>
                  </div>
                  
                  <Button 
                    className="w-full sm:w-auto"
                    onClick={handleManualFetch}
                    disabled={fetchNewsMutation.isPending}
                  >
                    {fetchNewsMutation.isPending ? (
                      <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Activity className="h-4 w-4 mr-2" />
                    )}
                    {fetchNewsMutation.isPending ? "Processing..." : "Create Live Article"}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* User Management Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">Password Reset Instructions:</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• Click "Reset Password" to generate a secure 16-character temporary password</li>
                    <li>• Copy the password and share it securely with the user (email, phone, etc.)</li>
                    <li>• User must change this password on their next login</li>
                    <li>• You cannot reset your own password from this panel</li>
                  </ul>
                </div>
              </div>
              {usersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center space-x-4 p-3 border rounded-lg animate-pulse">
                      <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                      <div className="h-8 w-20 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {users?.map((user) => {
                    const isCurrentUser = currentUser && 'id' in currentUser && currentUser.id === user.id;
                    return (
                      <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-sm">
                              {user.name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{user.name || 'Unnamed User'}</p>
                              {isCurrentUser && (
                                <Badge variant="secondary" className="bg-green-100 text-green-800">
                                  You
                                </Badge>
                              )}
                              <Badge className={`text-xs ${getRoleBadgeVariant(user.role || 'user')}`}>
                                {user.role?.charAt(0).toUpperCase() + user.role?.slice(1) || 'User'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            <p className="text-xs text-gray-400">
                              Joined {new Date(user.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={user.role}
                            onValueChange={(newRole) => 
                              changeUserRoleMutation.mutate({ userId: user.id, newRole })
                            }
                            disabled={isCurrentUser || changeUserRoleMutation.isPending}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="editor">Editor</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={isCurrentUser}
                            className={isCurrentUser ? "text-gray-400" : ""}
                            onClick={() => !isCurrentUser && setPasswordResetUser({
                              id: user.id,
                              name: user.name || '',
                              email: user.email
                            })}
                          >
                            <Lock className="h-3 w-3 mr-1" />
                            {isCurrentUser ? 'Cannot Reset' : 'Reset Password'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {users?.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No users found.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scheduled Jobs Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Scheduled Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                Monitor and control automated background tasks. Pause jobs if you need to stop automated processing.
              </p>
              
              {cronJobsLoading ? (
                <div className="space-y-4">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ) : cronJobs && cronJobs.length > 0 ? (
                <div className="space-y-4">
                  {cronJobs.map((job) => (
                    <div key={job.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full ${
                            job.enabled ? 'bg-green-500' : 'bg-gray-400'
                          }`}></div>
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {job.name === 'weekly_news_fetch' ? 'Weekly News Fetch' : job.name}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {job.enabled ? 'Active' : 'Paused'} • Every Sunday at 7:00 PM UK
                            </p>
                          </div>
                        </div>
                        
                        <Button
                          variant={job.enabled ? "outline" : "default"}
                          size="sm"
                          onClick={() => toggleCronJobMutation.mutate({ 
                            name: job.name, 
                            enabled: !job.enabled 
                          })}
                          disabled={toggleCronJobMutation.isPending}
                        >
                          {toggleCronJobMutation.isPending ? (
                            <RotateCcw className="h-3 w-3 mr-1 animate-spin" />
                          ) : job.enabled ? (
                            <Pause className="h-3 w-3 mr-1" />
                          ) : (
                            <Play className="h-3 w-3 mr-1" />
                          )}
                          {job.enabled ? 'Pause' : 'Resume'}
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Last Run:</span>
                          <p className="text-gray-600">
                            {job.lastRun 
                              ? new Date(job.lastRun).toLocaleString()
                              : 'Never'
                            }
                          </p>
                        </div>
                        
                        <div>
                          <span className="font-medium text-gray-700">Status:</span>
                          <div className="flex items-center gap-1 mt-1">
                            {job.lastStatus === 'success' && (
                              <>
                                <CheckCircle className="h-3 w-3 text-green-600" />
                                <span className="text-green-600">Success</span>
                              </>
                            )}
                            {job.lastStatus === 'error' && (
                              <>
                                <AlertCircle className="h-3 w-3 text-red-600" />
                                <span className="text-red-600">Error</span>
                              </>
                            )}
                            {job.lastStatus === 'running' && (
                              <>
                                <RotateCcw className="h-3 w-3 text-blue-600 animate-spin" />
                                <span className="text-blue-600">Running</span>
                              </>
                            )}
                            {!job.lastStatus && (
                              <span className="text-gray-500">Pending</span>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <span className="font-medium text-gray-700">Next Run:</span>
                          <p className="text-gray-600">
                            {job.nextRun 
                              ? new Date(job.nextRun).toLocaleString()
                              : 'Not scheduled'
                            }
                          </p>
                        </div>
                      </div>
                      
                      {job.lastError && (
                        <div className="bg-red-50 border border-red-200 rounded p-3">
                          <p className="text-sm font-medium text-red-800 mb-1">Last Error:</p>
                          <p className="text-sm text-red-700">{job.lastError}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No scheduled jobs configured</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminOnly>
      
      {/* Password Reset Modal */}
      <PasswordResetModal
        isOpen={!!passwordResetUser}
        onClose={() => setPasswordResetUser(null)}
        user={passwordResetUser || { id: 0, name: '', email: '' }}
        currentUserId={(currentUser && 'id' in currentUser ? currentUser.id : 0)}
      />
    </AppLayout>
  );
}