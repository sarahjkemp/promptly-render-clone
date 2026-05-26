/**
 * Enhanced navigation progress indicator
 * Shows a subtle progress bar during page transitions
 * Designed to be less distracting while providing visual feedback
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

interface NavigationProgressProps {
  className?: string; 
}

export function NavigationProgress({ className = "" }: NavigationProgressProps) {
  const [location] = useLocation();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previousLocation, setPreviousLocation] = useState(location);
  
  useEffect(() => {
    // When location changes, show the progress bar
    if (location !== previousLocation) {
      setVisible(true);
      setProgress(0);
      
      // Use a faster simulate progress timing
      const interval = setInterval(() => {
        setProgress((prev) => {
          // Speed up the progress simulation and jump to 100% quicker
          const increment = prev < 30 ? 10 : prev < 60 ? 8 : 5;
          const newProgress = Math.min(prev + increment, 98);
          return newProgress;
        });
      }, 15); // Faster interval (15ms vs 50ms)
      
      // Update previous location
      setPreviousLocation(location);
      
      // Clean up
      return () => {
        clearInterval(interval);
        
        // Complete the progress quickly
        setProgress(100);
        
        // Hide faster
        setTimeout(() => {
          setVisible(false);
        }, 150); // Faster timeout (150ms vs 200ms)
      };
    }
  }, [location, previousLocation]);
  
  // No need to render anything if not visible
  if (!visible) return null;
  
  return (
    <div 
      className={`fixed top-0 left-0 right-0 h-0.5 bg-primary-400 z-50 transition-all duration-150 ${className}`}
      style={{ 
        width: `${progress}%`,
        opacity: progress >= 99 ? 0 : 0.7 // More subtle opacity
      }}
    />
  );
}