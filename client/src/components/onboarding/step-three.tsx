import { useState } from "react";
import { useUserStore } from "@/lib/user-store";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Plus, Loader2 } from "lucide-react";

interface StepThreeProps {
  onNext: () => void;
  onBack: () => void;
}

export default function StepThree({ onNext, onBack }: StepThreeProps) {
  const { user } = useUserStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const setUser = useUserStore(state => state.setUser);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>("#6366F1"); // Default primary color

  // Collect all onboarding data from previous steps
  const collectOnboardingData = () => {
    const companyName = localStorage.getItem('onboarding_company') || user?.username || "";
    const industry = localStorage.getItem('onboarding_industry') || "";
    const companySize = localStorage.getItem('onboarding_size') || "";
    const tones = JSON.parse(localStorage.getItem('onboarding_tones') || "[]");
    const keyPhrases = localStorage.getItem('onboarding_keyphrases') || "";
    const regions = JSON.parse(localStorage.getItem('onboarding_regions') || "[]");
    
    return {
      companyName,
      industry,
      companySize,
      tone: tones.join(", "),
      keywords: keyPhrases,
      targetRegions: regions.join(", ")
    };
  };

  // Mutation to save all onboarding data to company profile
  const saveCompanyProfileMutation = useMutation({
    mutationFn: async (profileData: any) => {
      const response = await apiRequest.patch("/api/company-profile", profileData);
      return await response.json();
    },
    onSuccess: (data) => {
      // Update cache
      queryClient.setQueryData(["/api/company-profile"], data);
      // Refresh user data
      fetch("/api/user", { credentials: "include" })
        .then(res => res.json())
        .then(userData => {
          setUser(userData);
          setIsUploading(false);
          // Mark this step as complete in localStorage for consistency
          localStorage.setItem('onboarding_step', '4');
          onNext();
        });
    },
    onError: () => {
      setIsUploading(false);
      toast({
        title: "Error saving profile",
        description: "There was an error saving your profile data. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleFinish = () => {
    setIsUploading(true);
    
    toast({
      title: "Setup in progress",
      description: "Saving your brand settings...",
    });
    
    // Get data from previous steps and save all at once
    const profileData = collectOnboardingData();
    saveCompanyProfileMutation.mutate(profileData);
  };

  // Handle color selection
  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
  };

  return (
    <div className="bg-card rounded-xl shadow-sm p-6 md:p-8 slide-in">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Brand Guide</h1>
        <p className="text-gray-600 mt-2">Share your brand guidelines to help us better match your style.</p>
      </div>
      
      <div className="space-y-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer">
          <div className="space-y-2">
            <Upload className="h-12 w-12 mx-auto text-gray-400" />
            <p className="text-gray-700">Drag and drop your brand guide or</p>
            <Button variant="link" type="button" className="text-primary font-medium">
              browse files
            </Button>
            <p className="text-xs text-gray-500">Supports PDF, DOC, DOCX up to 25MB</p>
          </div>
        </div>
        
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-2">Brand Colors (Optional)</Label>
          <div className="flex flex-wrap gap-3">
            <div 
              className={`w-12 h-12 rounded-full bg-primary cursor-pointer border-2 ${selectedColor === '#6366F1' ? 'border-black' : 'border-gray-200'}`}
              onClick={() => handleColorSelect('#6366F1')}
            ></div>
            <div 
              className={`w-12 h-12 rounded-full bg-gray-600 cursor-pointer border-2 ${selectedColor === '#4B5563' ? 'border-black' : 'border-gray-200'}`}
              onClick={() => handleColorSelect('#4B5563')}
            ></div>
            <div 
              className={`w-12 h-12 rounded-full bg-green-500 cursor-pointer border-2 ${selectedColor === '#10B981' ? 'border-black' : 'border-gray-200'}`}
              onClick={() => handleColorSelect('#10B981')}
            ></div>
            <div 
              className={`w-12 h-12 rounded-full bg-gray-800 cursor-pointer border-2 ${selectedColor === '#1F2937' ? 'border-black' : 'border-gray-200'}`}
              onClick={() => handleColorSelect('#1F2937')}
            ></div>
            <Button variant="outline" className="w-12 h-12 rounded-full p-0 flex items-center justify-center">
              <Plus className="h-5 w-5 text-gray-400" />
            </Button>
          </div>
        </div>
        
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-2">Brand Logo (Optional)</Label>
          <div className="border border-gray-300 rounded-md p-4 text-center hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer">
            <Button variant="link" type="button" className="text-primary font-medium">
              Upload logo
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col gap-4 pt-4">
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={onBack} disabled={isUploading}>
              Back
            </Button>
            <Button 
              type="button" 
              onClick={handleFinish} 
              disabled={isUploading}
              className="relative"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Finish Setup"
              )}
            </Button>
          </div>
          
          <div className="text-center">
            <Button
              type="button"
              variant="link"
              onClick={() => {
                // Skip onboarding and mark as completed
                const skipData = {
                  onboardingCompleted: true
                };
                saveCompanyProfileMutation.mutate(skipData);
              }}
              disabled={isUploading}
            >
              Skip (Use Defaults)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
