"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const measurementSchema = z.object({
  patientId: z.string().uuid(),
  measuredAt: z.string().min(1),
  weightKg: z.coerce.number().positive().optional(),
  heightM: z.coerce.number().positive().optional(),
  waistCm: z.coerce.number().positive().optional(),
  hipCm: z.coerce.number().positive().optional(),
  usualWeightKg: z.coerce.number().positive().optional(),
  notes: z.string().optional(),
});

function num(formData: FormData, key: string) {
  const v = formData.get(key);
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function buildMeasurementValues(formData: FormData) {
  const patientId = str(formData, "patient_id");
  const parsed = measurementSchema.safeParse({
    patientId,
    measuredAt: str(formData, "measured_at"),
    weightKg: num(formData, "weight_kg"),
    heightM: num(formData, "height_m"),
    waistCm: num(formData, "waist_cm"),
    hipCm: num(formData, "hip_cm"),
    usualWeightKg: num(formData, "usual_weight_kg"),
    notes: str(formData, "notes"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos de medicion invalidos.");
  }

  return parsed.data;
}

function measurementPayload(values: z.infer<typeof measurementSchema>) {
  return {
    patient_id: values.patientId,
    measured_at: values.measuredAt,
    weight_kg: values.weightKg ?? null,
    height_m: values.heightM ?? null,
    waist_cm: values.waistCm ?? null,
    hip_cm: values.hipCm ?? null,
    usual_weight_kg: values.usualWeightKg ?? null,
    notes: values.notes || null,
  };
}

export async function createMeasurementAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const patientId = str(formData, "patient_id");

  let v: z.infer<typeof measurementSchema>;

  try {
    v = buildMeasurementValues(formData);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Datos de medicion invalidos.";
    redirect(`/patients/${patientId}?tab=measurements&message=${encodeURIComponent(msg)}`);
  }

  const { error } = await supabase.from("patient_measurements").insert({
    ...measurementPayload(v),
  });

  if (error) {
    redirect(`/patients/${patientId}?tab=measurements&message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/patients/${patientId}?tab=measurements&message=${encodeURIComponent("Medicion registrada correctamente.")}`);
}

export async function updateMeasurementAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const patientId = str(formData, "patient_id");
  const measurementId = str(formData, "id");

  if (!measurementId) {
    redirect(`/patients/${patientId}?tab=measurements&message=${encodeURIComponent("Falta el identificador de la medicion.")}`);
  }

  let v: z.infer<typeof measurementSchema>;

  try {
    v = buildMeasurementValues(formData);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Datos de medicion invalidos.";
    redirect(`/patients/${patientId}?tab=measurements&editMeasurement=${measurementId}&message=${encodeURIComponent(msg)}`);
  }

  const { error } = await supabase
    .from("patient_measurements")
    .update(measurementPayload(v))
    .eq("id", measurementId)
    .eq("patient_id", patientId);

  if (error) {
    redirect(`/patients/${patientId}?tab=measurements&editMeasurement=${measurementId}&message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/patients/${patientId}?tab=measurements&message=${encodeURIComponent("Medicion actualizada correctamente.")}`);
}

export async function deleteMeasurementAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const patientId = str(formData, "patient_id");
  const measurementId = str(formData, "id");

  if (!measurementId) {
    redirect(`/patients/${patientId}?tab=measurements&message=${encodeURIComponent("Falta el identificador de la medicion.")}`);
  }

  const { error } = await supabase
    .from("patient_measurements")
    .delete()
    .eq("id", measurementId)
    .eq("patient_id", patientId);

  if (error) {
    redirect(`/patients/${patientId}?tab=measurements&editMeasurement=${measurementId}&message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/patients/${patientId}?tab=measurements&message=${encodeURIComponent("Medicion eliminada correctamente.")}`);
}
