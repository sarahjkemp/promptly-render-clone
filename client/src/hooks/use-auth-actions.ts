import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { useUserStore } from '@/lib/user-store'
import { useLocation } from 'wouter'

type LoginCredentials = {
  username: string;
  password: string;
}

type RegisterData = {
  name: string;
  username: string;
  password: string;
  role?: string;
  companyName?: string;
}

export function useAuthActions() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [_, setLocation] = useLocation()
  const { setUser, clearUser } = useUserStore()
  
  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
        credentials: 'include',
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Login failed')
      }
      
      return res.json()
    },
    onSuccess: (userData) => {
      console.log("Login successful, user data:", userData);
      
      // Set user in store first
      setUser(userData);
      
      // Clear any cached query data to ensure fresh data on next fetch
      queryClient.clear();
      
      // Show toast notification
      toast({
        title: 'Login successful',
        description: 'Welcome back!',
      });
      
      // Trigger auth guard refresh instead of manual redirect
      window.dispatchEvent(new CustomEvent('login-success'));
    },
    onError: (error: Error) => {
      toast({
        title: 'Login failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
  
  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Registration failed')
      }
      
      return res.json()
    },
    onSuccess: (userData) => {
      console.log("Registration successful, user data:", userData);
      
      // Set user in store first
      setUser(userData);
      
      // Clear any cached query data to ensure fresh data on next fetch
      queryClient.clear();
      
      // Show toast notification
      toast({
        title: 'Registration successful',
        description: 'Your account has been created.',
      });
      
      // Trigger custom event to let SimpleAuthGuard handle the redirect after auth state update
      setTimeout(() => {
        console.log("Redirecting to onboarding...");
        window.dispatchEvent(new CustomEvent('registration-success'));
      }, 300);
    },
    onError: (error: Error) => {
      toast({
        title: 'Registration failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
  
  // Logout function
  const logout = async () => {
    try {
      console.log("Logging out...");
      
      // Call the server to invalidate the session
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      // Clear all React Query cache
      queryClient.clear();
      
      // Clear user state in Zustand
      clearUser();
      
      // Clear localStorage directly as a backup
      localStorage.removeItem('promptly-user-store');
      
      console.log("Logout complete, cleared store and cache");
      
      // Show toast notification
      toast({
        title: 'Logged out',
        description: 'You have been logged out successfully.',
      });
      
      // Trigger page refresh to reset auth state completely
      window.location.reload();
    } catch (error) {
      console.error("Logout error:", error);
      // Force reload even on error to clear stale state
      window.location.reload();
    }
  }
  
  return {
    loginMutation,
    registerMutation,
    logout,
  }
}