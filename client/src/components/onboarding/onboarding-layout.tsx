import { ReactNode } from "react";

interface OnboardingLayoutProps {
  children: ReactNode;
  currentStep: number;
}

export default function OnboardingLayout({ children, currentStep }: OnboardingLayoutProps) {
  const progressWidth = `${currentStep * 25}%`;
  
  return (
    <div className="w-full min-h-screen flex flex-col">
      {/* Header */}
      <header className="w-full bg-background shadow-sm py-4 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <svg 
              className="h-8 w-8 text-primary mr-2" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xl font-semibold text-gray-900">PRomptly</span>
          </div>
          <div className="text-sm text-gray-500">
            <span>Need help? </span>
            <a href="#" className="text-primary hover:text-primary/80">Contact us</a>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="w-full bg-gray-100">
        <div className="onboarding-progress-bar bg-primary" style={{ width: progressWidth }}></div>
      </div>

      {/* Content */}
      <div className="flex-grow flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
