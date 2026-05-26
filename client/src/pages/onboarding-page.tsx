import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useUserStore } from "@/lib/user-store";
import OnboardingLayout from "@/components/onboarding/onboarding-layout";
import StepOne from "@/components/onboarding/step-one";
import StepTwo from "@/components/onboarding/step-two";
import StepThree from "@/components/onboarding/step-three";
import Complete from "@/components/onboarding/complete";

// Type for tracking onboarding state
type OnboardingState = {
  currentStep: number;
  completed: boolean;
};

export default function OnboardingPage() {
  const { user } = useUserStore();
  const [activeStep, setActiveStep] = useState<number>(1);
  const [_, setLocation] = useLocation();

  // Initialize onboarding state from localStorage if available
  useEffect(() => {
    // Only run once on mount and when user changes
    if (!user) return;
    
    // If user has completed onboarding in the database, redirect to dashboard
    if (user.companyProfile?.onboardingCompleted) {
      setLocation("/dashboard");
      return;
    }
    
    // Try to restore the current step from localStorage (only when component mounts)
    const savedStep = localStorage.getItem('onboarding_step');
    if (savedStep) {
      const step = parseInt(savedStep, 10);
      if (!isNaN(step) && step >= 1 && step <= 4) {
        setActiveStep(step);
      }
    }
    
    // Check if onboarding was completed in localStorage
    const completed = localStorage.getItem('onboarding_completed') === 'true';
    if (completed) {
      setLocation("/dashboard");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyProfile?.onboardingCompleted, setLocation]);

  const handleNext = () => {
    const nextStep = activeStep + 1;
    setActiveStep(nextStep);
    // Save current step to localStorage
    localStorage.setItem('onboarding_step', nextStep.toString());
  };

  const handleBack = () => {
    const prevStep = Math.max(1, activeStep - 1);
    setActiveStep(prevStep);
    // Save current step to localStorage
    localStorage.setItem('onboarding_step', prevStep.toString());
  };

  return (
    <OnboardingLayout currentStep={activeStep}>
      {activeStep === 1 && <StepOne onNext={handleNext} />}
      {activeStep === 2 && <StepTwo onNext={handleNext} onBack={handleBack} />}
      {/* Skip step 3 (brand guide) for MVP */}
      {activeStep === 3 && <Complete />}
    </OnboardingLayout>
  );
}
