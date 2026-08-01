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
pnpm db:setup               # migrations + seed (PGlite embarqué — zéro infra)
pnpm dev
```

**Aucune base de données à installer** : sans `DATABASE_URL`, l'app utilise PGlite
(Postgres embarqué, persisté dans `.pglite/`). En production, renseigner
`DATABASE_URL` (Neon/Supabase, région EU) — voir `.env.example`.

Connexion : hors production (ou avec `ALLOW_DEV_LOGIN=1`), un pseudo suffit —
compte créé à la volée. Les OAuth Google/Discord s'activent via les variables
`AUTH_GOOGLE_*` / `AUTH_DISCORD_*`.

## Scripts

| Commande | Effet |
|---|---|
| `pnpm dev` | Serveur de développement |
| `pnpm test` | Tests unitaires + intégration (69 tests) |
| `pnpm db:setup` | Migrations + seed en une commande |
| `pnpm db:generate` | Génère une migration depuis `src/db/schema.ts` |
| `pnpm db:seed` | Seed idempotent (attributs + types d'activité) |
| `pnpm xp:recalc` | Rejoue l'XP après rééquilibrage des `base_xp` |
| `pnpm db:studio` | Drizzle Studio |

## Structure

```
src/
  app/
    page.tsx            # Landing publique / fiche de personnage (dashboard)
    login/ onboarding/  # Auth.js + onboarding 4 écrans
    timeline/ stats/    # Timeline virtualisée, heatmap + courbes
    quests/ checkin/ retro/
    api/                # logs, quests, habits, checkins, stats, cron, export…
  components/           # AppNav, QuickLogFab, LogFormModal
  components/ui/        # StatBar, AttributeRadar, XPToast, LevelUpModal
  db/                   # schéma Drizzle complet (PRD §7.2), client dual-driver, seed
  lib/
    xp.ts               # Moteur XP (formule, diminishing, plafonds, niveaux)
    logService.ts       # Création/annulation de log transactionnelle
    recalc.ts           # Recalcul idempotent (rejeu des multiplicateurs)
    questEngine.ts      # Génération de quêtes à base de règles
    lqi.ts              # LQI : Gini, subjectif, momentum, insights
    overdrive.ts        # Détecteur XP↑ / LQI↓ (anti grind vide)
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

## État d'avancement

**Backlog de démarrage du PRD (§15) : les 20 tickets sont implémentés** — soit
les jalons M0 → M3 de la roadmap (🚩 MVP utilisable en solo).

- [x] **EPIC 1 — Fondations** : Next.js 15 + TS + Tailwind, schéma Drizzle +
  migrations + seed (8 attributs, 61 types), Auth.js (OAuth conditionnel +
  connexion dev), design system, onboarding 4 écrans
- [x] **EPIC 2 — Moteur XP** : `lib/xp.ts` testé, `POST /api/logs`
  transactionnel avec level-up, recalcul idempotent (`pnpm xp:recalc`)
- [x] **EPIC 3 — Codex** : Quick Log FAB (undo 10 s), formulaire détaillé +
  photo, timeline virtualisée, heatmap + courbes
- [x] **EPIC 4 — Quêtes** : moteur à règles, cron journalier, UI complète,
  habitudes + streaks + Mode Repos (2 gels/mois)
- [x] **EPIC 5 — LQI** : check-in hebdo, calcul (Gini / momentum), rétrospective
  + 3 insights, détecteur de sur-optimisation avec parcours de récupération
- [x] Export RGPD self-service (`GET /api/export`)
- [x] **M4 — Guildes** : création/adhésion (3-30 membres, publique ou sur
  invitation), fil de logs partagés opt-in à réactions emoji uniquement,
  objectif collectif hebdo avec barre de contribution, niveau de guilde,
  modération (mute / exclusion, rôles chef/officier)
- [x] **M5 — Arène** : saisons trimestrielles auto, ligues fermées de 30
  joueurs de niveau proche (jamais de classement mondial), points de saison
  suivant l'XP (l'XP total ne reset jamais) + **24 succès** seedés avec
  déblocage automatique
- [x] **M6 — Import CSV** de l'historique (XP recalculé par le moteur) +
  cadre d'intégrations (tokens chiffrés en schéma ; OAuth Strava/GitHub/Fit
  à brancher avec de vraies clés d'API)
- [x] **M7 — Profil public** `/u/pseudo` (privé par défaut, granularité par
  attribut, LQI jamais exposé), page réglages, suppression de compte en
  2 clics

**Reste** : intégrations OAuth réelles (clés requises), paiements Stripe
(clés requises), saisie vocale LLM (CDX-6), chaînes de quêtes éditoriales,
duels 1v1, PWA offline — voir PRD §13.

## Garde-fous éthiques appliqués (PRD §11)

Pas de classement mondial, LQI strictement privé, pas de streak-shaming
(total cumulé affiché, Mode Repos gratuit), détection de sur-optimisation
(le grind vide réduit les quêtes et impose la récupération), notifications
jamais culpabilisantes, export et données privées par défaut.
