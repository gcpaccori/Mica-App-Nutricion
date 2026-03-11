import { redirect } from "next/navigation";
import Link from "next/link";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createMeasurementAction,
  deleteMeasurementAction,
  updateMeasurementAction,
} from "@/lib/actions/measurements";
import {
  createAssessmentAction,
  deleteAssessmentAction,
  updateAssessmentAction,
} from "@/lib/actions/assessments";
import {
  createGoalAction,
  deleteGoalAction,
  toggleGoalAction,
  updateGoalAction,
} from "@/lib/actions/goals";
import { createDietPlanAction, activatePlanAction } from "@/lib/actions/plans";
import {
  createIntakeDayAction,
  deleteIntakeDayAction,
  updateIntakeDayAction,
} from "@/lib/actions/intake";
import { NutritionBusinessBoard } from "@/components/nutrition-business-board";
import { buildNutritionCase } from "@/lib/domain/nutrition-case";
import { getDriConditionLabel } from "@/lib/dri/condition.js";
import { getPatientDriContext } from "@/lib/dri/server";

type DailyComparison = {
  patient_id: string;
  plan_id?: string | null;
  intake_date: string;
  planned_energy_kcal?: number | null;
  actual_energy_kcal?: number | null;
  planned_protein_g?: number | null;
  actual_protein_g?: number | null;
  planned_fiber_g?: number | null;
  actual_fiber_g?: number | null;
  planned_sodium_mg?: number | null;
  actual_sodium_mg?: number | null;
  energy_adequacy_pct?: number | null;
  protein_adequacy_pct?: number | null;
  fiber_adequacy_pct?: number | null;
  adherence_pct?: number | null;
};

type IntakeGroupSummary = {
  patient_id: string;
  intake_date: string;
  grupo_numero?: number | null;
  grupo_nombre?: string | null;
  item_count?: number | null;
  grams_total?: number | null;
  energy_kcal?: number | null;
  protein_g?: number | null;
  fiber_g?: number | null;
  sodium_mg?: number | null;
};

type PlanPreviewMeal = {
  meal_id: string;
  meal_type_name: string;
  visible_name?: string | null;
  meal_target_pct?: number | null;
};

