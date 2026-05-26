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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  companyName: z.string().min(2, {
    message: "Company name must be at least 2 characters.",
  }),
  industry: z.string().min(1, {
    message: "Please select an industry.",
  }),
  companySize: z.string().min(1, {
    message: "Please select company size.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface StepOneProps {
  onNext: () => void;
}

export default function StepOne({ onNext }: StepOneProps) {
  const { user } = useUserStore();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: user?.username || "",
      industry: "",
      companySize: "",
    },
  });

  function onSubmit(values: FormValues) {
    // In a real app, this would update a state or call an API
    localStorage.setItem('onboarding_company', values.companyName);
    localStorage.setItem('onboarding_industry', values.industry);
    localStorage.setItem('onboarding_industry_custom', "");
    localStorage.setItem('onboarding_size', values.companySize);
    localStorage.setItem('onboarding_step', '2');
    
    toast({
      title: "Company info saved",
      description: "Let's continue with your brand settings.",
    });
    
    onNext();
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-6 md:p-8 slide-in">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome to PRomptly!</h1>
        <p className="text-gray-600 mt-2">Let's set up your company profile to help us tailor your experience.</p>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name</FormLabel>
                <FormControl>
                  <Input placeholder="Acme PR Agency" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="industry"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Industry</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your industry" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pr_agency">PR Agency</SelectItem>
                    <SelectItem value="tech">Technology</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="companySize"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Size</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select company size" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1-10">1-10 employees</SelectItem>
                    <SelectItem value="11-50">11-50 employees</SelectItem>
                    <SelectItem value="51-200">51-200 employees</SelectItem>
                    <SelectItem value="201-500">201-500 employees</SelectItem>
                    <SelectItem value="501+">501+ employees</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="pt-4">
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
