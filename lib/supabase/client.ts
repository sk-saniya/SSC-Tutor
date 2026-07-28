import { createBrowserClient } from "@supabase/ssr";

// Used inside client components ("use client") — login form, signup form,
// the chat page, the logout button, etc.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
