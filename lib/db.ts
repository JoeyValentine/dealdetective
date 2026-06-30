import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ponytail: singleton — same reason as globalThis stores (Turbopack re-imports modules between requests)
// Use "in" check so null (no env vars) doesn't re-trigger initialization on each import
const g = globalThis as typeof globalThis & { __supabase?: SupabaseClient | null };
if (!("__supabase" in g)) {
  // Strip /rest/v1 suffix if present — the SDK appends it itself
  const url = process.env.SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !url.startsWith("https://") || !key) {
    console.warn("[db] SUPABASE_URL invalid or missing — falling back to in-memory store");
    g.__supabase = null;
  } else {
    try {
      g.__supabase = createClient(url, key, { auth: { persistSession: false } });
    } catch (err) {
      console.error("[db] createClient threw — falling back to in-memory store:", err);
      g.__supabase = null;
    }
  }
}
export const db: SupabaseClient | null = g.__supabase ?? null;
