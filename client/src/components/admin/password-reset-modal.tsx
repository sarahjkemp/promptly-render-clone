import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Eye, EyeOff, Lock, RotateCcw, Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";

type PasswordResetResponse = {
  success: boolean;
  message: string;
  temporaryPassword: string;
  userEmail: string;
};

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: number;
    name: string;
    email: string;
  };
  currentUserId: number;
}

export function PasswordResetModal({
  isOpen,
  onClose,
  user,
  currentUserId,
}: PasswordResetModalProps) {
  const [temporaryPassword, setTemporaryPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/admin/users/${user.id}/reset-password`);
      return response.json() as Promise<PasswordResetResponse>;
    },
    onSuccess: (data) => {
      setTemporaryPassword(data.temporaryPassword);
      toast({
        title: "Password reset successful",
        description: `Temporary password generated for ${data.userEmail}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Password reset failed",
        description: error.message || "Failed to reset password",
      });
    },
  });

  const handleReset = () => {
    resetPasswordMutation.mutate();
  };

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      toast({
        title: "Password copied",
        description: "Temporary password copied to clipboard",
      });
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Could not copy password to clipboard",
      });
    }
  };

  const handleClose = () => {
    setTemporaryPassword("");
    setCopied(false);
    onClose();
  };

  // Prevent resetting current user's password
  const isCurrentUser = user.id === currentUserId;

  if (isCurrentUser) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Cannot Reset Your Own Password
            </DialogTitle>
            <DialogDescription>
              For security reasons, you cannot reset your own password from the admin panel.
              Please use your profile settings to change your password.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Reset Password for {user.name || user.email}
          </DialogTitle>
          <DialogDescription>
            {!temporaryPassword ? (
              "Generate a secure temporary password that the user will need to change on their next login."
            ) : (
              "Temporary password generated successfully. Please securely share this password with the user."
            )}
          </DialogDescription>
        </DialogHeader>

        {temporaryPassword ? (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Temporary Password:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="h-6 w-6 p-0"
                >
                  {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={temporaryPassword}
                  type={showPassword ? "text" : "password"}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPassword}
                  className="shrink-0"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <p className="text-sm text-blue-800 font-medium mb-1">Instructions:</p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Securely share this password with {user.email}</li>
                <li>• User must change password on their next login</li>
                <li>• This password will expire after first successful login</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>This action will:</strong>
            </p>
            <ul className="text-xs text-orange-700 mt-1 space-y-1">
              <li>• Generate a secure 16-character temporary password</li>
              <li>• Require {user.email} to change their password on next login</li>
              <li>• Invalidate any current login sessions</li>
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={resetPasswordMutation.isPending}
          >
            {temporaryPassword ? "Done" : "Cancel"}
          </Button>
          {!temporaryPassword && (
            <Button
              onClick={handleReset}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? (
                <>
                  <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Reset Password
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}