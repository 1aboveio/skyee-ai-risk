import { AppShell } from "@/components/app/app-shell";
import { HomeDashboard } from "@/components/app/home-dashboard";
import { getGraphIdentitySession } from "@/lib/auth/identity-session";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getGraphIdentitySession();
  if (!session) {
    redirect("/auth/login");
  }

  return (
    <AppShell active="home" session={session}>
      <HomeDashboard session={session} />
    </AppShell>
  );
}
