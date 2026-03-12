import { redirect } from "next/navigation";
import Link from "next/link";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  addMealToDayAction,
  addMealItemAction,
  activatePlanAction,
  deletePlanMealItemAction,
  updatePlanMealItemAction,
  updatePlanMealPresentationAction,
} from "@/lib/actions/plans";
import type { ClinicalActionStep } from "@/components/clinical-action-navigator";
import { CalculationSheet } from "@/components/calculation-sheet";
import { FormModalShell } from "@/components/form-modal-shell";
import { FoodSearchSelect } from "@/components/food-search-select";
import { getDriConditionLabel } from "@/lib/dri/condition.js";
import { getPatientDriContext } from "@/lib/dri/server";
import { toDailyTargetsFromNutritionPlanCase } from "@/lib/workbook/server";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type MealType = {
  id: number;
  code: string;
  name: string;
  sort_order: number;
};

type NutritionPlanCase = {
  nutrition_plan_id: string;
  label: string;
  calculation_method?: string | null;
  estimated_bmr_kcal?: number | null;
  activity_factor_used?: number | null;
  target_energy_kcal?: number | null;
  protein_target_g?: number | null;
  fat_target_g?: number | null;
  carbs_target_g?: number | null;
  fiber_target_g?: number | null;
  sodium_target_mg?: number | null;
};

type DayAdequacy = {
  plan_day_id: string;
  day_number: number;
  actual_energy_kcal?: number | null;
  actual_protein_g?: number | null;
  actual_fat_g?: number | null;
  actual_carbs_g?: number | null;
  actual_fiber_g?: number | null;
  target_energy_kcal?: number | null;
  protein_target_g?: number | null;
  fat_target_g?: number | null;
  carbs_target_g?: number | null;
  fiber_target_g?: number | null;
  energy_adequacy_pct?: number | null;
  protein_adequacy_pct?: number | null;
  fat_adequacy_pct?: number | null;
  carbs_adequacy_pct?: number | null;
  fiber_adequacy_pct?: number | null;
};

type MealAdequacy = {
  meal_id: string;
  plan_day_id: string;
  meal_type_code: string;
  meal_type_name: string;
  visible_name?: string | null;
  menu_text?: string | null;
  meal_target_pct?: number | null;
  meal_target_kcal?: number | null;
  meal_actual_kcal?: number | null;
  meal_deviation_kcal?: number | null;
  meal_deviation_pct?: number | null;
  energy_adequacy_pct?: number | null;
  protein_adequacy_pct?: number | null;
  fat_adequacy_pct?: number | null;
  carbs_adequacy_pct?: number | null;
  fiber_adequacy_pct?: number | null;
  actual_protein_g?: number | null;
  actual_fat_g?: number | null;
  actual_carbs_g?: number | null;
  actual_fiber_g?: number | null;
};

type MealItem = {
  id: string;
  meal_id: string;
  alimento_id: number;
  alimento: string;
  grupo_numero?: number | null;
  grupo_nombre?: string | null;
  food_portion_id?: number | null;
  portion_multiplier?: number | null;
  saved_portion_label?: string | null;
  household_measure?: string | null;
  household_quantity?: number | null;
  quantity_grams?: number | null;
  energy_kcal?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carbs_g?: number | null;
  fiber_g?: number | null;
};

function msg(v?: string | string[]) {
  return Array.isArray(v) ? v[0] : v;
}

const inputClass = "mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#0f5c4d] focus:outline-none";
const btnPrimary = "rounded-full bg-[#0f5c4d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a4a3d]";

const planTargets = (plan: {
  daily_energy_target_kcal?: number | null;
  daily_protein_target_g?: number | null;
  daily_fat_target_g?: number | null;
  daily_carbs_target_g?: number | null;
  daily_fiber_target_g?: number | null;
  daily_sodium_target_mg?: number | null;
}) => ({
  daily_energy_target_kcal: plan.daily_energy_target_kcal,
  daily_protein_target_g: plan.daily_protein_target_g,
  daily_fat_target_g: plan.daily_fat_target_g,
  daily_carbs_target_g: plan.daily_carbs_target_g,
  daily_fiber_target_g: plan.daily_fiber_target_g,
  daily_sodium_target_mg: plan.daily_sodium_target_mg,
});

function percentOf(actual: number, target?: number | null) {
  if (!target || target <= 0) return null;
  return (actual / target) * 100;
}

