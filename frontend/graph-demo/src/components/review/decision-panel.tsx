"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import type { ReviewContext } from "@/lib/review/context";

interface DecisionPanelProps {
  custId: string;
  reviewContext: ReviewContext;
  evidenceData?: Record<string, unknown>;
  onDecision?: () => void;
}

export function DecisionPanel({
  custId,
  reviewContext,
  evidenceData = {},
  onDecision,
}: DecisionPanelProps) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    type: string;
    snapshotId: string;
  } | null>(null);

  const canDecide = reviewContext.canAccept || reviewContext.canReject;

  if (!canDecide) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Decision
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Decisions are not available for{" "}
            <Badge variant="outline" className="mx-1">
              {reviewContext.type}
            </Badge>{" "}
            reviews. Only snapshot saving is permitted.
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleDecision = async (decisionType: "ACCEPT" | "REJECT") => {
    const trimmedNote = note.trim();
    if (!trimmedNote) {
      setError("A note is required for all decisions.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/review/${custId}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisionType,
          note: trimmedNote,
          evidenceData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error?.detail || data.error?.message || "Failed to submit decision"
        );
      }

      const result = await response.json();
      setSuccess({ type: decisionType, snapshotId: result.snapshotId });
      setNote("");

      // Notify other components
      window.dispatchEvent(
        new CustomEvent("decision-made", { detail: { custId } })
      );
      window.dispatchEvent(
        new CustomEvent("snapshot-saved", { detail: { custId } })
      );
      onDecision?.();

      // Clear success after a delay
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Decision
          <Badge variant="secondary" className="ml-auto text-xs">
            {reviewContext.type}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Note input */}
        <div className="space-y-2">
          <Label htmlFor="decision-note">
            Note <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="decision-note"
            placeholder="Provide reasoning for your decision (required)..."
            value={note}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setNote(e.target.value)
            }
            rows={3}
            disabled={submitting}
          />
          {note.trim().length === 0 && (
            <p className="text-xs text-muted-foreground">
              A note is mandatory for all decisions.
            </p>
          )}
        </div>

        {/* Decision buttons */}
        <div className="flex gap-3">
          {reviewContext.canAccept && (
            <Button
              variant="default"
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={submitting || !note.trim()}
              onClick={() => handleDecision("ACCEPT")}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Accept
            </Button>
          )}
          {reviewContext.canReject && (
            <Button
              variant="destructive"
              className="flex-1"
              disabled={submitting || !note.trim()}
              onClick={() => handleDecision("REJECT")}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Reject
            </Button>
          )}
        </div>

        {/* Error feedback */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success feedback */}
        {success && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              {success.type === "ACCEPT" ? "Accepted" : "Rejected"}{" "}
              successfully. Snapshot saved.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
