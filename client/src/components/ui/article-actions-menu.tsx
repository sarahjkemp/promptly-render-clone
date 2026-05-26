import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { 
  MoreVertical, 
  Eye, 
  RotateCw, 
  Clipboard, 
  Trash, 
  Download, 
  Share, 
  Pencil,
  FileText 
} from "lucide-react";

type ArticleAction = {
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
};

interface ArticleActionsMenuProps {
  actions: ArticleAction[];
  triggerClassName?: string;
  buttonSize?: "default" | "sm" | "lg" | "icon";
}

export function ArticleActionsMenu({
  actions,
  triggerClassName,
  buttonSize = "icon",
}: ArticleActionsMenuProps) {
  // Group actions by variant
  const defaultActions = actions.filter(a => a.variant !== "destructive");
  const destructiveActions = actions.filter(a => a.variant === "destructive");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size={buttonSize}
          className={triggerClassName}
        >
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {defaultActions.map((action, index) => (
          <DropdownMenuItem
            key={index}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`flex items-center ${action.disabled ? 'opacity-50' : ''}`}
          >
            <span className="mr-2">{action.icon}</span>
            <span className="flex-1">{action.label}</span>
            {action.shortcut && (
              <span className="text-xs text-muted-foreground ml-auto">
                {action.shortcut}
              </span>
            )}
          </DropdownMenuItem>
        ))}
        
        {destructiveActions.length > 0 && defaultActions.length > 0 && (
          <DropdownMenuSeparator />
        )}
        
        {destructiveActions.map((action, index) => (
          <DropdownMenuItem
            key={index}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`flex items-center text-red-600 ${action.disabled ? 'opacity-50' : ''}`}
          >
            <span className="mr-2 text-red-600">{action.icon}</span>
            <span className="flex-1">{action.label}</span>
            {action.shortcut && (
              <span className="text-xs text-muted-foreground ml-auto">
                {action.shortcut}
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Helper to create common article actions
export function createViewAction(onClick: () => void, isDisabled = false): ArticleAction {
  return {
    label: "View Details",
    icon: <Eye className="h-4 w-4" />,
    shortcut: "⌘V",
    onClick,
    disabled: isDisabled
  };
}

export function createReprocessAction(onClick: () => void, isDisabled = false): ArticleAction {
  return {
    label: "Reprocess Content",
    icon: <RotateCw className="h-4 w-4" />,
    shortcut: "⌘R",
    onClick,
    disabled: isDisabled
  };
}

export function createCopyAction(onClick: () => void, isDisabled = false): ArticleAction {
  return {
    label: "Copy to Clipboard",
    icon: <Clipboard className="h-4 w-4" />,
    shortcut: "⌘C",
    onClick,
    disabled: isDisabled
  };
}

export function createDeleteAction(onClick: () => void, isDisabled = false): ArticleAction {
  return {
    label: "Delete Content",
    icon: <Trash className="h-4 w-4" />,
    shortcut: "⌘⌫",
    onClick,
    disabled: isDisabled,
    variant: "destructive"
  };
}

export function createDownloadAction(onClick: () => void, isDisabled = false): ArticleAction {
  return {
    label: "Download Results",
    icon: <Download className="h-4 w-4" />,
    shortcut: "⌘D",
    onClick,
    disabled: isDisabled
  };
}

export function createShareAction(onClick: () => void, isDisabled = false): ArticleAction {
  return {
    label: "Share Content",
    icon: <Share className="h-4 w-4" />,
    shortcut: "⌘S",
    onClick,
    disabled: isDisabled
  };
}

export function createEditAction(onClick: () => void, isDisabled = false): ArticleAction {
  return {
    label: "Edit Article",
    icon: <Pencil className="h-4 w-4" />,
    shortcut: "⌘E",
    onClick,
    disabled: isDisabled
  };
}

export function createExportAction(onClick: () => void, isDisabled = false): ArticleAction {
  return {
    label: "Export as PDF",
    icon: <FileText className="h-4 w-4" />,
    shortcut: "⌘P",
    onClick,
    disabled: isDisabled
  };
}