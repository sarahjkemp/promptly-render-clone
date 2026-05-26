import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

export type ArticleStatus = 'pending' | 'processing' | 'done' | 'error';

interface ArticleStatusBadgeProps {
  status: ArticleStatus | string;
  errorMessage?: string | null;
  className?: string;
  onClick?: () => void;
}

export function ArticleStatusBadge({ status, errorMessage, className, onClick }: ArticleStatusBadgeProps) {
  // Normalize status to ensure it's a valid type (never show "unknown")
  const normalizedStatus: ArticleStatus = 
    ['pending', 'processing', 'done', 'error'].includes(status) 
      ? status as ArticleStatus 
      : 'pending'; // Default to pending if invalid

  const getStatusConfig = (status: ArticleStatus) => {
    switch (status) {
      case 'pending':
        return {
          variant: 'secondary' as const,
          icon: Clock,
          text: 'Queued',
          className: 'bg-slate-100 text-slate-600 hover:bg-slate-150'
        };
      case 'processing':
        return {
          variant: 'default' as const,
          icon: Loader2,
          text: 'Agent searching',
          className: 'bg-blue-50 text-blue-600 hover:bg-blue-100'
        };
      case 'done':
        return {
          variant: 'default' as const,
          icon: CheckCircle,
          text: 'Ready',
          className: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
        };
      case 'error':
        return {
          variant: 'default' as const,
          icon: XCircle,
          text: 'Try again',
          className: 'bg-orange-50 text-orange-600 hover:bg-orange-100'
        };
    }
  };

  const config = getStatusConfig(normalizedStatus);
  const Icon = config.icon;
  
  const handleClick = () => {
    if (normalizedStatus === 'error' && onClick) {
      onClick();
    }
  };

  return (
    <Badge 
      variant={config.variant}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${config.className} ${normalizedStatus === 'error' && onClick ? 'cursor-pointer hover:opacity-80' : ''} ${className || ''}`}
      title={errorMessage || config.text}
      onClick={handleClick}
    >
      <Icon 
        className={`h-3 w-3 ${normalizedStatus === 'processing' ? 'animate-spin' : ''}`} 
      />
      <span className="hidden sm:inline">{config.text}</span>
      <span className="sm:hidden">
        {normalizedStatus === 'processing' ? 'Creating' : config.text}
      </span>
    </Badge>
  );
}