import * as React from "react"

// Set a slightly higher breakpoint to ensure mobile view works properly
const MOBILE_BREAKPOINT = 850

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(
    // Default to mobile for SSR
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : true
  )

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    // Function to update the state
    const updateState = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    // Add event listener
    window.addEventListener('resize', updateState)
    
    // Call once to set initial state
    updateState()

    // Remove event listener on cleanup
    return () => window.removeEventListener('resize', updateState)
  }, [])

  return isMobile
}
