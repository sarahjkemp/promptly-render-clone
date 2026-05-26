import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { 
  MoreVertical, 
  RotateCw, 
  Clipboard, 
  Trash, 
  Download,
  Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { cacheConfig } from "@/lib/cacheConfig";

interface ArticleAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

interface ArticleMoreMenuProps {
  articleId: number;
  articleText: string;
  historyId?: number | null;
  isProcessing: boolean;
  onReprocess: (historyId: number) => void;
  className?: string;
  isPending?: boolean;
  onView?: () => void;
  canView?: boolean;
}

export function ArticleMoreMenu({
  articleId,
  articleText,
  historyId,
  isProcessing,
  onReprocess,
  className = "",
  isPending = false,
  onView,
  canView = false
}: ArticleMoreMenuProps) {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const handleDeleteConfirm = async () => {
    try {
      const response = await fetch(`/api/articles/${articleId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete article');
      }

      await response.json();
      
      // Invalidate cache to update UI smoothly
      queryClient.invalidateQueries({
        queryKey: cacheConfig.queryKeys.articles()
      });
      queryClient.invalidateQueries({
        queryKey: cacheConfig.queryKeys.historyList()
      });
      
      toast({ 
        title: "Article deleted",
        description: "The article has been removed successfully"
      });
      
      // Only navigate to history if user is not already there
      if (!location.startsWith('/history')) {
        setLocation('/history');
      }
    } catch (error) {
      console.error('Error deleting article:', error);
      toast({ 
        title: "Error deleting article",
        description: "There was a problem deleting this article",
        variant: "destructive"
      });
    }
    
    setShowDeleteDialog(false);
  };
  
  // Define the actions for this article
  const actions: ArticleAction[] = [
    {
      label: "View Article",
      icon: <Eye className="h-4 w-4" />,
      onClick: () => onView && onView(),
      disabled: !canView || isProcessing || !onView
    },
    {
      label: "Try again",
      icon: <RotateCw className="h-4 w-4" />,
      onClick: () => historyId && onReprocess(historyId),
      disabled: isProcessing || !historyId || isPending
    },
    {
      label: "Copy Original Article",
      icon: <Clipboard className="h-4 w-4" />,
      onClick: () => {
        navigator.clipboard.writeText(articleText);
        toast({ title: "Original article text copied to clipboard" });
      }
    },
    {
      label: "Download Results",
      icon: <Download className="h-4 w-4" />,
      onClick: () => {
        // Download the formatted PR content
        window.open(`/api/articles/${articleId}/download`, '_blank');
      }
    },
    {
      label: "Delete Article",
      icon: <Trash className="h-4 w-4" />,
      onClick: () => setShowDeleteDialog(true),
      destructive: true
    }
  ];

  // Group actions by destructive property
  const standardActions = actions.filter(a => !a.destructive);
  const destructiveActions = actions.filter(a => a.destructive);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            className={`h-7 w-7 p-0 hover:bg-gray-100 ${className}`}
            style={{ minHeight: 'unset', minWidth: 'unset' }}  // Override any min-height/width that might be causing issues
          >
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">More options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-56 z-50" 
          sideOffset={5}
          collisionPadding={10}
        >
          {standardActions.map((action, index) => (
            <DropdownMenuItem
              key={index}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!action.disabled) {
                  action.onClick();
                }
              }}
              disabled={action.disabled}
              className="flex items-center cursor-pointer py-2"
            >
              <span className="mr-2 text-muted-foreground">{action.icon}</span>
              <span>{action.label}</span>
            </DropdownMenuItem>
          ))}
          
          {destructiveActions.length > 0 && standardActions.length > 0 && (
            <DropdownMenuSeparator />
          )}
          
          {destructiveActions.map((action, index) => (
            <DropdownMenuItem
              key={index}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!action.disabled) {
                  action.onClick();
                }
              }}
              disabled={action.disabled}
              className="flex items-center text-red-600 cursor-pointer py-2"
            >
              <span className="mr-2 text-red-600">{action.icon}</span>
              <span>{action.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete article?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the article and all associated content including summaries, emails, and media suggestions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete article
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}