type PlanPreviewItem = {
  meal_id: string;
  alimento: string;
  saved_portion_label?: string | null;
  household_measure?: string | null;
  quantity_grams?: number | null;
  energy_kcal?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carbs_g?: number | null;
  fiber_g?: number | null;
  calcium_mg?: number | null;
  iron_mg?: number | null;
  vitamin_a_rae_ug?: number | null;
  vitamin_c_mg?: number | null;
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function msg(v?: string | string[]) {
  return Array.isArray(v) ? v[0] : v;
}

const tabs = ["overview", "measurements", "assessments", "goals", "plans", "intake", "reports"] as const;
type Tab = (typeof tabs)[number];

const tabLabels: Record<Tab, string> = {
  overview: "Resumen del caso",
  measurements: "Medidas del paciente",
  assessments: "Hábitos y evaluación",
  goals: "Objetivos nutricionales",
  plans: "Plan de comidas",
  intake: "Consumo real",
  reports: "Reporte final",
};

const tabDescriptions: Record<Tab, string> = {
  overview: "Mira el resumen del caso, lo pendiente y lo que ya está listo para entregar.",
  measurements: "Registra peso, talla e IMC. Sin esta base no se puede calcular bien el caso.",
  assessments: "Guarda apetito, hidratación, recordatorio de 24 horas y barreras del paciente.",
  goals: "Define calorías, proteína, fibra y sodio que guiarán la atención nutricional.",
  plans: "Construye el menú por comidas y revisa si la prescripción quedó operativa.",
  intake: "Anota lo que realmente comió el paciente y compáralo contra el plan.",
  reports: "Revisa el cierre clínico y genera la ficha final para compartir o descargar.",
};

const inputClass = "mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-[#0f5c4d] focus:outline-none";
const labelClass = "block text-sm font-medium text-slate-700";
const btnPrimary = "rounded-full bg-[#0f5c4d] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0a4a3d]";
const btnSecondary = "rounded-full border border-[#0f5c4d]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[#0f5c4d] transition hover:bg-[#f1f7f4]";

const summaryReferenceKeys = [
  "proteinas_g",
  "lipidos_totales_g",
  "carbohidratos_disponibles_g",
  "fibra_alimentaria_g",
  "sodio_mg",
  "potasio_mg",
  "calcio_mg",
  "hierro_mg",
  "magnesio_mg",
  "zinc_mg",
  "vitamina_c_mg",
  "vitamina_a_rae_ug",
];

function physiologicalConditionLabel(value?: string | null) {
  return getDriConditionLabel(value);
}

function mealLabel(code: string) {
  if (code === "breakfast") return "Desayuno";
  if (code === "mid_morning") return "Merienda 1";
  if (code === "lunch") return "Almuerzo";
  if (code === "mid_afternoon") return "Merienda 2";
  if (code === "dinner") return "Cena";
  return code;
}

function formatAdequacy(value?: number | null) {
  if (value == null) return "—";
  return `${Number(value).toFixed(0)}%`;
}

export default async function PatientDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const message = msg(sp.message);
  const activeTab = (tabs.includes(msg(sp.tab) as Tab) ? msg(sp.tab) : "overview") as Tab;
  const editMeasurementId = msg(sp.editMeasurement) ?? "";
  const editAssessmentId = msg(sp.editAssessment) ?? "";
  const editGoalId = msg(sp.editGoal) ?? "";
  const editIntakeId = msg(sp.editIntake) ?? "";

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();

  if (!patient) redirect("/patients?message=" + encodeURIComponent("Paciente no encontrado."));

  const [
    { data: measurements },
    { data: assessments },
    { data: goals },
    { data: plans },
    { data: intakeDays },
    { data: nutritionCases },
    { data: intakeAdequacyRows },
    { data: dailyComparisonRows },
    { data: intakeGroupSummaryRows },
  ] = await Promise.all([
    supabase.from("patient_measurements").select("*").eq("patient_id", id).order("measured_at", { ascending: false }),
    supabase.from("patient_assessments").select("*").eq("patient_id", id).order("assessed_at", { ascending: false }),
    supabase.from("patient_goals").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
    supabase.from("diet_plans").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
    supabase.from("intake_days").select("*").eq("patient_id", id).order("intake_date", { ascending: false }).limit(20),
    supabase.from("nutrition_plan_case_v").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
    supabase.from("intake_day_adequacy_v").select("*").eq("patient_id", id).order("intake_date", { ascending: false }).limit(20),
    supabase.from("daily_plan_vs_intake_v").select("*").eq("patient_id", id).order("intake_date", { ascending: false }).limit(20),
    supabase.from("intake_group_summary_v").select("*").eq("patient_id", id).order("intake_date", { ascending: false }).order("energy_kcal", { ascending: false }).limit(50),
  ]);

  const lastMeasurement = measurements?.[0];
  const latestAssessment = assessments?.[0] ?? null;
  const {
    effectiveDailyTargets: patientDriTargets,
    referenceTargets: patientReferenceTargets,
    resolvedCondition,
    referenceLifeStageLabel,
  } = await getPatientDriContext(
    supabase,
    id,
    {},
  );
  const nutritionCase = buildNutritionCase({
    birthDate: patient.birth_date,
    sex: patient.sex,
    activityLevel: patient.activity_level,
    weightKg: lastMeasurement?.weight_kg ? Number(lastMeasurement.weight_kg) : null,
    referenceTargets: patientReferenceTargets,
  });
  const computedGoalDefaults = {
    energy: nutritionCase?.estimatedEnergyRequirementKcal ?? patientDriTargets.daily_energy_target_kcal ?? null,
    protein: nutritionCase?.proteinGrams ?? patientDriTargets.daily_protein_target_g ?? null,
    fat: nutritionCase?.fatGrams ?? patientDriTargets.daily_fat_target_g ?? null,
    carbs: nutritionCase?.carbsGrams ?? patientDriTargets.daily_carbs_target_g ?? null,
    fiber: nutritionCase?.fiberTargetG ?? patientDriTargets.daily_fiber_target_g ?? null,
    sodium: nutritionCase?.sodiumTargetMg ?? patientDriTargets.daily_sodium_target_mg ?? null,
  };
  const nutritionCaseById = new Map((nutritionCases ?? []).map((planCase) => [planCase.nutrition_plan_id, planCase]));
  const intakeAdequacyByDayId = new Map((intakeAdequacyRows ?? []).map((row) => [row.intake_day_id, row]));
  const dailyComparisons = (dailyComparisonRows ?? []) as DailyComparison[];
  const intakeGroupSummaries = (intakeGroupSummaryRows ?? []) as IntakeGroupSummary[];
  const selectedMeasurement = measurements?.find((measurement) => measurement.id === editMeasurementId) ?? null;
  const selectedAssessment = assessments?.find((assessment) => assessment.id === editAssessmentId) ?? null;
  const selectedGoal = goals?.find((goal) => goal.id === editGoalId) ?? null;
  const selectedIntakeDay = intakeDays?.find((intakeDay) => intakeDay.id === editIntakeId) ?? null;
  const latestIntakeDate = intakeDays?.[0]?.intake_date ?? null;
  const latestGroupSummary = latestIntakeDate
    ? intakeGroupSummaries.filter((row) => row.intake_date === latestIntakeDate)
    : [];
  const topLatestGroups = latestGroupSummary.slice(0, 6);
  const latestAssessmentRecall = latestAssessment?.recall_24h ?? null;
  const latestAssessmentBarriers = latestAssessment?.adherence_barriers ?? null;
  const latestAssessmentFrequency = latestAssessment?.food_frequency_notes ?? null;
  const latestAssessmentEatingOut = latestAssessment?.eating_out_notes ?? null;
  const latestGoal = goals?.find((goal) => goal.is_active) ?? goals?.[0] ?? null;
  const latestPlan = plans?.find((plan) => plan.status === "active") ?? plans?.[0] ?? null;
  const latestIntake = intakeDays?.[0] ?? null;
  const latestAdequacy = latestIntake ? intakeAdequacyByDayId.get(latestIntake.id) ?? null : null;
  const latestComparison = dailyComparisons[0] ?? null;
  let previewMeals: PlanPreviewMeal[] = [];
  let previewItems: PlanPreviewItem[] = [];

  if (latestPlan) {
    const { data: previewDay } = await supabase
      .from("diet_plan_days")
      .select("id, day_number")
      .eq("plan_id", latestPlan.id)
      .order("day_number")
      .limit(1)
      .maybeSingle();

    if (previewDay?.id) {
      const [{ data: mealRows }, { data: itemRows }] = await Promise.all([
        supabase
          .from("diet_meal_adequacy_v")
          .select("meal_id, meal_type_name, visible_name, meal_target_pct")
          .eq("plan_day_id", previewDay.id),
        supabase
          .from("diet_meal_item_nutrients_v")
          .select("meal_id, alimento, saved_portion_label, household_measure, quantity_grams, energy_kcal, protein_g, fat_g, carbs_g, fiber_g, calcium_mg, iron_mg, vitamin_a_rae_ug, vitamin_c_mg")
          .in(
            "meal_id",
            (await supabase
              .from("diet_meal_adequacy_v")
              .select("meal_id")
              .eq("plan_day_id", previewDay.id)).data?.map((meal) => meal.meal_id) ?? ["00000000-0000-0000-0000-000000000000"],
          ),
      ]);

      previewMeals = (mealRows ?? []) as PlanPreviewMeal[];
      previewItems = (itemRows ?? []) as PlanPreviewItem[];
    }
  }
  const previewMealById = new Map(previewMeals.map((meal) => [meal.meal_id, meal]));
  const businessMenuPreview = previewItems.map((item) => {
    const meal = previewMealById.get(item.meal_id);
    return {
      mealLabel: meal?.visible_name ?? meal?.meal_type_name ?? "Comida",
      mealPct: meal?.meal_target_pct ?? null,
      alimento: item.alimento,
      measure: item.saved_portion_label ?? item.household_measure ?? null,
      grams: item.quantity_grams ?? null,
      energyKcal: item.energy_kcal ?? null,
      proteinG: item.protein_g ?? null,
      fatG: item.fat_g ?? null,
      carbsG: item.carbs_g ?? null,
      fiberG: item.fiber_g ?? null,
      calciumMg: item.calcium_mg ?? null,
      ironMg: item.iron_mg ?? null,
      vitaminAUg: item.vitamin_a_rae_ug ?? null,
      vitaminCMg: item.vitamin_c_mg ?? null,
    };
  });
  const dossierChecks = [
    Boolean(lastMeasurement?.weight_kg),
    Boolean(latestAssessment),
    Boolean(latestGoal),
    Boolean(latestPlan),
    Boolean(latestIntake),
    Boolean(latestComparison),
  ];
  const dossierCompletionPct = Math.round((dossierChecks.filter(Boolean).length / dossierChecks.length) * 100);
  const exportHref = `/api/patients/${id}/excel`;
  const planPreviewSample = businessMenuPreview.slice(0, 8);
  const activeTabLabel = tabLabels[activeTab];
  const activeTabDescription = tabDescriptions[activeTab];
  const today = new Date().toISOString().split("T")[0];
  const goalFormDefaults = {
    calculationMethod: selectedGoal?.calculation_method ?? (nutritionCase ? "fao_who_unu_workbook" : ""),
    weightReferenceKg: selectedGoal?.weight_reference_kg ?? nutritionCase?.weightKg ?? "",
    estimatedBmrKcal: selectedGoal?.estimated_bmr_kcal ?? nutritionCase?.estimatedBmrKcal ?? "",
    activityFactorUsed: selectedGoal?.activity_factor_used ?? nutritionCase?.activityFactorUsed ?? "",
    targetProteinPct: selectedGoal?.target_protein_pct ?? nutritionCase?.proteinPct ?? "",
    targetCarbsPct: selectedGoal?.target_carbs_pct ?? nutritionCase?.carbsPct ?? "",
    targetFatPct: selectedGoal?.target_fat_pct ?? nutritionCase?.fatPct ?? "",
    targetProteinGPerKg: selectedGoal?.target_protein_g_per_kg ?? nutritionCase?.proteinGramsPerKg ?? "",
    targetCarbsGPerKg: selectedGoal?.target_carbs_g_per_kg ?? nutritionCase?.carbsGramsPerKg ?? "",
    targetFatGPerKg: selectedGoal?.target_fat_g_per_kg ?? nutritionCase?.fatGramsPerKg ?? "",
    targetCalciumMg: selectedGoal?.target_calcium_mg ?? nutritionCase?.calciumTargetMg ?? "",
    targetIronMg: selectedGoal?.target_iron_mg ?? nutritionCase?.ironTargetMg ?? "",
    targetVitaminAUg: selectedGoal?.target_vitamin_a_ug ?? nutritionCase?.vitaminATargetUg ?? "",
    targetVitaminCMg: selectedGoal?.target_vitamin_c_mg ?? nutritionCase?.vitaminCTargetMg ?? "",
    targetWeightKg: selectedGoal?.target_weight_kg ?? "",
    targetEnergyKcal: selectedGoal?.target_energy_kcal ?? computedGoalDefaults.energy ?? "",
    targetProteinG: selectedGoal?.target_protein_g ?? computedGoalDefaults.protein ?? "",
    targetFatG: selectedGoal?.target_fat_g ?? computedGoalDefaults.fat ?? "",
    targetCarbsG: selectedGoal?.target_carbs_g ?? computedGoalDefaults.carbs ?? "",
    targetFiberG: selectedGoal?.target_fiber_g ?? computedGoalDefaults.fiber ?? "",
    targetSodiumMg: selectedGoal?.target_sodium_mg ?? computedGoalDefaults.sodium ?? "",
    startDate: selectedGoal?.start_date ?? today,
    endDate: selectedGoal?.end_date ?? "",
    notes: selectedGoal?.notes ?? "",
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10 lg:px-10 lg:py-14">
      {/* Header */}
      <section className="panel-strong rounded-[2rem] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Ficha clinica</p>
            <h1 className="headline mt-3 text-3xl font-semibold text-slate-950 md:text-4xl">
              {patient.first_name} {patient.last_name}
            </h1>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
              <span>{patient.sex}</span>
              <span>·</span>
              <span>{patient.birth_date}</span>
              <span>·</span>
              <span>Actividad: {patient.activity_level ?? "sedentary"}</span>
              {lastMeasurement?.bmi && (
                <>
                  <span>·</span>
                  <span>IMC: {Number(lastMeasurement.bmi).toFixed(1)}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={exportHref} className={btnPrimary}>Descargar Excel</a>
            <Link href={`/patients?edit=${id}`} className={btnSecondary}>Editar ficha base</Link>
            <Link href="/patients" className={btnSecondary}>← Pacientes</Link>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-[1.5rem] bg-white/80 border border-[#0f5c4d]/15 px-5 py-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[19rem_minmax(0,1fr)] xl:items-start">
        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="panel rounded-[2rem] p-6">
            <p className="eyebrow">Guía paso a paso</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">Navegación simple para trabajar la ficha</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Cada bloque explica qué se hace ahí. La idea es que cualquier persona pueda entrar, entender y avanzar sin adivinar.
            </p>

            <nav className="mt-5 space-y-3" aria-label="Secciones de la ficha clínica">
              {tabs.map((t, index) => (
                <Link
                  key={t}
                  href={`/patients/${id}?tab=${t}`}
                  className={`block rounded-[1.4rem] border px-4 py-4 transition ${
                    activeTab === t
                      ? "border-[#0f5c4d] bg-[#0f5c4d] text-white shadow-[0_20px_60px_-32px_rgba(15,92,77,0.9)]"
                      : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        activeTab === t
                          ? "bg-white/18 text-white"
                          : "bg-[#f1f7f4] text-[#0f5c4d]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className={`text-sm font-semibold ${activeTab === t ? "text-white" : "text-slate-950"}`}>
                          {tabLabels[t]}
                        </p>
                        <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${activeTab === t ? "text-white/80" : "text-slate-400"}`}>
                          {activeTab === t ? "Abierto" : "Entrar"}
                        </span>
                      </div>
                      <p className={`mt-1 text-xs leading-5 ${activeTab === t ? "text-white/82" : "text-slate-500"}`}>
                        {tabDescriptions[t]}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </nav>
          </div>

          <div className="panel rounded-[2rem] p-6">
            <p className="eyebrow">Pantalla actual</p>
            <h3 className="mt-3 text-lg font-semibold text-slate-950">{activeTabLabel}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{activeTabDescription}</p>
            <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-200 bg-white/70 p-4 text-sm text-slate-600">
              Si alguien nunca usó una computadora, aquí debe poder entender qué toca hacer antes de pasar al siguiente bloque.
            </div>
          </div>
        </aside>

        <section className="min-w-0 space-y-6">
          <div className="panel rounded-[2rem] p-6">
            <p className="eyebrow">Sección activa</p>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">{activeTabLabel}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{activeTabDescription}</p>
              </div>
              <div className="rounded-[1.25rem] border border-[#0f5c4d]/12 bg-[#f1f7f4] px-4 py-3 text-sm text-[#0f5c4d]">
                Avance de ficha: <span className="font-semibold">{dossierCompletionPct}%</span>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
        <>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">TMB calculada</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">
              {nutritionCase ? `${nutritionCase.estimatedBmrKcal.toFixed(0)} kcal` : "Pendiente"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {nutritionCase
                ? `${nutritionCase.weightKg.toFixed(1)} kg · ${nutritionCase.ageYears} años · ${nutritionCase.activityLabel}`
                : "Falta una medición válida para cerrar el cálculo basal."}
            </p>
          </div>

          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Prescripción vigente</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">
              {latestGoal?.target_energy_kcal
                ? `${Number(latestGoal.target_energy_kcal).toFixed(0)} kcal`
                : nutritionCase
                  ? `${nutritionCase.estimatedEnergyRequirementKcal.toFixed(0)} kcal`
                  : "Sin meta"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {latestGoal
                ? `${latestGoal.goal_type.replace("_", " ")} · proteína ${latestGoal.target_protein_g ? `${Number(latestGoal.target_protein_g).toFixed(0)} g` : "sin fijar"}`
                : "Todavía no hay un objetivo activo persistido."}
            </p>
          </div>

          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Adherencia reciente</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">
              {latestComparison?.adherence_pct != null ? `${Number(latestComparison.adherence_pct).toFixed(0)}%` : "Sin cruce"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {latestComparison
                ? `${latestComparison.intake_date} · energía ${formatAdequacy(latestComparison.energy_adequacy_pct)} · proteína ${formatAdequacy(latestComparison.protein_adequacy_pct)}`
                : "Aún no hay un día comparable entre plan y consumo."}
            </p>
          </div>

          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Ficha exportable</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{dossierCompletionPct}%</p>
            <p className="mt-2 text-sm text-slate-500">
              {dossierChecks.filter(Boolean).length} de {dossierChecks.length} bloques clínicos listos para bajar en Excel.
            </p>
            <a href={exportHref} className="mt-4 inline-flex rounded-full border border-[#0f5c4d]/15 px-4 py-2 text-sm font-semibold text-[#0f5c4d] transition hover:bg-[#f1f7f4]">
              Generar ficha completa
            </a>
          </div>
        </section>

        <NutritionBusinessBoard
          patientId={id}
          latestPlanId={latestPlan?.id ?? null}
          currentCase={nutritionCase ? {
            sex: patient.sex,
            ageYears: nutritionCase.ageYears,
            weightKg: nutritionCase.weightKg,
            bmrKcal: nutritionCase.estimatedBmrKcal,
            activityLabel: nutritionCase.activityLabel,
            activityFactor: nutritionCase.activityFactorUsed,
            energyKcal: nutritionCase.estimatedEnergyRequirementKcal,
            proteinG: nutritionCase.proteinGrams,
            carbsG: nutritionCase.carbsGrams,
            fatG: nutritionCase.fatGrams,
          } : null}
          menuPreview={businessMenuPreview}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="panel rounded-[2rem] p-7">
            <p className="eyebrow">Datos del paciente</p>
            <dl className="mt-4 space-y-3 text-sm">
              {patient.document_number && <div><dt className="text-slate-500">Documento</dt><dd className="font-medium">{patient.document_number}</dd></div>}
              {patient.phone && <div><dt className="text-slate-500">Telefono</dt><dd className="font-medium">{patient.phone}</dd></div>}
              {patient.email && <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{patient.email}</dd></div>}
              {patient.occupation && <div><dt className="text-slate-500">Ocupacion</dt><dd className="font-medium">{patient.occupation}</dd></div>}
              {patient.allergies && <div><dt className="text-slate-500">Alergias</dt><dd className="font-medium">{patient.allergies}</dd></div>}
              {patient.intolerances && <div><dt className="text-slate-500">Intolerancias</dt><dd className="font-medium">{patient.intolerances}</dd></div>}
              {patient.medical_notes && <div><dt className="text-slate-500">Notas medicas</dt><dd className="font-medium whitespace-pre-wrap">{patient.medical_notes}</dd></div>}
              {patient.lifestyle_notes && <div><dt className="text-slate-500">Estilo de vida</dt><dd className="font-medium whitespace-pre-wrap">{patient.lifestyle_notes}</dd></div>}
              <div><dt className="text-slate-500">Condicion fisiologica actual</dt><dd className="font-medium">{physiologicalConditionLabel(latestAssessment?.physiological_condition)}</dd></div>
            </dl>
          </div>

          <div className="space-y-6">
            <div className="panel rounded-[2rem] p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Control del caso</p>
                  <p className="mt-2 text-sm text-slate-500">Resumen operativo del estado real de la ficha, con fecha, valor y acceso directo.</p>
                </div>
                <Link href={`/patients/${id}?tab=reports`} className="text-sm font-semibold text-[#0f5c4d] hover:underline">
                  Abrir cierre clínico →
                </Link>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-[1.25rem] border border-slate-200 bg-white/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-950">Antropometría base</p>
                    <Link href={`/patients/${id}?tab=measurements`} className="text-xs font-semibold text-[#0f5c4d] hover:underline">ver</Link>
                  </div>
                  <p className="mt-2 text-slate-600">
                    {lastMeasurement
                      ? `${lastMeasurement.measured_at} · ${lastMeasurement.weight_kg ? `${Number(lastMeasurement.weight_kg).toFixed(1)} kg` : "sin peso"}${lastMeasurement.height_m ? ` · ${Number(lastMeasurement.height_m).toFixed(2)} m` : ""}${lastMeasurement.bmi ? ` · IMC ${Number(lastMeasurement.bmi).toFixed(1)}` : ""}`
                      : "Sin registro antropométrico todavía."}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-white/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-950">Evaluación alimentaria</p>
                    <Link href={`/patients/${id}?tab=assessments`} className="text-xs font-semibold text-[#0f5c4d] hover:underline">ver</Link>
                  </div>
                  <p className="mt-2 text-slate-600">
                    {latestAssessment
                      ? `${latestAssessment.assessed_at} · apetito ${latestAssessment.appetite_level ?? "sin clasificar"} · hidratación ${latestAssessment.hydration_ml ? `${Number(latestAssessment.hydration_ml).toFixed(0)} ml` : "sin dato"}`
                      : "Todavía no existe evaluación dietaria registrada."}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-white/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-950">Prescripción y menú</p>
                    <Link href={latestPlan ? `/plans/${latestPlan.id}` : `/patients/${id}?tab=plans`} className="text-xs font-semibold text-[#0f5c4d] hover:underline">ver</Link>
                  </div>
                  <p className="mt-2 text-slate-600">
                    {latestPlan
                      ? `${latestPlan.name} · ${latestPlan.status} · ${planPreviewSample.length} ítem(s) visibles en la vista actual del menú.`
                      : "Aún no hay un plan construido para este caso."}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-white/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-950">Consumo y contraste</p>
                    <Link href={latestIntake ? `/intake/${latestIntake.id}` : `/patients/${id}?tab=intake`} className="text-xs font-semibold text-[#0f5c4d] hover:underline">ver</Link>
                  </div>
                  <p className="mt-2 text-slate-600">
                    {latestIntake
                      ? `${latestIntake.intake_date} · energía ${formatAdequacy(latestAdequacy?.energy_adequacy_pct)} · adherencia ${formatAdequacy(latestComparison?.adherence_pct)}`
                      : "Todavía no hay consumo observado para contrastar la prescripción."}
                  </p>
                </div>
              </div>
            </div>

            <div className="panel rounded-[2rem] p-7">
              <p className="eyebrow">Caso nutricional calculado</p>
              {nutritionCase ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
                    <div className="rounded-[1.2rem] bg-white/70 p-3">
                      <p className="text-xs text-slate-500">Edad</p>
                      <p className="text-base font-semibold text-slate-950">{nutritionCase.ageYears} años</p>
                    </div>
                    <div className="rounded-[1.2rem] bg-white/70 p-3">
                      <p className="text-xs text-slate-500">Peso usado</p>
                      <p className="text-base font-semibold text-slate-950">{nutritionCase.weightKg.toFixed(1)} kg</p>
                    </div>
                    <div className="rounded-[1.2rem] bg-white/70 p-3">
                      <p className="text-xs text-slate-500">Actividad</p>
                      <p className="text-base font-semibold text-slate-950">{nutritionCase.activityLabel}</p>
                      <p className="text-[11px] text-slate-400">factor {nutritionCase.activityFactorUsed.toFixed(2)}</p>
                    </div>
                    <div className="rounded-[1.2rem] bg-white/70 p-3">
                      <p className="text-xs text-slate-500">TMB</p>
                      <p className="text-base font-semibold text-slate-950">{nutritionCase.estimatedBmrKcal.toFixed(0)} kcal</p>
                    </div>
                    <div className="rounded-[1.2rem] bg-white/70 p-3">
                      <p className="text-xs text-slate-500">Requerimiento</p>
                      <p className="text-base font-semibold text-slate-950">{nutritionCase.estimatedEnergyRequirementKcal.toFixed(0)} kcal</p>
                    </div>
                    <div className="rounded-[1.2rem] bg-white/70 p-3">
                      <p className="text-xs text-slate-500">Distribución macro</p>
                      <p className="text-base font-semibold text-slate-950">10 / 60 / 30</p>
                      <p className="text-[11px] text-slate-400">P / CHO / G</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.25rem] border border-[#123f37]/10 bg-white/70 p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Proteína</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">{nutritionCase.proteinGrams.toFixed(1)} g</p>
                        <p className="text-xs text-slate-500">{nutritionCase.proteinGramsPerKg.toFixed(2)} g/kg</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Carbohidratos</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">{nutritionCase.carbsGrams.toFixed(1)} g</p>
                        <p className="text-xs text-slate-500">{nutritionCase.carbsGramsPerKg.toFixed(2)} g/kg</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Grasas</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">{nutritionCase.fatGrams.toFixed(1)} g</p>
                        <p className="text-xs text-slate-500">{nutritionCase.fatGramsPerKg.toFixed(2)} g/kg</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Distribución 20/10/30/10/30</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                      {nutritionCase.mealTargets.map((meal) => (
                        <div key={meal.code} className="rounded-[1rem] border border-slate-200 bg-white px-3 py-2">
                          <p className="text-xs text-slate-500">{mealLabel(meal.code)}</p>
                          <p className="mt-1 font-semibold text-slate-950">{meal.targetKcal.toFixed(0)} kcal</p>
                          <p className="text-[11px] text-slate-400">{(meal.pct * 100).toFixed(0)}% del día</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Registra una medición con peso para calcular TMB, actividad, energía y distribución de macros del caso.</p>
              )}
            </div>

            <div className="panel rounded-[2rem] p-7">
              <p className="eyebrow">Referencia DRI</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-white/70 px-3 py-1">Perfil: {physiologicalConditionLabel(resolvedCondition)}</span>
                {referenceLifeStageLabel && <span className="rounded-full bg-white/70 px-3 py-1">Etapa: {referenceLifeStageLabel}</span>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
                {summaryReferenceKeys
                  .filter((key) => patientReferenceTargets[key])
                  .map((key) => {
                    const ref = patientReferenceTargets[key];
                    if (!ref) return null;
                    return (
                      <div key={key} className="rounded-[1.2rem] bg-white/70 p-3">
                        <p className="text-xs text-slate-500">{ref.label}</p>
                        <p className="text-base font-semibold text-slate-950">{Number(ref.value).toFixed(ref.unit === "mg" || ref.unit === "ug" ? 0 : 1)} {ref.unit}</p>
                        <p className="text-[11px] text-slate-400">{ref.valueType}{ref.lifeStageLabel ? ` · ${ref.lifeStageLabel}` : ""}{resolvedCondition ? ` · ${physiologicalConditionLabel(resolvedCondition)}` : ""}</p>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="panel rounded-[2rem] p-7">
              <p className="eyebrow">Ultima medicion</p>
              {lastMeasurement ? (
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Fecha</p>
                    <p className="font-semibold">{lastMeasurement.measured_at}</p>
                  </div>
                  {lastMeasurement.weight_kg && (
                    <div>
                      <p className="text-slate-500">Peso</p>
                      <p className="font-semibold">{Number(lastMeasurement.weight_kg).toFixed(1)} kg</p>
                    </div>
                  )}
                  {lastMeasurement.height_m && (
                    <div>
                      <p className="text-slate-500">Talla</p>
                      <p className="font-semibold">{Number(lastMeasurement.height_m).toFixed(2)} m</p>
                    </div>
                  )}
                  {lastMeasurement.bmi && (
                    <div>
                      <p className="text-slate-500">IMC</p>
                      <p className="font-semibold">{Number(lastMeasurement.bmi).toFixed(1)}</p>
                    </div>
                  )}
                  {lastMeasurement.waist_cm && (
                    <div>
                      <p className="text-slate-500">Cintura</p>
                      <p className="font-semibold">{Number(lastMeasurement.waist_cm).toFixed(1)} cm</p>
                    </div>
                  )}
                  {lastMeasurement.weight_change_pct && (
                    <div>
                      <p className="text-slate-500">Cambio peso</p>
                      <p className="font-semibold">{Number(lastMeasurement.weight_change_pct).toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Sin mediciones registradas.</p>
              )}
            </div>

            <div className="panel rounded-[2rem] p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Señales del menú actual</p>
                  <p className="mt-2 text-sm text-slate-500">Lectura rápida de alimentos, grupos y foco de control para no perder el hilo clínico.</p>
                </div>
                <Link href={`/patients/${id}?tab=reports`} className="text-sm font-semibold text-[#0f5c4d] hover:underline">
                  Ver ficha consolidada →
                </Link>
              </div>
              {planPreviewSample.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {planPreviewSample.map((item) => (
                    <div key={`${item.mealLabel}-${item.alimento}-${item.grams ?? 0}`} className="rounded-[1.2rem] border border-slate-200 bg-white/70 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.mealLabel}</p>
                      <p className="mt-2 font-semibold text-slate-950">{item.alimento}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.measure ?? "sin porción"}{item.grams ? ` · ${Number(item.grams).toFixed(0)} g` : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                        <span>{item.energyKcal ? `${Number(item.energyKcal).toFixed(0)} kcal` : "sin kcal"}</span>
                        <span>{item.proteinG ? `P ${Number(item.proteinG).toFixed(1)} g` : "P —"}</span>
                        <span>{item.fiberG ? `Fib ${Number(item.fiberG).toFixed(1)} g` : "Fib —"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Aún no hay un menú cuantificado visible para revisar aquí.</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="panel rounded-[2rem] p-5 text-center">
                <p className="text-3xl font-semibold text-slate-950">{measurements?.length ?? 0}</p>
                <p className="mt-1 text-xs text-slate-500">Mediciones</p>
              </div>
              <div className="panel rounded-[2rem] p-5 text-center">
                <p className="text-3xl font-semibold text-slate-950">{nutritionCases?.filter((planCase) => planCase.status === "active").length ?? 0}</p>
                <p className="mt-1 text-xs text-slate-500">Casos activos</p>
              </div>
              <div className="panel rounded-[2rem] p-5 text-center">
                <p className="text-3xl font-semibold text-slate-950">{plans?.filter(p => p.status === "active").length ?? 0}</p>
                <p className="mt-1 text-xs text-slate-500">Planes activos</p>
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {activeTab === "measurements" && (
        <>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Peso actual</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{lastMeasurement?.weight_kg ? `${Number(lastMeasurement.weight_kg).toFixed(1)} kg` : "—"}</p>
            <p className="mt-2 text-sm text-slate-500">{lastMeasurement?.measured_at ?? "Sin fecha base"}</p>
          </div>
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">IMC</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{lastMeasurement?.bmi ? Number(lastMeasurement.bmi).toFixed(1) : "—"}</p>
            <p className="mt-2 text-sm text-slate-500">{lastMeasurement?.height_m ? `${Number(lastMeasurement.height_m).toFixed(2)} m de talla` : "Sin talla registrada"}</p>
          </div>
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Cintura</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{lastMeasurement?.waist_cm ? `${Number(lastMeasurement.waist_cm).toFixed(1)} cm` : "—"}</p>
            <p className="mt-2 text-sm text-slate-500">{lastMeasurement?.hip_cm ? `Cadera ${Number(lastMeasurement.hip_cm).toFixed(1)} cm` : "Sin cadera registrada"}</p>
          </div>
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Cambio de peso</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{lastMeasurement?.weight_change_pct ? `${Number(lastMeasurement.weight_change_pct).toFixed(1)}%` : "—"}</p>
            <p className="mt-2 text-sm text-slate-500">{measurements?.length ?? 0} medición(es) acumuladas</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="panel rounded-[2rem] p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{selectedMeasurement ? "Editar medicion" : "Nueva medicion"}</p>
                <p className="mt-2 text-sm text-slate-500">
                  {selectedMeasurement
                    ? "Corrige la medición seleccionada o limpia el formulario para cargar una nueva."
                    : "Registra peso, talla y perímetros para alimentar los cálculos del caso."}
                </p>
              </div>
              {selectedMeasurement ? (
                <Link href={`/patients/${id}?tab=measurements`} className="text-sm font-semibold text-[#0f5c4d] hover:underline">
                  Limpiar
                </Link>
              ) : null}
            </div>
            <form action={selectedMeasurement ? updateMeasurementAction : createMeasurementAction} className="mt-4 grid gap-4 sm:grid-cols-2">
              {selectedMeasurement ? <input type="hidden" name="id" value={selectedMeasurement.id} /> : null}
              <input type="hidden" name="patient_id" value={id} />
              <label className={labelClass}>Fecha <input name="measured_at" type="date" defaultValue={selectedMeasurement?.measured_at ?? today} className={inputClass} required /></label>
              <label className={labelClass}>Peso (kg) <input name="weight_kg" type="number" step="0.1" defaultValue={selectedMeasurement?.weight_kg ?? ""} className={inputClass} /></label>
              <label className={labelClass}>Talla (m) <input name="height_m" type="number" step="0.01" defaultValue={selectedMeasurement?.height_m ?? ""} className={inputClass} /></label>
              <label className={labelClass}>Cintura (cm) <input name="waist_cm" type="number" step="0.1" defaultValue={selectedMeasurement?.waist_cm ?? ""} className={inputClass} /></label>
              <label className={labelClass}>Cadera (cm) <input name="hip_cm" type="number" step="0.1" defaultValue={selectedMeasurement?.hip_cm ?? ""} className={inputClass} /></label>
              <label className={labelClass}>Peso habitual (kg) <input name="usual_weight_kg" type="number" step="0.1" defaultValue={selectedMeasurement?.usual_weight_kg ?? ""} className={inputClass} /></label>
              <label className="sm:col-span-2 block text-sm font-medium text-slate-700">Notas <textarea name="notes" rows={2} defaultValue={selectedMeasurement?.notes ?? ""} className={inputClass} /></label>
              <button type="submit" className={`sm:col-span-2 ${btnPrimary}`}>{selectedMeasurement ? "Guardar cambios" : "Guardar medicion"}</button>
            </form>
          </div>

          <div className="panel rounded-[2rem] p-7">
            <p className="eyebrow">Historial de mediciones</p>
            <div className="mt-4 space-y-3">
              {measurements?.length ? measurements.map((m) => (
                <div key={m.id} className="rounded-[1.4rem] border border-[#0f5c4d]/10 bg-white/80 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{m.measured_at}</span>
                    {m.bmi && <span className="text-[#0f5c4d] font-medium">IMC: {Number(m.bmi).toFixed(1)}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                    {m.weight_kg && <span>Peso: {Number(m.weight_kg).toFixed(1)} kg</span>}
                    {m.height_m && <span>Talla: {Number(m.height_m).toFixed(2)} m</span>}
                    {m.waist_cm && <span>Cintura: {Number(m.waist_cm).toFixed(1)} cm</span>}
                    {m.hip_cm && <span>Cadera: {Number(m.hip_cm).toFixed(1)} cm</span>}
                    {m.weight_change_pct && <span>Δ peso: {Number(m.weight_change_pct).toFixed(1)}%</span>}
                  </div>
                  {m.notes && <p className="mt-2 text-xs text-slate-500">{m.notes}</p>}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                    <Link href={`/patients/${id}?tab=measurements&editMeasurement=${m.id}`} className="text-[#0f5c4d] hover:underline">
                      Editar
                    </Link>
                    <form action={deleteMeasurementAction}>
                      <input type="hidden" name="patient_id" value={id} />
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" className="text-red-700 hover:underline">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-500">Sin mediciones aun.</p>}
            </div>
          </div>
        </div>
        </>
      )}

      {activeTab === "assessments" && (
        <>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Apetito actual</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{latestAssessment?.appetite_level ?? "—"}</p>
            <p className="mt-2 text-sm text-slate-500">{latestAssessment?.assessed_at ?? "Sin evaluación"}</p>
          </div>
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Hidratación</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{latestAssessment?.hydration_ml ? `${Number(latestAssessment.hydration_ml).toFixed(0)} ml` : "—"}</p>
            <p className="mt-2 text-sm text-slate-500">Registro del último contacto</p>
          </div>
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Condición</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{physiologicalConditionLabel(latestAssessment?.physiological_condition)}</p>
            <p className="mt-2 text-sm text-slate-500">Etapa DRI: {referenceLifeStageLabel ?? "sin resolver"}</p>
          </div>
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Barreras</p>
            <p className="mt-3 line-clamp-3 text-sm font-medium text-slate-950">{latestAssessment?.adherence_barriers ?? "Sin barreras registradas"}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="panel rounded-[2rem] p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{selectedAssessment ? "Editar evaluacion" : "Nueva evaluacion alimentaria"}</p>
                <p className="mt-2 text-sm text-slate-500">
                  {selectedAssessment
                    ? "Ajusta la evaluación seleccionada o limpia el modo edición para registrar otra nueva."
                    : "Registra apetito, hidratación y contexto alimentario del paciente."}
                </p>
              </div>
              {selectedAssessment ? (
                <Link href={`/patients/${id}?tab=assessments`} className="text-sm font-semibold text-[#0f5c4d] hover:underline">
                  Limpiar
                </Link>
              ) : null}
            </div>
            <form action={selectedAssessment ? updateAssessmentAction : createAssessmentAction} className="mt-4 grid gap-4">
              {selectedAssessment ? <input type="hidden" name="id" value={selectedAssessment.id} /> : null}
              <input type="hidden" name="patient_id" value={id} />
              <label className={labelClass}>Fecha <input name="assessed_at" type="date" defaultValue={selectedAssessment?.assessed_at ?? today} className={inputClass} required /></label>
              <label className={labelClass}>Nivel de apetito
                <select name="appetite_level" className={inputClass} defaultValue={selectedAssessment?.appetite_level ?? ""}>
                  <option value="">-- Seleccionar --</option>
                  <option value="bajo">Bajo</option>
                  <option value="normal">Normal</option>
                  <option value="aumentado">Aumentado</option>
                </select>
              </label>
              <label className={labelClass}>Condicion fisiologica
                <select name="physiological_condition" className={inputClass} defaultValue={selectedAssessment?.physiological_condition ?? ""}>
                  <option value="">General</option>
                  <option value="pregnancy">Embarazo</option>
                  <option value="lactation">Lactancia</option>
                </select>
              </label>
              <label className={labelClass}>Hidratacion (ml/dia) <input name="hydration_ml" type="number" step="100" defaultValue={selectedAssessment?.hydration_ml ?? ""} className={inputClass} /></label>
              <label className={labelClass}>Recordatorio 24h <textarea name="recall_24h" rows={4} defaultValue={selectedAssessment?.recall_24h ?? ""} className={inputClass} placeholder="Desayuno: ... Almuerzo: ... Cena: ..." /></label>
              <label className={labelClass}>Frecuencia alimentaria <textarea name="food_frequency_notes" rows={3} defaultValue={selectedAssessment?.food_frequency_notes ?? ""} className={inputClass} /></label>
              <label className={labelClass}>Comida fuera del hogar <textarea name="eating_out_notes" rows={2} defaultValue={selectedAssessment?.eating_out_notes ?? ""} className={inputClass} /></label>
              <label className={labelClass}>Barreras de adherencia <textarea name="adherence_barriers" rows={2} defaultValue={selectedAssessment?.adherence_barriers ?? ""} className={inputClass} /></label>
              <label className={labelClass}>Notas clinicas <textarea name="clinical_notes" rows={3} defaultValue={selectedAssessment?.clinical_notes ?? ""} className={inputClass} /></label>
              <button type="submit" className={btnPrimary}>{selectedAssessment ? "Guardar cambios" : "Guardar evaluacion"}</button>
            </form>
          </div>

          <div className="panel rounded-[2rem] p-7">
            <p className="eyebrow">Historial de evaluaciones</p>
            <div className="mt-4 space-y-3">
              {assessments?.length ? assessments.map((a) => (
                <div key={a.id} className="rounded-[1.4rem] border border-[#0f5c4d]/10 bg-white/80 p-4">
                  <p className="font-semibold text-sm">{a.assessed_at}</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-600">
                    {a.appetite_level && <p>Apetito: {a.appetite_level}</p>}
                    <p>Condicion fisiologica: {physiologicalConditionLabel(a.physiological_condition)}</p>
                    {a.hydration_ml && <p>Hidratacion: {Number(a.hydration_ml).toFixed(0)} ml</p>}
                    {a.recall_24h && <p className="whitespace-pre-wrap">Rec. 24h: {a.recall_24h}</p>}
                    {a.adherence_barriers && <p>Barreras: {a.adherence_barriers}</p>}
                    {a.clinical_notes && <p>Notas: {a.clinical_notes}</p>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                    <Link href={`/patients/${id}?tab=assessments&editAssessment=${a.id}`} className="text-[#0f5c4d] hover:underline">
                      Editar
                    </Link>
                    <form action={deleteAssessmentAction}>
                      <input type="hidden" name="patient_id" value={id} />
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="text-red-700 hover:underline">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-500">Sin evaluaciones aun.</p>}
            </div>
          </div>
        </div>
        </>
      )}

      {activeTab === "goals" && (
        <>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Meta energética</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{latestGoal?.target_energy_kcal ? `${Number(latestGoal.target_energy_kcal).toFixed(0)} kcal` : computedGoalDefaults.energy ? `${Number(computedGoalDefaults.energy).toFixed(0)} kcal` : "—"}</p>
            <p className="mt-2 text-sm text-slate-500">{latestGoal ? `${latestGoal.goal_type.replace("_", " ")} ${latestGoal.is_active ? "activo" : "guardado"}` : "Precálculo del caso automático"}</p>
          </div>
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Proteína objetivo</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{latestGoal?.target_protein_g ? `${Number(latestGoal.target_protein_g).toFixed(0)} g` : computedGoalDefaults.protein ? `${Number(computedGoalDefaults.protein).toFixed(0)} g` : "—"}</p>
            <p className="mt-2 text-sm text-slate-500">{nutritionCase?.proteinGramsPerKg ? `${nutritionCase.proteinGramsPerKg.toFixed(2)} g/kg` : "Sin base por kg"}</p>
          </div>
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Fibra y sodio</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{latestGoal?.target_fiber_g ? `${Number(latestGoal.target_fiber_g).toFixed(0)} g` : computedGoalDefaults.fiber ? `${Number(computedGoalDefaults.fiber).toFixed(0)} g` : "—"}</p>
            <p className="mt-2 text-sm text-slate-500">Sodio {latestGoal?.target_sodium_mg ? Number(latestGoal.target_sodium_mg).toFixed(0) : computedGoalDefaults.sodium ? Number(computedGoalDefaults.sodium).toFixed(0) : "—"} mg</p>
          </div>
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Base del cálculo</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{nutritionCase?.estimatedBmrKcal ? `${nutritionCase.estimatedBmrKcal.toFixed(0)} kcal` : "—"}</p>
            <p className="mt-2 text-sm text-slate-500">TMB {nutritionCase ? `× ${nutritionCase.activityFactorUsed.toFixed(2)}` : "sin factor"}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="panel rounded-[2rem] p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{selectedGoal ? "Editar objetivo nutricional" : "Nuevo objetivo nutricional"}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {selectedGoal
                    ? "Edita la meta seleccionada. El caso nutricional vinculado se resincroniza al guardar."
                    : nutritionCase
                      ? `Precargado desde TMB ${nutritionCase.estimatedBmrKcal.toFixed(0)} kcal × factor ${nutritionCase.activityFactorUsed.toFixed(2)}.`
                      : "Sin peso actual, la precarga automática del caso queda deshabilitada."}
                </p>
              </div>
              {selectedGoal ? (
                <Link href={`/patients/${id}?tab=goals`} className="text-sm font-semibold text-[#0f5c4d] hover:underline">
                  Limpiar
                </Link>
              ) : null}
            </div>
            <form action={selectedGoal ? updateGoalAction : createGoalAction} className="mt-4 grid gap-4 sm:grid-cols-2">
              {selectedGoal ? <input type="hidden" name="id" value={selectedGoal.id} /> : null}
              <input type="hidden" name="patient_id" value={id} />
              {selectedGoal ? <input type="hidden" name="is_active" value={String(selectedGoal.is_active)} /> : null}
              <input type="hidden" name="calculation_method" value={goalFormDefaults.calculationMethod} />
              <input type="hidden" name="weight_reference_kg" value={goalFormDefaults.weightReferenceKg} />
              <input type="hidden" name="estimated_bmr_kcal" value={goalFormDefaults.estimatedBmrKcal} />
              <input type="hidden" name="activity_factor_used" value={goalFormDefaults.activityFactorUsed} />
              <input type="hidden" name="target_protein_pct" value={goalFormDefaults.targetProteinPct} />
              <input type="hidden" name="target_carbs_pct" value={goalFormDefaults.targetCarbsPct} />
              <input type="hidden" name="target_fat_pct" value={goalFormDefaults.targetFatPct} />
              <input type="hidden" name="target_protein_g_per_kg" value={goalFormDefaults.targetProteinGPerKg} />
              <input type="hidden" name="target_carbs_g_per_kg" value={goalFormDefaults.targetCarbsGPerKg} />
              <input type="hidden" name="target_fat_g_per_kg" value={goalFormDefaults.targetFatGPerKg} />
              <input type="hidden" name="target_calcium_mg" value={goalFormDefaults.targetCalciumMg} />
              <input type="hidden" name="target_iron_mg" value={goalFormDefaults.targetIronMg} />
              <input type="hidden" name="target_vitamin_a_ug" value={goalFormDefaults.targetVitaminAUg} />
              <input type="hidden" name="target_vitamin_c_mg" value={goalFormDefaults.targetVitaminCMg} />
              <label className={`sm:col-span-2 ${labelClass}`}>Tipo de objetivo
                <select name="goal_type" className={inputClass} defaultValue={selectedGoal?.goal_type ?? "weight_loss"} required>
                  <option value="weight_loss">Perdida de peso</option>
                  <option value="weight_gain">Ganancia de peso</option>
                  <option value="maintenance">Mantenimiento</option>
                  <option value="muscle_gain">Ganancia muscular</option>
                  <option value="clinical">Clinico especifico</option>
                </select>
              </label>
              <label className={labelClass}>Peso meta (kg) <input name="target_weight_kg" type="number" step="0.1" defaultValue={goalFormDefaults.targetWeightKg} className={inputClass} /></label>
              <label className={labelClass}>Energia (kcal) <input name="target_energy_kcal" type="number" className={inputClass} defaultValue={goalFormDefaults.targetEnergyKcal} /></label>
              <label className={labelClass}>Proteina (g) <input name="target_protein_g" type="number" className={inputClass} defaultValue={goalFormDefaults.targetProteinG} /></label>
              <label className={labelClass}>Grasa (g) <input name="target_fat_g" type="number" className={inputClass} defaultValue={goalFormDefaults.targetFatG} /></label>
              <label className={labelClass}>Carbohidratos (g) <input name="target_carbs_g" type="number" className={inputClass} defaultValue={goalFormDefaults.targetCarbsG} /></label>
              <label className={labelClass}>Fibra (g) <input name="target_fiber_g" type="number" className={inputClass} defaultValue={goalFormDefaults.targetFiberG} /></label>
              <label className={labelClass}>Sodio (mg) <input name="target_sodium_mg" type="number" className={inputClass} defaultValue={goalFormDefaults.targetSodiumMg} /></label>
              <label className={labelClass}>Fecha inicio <input name="start_date" type="date" defaultValue={goalFormDefaults.startDate} className={inputClass} required /></label>
              <label className={labelClass}>Fecha fin <input name="end_date" type="date" defaultValue={goalFormDefaults.endDate} className={inputClass} /></label>
              <label className="sm:col-span-2 block text-sm font-medium text-slate-700">Notas <textarea name="notes" rows={2} defaultValue={goalFormDefaults.notes} className={inputClass} /></label>
              <button type="submit" className={`sm:col-span-2 ${btnPrimary}`}>{selectedGoal ? "Guardar cambios" : "Crear objetivo"}</button>
            </form>
          </div>

          <div className="panel rounded-[2rem] p-7">
            <p className="eyebrow">Objetivos del paciente</p>
            <div className="mt-4 space-y-3">
              {goals?.length ? goals.map((g) => {
                const linkedCase = g.nutrition_plan_id ? nutritionCaseById.get(g.nutrition_plan_id) : null;
                return (
                <div key={g.id} className={`rounded-[1.4rem] border p-4 ${g.is_active ? "border-[#0f5c4d]/20 bg-[#f1f7f4]" : "border-slate-200 bg-white/60"}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm capitalize">{g.goal_type.replace("_", " ")}</p>
                      <p className="text-xs text-slate-500 mt-1">Desde {g.start_date}{g.end_date ? ` hasta ${g.end_date}` : ""}</p>
                      {linkedCase && <p className="mt-1 text-[11px] text-slate-500">Caso formal: {linkedCase.label}</p>}
                    </div>
                    <form action={toggleGoalAction}>
                      <input type="hidden" name="goal_id" value={g.id} />
                      <input type="hidden" name="patient_id" value={id} />
                      <input type="hidden" name="is_active" value={String(g.is_active)} />
                      <button type="submit" className={`rounded-full px-3 py-1 text-xs font-semibold ${g.is_active ? "bg-[#d6ebe3] text-[#0f5c4d]" : "bg-slate-200 text-slate-600"}`}>
                        {g.is_active ? "Activo" : "Inactivo"}
                      </button>
                    </form>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                    {g.target_energy_kcal && <span>{Number(g.target_energy_kcal).toFixed(0)} kcal</span>}
                    {g.target_protein_g && <span>P: {Number(g.target_protein_g).toFixed(0)}g</span>}
                    {g.target_fat_g && <span>G: {Number(g.target_fat_g).toFixed(0)}g</span>}
                    {g.target_carbs_g && <span>C: {Number(g.target_carbs_g).toFixed(0)}g</span>}
                    {g.target_fiber_g && <span>Fib: {Number(g.target_fiber_g).toFixed(0)}g</span>}
                    {g.target_weight_kg && <span>Meta: {Number(g.target_weight_kg).toFixed(1)} kg</span>}
                    {g.activity_factor_used && <span>Factor: {Number(g.activity_factor_used).toFixed(2)}</span>}
                    {g.estimated_bmr_kcal && <span>TMB: {Number(g.estimated_bmr_kcal).toFixed(0)} kcal</span>}
                    {linkedCase?.protein_target_g && <span>P formal: {Number(linkedCase.protein_target_g).toFixed(0)}g</span>}
                    {linkedCase?.carbs_target_g && <span>C formal: {Number(linkedCase.carbs_target_g).toFixed(0)}g</span>}
                    {linkedCase?.fat_target_g && <span>G formal: {Number(linkedCase.fat_target_g).toFixed(0)}g</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                    <Link href={`/patients/${id}?tab=goals&editGoal=${g.id}`} className="text-[#0f5c4d] hover:underline">
                      Editar
                    </Link>
                    <form action={deleteGoalAction}>
                      <input type="hidden" name="patient_id" value={id} />
                      <input type="hidden" name="id" value={g.id} />
                      <button type="submit" className="text-red-700 hover:underline">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </div>
                );
              }) : <p className="text-sm text-slate-500">Sin objetivos definidos.</p>}
            </div>
          </div>
        </div>
        </>
      )}

      {activeTab === "plans" && (
        <>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Plan activo</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{latestPlan?.name ?? "Sin plan"}</p>
            <p className="mt-2 text-sm text-slate-500">{latestPlan?.status ?? "No existe un plan activo"}</p>
          </div>
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Meta del menú</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{latestPlan?.daily_energy_target_kcal ? `${Number(latestPlan.daily_energy_target_kcal).toFixed(0)} kcal` : nutritionCase ? `${nutritionCase.estimatedEnergyRequirementKcal.toFixed(0)} kcal` : "—"}</p>
            <p className="mt-2 text-sm text-slate-500">{planPreviewSample.length} ítem(s) visibles en el menú actual</p>
          </div>
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Estructura</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{previewMeals.length}</p>
            <p className="mt-2 text-sm text-slate-500">comidas cuantificadas en la vista previa</p>
          </div>
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Cruce con consumo</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{latestComparison?.adherence_pct != null ? `${Number(latestComparison.adherence_pct).toFixed(0)}%` : "—"}</p>
            <p className="mt-2 text-sm text-slate-500">adherencia del último día comparable</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="panel rounded-[2rem] p-7">
            <p className="eyebrow">Nuevo plan alimentario</p>
            <p className="mt-2 text-xs text-slate-500">Las metas se precargan con el caso nutricional calculado y se completan con DRI para fibra y sodio: {physiologicalConditionLabel(resolvedCondition)}{referenceLifeStageLabel ? ` · ${referenceLifeStageLabel}` : ""}.</p>
            <form action={createDietPlanAction} className="mt-4 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="patient_id" value={id} />
              <label className={`sm:col-span-2 ${labelClass}`}>Nombre del plan <input name="name" className={inputClass} placeholder="Plan semana 1" required /></label>
              <label className={labelClass}>Tipo de objetivo
                <select name="objective_type" className={inputClass} required>
                  <option value="weight_loss">Perdida de peso</option>
                  <option value="weight_gain">Ganancia de peso</option>
                  <option value="maintenance">Mantenimiento</option>
                  <option value="muscle_gain">Ganancia muscular</option>
                  <option value="clinical">Clinico</option>
                </select>
              </label>
              <label className={labelClass}>Tipo de dieta <input name="diet_type" className={inputClass} placeholder="Ej: Hipocalórica, DASH, etc." /></label>
              <label className={labelClass}>Fecha inicio <input name="start_date" type="date" defaultValue={today} className={inputClass} required /></label>
              <label className={labelClass}>Fecha fin <input name="end_date" type="date" className={inputClass} /></label>
              <label className={labelClass}>Energia (kcal/dia) <input name="daily_energy_target_kcal" type="number" className={inputClass} defaultValue={nutritionCase?.estimatedEnergyRequirementKcal ?? undefined} placeholder={nutritionCase ? `Caso ${Number(nutritionCase.estimatedEnergyRequirementKcal).toFixed(0)}` : undefined} /></label>
              <label className={labelClass}>Proteina (g/dia) <input name="daily_protein_target_g" type="number" className={inputClass} defaultValue={nutritionCase?.proteinGrams ?? patientDriTargets.daily_protein_target_g ?? undefined} placeholder={nutritionCase ? `Caso ${Number(nutritionCase.proteinGrams).toFixed(0)}` : patientDriTargets.daily_protein_target_g ? `DRI ${Number(patientDriTargets.daily_protein_target_g).toFixed(0)}` : undefined} /></label>
              <label className={labelClass}>Grasa (g/dia) <input name="daily_fat_target_g" type="number" className={inputClass} defaultValue={nutritionCase?.fatGrams ?? patientDriTargets.daily_fat_target_g ?? undefined} placeholder={nutritionCase ? `Caso ${Number(nutritionCase.fatGrams).toFixed(0)}` : undefined} /></label>
              <label className={labelClass}>Carbohidratos (g/dia) <input name="daily_carbs_target_g" type="number" className={inputClass} defaultValue={nutritionCase?.carbsGrams ?? patientDriTargets.daily_carbs_target_g ?? undefined} placeholder={nutritionCase ? `Caso ${Number(nutritionCase.carbsGrams).toFixed(0)}` : patientDriTargets.daily_carbs_target_g ? `DRI ${Number(patientDriTargets.daily_carbs_target_g).toFixed(0)}` : undefined} /></label>
              <label className={labelClass}>Fibra (g/dia) <input name="daily_fiber_target_g" type="number" className={inputClass} defaultValue={nutritionCase?.fiberTargetG ?? patientDriTargets.daily_fiber_target_g ?? undefined} placeholder={patientDriTargets.daily_fiber_target_g ? `DRI ${Number(patientDriTargets.daily_fiber_target_g).toFixed(0)}` : undefined} /></label>
              <label className={labelClass}>Sodio (mg/dia) <input name="daily_sodium_target_mg" type="number" className={inputClass} defaultValue={nutritionCase?.sodiumTargetMg ?? patientDriTargets.daily_sodium_target_mg ?? undefined} placeholder={patientDriTargets.daily_sodium_target_mg ? `DRI ${Number(patientDriTargets.daily_sodium_target_mg).toFixed(0)}` : undefined} /></label>
              {goals?.filter(g => g.is_active).length ? (
                <label className={`sm:col-span-2 ${labelClass}`}>Objetivo vinculado
                  <select name="goal_id" className={inputClass}>
                    <option value="">-- Sin vincular --</option>
                    {goals.filter(g => g.is_active).map(g => (
                      <option key={g.id} value={g.id}>{g.goal_type.replace("_"," ")} - {g.target_energy_kcal ? `${Number(g.target_energy_kcal).toFixed(0)} kcal` : "sin energia"}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="sm:col-span-2 block text-sm font-medium text-slate-700">Notas <textarea name="notes" rows={2} className={inputClass} /></label>
              <button type="submit" className={`sm:col-span-2 ${btnPrimary}`}>Crear plan (7 dias)</button>
            </form>
          </div>

          <div className="panel rounded-[2rem] p-7">
            <p className="eyebrow">Planes del paciente</p>
            <div className="mt-4 space-y-3">
              {plans?.length ? plans.map((p) => {
                const linkedCase = p.nutrition_plan_id ? nutritionCaseById.get(p.nutrition_plan_id) : null;
                return (
                <div key={p.id} className="rounded-[1.4rem] border border-[#0f5c4d]/10 bg-white/80 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link href={`/plans/${p.id}`} className="font-semibold text-sm text-[#0f5c4d] hover:underline">{p.name}</Link>
                      <p className="text-xs text-slate-500 mt-1">{p.objective_type.replace("_"," ")} · {p.start_date}</p>
                      {linkedCase && <p className="mt-1 text-[11px] text-slate-500">Caso formal: {linkedCase.label}</p>}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      p.status === "active" ? "bg-[#d6ebe3] text-[#0f5c4d]" :
                      p.status === "draft" ? "bg-[#fff3db] text-[#9a5a1f]" :
                      "bg-slate-200 text-slate-600"
                    }`}>{p.status}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                    {(linkedCase?.target_energy_kcal ?? p.daily_energy_target_kcal) && <span>{Number(linkedCase?.target_energy_kcal ?? p.daily_energy_target_kcal).toFixed(0)} kcal/día</span>}
                    {(linkedCase?.protein_target_g ?? p.daily_protein_target_g) && <span>P: {Number(linkedCase?.protein_target_g ?? p.daily_protein_target_g).toFixed(0)}g</span>}
                    {(linkedCase?.fiber_target_g ?? p.daily_fiber_target_g) && <span>Fibra: {Number(linkedCase?.fiber_target_g ?? p.daily_fiber_target_g).toFixed(0)}g</span>}
                    {!linkedCase?.protein_target_g && !p.daily_protein_target_g && patientDriTargets.daily_protein_target_g && <span>DRI P: {Number(patientDriTargets.daily_protein_target_g).toFixed(0)}g</span>}
                  </div>
                  {p.status === "draft" && (
                    <form action={activatePlanAction} className="mt-2">
                      <input type="hidden" name="plan_id" value={p.id} />
                      <input type="hidden" name="patient_id" value={id} />
                      <button type="submit" className="text-xs text-[#0f5c4d] font-semibold hover:underline">Activar plan →</button>
                    </form>
                  )}
                </div>
                );
              }) : <p className="text-sm text-slate-500">Sin planes creados.</p>}
            </div>
          </div>
        </div>
        </>
      )}

      {activeTab === "intake" && (
        <>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Último consumo</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{latestIntake?.intake_date ?? "—"}</p>
            <p className="mt-2 text-sm text-slate-500">{intakeDays?.length ?? 0} día(s) registrados</p>
          </div>
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Adecuación energética</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{formatAdequacy(latestAdequacy?.energy_adequacy_pct)}</p>
            <p className="mt-2 text-sm text-slate-500">Proteína {formatAdequacy(latestAdequacy?.protein_adequacy_pct)}</p>
          </div>
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Fibra observada</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{formatAdequacy(latestAdequacy?.fiber_adequacy_pct)}</p>
            <p className="mt-2 text-sm text-slate-500">comparada con la referencia diaria</p>
          </div>
          <div className="panel rounded-[1.8rem] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Grupos del último día</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{topLatestGroups.length}</p>
            <p className="mt-2 text-sm text-slate-500">grupos alimentarios con aporte cuantificado</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="panel rounded-[2rem] p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{selectedIntakeDay ? "Editar dia de consumo" : "Nuevo dia de consumo"}</p>
                <p className="mt-2 text-sm text-slate-500">
                  {selectedIntakeDay
                    ? "Ajusta la fecha o el plan vinculado antes de entrar al detalle de comidas."
                    : "Crea el día base y luego completa comidas e ítems desde la pantalla de consumo."}
                </p>
              </div>
              {selectedIntakeDay ? (
                <Link href={`/patients/${id}?tab=intake`} className="text-sm font-semibold text-[#0f5c4d] hover:underline">
                  Limpiar
                </Link>
              ) : null}
            </div>
            <form action={selectedIntakeDay ? updateIntakeDayAction : createIntakeDayAction} className="mt-4 grid gap-4">
              {selectedIntakeDay ? <input type="hidden" name="id" value={selectedIntakeDay.id} /> : null}
              <input type="hidden" name="patient_id" value={id} />
              <label className={labelClass}>Fecha <input name="intake_date" type="date" defaultValue={selectedIntakeDay?.intake_date ?? today} className={inputClass} required /></label>
              {plans?.filter(p => p.status === "active").length ? (
                <label className={labelClass}>Plan asociado
                  <select name="plan_id" className={inputClass} defaultValue={selectedIntakeDay?.plan_id ?? ""}>
                    <option value="">-- Sin plan --</option>
                    {plans.filter(p => p.status === "active").map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button type="submit" className={btnPrimary}>{selectedIntakeDay ? "Guardar cambios" : "Crear dia de consumo"}</button>
            </form>
          </div>

          <div className="panel rounded-[2rem] p-7">
            <p className="eyebrow">Dias de consumo registrados</p>
            <div className="mt-4 space-y-3">
              {intakeDays?.length ? intakeDays.map((d) => {
                const adequacy = intakeAdequacyByDayId.get(d.id);
                return (
                <div
                  key={d.id}
                  className="rounded-[1.4rem] border border-[#0f5c4d]/10 bg-white/80 p-4 transition hover:border-[#0f5c4d]/30"
                >
                  <p className="font-semibold text-sm">{d.intake_date}</p>
                  {adequacy?.energy_adequacy_pct != null && <p className="mt-1 text-xs text-slate-500">Adecuación energía: {Number(adequacy.energy_adequacy_pct).toFixed(0)}%</p>}
                  {d.notes && <p className="mt-1 text-xs text-slate-500">{d.notes}</p>}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                    <Link href={`/intake/${d.id}`} className="text-[#0f5c4d] hover:underline">
                      Abrir detalle
                    </Link>
                    <Link href={`/patients/${id}?tab=intake&editIntake=${d.id}`} className="text-slate-600 hover:text-slate-950 hover:underline">
                      Editar
                    </Link>
                    <form action={deleteIntakeDayAction}>
                      <input type="hidden" name="patient_id" value={id} />
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="text-red-700 hover:underline">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </div>
                );
              }) : <p className="text-sm text-slate-500">Sin consumo registrado.</p>}
            </div>
          </div>
        </div>
        </>
      )}

      {activeTab === "reports" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="panel rounded-[2rem] p-7 xl:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Ficha clínica consolidada</p>
                <p className="mt-2 max-w-3xl text-sm text-slate-500">
                  Esta salida junta identidad, antropometría, evaluación, objetivo, plan, consumo, comparación y grupos alimentarios en un solo archivo Excel para revisión o entrega.
                </p>
              </div>
              <a href={exportHref} className={btnPrimary}>Descargar Excel</a>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div className="rounded-[1.2rem] border border-slate-200 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Bloques listos</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{dossierChecks.filter(Boolean).length}/{dossierChecks.length}</p>
              </div>
              <div className="rounded-[1.2rem] border border-slate-200 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Plan vs consumo</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{dailyComparisons.length}</p>
                <p className="text-sm text-slate-500">comparación(es) exportadas</p>
              </div>
              <div className="rounded-[1.2rem] border border-slate-200 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Menú actual</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{businessMenuPreview.length}</p>
                <p className="text-sm text-slate-500">ítem(s) cuantificados listos</p>
              </div>
              <div className="rounded-[1.2rem] border border-slate-200 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Grupos</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{intakeGroupSummaries.length}</p>
                <p className="text-sm text-slate-500">filas de análisis dietario</p>
              </div>
            </div>
          </div>

          <div className="panel rounded-[2rem] p-7">
            <p className="eyebrow">Evolucion de mediciones</p>
            {measurements && measurements.length > 1 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="pb-2 pr-4">Fecha</th>
                      <th className="pb-2 pr-4">Peso</th>
                      <th className="pb-2 pr-4">IMC</th>
                      <th className="pb-2 pr-4">Cintura</th>
                      <th className="pb-2">Δ Peso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurements.map((m) => (
                      <tr key={m.id} className="border-b border-slate-100">
                        <td className="py-2 pr-4 font-medium">{m.measured_at}</td>
                        <td className="py-2 pr-4">{m.weight_kg ? `${Number(m.weight_kg).toFixed(1)} kg` : "—"}</td>
                        <td className="py-2 pr-4">{m.bmi ? Number(m.bmi).toFixed(1) : "—"}</td>
                        <td className="py-2 pr-4">{m.waist_cm ? `${Number(m.waist_cm).toFixed(1)} cm` : "—"}</td>
                        <td className="py-2">{m.weight_change_pct ? `${Number(m.weight_change_pct).toFixed(1)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="mt-4 text-sm text-slate-500">Se necesitan al menos 2 mediciones para ver la evolucion.</p>}
          </div>

          <div className="panel rounded-[2rem] p-7">
            <p className="eyebrow">Resumen de planes</p>
            {plans?.length ? (
              <div className="mt-4 space-y-3">
                {plans.map((p) => (
                  (() => {
                    const linkedCase = p.nutrition_plan_id ? nutritionCaseById.get(p.nutrition_plan_id) : null;
                    return (
                  <div key={p.id} className="rounded-[1.4rem] border border-slate-200 bg-white/60 p-4">
                    <div className="flex justify-between">
                      <p className="font-semibold text-sm">{p.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === "active" ? "bg-[#d6ebe3] text-[#0f5c4d]" : "bg-slate-100 text-slate-500"
                      }`}>{p.status}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                      <span>{p.start_date} → {p.end_date ?? "sin fin"}</span>
                      {(linkedCase?.target_energy_kcal ?? p.daily_energy_target_kcal) && <span>{Number(linkedCase?.target_energy_kcal ?? p.daily_energy_target_kcal).toFixed(0)} kcal/día</span>}
                      {linkedCase?.label && <span>{linkedCase.label}</span>}
                      {!linkedCase?.target_energy_kcal && !p.daily_energy_target_kcal && patientDriTargets.daily_energy_target_kcal && <span>Ref. DRI {Number(patientDriTargets.daily_energy_target_kcal).toFixed(0)} kcal/día</span>}
                    </div>
                  </div>
                    );
                  })()
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-slate-500">Sin planes para reportar.</p>}
          </div>

          <div className="panel rounded-[2rem] p-7 xl:col-span-2">
            <p className="eyebrow">Comparación plan vs consumo</p>
            {dailyComparisons.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="pb-2 pr-4">Fecha</th>
                      <th className="pb-2 pr-4">Plan kcal</th>
                      <th className="pb-2 pr-4">Consumo kcal</th>
                      <th className="pb-2 pr-4">Adeq. energía</th>
                      <th className="pb-2 pr-4">Adeq. proteína</th>
                      <th className="pb-2 pr-4">Adeq. fibra</th>
                      <th className="pb-2">Adherencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyComparisons.map((row) => (
                      <tr key={`${row.intake_date}-${row.plan_id ?? "sin-plan"}`} className="border-b border-slate-100">
                        <td className="py-2 pr-4 font-medium">{row.intake_date}</td>
                        <td className="py-2 pr-4">{row.planned_energy_kcal ? `${Number(row.planned_energy_kcal).toFixed(0)} kcal` : "—"}</td>
                        <td className="py-2 pr-4">{row.actual_energy_kcal ? `${Number(row.actual_energy_kcal).toFixed(0)} kcal` : "—"}</td>
                        <td className="py-2 pr-4">{formatAdequacy(row.energy_adequacy_pct)}</td>
                        <td className="py-2 pr-4">{formatAdequacy(row.protein_adequacy_pct)}</td>
                        <td className="py-2 pr-4">{formatAdequacy(row.fiber_adequacy_pct)}</td>
                        <td className="py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            (row.adherence_pct ?? 0) >= 90
                              ? "bg-[#d6ebe3] text-[#0f5c4d]"
                              : (row.adherence_pct ?? 0) >= 70
                                ? "bg-[#fff3db] text-[#9a5a1f]"
                                : "bg-slate-200 text-slate-600"
                          }`}>
                            {formatAdequacy(row.adherence_pct)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="mt-4 text-sm text-slate-500">Aún no hay suficientes días con plan y consumo para contrastar adherencia.</p>}
          </div>

          <div className="panel rounded-[2rem] p-7">
            <p className="eyebrow">Consumo por grupos alimentarios</p>
            {topLatestGroups.length ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-500">Último día analizado: {latestIntakeDate}</p>
                {topLatestGroups.map((group) => (
                  <div key={`${group.intake_date}-${group.grupo_numero ?? group.grupo_nombre}`} className="rounded-[1.4rem] border border-slate-200 bg-white/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-slate-950">{group.grupo_nombre ?? `Grupo ${group.grupo_numero ?? "—"}`}</p>
                        <p className="mt-1 text-xs text-slate-500">{Number(group.item_count ?? 0).toFixed(0)} ítem(s) · {Number(group.grams_total ?? 0).toFixed(0)} g</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {Number(group.energy_kcal ?? 0).toFixed(0)} kcal
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                      <span>Proteína {Number(group.protein_g ?? 0).toFixed(1)} g</span>
                      <span>Fibra {Number(group.fiber_g ?? 0).toFixed(1)} g</span>
                      <span>Sodio {Number(group.sodium_mg ?? 0).toFixed(0)} mg</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-slate-500">Sin desglose por grupos todavía.</p>}
          </div>

          <div className="panel rounded-[2rem] p-7">
            <p className="eyebrow">Contexto alimentario cualitativo</p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {latestAssessmentRecall ? (
                <div className="rounded-[1.4rem] border border-slate-200 bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Recordatorio 24h</p>
                  <p className="mt-2 whitespace-pre-wrap">{latestAssessmentRecall}</p>
                </div>
              ) : null}
              {latestAssessmentFrequency ? (
                <div className="rounded-[1.4rem] border border-slate-200 bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Frecuencia alimentaria</p>
                  <p className="mt-2 whitespace-pre-wrap">{latestAssessmentFrequency}</p>
                </div>
              ) : null}
              {latestAssessmentEatingOut ? (
                <div className="rounded-[1.4rem] border border-slate-200 bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Comida fuera del hogar</p>
                  <p className="mt-2 whitespace-pre-wrap">{latestAssessmentEatingOut}</p>
                </div>
              ) : null}
              {latestAssessmentBarriers ? (
                <div className="rounded-[1.4rem] border border-slate-200 bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Barreras de adherencia</p>
                  <p className="mt-2 whitespace-pre-wrap">{latestAssessmentBarriers}</p>
                </div>
              ) : null}
              {!latestAssessmentRecall && !latestAssessmentFrequency && !latestAssessmentEatingOut && !latestAssessmentBarriers ? (
                <p className="text-sm text-slate-500">Falta registrar una evaluación alimentaria detallada para cerrar el contexto cualitativo.</p>
              ) : null}
            </div>
          </div>
        </div>
      )}
        </section>
      </div>
    </main>
  );
}
