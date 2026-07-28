import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Used inside Server Components and Route Handlers (app/api/.../route.ts).
// Reads/writes the auth session via Next.js cookies so the logged-in
// student stays recognized across requests.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from a Server Component sometimes — that's
            // fine as long as middleware.ts is refreshing the session too.
          }
        },
      },
    }
  );
}

// Used only on the server, only where we intentionally need to bypass RLS:
// the admin ingest route, which writes to the shared knowledge base tables.
// Never import this into anything that runs in the browser.
import { createClient } from "@supabase/supabase-js";

export function createSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
