import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

function resolveNextPath(rawNext: string | null) {
  if (!rawNext || !rawNext.startsWith("/")) {
    return "/dashboard";
  }

  return rawNext;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const nextPath = resolveNextPath(requestUrl.searchParams.get("next"));
  const redirectUrl = new URL(nextPath, requestUrl.origin);
  const signInUrl = new URL("/sign-in", requestUrl.origin);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    signInUrl.searchParams.set("message", "No fue posible preparar el acceso. Intenta de nuevo.");
    return NextResponse.redirect(signInUrl);
  }

  let errorMessage: string | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      errorMessage = error.message;
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) {
      errorMessage = error.message;
    }
  } else {
    errorMessage = "El enlace de acceso ya no es valido o esta incompleto.";
  }

  if (errorMessage) {
    signInUrl.searchParams.set("message", errorMessage);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.redirect(redirectUrl);
}