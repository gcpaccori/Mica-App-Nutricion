import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { buildPublicAppUrl } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { appendToastToPath } from "@/lib/toast";

function resolveNextPath(rawNext: string | null) {
  if (!rawNext || !rawNext.startsWith("/")) {
    return "/dashboard";
  }

  return rawNext;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const nextPath = resolveNextPath(requestUrl.searchParams.get("next"));
  const redirectUrl = new URL(buildPublicAppUrl(nextPath));
  const signInUrl = new URL(buildPublicAppUrl("/sign-in"));
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.redirect(
      new URL(appendToastToPath(signInUrl.toString(), "No fue posible preparar el acceso. Intenta de nuevo.", "error")),
    );
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
    return NextResponse.redirect(
      new URL(appendToastToPath(signInUrl.toString(), errorMessage, "error")),
    );
  }

  return NextResponse.redirect(
    new URL(appendToastToPath(redirectUrl.toString(), "Correo confirmado y acceso habilitado.", "success")),
  );
}