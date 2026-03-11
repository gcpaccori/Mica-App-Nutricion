"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureNutritionPlanForGoal } from "@/lib/workbook/server";

const goalSchema = z.object({
  patientId: z.string().uuid(),
  goalType: z.string().min(1),
  targetWeightKg: z.coerce.number().positive().optional(),
  targetEnergyKcal: z.coerce.number().positive().optional(),
  targetProteinG: z.coerce.number().positive().optional(),
  targetFatG: z.coerce.number().positive().optional(),
  targetCarbsG: z.coerce.number().positive().optional(),
  targetFiberG: z.coerce.number().positive().optional(),
  targetSodiumMg: z.coerce.number().positive().optional(),
  targetCalciumMg: z.coerce.number().positive().optional(),
  targetIronMg: z.coerce.number().positive().optional(),
  targetVitaminAUg: z.coerce.number().positive().optional(),
  targetVitaminCMg: z.coerce.number().positive().optional(),
  calculationMethod: z.string().optional(),
  weightReferenceKg: z.coerce.number().positive().optional(),
  estimatedBmrKcal: z.coerce.number().positive().optional(),
  activityFactorUsed: z.coerce.number().positive().optional(),
  targetProteinPct: z.coerce.number().positive().optional(),
  targetCarbsPct: z.coerce.number().positive().optional(),
  targetFatPct: z.coerce.number().positive().optional(),
  targetProteinGPerKg: z.coerce.number().positive().optional(),
  targetCarbsGPerKg: z.coerce.number().positive().optional(),
  targetFatGPerKg: z.coerce.number().positive().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
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

function buildGoalValues(formData: FormData) {
  const patientId = str(formData, "patient_id");
  const parsed = goalSchema.safeParse({
    patientId,
    goalType: str(formData, "goal_type"),
    targetWeightKg: num(formData, "target_weight_kg"),
    targetEnergyKcal: num(formData, "target_energy_kcal"),
    targetProteinG: num(formData, "target_protein_g"),
    targetFatG: num(formData, "target_fat_g"),
    targetCarbsG: num(formData, "target_carbs_g"),
    targetFiberG: num(formData, "target_fiber_g"),
    targetSodiumMg: num(formData, "target_sodium_mg"),
    targetCalciumMg: num(formData, "target_calcium_mg"),
    targetIronMg: num(formData, "target_iron_mg"),
    targetVitaminAUg: num(formData, "target_vitamin_a_ug"),
    targetVitaminCMg: num(formData, "target_vitamin_c_mg"),
    calculationMethod: str(formData, "calculation_method"),
    weightReferenceKg: num(formData, "weight_reference_kg"),
    estimatedBmrKcal: num(formData, "estimated_bmr_kcal"),
    activityFactorUsed: num(formData, "activity_factor_used"),
    targetProteinPct: num(formData, "target_protein_pct"),
    targetCarbsPct: num(formData, "target_carbs_pct"),
    targetFatPct: num(formData, "target_fat_pct"),
    targetProteinGPerKg: num(formData, "target_protein_g_per_kg"),
    targetCarbsGPerKg: num(formData, "target_carbs_g_per_kg"),
    targetFatGPerKg: num(formData, "target_fat_g_per_kg"),
    startDate: str(formData, "start_date"),
    endDate: str(formData, "end_date") || undefined,
    notes: str(formData, "notes"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos de objetivo invalidos.");
  }

  return parsed.data;
}

function goalPayload(values: z.infer<typeof goalSchema>, isActive: boolean) {
  return {
    patient_id: values.patientId,
    goal_type: values.goalType,
    target_weight_kg: values.targetWeightKg ?? null,
    target_energy_kcal: values.targetEnergyKcal ?? null,
    target_protein_g: values.targetProteinG ?? null,
    target_fat_g: values.targetFatG ?? null,
    target_carbs_g: values.targetCarbsG ?? null,
    target_fiber_g: values.targetFiberG ?? null,
    target_sodium_mg: values.targetSodiumMg ?? null,
    target_calcium_mg: values.targetCalciumMg ?? null,
    target_iron_mg: values.targetIronMg ?? null,
    target_vitamin_a_ug: values.targetVitaminAUg ?? null,
    target_vitamin_c_mg: values.targetVitaminCMg ?? null,
    calculation_method: values.calculationMethod || null,
    weight_reference_kg: values.weightReferenceKg ?? null,
    estimated_bmr_kcal: values.estimatedBmrKcal ?? null,
    activity_factor_used: values.activityFactorUsed ?? null,
    target_protein_pct: values.targetProteinPct ?? null,
    target_carbs_pct: values.targetCarbsPct ?? null,
    target_fat_pct: values.targetFatPct ?? null,
    target_protein_g_per_kg: values.targetProteinGPerKg ?? null,
    target_carbs_g_per_kg: values.targetCarbsGPerKg ?? null,
    target_fat_g_per_kg: values.targetFatGPerKg ?? null,
    start_date: values.startDate,
    end_date: values.endDate || null,
    is_active: isActive,
    notes: values.notes || null,
  };
}

export async function createGoalAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const patientId = str(formData, "patient_id");

  let v: z.infer<typeof goalSchema>;

  try {
    v = buildGoalValues(formData);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Datos de objetivo invalidos.";
    redirect(`/patients/${patientId}?tab=goals&message=${encodeURIComponent(msg)}`);
  }

  const { data: goal, error } = await supabase.from("patient_goals").insert({
    ...goalPayload(v, true),
  }).select("id").single();

  if (error || !goal) {
    redirect(`/patients/${patientId}?tab=goals&message=${encodeURIComponent(error.message)}`);
  }

  try {
    await ensureNutritionPlanForGoal(supabase, goal.id);
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : "No se pudo sincronizar el caso nutricional.";
    redirect(`/patients/${patientId}?tab=goals&message=${encodeURIComponent(message)}`);
  }

  redirect(`/patients/${patientId}?tab=goals&message=${encodeURIComponent("Objetivo creado correctamente.")}`);
}

export async function updateGoalAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const patientId = str(formData, "patient_id");
  const goalId = str(formData, "id");

  if (!goalId) {
    redirect(`/patients/${patientId}?tab=goals&message=${encodeURIComponent("Falta el identificador del objetivo.")}`);
  }

  let v: z.infer<typeof goalSchema>;

  try {
    v = buildGoalValues(formData);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Datos de objetivo invalidos.";
    redirect(`/patients/${patientId}?tab=goals&editGoal=${goalId}&message=${encodeURIComponent(msg)}`);
  }

  const isActive = str(formData, "is_active") === "true";
  const { error } = await supabase
    .from("patient_goals")
    .update(goalPayload(v, isActive))
    .eq("id", goalId)
    .eq("patient_id", patientId);

  if (error) {
    redirect(`/patients/${patientId}?tab=goals&editGoal=${goalId}&message=${encodeURIComponent(error.message)}`);
  }

  try {
    await ensureNutritionPlanForGoal(supabase, goalId);
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : "No se pudo actualizar el caso nutricional.";
    redirect(`/patients/${patientId}?tab=goals&editGoal=${goalId}&message=${encodeURIComponent(message)}`);
  }

  redirect(`/patients/${patientId}?tab=goals&message=${encodeURIComponent("Objetivo actualizado correctamente.")}`);
}

export async function deleteGoalAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const patientId = str(formData, "patient_id");
  const goalId = str(formData, "id");

  if (!goalId) {
    redirect(`/patients/${patientId}?tab=goals&message=${encodeURIComponent("Falta el identificador del objetivo.")}`);
  }

  const { error } = await supabase
    .from("patient_goals")
    .delete()
    .eq("id", goalId)
    .eq("patient_id", patientId);

  if (error) {
    redirect(`/patients/${patientId}?tab=goals&editGoal=${goalId}&message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/patients/${patientId}?tab=goals&message=${encodeURIComponent("Objetivo eliminado correctamente.")}`);
}

export async function toggleGoalAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const goalId = str(formData, "goal_id");
  const patientId = str(formData, "patient_id");
  const currentActive = str(formData, "is_active") === "true";

  const { error } = await supabase
    .from("patient_goals")
    .update({ is_active: !currentActive })
    .eq("id", goalId);

  if (error) {
    redirect(`/patients/${patientId}?tab=goals&message=${encodeURIComponent(error.message)}`);
  }

  if (goalId) {
    try {
      await ensureNutritionPlanForGoal(supabase, goalId);
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : "No se pudo actualizar el caso nutricional.";
      redirect(`/patients/${patientId}?tab=goals&message=${encodeURIComponent(message)}`);
    }
  }

  redirect(`/patients/${patientId}?tab=goals`);
}
