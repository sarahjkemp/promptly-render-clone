import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Trash2, 
  Download, 
  FileX,
  Loader2,
  MoreVertical,
  FileText,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';

interface DocumentLibraryProps {
  companyId: number;
}

interface CompanyDocument {
  id: number;
  title: string;
  documentType: string;
  originalFilename: string;
  fileSize: number;
  summary: string | null;
  keywords: string[] | null;
  uploadedAt: string;
  isActive: boolean;
  extractedContent: string | null;
}

const DOCUMENT_TYPE_LABELS: Record<string, { label: string }> = {
  brand_guide: { label: 'Brand Guidelines' },
  messaging: { label: 'Key Messages' },
  research: { label: 'Research & Data' },
  background: { label: 'Company Background' },
  data: { label: 'Data & Statistics' },
};

export function DocumentLibrary({ companyId }: DocumentLibraryProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: documents, isLoading, error } = useQuery<CompanyDocument[]>({
    queryKey: ['/api/companies', companyId, 'documents'],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}/documents`);
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json() as Promise<CompanyDocument[]>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: number) => {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete document');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies', companyId, 'documents'] });
      toast({
        title: "Document deleted",
        description: "The document has been removed from your library.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (document: CompanyDocument) => {
    if (window.confirm(`Are you sure you want to delete "${document.title}"? This action cannot be undone.`)) {
      deleteMutation.mutate(document.id);
    }
  };

  const handleDownload = (doc: CompanyDocument) => {
    // Create a download link for the file
    // Note: This would need backend support to serve the original file
    // For now, we'll create a text file with the extracted content
    const content = doc.extractedContent || 'No content available';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = doc.originalFilename || `${doc.title}.txt`;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };



  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading documents...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <span className="ml-2 text-destructive">Failed to load documents</span>
        </CardContent>
      </Card>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Library
          </CardTitle>
          <CardDescription>
            Your uploaded company documents will appear here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileX className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No documents yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Upload your first document to start enhancing your AI-generated content with company-specific information.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Document Library
          <Badge variant="secondary" className="ml-auto">
            {documents.length} document{documents.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
        <CardDescription>
          Manage your uploaded company documents
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {documents.map((document: CompanyDocument) => {
            const typeInfo = DOCUMENT_TYPE_LABELS[document.documentType] || {
              label: document.documentType
            };

            return (
              <div
                key={document.id}
                className="border border-border rounded-lg p-4 hover:bg-muted transition-colors"
              >
                {/* Desktop Layout */}
                <div className="hidden sm:flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {/* File Name - Bold and prominent */}
                    <h3 className="text-sm font-semibold text-foreground truncate">
                      {document.originalFilename}
                    </h3>
                    
                    {/* File Details - Single line with proper spacing */}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{formatFileSize(document.fileSize)}</span>
                      <span>•</span>
                      <span>Uploaded {formatDistanceToNow(new Date(document.uploadedAt), { addSuffix: true })}</span>
                      {/* Document Type Badge */}
                      <Badge variant="secondary" className="text-xs">
                        {typeInfo.label}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Single Action Menu - Desktop */}
                  <div className="flex items-center ml-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleDownload(document)}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(document)}
                          disabled={deleteMutation.isPending}
                          className="flex items-center gap-2 text-destructive focus:text-destructive"
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Mobile Layout */}
                <div className="sm:hidden">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* File Name - Bold and prominent */}
                      <h3 className="text-sm font-semibold text-foreground leading-5 mb-1">
                        {document.originalFilename}
                      </h3>
                      
                      {/* Document Type Badge */}
                      <Badge variant="secondary" className="text-xs mb-2">
                        {typeInfo.label}
                      </Badge>
                      
                      {/* File Details - Stacked on mobile */}
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div>{formatFileSize(document.fileSize)}</div>
                        <div>Uploaded {formatDistanceToNow(new Date(document.uploadedAt), { addSuffix: true })}</div>
                      </div>
                    </div>
                    
                    {/* Single Action Menu - Mobile */}
                    <div className="flex items-center ml-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground hover:bg-muted p-2"
                          >
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleDownload(document)}
                            className="flex items-center gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(document)}
                            disabled={deleteMutation.isPending}
                            className="flex items-center gap-2 text-destructive focus:text-destructive"
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Usage Information */}
        <div className="mt-6 bg-muted border border-border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1 text-foreground">Document enhancement active</p>
            <p className="text-xs">
              These documents are automatically analysed when processing articles to provide relevant context and improve content quality. Documents with matching keywords to your articles will be prioritised.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}