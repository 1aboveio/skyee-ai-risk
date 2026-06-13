"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Clock, FileText, CheckCircle, XCircle } from "lucide-react";

interface ReviewSnapshot {
  id: string;
  sessionId: string;
  snapshotType: string;
  note: string | null;
  createdAt: string;
  contextType: string;
  reviewerEmail: string;
}

interface ReviewDecision {
  id: string;
  sessionId: string;
  decisionType: string;
  note: string;
  createdAt: string;
}

interface ReviewSession {
  id: string;
  custId: string;
  contextType: string;
  reviewerId: string;
  reviewerEmail: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  snapshots: ReviewSnapshot[];
  decisions: ReviewDecision[];
}

interface ReviewHistoryProps {
  custId: string;
}

export function ReviewHistory({ custId }: ReviewHistoryProps) {
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/review/${custId}/snapshots`);
        if (!response.ok) {
          throw new Error("Failed to fetch review history");
        }

        const snapshots = await response.json();

        // Group snapshots by sessionId to reconstruct sessions
        const sessionMap = new Map<string, ReviewSession>();
        for (const snapshot of snapshots) {
          if (!sessionMap.has(snapshot.sessionId)) {
            sessionMap.set(snapshot.sessionId, {
              id: snapshot.sessionId,
              custId,
              contextType: snapshot.contextType,
              reviewerId: "",
              reviewerEmail: snapshot.reviewerEmail,
              status: "ACTIVE",
              createdAt: snapshot.createdAt,
              updatedAt: snapshot.createdAt,
              snapshots: [],
              decisions: [],
            });
          }
          sessionMap.get(snapshot.sessionId)!.snapshots.push(snapshot);
        }

        setSessions(Array.from(sessionMap.values()));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [custId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (sessions.length === 0) {
    return (
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertTitle>No Review History</AlertTitle>
        <AlertDescription>
          No snapshots or decisions have been recorded for this customer yet.
        </AlertDescription>
      </Alert>
    );
  }

  // Flatten all items for display
  const allItems = sessions.flatMap((session) => [
    ...session.snapshots.map((snapshot) => ({
      id: snapshot.id,
      type: "snapshot" as const,
      snapshotType: snapshot.snapshotType,
      note: snapshot.note,
      createdAt: snapshot.createdAt,
      contextType: session.contextType,
      reviewerEmail: session.reviewerEmail,
    })),
    ...session.decisions.map((decision) => ({
      id: decision.id,
      type: "decision" as const,
      decisionType: decision.decisionType,
      note: decision.note,
      createdAt: decision.createdAt,
      contextType: session.contextType,
      reviewerEmail: session.reviewerEmail,
    })),
  ]);

  // Sort by createdAt descending
  allItems.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-3">
      {allItems.map((item) => (
        <Card key={item.id} className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {item.type === "snapshot" ? (
                <FileText className="h-4 w-4 text-muted-foreground" />
              ) : item.decisionType === "ACCEPT" ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.type === "snapshot" ? "secondary" : "default"}>
                    {item.type === "snapshot" ? "Snapshot Only" : item.decisionType}
                  </Badge>
                  <Badge variant="outline">{item.contextType}</Badge>
                </div>
                {item.note && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {item.note}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Clock className="h-3 w-3" />
              {new Date(item.createdAt).toLocaleString()}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
