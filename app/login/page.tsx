"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(searchParams.get("next") ?? "/chat");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid-paper flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-display text-sm text-[var(--color-muted)]">
          ← back home
        </Link>

        <div className="margin-rule mt-6">
          <h1 className="font-display text-2xl">Log in</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1.5">
            Pick up where you left off.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-paper-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-beaker)]"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-paper-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-beaker)]"
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--color-margin)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[var(--color-ink)] text-[var(--color-paper)] py-2.5 text-sm font-semibold hover:bg-[var(--color-chalkboard)] transition disabled:opacity-60"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="text-sm text-[var(--color-muted)] mt-6">
          New here?{" "}
          <Link href="/signup" className="text-[var(--color-beaker)] font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
