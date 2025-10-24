"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

const DISCLAIMER_KEY = "deoperator_disclaimer_accepted";

export function DisclaimerDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check if user has already accepted disclaimer
    const hasAccepted = localStorage.getItem(DISCLAIMER_KEY);
    if (!hasAccepted) {
      // Small delay to ensure smooth mount
      setTimeout(() => setOpen(true), 500);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(DISCLAIMER_KEY, "true");
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-w-lg bg-black/95 border border-amber-500/30 backdrop-blur-xl max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <AlertDialogTitle className="text-lg sm:text-xl font-bold gradient-text">
              Important Notice
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>

        <div className="text-gray-300 space-y-3 text-sm">
          <div className="font-semibold text-amber-200 text-center py-2 bg-amber-500/5 rounded-lg border border-amber-500/20">
            DeOperator is in early-stage development (Alpha)
          </div>

          <div className="space-y-2">
            <div>
              <span className="text-white font-semibold">⚠️ Use at Your Own Risk:</span> This experimental software may contain bugs or unexpected behavior.
            </div>

            <div>
              <span className="text-white font-semibold">📊 Financial Risk:</span> Trading crypto involves substantial risk. Only use funds you can afford to lose. Not financial advice.
            </div>

            <div>
              <span className="text-white font-semibold">🔐 Security:</span> Never share private keys. Always verify transactions before signing.
            </div>

            <div>
              <span className="text-white font-semibold">⚖️ No Liability:</span> Developers are not responsible for losses or issues from using this app.
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <div className="text-blue-200 text-xs">
              <span className="font-semibold">💡 Best Practice:</span> Start with small amounts. Verify all transactions. Do your own research (DYOR).
            </div>
          </div>

          <div className="text-xs text-gray-500 pt-3 border-t border-white/10">
            By clicking &quot;I Understand and Accept&quot; you agree to use DeOperator at your own risk.
          </div>
        </div>

        <AlertDialogFooter className="mt-4">
          <AlertDialogAction
            onClick={handleAccept}
            className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-semibold py-2.5 px-6 rounded-lg transition-all"
          >
            I Understand and Accept
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
