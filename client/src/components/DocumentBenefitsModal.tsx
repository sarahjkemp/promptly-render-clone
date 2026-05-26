import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ArrowRight, FileText, Target, BarChart3, Building2 } from "lucide-react";

interface DocumentBenefitsModalProps {
  children?: React.ReactNode;
}

const BenefitsContent = () => (
  <div className="space-y-8 px-1">
    <div className="space-y-6">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mt-0.5">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground">Brand Consistency</h3>
          <p className="text-sm text-muted-foreground">
            Brand guidelines ensure consistent tone and messaging across all content
          </p>
        </div>
      </div>

      <div className="border-t border-border/50 pt-6">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mt-0.5">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">Data-Backed Claims</h3>
            <p className="text-sm text-muted-foreground">
              Research and statistics provide factual backing for stronger arguments
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border/50 pt-6">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mt-0.5">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">Strategic Positioning</h3>
            <p className="text-sm text-muted-foreground">
              Key messages help maintain strategic positioning and talking points
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border/50 pt-6">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mt-0.5">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">Rich Context</h3>
            <p className="text-sm text-muted-foreground">
              Company background adds relevant context and industry insights
            </p>
          </div>
        </div>
      </div>
    </div>

    <div className="border-t border-border pt-6">
      <p className="text-xs text-muted-foreground leading-relaxed">
        <strong>Tip:</strong> Upload your company documents before creating content to get the most accurate and on-brand results.
      </p>
    </div>
  </div>
);

export function DocumentBenefitsModal({ children }: DocumentBenefitsModalProps) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const trigger = children || (
    <Button 
      variant="outline" 
      size="sm" 
      className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-white border-primary transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 px-4 py-2 h-auto shadow-sm"
    >
      Learn more
      <ArrowRight className="h-4 w-4 ml-1.5" />
    </Button>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200" aria-describedby="document-benefits-description">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">How documents enhance your content</DialogTitle>
            <p id="document-benefits-description" className="sr-only">
              Benefits of uploading company documents for AI content generation
            </p>
          </DialogHeader>
          <BenefitsContent />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger}
      </DrawerTrigger>
      <DrawerContent className="animate-in slide-in-from-bottom-2 duration-300">
        <DrawerHeader className="text-left px-6">
          <DrawerTitle className="text-lg font-semibold">How documents enhance your content</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-8">
          <BenefitsContent />
        </div>
      </DrawerContent>
    </Drawer>
  );
}