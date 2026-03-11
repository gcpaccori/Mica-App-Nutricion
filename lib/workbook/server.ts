import type { SupabaseClient } from "@supabase/supabase-js";

type DailyTargets = {
  daily_energy_target_kcal?: number | null;
  daily_protein_target_g?: number | null;
  daily_fat_target_g?: number | null;
  daily_carbs_target_g?: number | null;
  daily_fiber_target_g?: number | null;
  daily_sodium_target_mg?: number | null;
  daily_calcium_target_mg?: number | null;
  daily_iron_target_mg?: number | null;
  daily_vitamin_a_target_ug?: number | null;
  daily_vitamin_c_target_mg?: number | null;
};

type NutritionPlanCaseRow = {
  nutrition_plan_id: string;
  target_energy_kcal?: number | null;
  protein_target_g?: number | null;
  fat_target_g?: number | null;
  carbs_target_g?: number | null;
  fiber_target_g?: number | null;
  sodium_target_mg?: number | null;
  calcium_target_mg?: number | null;
  iron_target_mg?: number | null;
  vitamin_a_target_ug?: number | null;
  vitamin_c_target_mg?: number | null;
};

type PatientRow = {
  id: string;
  nutritionist_id: string;
  birth_date: string;
  sex: "male" | "female";
  activity_level?: string | null;
};

type GoalRow = {
  id: string;
  patient_id: string;
  nutrition_plan_id?: string | null;
  goal_type: string;
  start_date: string;
  end_date?: string | null;
  is_active: boolean;
  notes?: string | null;
  target_energy_kcal?: number | null;
  target_protein_g?: number | null;
  target_fat_g?: number | null;
  target_carbs_g?: number | null;
  target_fiber_g?: number | null;
  target_sodium_mg?: number | null;
  target_calcium_mg?: number | null;
  target_iron_mg?: number | null;
  target_vitamin_a_ug?: number | null;
  target_vitamin_c_mg?: number | null;
  calculation_method?: string | null;
  weight_reference_kg?: number | null;
  estimated_bmr_kcal?: number | null;
  activity_factor_used?: number | null;
  target_protein_pct?: number | null;
  target_carbs_pct?: number | null;
  target_fat_pct?: number | null;
  target_protein_g_per_kg?: number | null;
  target_carbs_g_per_kg?: number | null;
  target_fat_g_per_kg?: number | null;
};

type PlanRow = {
  id: string;
  patient_id: string;
  nutritionist_id: string;
  goal_id?: string | null;
  nutrition_plan_id?: string | null;
  name: string;
  objective_type: string;
  start_date: string;
  end_date?: string | null;
  status: string;
  notes?: string | null;
  daily_energy_target_kcal?: number | null;
  daily_protein_target_g?: number | null;
  daily_fat_target_g?: number | null;
  daily_carbs_target_g?: number | null;
  daily_fiber_target_g?: number | null;
  daily_sodium_target_mg?: number | null;
};

type NutritionPlanRow = {
  id: string;
  source_diet_plan_id?: string | null;
};

function calculateAgeYears(birthDate: string, referenceDate?: string | null) {
  const birth = new Date(birthDate);
  const reference = referenceDate ? new Date(referenceDate) : new Date();

  if (Number.isNaN(birth.getTime()) || Number.isNaN(reference.getTime())) {
    return null;
  }

  let years = reference.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = reference.getUTCMonth() - birth.getUTCMonth();

  if (monthDiff < 0 || (monthDiff === 0 && reference.getUTCDate() < birth.getUTCDate())) {
    years -= 1;
  }

  return Math.max(0, years);
}

function resolveGoalStatus(goal: GoalRow) {
  if (!goal.is_active) return "archived";
  if (goal.end_date && goal.end_date < new Date().toISOString().slice(0, 10)) return "archived";
  return "active";
}

function computeMacroPct(grams?: number | null, energyKcal?: number | null, kcalPerGram?: number) {
  if (!grams || !energyKcal || !kcalPerGram || energyKcal <= 0) return null;
  return (grams * kcalPerGram) / energyKcal;
}

function computePerKg(grams?: number | null, weightKg?: number | null) {
  if (!grams || !weightKg || weightKg <= 0) return null;
  return grams / weightKg;
}

