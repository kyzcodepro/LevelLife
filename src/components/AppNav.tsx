"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { signOut } from "next-auth/react";
import {
  BarChart3,
  History,
  Lock,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  User,
} from "lucide-react";
import { nextUnlock, unlockedModules } from "@/lib/unlocks";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  timeline: History,
  stats: BarChart3,
  quests: Swords,
  guilds: Shield,
  arena: Trophy,
  retro: Sparkles,
};

/**
 * Nav à déverrouillage progressif : seuls les modules débloqués apparaissent,
 * plus un teaser du prochain (« 🔒 Quêtes · encore 2 logs »).
 */
export function AppNav({
  username,
  logsTotal,
}: {
  username: string;
  logsTotal: number;
}) {
  const pathname = usePathname();
  const unlocked = unlockedModules(logsTotal);
  const next = nextUnlock(logsTotal);

  return (
    <header className="sticky top-0 z-40 border-b border-border-default bg-background/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="mr-4 shrink-0 text-sm font-bold uppercase tracking-[0.25em] text-accent"
        >
          Ascend
        </Link>

        {/* Fiche — toujours là */}
        <NavLink
          href="/"
          label="Fiche"
          Icon={User}
          active={pathname === "/"}
        />

        {/* Modules débloqués, dans l'ordre de progression */}
        {unlocked.map((mod) => (
          <NavLink
            key={mod.key}
            href={mod.href}
            label={mod.label}
            Icon={ICONS[mod.key] ?? User}
            active={pathname === mod.href}
          />
        ))}

        {/* Teaser du prochain déblocage */}
        {next && (
          <span
            title={`Encore ${next.remaining} log${next.remaining > 1 ? "s" : ""} pour débloquer ${next.module.label}`}
            className="flex shrink-0 cursor-default items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted opacity-60"
          >
            <Lock size={13} />
            <span className="hidden md:inline">
              {next.module.label} · {next.remaining} log
              {next.remaining > 1 ? "s" : ""}
            </span>
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <NavLink
            href="/settings"
            label="Réglages"
            Icon={Settings}
            active={pathname === "/settings"}
            compact
          />
          <span className="hidden text-sm text-muted sm:block">{username}</span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg px-2 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
          >
            Déconnexion
          </button>
        </div>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  label,
  Icon,
  active,
  compact,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "text-foreground" : "text-muted hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 rounded-lg bg-accent-soft"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <Icon size={15} className="relative" />
      {!compact && <span className="relative hidden md:inline">{label}</span>}
    </Link>
  );
}
