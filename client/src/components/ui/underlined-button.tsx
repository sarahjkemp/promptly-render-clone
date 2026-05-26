import * as React from "react";
import { cn } from "@/lib/utils";
import { ButtonProps } from "@/components/ui/button";

export interface UnderlinedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'muted';
}

const UnderlinedButton = React.forwardRef<HTMLButtonElement, UnderlinedButtonProps>(
  ({ className, children, icon, variant = 'default', ...props }, ref) => {
    const baseStyle = "inline-flex items-center gap-1.5 relative font-medium transition-colors pb-0.5 px-0.5";
    const variantStyle = variant === 'default' 
      ? "text-primary-600 hover:text-primary-800"
      : "text-gray-600 hover:text-gray-800";
    
    // Underline animation styling with improved animation
    const underlineStyle = "after:content-[''] after:absolute after:w-full after:h-0.5 after:bottom-0 after:left-0 after:bg-current after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300 after:origin-bottom-left";
    
    return (
      <button
        className={cn(baseStyle, variantStyle, underlineStyle, className)}
        ref={ref}
        {...props}
      >
        {icon}
        {children}
      </button>
    );
  }
);

UnderlinedButton.displayName = "UnderlinedButton";

export { UnderlinedButton };