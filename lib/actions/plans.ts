"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getMealDistributionPct } from "@/lib/domain/meal-distribution";
import { getPatientDriContext } from "@/lib/dri/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureNutritionPlanForDietPlan } from "@/lib/workbook/server";

const planSchema = z.object({
  patientId: z.string().uuid(),
  goalId: z.string().uuid().optional(),
  name: z.string().min(1),
  objectiveType: z.string().min(1),
  dietType: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  dailyEnergyTargetKcal: z.coerce.number().positive().optional(),
  dailyProteinTargetG: z.coerce.number().positive().optional(),
  dailyFatTargetG: z.coerce.number().positive().optional(),
  dailyCarbsTargetG: z.coerce.number().positive().optional(),
  dailyFiberTargetG: z.coerce.number().positive().optional(),
  dailySodiumTargetMg: z.coerce.number().positive().optional(),
  notes: z.string().optional(),
});

function num(fd: FormData, k: string) {
  const v = fd.get(k);
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}

export async function createDietPlanAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const patientId = str(formData, "patient_id");

  const parsed = planSchema.safeParse({
    patientId,
    goalId: str(formData, "goal_id") || undefined,
    name: str(formData, "name"),
    objectiveType: str(formData, "objective_type"),
    dietType: str(formData, "diet_type") || undefined,
    startDate: str(formData, "start_date"),
    endDate: str(formData, "end_date") || undefined,
    dailyEnergyTargetKcal: num(formData, "daily_energy_target_kcal"),
    dailyProteinTargetG: num(formData, "daily_protein_target_g"),
    dailyFatTargetG: num(formData, "daily_fat_target_g"),
    dailyCarbsTargetG: num(formData, "daily_carbs_target_g"),
    dailyFiberTargetG: num(formData, "daily_fiber_target_g"),
    dailySodiumTargetMg: num(formData, "daily_sodium_target_mg"),
    notes: str(formData, "notes"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos de plan invalidos.";
    redirect(`/patients/${patientId}?tab=plans&message=${encodeURIComponent(msg)}`);
  }

  const v = parsed.data;

  const { data: plan, error } = await supabase.from("diet_plans").insert({
    patient_id: v.patientId,
    nutritionist_id: user.id,
    goal_id: v.goalId || null,
    name: v.name,
    objective_type: v.objectiveType,
    diet_type: v.dietType || null,
    start_date: v.startDate,
    end_date: v.endDate || null,
    status: "draft",
    daily_energy_target_kcal: v.dailyEnergyTargetKcal ?? null,
    daily_protein_target_g: v.dailyProteinTargetG ?? null,
    daily_fat_target_g: v.dailyFatTargetG ?? null,
    daily_carbs_target_g: v.dailyCarbsTargetG ?? null,
    daily_fiber_target_g: v.dailyFiberTargetG ?? null,
    daily_sodium_target_mg: v.dailySodiumTargetMg ?? null,
    notes: v.notes || null,
  }).select("id").single();

  if (error || !plan) {
    redirect(`/patients/${patientId}?tab=plans&message=${encodeURIComponent(error?.message ?? "Error al crear plan.")}`);
  }

  // Create 7 default days
  const days = Array.from({ length: 7 }, (_, i) => ({
    plan_id: plan.id,
    day_number: i + 1,
    label: `Dia ${i + 1}`,
  }));

  await supabase.from("diet_plan_days").insert(days);

  try {
    await ensureNutritionPlanForDietPlan(supabase, plan.id);
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : "No se pudo sincronizar el plan con el workbook nutricional.";
    redirect(`/patients/${patientId}?tab=plans&message=${encodeURIComponent(message)}`);
  }

  redirect(`/plans/${plan.id}?message=${encodeURIComponent("Plan creado con 7 dias. Agrega comidas y alimentos.")}`);
}

export async function activatePlanAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const planId = str(formData, "plan_id");
  const patientId = str(formData, "patient_id");

  const { error } = await supabase
    .from("diet_plans")
    .update({ status: "active" })
    .eq("id", planId);

  if (error) {
    redirect(`/patients/${patientId}?tab=plans&message=${encodeURIComponent(error.message)}`);
  }

  try {
    await ensureNutritionPlanForDietPlan(supabase, planId);
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : "No se pudo activar el caso integrado del plan.";
    redirect(`/patients/${patientId}?tab=plans&message=${encodeURIComponent(message)}`);
  }

  redirect(`/patients/${patientId}?tab=plans&message=${encodeURIComponent("Plan activado.")}`);
}

