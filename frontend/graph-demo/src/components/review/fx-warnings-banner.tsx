"use client";

import { FxWarning } from "@/components/review/fx-warning";

interface FxRateWarning {
  currency: string;
  amount: number;
  warning: string;
  requestedDate?: string;
  usedDate?: string;
}

interface FxWarningsBannerProps {
  /** Array of FX warnings from conversion results */
  warnings: FxRateWarning[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays FX rate warnings for a set of transactions.
 * Used when converting foreign-currency transactions to USD for review.
 */
export function FxWarningsBanner({ warnings, className }: FxWarningsBannerProps) {
  if (!warnings.length) return null;

  return (
    <div className={className}>
      {warnings.map((w, i) => (
        <FxWarning
          key={`${w.currency}-${w.requestedDate}-${i}`}
          warning={`${w.currency} ${w.amount}: ${w.warning}`}
          requestedDate={w.requestedDate}
          usedDate={w.usedDate}
        />
      ))}
    </div>
  );
}
