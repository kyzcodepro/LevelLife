import { redirect } from "next/navigation";
import { hasOAuth } from "@/auth";
import { currentUser } from "@/lib/session";
import { AttributeOrbs } from "@/components/ui/AttributeOrbs";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  // On vérifie l'utilisateur EN BASE, pas seulement le cookie : un JWT
  // orphelin (base locale recréée) doit pouvoir se reconnecter ici.
  const user = await currentUser();
  if (user) redirect("/");

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <AttributeOrbs />
      <div className="relative w-full max-w-sm">
        <p className="mb-1 text-center text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          Ascend
        </p>
        <h1 className="mb-2 text-center font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">
          Level up ta vraie vie
        </h1>
        <p className="mb-8 text-center text-sm text-muted">
          Ta vie, en progression lisible, mesurable et partagée.
        </p>
        <LoginForm oauth={hasOAuth} />
      </div>
    </main>
  );
}
