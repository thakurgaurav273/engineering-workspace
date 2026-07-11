import { NextResponse } from "next/server";

/**
 * The platform's session token lives in localStorage (see platform/auth/auth.ts), which
 * is not visible to Edge middleware - so the auth redirect cannot be enforced here without
 * changing the auth model (out of scope for the framework migration). The exact original
 * behavior (unauthenticated -> /login, authenticated on /login -> /) is preserved in the
 * client-side AuthGuard. If/when auth moves to an httpOnly cookie, enforce it here and
 * widen the matcher below.
 */
export function middleware() {
  return NextResponse.next();
}

export const config = { matcher: [] };
