import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { UploadExamplesModal } from './UploadExamplesModal';

interface DocumentUploadProps {
  companyId: number;
  onUploadComplete?: () => void;
}

const DOCUMENT_TYPES = [
  { value: 'brand_guide', label: 'Brand Guidelines' },
  { value: 'messaging', label: 'Key Messages' },
  { value: 'research', label: 'Research & Data' },
  { value: 'background', label: 'Company Background' },
  { value: 'data', label: 'Data & Statistics' },
];

const SUPPORTED_FORMATS = ['.pdf', '.docx', '.txt', '.xlsx', '.xls'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export function DocumentUpload({ companyId, onUploadComplete }: DocumentUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (data: { file: File; documentType: string; title: string }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('documentType', data.documentType);
      formData.append('title', data.title);

      // Simulate upload progress
      setUploadProgress(20);
      
      const response = await fetch(`/api/companies/${companyId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Upload failed');
      }

      setUploadProgress(100);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies', companyId, 'documents'] });
      toast({
        title: "Document uploaded successfully",
        description: "Your document has been processed and is ready to enhance content generation.",
      });
      resetForm();
      onUploadComplete?.();
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload company document. Please try again.",
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  const resetForm = () => {
    setSelectedFile(null);
    setDocumentType('');
    setTitle('');
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateFile = (file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!SUPPORTED_FORMATS.includes(extension)) {
      return 'Unsupported file type. Only PDF, DOCX, TXT, XLSX, and XLS are allowed.';
    }
    
    if (file.size === 0) {
      return 'Empty file not allowed. Please choose a valid document.';
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large (max 25 MB). Please upload a smaller file.';
    }
    
    return null;
  };

  const handleFileSelection = (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast({
        title: "Invalid file",
        description: error,
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    if (!title) {
      // Auto-generate title from filename without extension
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExt);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !documentType) {
      toast({
        title: "Missing information",
        description: "Please select a file and document type before uploading.",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({
      file: selectedFile,
      documentType,
      title: title || selectedFile.name,
    });
  };

  const canUpload = selectedFile && documentType && !uploadMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Company Documents
        </CardTitle>
        <CardDescription>
          Upload company documents like brand guidelines, key messages, or research data to enhance AI-generated content.
          Supported formats: {SUPPORTED_FORMATS.join(', ')} (max 25MB)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            dragActive 
              ? 'border-primary bg-primary/5' 
              : selectedFile 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={SUPPORTED_FORMATS.join(',')}
            onChange={handleFileInputChange}
          />
          
          {selectedFile ? (
            <div className="flex flex-col items-center space-y-2">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  resetForm();
                }}
              >
                Choose Different File
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <FileText className="h-12 w-12 text-gray-400" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Drop your document here, or click to browse
                </p>
                <p className="text-xs text-gray-500">
                  {SUPPORTED_FORMATS.join(', ')} • Max 25MB
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Document Details Form */}
        {selectedFile && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Document Title</Label>
                <Input
                  id="title"
                  placeholder="Enter a descriptive title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="documentType">Document Type</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Upload Progress */}
            {uploadMutation.isPending && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing document...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            {/* Upload Button */}
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={resetForm}
                disabled={uploadMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpload}
                disabled={!canUpload}
                className="min-w-[120px]"
              >
                {uploadMutation.isPending ? 'Processing...' : 'Upload Document'}
              </Button>
            </div>
          </div>
        )}

        {/* Upload Guidance */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Not sure what to upload?</span>
          </div>
          <UploadExamplesModal />
        </div>
      </CardContent>
    </Card>
  );
}