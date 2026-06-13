"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface SnapshotItem {
  id: string;
  sessionId: string;
  snapshotType: string;
  note: string | null;
  createdAt: string;
  contextType: string;
  reviewerEmail: string;
}

interface DecisionItem {
  id: string;
  sessionId: string;
  decisionType: string;
  note: string;
  snapshotId: string | null;
  createdAt: string;
  contextType: string;
  reviewerEmail: string;
}

type HistoryItem =
  | (SnapshotItem & { _kind: "snapshot" })
  | (DecisionItem & { _kind: "decision" });

interface ReviewHistoryProps {
  custId: string;
  initialSnapshots?: SnapshotItem[];
}

export function ReviewHistory({ custId, initialSnapshots }: ReviewHistoryProps) {
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>(
    initialSnapshots ?? []
  );
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [loading, setLoading] = useState(!initialSnapshots);
  const [error, setError] = useState<string | null>(null);

  // Fetch both snapshots and decisions
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [snapRes, decRes] = await Promise.all([
        fetch(`/api/review/${custId}/snapshots`),
        fetch(`/api/review/${custId}/decisions`),
      ]);

      if (!snapRes.ok) throw new Error("Failed to fetch snapshots");
      if (!decRes.ok) throw new Error("Failed to fetch decisions");

      const snapData = (await snapRes.json()) as SnapshotItem[];
      const decData = (await decRes.json()) as DecisionItem[];

      setSnapshots(snapData);
      setDecisions(decData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [custId]);

  // Fetch on mount if no initial data
  useEffect(() => {
    if (initialSnapshots) {
      // Still need to fetch decisions even if snapshots are pre-loaded
      fetch(`/api/review/${custId}/decisions`)
        .then((r) => r.json())
        .then((data: DecisionItem[]) => setDecisions(data))
        .catch(() => {});
      return;
    }

    let cancelled = false;
    async function load() {
      await fetchData();
      if (cancelled) return;
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [custId, initialSnapshots, fetchData]);

  // Refresh when a snapshot or decision is made
  useEffect(() => {
    function handleRefresh(event: Event) {
      const detail = (event as CustomEvent).detail;
      if (detail?.custId !== custId) return;
      fetchData();
    }

    window.addEventListener("snapshot-saved", handleRefresh);
    window.addEventListener("decision-made", handleRefresh);
    return () => {
      window.removeEventListener("snapshot-saved", handleRefresh);
      window.removeEventListener("decision-made", handleRefresh);
    };
  }, [custId, fetchData]);

  // Combine and sort items
  const items: HistoryItem[] = [
    ...snapshots.map((s) => ({ ...s, _kind: "snapshot" as const })),
    ...decisions.map((d) => ({ ...d, _kind: "decision" as const })),
  ].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

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
        <Card key={`${item._kind}-${item.id}`} className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {item._kind === "decision" ? (
                item.decisionType === "ACCEPT" ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  {item._kind === "decision" ? (
                    <Badge
                      variant={
                        item.decisionType === "ACCEPT"
                          ? "default"
                          : "destructive"
                      }
                    >
                      {item.decisionType === "ACCEPT"
                        ? "Accepted"
                        : "Rejected"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Snapshot</Badge>
                  )}
                  <Badge variant="outline">{item.contextType}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {item._kind === "decision" ? item.note : item.note ?? "—"}
                </p>
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
