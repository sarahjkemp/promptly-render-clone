import { Info } from 'lucide-react';

interface SourceIndicatorProps {
  hasWebSearch?: boolean;
  className?: string;
}

export default function SourceIndicator({ hasWebSearch = true, className = '' }: SourceIndicatorProps) {
  if (!hasWebSearch) {
    return (
      <div className={`flex items-center gap-2 text-xs text-muted-foreground mt-2 ${className}`}>
        <Info className="w-3 h-3" />
        <span>Based on your content</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-xs text-muted-foreground mt-2 ${className}`}>
      <Info className="w-3 h-3" />
      <span>Based on your content + current industry research</span>
    </div>
  );
}