import { redirect } from "next/navigation";
import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { activityTypes, profiles } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const user = await requireUser();
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  });
  if (user.username && profile?.attributeWeights) redirect("/");

  const systemTypes = await db
    .select()
    .from(activityTypes)
    .where(isNull(activityTypes.userId))
    .orderBy(activityTypes.attributeCode, activityTypes.label);

  return (
    <OnboardingWizard
      initialUsername={user.username ?? user.name ?? ""}
      systemTypes={systemTypes.map((t) => ({
        id: t.id,
        code: t.code,
        label: t.label,
        attributeCode: t.attributeCode,
        baseXp: t.baseXp,
      }))}
    />
  );
}
