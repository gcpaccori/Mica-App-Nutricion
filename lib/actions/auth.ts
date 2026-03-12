"use server";

import { redirect } from "next/navigation";

import { buildPublicAppUrl } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { appendToastToPath } from "@/lib/toast";

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signInAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    redirect(appendToastToPath("/sign-in", "Configura las variables de Supabase.", "warning"));
  }

  const email = getStringValue(formData, "email");
  const password = getStringValue(formData, "password");
  const next = getStringValue(formData, "next") || "/dashboard";

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message =
      error.message.toLowerCase() === "email not confirmed"
        ? "Tu email no esta confirmado. Abre el correo de Supabase y confirma la cuenta, o desactiva la confirmacion de email en Supabase Auth si quieres entrar inmediatamente en desarrollo."
        : error.message;

    redirect(appendToastToPath("/sign-in", message, "error"));
  }

  redirect(appendToastToPath(next, "Sesion iniciada correctamente.", "success"));
}

export async function signUpAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    redirect(appendToastToPath("/sign-in", "Configura las variables de Supabase.", "warning"));
  }

  const fullName = getStringValue(formData, "full_name");
  const email = getStringValue(formData, "email");
  const password = getStringValue(formData, "password");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: buildPublicAppUrl("/auth/confirm?next=/dashboard"),
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    redirect(appendToastToPath("/sign-in", error.message, "error"));
  }

  const message = data.session
    ? "Cuenta creada e iniciada correctamente."
    : "Cuenta creada. Revisa tu correo y confirma tu acceso desde el enlace oficial de la app.";

  redirect(appendToastToPath("/sign-in", message, data.session ? "success" : "warning"));
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  redirect(appendToastToPath("/", "Sesion cerrada correctamente.", "success"));
}