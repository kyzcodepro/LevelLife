"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Fiche" },
  { href: "/timeline", label: "Timeline" },
  { href: "/stats", label: "Stats" },
  { href: "/quests", label: "Quêtes" },
  { href: "/retro", label: "Rétro" },
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
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              pathname === link.href
                ? "bg-accent-soft text-foreground"
                : "text-muted hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        ))}
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
