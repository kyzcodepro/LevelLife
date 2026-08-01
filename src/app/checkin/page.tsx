import { requireOnboardedUser } from "@/lib/session";
import { AppNav } from "@/components/AppNav";
import { CheckinForm } from "./CheckinForm";

export default async function CheckinPage() {
  const { user } = await requireOnboardedUser();
  return (
    <>
      <AppNav username={user.username!} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">
          Check-in de la semaine
        </h1>
        <p className="mb-8 text-muted">
          6 curseurs, 1 minute. C'est ce qui alimente ton LQI — la seule
          métrique qui mesure si ta vie va mieux, pas juste si tu grindes.
        </p>
        <CheckinForm />
      </main>
    </>
  );
}
