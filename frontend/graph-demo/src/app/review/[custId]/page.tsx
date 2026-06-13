import { getGraphIdentitySession } from "@/lib/auth/identity-session";
import { redirect } from "next/navigation";
import { getReviewHistory } from "@/lib/review/store";
import { WorkbenchPanel } from "@/components/review/workbench-panel";
import { ReviewHistory } from "@/components/review/review-history";
import { SaveSnapshotButton } from "@/components/review/save-snapshot-button";
import { CustomerSearchInput } from "@/components/review/customer-search-input";
import { RiskGraphPanel } from "@/components/review/risk-graph-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User } from "lucide-react";

export default async function ReviewWorkbenchPage({
  params,
}: {
  params: Promise<{ custId: string }>;
}) {
  const session = await getGraphIdentitySession();
  if (!session) {
    redirect("/auth/login");
  }

  const { custId } = await params;

  // Fetch review history server-side (single fetch)
  let reviewHistory: Awaited<ReturnType<typeof getReviewHistory>> | undefined;
  let historyError: string | null = null;
  try {
    reviewHistory = await getReviewHistory(custId);
  } catch (error) {
    historyError =
      error instanceof Error ? error.message : "Failed to load review history";
  }

  const activeSession = reviewHistory?.find((s) => s.status === "ACTIVE");

  // Flatten snapshots for initial data
  const initialSnapshots = reviewHistory
    ? reviewHistory.flatMap((s) =>
        s.snapshots.map((snapshot) => ({
          ...snapshot,
          sessionId: s.id,
          contextType: s.contextType,
          reviewerEmail: s.reviewerEmail,
        }))
      )
    : undefined;

  // Current evidence state for snapshot capture
  const currentEvidence = {
    custId,
    fetchedAt: new Date().toISOString(),
    panels: {
      customerProfile: { status: "empty" as const },
      riskSignals: { status: "empty" as const },
      transactionSummary: { status: "empty" as const },
      transactionList: { status: "empty" as const },
      riskGraph: { status: "empty" as const },
      evidenceTimeline: { status: "empty" as const },
      evidenceGaps: { status: "empty" as const },
      aiInvestigationInput: { status: "empty" as const },
    },
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header with cust_id search */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <h1 className="text-2xl font-bold tracking-tight">
            Customer Risk Review Workbench
          </h1>
          <CustomerSearchInput currentCustId={custId} />
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono">
              {custId}
            </Badge>
            {activeSession && (
              <>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  {activeSession.reviewerEmail}
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Session: {activeSession.contextType}
                </div>
              </>
            )}
          </div>
        </div>
        <SaveSnapshotButton custId={custId} evidenceData={currentEvidence} />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evidence Panels - Left side (2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          <WorkbenchPanel
            title="Customer Profile"
            empty
            emptyMessage="Customer profile data will be loaded from the Source Evidence Database."
          >
            <div />
          </WorkbenchPanel>

          <WorkbenchPanel
            title="Risk Signals"
            empty
            emptyMessage="Risk signal data will be loaded from the Source Evidence Database."
          >
            <div />
          </WorkbenchPanel>

          <WorkbenchPanel
            title="Transaction Summary"
            empty
            emptyMessage="Transaction summary will be loaded from the Source Evidence Database."
          >
            <div />
          </WorkbenchPanel>

          <WorkbenchPanel
            title="Transaction List"
            empty
            emptyMessage="Transaction list with cursor pagination will be displayed here."
          >
            <div />
          </WorkbenchPanel>

          <RiskGraphPanel custId={custId} />
        </div>

        {/* Review History - Right side */}
        <div className="space-y-6">
          <WorkbenchPanel
            title="Review History"
            loading={!reviewHistory && !historyError}
            error={historyError}
            empty={initialSnapshots?.length === 0}
            emptyMessage="No review sessions recorded yet."
          >
            <ReviewHistory custId={custId} initialSnapshots={initialSnapshots} />
          </WorkbenchPanel>

          {activeSession && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Active Session
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Context</span>
                  <Badge variant="secondary">{activeSession.contextType}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="default">{activeSession.status}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Started</span>
                  <span>
                    {new Date(activeSession.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
