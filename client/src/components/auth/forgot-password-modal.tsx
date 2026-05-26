import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ForgotPasswordModal({
  isOpen,
  onClose,
}: ForgotPasswordModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Forgot Your Password?
          </DialogTitle>
          <DialogDescription>
            If you've forgotten your password, please contact your administrator for assistance.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <p className="text-sm text-blue-800 font-medium mb-2">What happens next:</p>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Your administrator will generate a secure temporary password</li>
            <li>• You'll receive your new password securely</li>
            <li>• You'll be required to change it on your next login</li>
          </ul>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}