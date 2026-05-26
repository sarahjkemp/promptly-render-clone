import { ReactNode, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { NavigationPrefetcher } from "@/components/common/navigation-prefetcher";
import { preloadDashboard } from "@/lib/routePreloader";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

/**
 * AppLayout is the main layout wrapper for authenticated pages
 * Now with enhanced page transitions and persistent layout
 */
export default function AppLayout({ children, title }: AppLayoutProps) {
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  
  // Effect for smooth page transitions
  useEffect(() => {
    // Briefly hide content when location changes
    setIsVisible(false);
    
    // Then fade it back in after a very short delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50);
    
    return () => clearTimeout(timer);
  }, [location]);
  
  // When the app layout mounts, preload common data immediately
  useEffect(() => {
    // Preload dashboard data for better navigation right away
    preloadDashboard(queryClient);
    
    // No timeout needed anymore, load immediately
  }, [queryClient]);
  
  return (
    <div className="flex h-screen overflow-hidden bg-muted">
      {/* Include NavigationPrefetcher to preload common routes */}
      <NavigationPrefetcher />
      
      {/* Sidebar is persistent across navigations */}
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header is persistent across navigations */}
        <Header title={title} />
        
        {/* Main content with fade transition */}
        <main className="flex-1 overflow-y-auto p-3 md:p-5">
          <div 
            className={`
              max-w-7xl mx-auto px-0 md:px-2 
              transition-opacity duration-200 ease-in-out
              ${isVisible ? 'opacity-100' : 'opacity-0'}
            `}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}