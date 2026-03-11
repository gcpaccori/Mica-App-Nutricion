import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeDriCondition } from "@/lib/dri/condition.js";
import { buildMergedReferenceTargets, buildPlanDailyTargetsFromDriRows } from "@/lib/dri/targets.js";

type PlanDailyTargets = {
  daily_energy_target_kcal?: number | null;
  daily_protein_target_g?: number | null;
  daily_fat_target_g?: number | null;
  daily_carbs_target_g?: number | null;
  daily_fiber_target_g?: number | null;
  daily_sodium_target_mg?: number | null;
};

type DriRow = {
  nutrient_key: string;
  nutrient_label?: string | null;
  unit?: string | null;
  value_type?: string | null;
  value?: number | null;
  life_stage_label?: string | null;
  condition?: string | null;
  group_name?: string | null;
  source_table?: string | null;
  basis?: string | null;
  special?: string | null;
};

async function resolvePatientDriCondition(
  supabase: SupabaseClient,
  patientId: string,
  condition?: string | null,
) {
  if (condition !== undefined) {
    return normalizeDriCondition(condition);
  }

  try {
    const { data: latestAssessment } = await supabase
      .from("patient_assessments")
      .select("physiological_condition")
      .eq("patient_id", patientId)
      .order("assessed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return normalizeDriCondition(latestAssessment?.physiological_condition);
  } catch {
    return null;
  }
}

export async function getPatientDriContext(
  supabase: SupabaseClient,
  patientId: string,
  baseTargets: PlanDailyTargets = {},
  condition?: string | null,
) {
  let driRows: DriRow[] = [];
  const resolvedCondition = await resolvePatientDriCondition(supabase, patientId, condition);

  try {
    const { data } = await supabase.rpc("get_patient_dri_targets", {
      p_patient_id: patientId,
      p_condition: resolvedCondition,
    });

    if (Array.isArray(data)) {
      driRows = data as DriRow[];
    }
  } catch {
    driRows = [];
  }

  const effectiveDailyTargets = buildPlanDailyTargetsFromDriRows(driRows, baseTargets);
  const referenceTargets = buildMergedReferenceTargets(driRows, effectiveDailyTargets);
  const profileRow = driRows.find((row) => row.life_stage_label || row.condition || row.group_name) ?? null;

  return {
    driRows,
    effectiveDailyTargets,
    referenceTargets,
    resolvedCondition,
    referenceLifeStageLabel: profileRow?.life_stage_label ?? null,
    referenceGroupName: profileRow?.group_name ?? null,
  };
}