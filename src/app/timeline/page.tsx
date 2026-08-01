import { requireOnboardedUser } from "@/lib/session";
import { AppNav } from "@/components/AppNav";
import { QuickLogFab } from "@/components/QuickLogFab";
import { TimelineClient } from "./TimelineClient";

export default async function TimelinePage() {
  const { user } = await requireOnboardedUser();
  return (
    <>
      <AppNav username={user.username!} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">
          Timeline
        </h1>
        <TimelineClient />
      </main>
      <QuickLogFab />
    </>
  );
}
