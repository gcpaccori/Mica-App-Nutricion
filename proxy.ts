import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getDevAuthBypassCredentials, isAuthBypassEnabled } from "@/lib/env";
import { createMiddlewareSupabaseClient } from "@/lib/supabase/middleware";

function withSupabaseCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach(({ name, value, ...rest }) => {
    target.cookies.set(name, value, rest);
  });

  return target;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const { response, supabase } = createMiddlewareSupabaseClient(request);

  if (!supabase) {
    return response;
  }

  const bypassEnabled = isAuthBypassEnabled();

  let {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && bypassEnabled) {
    const { email, password } = getDevAuthBypassCredentials();

    if (email && password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (!error) {
        user = data.user;
      } else {
        console.warn("[DEV_BYPASS_AUTH] Could not auto-login:", error.message);
      }
    }
  }

  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/patients") ||
    pathname.startsWith("/foods") ||
    pathname.startsWith("/plans") ||
    pathname.startsWith("/intake");

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return withSupabaseCookies(NextResponse.redirect(url), response);
  }

  if (user && pathname === "/sign-in") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return withSupabaseCookies(NextResponse.redirect(url), response);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/patients/:path*", "/foods/:path*", "/plans/:path*", "/intake/:path*", "/sign-in"],
};
