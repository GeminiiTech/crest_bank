const PROTECTED_PREFIXES = ["/dashboard"];
const AUTH_ONLY_PATHS = ["/login", "/register"];

export function sanitizeNext(next: string | null | undefined): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export function resolveAuthRedirect(
  pathname: string,
  hasSession: boolean
): string | null {
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isAuthOnly = AUTH_ONLY_PATHS.includes(pathname);

  if (!hasSession && isProtected) {
    return `/login?next=${encodeURIComponent(pathname)}`;
  }
  if (hasSession && isAuthOnly) {
    return "/dashboard";
  }
  return null;
}
