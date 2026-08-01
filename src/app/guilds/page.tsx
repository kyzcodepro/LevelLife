import { requireOnboardedUser } from "@/lib/session";
import { AppNav } from "@/components/AppNav";
import { QuickLogFab } from "@/components/QuickLogFab";
import { GuildsClient } from "./GuildsClient";

export default async function GuildsPage() {
  const { user } = await requireOnboardedUser();
  return (
    <>
      <AppNav username={user.username!} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">
          Guilde
        </h1>
        <GuildsClient />
      </main>
      <QuickLogFab />
    </>
  );
}
