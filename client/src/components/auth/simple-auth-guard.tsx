import { useEffect, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import AuthPage from "@/pages/auth-page";
import { useUserStore } from "@/lib/user-store";
import { startSessionKeepAlive, stopSessionKeepAlive } from "@/lib/queryClient";

interface SimpleAuthGuardProps {
  children: ReactNode;
}

export function SimpleAuthGuard({ children }: SimpleAuthGuardProps) {
  const { isSignedIn, isLoading, hasError, checkAuth } = useUserStore();

  useEffect(() => {
    // Add a small delay to allow Vite to finish loading dependencies
    const timer = setTimeout(checkAuth, 100);
    return () => clearTimeout(timer);
  }, [checkAuth]);

  // Start/stop session keep-alive based on authentication status
  useEffect(() => {
    if (isSignedIn) {
      startSessionKeepAlive();
    } else {
      stopSessionKeepAlive();
    }
    
    // Cleanup on unmount
    return () => {
      stopSessionKeepAlive();
    };
  }, [isSignedIn]);

  // Listen for successful login/registration events and integrate with user store
  useEffect(() => {
    const handleLoginSuccess = async () => {
      await checkAuth();
      // Start session keep-alive after successful login
      startSessionKeepAlive();
    };
    
    const handleRegistrationSuccess = async () => {
      await checkAuth();
      // Start session keep-alive after successful registration
      startSessionKeepAlive();
      // After auth check, redirect to onboarding if user is authenticated
      setTimeout(() => {
        if (window.location.pathname !== '/onboarding') {
          window.location.href = '/onboarding';
        }
      }, 100);
    };

    window.addEventListener('login-success', handleLoginSuccess);
    window.addEventListener('registration-success', handleRegistrationSuccess);
    
    return () => {
      window.removeEventListener('login-success', handleLoginSuccess);
      window.removeEventListener('registration-success', handleRegistrationSuccess);
    };
  }, []);

  // Show loading state with better error handling
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading application...</span>
        {hasError && (
          <p className="mt-2 text-sm text-gray-500">
            If this takes too long, try refreshing the page
          </p>
        )}
      </div>
    );
  }

  if (!isSignedIn) {
    return <AuthPage />;
  }

  return <>{children}</>;
}