async function getDefaultDistributionProfileId(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("nutrition_meal_distribution_profile")
    .select("id")
    .eq("code", "standard_5_meals_20_10_30_10_30")
    .maybeSingle();

  return data?.id ?? null;
}

async function getLatestWeightKg(supabase: SupabaseClient, patientId: string) {
  const { data } = await supabase
    .from("patient_measurements")
    .select("weight_kg")
    .eq("patient_id", patientId)
    .not("weight_kg", "is", null)
    .order("measured_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.weight_kg ? Number(data.weight_kg) : null;
}

async function upsertNutritionTargets(
  supabase: SupabaseClient,
  nutritionPlanId: string,
  macro: {
    protein_pct?: number | null;
    carbs_pct?: number | null;
    fat_pct?: number | null;
    protein_target_g?: number | null;
    carbs_target_g?: number | null;
    fat_target_g?: number | null;
    protein_target_g_per_kg?: number | null;
    carbs_target_g_per_kg?: number | null;
    fat_target_g_per_kg?: number | null;
  },
  micro: {
    fiber_target_g?: number | null;
    sodium_target_mg?: number | null;
    calcium_target_mg?: number | null;
    iron_target_mg?: number | null;
    vitamin_a_target_ug?: number | null;
    vitamin_c_target_mg?: number | null;
  },
) {
  const macroResult = await supabase.from("nutrition_plan_macro_target").upsert({
    nutrition_plan_id: nutritionPlanId,
    ...macro,
  }, { onConflict: "nutrition_plan_id" });

  if (macroResult.error) {
    throw new Error(macroResult.error.message);
  }

  const microResult = await supabase.from("nutrition_plan_micro_target").upsert({
    nutrition_plan_id: nutritionPlanId,
    ...micro,
  }, { onConflict: "nutrition_plan_id" });

  if (microResult.error) {
    throw new Error(microResult.error.message);
  }
}

async function getPatientRow(supabase: SupabaseClient, patientId: string) {
  const { data, error } = await supabase
    .from("patients")
    .select("id, nutritionist_id, birth_date, sex, activity_level")
    .eq("id", patientId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo cargar el paciente.");
  }

  return data as PatientRow;
}

export function toDailyTargetsFromNutritionPlanCase(planCase?: NutritionPlanCaseRow | null): DailyTargets {
  return {
    daily_energy_target_kcal: planCase?.target_energy_kcal ?? null,
    daily_protein_target_g: planCase?.protein_target_g ?? null,
    daily_fat_target_g: planCase?.fat_target_g ?? null,
    daily_carbs_target_g: planCase?.carbs_target_g ?? null,
    daily_fiber_target_g: planCase?.fiber_target_g ?? null,
    daily_sodium_target_mg: planCase?.sodium_target_mg ?? null,
    daily_calcium_target_mg: planCase?.calcium_target_mg ?? null,
    daily_iron_target_mg: planCase?.iron_target_mg ?? null,
    daily_vitamin_a_target_ug: planCase?.vitamin_a_target_ug ?? null,
    daily_vitamin_c_target_mg: planCase?.vitamin_c_target_mg ?? null,
  };
}

export async function ensureNutritionPlanForGoal(supabase: SupabaseClient, goalId: string) {
  const { data: goalData, error: goalError } = await supabase
    .from("patient_goals")
    .select("*")
    .eq("id", goalId)
    .single();

  if (goalError || !goalData) {
    throw new Error(goalError?.message ?? "No se pudo cargar el objetivo.");
  }

  const goal = goalData as GoalRow;
  const patient = await getPatientRow(supabase, goal.patient_id);
  const [distributionProfileId, latestWeightKg] = await Promise.all([
    getDefaultDistributionProfileId(supabase),
    getLatestWeightKg(supabase, goal.patient_id),
  ]);

  const nutritionPlanPayload = {
    patient_id: goal.patient_id,
    nutritionist_id: patient.nutritionist_id,
    source_goal_id: goal.id,
    distribution_profile_id: distributionProfileId,
    code: `goal-${goal.id.slice(0, 8)}`,
    label: `Caso nutricional ${goal.goal_type.replaceAll("_", " ")} ${goal.start_date}`,
    objective_type: goal.goal_type,
    sex: patient.sex,
    age_years: calculateAgeYears(patient.birth_date, goal.start_date),
    weight_reference_kg: goal.weight_reference_kg ?? latestWeightKg,
    activity_label: patient.activity_level ?? null,
    activity_factor_used: goal.activity_factor_used ?? null,
    estimated_bmr_kcal: goal.estimated_bmr_kcal ?? null,
    target_energy_kcal: goal.target_energy_kcal ?? null,
    calculation_method: goal.calculation_method ?? null,
    status: resolveGoalStatus(goal),
    starts_on: goal.start_date,
    ends_on: goal.end_date ?? null,
    notes: goal.notes ?? null,
  };

  let nutritionPlanId = goal.nutrition_plan_id ?? null;

  if (nutritionPlanId) {
    const { error } = await supabase
      .from("nutrition_plan")
      .update(nutritionPlanPayload)
      .eq("id", nutritionPlanId);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { data, error } = await supabase
      .from("nutrition_plan")
      .insert(nutritionPlanPayload)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "No se pudo crear el caso nutricional.");
    }

    nutritionPlanId = data.id;

    const linkResult = await supabase
      .from("patient_goals")
      .update({ nutrition_plan_id: nutritionPlanId })
      .eq("id", goal.id);

    if (linkResult.error) {
      throw new Error(linkResult.error.message);
    }
  }

  if (!nutritionPlanId) {
    throw new Error("No se pudo resolver el caso nutricional del objetivo.");
  }

  await upsertNutritionTargets(supabase, nutritionPlanId, {
    protein_pct: goal.target_protein_pct ?? null,
    carbs_pct: goal.target_carbs_pct ?? null,
    fat_pct: goal.target_fat_pct ?? null,
    protein_target_g: goal.target_protein_g ?? null,
    carbs_target_g: goal.target_carbs_g ?? null,
    fat_target_g: goal.target_fat_g ?? null,
    protein_target_g_per_kg: goal.target_protein_g_per_kg ?? null,
    carbs_target_g_per_kg: goal.target_carbs_g_per_kg ?? null,
    fat_target_g_per_kg: goal.target_fat_g_per_kg ?? null,
  }, {
    fiber_target_g: goal.target_fiber_g ?? null,
    sodium_target_mg: goal.target_sodium_mg ?? null,
    calcium_target_mg: goal.target_calcium_mg ?? null,
    iron_target_mg: goal.target_iron_mg ?? null,
    vitamin_a_target_ug: goal.target_vitamin_a_ug ?? null,
    vitamin_c_target_mg: goal.target_vitamin_c_mg ?? null,
  });

  return { nutritionPlanId };
}

