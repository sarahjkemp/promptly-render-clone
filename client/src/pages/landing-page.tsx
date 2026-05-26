import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Layers, Sparkles, Newspaper, BarChart2, ChevronRight, CheckCircle } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <header className="bg-background shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Layers className="h-8 w-8 text-primary mr-2" />
            <span className="text-xl font-bold text-gray-900">PRomptly</span>
          </div>
          <div className="space-x-2">
            <Link href="/auth">
              <Button variant="outline" className="mr-2">
                Sign In
              </Button>
            </Link>
            <Link href="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="py-16 md:py-24 container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
              Transform News into Press-Ready Content with AI
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              PRomptly helps PR professionals create compelling content from news articles in minutes, 
              all while maintaining your brand's unique voice.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/auth">
                <Button size="lg" className="flex items-center">
                  Start Free Trial <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              </Link>
              <Button variant="outline" size="lg">
                Watch Demo
              </Button>
            </div>
            
            <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-primary mr-2" />
                <span className="text-gray-700">Article Summaries</span>
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-primary mr-2" />
                <span className="text-gray-700">PR Angles</span>
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-primary mr-2" />
                <span className="text-gray-700">Brand Voice Matching</span>
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-primary mr-2" />
                <span className="text-gray-700">Email Pitches</span>
              </div>
            </div>
          </div>
          
          <div className="rounded-xl overflow-hidden shadow-xl">
            <img 
              src="https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-1.2.1&auto=format&fit=crop&w=1567&q=80" 
              alt="PR professionals using PRomptly" 
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Your AI PR Assistant</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Spend less time writing and more time on strategy with our suite of AI-powered tools
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-xl p-6 shadow-sm">
              <Newspaper className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Article Summaries</h3>
              <p className="text-gray-600">
                Transform lengthy news articles into concise, impactful summaries ready for press releases.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-6 shadow-sm">
              <Sparkles className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Brand Voice Matching</h3>
              <p className="text-gray-600">
                Ensure all content matches your brand's unique tone, style, and messaging guidelines.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-6 shadow-sm">
              <BarChart2 className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">PR Performance Analytics</h3>
              <p className="text-gray-600">
                Track the impact of your PR content with built-in analytics and reporting tools.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA */}
      <section className="py-16 md:py-24 bg-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to transform your PR workflow?</h2>
          <p className="text-xl mb-8 text-primary-100 max-w-2xl mx-auto">
            Join thousands of PR professionals using PRomptly to create better content faster.
          </p>
          <Link href="/auth">
            <Button size="lg" variant="secondary" className="text-primary">
              Sign Up for Free
            </Button>
          </Link>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center border-b border-gray-800 pb-8 mb-8">
            <div className="flex items-center">
              <Layers className="h-8 w-8 text-primary mr-2" />
              <span className="text-xl font-bold text-white">PRomptly</span>
            </div>
            <div className="space-x-6">
              <a href="#" className="hover:text-white transition">Twitter</a>
              <a href="#" className="hover:text-white transition">LinkedIn</a>
              <a href="#" className="hover:text-white transition">Facebook</a>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-white font-medium mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition">Features</a></li>
                <li><a href="#" className="hover:text-white transition">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition">Integrations</a></li>
                <li><a href="#" className="hover:text-white transition">Enterprise</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-4">Resources</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition">Guides</a></li>
                <li><a href="#" className="hover:text-white transition">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition">API</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition">About</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Careers</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms</a></li>
                <li><a href="#" className="hover:text-white transition">Security</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-gray-800 text-sm text-center">
            &copy; {new Date().getFullYear()} PRomptly. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}