export async function addMealToDayAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const planDayId = str(formData, "plan_day_id");
  const mealTypeId = Number(str(formData, "meal_type_id"));
  const planId = str(formData, "plan_id");
  const visibleNameInput = str(formData, "visible_name");
  const menuTextInput = str(formData, "menu_text");

  let targetDistributionPct: number | null = null;
  let targetEnergyKcal: number | null = null;

  const [{ data: mealType }, { data: planDay }] = await Promise.all([
    supabase.from("meal_types").select("code, name").eq("id", mealTypeId).single(),
    supabase
      .from("diet_plan_days")
      .select("plan_id, diet_plans(patient_id, nutrition_plan_id, daily_energy_target_kcal, daily_protein_target_g, daily_fat_target_g, daily_carbs_target_g, daily_fiber_target_g, daily_sodium_target_mg)")
      .eq("id", planDayId)
      .single(),
  ]);

  const mealTypeCode = mealType?.code ?? null;
  const distributionPct = getMealDistributionPct(mealTypeCode);
  const plan = Array.isArray(planDay?.diet_plans) ? planDay?.diet_plans[0] : planDay?.diet_plans;

  if (plan?.nutrition_plan_id && mealTypeCode) {
    const { data: mealTarget } = await supabase
      .from("nutrition_plan_meal_target_v")
      .select("energy_pct, target_energy_kcal")
      .eq("nutrition_plan_id", plan.nutrition_plan_id)
      .eq("meal_code", mealTypeCode)
      .maybeSingle();

    if (mealTarget) {
      targetDistributionPct = mealTarget.energy_pct ? Number(mealTarget.energy_pct) : null;
      targetEnergyKcal = mealTarget.target_energy_kcal ? Number(mealTarget.target_energy_kcal) : null;
    }
  }

  if (targetDistributionPct == null && distributionPct && plan?.patient_id) {
    const { effectiveDailyTargets } = await getPatientDriContext(supabase, plan.patient_id, {
      daily_energy_target_kcal: plan.daily_energy_target_kcal,
      daily_protein_target_g: plan.daily_protein_target_g,
      daily_fat_target_g: plan.daily_fat_target_g,
      daily_carbs_target_g: plan.daily_carbs_target_g,
      daily_fiber_target_g: plan.daily_fiber_target_g,
      daily_sodium_target_mg: plan.daily_sodium_target_mg,
    });

    targetDistributionPct = distributionPct;
    targetEnergyKcal = effectiveDailyTargets.daily_energy_target_kcal
      ? Number(effectiveDailyTargets.daily_energy_target_kcal) * distributionPct
      : null;
  }

  const { error } = await supabase.from("diet_meals").insert({
    plan_day_id: planDayId,
    meal_type_id: mealTypeId,
    visible_name: visibleNameInput || mealType?.name || null,
    menu_text: menuTextInput || null,
    target_distribution_pct: targetDistributionPct,
    target_energy_kcal: targetEnergyKcal,
  });

  if (error) {
    redirect(`/plans/${planId}?message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/plans/${planId}`);
}

export async function updatePlanMealPresentationAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const mealId = str(formData, "meal_id");
  const planId = str(formData, "plan_id");
  const visibleName = str(formData, "visible_name");
  const menuText = str(formData, "menu_text");

  const { error } = await supabase
    .from("diet_meals")
    .update({
      visible_name: visibleName || null,
      menu_text: menuText || null,
    })
    .eq("id", mealId);

  if (error) {
    redirect(`/plans/${planId}?message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/plans/${planId}?message=${encodeURIComponent("Presentacion de la comida actualizada.")}`);
}

export async function addMealItemAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const mealId = str(formData, "meal_id");
  const alimentoId = Number(str(formData, "alimento_id"));
  const quantityGramsInput = Number(str(formData, "quantity_grams"));
  const planId = str(formData, "plan_id");
  const foodPortionId = Number(str(formData, "food_portion_id"));
  const portionMultiplier = Number(str(formData, "portion_multiplier")) || 1;
  let quantityGrams = quantityGramsInput;
  let householdMeasure = str(formData, "household_measure") || null;
  let householdQuantity = foodPortionId ? portionMultiplier : null;

  if (foodPortionId) {
    const { data: portion } = await supabase
      .from("nutrition_food_portion")
      .select("id, alimento_id, portion_label, net_grams")
      .eq("id", foodPortionId)
      .eq("alimento_id", alimentoId)
      .single();

    if (!portion) {
      redirect(`/plans/${planId}?message=${encodeURIComponent("La porcion seleccionada ya no existe para este alimento.")}`);
    }

    quantityGrams = Number(portion.net_grams) * portionMultiplier;
    householdMeasure = portion.portion_label;
    householdQuantity = portionMultiplier;
  }

  if (!alimentoId || !quantityGrams || quantityGrams <= 0) {
    redirect(`/plans/${planId}?message=${encodeURIComponent("Alimento y gramos son obligatorios.")}`);
  }

  const { error } = await supabase.from("diet_meal_items").insert({
    meal_id: mealId,
    alimento_id: alimentoId,
    quantity_grams: quantityGrams,
    household_measure: householdMeasure,
    household_quantity: householdQuantity,
    food_portion_id: foodPortionId || null,
    portion_multiplier: foodPortionId ? portionMultiplier : 1,
  });

  if (error) {
    redirect(`/plans/${planId}?message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/plans/${planId}`);
}
