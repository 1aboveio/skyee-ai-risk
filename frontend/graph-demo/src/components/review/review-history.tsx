"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Clock, FileText } from "lucide-react";

interface SnapshotItem {
  id: string;
  sessionId: string;
  snapshotType: string;
  note: string | null;
  createdAt: string;
  contextType: string;
  reviewerEmail: string;
}

interface ReviewHistoryProps {
  custId: string;
  initialSnapshots?: SnapshotItem[];
}

export function ReviewHistory({ custId, initialSnapshots }: ReviewHistoryProps) {
  const [items, setItems] = useState<SnapshotItem[]>(initialSnapshots ?? []);
  const [loading, setLoading] = useState(!initialSnapshots);
  const [error, setError] = useState<string | null>(null);

  // Fetch on mount if no initial data
  useEffect(() => {
    if (initialSnapshots) return;

    let cancelled = false;
    async function fetchHistory() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/review/${custId}/snapshots`);
        if (!response.ok) {
          throw new Error("Failed to fetch review history");
        }

        const snapshots = (await response.json()) as SnapshotItem[];
        if (!cancelled) {
          snapshots.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setItems(snapshots);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchHistory();
    return () => { cancelled = true; };
  }, [custId, initialSnapshots]);

  // Refresh when a snapshot is saved
  useEffect(() => {
    function handleSnapshotSaved(event: Event) {
      const detail = (event as CustomEvent).detail;
      if (detail?.custId !== custId) return;

      fetch(`/api/review/${custId}/snapshots`)
        .then((r) => r.json())
        .then((snapshots: SnapshotItem[]) => {
          snapshots.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setItems(snapshots);
        })
        .catch(() => {});
    }
    window.addEventListener("snapshot-saved", handleSnapshotSaved);
    return () => window.removeEventListener("snapshot-saved", handleSnapshotSaved);
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
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Snapshot Only</Badge>
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
