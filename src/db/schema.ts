/**
 * Schéma Drizzle d'ASCEND — modèle de données du PRD §7.2.
 * PostgreSQL (Neon / Supabase, région EU).
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const sqlActiveQuest = sql`status = 'active'`;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const logSourceEnum = pgEnum("log_source", [
  "manual",
  "voice",
  "integration",
  "import",
]);

export const xpReasonEnum = pgEnum("xp_reason", [
  "log",
  "quest",
  "achievement",
  "bonus",
]);

export const questScopeEnum = pgEnum("quest_scope", [
  "daily",
  "weekly",
  "chain",
  "guild",
  "season",
]);

export const questStatusEnum = pgEnum("quest_status", [
  "active",
  "completed",
  "expired",
  "abandoned",
]);

export const visibilityEnum = pgEnum("visibility", [
  "private",
  "guild",
  "public",
]);

export const guildRoleEnum = pgEnum("guild_role", [
  "leader",
  "officer",
  "member",
]);

export const tierEnum = pgEnum("user_tier", ["free", "ascendant", "guild_pro"]);

export const integrationStatusEnum = pgEnum("integration_status", [
  "active",
  "error",
  "revoked",
]);

export const achievementRarityEnum = pgEnum("achievement_rarity", [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
]);

// ---------------------------------------------------------------------------
// Utilisateurs & profils
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  /** NULL jusqu'à l'onboarding (écran 1 : choix du pseudo). */
  username: text("username").unique(),
  // Colonnes requises par l'adapter Auth.js
  name: text("name"),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  timezone: text("timezone").notNull().default("Europe/Paris"),
  locale: text("locale").notNull().default("fr"),
  tier: tierEnum("tier").notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Tables Auth.js (adapter Drizzle) -----------------------------------------

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  avatarConfig: jsonb("avatar_config").$type<Record<string, unknown>>(),
  bio: text("bio"),
  visibility: visibilityEnum("visibility").notNull().default("private"),
  /** Poids déclarés à l'onboarding, par code d'attribut (somme = 100). */
  attributeWeights: jsonb("attribute_weights").$type<Record<string, number>>(),
  /** AVA-6 : granularité du profil public — codes d'attributs affichés. */
  publicAttributes: jsonb("public_attributes").$type<string[]>(),
});

// ---------------------------------------------------------------------------
// Attributs & XP
// ---------------------------------------------------------------------------

/** Table de référence — 8 lignes, seedées. */
export const attributes = pgTable("attributes", {
  code: text("code").primaryKey(), // STR, VIT, INT, DIS, SOC, CRE, FIN, ZEN
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
});

export const userAttributes = pgTable(
  "user_attributes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    attributeCode: text("attribute_code")
      .notNull()
      .references(() => attributes.code),
    xpTotal: integer("xp_total").notNull().default(0),
    level: integer("level").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.attributeCode] }),
    index("user_attributes_user_idx").on(t.userId),
  ],
);

export const activityTypes = pgTable(
  "activity_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** NULL = type système préconfiguré ; sinon type custom de l'utilisateur. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    label: text("label").notNull(),
    attributeCode: text("attribute_code")
      .notNull()
      .references(() => attributes.code),
    secondaryAttributeCode: text("secondary_attribute_code").references(
      () => attributes.code,
    ),
    baseXp: integer("base_xp").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    icon: text("icon"),
  },
  // NULLS NOT DISTINCT : un seul type système par code (user_id NULL).
  (t) => [
    unique("activity_types_code_user_unique")
      .on(t.code, t.userId)
      .nullsNotDistinct(),
  ],
);

export const logs = pgTable(
  "logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityTypeId: uuid("activity_type_id")
      .notNull()
      .references(() => activityTypes.id),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    durationMin: integer("duration_min"),
    intensity: numeric("intensity", { precision: 3, scale: 2 }),
    quality: numeric("quality", { precision: 3, scale: 2 }),
    mood: smallint("mood"),
    note: text("note"),
    mediaUrls: text("media_urls").array(),
    tags: text("tags").array(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    source: logSourceEnum("source").notNull().default("manual"),
    /** Partage opt-in au fil de guilde (GLD-2). Privé par défaut (PRD §12). */
    visibility: visibilityEnum("visibility").notNull().default("private"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Index critique PRD §7.2 : timeline paginée par curseur.
    index("logs_user_occurred_idx").on(t.userId, t.occurredAt.desc()),
  ],
);

export const xpEvents = pgTable(
  "xp_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    logId: uuid("log_id").references(() => logs.id, { onDelete: "set null" }),
    attributeCode: text("attribute_code")
      .notNull()
      .references(() => attributes.code),
    amount: integer("amount").notNull(),
    /** Détail des multiplicateurs appliqués — permet le rejeu idempotent. */
    multipliers: jsonb("multipliers").$type<Record<string, number>>(),
    reason: xpReasonEnum("reason").notNull().default("log"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("xp_events_user_created_idx").on(t.userId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Quêtes, habitudes, streaks
// ---------------------------------------------------------------------------

export const quests = pgTable("quests", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: questScopeEnum("scope").notNull(),
  templateKey: text("template_key").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  /** Cible structurée : { attribute, count, activityCodes, ... } */
  target: jsonb("target").$type<Record<string, unknown>>(),
  xpReward: integer("xp_reward").notNull().default(0),
  chainId: uuid("chain_id"),
  position: integer("position"),
});

export const questInstances = pgTable(
  "quest_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    guildId: uuid("guild_id").references(() => guilds.id, {
      onDelete: "cascade",
    }),
    questId: uuid("quest_id")
      .notNull()
      .references(() => quests.id),
    status: questStatusEnum("status").notNull().default("active"),
    progress: jsonb("progress").$type<Record<string, unknown>>(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    // Index partiel critique PRD §7.2 : quêtes actives d'un utilisateur.
    index("quest_instances_user_active_idx")
      .on(t.userId)
      .where(sqlActiveQuest),
  ],
);

export const habits = pgTable("habits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  activityTypeId: uuid("activity_type_id")
    .notNull()
    .references(() => activityTypes.id),
  /** Cadence structurée : { type: "daily" } ou { type: "weekly", days: [1,3,5] } */
  cadence: jsonb("cadence").$type<Record<string, unknown>>().notNull(),
  active: boolean("active").notNull().default(true),
});

