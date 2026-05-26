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
import { HelpCircle, Brain, MessageSquare, BarChart3 } from "lucide-react";

interface UploadExamplesModalProps {
  children?: React.ReactNode;
}

const ExampleContent = () => (
  <div className="space-y-8 px-1">
    <div className="space-y-6">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mt-0.5">
          <Brain className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground">Strategy & planning</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>– Internal strategy memos</li>
            <li>– Investor decks</li>
            <li>– Board or pitch documents</li>
            <li>– Vision or mission statements</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/50 pt-6">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mt-0.5">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">Messaging & voice</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>– Messaging frameworks</li>
              <li>– Tone guides</li>
              <li>– Category POVs</li>
              <li>– Blog drafts or ghostwritten content</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-border/50 pt-6">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mt-0.5">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">Research & proof</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>– Proprietary research reports</li>
              <li>– Customer case studies or testimonials</li>
              <li>– New product or feature descriptions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div className="border-t border-border pt-6">
      <p className="text-xs text-muted-foreground leading-relaxed">
        <strong>Tip:</strong> The more context you provide, the better your AI-generated content will align with your company's voice and strategic messaging.
      </p>
    </div>
  </div>
);

export function UploadExamplesModal({ children }: UploadExamplesModalProps) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const trigger = children || (
    <Button 
      variant="outline" 
      size="sm" 
      className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-white border-primary transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 px-4 py-2 h-auto shadow-sm"
    >
      <HelpCircle className="h-4 w-4 mr-1.5" />
      View Examples
    </Button>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200" aria-describedby="upload-examples-description">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">What types of documents work best?</DialogTitle>
            <p id="upload-examples-description" className="sr-only">
              Examples of document types that work best for AI content generation
            </p>
          </DialogHeader>
          <ExampleContent />
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
          <DrawerTitle className="text-lg font-semibold">What types of documents work best?</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-8">
          <ExampleContent />
        </div>
      </DrawerContent>
    </Drawer>
  );
}