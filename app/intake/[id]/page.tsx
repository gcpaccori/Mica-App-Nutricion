import { redirect } from "next/navigation";
import Link from "next/link";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  addIntakeMealAction,
  addIntakeItemAction,
  deleteIntakeItemAction,
  updateIntakeItemAction,
  updateIntakeMealPresentationAction,
  updateMealStatusAction,
} from "@/lib/actions/intake";
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
  estimated_bmr_kcal?: number | null;
  activity_factor_used?: number | null;
  target_energy_kcal?: number | null;
  protein_target_g?: number | null;
  fat_target_g?: number | null;
  carbs_target_g?: number | null;
  fiber_target_g?: number | null;
  sodium_target_mg?: number | null;
};

type IntakeMeal = {
  id: string;
  meal_type_id: number;
  status: string;
  notes?: string | null;
  visible_name?: string | null;
  menu_text?: string | null;
};

type IntakeMealItem = {
  id: string;
  intake_meal_id: string;
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
  consumed?: boolean | null;
};

type MealTarget = {
  meal_code: string;
  target_energy_kcal?: number | null;
  target_protein_g?: number | null;
  target_fat_g?: number | null;
  target_carbs_g?: number | null;
  target_fiber_g?: number | null;
  energy_pct?: number | null;
};

type DailyComparison = {
  adherence_pct?: number | null;
  planned_energy_kcal?: number | null;
  actual_energy_kcal?: number | null;
  energy_adequacy_pct?: number | null;
  protein_adequacy_pct?: number | null;
  fiber_adequacy_pct?: number | null;
};

function msg(v?: string | string[]) {
  return Array.isArray(v) ? v[0] : v;
}

const inputClass = "mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#0f5c4d] focus:outline-none";
const btnPrimary = "rounded-full bg-[#0f5c4d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a4a3d]";

const statusLabels: Record<string, string> = {
  planned: "Planeado",
  completed: "Completado",
  partial: "Parcial",
  omitted: "Omitido",
  replaced: "Reemplazado",
};

const statusColors: Record<string, string> = {
  planned: "bg-[#fff3db] text-[#9a5a1f]",
  completed: "bg-[#d6ebe3] text-[#0f5c4d]",
  partial: "bg-blue-100 text-blue-700",
  omitted: "bg-red-100 text-red-700",
  replaced: "bg-purple-100 text-purple-700",
};

function percentOf(actual: number, target?: number | null) {
  if (!target || target <= 0) return null;
  return (actual / target) * 100;
}

function formatAdequacy(value?: number | null) {
  if (value == null) return "—";
  return `${Number(value).toFixed(0)}%`;
}

function formatStepValue(value?: number | null, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value).toFixed(digits);
}

function buildIntakeHref(
  intakeDayId: string,
  extra?: Record<string, string | number | null | undefined>,
) {
  const search = new URLSearchParams();

  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value == null || value === "") return;
    search.set(key, String(value));
  });

  const query = search.toString();
  return query ? `/intake/${intakeDayId}?${query}` : `/intake/${intakeDayId}`;
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

