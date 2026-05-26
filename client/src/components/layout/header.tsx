import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Menu, Bell, Plus } from "lucide-react";
import Sidebar from "./sidebar";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useUserStore } from "@/lib/user-store";

interface HeaderProps {
  title: string;
}

function getContextualTitle(title: string, location: string): string {
  // For results pages showing article content
  if (location.startsWith('/results/')) {
    return 'Content';
  }
  
  // For other specific pages, use contextual names
  switch (title) {
    case 'Document Management':
      return 'Documents';
    case 'Company Settings':
    case 'Personal Settings':
      return 'Settings';
    case 'Article History':
      return 'History';
    case 'Add Content':
      return 'Add Content';
    case 'Admin Panel':
      return 'Admin';
    default:
      return title;
  }
}

export default function Header({ title }: HeaderProps) {
  const [location] = useLocation();
  // Get user data from our store
  const { user } = useUserStore();
  
  // Log user data to debug
  useEffect(() => {
    console.log("Header user data:", user);
  }, [user]);
  
  // Use name for display, fallback to other options if not available
  const displayName = user?.name || 
                     (user?.companyProfile?.name) || 
                     user?.email ||
                     user?.username || 
                     "User";
  
  // Use initials from name for avatar
  const userInitials = displayName.substring(0, 2).toUpperCase();

  return (
    <header className="bg-background border-b border-border flex items-center justify-between px-3 py-2 shadow-sm">
      <div className="md:hidden flex items-center">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted transition-colors duration-200">
              <Menu className="h-3.5 w-3.5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 rounded-r-2xl">
            <SheetTitle className="sr-only">Mobile Navigation Menu</SheetTitle>
            <SheetDescription className="sr-only">
              Navigation menu for mobile device access
            </SheetDescription>
            <div className="flex flex-col h-full">
              <Sidebar className="w-full border-none" />
            </div>
          </SheetContent>
        </Sheet>
        
        <svg 
          className="h-4 w-4 text-primary-500 ml-2" 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
          <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-semibold text-gray-900 ml-1">PRomptly</span>
      </div>
      
      <div className="hidden md:block">
        <h1 className="text-base font-semibold text-gray-900">{getContextualTitle(title, location)}</h1>
      </div>
      
      <div className="flex items-center">
        <Avatar className="h-6 w-6 md:flex hidden bg-primary-100 text-primary-700 transition-all duration-200 hover:ring-1 hover:ring-primary-100 cursor-pointer">
          <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
