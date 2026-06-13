"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Clock, FileText, CheckCircle, XCircle } from "lucide-react";

interface ReviewItem {
  id: string;
  sessionId: string;
  type: "snapshot" | "decision";
  snapshotType?: string;
  decisionType?: string;
  note: string | null;
  createdAt: string;
  contextType: string;
  reviewerEmail: string;
}

interface ReviewHistoryProps {
  custId: string;
}

export function ReviewHistory({ custId }: ReviewHistoryProps) {
  const [items, setItems] = useState<ReviewItem[]>([]);
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

        const snapshots = (await response.json()) as Array<{
          id: string;
          sessionId: string;
          snapshotType: string;
          note: string | null;
          createdAt: string;
          contextType: string;
          reviewerEmail: string;
        }>;

        const mapped: ReviewItem[] = snapshots.map((s) => ({
          id: s.id,
          sessionId: s.sessionId,
          type: "snapshot",
          snapshotType: s.snapshotType,
          note: s.note,
          createdAt: s.createdAt,
          contextType: s.contextType,
          reviewerEmail: s.reviewerEmail,
        }));

        mapped.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setItems(mapped);
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

  if (items.length === 0) {
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

  return (
    <div className="space-y-3">
      {items.map((item) => (
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
