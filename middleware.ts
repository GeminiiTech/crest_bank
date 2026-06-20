import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Only run the session/auth middleware where it matters: the protected dashboard
// and the auth pages (which redirect already-signed-in users). Public marketing
// pages skip it entirely, so they navigate instantly without a Supabase round-trip.
export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/register"],
};
