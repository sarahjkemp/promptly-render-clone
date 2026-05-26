import { useUserStore } from "@/lib/user-store";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Loader2 } from "lucide-react";

export default function Complete() {
  const [_, setLocation] = useLocation();
  const { user } = useUserStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const setUser = useUserStore(state => state.setUser);
  const [isCompleting, setIsCompleting] = useState(true);

  // Mutation to update the onboarding completed status
  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest.patch("/api/company-profile", {
        onboardingCompleted: true
      });
      return await response.json();
    },
    onSuccess: (data) => {
      // Update cache and store
      queryClient.setQueryData(["/api/company-profile"], data);
      // Get fresh user data including updated company profile
      fetch("/api/user", { credentials: "include" })
        .then(res => res.json())
        .then(userData => {
          setUser(userData);
          setIsCompleting(false);
          toast({
            title: "Setup completed",
            description: "Your account is ready to use.",
          });
        });
    },
    onError: () => {
      setIsCompleting(false);
      toast({
        title: "Setup error",
        description: "There was an error completing your setup. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Complete onboarding when the component mounts
  useEffect(() => {
    if (user && user.companyProfile && !user.companyProfile.onboardingCompleted) {
      completeOnboardingMutation.mutate();
    } else {
      setIsCompleting(false);
    }
  }, [user]);
  
  const handleGoToDashboard = () => {
    setLocation("/");
  };

  return (
    <div className="bg-card rounded-xl shadow-sm p-6 md:p-8 slide-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Setup Complete!</h1>
        <p className="text-gray-600 mt-2">Your PRomptly account is ready to use.</p>
      </div>
      
      <div className="space-y-6">
        <div className="bg-primary/10 p-4 rounded-md">
          <p className="text-primary">We've configured your account based on your settings. You can always modify these in your profile settings.</p>
        </div>
        
        <div className="text-center">
          <Button 
            onClick={handleGoToDashboard} 
            className="px-8 py-3" 
            disabled={isCompleting}
          >
            {isCompleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Finalizing Setup...
              </>
            ) : (
              "Go to Dashboard"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
