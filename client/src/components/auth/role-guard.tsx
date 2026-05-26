import { ReactNode } from "react";
import { useUserStore } from "@/lib/user-store";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: ("admin" | "editor" | "viewer")[];
  fallback?: ReactNode;
}

export function RoleGuard({ children, allowedRoles, fallback = null }: RoleGuardProps) {
  const { user } = useUserStore();
  
  if (!user || !allowedRoles.includes(user.role as any)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

// Convenience components for common role checks
export function AdminOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleGuard allowedRoles={["admin"]} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

export function EditorAndAbove({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleGuard allowedRoles={["admin", "editor"]} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}