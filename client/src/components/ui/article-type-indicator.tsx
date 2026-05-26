import { Badge } from "@/components/ui/badge";
import { User, Bot, UserCheck } from "lucide-react";

export type ArticleType = 'manual' | 'auto' | 'user';

interface ArticleTypeIndicatorProps {
  type: ArticleType | string;
  className?: string;
  showLabel?: boolean;
}

export function ArticleTypeIndicator({ type, className, showLabel = true }: ArticleTypeIndicatorProps) {
  // Normalize type to ensure it's valid
  const normalizedType: ArticleType = 
    ['manual', 'auto', 'user'].includes(type) 
      ? type as ArticleType 
      : 'user'; // Default to user if invalid

  const getTypeConfig = (type: ArticleType) => {
    switch (type) {
      case 'manual':
        return {
          icon: UserCheck,
          text: 'Manual',
          dotColor: 'bg-blue-500',
          badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
          description: 'Added by admin'
        };
      case 'auto':
        return {
          icon: Bot,
          text: 'Auto',
          dotColor: 'bg-green-500',
          badgeColor: 'bg-green-50 text-green-700 border-green-200',
          description: 'Auto-fetched'
        };
      case 'user':
        return {
          icon: User,
          text: 'User',
          dotColor: 'bg-purple-500',
          badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
          description: 'User submitted'
        };
    }
  };

  const config = getTypeConfig(normalizedType);
  const Icon = config.icon;

  if (!showLabel) {
    // Just show the colored dot
    return (
      <div 
        className={`h-2 w-2 rounded-full ${config.dotColor} ${className || ''}`}
        title={`${config.text} - ${config.description}`}
      />
    );
  }

  return (
    <Badge 
      variant="outline"
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium border ${config.badgeColor} ${className || ''}`}
      title={config.description}
    >
      <Icon className="h-3 w-3" />
      <span>{config.text}</span>
    </Badge>
  );
}