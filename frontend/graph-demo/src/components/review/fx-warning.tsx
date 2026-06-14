"use client";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface FxWarningProps {
  /** The warning message from the FX service */
  warning: string;
  /** The date that was requested */
  requestedDate?: string;
  /** The date of the rate that was actually used (if different) */
  usedDate?: string;
  /** Additional CSS classes */
  className?: string;
}

export function FxWarning({
  warning,
  requestedDate,
  usedDate,
  className,
}: FxWarningProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>FX Rate Warning</AlertTitle>
      <AlertDescription>
        <p>{warning}</p>
        {requestedDate && usedDate && requestedDate !== usedDate && (
          <p className="mt-1 text-xs">
            Requested: {requestedDate} &middot; Used: {usedDate}
          </p>
        )}
        {requestedDate && !usedDate && (
          <p className="mt-1 text-xs">Requested date: {requestedDate}</p>
        )}
      </AlertDescription>
    </Alert>
  );
}
