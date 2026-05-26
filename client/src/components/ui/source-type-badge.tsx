import { Badge } from "@/components/ui/badge";
import { User, Globe } from "lucide-react";

interface SourceTypeBadgeProps {
  sourceType: "CLIENT" | "NEWS";
  className?: string;
}

export function SourceTypeBadge({ sourceType, className }: SourceTypeBadgeProps) {
  if (sourceType === "CLIENT") {
    return (
      <Badge variant="secondary" className={`bg-blue-100 text-blue-700 text-xs px-2 py-1 font-medium border-0 ${className}`}>
        <User className="h-3 w-3 mr-1" />
        CLIENT
      </Badge>
    );
  }
  
  return (
    <Badge variant="secondary" className={`bg-orange-100 text-orange-700 text-xs px-2 py-1 font-medium border-0 ${className}`}>
      <Globe className="h-3 w-3 mr-1" />
      NEWS
    </Badge>
  );
}