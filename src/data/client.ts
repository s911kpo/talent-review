// The only module that creates a Supabase client. Everything else goes through src/data (SPEC 2).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Local walkthrough with fictional data in the browser. Set only through `npm run demo`. */
export const isDemoMode = import.meta.env.VITE_DATA_MODE === 'demo';

export const isBackendConfigured = isDemoMode || Boolean(url && anonKey);

/** AI menus stay hidden until an Anthropic key is funded and VITE_AI_ENABLED=true is set (SPEC 16 fallback). */
export const isAiEnabled = isDemoMode || import.meta.env.VITE_AI_ENABLED === 'true';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!url || !anonKey) throw new Error('backend_not_configured');
  client ??= createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}
