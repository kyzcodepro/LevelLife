import { requireOnboardedUser } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { QuickLogFab } from "@/components/QuickLogFab";
import { StatsClient } from "./StatsClient";

export default async function StatsPage() {
  const { user } = await requireOnboardedUser();
  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">
          Stats
        </h1>
        <StatsClient />
      </main>
      <QuickLogFab />
    </>
  );
}
