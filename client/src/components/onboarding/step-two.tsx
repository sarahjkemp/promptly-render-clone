import { useUserStore } from "@/lib/user-store";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const toneOptions = [
  { id: "professional", label: "Professional" },
  { id: "conversational", label: "Conversational" },
  { id: "authoritative", label: "Authoritative" },
  { id: "friendly", label: "Friendly" },
  { id: "innovative", label: "Innovative" },
  { id: "formal", label: "Formal" },
];

const regionOptions = [
  { id: "north_america", label: "North America" },
  { id: "europe", label: "Europe" },
  { id: "asia_pacific", label: "Asia Pacific" },
  { id: "latin_america", label: "Latin America" },
  { id: "middle_east", label: "Middle East & Africa" },
];

const formSchema = z.object({
  tones: z.array(z.string()).min(1, {
    message: "Please select at least one tone.",
  }),
  keyPhrases: z.string().min(2, {
    message: "Please enter key phrases or terms.",
  }),
  regions: z.array(z.string()).min(1, {
    message: "Please select at least one region.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface StepTwoProps {
  onNext: () => void;
  onBack: () => void;
}

export default function StepTwo({ onNext, onBack }: StepTwoProps) {
  const { user } = useUserStore();
  const { toast } = useToast();
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tones: [],
      keyPhrases: "",
      regions: [],
    },
  });

  const addRegion = (region: string) => {
    if (!selectedRegions.includes(region)) {
      const newRegions = [...selectedRegions, region];
      setSelectedRegions(newRegions);
      form.setValue("regions", newRegions);
    }
  };

  const removeRegion = (region: string) => {
    const newRegions = selectedRegions.filter(r => r !== region);
    setSelectedRegions(newRegions);
    form.setValue("regions", newRegions);
  };

  // Add query client
  const queryClient = useQueryClient();
  const setUser = useUserStore(state => state.setUser);
  const [isSaving, setIsSaving] = useState(false);

  // Collect all onboarding data
  const collectOnboardingData = (values: FormValues) => {
    const companyName = localStorage.getItem('onboarding_company') || user?.username || "";
    const industry = localStorage.getItem('onboarding_industry') || "";
    const companySize = localStorage.getItem('onboarding_size') || "";
    
    return {
      companyName,
      industry,
      companySize,
      tone: values.tones.join(", "),
      keywords: values.keyPhrases,
      targetRegions: values.regions.join(", "),
      onboardingCompleted: true // Mark as completed
    };
  };

  // Mutation to save all onboarding data
  const saveCompanyProfileMutation = useMutation({
    mutationFn: async (profileData: any) => {
      const response = await fetch('/api/company-profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
        credentials: 'include'
      });
      return await response.json();
    },
    onSuccess: (data) => {
      // Update cache
      queryClient.setQueryData(['/api/company-profile'], data);
      // Refresh user data
      fetch('/api/user', { credentials: 'include' })
        .then(res => res.json())
        .then(userData => {
          setUser(userData);
          setIsSaving(false);
          // Mark this step as complete in localStorage for consistency
          localStorage.setItem('onboarding_step', '3');
          onNext();
        });
    },
    onError: () => {
      setIsSaving(false);
      toast({
        title: "Error saving profile",
        description: "There was an error saving your profile data. Please try again.",
        variant: "destructive",
      });
    }
  });

  function onSubmit(values: FormValues) {
    setIsSaving(true);
    
    // Store in localStorage for consistency
    localStorage.setItem('onboarding_tones', JSON.stringify(values.tones));
    localStorage.setItem('onboarding_keyphrases', values.keyPhrases);
    localStorage.setItem('onboarding_regions', JSON.stringify(values.regions));
    
    toast({
      title: "Saving brand settings",
      description: "Finalizing your account setup...",
    });
    
    // Save to database and mark onboarding as completed
    const profileData = collectOnboardingData(values);
    saveCompanyProfileMutation.mutate(profileData);
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-6 md:p-8 slide-in">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Brand Voice Settings</h1>
        <p className="text-gray-600 mt-2">Help us understand your brand's tone and style for content generation.</p>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="tones"
            render={() => (
              <FormItem>
                <FormLabel>Brand Tone</FormLabel>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {toneOptions.map((option) => (
                    <FormField
                      key={option.id}
                      control={form.control}
                      name="tones"
                      render={({ field }) => {
                        const isSelected = field.value?.includes(option.id);
                        return (
                          <FormItem
                            key={option.id}
                            className="space-y-0"
                          >
                            <FormControl>
                              <div 
                                className={`
                                  cursor-pointer py-3 px-4 rounded-md text-center hover:bg-primary/5 transition-colors
                                  ${isSelected ? 'bg-primary text-white hover:bg-primary' : 'bg-gray-100 text-gray-700'}
                                `}
                                onClick={() => {
                                  const updatedTones = isSelected
                                    ? field.value?.filter(value => value !== option.id)
                                    : [...(field.value || []), option.id];
                                  field.onChange(updatedTones);
                                }}
                              >
                                {option.label}
                              </div>
                            </FormControl>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="keyPhrases"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Key Phrases or Terms</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Enter common phrases your brand uses, separated by commas" 
                    {...field} 
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="regions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Regions</FormLabel>
                <Select
                  onValueChange={(value) => {
                    addRegion(value);
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target regions" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {regionOptions.map((region) => (
                      <SelectItem
                        key={region.id}
                        value={region.id}
                        disabled={selectedRegions.includes(region.id)}
                      >
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedRegions.map((region) => {
                    const regionLabel = regionOptions.find(r => r.id === region)?.label || region;
                    return (
                      <Badge
                        key={region}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {regionLabel}
                        <button
                          type="button"
                          onClick={() => removeRegion(region)}
                          className="text-xs ml-1 hover:text-destructive"
                        >
                          &times;
                        </button>
                      </Badge>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="flex justify-between pt-4">
            <Button type="button" variant="outline" onClick={onBack} disabled={isSaving}>
              Back
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                "Complete Setup"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
