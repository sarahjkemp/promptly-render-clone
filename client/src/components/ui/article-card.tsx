import { format } from "date-fns";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArticleMoreMenu } from "@/components/ui/article-more-menu";
import { ErrorMessage } from "@/components/ui/error-message";
import { getFetchTypeInfo, getFetchTypeDot, type FetchType } from "@/lib/article-utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArticleStatusBadge, type ArticleStatus } from "@/components/ui/article-status-badge";
import { ArticleTypeIndicator, type ArticleType } from "@/components/ui/article-type-indicator";
import { normalizeErrorMessage } from "@/lib/error-messages";
import { SourceTypeBadge } from "@/components/ui/source-type-badge";

// Helper to truncate text
const truncateText = (text: string, maxLength: number) => {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

// Helper to format date
const formatDate = (dateString: string | Date) => {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return format(date, 'MMM d, yyyy');
  } catch (error) {
    return String(dateString);
  }
};

// Helper to normalize status to ArticleStatus type
function normalizeStatus(status: string): ArticleStatus {
  if (['pending', 'processing', 'done', 'error'].includes(status)) {
    return status as ArticleStatus;
  }
  return 'pending'; // Default to pending instead of unknown
}

export interface ArticleCardProps {
  article: {
    id: number;
    title: string;
    bodyText?: string;
    fetchType?: FetchType;
    fetchedAt?: string | Date | null;
    isViewed?: boolean;
    sourceType?: "CLIENT" | "NEWS";
  };
  status: "pending" | "processing" | "done" | "error" | "unknown";
  updatedAt: string | Date;
  historyId?: number | null;
  errorMessage?: string | null;
  onClick?: () => void;
  onReprocess?: (historyId: number) => void;
  isProcessing?: boolean;
  isPending?: boolean;
  className?: string;
}

export function ArticleCard({
  article,
  status,
  updatedAt,
  historyId,
  errorMessage,
  onClick,
  onReprocess,
  isProcessing = false,
  isPending = false,
  className = ""
}: ArticleCardProps) {
  const fetchTypeInfo = getFetchTypeInfo(article.fetchType, article.fetchedAt);
  const fetchTypeDot = getFetchTypeDot(article.fetchType);
  const normalizedStatus = normalizeStatus(status);
  
  const isInteractive = normalizedStatus !== "pending" && normalizedStatus !== "processing";
  
  const handleClick = () => {
    if (isInteractive && onClick) {
      onClick();
    }
  };
  
  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };
  
  return (
    <TooltipProvider>
      <Card 
        className={`border-0 shadow-sm overflow-hidden ${isInteractive ? "cursor-pointer" : ""} ${className}`}
        onClick={handleClick}
      >
        <div className="p-4">
          {/* Header with status badge and actions */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ArticleStatusBadge 
                status={normalizedStatus}
                errorMessage={errorMessage}
                onClick={normalizedStatus === 'error' && historyId && onReprocess ? () => onReprocess(historyId) : undefined}
                className="text-xs"
              />
              
              {/* Source type badge */}
              {article.sourceType && (
                <SourceTypeBadge sourceType={article.sourceType} />
              )}
              
              {/* Clear indicator for auto-generated articles */}
              {article.fetchType === 'auto' && (
                <Badge variant="secondary" className="bg-gray-800 text-white text-xs px-2.5 py-1 font-medium border-0 hover:bg-gray-800">
                  AUTO
                </Badge>
              )}
            </div>
            
            <div onClick={handleMoreClick}>
              <ArticleMoreMenu
                articleId={article.id}
                articleText={article.bodyText || ""}
                historyId={historyId || null}
                isProcessing={isProcessing}
                onReprocess={onReprocess || (() => {})}
                isPending={isPending}
                className="h-8 w-8"
                onView={onClick}
                canView={isInteractive && !!onClick}
              />
            </div>
          </div>
        
        {/* Main content */}
        <div className="flex items-start">
          <div className="flex-1 min-w-0">
            <div 
              className={`text-sm font-medium ${isInteractive ? "text-primary-600" : "text-gray-900 opacity-70"} text-left truncate max-w-[230px] sm:max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl`}
              title={article.title}
            >
              {article.title}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatDate(updatedAt)}
            </div>
            
            {/* Error message with improved display */}
            {errorMessage && (
              <div className="mt-2">
                <ErrorMessage 
                  message="Use the 'Try again' option above to restart content generation."
                  variant="block"
                  size="sm"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
    </TooltipProvider>
  );
}
