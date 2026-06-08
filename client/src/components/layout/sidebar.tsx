import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useRef } from "react";
import { useUserStore } from "@/lib/user-store";
import { useAuthActions } from "@/hooks/use-auth-actions";
import { 
  LayoutDashboard,
  Newspaper,
  PenSquare,
  History,
  Settings,
  LogOut,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  FileText,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { preloadDashboard, preloadHistory } from "@/lib/routePreloader";
import { NavigationPrefetcher } from "@/components/common/navigation-prefetcher";

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { user } = useUserStore();
  const { logout } = useAuthActions();
  const [collapsed, setCollapsed] = useState(false);
  const client = useQueryClient(); // Access the queryClient for prefetching
  
  // Get company name from user data or a fallback
  const displayName = user?.name?.trim() || 
                     (user?.companyProfile?.name) || 
                     user?.email ||
                     user?.username || 
                     "User";
  const companyName = user?.companyProfile?.name || displayName;
  const companyInitials = ((companyName?.substring(0, 1)) || "U").toUpperCase();
  
  // Log what we're displaying to help debug
  useEffect(() => {
    console.log("Sidebar user data:", { 
      name: user?.name,
      email: user?.email || user?.username,
      role: user?.role,
      companyProfile: user?.companyProfile ? {
        name: user.companyProfile.name,
        id: user.companyProfile.id
      } : null
    });
    console.log("Admin nav items:", user?.role === 'admin' ? [{ href: "/admin", label: "Admin Panel", icon: Shield }] : []);
  }, [user]);

  const handleLogout = () => {
    logout();
  };
  
  // Handle prefetching data when hovering nav items
  const handleNavHover = useCallback((path: string) => {
    // No need to prefetch the current page
    if (location === path) return;
    
    // Prefetch based on the path
    switch (path) {
      case "/":
        preloadDashboard(client);
        break;
      case "/history":
        preloadHistory(client);
        break;
      default:
        // Other routes don't need specific prefetching
        break;
    }
  }, [client, location]);
  
  // Enhanced navigation with route preloading
  const handleNavigate = useCallback((path: string) => {
    // Don't navigate if already on the path
    if (location === path) return;
    
    // First - prefetch data needed for the target path
    switch (path) {
      case "/":
      case "/dashboard":
        preloadDashboard(client);
        break;
      case "/history":
        preloadHistory(client);
        break;
      case "/settings":
        // Prefetch settings page data
        client.prefetchQuery({
          queryKey: ['/api/company-profile'],
          staleTime: 60000 // 1 minute
        });
        break;
      case "/add-content":
        // Prefetch any data needed for add content page
        break;
      case "/founder-posts":
        import("@/pages/founder-posts-page");
        break;
      default:
        // Default prefetch for other routes
        break;
    }
    
    // This code creates a seamless, instantaneous feeling transition
    // First - wait very briefly for data prefetching to begin
    setTimeout(() => {
      // Before navigating, actively preload the component if possible
      const preloadComponent = () => {
        // These imports match those from App.tsx pageLoaders
        if (path === "/" || path === "/dashboard") import("@/pages/dashboard-page");
        else if (path === "/history") import("@/pages/history-page");
        else if (path === "/settings") import("@/pages/settings-page");
        else if (path === "/add-content") import("@/pages/add-article-page");
        else if (path.includes("/results/")) import("@/pages/results-page");
      };
      
      // Try to preload the component
      try {
        preloadComponent();
      } catch (e) {
        // Silently continue if preloading fails
      }
      
      // Then navigate to the path after ensuring everything is ready
      setLocation(path);
    }, 10); // Very short delay, imperceptible to users
  }, [client, location, setLocation]);

  // Base navigation for all users
  const baseNavItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/add-content", label: "Add Content", icon: Newspaper },
    { href: "/history", label: "History", icon: History },
    { href: "/founder-posts", label: "Founder Posts", icon: PenSquare },
    { href: "/documents", label: "Documents", icon: FileText },
    { href: "/settings", label: "Settings", icon: Settings }
  ];

  // Admin-only navigation items
  const adminNavItems = user?.role === 'admin' ? [
    { href: "/admin", label: "Admin Panel", icon: Shield }
  ] : [];

  // Combine navigation items
  const navItems = [...baseNavItems, ...adminNavItems];

  // Determine if this is the mobile sidebar variant
  const isMobileVariant = !!className;
  
  return (
    <div className={cn(
      "flex flex-col bg-background shadow-sm transition-all duration-300", 
      // Only hide on mobile when not explicitly displayed in a mobile context
      isMobileVariant ? "" : "hidden md:flex",
      isMobileVariant ? "h-full" : "border-r border-gray-200",
      // Only collapse on desktop, never on mobile
      !isMobileVariant && collapsed ? "md:w-14" : "md:w-56", 
      className
    )}>
      <div className={cn("py-3", !isMobileVariant && collapsed ? "px-2" : "px-3")}>
        <div className="flex items-center justify-between">
          {/* For desktop non-collapsed OR any mobile view, show the full logo */}
          {(isMobileVariant || !collapsed) && (
            <div className="flex items-center">
              <svg 
                className="h-6 w-6 text-primary-500 mr-2 flex-shrink-0" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-lg font-bold text-gray-900">PRomptly</span>
            </div>
          )}
          
          {/* Only show icon logo for collapsed desktop */}
          {!isMobileVariant && collapsed && (
            <div className="mx-auto">
              <svg 
                className="h-7 w-7 text-primary-500" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
          
          {/* Only show collapse button in desktop view, not in sheet */}
          {!isMobileVariant && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? 
                <ChevronRight className="h-3.5 w-3.5 text-gray-500" /> : 
                <ChevronLeft className="h-3.5 w-3.5 text-gray-500" />}
            </Button>
          )}
        </div>
      </div>
      
      {/* Include navigation prefetcher component */}
      <NavigationPrefetcher />
      
      <nav className={cn("flex-1 py-3 space-y-1", !isMobileVariant && collapsed ? "px-2" : "px-3")}>
        {navItems.map((item) => (
          <Button
            key={item.href}
            variant="ghost"
            className={cn(
              "w-full text-gray-600 font-medium text-sm h-11 transition-all duration-200",
              !isMobileVariant && collapsed ? "px-2" : "px-3 justify-start",
              location === item.href && "bg-gray-100 text-gray-900"
            )}
            onClick={() => handleNavigate(item.href)}
            onMouseEnter={() => handleNavHover(item.href)}
            onFocus={() => handleNavHover(item.href)}
          >
            <div className={!isMobileVariant && collapsed ? "flex justify-center w-full" : "flex w-full items-center"}>
              <item.icon className={cn("h-4 w-4 flex-shrink-0", !isMobileVariant && collapsed ? "" : "mr-3")} />
              {/* Always show labels on mobile, or on desktop if not collapsed */}
              {(isMobileVariant || !collapsed) && <span>{item.label}</span>}
            </div>
          </Button>
        ))}

      </nav>
      
      <div className={cn("border-t border-gray-200", !isMobileVariant && collapsed ? "p-2" : "p-3")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className={cn(
                "w-full flex items-center h-9 hover:bg-muted transition-colors duration-200",
                !isMobileVariant && collapsed ? "justify-center px-2" : "justify-start text-left px-3"
              )}
            >
              <Avatar className={cn("bg-primary-100 text-primary-700 shadow-sm", !isMobileVariant && collapsed ? "h-6 w-6" : "h-6 w-6 mr-2")}>
                <AvatarFallback className="text-xs">{companyInitials}</AvatarFallback>
              </Avatar>
              {/* Always show user info on mobile, or on desktop if not collapsed */}
              {(isMobileVariant || !collapsed) && (
                <div>
                  <p className="text-sm font-medium text-gray-800">{displayName}</p>
                  <p className="text-xs text-gray-500">{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "User"}</p>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 p-1.5 rounded-md">
            <DropdownMenuItem className="cursor-pointer p-2 hover:bg-muted rounded-md transition-colors duration-150 text-sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4 text-primary-500" />
              <span className="font-medium">Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
