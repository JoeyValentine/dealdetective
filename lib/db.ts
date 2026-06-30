import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ponytail: singleton — same reason as globalThis stores (Turbopack re-imports modules between requests)
// Use "in" check so null (no env vars) doesn't re-trigger initialization on each import
const g = globalThis as typeof globalThis & { __supabase?: SupabaseClient | null };
if (!("__supabase" in g)) {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !url.startsWith("https://") || !key) {
    console.warn("[db] SUPABASE_URL invalid or missing — falling back to in-memory store");
    g.__supabase = null;
  } else {
    g.__supabase = createClient(url, key, { auth: { persistSession: false } });
  }
}
export const db: SupabaseClient | null = g.__supabase ?? null;
