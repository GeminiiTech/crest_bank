import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";

export function createClient() {
  const cookieStore = cookies();
  const { url, anonKey, configured } = getSupabaseEnv();
  if (!configured) throw new Error("Supabase env not configured.");
  return createServerClient(url!, anonKey!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* called from a Server Component */
        }
      },
    },
  });
}
