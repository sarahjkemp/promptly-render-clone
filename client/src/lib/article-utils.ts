import { CheckCircle, User, Zap } from "lucide-react";

export type FetchType = "auto" | "manual" | "user";

export interface FetchTypeInfo {
  color: string;
  bgColor: string;
  label: string;
  icon: React.ElementType;
  tooltip: string;
}

export function getFetchTypeInfo(fetchType: FetchType = "user", fetchedAt?: string | Date | null): FetchTypeInfo {
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  switch (fetchType) {
    case "auto":
      return {
        color: "text-green-600",
        bgColor: "bg-green-100",
        label: "Auto",
        icon: Zap,
        tooltip: fetchedAt 
          ? `Fetched automatically by AI on ${formatDate(fetchedAt)}`
          : "Fetched automatically by AI"
      };
    case "manual":
      return {
        color: "text-blue-600", 
        bgColor: "bg-blue-100",
        label: "Manual",
        icon: CheckCircle,
        tooltip: fetchedAt 
          ? `Fetched manually by admin on ${formatDate(fetchedAt)}`
          : "Fetched manually by admin"
      };
    case "user":
    default:
      return {
        color: "text-gray-600",
        bgColor: "bg-gray-100", 
        label: "User",
        icon: User,
        tooltip: "Added by user"
      };
  }
}

export function getFetchTypeDot(fetchType: FetchType = "user"): { color: string; className: string } {
  switch (fetchType) {
    case "auto":
      return {
        color: "#16a34a", // green-600
        className: "bg-green-500"
      };
    case "manual":
      return {
        color: "#2563eb", // blue-600
        className: "bg-blue-500"
      };
    case "user":
    default:
      return {
        color: "#6b7280", // gray-500
        className: "bg-gray-500"
      };
  }
}
