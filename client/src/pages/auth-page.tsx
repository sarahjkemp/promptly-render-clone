import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, InsertUser } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthActions } from "@/hooks/use-auth-actions";
import { useUserStore } from "@/lib/user-store";
import { ForgotPasswordModal } from "@/components/auth/forgot-password-modal";

const loginSchema = z.object({
  username: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

const signupSchema = z.object({
  name: z.string().min(2, { message: "Full name is required" }),
  username: z.string().email({ message: "Please enter a valid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
  confirmPassword: z.string(),
  companyName: z.string().min(1, { message: "Company name is required" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type SignupFormValues = z.infer<typeof signupSchema>;

export default function AuthPage() {
  const { loginMutation, registerMutation } = useAuthActions();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      username: "",
      password: "",
      confirmPassword: "",
      companyName: "",
    },
  });

  function onLoginSubmit(values: LoginFormValues) {
    loginMutation.mutate(values);
  }

  function onSignupSubmit(values: SignupFormValues) {
    const { confirmPassword, companyName, ...userData } = values;
    
    // Pass through all required fields for the new user schema
    // Role is hardcoded to "editor" for security - no user role selection allowed
    registerMutation.mutate({
      ...userData,
      role: "editor", // Force all new signups to editor role
      // Additional company data passed through the registration process
      companyName, // This gets picked up by the backend and used to create a company profile
    });
  }

  // Removed redirected check to avoid state issues

  return (
    <div className="auth-container w-full min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Brand */}
      <div className="hidden lg:flex flex-col justify-center items-center w-1/2 bg-primary text-white p-8">
        <img 
          src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
          alt="PR professionals collaborating" 
          className="rounded-xl w-4/5 mb-8 shadow-lg"
        />
        <div className="space-y-4 text-center max-w-md">
          <h1 className="text-3xl font-bold">PRomptly</h1>
          <p className="text-lg text-primary-100">Turn your company insights into PR ready content – PRomptly!</p>
          <div className="mt-6 text-left">
            <p className="text-lg font-semibold mb-3">Generate:</p>
            <ul className="list-disc list-inside space-y-2 text-primary-100">
              <li>Byline article</li>
              <li>Press pitch</li>
              <li>Suggested journalist and publication targets</li>
              <li>A media worthy angle that can also be used for social media, decks, quick pitches… and more!</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md p-8 bg-card rounded-xl shadow-sm">
          <div className="mb-10">
            <div className="flex justify-center mb-8">
              <div className="flex items-center">
                <svg 
                  className="h-12 w-12 text-primary mr-3" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-3xl font-bold text-gray-900">PRomptly</span>
              </div>
            </div>
            
            <Tabs 
              defaultValue="login" 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Log In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-5">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="name@company.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <FormLabel htmlFor="password">Password</FormLabel>
                        <button 
                          type="button"
                          onClick={() => setShowForgotPassword(true)}
                          className="text-sm text-primary hover:text-primary/90"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "Logging in..." : "Log In"}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
              
              <TabsContent value="signup">
                <Form {...signupForm}>
                  <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                    <FormField
                      control={signupForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Smith" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={signupForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work Email</FormLabel>
                          <FormControl>
                            <Input placeholder="name@company.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={signupForm.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Acme Corporation" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    

                    <FormField
                      control={signupForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Create Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="8+ characters" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={signupForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full mt-2" 
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                    </Button>
                    
                    <p className="text-xs text-gray-500 text-center mt-4">
                      By signing up, you agree to our <a href="#" className="text-primary">Terms</a> and <a href="#" className="text-primary">Privacy Policy</a>.
                    </p>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <ForgotPasswordModal 
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  );
}
