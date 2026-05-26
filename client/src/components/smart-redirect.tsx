import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Home, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * SmartRedirect Component
 * Intelligently redirects users based on authentication status
 * Shows brief feedback before redirecting to prevent confusion
 */
export function SmartRedirect() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // Start redirecting process immediately
    setIsRedirecting(true);

    const redirectTimer = setTimeout(() => {
      // Since SimpleAuthGuard handles unauthenticated users,
      // we only need to handle authenticated users here
      toast({
        title: "Page not found",
        description: "Redirecting to dashboard...",
        variant: "default",
      });
      
      setLocation("/dashboard");
    }, 1000); // 1 second delay for user awareness

    return () => clearTimeout(redirectTimer);
  }, [setLocation, toast]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center max-w-md mx-4">
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            {isRedirecting && (
              <Loader2 className="h-6 w-6 animate-spin text-primary absolute -bottom-1 -right-1 bg-background rounded-full p-1" />
            )}
          </div>
        </div>
        
        <h1 className="text-2xl font-semibold text-foreground mb-3">
          Page Not Found
        </h1>
        
        <p className="text-muted-foreground mb-6">
          {isRedirecting 
            ? "Redirecting you to dashboard..."
            : "The page you're looking for doesn't exist."
          }
        </p>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Home className="h-4 w-4" />
          <span>Taking you somewhere helpful</span>
        </div>
      </div>
    </div>
  );
}