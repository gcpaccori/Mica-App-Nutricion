import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createMiddlewareSupabaseClient } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const { response, supabase } = createMiddlewareSupabaseClient(request);

  if (!supabase) {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/sign-in") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/patients/:path*", "/foods/:path*", "/plans/:path*", "/intake/:path*", "/sign-in"],
};