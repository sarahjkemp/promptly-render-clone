import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage;
    try {
      // Try to parse as JSON first
      const errorData = await res.json();
      errorMessage = errorData.message || res.statusText;
      
      // Add specific handling for authentication errors
      if (res.status === 401) {
        console.error("Authentication error:", errorMessage);
        errorMessage = "Authentication required. Please log in again.";
      }
    } catch (e) {
      // Fallback to text if not JSON
      const text = await res.text();
      errorMessage = text || res.statusText;
    }
    
    throw new Error(`${res.status}: ${errorMessage}`);
  }
}

// API request helper with method shortcuts
export const apiRequest = Object.assign(
  async function apiRequest(
    method: string,
    url: string,
    data?: unknown | undefined,
  ): Promise<Response> {
    // Always include credentials and set explicit Content-Type
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        // Add cache control to prevent caching of API requests
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // Always include credentials for auth cookies
    });

    // Log authentication issues to the console for debugging
    if (res.status === 401) {
      console.warn(`Authentication failed for ${method} request to ${url}`);
    }

    await throwIfResNotOk(res);
    return res;
  },
  {
    get: (url: string) => apiRequest("GET", url),
    post: (url: string, data?: unknown) => apiRequest("POST", url, data),
    put: (url: string, data?: unknown) => apiRequest("PUT", url, data),
    patch: (url: string, data?: unknown) => apiRequest("PATCH", url, data),
    delete: (url: string) => apiRequest("DELETE", url),
  }
);

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: {
        // Add cache control to prevent caching of API requests
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      }
    });

    // Log authentication issues to the console
    if (res.status === 401) {
      console.warn(`Authentication failed for query to ${queryKey[0]}`);
      
      if (unauthorizedBehavior === "returnNull") {
        console.info("Returning null as configured for 401 response");
        return null;
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Session keep-alive mechanism to prevent 401 errors during extended work
// Pings the server every 5 minutes to keep the session active
let keepAliveInterval: NodeJS.Timeout | null = null;

export function startSessionKeepAlive() {
  // Clear any existing interval
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  
  // Ping the server every 5 minutes (well below typical 30-minute session timeout)
  keepAliveInterval = setInterval(async () => {
    try {
      await fetch('/api/user', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      console.log('Session keep-alive ping successful');
    } catch (error) {
      console.warn('Session keep-alive ping failed:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

export function stopSessionKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}
