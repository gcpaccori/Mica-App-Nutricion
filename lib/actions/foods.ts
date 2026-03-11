"use server";

import { redirect } from "next/navigation";

import { FOOD_FIELDS } from "@/lib/foods/fields";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const DERIVED_GROUP_KEYS = new Set(["grupo_nombre", "grupo_slug"]);

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseValue(formData: FormData, key: string, type: "text" | "number") {
  const value = str(formData, key);
  if (!value) return null;
  if (type === "text") return value;

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildFoodPayload(formData: FormData) {
  const payload: Record<string, string | number | null> = {};

  for (const field of FOOD_FIELDS) {
    if (DERIVED_GROUP_KEYS.has(field.key)) continue;

    const parsed = parseValue(formData, field.key, field.type);
    if (field.required && (parsed == null || parsed === "")) {
      throw new Error(`El campo ${field.label} es obligatorio.`);
    }
    payload[field.key] = parsed;
  }

  return payload;
}

async function resolveGroupFields(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  groupNumber: number,
) {
  const { data, error } = await supabase
    .from("alimentos_26_grupos")
    .select("grupo_numero, grupo_nombre, grupo_slug")
    .eq("grupo_numero", groupNumber)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.grupo_nombre || !data?.grupo_slug) {
    throw new Error("No se pudo resolver el grupo seleccionado dentro de los 26 grupos.");
  }

  return {
    grupo_numero: data.grupo_numero,
    grupo_nombre: data.grupo_nombre,
    grupo_slug: data.grupo_slug,
  };
}

export async function createFoodAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  try {
    const payload = buildFoodPayload(formData);
    const groupNumber = Number(payload.grupo_numero);
    if (!Number.isFinite(groupNumber) || groupNumber <= 0) {
      throw new Error("Debes seleccionar un grupo válido.");
    }

    const resolvedGroup = await resolveGroupFields(supabase, groupNumber);
    const { error } = await supabase.from("alimentos_26_grupos").insert({
      ...payload,
      ...resolvedGroup,
    });

    if (error) {
      redirect(`/foods?message=${encodeURIComponent(error.message)}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el alimento.";
    redirect(`/foods?message=${encodeURIComponent(message)}`);
  }

  redirect(`/foods?message=${encodeURIComponent("Alimento creado correctamente.")}`);
}

export async function updateFoodAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const id = Number(str(formData, "id"));
  if (!id) {
    redirect(`/foods?message=${encodeURIComponent("Falta el identificador del alimento.")}`);
  }

  try {
    const payload = buildFoodPayload(formData);
    const groupNumber = Number(payload.grupo_numero);
    if (!Number.isFinite(groupNumber) || groupNumber <= 0) {
      throw new Error("Debes seleccionar un grupo válido.");
    }

    const resolvedGroup = await resolveGroupFields(supabase, groupNumber);
    const { error } = await supabase
      .from("alimentos_26_grupos")
      .update({
        ...payload,
        ...resolvedGroup,
      })
      .eq("id", id);

    if (error) {
      redirect(`/foods?message=${encodeURIComponent(error.message)}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el alimento.";
    redirect(`/foods?message=${encodeURIComponent(message)}`);
  }

  redirect(`/foods?message=${encodeURIComponent("Alimento actualizado correctamente.")}`);
}

export async function deleteFoodAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const id = Number(str(formData, "id"));
  if (!id) {
    redirect(`/foods?message=${encodeURIComponent("Falta el identificador del alimento.")}`);
  }

  const { error } = await supabase.from("alimentos_26_grupos").delete().eq("id", id);

  if (error) {
    redirect(`/foods?message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/foods?message=${encodeURIComponent("Alimento eliminado correctamente.")}`);
}