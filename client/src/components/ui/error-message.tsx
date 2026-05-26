import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ErrorMessageProps {
  message: string;
  className?: string;
  variant?: "inline" | "block" | "toast";
  size?: "sm" | "md" | "lg";
}

export function ErrorMessage({
  message,
  className,
  variant = "block",
  size = "md"
}: ErrorMessageProps) {
  // Get appropriate styles based on variant and size - using light grey background since error state is already indicated by red badge
  const variantStyles = {
    inline: "inline-flex items-center text-gray-700 rounded-md bg-muted px-2.5 py-1.5 border border-border",
    block: "flex items-start rounded-lg bg-muted p-3 border border-border shadow-sm",
    toast: "flex items-start"
  };
  
  const sizeStyles = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };
  
  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  };
  
  // Simple alert icon for error messages - using neutral colors since error state is shown by status badge
  const IconComponent = <AlertCircle className={cn(iconSizes[size], "text-gray-600")} />;
  
  return (
    <div className={cn(variantStyles[variant], sizeStyles[size], className)}>
      <div className="flex-shrink-0 mt-0.5 mr-2">
        {IconComponent}
      </div>
      <div className="flex-1">
        <p className="text-gray-700">
          {message}
        </p>
      </div>
    </div>
  );
}