export const streaks = pgTable("streaks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  habitId: uuid("habit_id")
    .notNull()
    .references(() => habits.id, { onDelete: "cascade" }),
  current: integer("current").notNull().default(0),
  best: integer("best").notNull().default(0),
  /** Total cumulé sur la vie — affiché à la place d'un compteur remis à zéro (PRD §11.3). */
  lifetimeTotal: integer("lifetime_total").notNull().default(0),
  lastDoneOn: date("last_done_on"),
  /** Mode Repos : 2 gels par mois, sans pénalité. */
  freezesLeft: integer("freezes_left").notNull().default(2),
});

// ---------------------------------------------------------------------------
// Succès
// ---------------------------------------------------------------------------

export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  rarity: achievementRarityEnum("rarity").notNull().default("common"),
  criteria: jsonb("criteria").$type<Record<string, unknown>>(),
});

export const userAchievements = pgTable(
  "user_achievements",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievements.id),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementId] })],
);

// ---------------------------------------------------------------------------
// Check-ins & LQI
// ---------------------------------------------------------------------------

export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    energy: smallint("energy").notNull(),
    mood: smallint("mood").notNull(),
    meaning: smallint("meaning").notNull(),
    relations: smallint("relations").notNull(),
    stress: smallint("stress").notNull(),
    satisfaction: smallint("satisfaction").notNull(),
    note: text("note"),
  },
  (t) => [uniqueIndex("checkins_user_week_idx").on(t.userId, t.weekStart)],
);

export const lqiScores = pgTable(
  "lqi_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    subjective: numeric("subjective", { precision: 5, scale: 2 }).notNull(),
    balance: numeric("balance", { precision: 5, scale: 2 }).notNull(),
    momentum: numeric("momentum", { precision: 5, scale: 2 }).notNull(),
    total: numeric("total", { precision: 5, scale: 2 }).notNull(),
    insights: jsonb("insights").$type<string[]>(),
  },
  (t) => [uniqueIndex("lqi_scores_user_week_idx").on(t.userId, t.weekStart)],
);

// ---------------------------------------------------------------------------
// Guildes
// ---------------------------------------------------------------------------

export const guilds = pgTable("guilds", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  bannerUrl: text("banner_url"),
  visibility: visibilityEnum("visibility").notNull().default("private"),
  level: integer("level").notNull().default(1),
  xpTotal: integer("xp_total").notNull().default(0),
  createdBy: uuid("created_by").references(() => users.id),
});

export const guildMembers = pgTable(
  "guild_members",
  {
    guildId: uuid("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: guildRoleEnum("role").notNull().default("member"),
    /** Modération GLD-6 : un membre mute ne peut plus partager ni réagir. */
    muted: boolean("muted").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    weeklyContribution: integer("weekly_contribution").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.userId] })],
);

/** GLD-3 : objectif collectif hebdomadaire (XP cumulé des membres). */
export const guildObjectives = pgTable(
  "guild_objectives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    guildId: uuid("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    targetXp: integer("target_xp").notNull(),
    achieved: boolean("achieved").notNull().default(false),
  },
  (t) => [uniqueIndex("guild_objectives_week_idx").on(t.guildId, t.weekStart)],
);

/** GLD-2 : réactions emoji uniquement — pas de commentaires libres en V1. */
export const feedReactions = pgTable(
  "feed_reactions",
  {
    logId: uuid("log_id")
      .notNull()
      .references(() => logs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
  },
  (t) => [primaryKey({ columns: [t.logId, t.userId, t.emoji] })],
);

// ---------------------------------------------------------------------------
// Saisons & ligues
// ---------------------------------------------------------------------------

export const seasons = pgTable("seasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  theme: text("theme"),
});

export const leagues = pgTable("leagues", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id")
    .notNull()
    .references(() => seasons.id, { onDelete: "cascade" }),
  tier: integer("tier").notNull().default(1),
  capacity: integer("capacity").notNull().default(30),
});

export const leagueMembers = pgTable(
  "league_members",
  {
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    points: integer("points").notNull().default(0),
    rankSnapshot: integer("rank_snapshot"),
  },
  (t) => [primaryKey({ columns: [t.leagueId, t.userId] })],
);

// ---------------------------------------------------------------------------
// Intégrations & journal
// ---------------------------------------------------------------------------

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc"),
  scopes: text("scopes").array(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  status: integrationStatusEnum("status").notNull().default("active"),
});

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entryDate: date("entry_date").notNull(),
    /** Chiffré au repos (clé applicative) — PRD §12. */
    contentEnc: text("content_enc").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("journal_user_date_idx").on(t.userId, t.entryDate)],
);
