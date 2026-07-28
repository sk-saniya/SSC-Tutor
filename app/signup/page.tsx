"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    // If email confirmation is on in your Supabase project, there's no
    // session yet — tell the student to check their inbox. If it's off,
    // signUp already returns a session and we can go straight to /chat.
    if (data.session) {
      router.push("/chat");
      router.refresh();
    } else {
      setMessage("Check your email to confirm your account, then log in.");
    }
  }

  return (
    <main className="min-h-screen grid-paper flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-display text-sm text-[var(--color-muted)]">
          ← back home
        </Link>

        <div className="margin-rule mt-6">
          <h1 className="font-display text-2xl">Create your account</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1.5">
            Free, and ready in under a minute.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium mb-1.5">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-paper-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-beaker)]"

            />
          </div>
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--color-grid)] bg-[var(--color-paper-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-beaker)]"

            />
          </div>

          {error && <p className="text-sm text-[var(--color-margin)]">{error}</p>}
          {message && <p className="text-sm text-[var(--color-beaker-ink)]">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[var(--color-ink)] text-[var(--color-paper)] py-2.5 text-sm font-semibold hover:bg-[var(--color-chalkboard)] transition disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="text-sm text-[var(--color-muted)] mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--color-beaker)] font-medium">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
