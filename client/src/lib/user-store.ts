import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@shared/schema'

// Extended user type with company profile
export type UserWithProfile = Omit<User, 'password'> & {
  password?: string; // Make password optional since it's removed by the server
  companyProfile?: {
    id: number;
    name: string;
    industry?: string | null;
    companySize?: string | null;
    keywords?: string[] | null;
    tone?: string | null;
    targetRegions?: string[] | null;
    onboardingCompleted?: boolean;
    createdAt?: string | Date;
  } | null;
}

type UserStore = {
  user: UserWithProfile | null;
  isSignedIn: boolean;
  isLoading: boolean;
  hasError: boolean;
  setUser: (user: UserWithProfile | null) => void;
  clearUser: () => void;
  updateUserProfile: (userData: Partial<UserWithProfile>) => void;
  checkAuth: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: boolean) => void;
}

// Create Zustand store with persistence
export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      isSignedIn: false,
      isLoading: true,
      hasError: false,
      
      // Set user data and mark as signed in
      setUser: (user) => {
        console.log("User data synced to store:", user);
        set({
          user,
          isSignedIn: !!user,
          isLoading: false,
          hasError: false
        });
      },
      
      // Clear user data on logout
      clearUser: () => {
        set({
          user: null,
          isSignedIn: false,
          isLoading: false,
          hasError: false
        });
      },
      
      // Update specific user profile properties
      updateUserProfile: (userData) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null
        }));
      },
      
      // Set loading state
      setLoading: (loading) => {
        set({ isLoading: loading });
      },
      
      // Set error state
      setError: (error) => {
        set({ hasError: error });
      },
      
      // Check authentication status
      checkAuth: async () => {
        const { setUser, clearUser, setLoading, setError } = get();
        
        try {
          setLoading(true);
          setError(false);
          
          const response = await fetch('/api/user', {
            credentials: 'include'
          });
          
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else {
            clearUser();
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          clearUser();
          setError(true);
        }
      }
    }),
    {
      name: 'promptly-user-store',
      // Save user and auth state in storage (exclude loading/error as they're temporary)
      partialize: (state) => ({ 
        user: state.user,
        isSignedIn: state.isSignedIn 
      }),
      // Ensure we use proper storage
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          
          try {
            // Parse stored state
            const data = JSON.parse(str);
            
            // Ensure isSignedIn is consistent with user data
            if (data.state && data.state.user) {
              data.state.isSignedIn = true;
            }
            
            return data;
          } catch (e) {
            console.error("Error parsing stored state:", e);
            return null;
          }
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        }
      }
    }
  )
)

