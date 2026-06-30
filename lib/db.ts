import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ponytail: singleton — same reason as globalThis stores (Turbopack re-imports modules between requests)
// Use "in" check so null (no env vars) doesn't re-trigger initialization on each import
const g = globalThis as typeof globalThis & { __supabase?: SupabaseClient | null };
if (!("__supabase" in g)) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  g.__supabase = url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null;
}
export const db: SupabaseClient | null = g.__supabase ?? null;
