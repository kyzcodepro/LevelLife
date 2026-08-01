# ASCEND

> Transformer la vie réelle en une progression lisible, mesurable et partagée — avec les codes du jeu vidéo, mais avec des gains réels.

Plateforme communautaire de progression de vie (Life RPG). Voir le PRD pour la vision complète : Codex (saisir), Avatar (voir), Quêtes (agir), Guilde (partager), Arène (rivaliser), le tout propulsé par un moteur XP + LQI (Life Quality Index).

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS v4
- **Drizzle ORM** + PostgreSQL (Neon / Supabase, région EU)
- **Recharts** (radar, courbes) + **Framer Motion** (feedback XP, level-up)
- **Vitest** (moteur XP couvert par tests unitaires)

## Démarrage

```bash
pnpm install
cp .env.example .env        # renseigner DATABASE_URL
pnpm db:migrate             # applique les migrations Drizzle
pnpm db:seed                # 8 attributs + 60 types d'activité
pnpm dev
```

Sans base de données, `pnpm dev` fonctionne quand même : la page d'accueil est une fiche de personnage de démo (données mock) branchée sur le vrai moteur XP.

## Scripts

| Commande | Effet |
|---|---|
| `pnpm dev` | Serveur de développement |
| `pnpm test` | Tests unitaires (moteur XP) |
| `pnpm db:generate` | Génère une migration depuis `src/db/schema.ts` |
| `pnpm db:migrate` | Applique les migrations |
| `pnpm db:seed` | Seed idempotent (attributs + types d'activité) |
| `pnpm db:studio` | Drizzle Studio |

## Structure

```
src/
  app/                  # App Router (layout, page démo)
  components/ui/        # Design system : StatBar, AttributeRadar, XPToast, LevelUpModal
  db/
    schema.ts           # Schéma Drizzle complet (PRD §7.2)
    seed.ts             # Seed 8 attributs + 60 activity types
  lib/
    attributes.ts       # Les 8 attributs (codes, couleurs, domaines)
    xp.ts               # Moteur XP : formule, diminishing, plafonds, niveaux
    xp.test.ts          # Tests unitaires du moteur
drizzle/                # Migrations SQL générées
```

## Le moteur XP (PRD §5)

```
xp = base × intensity (0.5–2.0) × quality (0.8–1.3)
          × streak_mult (≤ 1.5) × diminishing(n)

diminishing(n) = 1 / (1 + 0.35 × (n − 1))
plafond journalier / attribut = 120 + 15 × niveau
xp_requis(niveau n → n+1) = round(100 × n^1.5)
```

Le calcul est pur et déterministe (`src/lib/xp.ts`) : les `xp_events` stockent les multiplicateurs appliqués, ce qui permet un recalcul idempotent si les `base_xp` sont rééquilibrés.

## État d'avancement (roadmap PRD §13)

- [x] **M0 — Fondations** (partiel) : init Next.js + TS + Tailwind, schéma Drizzle + migrations + seed, design tokens, composants `StatBar` / `AttributeRadar` / `XPToast` / `LevelUpModal`
- [x] **EPIC 2, ticket 6** : `lib/xp.ts` + tests
- [ ] Auth.js (magic link + Google + Discord)
- [ ] Onboarding 4 écrans
- [ ] `POST /api/logs` transactionnel (log → xp_events → user_attributes → level-up)
- [ ] Quick Log persistant, timeline, quêtes, LQI…
