import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecret = process.env.SUPABASE_SECRET_KEY;

/**
 * Server-only admin client that bypasses Row Level Security.
 * Use sparingly — for system writes (stock_movements ledger, OAuth token storage,
 * cron-driven scrapes). Never import this from a Client Component or expose
 * to the browser.
 */
export const createAdminClient = () => {
  if (!supabaseUrl || !supabaseSecret) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  }
  return createClient(supabaseUrl, supabaseSecret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};
