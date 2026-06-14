import { AppShell } from "@/components/app/app-shell";
import { GraphDemo } from "@/components/graph/graph-demo";
import { getGraphIdentitySession } from "@/lib/auth/identity-session";
import { redirect } from "next/navigation";

export default async function GraphNetworkSearchPage() {
  const session = await getGraphIdentitySession();
  if (!session) {
    redirect("/auth/login");
  }

  return (
    <AppShell active="graph" session={session}>
      <GraphDemo />
    </AppShell>
  );
}
