"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

interface LoginFormProps {
  oauth: { google: boolean; discord: boolean; devLogin: boolean };
}

export function LoginForm({ oauth }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function devLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("dev-login", {
      username,
      redirect: false,
    });
    if (res?.error) {
      setError("Pseudo invalide (2 caractères minimum).");
      setLoading(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="flex flex-col gap-3">
      {oauth.google && (
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="rounded-xl border border-border-default bg-surface px-4 py-3 font-medium transition-colors hover:bg-surface-raised"
        >
          Continuer avec Google
        </button>
      )}
      {oauth.discord && (
        <button
          type="button"
          onClick={() => signIn("discord", { callbackUrl: "/" })}
          className="rounded-xl border border-border-default bg-surface px-4 py-3 font-medium transition-colors hover:bg-surface-raised"
        >
          Continuer avec Discord
        </button>
      )}
      {oauth.devLogin && (
        <form onSubmit={devLogin} className="flex flex-col gap-3">
          {(oauth.google || oauth.discord) && (
            <div className="my-2 flex items-center gap-3 text-xs text-muted">
              <div className="h-px flex-1 bg-border-default" />
              ou
              <div className="h-px flex-1 bg-border-default" />
            </div>
          )}
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ton pseudo"
            autoFocus
            className="rounded-xl border border-border-default bg-surface px-4 py-3 outline-none transition-colors placeholder:text-muted focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading || username.trim().length < 2}
            className="rounded-xl bg-accent px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading ? "Connexion…" : "Entrer dans ASCEND"}
          </button>
          {error && <p className="text-sm text-attr-str">{error}</p>}
          <p className="text-center text-xs text-muted">
            Mode dev : compte créé à la volée, sans mot de passe.
          </p>
        </form>
      )}
    </div>
  );
}
