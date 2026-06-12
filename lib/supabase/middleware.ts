import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";
import { resolveAuthRedirect } from "@/lib/auth/redirects";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey, configured } = getSupabaseEnv();
  if (!configured) return response; // marketing site runs without Supabase

  const supabase = createServerClient(url!, anonKey!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const target = resolveAuthRedirect(request.nextUrl.pathname, Boolean(user));
  if (target) {
    const redirectUrl = request.nextUrl.clone();
    const [pathname, query] = target.split("?");
    redirectUrl.pathname = pathname;
    redirectUrl.search = query ? `?${query}` : "";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}
