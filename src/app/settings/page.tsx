import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const { user } = await requireOnboardedUser();
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  });

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">
          Réglages
        </h1>
        <SettingsClient
          username={user.username!}
          initialVisibility={
            (profile?.visibility ?? "private") as "private" | "public"
          }
          initialPublicAttributes={profile?.publicAttributes ?? []}
        />
      </main>
    </>
  );
}
