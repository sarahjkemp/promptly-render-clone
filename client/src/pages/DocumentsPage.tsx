import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentUpload } from '@/components/DocumentUpload';
import { DocumentLibrary } from '@/components/DocumentLibrary';
import { Badge } from '@/components/ui/badge';

import { DocumentBenefitsModal } from '@/components/DocumentBenefitsModal';
import AppLayout from '@/components/layout/app-layout';

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState('library');

  // Get user and company profile
  const { data: user } = useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      const response = await fetch('/api/user');
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
  });

  const companyProfile = user?.companyProfile;

  if (!companyProfile) {
    return (
      <AppLayout title="Document Management">
        <div className="max-w-4xl mx-auto p-6">
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-gray-600">Please complete your company profile to manage documents.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Document Management">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 bg-background min-h-screen">
      {/* Page Header */}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Document Management</h1>
        <p className="text-muted-foreground">
          Uploading company documents will help us to generate the best and most relevant pitches for your company!
        </p>
      </div>

      {/* Content Enhancement Banner */}
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
        <div className="space-y-1">
          <h2 className="font-semibold text-foreground">Enhance your content generation</h2>
          <p className="text-sm text-muted-foreground">
            Adding context helps me create the best angles for you!
          </p>
        </div>
        <DocumentBenefitsModal />
      </div>

      {/* Document Management Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-96">
          <TabsTrigger value="library" className="flex items-center justify-center">
            <span className="hidden sm:inline">Document Library</span>
            <span className="sm:hidden">Library</span>
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center justify-center">
            <span className="hidden sm:inline">Upload Documents</span>
            <span className="sm:hidden">Upload</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-6">
          <DocumentLibrary companyId={companyProfile.id} />
        </TabsContent>

        <TabsContent value="upload" className="space-y-6">
          <DocumentUpload 
            companyId={companyProfile.id} 
            onUploadComplete={() => setActiveTab('library')}
          />
        </TabsContent>
      </Tabs>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Supported Document Types</CardTitle>
          <CardDescription>
            Upload these types of documents to enhance your content generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 hover:text-purple-800 pointer-events-none">Brand Guidelines</Badge>
              <p className="text-sm text-gray-600">
                Style guides, brand voice documentation, and messaging frameworks
              </p>
            </div>
            <div className="space-y-2">
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 hover:text-blue-800 pointer-events-none">Key Messages</Badge>
              <p className="text-sm text-gray-600">
                Core messaging documents, positioning statements, and value propositions
              </p>
            </div>
            <div className="space-y-2">
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 hover:text-green-800 pointer-events-none">Research & Data</Badge>
              <p className="text-sm text-gray-600">
                Market research, surveys, whitepapers, and analytical reports
              </p>
            </div>
            <div className="space-y-2">
              <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 hover:text-orange-800 pointer-events-none">Company Background</Badge>
              <p className="text-sm text-gray-600">
                Company history, executive bios, and foundational information
              </p>
            </div>
            <div className="space-y-2">
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 hover:text-red-800 pointer-events-none">Data & Statistics</Badge>
              <p className="text-sm text-gray-600">
                Performance metrics, industry benchmarks, and statistical data
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-500">
                <strong>Supported formats:</strong> PDF, DOCX, TXT (max 25MB)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  );
}