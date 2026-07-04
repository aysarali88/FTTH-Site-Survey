import { createClient } from '@supabase/supabase-js';

export const SUPABASE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'survey-photos';
export const hasSupabaseConfig = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const supabase = hasSupabaseConfig
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
  : null;