function formatDeviation(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(0)} kcal`;
}

function formatAdequacy(value?: number | null) {
  if (value == null) return "—";
  return `${Number(value).toFixed(0)}%`;
}

function formatStepValue(value?: number | null, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value).toFixed(digits);
}

function targetSourceLabel(planCase: NutritionPlanCase | null, rawValue?: number | null) {
  if (planCase) return "caso";
  if (rawValue != null) return "plan";
  return "DRI";
}

function buildPlanHref(
  planId: string,
  day?: string | number | null,
  extra?: Record<string, string | number | null | undefined>,
) {
  const search = new URLSearchParams();

  if (day != null && String(day) !== "") search.set("day", String(day));
  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value == null || value === "") return;
    search.set(key, String(value));
  });

  const query = search.toString();
  return query ? `/plans/${planId}?${query}` : `/plans/${planId}`;
}

const workflowStatusClass = {
  ready: {
    card: "border-[#0f5c4d]/18 bg-[#eef7f3]",
    badge: "bg-[#d6ebe3] text-[#0f5c4d]",
    label: "Resuelto",
  },
  partial: {
    card: "border-[#9a5a1f]/18 bg-[#fff8ea]",
    badge: "bg-[#fff1cd] text-[#9a5a1f]",
    label: "Parcial",
  },
  pending: {
    card: "border-slate-200 bg-white/75",
    badge: "bg-slate-200 text-slate-600",
    label: "Pendiente",
  },
} as const;

const guidedStatusClass = {
  done: {
    card: "border-[#0f5c4d]/18 bg-[#eef7f3]",
    badge: "bg-[#d6ebe3] text-[#0f5c4d]",
    action: "border-[#0f5c4d]/16 bg-white text-[#0f5c4d] hover:bg-[#f1f7f4]",
    label: "Hecho",
  },
  next: {
    card: "border-[#9a5a1f]/18 bg-[#fff8ea]",
    badge: "bg-[#fff1cd] text-[#9a5a1f]",
    action: "bg-[#0f5c4d] text-white hover:bg-[#0a4a3d] border-[#0f5c4d]",
    label: "Siguiente",
  },
  pending: {
    card: "border-slate-200 bg-white/75",
    badge: "bg-slate-200 text-slate-600",
    action: "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
    label: "Pendiente",
  },
} as const;

export default async function PlanDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const message = msg(sp.message);
  const selectedDay = msg(sp.day) ?? "1";
  const modal = msg(sp.modal) ?? "";
  const editMealId = msg(sp.editMeal) ?? null;
  const addItemMealId = msg(sp.addItemMeal) ?? null;
  const editItemId = msg(sp.editItem) ?? null;

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: plan } = await supabase
    .from("diet_plans")
    .select("*, patients(id, first_name, last_name)")
    .eq("id", id)
    .single();

  if (!plan) redirect("/dashboard?message=" + encodeURIComponent("Plan no encontrado."));

  const patientName = plan.patients
    ? `${(plan.patients as { first_name: string; last_name: string }).first_name} ${(plan.patients as { first_name: string; last_name: string }).last_name}`
    : "Paciente";

  const [
    { data: nutritionPlanCase },
    { data: days },
    { data: mealTypes },
    { data: dayAdequacyRows },
    { data: linkedIntakeDays },
  ] = await Promise.all([
    plan.nutrition_plan_id
      ? supabase.from("nutrition_plan_case_v").select("*").eq("nutrition_plan_id", plan.nutrition_plan_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("diet_plan_days")
      .select("id, day_number, label")
      .eq("plan_id", id)
      .order("day_number"),
    supabase.from("meal_types").select("*").order("sort_order"),
    supabase.from("diet_plan_day_adequacy_v").select("*").eq("plan_id", id),
    supabase.from("intake_days").select("id, intake_date").eq("plan_id", id).order("intake_date", { ascending: false }).limit(10),
  ]);

  const currentDay = days?.find((day) => String(day.day_number) === selectedDay) ?? days?.[0];

  const mealTypeRows = (mealTypes ?? []) as MealType[];
  const mealTypeOrder = new Map(mealTypeRows.map((mealType) => [mealType.code, mealType.sort_order]));
  const dayAdequacyList = (dayAdequacyRows ?? []) as DayAdequacy[];
  const dayAdequacyByDayId = new Map(dayAdequacyList.map((row) => [row.plan_day_id, row]));

  let meals: MealAdequacy[] = [];
  let mealItems: MealItem[] = [];

  if (currentDay) {
    const { data: mealRows } = await supabase
      .from("diet_meal_adequacy_v")
      .select("*")
      .eq("plan_day_id", currentDay.id);

    meals = ((mealRows ?? []) as MealAdequacy[]).sort(
      (left, right) => (mealTypeOrder.get(left.meal_type_code) ?? 999) - (mealTypeOrder.get(right.meal_type_code) ?? 999),
    );

    if (meals.length) {
      const { data: itemRows } = await supabase
        .from("diet_meal_item_nutrients_v")
        .select("*")
        .in("meal_id", meals.map((meal) => meal.meal_id));

      mealItems = (itemRows ?? []) as MealItem[];
    }
  }

  const mealItemsMap: Record<string, MealItem[]> = {};
  for (const item of mealItems) {
    if (!mealItemsMap[item.meal_id]) mealItemsMap[item.meal_id] = [];
    mealItemsMap[item.meal_id].push(item);
  }

  const baseDailyTargets = nutritionPlanCase
    ? toDailyTargetsFromNutritionPlanCase(nutritionPlanCase as NutritionPlanCase)
    : planTargets(plan);

  const {
    effectiveDailyTargets,
    referenceTargets: effectiveReferenceTargets,
    resolvedCondition,
    referenceLifeStageLabel,
  } = await getPatientDriContext(supabase, plan.patient_id, baseDailyTargets);

  const currentDayAdequacy = currentDay ? dayAdequacyByDayId.get(currentDay.id) ?? null : null;
  const fallbackItems = currentDay ? (meals.flatMap((meal) => mealItemsMap[meal.meal_id] ?? [])) : [];
  const latestLinkedIntake = linkedIntakeDays?.[0] ?? null;
  const dayTotals = {
    energy: currentDayAdequacy?.actual_energy_kcal != null
      ? Number(currentDayAdequacy.actual_energy_kcal)
      : fallbackItems.reduce((sum, item) => sum + Number(item.energy_kcal ?? 0), 0),
    protein: currentDayAdequacy?.actual_protein_g != null
      ? Number(currentDayAdequacy.actual_protein_g)
      : fallbackItems.reduce((sum, item) => sum + Number(item.protein_g ?? 0), 0),
    fat: currentDayAdequacy?.actual_fat_g != null
      ? Number(currentDayAdequacy.actual_fat_g)
      : fallbackItems.reduce((sum, item) => sum + Number(item.fat_g ?? 0), 0),
    carbs: currentDayAdequacy?.actual_carbs_g != null
      ? Number(currentDayAdequacy.actual_carbs_g)
      : fallbackItems.reduce((sum, item) => sum + Number(item.carbs_g ?? 0), 0),
    fiber: currentDayAdequacy?.actual_fiber_g != null
      ? Number(currentDayAdequacy.actual_fiber_g)
      : fallbackItems.reduce((sum, item) => sum + Number(item.fiber_g ?? 0), 0),
  };
  const planCase = nutritionPlanCase as NutritionPlanCase | null;
  const workflowSteps = [
    {
      step: "1",
      title: "Caso energético base",
      detail:
        "El plan queda anclado al caso formal integrado para heredar TMB, actividad y energía objetivo cuando existen.",
      status: planCase?.estimated_bmr_kcal ? "ready" : plan.nutrition_plan_id ? "partial" : "pending",
      evidence: planCase?.estimated_bmr_kcal
        ? `TMB ${formatStepValue(planCase.estimated_bmr_kcal)} kcal y factor ${formatStepValue(planCase.activity_factor_used, 2)} en ${planCase.label}.`
        : plan.nutrition_plan_id
          ? "El plan ya está vinculado al workbook, pero no todos los metadatos energéticos quedaron disponibles en esta vista."
          : "Este plan aún no tendría trazabilidad completa sin caso nutricional vinculado.",
    },
    {
      step: "2",
      title: "Metas diarias cuantificadas",
      detail:
        "La energía y los macronutrientes del día se resuelven desde el caso formal, el plan manual o el fallback DRI.",
      status: effectiveDailyTargets.daily_energy_target_kcal && effectiveDailyTargets.daily_protein_target_g ? "ready" : "partial",
      evidence: `Meta actual: ${formatStepValue(effectiveDailyTargets.daily_energy_target_kcal)} kcal, proteína ${formatStepValue(effectiveDailyTargets.daily_protein_target_g)} g, grasa ${formatStepValue(effectiveDailyTargets.daily_fat_target_g)} g, carbohidratos ${formatStepValue(effectiveDailyTargets.daily_carbs_target_g)} g.`,
    },
    {
      step: "3",
      title: "Distribución por tiempos de comida",
      detail:
        "El workbook define metas energéticas por comida y la vista permite contrastarlas contra lo realmente armado.",
      status: meals.some((meal) => meal.meal_target_kcal != null) ? "ready" : plan.nutrition_plan_id ? "partial" : "pending",
      evidence: meals.some((meal) => meal.meal_target_kcal != null)
        ? meals.map((meal) => `${meal.visible_name ?? meal.meal_type_name}: ${formatStepValue(meal.meal_target_kcal)} kcal`).join(" · ")
        : "Aún faltan comidas cargadas o metas por comida visibles para este día.",
    },
    {
      step: "4",
      title: "Menú descompuesto a ingredientes",
      detail:
        "Cada comida se traduce a alimentos con gramos netos, medida casera y porción persistida.",
      status: mealItems.length ? "ready" : meals.length ? "partial" : "pending",
      evidence: mealItems.length
        ? `${mealItems.length} ingrediente(s) registrados en el día ${currentDay?.day_number ?? 1}.`
        : meals.length
          ? "Ya existen comidas, pero falta cargar ingredientes para cuantificar el menú."
          : "Primero hay que agregar comidas al día para después descomponerlas en alimentos.",
    },
    {
      step: "5",
      title: "Subtotal por comida y total diario",
      detail:
        "La vista consolida nutrientes por comida y por día para cerrar el menú cuantificado.",
      status: meals.length && dayTotals.energy > 0 ? "ready" : meals.length ? "partial" : "pending",
      evidence: meals.length && dayTotals.energy > 0
        ? `Día ${currentDay?.day_number ?? 1}: ${formatStepValue(dayTotals.energy)} kcal, ${formatStepValue(dayTotals.protein, 1)} g proteína, ${formatStepValue(dayTotals.fat, 1)} g grasa, ${formatStepValue(dayTotals.carbs, 1)} g carbohidratos.`
        : "La estructura ya está disponible, pero aún faltan suficientes ítems para consolidar el total del día.",
    },
    {
      step: "6",
      title: "Adecuación contra requerimientos",
      detail:
        "El plan contrasta el armado real contra la meta del caso y muestra desvíos de energía y adecuación por nutriente.",
      status: currentDayAdequacy?.energy_adequacy_pct != null ? "ready" : dayTotals.energy > 0 ? "partial" : "pending",
      evidence: currentDayAdequacy?.energy_adequacy_pct != null
        ? `Adecuación del día: energía ${formatAdequacy(currentDayAdequacy.energy_adequacy_pct)}, proteína ${formatAdequacy(currentDayAdequacy.protein_adequacy_pct)}, grasa ${formatAdequacy(currentDayAdequacy.fat_adequacy_pct)}, carbohidratos ${formatAdequacy(currentDayAdequacy.carbs_adequacy_pct)}.`
        : "La comparación se activará en cuanto el día tenga suficiente contenido nutricional cargado.",
    },
  ] as const;
  const guidedChecks = [
    Boolean(effectiveDailyTargets.daily_energy_target_kcal),
    Boolean(meals.length),
    Boolean(mealItems.length),
    Boolean(currentDayAdequacy?.energy_adequacy_pct != null),
    Boolean(latestLinkedIntake),
    Boolean(latestLinkedIntake && latestLinkedIntake.id),
  ];
  const nextGuidedIndex = guidedChecks.findIndex((isDone) => !isDone);
  const guidedSteps: ClinicalActionStep[] = [
    {
      step: "1",
      title: "Ajustar metas del caso",
      description:
        "Antes de cargar comidas, el día debe tener metas energéticas y nutricionales claras desde el caso, plan o DRI.",
      href: `/patients/${plan.patient_id}?tab=goals`,
      actionLabel: "Revisar metas",
      done: Boolean(effectiveDailyTargets.daily_energy_target_kcal),
      evidence: effectiveDailyTargets.daily_energy_target_kcal
        ? `Meta activa ${formatStepValue(effectiveDailyTargets.daily_energy_target_kcal)} kcal con proteína ${formatStepValue(effectiveDailyTargets.daily_protein_target_g)} g.`
        : "Falta energía objetivo explícita para este plan.",
    },
    {
      step: "2",
      title: "Agregar tiempos de comida",
      description:
        "Cada día del plan debe estructurarse por desayuno, meriendas, almuerzo y cena para distribuir la energía.",
      href: `/plans/${id}?day=${currentDay?.day_number ?? 1}`,
      actionLabel: meals.length ? "Revisar comidas" : "Cargar comidas",
      done: Boolean(meals.length),
      evidence: meals.length
        ? `${meals.length} comida(s) cargadas en el día ${currentDay?.day_number ?? 1}.`
        : "Este día todavía no tiene tiempos de comida definidos.",
    },
    {
      step: "3",
      title: "Desglosar menú en ingredientes",
      description:
        "Aquí el menú textual se convierte en alimentos concretos, porciones y gramos netos verificables.",
      href: `/plans/${id}?day=${currentDay?.day_number ?? 1}`,
      actionLabel: mealItems.length ? "Revisar ingredientes" : "Agregar ingredientes",
      done: Boolean(mealItems.length),
      evidence: mealItems.length
        ? `${mealItems.length} ingrediente(s) cuantificados para este día.`
        : "Sin ingredientes todavía no hay menú cuantificado.",
    },
    {
      step: "4",
      title: "Validar adecuación del día",
      description:
        "El plan debe quedar lo más cerca posible a la meta diaria antes de pasar a contraste con consumo real.",
      href: `/plans/${id}?day=${currentDay?.day_number ?? 1}`,
      actionLabel: currentDayAdequacy?.energy_adequacy_pct != null ? "Ver adecuación" : "Completar cuantificación",
      done: Boolean(currentDayAdequacy?.energy_adequacy_pct != null),
      evidence: currentDayAdequacy?.energy_adequacy_pct != null
        ? `Adecuación actual de energía ${formatAdequacy(currentDayAdequacy.energy_adequacy_pct)}.`
        : "Todavía no hay suficiente contenido cuantificado para medir adecuación del día.",
    },
    {
      step: "5",
      title: "Registrar consumo vinculado",
      description:
        "El plan se vuelve clínicamente útil cuando existe al menos una ingesta real ligada a esta prescripción.",
      href: latestLinkedIntake ? `/intake/${latestLinkedIntake.id}` : `/patients/${plan.patient_id}?tab=intake`,
      actionLabel: latestLinkedIntake ? "Abrir ingesta ligada" : "Crear ingesta",
      done: Boolean(latestLinkedIntake),
      evidence: latestLinkedIntake
        ? `Última ingesta vinculada: ${latestLinkedIntake.intake_date}.`
        : "Aún no hay días de consumo asociados a este plan.",
    },
    {
      step: "6",
      title: "Cerrar contraste en reportes",
      description:
        "El último paso es abrir el reporte del paciente y revisar adherencia entre prescripción y consumo.",
      href: `/patients/${plan.patient_id}?tab=reports`,
      actionLabel: "Abrir reportes",
      done: Boolean(latestLinkedIntake),
      evidence: latestLinkedIntake
        ? "Ya existe base mínima para contrastar plan e ingesta en reportes."
        : "Sin ingesta vinculada todavía no se puede cerrar el circuito de adherencia.",
    },
  ].map((step, index) => ({
    ...step,
    status: step.done ? "done" : nextGuidedIndex === index || nextGuidedIndex === -1 ? "next" : "pending",
  }));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10 lg:px-10 lg:py-14">
      <section className="panel-strong rounded-[2rem] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Plan alimentario integrado</p>
            <h1 className="headline mt-3 text-3xl font-semibold text-slate-950">{plan.name}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {patientName} · {plan.objective_type.replaceAll("_", " ")} · {plan.start_date}
              {plan.diet_type ? ` · ${plan.diet_type}` : ""}
            </p>
            {nutritionPlanCase && (
              <p className="mt-2 text-xs text-slate-500">
                Caso formal: {(nutritionPlanCase as NutritionPlanCase).label}
                {(nutritionPlanCase as NutritionPlanCase).calculation_method ? ` · ${(nutritionPlanCase as NutritionPlanCase).calculation_method}` : ""}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link href={`/patients/${plan.patient_id}?tab=plans`} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium hover:border-slate-300">
              ← Paciente
            </Link>
            {plan.status === "draft" && (
              <form action={activatePlanAction}>
                <input type="hidden" name="plan_id" value={id} />
                <input type="hidden" name="patient_id" value={plan.patient_id} />
                <button type="submit" className={btnPrimary}>Activar plan</button>
              </form>
            )}
            <span className={`self-center rounded-full px-3 py-1 text-xs font-semibold ${
              plan.status === "active" ? "bg-[#d6ebe3] text-[#0f5c4d]" :
              plan.status === "draft" ? "bg-[#fff3db] text-[#9a5a1f]" :
              "bg-slate-200 text-slate-600"
            }`}>{plan.status}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-white/70 px-3 py-1">Perfil DRI: {getDriConditionLabel(resolvedCondition)}</span>
          {referenceLifeStageLabel && <span className="rounded-full bg-white/70 px-3 py-1">Etapa: {referenceLifeStageLabel}</span>}
          {plan.nutrition_plan_id && <span className="rounded-full bg-white/70 px-3 py-1">Workbook vinculado</span>}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {effectiveDailyTargets.daily_energy_target_kcal && (
            <div className="rounded-[1.2rem] bg-white/60 p-3 text-center">
              <p className="text-xs text-slate-500">Meta kcal</p>
              <p className="text-lg font-semibold">{Number(effectiveDailyTargets.daily_energy_target_kcal).toFixed(0)}</p>
              <p className="text-[11px] text-slate-400">{targetSourceLabel(nutritionPlanCase as NutritionPlanCase | null, plan.daily_energy_target_kcal)}</p>
            </div>
          )}
          {effectiveDailyTargets.daily_protein_target_g && (
            <div className="rounded-[1.2rem] bg-white/60 p-3 text-center">
              <p className="text-xs text-slate-500">Proteína</p>
              <p className="text-lg font-semibold">{Number(effectiveDailyTargets.daily_protein_target_g).toFixed(0)}g</p>
              <p className="text-[11px] text-slate-400">{targetSourceLabel(nutritionPlanCase as NutritionPlanCase | null, plan.daily_protein_target_g)}</p>
            </div>
          )}
          {effectiveDailyTargets.daily_fat_target_g && (
            <div className="rounded-[1.2rem] bg-white/60 p-3 text-center">
              <p className="text-xs text-slate-500">Grasa</p>
              <p className="text-lg font-semibold">{Number(effectiveDailyTargets.daily_fat_target_g).toFixed(0)}g</p>
              <p className="text-[11px] text-slate-400">{targetSourceLabel(nutritionPlanCase as NutritionPlanCase | null, plan.daily_fat_target_g)}</p>
            </div>
          )}
          {effectiveDailyTargets.daily_carbs_target_g && (
            <div className="rounded-[1.2rem] bg-white/60 p-3 text-center">
              <p className="text-xs text-slate-500">Carbos</p>
              <p className="text-lg font-semibold">{Number(effectiveDailyTargets.daily_carbs_target_g).toFixed(0)}g</p>
              <p className="text-[11px] text-slate-400">{targetSourceLabel(nutritionPlanCase as NutritionPlanCase | null, plan.daily_carbs_target_g)}</p>
            </div>
          )}
          {effectiveDailyTargets.daily_fiber_target_g && (
            <div className="rounded-[1.2rem] bg-white/60 p-3 text-center">
              <p className="text-xs text-slate-500">Fibra</p>
              <p className="text-lg font-semibold">{Number(effectiveDailyTargets.daily_fiber_target_g).toFixed(0)}g</p>
              <p className="text-[11px] text-slate-400">{targetSourceLabel(nutritionPlanCase as NutritionPlanCase | null, plan.daily_fiber_target_g)}</p>
            </div>
          )}
          {effectiveDailyTargets.daily_sodium_target_mg && (
            <div className="rounded-[1.2rem] bg-white/60 p-3 text-center">
              <p className="text-xs text-slate-500">Sodio</p>
              <p className="text-lg font-semibold">{Number(effectiveDailyTargets.daily_sodium_target_mg).toFixed(0)}mg</p>
              <p className="text-[11px] text-slate-400">{targetSourceLabel(nutritionPlanCase as NutritionPlanCase | null, plan.daily_sodium_target_mg)}</p>
            </div>
          )}
        </div>
      </section>

      {message && (
        <div className="rounded-[1.5rem] border border-[#0f5c4d]/15 bg-white/80 px-5 py-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      <section className="panel rounded-[2rem] p-7 lg:p-8">
        <p className="eyebrow">Ruta operativa del plan</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="headline text-2xl font-semibold text-slate-950">Trazabilidad y siguiente acción del plan</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Esta sección consolida la lectura del menú cuantificado y la próxima acción operativa para que no aparezcan como bloques repetidos dentro del plan.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span className="rounded-full border border-slate-200 bg-white/80 px-4 py-2">
              {workflowSteps.filter((step) => step.status === "ready").length}/{workflowSteps.length} pasos resueltos
            </span>
            <span className="rounded-full border border-slate-200 bg-white/80 px-4 py-2">
              {guidedSteps.filter((step) => step.status === "done").length}/{guidedSteps.length} hitos listos
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Trazabilidad del menú cuantificado</p>
            <div className="mt-4 grid gap-4">
              {workflowSteps.map((step) => {
                const status = workflowStatusClass[step.status];

                return (
                  <article key={step.step} className={`rounded-[1.5rem] border p-5 ${status.card}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Paso {step.step}</p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-950">{step.title}</h3>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${status.badge}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{step.detail}</p>
                    {step.evidence ? (
                      <div className="mt-4 rounded-[1rem] border border-black/5 bg-white/70 px-4 py-3 text-xs leading-6 text-slate-500">
                        {step.evidence}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Siguiente acción dentro del plan</p>
            <div className="mt-4 grid gap-4">
              {guidedSteps.map((step) => {
                const status = guidedStatusClass[step.status];

                return (
                  <article key={step.step} className={`rounded-[1.5rem] border p-5 ${status.card}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Paso {step.step}</p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-950">{step.title}</h3>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${status.badge}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{step.description}</p>
                    {step.evidence ? (
                      <div className="mt-4 rounded-[1rem] border border-black/5 bg-white/70 px-4 py-3 text-xs leading-6 text-slate-500">
                        {step.evidence}
                      </div>
                    ) : null}
                    <div className="mt-5">
                      <Link href={step.href} className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold transition ${status.action}`}>
                        {step.actionLabel}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <CalculationSheet
        eyebrow="Hoja visible"
        title="Cómo se está calculando este día"
        intro="Aquí se muestra de forma literal la secuencia que pediste: TMB, actividad, kcal del día, reparto en macros, distribución en cinco comidas, aporte por alimento, subtotal por comida y comparación final contra el requerimiento."
        bmrKcal={planCase?.estimated_bmr_kcal ?? null}
        activityFactor={planCase?.activity_factor_used ?? null}
        energyTargetKcal={effectiveDailyTargets.daily_energy_target_kcal ?? null}
        proteinTargetG={effectiveDailyTargets.daily_protein_target_g ?? null}
        fatTargetG={effectiveDailyTargets.daily_fat_target_g ?? null}
        carbsTargetG={effectiveDailyTargets.daily_carbs_target_g ?? null}
        fiberTargetG={effectiveDailyTargets.daily_fiber_target_g ?? null}
        sodiumTargetMg={effectiveDailyTargets.daily_sodium_target_mg ?? null}
        totalEnergyKcal={dayTotals.energy}
        totalProteinG={dayTotals.protein}
        totalFatG={dayTotals.fat}
        totalCarbsG={dayTotals.carbs}
        totalFiberG={dayTotals.fiber}
        energyAdequacyPct={currentDayAdequacy?.energy_adequacy_pct ?? percentOf(dayTotals.energy, effectiveDailyTargets.daily_energy_target_kcal)}
        proteinAdequacyPct={currentDayAdequacy?.protein_adequacy_pct ?? percentOf(dayTotals.protein, effectiveDailyTargets.daily_protein_target_g)}
        fatAdequacyPct={currentDayAdequacy?.fat_adequacy_pct ?? percentOf(dayTotals.fat, effectiveDailyTargets.daily_fat_target_g)}
        carbsAdequacyPct={currentDayAdequacy?.carbs_adequacy_pct ?? percentOf(dayTotals.carbs, effectiveDailyTargets.daily_carbs_target_g)}
        fiberAdequacyPct={currentDayAdequacy?.fiber_adequacy_pct ?? percentOf(dayTotals.fiber, effectiveDailyTargets.daily_fiber_target_g)}
        meals={meals.map((meal) => ({
          label: meal.visible_name ?? meal.meal_type_name,
          targetPct: meal.meal_target_pct ?? null,
          targetKcal: meal.meal_target_kcal ?? null,
          actualKcal: meal.meal_actual_kcal ?? null,
          proteinG: meal.actual_protein_g ?? null,
          fatG: meal.actual_fat_g ?? null,
          carbsG: meal.actual_carbs_g ?? null,
          fiberG: meal.actual_fiber_g ?? null,
          adequacyPct: meal.energy_adequacy_pct ?? null,
        }))}
        items={fallbackItems.map((item) => ({
          alimento: item.alimento,
          grams: item.quantity_grams ?? null,
          energyKcal: item.energy_kcal ?? null,
          proteinG: item.protein_g ?? null,
          fatG: item.fat_g ?? null,
          carbsG: item.carbs_g ?? null,
          fiberG: item.fiber_g ?? null,
        }))}
      />

      <nav className="flex flex-wrap gap-2">
        {days?.map((day) => {
          const adequacy = dayAdequacyByDayId.get(day.id);
          return (
            <Link
              key={day.day_number}
              href={`/plans/${id}?day=${day.day_number}`}
              className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
                String(day.day_number) === selectedDay
                  ? "bg-[#0f5c4d] text-white"
                  : "border border-slate-200 bg-white/70 text-slate-600 hover:bg-white"
              }`}
            >
              {day.label ?? `Dia ${day.day_number}`}
              {adequacy?.energy_adequacy_pct != null ? ` · ${Number(adequacy.energy_adequacy_pct).toFixed(0)}%` : ""}
            </Link>
          );
        })}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <div className="panel rounded-[1.4rem] p-4 text-center">
          <p className="text-xs text-slate-500">Energía</p>
          <p className="text-xl font-semibold text-slate-950">{dayTotals.energy.toFixed(0)}</p>
          <p className="text-xs text-slate-400">kcal</p>
          <p className="text-[11px] text-slate-500">{formatAdequacy(currentDayAdequacy?.energy_adequacy_pct ?? percentOf(dayTotals.energy, effectiveDailyTargets.daily_energy_target_kcal))}</p>
        </div>
        <div className="panel rounded-[1.4rem] p-4 text-center">
          <p className="text-xs text-slate-500">Proteína</p>
          <p className="text-xl font-semibold">{dayTotals.protein.toFixed(1)}</p>
          <p className="text-xs text-slate-400">g</p>
          <p className="text-[11px] text-slate-500">{formatAdequacy(currentDayAdequacy?.protein_adequacy_pct ?? percentOf(dayTotals.protein, effectiveDailyTargets.daily_protein_target_g))}</p>
        </div>
        <div className="panel rounded-[1.4rem] p-4 text-center">
          <p className="text-xs text-slate-500">Grasa</p>
          <p className="text-xl font-semibold">{dayTotals.fat.toFixed(1)}</p>
          <p className="text-xs text-slate-400">g</p>
          <p className="text-[11px] text-slate-500">{formatAdequacy(currentDayAdequacy?.fat_adequacy_pct ?? percentOf(dayTotals.fat, effectiveDailyTargets.daily_fat_target_g))}</p>
        </div>
        <div className="panel rounded-[1.4rem] p-4 text-center">
          <p className="text-xs text-slate-500">Carbohidratos</p>
          <p className="text-xl font-semibold">{dayTotals.carbs.toFixed(1)}</p>
          <p className="text-xs text-slate-400">g</p>
          <p className="text-[11px] text-slate-500">{formatAdequacy(currentDayAdequacy?.carbs_adequacy_pct ?? percentOf(dayTotals.carbs, effectiveDailyTargets.daily_carbs_target_g))}</p>
        </div>
        <div className="panel rounded-[1.4rem] p-4 text-center">
          <p className="text-xs text-slate-500">Fibra</p>
          <p className="text-xl font-semibold">{dayTotals.fiber.toFixed(1)}</p>
          <p className="text-xs text-slate-400">g</p>
          <p className="text-[11px] text-slate-500">{formatAdequacy(currentDayAdequacy?.fiber_adequacy_pct ?? percentOf(dayTotals.fiber, effectiveDailyTargets.daily_fiber_target_g))}</p>
        </div>
        {effectiveReferenceTargets.sodio_mg && (
          <div className="panel rounded-[1.4rem] p-4 text-center">
            <p className="text-xs text-slate-500">Ref. sodio</p>
            <p className="text-xl font-semibold">{Number(effectiveReferenceTargets.sodio_mg.value).toFixed(0)}</p>
            <p className="text-xs text-slate-400">mg/día</p>
          </div>
        )}
      </div>

      {currentDay && (
        <div className="panel rounded-[2rem] p-6">
          <p className="eyebrow">Agregar comida al {currentDay.label ?? `Dia ${currentDay.day_number}`}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={buildPlanHref(id, selectedDay, { modal: "create-meal" })} className={btnPrimary}>
              + Comida
            </Link>
          </div>
        </div>
      )}

      {currentDay && modal === "create-meal" ? (
        <FormModalShell
          title={`Agregar comida al ${currentDay.label ?? `Dia ${currentDay.day_number}`}`}
          eyebrow="Plan del día"
          description="Crea una nueva comida y luego completa su texto o sus alimentos desde modales separados."
          closeHref={buildPlanHref(id, selectedDay)}
          widthClassName="max-w-4xl"
        >
          <form action={addMealToDayAction} className="grid gap-3 md:grid-cols-[auto_1fr_1.3fr_auto] md:items-end">
            <input type="hidden" name="plan_day_id" value={currentDay.id} />
            <input type="hidden" name="plan_id" value={id} />
            <input type="hidden" name="day" value={selectedDay} />
            <select name="meal_type_id" className={inputClass} required>
              {mealTypeRows.map((mealType) => (
                <option key={mealType.id} value={mealType.id}>{mealType.name}</option>
              ))}
            </select>
            <label className="text-sm font-medium text-slate-700">
              Nombre visible
              <input name="visible_name" className={inputClass} placeholder="Ej: Desayuno base" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Menú textual
              <input name="menu_text" className={inputClass} placeholder="Ej: avena cocida, fruta, yogur" />
            </label>
            <button type="submit" className={btnPrimary}>Guardar comida</button>
          </form>
        </FormModalShell>
      ) : null}

      {meals.map((meal) => {
        const items = mealItemsMap[meal.meal_id] ?? [];
        const mealName = meal.visible_name || meal.meal_type_name || "Comida";
        const mealEnergy = Number(meal.meal_actual_kcal ?? 0);
        const mealProtein = Number(meal.actual_protein_g ?? 0);
        const mealFat = Number(meal.actual_fat_g ?? 0);
        const mealCarbs = Number(meal.actual_carbs_g ?? 0);
        const mealFiber = Number(meal.actual_fiber_g ?? 0);
        const mealDeviation = meal.meal_deviation_kcal != null ? Number(meal.meal_deviation_kcal) : null;
        const editingMeal = editMealId === meal.meal_id;
        const addingItem = addItemMealId === meal.meal_id;
        const editingItem = items.find((item) => item.id === editItemId) ?? null;

        return (
          <div key={meal.meal_id} className="panel rounded-[2rem] p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-[#0f5c4d]">{mealName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {meal.meal_type_name} · {mealEnergy.toFixed(0)} kcal · P:{mealProtein.toFixed(1)}g · G:{mealFat.toFixed(1)}g · C:{mealCarbs.toFixed(1)}g · Fib:{mealFiber.toFixed(1)}g
                </p>
                {meal.menu_text && <p className="mt-2 text-sm text-slate-600">{meal.menu_text}</p>}
                {meal.meal_target_kcal != null && (
                  <p className="mt-2 text-xs text-slate-500">
                    Meta: {Number(meal.meal_target_kcal).toFixed(0)} kcal
                    {meal.meal_target_pct != null ? ` · ${(Number(meal.meal_target_pct) * 100).toFixed(0)}% del día` : ""}
                    {mealDeviation != null ? ` · Desvío: ${formatDeviation(mealDeviation)}` : ""}
                    {meal.meal_deviation_pct != null ? ` (${Number(meal.meal_deviation_pct).toFixed(1)}%)` : ""}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 sm:grid-cols-4">
                <span className="rounded-full bg-white px-3 py-1">Energía {formatAdequacy(meal.energy_adequacy_pct)}</span>
                <span className="rounded-full bg-white px-3 py-1">P {formatAdequacy(meal.protein_adequacy_pct)}</span>
                <span className="rounded-full bg-white px-3 py-1">G {formatAdequacy(meal.fat_adequacy_pct)}</span>
                <span className="rounded-full bg-white px-3 py-1">C {formatAdequacy(meal.carbs_adequacy_pct)}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-200 pt-4">
              <Link href={buildPlanHref(id, selectedDay, { editMeal: meal.meal_id })} className="rounded-full border border-[#0f5c4d]/20 bg-white px-4 py-2 text-sm font-semibold text-[#0f5c4d] hover:bg-[#f1f7f4]">
                Editar comida
              </Link>
              <Link href={buildPlanHref(id, selectedDay, { addItemMeal: meal.meal_id })} className="rounded-full border border-[#0f5c4d]/20 bg-white px-4 py-2 text-sm font-semibold text-[#0f5c4d] hover:bg-[#f1f7f4]">
                Agregar alimento
              </Link>
            </div>

            {items.length > 0 && (
              <>
              <div className="mt-4 grid gap-3 md:hidden">
                {items.map((item) => (
                  <article key={item.id} className="rounded-[1.15rem] border border-slate-200 bg-white/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{item.alimento}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.saved_portion_label ?? item.household_measure ?? "—"}
                          {item.household_quantity ? ` × ${Number(item.household_quantity).toFixed(Number(item.household_quantity) % 1 === 0 ? 0 : 2)}` : ""}
                        </p>
                      </div>
                      <Link href={buildPlanHref(id, selectedDay, { editItem: item.id })} className="rounded-full border border-[#0f5c4d]/15 bg-[#d6ebe3] px-3 py-1.5 text-xs font-semibold text-[#0f5c4d]">
                        Editar
                      </Link>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                      <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Gramos: {Number(item.quantity_grams ?? 0).toFixed(0)}</div>
                      <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Kcal: {Number(item.energy_kcal ?? 0).toFixed(0)}</div>
                      <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Prot: {Number(item.protein_g ?? 0).toFixed(1)}</div>
                      <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Grasa: {Number(item.fat_g ?? 0).toFixed(1)}</div>
                      <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2 col-span-2">Carbos: {Number(item.carbs_g ?? 0).toFixed(1)}</div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="pb-2 pr-3">Alimento</th>
                      <th className="pb-2 pr-3">Porción</th>
                      <th className="pb-2 pr-3 text-right">Gramos</th>
                      <th className="pb-2 pr-3 text-right">Kcal</th>
                      <th className="pb-2 pr-3 text-right">Prot</th>
                      <th className="pb-2 pr-3 text-right">Grasa</th>
                      <th className="pb-2 text-right">Carbos</th>
                      <th className="pb-2 pl-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-50">
                        <td className="max-w-[200px] truncate py-2 pr-3">{item.alimento}</td>
                        <td className="py-2 pr-3 text-xs text-slate-600">
                          {item.saved_portion_label ?? item.household_measure ?? "—"}
                          {item.household_quantity ? <span className="ml-1 text-slate-400">× {Number(item.household_quantity).toFixed(Number(item.household_quantity) % 1 === 0 ? 0 : 2)}</span> : null}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{Number(item.quantity_grams ?? 0).toFixed(0)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{Number(item.energy_kcal ?? 0).toFixed(0)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{Number(item.protein_g ?? 0).toFixed(1)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{Number(item.fat_g ?? 0).toFixed(1)}</td>
                        <td className="py-2 text-right tabular-nums">{Number(item.carbs_g ?? 0).toFixed(1)}</td>
                        <td className="py-2 pl-3 text-right">
                          <Link href={buildPlanHref(id, selectedDay, { editItem: item.id })} className="text-xs font-semibold text-[#0f5c4d] hover:underline">
                            Editar
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}

            {editingMeal ? (
              <FormModalShell
                title={`Editar comida: ${mealName}`}
                eyebrow="Plan del día"
                description="Ajusta el nombre visible y el menú textual de esta comida sin perder el contexto del día."
                closeHref={buildPlanHref(id, selectedDay)}
                widthClassName="max-w-4xl"
              >
                <form action={updatePlanMealPresentationAction} className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto] md:items-end">
                  <input type="hidden" name="meal_id" value={meal.meal_id} />
                  <input type="hidden" name="plan_id" value={id} />
                  <input type="hidden" name="day" value={selectedDay} />
                  <label className="text-sm font-medium text-slate-700">
                    Nombre visible
                    <input name="visible_name" className={inputClass} defaultValue={meal.visible_name ?? ""} placeholder={meal.meal_type_name} />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Menú textual
                    <input name="menu_text" className={inputClass} defaultValue={meal.menu_text ?? ""} placeholder="Describe la comida en lenguaje clínico" />
                  </label>
                  <button type="submit" className={btnPrimary}>Guardar comida</button>
                </form>
              </FormModalShell>
            ) : null}

            {addingItem ? (
              <FormModalShell
                title={`Agregar alimento a ${mealName}`}
                eyebrow="Ingredientes"
                description="Busca el alimento, elige una porción guardada o gramos manuales y agrégalo al subtotal de la comida."
                closeHref={buildPlanHref(id, selectedDay)}
                widthClassName="max-w-5xl"
              >
                <form action={addMealItemAction} className="space-y-4">
                  <input type="hidden" name="meal_id" value={meal.meal_id} />
                  <input type="hidden" name="plan_id" value={id} />
                  <input type="hidden" name="day" value={selectedDay} />
                  <FoodSearchSelect name="alimento_id" quantityName="quantity_grams" dailyTargets={effectiveDailyTargets} referenceTargets={effectiveReferenceTargets} required />
                  <button type="submit" className={btnPrimary}>Agregar alimento</button>
                </form>
              </FormModalShell>
            ) : null}

            {editingItem ? (
              <FormModalShell
                title={`Editar alimento en ${mealName}`}
                eyebrow="Ingredientes"
                description="Ajusta alimento, porción o gramos sin salir del plan del día."
                closeHref={buildPlanHref(id, selectedDay)}
                widthClassName="max-w-5xl"
              >
                <form action={updatePlanMealItemAction} className="space-y-4">
                  <input type="hidden" name="item_id" value={editingItem.id} />
                  <input type="hidden" name="meal_id" value={meal.meal_id} />
                  <input type="hidden" name="plan_id" value={id} />
                  <input type="hidden" name="day" value={selectedDay} />
                  <FoodSearchSelect
                    name="alimento_id"
                    quantityName="quantity_grams"
                    dailyTargets={effectiveDailyTargets}
                    referenceTargets={effectiveReferenceTargets}
                    required
                    initialFoodId={editingItem.alimento_id}
                    initialFoodLabel={editingItem.alimento}
                    initialQuantityGrams={Number(editingItem.quantity_grams ?? 100)}
                    initialPortionId={editingItem.food_portion_id ?? null}
                    initialPortionMultiplier={editingItem.portion_multiplier ?? null}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" className={btnPrimary}>Guardar cambios</button>
                    <Link href={buildPlanHref(id, selectedDay)} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300">
                      Cancelar
                    </Link>
                  </div>
                </form>

                <form action={deletePlanMealItemAction} className="mt-4 border-t border-slate-200 pt-4">
                  <input type="hidden" name="item_id" value={editingItem.id} />
                  <input type="hidden" name="meal_id" value={meal.meal_id} />
                  <input type="hidden" name="plan_id" value={id} />
                  <input type="hidden" name="day" value={selectedDay} />
                  <button type="submit" className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100">
                    Eliminar alimento
                  </button>
                </form>
              </FormModalShell>
            ) : null}
          </div>
        );
      })}

      {!meals.length && (
        <div className="panel rounded-[2rem] p-8 text-center text-sm text-slate-500">
          Este día no tiene comidas aún. Agrega una comida arriba para empezar.
        </div>
      )}
    </main>
  );
}