import { GraphDemo } from "@/components/graph/graph-demo";
import { getGraphIdentitySession } from "@/lib/auth/identity-session";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getGraphIdentitySession();
  if (!session) {
    redirect("/auth/login");
  }

  return <GraphDemo session={session} />;
}
