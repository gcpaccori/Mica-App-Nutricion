"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const assessmentSchema = z.object({
  patientId: z.string().uuid(),
  assessedAt: z.string().min(1),
  appetiteLevel: z.string().optional(),
  physiologicalCondition: z.enum(["pregnancy", "lactation"]).optional(),
  hydrationMl: z.coerce.number().nonnegative().optional(),
  recall24h: z.string().optional(),
  foodFrequencyNotes: z.string().optional(),
  eatingOutNotes: z.string().optional(),
  adherenceBarriers: z.string().optional(),
  clinicalNotes: z.string().optional(),
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

function buildAssessmentValues(formData: FormData) {
  const patientId = str(formData, "patient_id");
  const physiologicalCondition = str(formData, "physiological_condition") || undefined;
  const parsed = assessmentSchema.safeParse({
    patientId,
    assessedAt: str(formData, "assessed_at"),
    appetiteLevel: str(formData, "appetite_level"),
    physiologicalCondition,
    hydrationMl: num(formData, "hydration_ml"),
    recall24h: str(formData, "recall_24h"),
    foodFrequencyNotes: str(formData, "food_frequency_notes"),
    eatingOutNotes: str(formData, "eating_out_notes"),
    adherenceBarriers: str(formData, "adherence_barriers"),
    clinicalNotes: str(formData, "clinical_notes"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos de evaluacion invalidos.");
  }

  return parsed.data;
}

function assessmentPayload(values: z.infer<typeof assessmentSchema>) {
  return {
    patient_id: values.patientId,
    assessed_at: values.assessedAt,
    appetite_level: values.appetiteLevel || null,
    physiological_condition: values.physiologicalCondition ?? null,
    hydration_ml: values.hydrationMl ?? null,
    recall_24h: values.recall24h || null,
    food_frequency_notes: values.foodFrequencyNotes || null,
    eating_out_notes: values.eatingOutNotes || null,
    adherence_barriers: values.adherenceBarriers || null,
    clinical_notes: values.clinicalNotes || null,
  };
}

async function validatePhysiologicalCondition(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  patientId: string,
  physiologicalCondition?: "pregnancy" | "lactation",
) {
  if (!physiologicalCondition) {
    return;
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("sex")
    .eq("id", patientId)
    .single();

  if (patient?.sex !== "female") {
    throw new Error("La condicion fisiologica solo aplica a pacientes de sexo femenino para DRIs de embarazo o lactancia.");
  }
}

export async function createAssessmentAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const patientId = str(formData, "patient_id");

  let v: z.infer<typeof assessmentSchema>;

  try {
    v = buildAssessmentValues(formData);
    await validatePhysiologicalCondition(supabase, v.patientId, v.physiologicalCondition);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Datos de evaluacion invalidos.";
    redirect(`/patients/${patientId}?tab=assessments&message=${encodeURIComponent(msg)}`);
  }

  const { error } = await supabase.from("patient_assessments").insert({
    ...assessmentPayload(v),
  });

  if (error) {
    redirect(`/patients/${patientId}?tab=assessments&message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/patients/${patientId}?tab=assessments&message=${encodeURIComponent("Evaluacion registrada correctamente.")}`);
}

export async function updateAssessmentAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const patientId = str(formData, "patient_id");
  const assessmentId = str(formData, "id");

  if (!assessmentId) {
    redirect(`/patients/${patientId}?tab=assessments&message=${encodeURIComponent("Falta el identificador de la evaluacion.")}`);
  }

  let v: z.infer<typeof assessmentSchema>;

  try {
    v = buildAssessmentValues(formData);
    await validatePhysiologicalCondition(supabase, v.patientId, v.physiologicalCondition);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Datos de evaluacion invalidos.";
    redirect(`/patients/${patientId}?tab=assessments&editAssessment=${assessmentId}&message=${encodeURIComponent(msg)}`);
  }

  const { error } = await supabase
    .from("patient_assessments")
    .update(assessmentPayload(v))
    .eq("id", assessmentId)
    .eq("patient_id", patientId);

  if (error) {
    redirect(`/patients/${patientId}?tab=assessments&editAssessment=${assessmentId}&message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/patients/${patientId}?tab=assessments&message=${encodeURIComponent("Evaluacion actualizada correctamente.")}`);
}

export async function deleteAssessmentAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const patientId = str(formData, "patient_id");
  const assessmentId = str(formData, "id");

  if (!assessmentId) {
    redirect(`/patients/${patientId}?tab=assessments&message=${encodeURIComponent("Falta el identificador de la evaluacion.")}`);
  }

  const { error } = await supabase
    .from("patient_assessments")
    .delete()
    .eq("id", assessmentId)
    .eq("patient_id", patientId);

  if (error) {
    redirect(`/patients/${patientId}?tab=assessments&editAssessment=${assessmentId}&message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/patients/${patientId}?tab=assessments&message=${encodeURIComponent("Evaluacion eliminada correctamente.")}`);
}
