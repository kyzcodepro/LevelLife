import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

const providers: NextAuthConfig["providers"] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}
if (process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET) {
  providers.push(Discord);
}

/**
 * Connexion dev sans OAuth : un pseudo suffit (utilisateur créé à la volée).
 * Activée hors production, ou explicitement via ALLOW_DEV_LOGIN=1.
 */
const devLoginEnabled =
  process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_LOGIN === "1";

if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Connexion dev",
      credentials: { username: { label: "Pseudo" } },
      async authorize(credentials) {
        const raw = String(credentials?.username ?? "").trim();
        const slug = raw.toLowerCase().replace(/[^a-z0-9_-]/g, "");
        if (slug.length < 2) return null;
        const email = `${slug}@dev.local`;
        const existing = await db.query.users.findFirst({
          where: eq(users.email, email),
        });
        if (existing) {
          return { id: existing.id, email: existing.email, name: existing.name };
        }
        const [created] = await db
          .insert(users)
          .values({ email, name: raw })
          .returning();
        return { id: created.id, email: created.email, name: created.name };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usersTable: users as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accountsTable: accounts as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionsTable: sessions as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verificationTokensTable: verificationTokens as any,
  }),
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? "dev-secret-ascend-ne-pas-utiliser-en-prod",
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});

export const hasOAuth = {
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  discord: Boolean(
    process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET,
  ),
  devLogin: devLoginEnabled,
};
