"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signInAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    redirect("/sign-in?message=Configura%20las%20variables%20de%20Supabase.");
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

    redirect(`/sign-in?message=${encodeURIComponent(message)}`);
  }

  redirect(next);
}

export async function signUpAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    redirect("/sign-in?message=Configura%20las%20variables%20de%20Supabase.");
  }

  const fullName = getStringValue(formData, "full_name");
  const email = getStringValue(formData, "email");
  const password = getStringValue(formData, "password");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    redirect(`/sign-in?message=${encodeURIComponent(error.message)}`);
  }

  const message = data.session
    ? "Cuenta creada e iniciada correctamente."
    : "Cuenta creada. Revisa tu email y confirma la cuenta antes de iniciar sesion, o desactiva Confirm email en Supabase Auth para desarrollo.";

  redirect(`/sign-in?message=${encodeURIComponent(message)}`);
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  redirect("/");
}