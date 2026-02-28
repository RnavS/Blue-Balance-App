import { createClient } from '@supabase/supabase-js';
// Import the generated types from the correct path.  The `@/*` alias in
// `tsconfig.json` points to the `src` folder, so the path should be
// lowercase `integrations` to match the actual directory name.  Using a
// mismatched capitalisation here causes Vite to fail to resolve the
// module on case‑sensitive filesystems, breaking authentication flows at
// runtime.
import type { Database } from '@/integrations/Supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