export async function ensureNutritionPlanForDietPlan(supabase: SupabaseClient, planId: string) {
  const { data: planData, error: planError } = await supabase
    .from("diet_plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (planError || !planData) {
    throw new Error(planError?.message ?? "No se pudo cargar el plan.");
  }

  const plan = planData as PlanRow;
  const patient = await getPatientRow(supabase, plan.patient_id);
  const [distributionProfileId, latestWeightKg] = await Promise.all([
    getDefaultDistributionProfileId(supabase),
    getLatestWeightKg(supabase, plan.patient_id),
  ]);

  let linkedGoal: GoalRow | null = null;
  let goalNutritionPlan: NutritionPlanRow | null = null;

  if (plan.goal_id) {
    if (!plan.nutrition_plan_id) {
      await ensureNutritionPlanForGoal(supabase, plan.goal_id);
    }

    const { data: goalData, error: goalError } = await supabase
      .from("patient_goals")
      .select("*")
      .eq("id", plan.goal_id)
      .single();

    if (goalError) {
      throw new Error(goalError.message);
    }

    linkedGoal = (goalData as GoalRow) ?? null;

    if (linkedGoal?.nutrition_plan_id) {
      const { data: goalPlanData, error: goalPlanError } = await supabase
        .from("nutrition_plan")
        .select("id, source_diet_plan_id")
        .eq("id", linkedGoal.nutrition_plan_id)
        .single();

      if (goalPlanError) {
        throw new Error(goalPlanError.message);
      }

      goalNutritionPlan = (goalPlanData as NutritionPlanRow) ?? null;
    }
  }

  let nutritionPlanId = plan.nutrition_plan_id ?? null;
  const canReuseGoalCase = !!goalNutritionPlan && (!goalNutritionPlan.source_diet_plan_id || goalNutritionPlan.source_diet_plan_id === plan.id);

  if (!nutritionPlanId && canReuseGoalCase) {
    nutritionPlanId = goalNutritionPlan?.id ?? null;
  }

  const planPayload = {
    patient_id: plan.patient_id,
    nutritionist_id: plan.nutritionist_id,
    source_goal_id: canReuseGoalCase ? linkedGoal?.id ?? null : null,
    source_diet_plan_id: plan.id,
    distribution_profile_id: distributionProfileId,
    code: `plan-${plan.id.slice(0, 8)}`,
    label: plan.name,
    objective_type: plan.objective_type,
    sex: patient.sex,
    age_years: calculateAgeYears(patient.birth_date, plan.start_date),
    weight_reference_kg: linkedGoal?.weight_reference_kg ?? latestWeightKg,
    activity_label: patient.activity_level ?? null,
    activity_factor_used: linkedGoal?.activity_factor_used ?? null,
    estimated_bmr_kcal: linkedGoal?.estimated_bmr_kcal ?? null,
    target_energy_kcal: plan.daily_energy_target_kcal ?? linkedGoal?.target_energy_kcal ?? null,
    calculation_method: linkedGoal?.calculation_method ?? "manual_plan",
    status: plan.status,
    starts_on: plan.start_date,
    ends_on: plan.end_date ?? null,
    notes: plan.notes ?? linkedGoal?.notes ?? null,
  };

  if (nutritionPlanId) {
    const { error } = await supabase
      .from("nutrition_plan")
      .update(planPayload)
      .eq("id", nutritionPlanId);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { data, error } = await supabase
      .from("nutrition_plan")
      .insert(planPayload)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "No se pudo crear el caso del plan.");
    }

    nutritionPlanId = data.id;
  }

  const linkPlanResult = await supabase
    .from("diet_plans")
    .update({ nutrition_plan_id: nutritionPlanId })
    .eq("id", plan.id);

  if (linkPlanResult.error) {
    throw new Error(linkPlanResult.error.message);
  }

  if (!nutritionPlanId) {
    throw new Error("No se pudo resolver el caso nutricional del plan.");
  }

  const proteinTarget = plan.daily_protein_target_g ?? linkedGoal?.target_protein_g ?? null;
  const carbsTarget = plan.daily_carbs_target_g ?? linkedGoal?.target_carbs_g ?? null;
  const fatTarget = plan.daily_fat_target_g ?? linkedGoal?.target_fat_g ?? null;
  const energyTarget = plan.daily_energy_target_kcal ?? linkedGoal?.target_energy_kcal ?? null;
  const referenceWeight = linkedGoal?.weight_reference_kg ?? latestWeightKg;

  await upsertNutritionTargets(supabase, nutritionPlanId, {
    protein_pct: linkedGoal?.target_protein_pct ?? computeMacroPct(proteinTarget, energyTarget, 4),
    carbs_pct: linkedGoal?.target_carbs_pct ?? computeMacroPct(carbsTarget, energyTarget, 4),
    fat_pct: linkedGoal?.target_fat_pct ?? computeMacroPct(fatTarget, energyTarget, 9),
    protein_target_g: proteinTarget,
    carbs_target_g: carbsTarget,
    fat_target_g: fatTarget,
    protein_target_g_per_kg: linkedGoal?.target_protein_g_per_kg ?? computePerKg(proteinTarget, referenceWeight),
    carbs_target_g_per_kg: linkedGoal?.target_carbs_g_per_kg ?? computePerKg(carbsTarget, referenceWeight),
    fat_target_g_per_kg: linkedGoal?.target_fat_g_per_kg ?? computePerKg(fatTarget, referenceWeight),
  }, {
    fiber_target_g: plan.daily_fiber_target_g ?? linkedGoal?.target_fiber_g ?? null,
    sodium_target_mg: plan.daily_sodium_target_mg ?? linkedGoal?.target_sodium_mg ?? null,
    calcium_target_mg: linkedGoal?.target_calcium_mg ?? null,
    iron_target_mg: linkedGoal?.target_iron_mg ?? null,
    vitamin_a_target_ug: linkedGoal?.target_vitamin_a_ug ?? null,
    vitamin_c_target_mg: linkedGoal?.target_vitamin_c_mg ?? null,
  });

  return { nutritionPlanId };
}