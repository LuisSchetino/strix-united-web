import { json } from "../_lib/auth.js";

export async function onRequestGet({ env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return json({ error: "supabase_not_configured" }, 503);
  }
  return json({
    url: env.SUPABASE_URL,
    publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
  });
}
