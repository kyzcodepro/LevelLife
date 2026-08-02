"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { signOut } from "next-auth/react";
import {
  BarChart3,
  History,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Fiche", icon: User },
  { href: "/timeline", label: "Timeline", icon: History },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/quests", label: "Quêtes", icon: Swords },
  { href: "/guilds", label: "Guilde", icon: Shield },
  { href: "/arena", label: "Arène", icon: Trophy },
  { href: "/retro", label: "Rétro", icon: Sparkles },
  { href: "/settings", label: "Réglages", icon: Settings },
];

export function AppNav({ username }: { username: string }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border-default bg-background/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="mr-4 shrink-0 text-sm font-bold uppercase tracking-[0.25em] text-accent"
        >
          Ascend
        </Link>
        {LINKS.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
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
              <span className="relative hidden md:inline">{link.label}</span>
            </Link>
          );
        })}
        <div className="ml-auto flex shrink-0 items-center gap-3">
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