export default async function IntakeDayDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const modal = msg(sp.modal) ?? "";
  const editMealId = msg(sp.editMeal) ?? null;
  const addItemMealId = msg(sp.addItemMeal) ?? null;
  const editItemId = msg(sp.editItem) ?? null;

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: intakeDay } = await supabase
    .from("intake_days")
    .select("*, patients(id, first_name, last_name)")
    .eq("id", id)
    .single();

  if (!intakeDay) redirect("/dashboard?message=" + encodeURIComponent("Dia de consumo no encontrado."));

  const patient = intakeDay.patients as { id: string; first_name: string; last_name: string } | null;

  const [
    { data: linkedPlan },
    { data: nutritionPlanCase },
    { data: intakeAdequacy },
    { data: intakeMealsData },
    { data: mealTypesData },
    { data: dayComparison },
  ] = await Promise.all([
    intakeDay.plan_id
      ? supabase
          .from("diet_plans")
          .select("id, name, nutrition_plan_id, daily_energy_target_kcal, daily_protein_target_g, daily_fat_target_g, daily_carbs_target_g, daily_fiber_target_g, daily_sodium_target_mg")
          .eq("id", intakeDay.plan_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    intakeDay.plan_id
      ? supabase
          .from("diet_plans")
          .select("nutrition_plan_id")
          .eq("id", intakeDay.plan_id)
          .maybeSingle()
          .then(async ({ data }) => {
            if (!data?.nutrition_plan_id) return { data: null };
            return supabase
              .from("nutrition_plan_case_v")
              .select("*")
              .eq("nutrition_plan_id", data.nutrition_plan_id)
              .maybeSingle();
          })
      : Promise.resolve({ data: null }),
    supabase.from("intake_day_adequacy_v").select("*").eq("intake_day_id", id).maybeSingle(),
    supabase
      .from("intake_meals")
      .select("id, meal_type_id, status, notes, visible_name, menu_text")
      .eq("intake_day_id", id),
    supabase.from("meal_types").select("*").order("sort_order"),
    intakeDay.plan_id
      ? supabase
          .from("daily_plan_vs_intake_v")
          .select("adherence_pct, planned_energy_kcal, actual_energy_kcal, energy_adequacy_pct, protein_adequacy_pct, fiber_adequacy_pct")
          .eq("patient_id", intakeDay.patient_id)
          .eq("plan_id", intakeDay.plan_id)
          .eq("intake_date", intakeDay.intake_date)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const mealTypes = (mealTypesData ?? []) as MealType[];
  const mealTypesById = new Map(mealTypes.map((mealType) => [mealType.id, mealType]));

  let mealTargets: MealTarget[] = [];
  if (linkedPlan?.nutrition_plan_id) {
    const { data } = await supabase
      .from("nutrition_plan_meal_target_v")
      .select("meal_code, target_energy_kcal, target_protein_g, target_fat_g, target_carbs_g, target_fiber_g, energy_pct")
      .eq("nutrition_plan_id", linkedPlan.nutrition_plan_id);

    mealTargets = (data ?? []) as MealTarget[];
  }

  const baseDailyTargets = nutritionPlanCase
    ? toDailyTargetsFromNutritionPlanCase(nutritionPlanCase as NutritionPlanCase)
    : {
        daily_energy_target_kcal: linkedPlan?.daily_energy_target_kcal ?? null,
        daily_protein_target_g: linkedPlan?.daily_protein_target_g ?? null,
        daily_fat_target_g: linkedPlan?.daily_fat_target_g ?? null,
        daily_carbs_target_g: linkedPlan?.daily_carbs_target_g ?? null,
        daily_fiber_target_g: linkedPlan?.daily_fiber_target_g ?? null,
        daily_sodium_target_mg: linkedPlan?.daily_sodium_target_mg ?? null,
      };

  const {
    effectiveDailyTargets: linkedPlanTargets,
    referenceTargets: linkedReferenceTargets,
    resolvedCondition,
    referenceLifeStageLabel,
  } = await getPatientDriContext(supabase, intakeDay.patient_id, baseDailyTargets);

  const intakeMeals = (intakeMealsData ?? []) as IntakeMeal[];
  const intakeMealIds = intakeMeals.map((meal) => meal.id);
  const { data: intakeNutrients } = intakeMealIds.length
    ? await supabase
        .from("intake_meal_item_nutrients_v")
        .select("*")
        .in("intake_meal_id", intakeMealIds)
    : { data: [] };

  const nutrientItems = (intakeNutrients ?? []) as IntakeMealItem[];
  const itemsMap: Record<string, IntakeMealItem[]> = {};
  for (const item of nutrientItems) {
    if (!itemsMap[item.intake_meal_id]) itemsMap[item.intake_meal_id] = [];
    itemsMap[item.intake_meal_id].push(item);
  }

  const dayTotals = {
    energy: Number(intakeAdequacy?.actual_energy_kcal ?? nutrientItems.reduce((sum, item) => sum + Number(item.energy_kcal ?? 0), 0)),
    protein: Number(intakeAdequacy?.actual_protein_g ?? nutrientItems.reduce((sum, item) => sum + Number(item.protein_g ?? 0), 0)),
    fat: Number(intakeAdequacy?.actual_fat_g ?? nutrientItems.reduce((sum, item) => sum + Number(item.fat_g ?? 0), 0)),
    carbs: Number(intakeAdequacy?.actual_carbs_g ?? nutrientItems.reduce((sum, item) => sum + Number(item.carbs_g ?? 0), 0)),
    fiber: Number(intakeAdequacy?.actual_fiber_g ?? nutrientItems.reduce((sum, item) => sum + Number(item.fiber_g ?? 0), 0)),
  };

  const mealTargetByCode = new Map(mealTargets.map((target) => [target.meal_code, target]));
  const dailyComparison = dayComparison as DailyComparison | null;
  const workflowSteps = [
    {
      step: "1",
      title: "Referencia prescrita del día",
      detail:
        "La ingesta puede vincularse a un plan y heredar metas energéticas y nutricionales del caso formal.",
      status: linkedPlan ? "ready" : "partial",
      evidence: linkedPlan
        ? `Plan vinculado: ${linkedPlan.name}. Meta diaria ${formatStepValue(linkedPlanTargets.daily_energy_target_kcal)} kcal.`
        : "La ingesta puede registrarse sin plan, pero así no se cierra del todo la comparación contra prescripción.",
    },
    {
      step: "2",
      title: "Distribución de comidas observadas",
      detail:
        "Cada tiempo de comida se registra con nombre visible, menú textual y meta referencial cuando existe un plan asociado.",
      status: intakeMeals.length ? "ready" : "pending",
      evidence: intakeMeals.length
        ? `${intakeMeals.length} comida(s) registradas para ${intakeDay.intake_date}.`
        : "Primero hay que registrar las comidas del día consumido.",
    },
    {
      step: "3",
      title: "Descomposición en alimentos y gramos",
      detail:
        "La ingesta real se desglosa en alimentos concretos con gramos netos y porciones caseras persistidas.",
      status: nutrientItems.length ? "ready" : intakeMeals.length ? "partial" : "pending",
      evidence: nutrientItems.length
        ? `${nutrientItems.length} alimento(s) cuantificados en el consumo real del día.`
        : intakeMeals.length
          ? "Las comidas ya existen, pero todavía faltan alimentos cargados para cuantificar el consumo."
          : "Sin comidas no puede empezar el desglose real de la ingesta.",
    },
    {
      step: "4",
      title: "Subtotal por comida y total diario",
      detail:
        "El sistema suma el aporte real por comida y consolida el total nutricional del día consumido.",
      status: dayTotals.energy > 0 ? "ready" : nutrientItems.length ? "partial" : "pending",
      evidence: dayTotals.energy > 0
        ? `Total diario: ${formatStepValue(dayTotals.energy)} kcal, ${formatStepValue(dayTotals.protein, 1)} g proteína, ${formatStepValue(dayTotals.fat, 1)} g grasa, ${formatStepValue(dayTotals.carbs, 1)} g carbohidratos.`
        : "Aún faltan cantidades suficientes para cerrar el total del día.",
    },
    {
      step: "5",
      title: "Adecuación contra requerimientos",
      detail:
        "La ingesta compara el consumo real frente a las metas del caso para energía, macros y fibra.",
      status: intakeAdequacy?.energy_adequacy_pct != null ? "ready" : dayTotals.energy > 0 ? "partial" : "pending",
      evidence: intakeAdequacy?.energy_adequacy_pct != null
        ? `Adecuación: energía ${formatAdequacy(intakeAdequacy.energy_adequacy_pct)}, proteína ${formatAdequacy(intakeAdequacy.protein_adequacy_pct)}, grasa ${formatAdequacy(intakeAdequacy.fat_adequacy_pct)}, fibra ${formatAdequacy(intakeAdequacy.fiber_adequacy_pct)}.`
        : "La comparación se activará cuando el consumo esté suficientemente cuantificado.",
    },
    {
      step: "6",
      title: "Adherencia contra el plan",
      detail:
        "Cuando la ingesta está vinculada a un plan, la vista contrasta lo consumido con lo prescrito para ese día calendario.",
      status: dailyComparison?.adherence_pct != null ? "ready" : linkedPlan ? "partial" : "pending",
      evidence: dailyComparison?.adherence_pct != null
        ? `Plan ${formatStepValue(dailyComparison.planned_energy_kcal)} kcal vs consumo ${formatStepValue(dailyComparison.actual_energy_kcal)} kcal. Adherencia ${formatAdequacy(dailyComparison.adherence_pct)}.`
        : linkedPlan
          ? "Ya existe vínculo con plan, pero falta suficiente contenido cuantificado para calcular adherencia diaria sólida."
          : "Sin plan vinculado no puede calcularse adherencia a la prescripción.",
    },
  ] as const;
  const guidedChecks = [
    Boolean(linkedPlan),
    Boolean(intakeMeals.length),
    Boolean(nutrientItems.length),
    Boolean(intakeMeals.some((meal) => meal.status !== "planned")),
    Boolean(intakeAdequacy?.energy_adequacy_pct != null),
    Boolean(dailyComparison?.adherence_pct != null),
  ];
  const nextGuidedIndex = guidedChecks.findIndex((isDone) => !isDone);
  const guidedSteps: ClinicalActionStep[] = [
    {
      step: "1",
      title: "Confirmar referencia del día",
      description:
        "La mejor lectura de la ingesta ocurre cuando está vinculada a un plan prescrito del mismo paciente.",
      href: linkedPlan ? `/plans/${linkedPlan.id}` : `/patients/${intakeDay.patient_id}?tab=intake`,
      actionLabel: linkedPlan ? "Abrir plan vinculado" : "Vincular o revisar plan",
      done: Boolean(linkedPlan),
      evidence: linkedPlan
        ? `Consumo ligado al plan ${linkedPlan.name}.`
        : "Este día puede registrarse igual, pero quedará sin contraste formal contra prescripción.",
    },
    {
      step: "2",
      title: "Registrar comidas del día",
      description:
        "Primero se cargan los tiempos de comida realmente observados para estructurar el consumo.",
      href: `/intake/${id}`,
      actionLabel: intakeMeals.length ? "Revisar comidas" : "Agregar comidas",
      done: Boolean(intakeMeals.length),
      evidence: intakeMeals.length
        ? `${intakeMeals.length} comida(s) registradas en ${intakeDay.intake_date}.`
        : "El día aún no tiene tiempos de comida cargados.",
    },
    {
      step: "3",
      title: "Cargar alimentos y porciones",
      description:
        "Cada comida necesita alimentos concretos y gramos netos para poder cuantificar el consumo.",
      href: `/intake/${id}`,
      actionLabel: nutrientItems.length ? "Revisar alimentos" : "Agregar alimentos",
      done: Boolean(nutrientItems.length),
      evidence: nutrientItems.length
        ? `${nutrientItems.length} alimento(s) cuantificados para el consumo real.`
        : "Sin alimentos aún no hay nutrientes reales que comparar.",
    },
    {
      step: "4",
      title: "Marcar estado observado",
      description:
        "Hay que indicar si la comida fue completada, parcial, omitida o reemplazada para interpretar la adherencia.",
      href: `/intake/${id}`,
      actionLabel: intakeMeals.some((meal) => meal.status !== "planned") ? "Revisar estados" : "Actualizar estados",
      done: Boolean(intakeMeals.some((meal) => meal.status !== "planned")),
      evidence: intakeMeals.some((meal) => meal.status !== "planned")
        ? "Ya existe al menos una comida con estado observado distinto de planeado."
        : "Todavía todas las comidas siguen en estado planeado.",
    },
    {
      step: "5",
      title: "Revisar adecuación nutricional",
      description:
        "Una vez cuantificado el día, el sistema calcula adecuación frente a energía, macros y fibra.",
      href: `/intake/${id}`,
      actionLabel: intakeAdequacy?.energy_adequacy_pct != null ? "Ver adecuación" : "Completar cuantificación",
      done: Boolean(intakeAdequacy?.energy_adequacy_pct != null),
      evidence: intakeAdequacy?.energy_adequacy_pct != null
        ? `Adecuación de energía ${formatAdequacy(intakeAdequacy.energy_adequacy_pct)}.`
        : "Falta cuantificación suficiente para cerrar la lectura nutricional del día.",
    },
    {
      step: "6",
      title: "Cerrar adherencia en reportes",
      description:
        "El último paso es ir al reporte del paciente para contrastar prescripción, consumo y adherencia longitudinal.",
      href: `/patients/${intakeDay.patient_id}?tab=reports`,
      actionLabel: "Abrir reportes",
      done: Boolean(dailyComparison?.adherence_pct != null),
      evidence: dailyComparison?.adherence_pct != null
        ? `Adherencia del día ${formatAdequacy(dailyComparison.adherence_pct)}.`
        : "Cuando el consumo y el plan estén suficientemente completos, aquí se cerrará el contraste final.",
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
            <p className="eyebrow">Registro de consumo integrado</p>
            <h1 className="headline mt-3 text-3xl font-semibold text-slate-950">{intakeDay.intake_date}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {patient ? `${patient.first_name} ${patient.last_name}` : "Paciente"}
              {linkedPlan ? ` · Plan ${linkedPlan.name}` : " · Sin plan vinculado"}
            </p>
            {nutritionPlanCase && (
              <p className="mt-2 text-xs text-slate-500">Caso formal: {(nutritionPlanCase as NutritionPlanCase).label}</p>
            )}
          </div>
          {patient && (
            <Link href={`/patients/${patient.id}?tab=intake`} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium hover:border-slate-300">
              ← Paciente
            </Link>
          )}
        </div>
      </section>
      <section className="panel rounded-[2rem] p-7 lg:p-8">
        <p className="eyebrow">Ruta operativa de la ingesta</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="headline text-2xl font-semibold text-slate-950">Trazabilidad y siguiente acción de la ingesta</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Aquí queda un solo bloque operativo para entender el consumo real y ver qué falta completar, sin repetir paneles con la misma intención.
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Trazabilidad del consumo real</p>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Siguiente acción dentro de la ingesta</p>
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
        title="Cómo se está calculando este consumo"
        intro="Esta hoja deja visible la secuencia completa: referencia prescrita, reparto por comidas, aporte por alimento, suma por comida y por día, y comparación final contra el requerimiento y el plan vinculado."
        bmrKcal={(nutritionPlanCase as NutritionPlanCase | null)?.estimated_bmr_kcal ?? null}
        activityFactor={(nutritionPlanCase as NutritionPlanCase | null)?.activity_factor_used ?? null}
        energyTargetKcal={linkedPlanTargets.daily_energy_target_kcal ?? null}
        proteinTargetG={linkedPlanTargets.daily_protein_target_g ?? null}
        fatTargetG={linkedPlanTargets.daily_fat_target_g ?? null}
        carbsTargetG={linkedPlanTargets.daily_carbs_target_g ?? null}
        fiberTargetG={linkedPlanTargets.daily_fiber_target_g ?? null}
        sodiumTargetMg={linkedPlanTargets.daily_sodium_target_mg ?? null}
        totalEnergyKcal={dayTotals.energy}
        totalProteinG={dayTotals.protein}
        totalFatG={dayTotals.fat}
        totalCarbsG={dayTotals.carbs}
        totalFiberG={dayTotals.fiber}
        energyAdequacyPct={intakeAdequacy?.energy_adequacy_pct ?? percentOf(dayTotals.energy, linkedPlanTargets.daily_energy_target_kcal)}
        proteinAdequacyPct={intakeAdequacy?.protein_adequacy_pct ?? percentOf(dayTotals.protein, linkedPlanTargets.daily_protein_target_g)}
        fatAdequacyPct={intakeAdequacy?.fat_adequacy_pct ?? percentOf(dayTotals.fat, linkedPlanTargets.daily_fat_target_g)}
        carbsAdequacyPct={intakeAdequacy?.carbs_adequacy_pct ?? percentOf(dayTotals.carbs, linkedPlanTargets.daily_carbs_target_g)}
        fiberAdequacyPct={intakeAdequacy?.fiber_adequacy_pct ?? percentOf(dayTotals.fiber, linkedPlanTargets.daily_fiber_target_g)}
        meals={intakeMeals.map((meal) => {
          const mealType = mealTypesById.get(meal.meal_type_id);
          const target = mealType?.code ? mealTargetByCode.get(mealType.code) : null;
          const items = itemsMap[meal.id] ?? [];
          const mealEnergy = items.reduce((sum, item) => sum + Number(item.energy_kcal ?? 0), 0);
          const mealProtein = items.reduce((sum, item) => sum + Number(item.protein_g ?? 0), 0);
          const mealFat = items.reduce((sum, item) => sum + Number(item.fat_g ?? 0), 0);
          const mealCarbs = items.reduce((sum, item) => sum + Number(item.carbs_g ?? 0), 0);
          const mealFiber = items.reduce((sum, item) => sum + Number(item.fiber_g ?? 0), 0);

          return {
            label: meal.visible_name ?? mealType?.name ?? "Comida",
            targetPct: target?.energy_pct ?? null,
            targetKcal: target?.target_energy_kcal ?? null,
            actualKcal: mealEnergy,
            proteinG: mealProtein,
            fatG: mealFat,
            carbsG: mealCarbs,
            fiberG: mealFiber,
            adequacyPct: percentOf(mealEnergy, target?.target_energy_kcal ?? null),
          };
        })}
        items={nutrientItems.map((item) => ({
          alimento: item.alimento,
          grams: item.quantity_grams ?? null,
          energyKcal: item.energy_kcal ?? null,
          proteinG: item.protein_g ?? null,
          fatG: item.fat_g ?? null,
          carbsG: item.carbs_g ?? null,
          fiberG: item.fiber_g ?? null,
        }))}
      />

      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-white/70 px-3 py-1">Perfil DRI: {getDriConditionLabel(resolvedCondition)}</span>
        {referenceLifeStageLabel && <span className="rounded-full bg-white/70 px-3 py-1">Etapa: {referenceLifeStageLabel}</span>}
        {linkedPlan?.nutrition_plan_id && <span className="rounded-full bg-white/70 px-3 py-1">Workbook vinculado</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <div className="panel rounded-[1.4rem] p-4 text-center">
          <p className="text-xs text-slate-500">Energía</p>
          <p className="text-xl font-semibold text-slate-950">{dayTotals.energy.toFixed(0)}</p>
          <p className="text-xs text-slate-400">kcal</p>
          <p className="text-[11px] text-slate-500">{formatAdequacy(intakeAdequacy?.energy_adequacy_pct ?? percentOf(dayTotals.energy, linkedPlanTargets.daily_energy_target_kcal))}</p>
        </div>
        <div className="panel rounded-[1.4rem] p-4 text-center">
          <p className="text-xs text-slate-500">Proteína</p>
          <p className="text-xl font-semibold">{dayTotals.protein.toFixed(1)}g</p>
          <p className="text-[11px] text-slate-500">{formatAdequacy(intakeAdequacy?.protein_adequacy_pct ?? percentOf(dayTotals.protein, linkedPlanTargets.daily_protein_target_g))}</p>
        </div>
        <div className="panel rounded-[1.4rem] p-4 text-center">
          <p className="text-xs text-slate-500">Grasa</p>
          <p className="text-xl font-semibold">{dayTotals.fat.toFixed(1)}g</p>
          <p className="text-[11px] text-slate-500">{formatAdequacy(intakeAdequacy?.fat_adequacy_pct ?? percentOf(dayTotals.fat, linkedPlanTargets.daily_fat_target_g))}</p>
        </div>
        <div className="panel rounded-[1.4rem] p-4 text-center">
          <p className="text-xs text-slate-500">Carbohidratos</p>
          <p className="text-xl font-semibold">{dayTotals.carbs.toFixed(1)}g</p>
          <p className="text-[11px] text-slate-500">{formatAdequacy(intakeAdequacy?.carbs_adequacy_pct ?? percentOf(dayTotals.carbs, linkedPlanTargets.daily_carbs_target_g))}</p>
        </div>
        <div className="panel rounded-[1.4rem] p-4 text-center">
          <p className="text-xs text-slate-500">Fibra</p>
          <p className="text-xl font-semibold">{dayTotals.fiber.toFixed(1)}g</p>
          <p className="text-[11px] text-slate-500">{formatAdequacy(intakeAdequacy?.fiber_adequacy_pct ?? percentOf(dayTotals.fiber, linkedPlanTargets.daily_fiber_target_g))}</p>
        </div>
        {linkedReferenceTargets.sodio_mg && (
          <div className="panel rounded-[1.4rem] p-4 text-center">
            <p className="text-xs text-slate-500">Ref. sodio</p>
            <p className="text-xl font-semibold">{Number(linkedReferenceTargets.sodio_mg.value).toFixed(0)}mg</p>
            <p className="text-xs text-slate-400">referencia diaria</p>
          </div>
        )}
      </div>

      <div className="panel rounded-[2rem] p-6">
        <p className="eyebrow">Agregar comida</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={buildIntakeHref(id, { modal: "create-meal" })} className={btnPrimary}>
            + Comida
          </Link>
        </div>
      </div>

      {modal === "create-meal" ? (
        <FormModalShell
          title="Agregar comida"
          eyebrow="Consumo real"
          description="Crea una nueva comida observada y luego completa texto o alimentos desde modales separados."
          closeHref={buildIntakeHref(id)}
          widthClassName="max-w-4xl"
        >
          <form action={addIntakeMealAction} className="grid gap-3 md:grid-cols-[auto_1fr_1.3fr_auto] md:items-end">
            <input type="hidden" name="intake_day_id" value={id} />
            <select name="meal_type_id" className={inputClass} required>
              {mealTypes.map((mealType) => (
                <option key={mealType.id} value={mealType.id}>{mealType.name}</option>
              ))}
            </select>
            <label className="text-sm font-medium text-slate-700">
              Nombre visible
              <input name="visible_name" className={inputClass} placeholder="Ej: Desayuno consumido" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Menú textual
              <input name="menu_text" className={inputClass} placeholder="Ej: café con leche, pan, huevo" />
            </label>
            <button type="submit" className={btnPrimary}>Guardar comida</button>
          </form>
        </FormModalShell>
      ) : null}

      {intakeMeals.map((meal) => {
        const mealType = mealTypesById.get(meal.meal_type_id);
        const target = mealType?.code ? mealTargetByCode.get(mealType.code) : null;
        const items = itemsMap[meal.id] ?? [];
        const mealTotals = {
          energy: items.reduce((sum, item) => sum + Number(item.energy_kcal ?? 0), 0),
          protein: items.reduce((sum, item) => sum + Number(item.protein_g ?? 0), 0),
          fat: items.reduce((sum, item) => sum + Number(item.fat_g ?? 0), 0),
          carbs: items.reduce((sum, item) => sum + Number(item.carbs_g ?? 0), 0),
        };
        const editingMeal = editMealId === meal.id;
        const addingItem = addItemMealId === meal.id;
        const editingItem = items.find((item) => item.id === editItemId) ?? null;

        return (
          <div key={meal.id} className="panel rounded-[2rem] p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-[#0f5c4d]">{meal.visible_name || mealType?.name || "Comida"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {mealType?.name ?? "Comida"} · {mealTotals.energy.toFixed(0)} kcal · P: {mealTotals.protein.toFixed(1)}g · G: {mealTotals.fat.toFixed(1)}g · C: {mealTotals.carbs.toFixed(1)}g
                </p>
                {meal.menu_text && <p className="mt-2 text-sm text-slate-600">{meal.menu_text}</p>}
                {target?.target_energy_kcal != null && (
                  <p className="mt-2 text-xs text-slate-500">
                    Meta referencial: {Number(target.target_energy_kcal).toFixed(0)} kcal
                    {target.energy_pct != null ? ` · ${(Number(target.energy_pct) * 100).toFixed(0)}% del día` : ""}
                    {` · Adecuación ${formatAdequacy(percentOf(mealTotals.energy, target.target_energy_kcal))}`}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <form action={updateMealStatusAction} className="flex gap-2 items-center">
                  <input type="hidden" name="intake_meal_id" value={meal.id} />
                  <input type="hidden" name="intake_day_id" value={id} />
                  <select name="status" defaultValue={meal.status} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs">
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <button type="submit" className="text-xs font-semibold text-[#0f5c4d] hover:underline">Actualizar</button>
                </form>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[meal.status] ?? "bg-slate-100 text-slate-500"}`}>
                  {statusLabels[meal.status] ?? meal.status}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-200 pt-4">
              <Link href={buildIntakeHref(id, { editMeal: meal.id })} className="rounded-full border border-[#0f5c4d]/20 bg-white px-4 py-2 text-sm font-semibold text-[#0f5c4d] hover:bg-[#f1f7f4]">
                Editar comida
              </Link>
              <Link href={buildIntakeHref(id, { addItemMeal: meal.id })} className="rounded-full border border-[#0f5c4d]/20 bg-white px-4 py-2 text-sm font-semibold text-[#0f5c4d] hover:bg-[#f1f7f4]">
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
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.consumed ? "bg-[#d6ebe3] text-[#0f5c4d]" : "bg-slate-200 text-slate-600"}`}>
                          {item.consumed ? "Consumido" : "No consumido"}
                        </span>
                        <Link href={buildIntakeHref(id, { editItem: item.id })} className="rounded-full border border-[#0f5c4d]/15 bg-[#d6ebe3] px-3 py-1.5 text-xs font-semibold text-[#0f5c4d]">
                          Editar
                        </Link>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                      <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Gramos: {Number(item.quantity_grams ?? 0).toFixed(0)}</div>
                      <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Kcal: {Number(item.energy_kcal ?? 0).toFixed(0)}</div>
                      <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Prot: {Number(item.protein_g ?? 0).toFixed(1)}</div>
                      <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2 col-span-2">Porción: {item.saved_portion_label ?? item.household_measure ?? "—"}</div>
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
                      <th className="pb-2 text-center">Consumido</th>
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
                        <td className="py-2 text-center">{item.consumed ? "✓" : "✗"}</td>
                        <td className="py-2 pl-3 text-right">
                          <Link href={buildIntakeHref(id, { editItem: item.id })} className="text-xs font-semibold text-[#0f5c4d] hover:underline">
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
                title={`Editar comida: ${meal.visible_name || mealType?.name || "Comida"}`}
                eyebrow="Consumo real"
                description="Ajusta nombre visible y menú textual de la comida observada sin salir del día de consumo."
                closeHref={buildIntakeHref(id)}
                widthClassName="max-w-4xl"
              >
                <form action={updateIntakeMealPresentationAction} className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto] md:items-end">
                  <input type="hidden" name="intake_meal_id" value={meal.id} />
                  <input type="hidden" name="intake_day_id" value={id} />
                  <label className="text-sm font-medium text-slate-700">
                    Nombre visible
                    <input name="visible_name" className={inputClass} defaultValue={meal.visible_name ?? ""} placeholder={mealType?.name} />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Menú textual
                    <input name="menu_text" className={inputClass} defaultValue={meal.menu_text ?? ""} placeholder="Describe lo realmente consumido" />
                  </label>
                  <button type="submit" className={btnPrimary}>Guardar comida</button>
                </form>
              </FormModalShell>
            ) : null}

            {addingItem ? (
              <FormModalShell
                title={`Agregar alimento a ${meal.visible_name || mealType?.name || "Comida"}`}
                eyebrow="Consumo real"
                description="Busca el alimento, elige porción o gramos manuales y agrégalo al registro observado."
                closeHref={buildIntakeHref(id)}
                widthClassName="max-w-5xl"
              >
                <form action={addIntakeItemAction} className="space-y-4">
                  <input type="hidden" name="intake_meal_id" value={meal.id} />
                  <input type="hidden" name="intake_day_id" value={id} />
                  <FoodSearchSelect name="alimento_id" quantityName="quantity_grams" dailyTargets={linkedPlanTargets} referenceTargets={linkedReferenceTargets} required />
                  <button type="submit" className={btnPrimary}>Agregar alimento</button>
                </form>
              </FormModalShell>
            ) : null}

            {editingItem ? (
              <FormModalShell
                title={`Editar alimento en ${meal.visible_name || mealType?.name || "Comida"}`}
                eyebrow="Consumo real"
                description="Modifica alimento, porción, gramos o marca si realmente fue consumido."
                closeHref={buildIntakeHref(id)}
                widthClassName="max-w-5xl"
              >
                <form action={updateIntakeItemAction} className="space-y-4">
                  <input type="hidden" name="item_id" value={editingItem.id} />
                  <input type="hidden" name="intake_meal_id" value={meal.id} />
                  <input type="hidden" name="intake_day_id" value={id} />
                  <FoodSearchSelect
                    name="alimento_id"
                    quantityName="quantity_grams"
                    dailyTargets={linkedPlanTargets}
                    referenceTargets={linkedReferenceTargets}
                    required
                    initialFoodId={editingItem.alimento_id}
                    initialFoodLabel={editingItem.alimento}
                    initialQuantityGrams={Number(editingItem.quantity_grams ?? 100)}
                    initialPortionId={editingItem.food_portion_id ?? null}
                    initialPortionMultiplier={editingItem.portion_multiplier ?? null}
                  />
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      name="consumed"
                      value="true"
                      defaultChecked={editingItem.consumed ?? true}
                      className="h-4 w-4 rounded border-slate-300 text-[#0f5c4d] focus:ring-[#0f5c4d]"
                    />
                    Marcar como consumido
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" className={btnPrimary}>Guardar cambios</button>
                    <Link href={buildIntakeHref(id)} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300">
                      Cancelar
                    </Link>
                  </div>
                </form>

                <form action={deleteIntakeItemAction} className="mt-4 border-t border-slate-200 pt-4">
                  <input type="hidden" name="item_id" value={editingItem.id} />
                  <input type="hidden" name="intake_meal_id" value={meal.id} />
                  <input type="hidden" name="intake_day_id" value={id} />
                  <button type="submit" className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100">
                    Eliminar alimento
                  </button>
                </form>
              </FormModalShell>
            ) : null}
          </div>
        );
      })}

      {!intakeMeals.length && (
        <div className="panel rounded-[2rem] p-8 text-center text-sm text-slate-500">
          Sin comidas registradas. Agrega una comida arriba para empezar a registrar consumo.
        </div>
      )}
    </main>
  );
}