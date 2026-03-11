import { Buffer } from "node:buffer";

import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getPatientDriContext } from "@/lib/dri/server";
import { buildNutritionCase } from "@/lib/domain/nutrition-case";

type PlanDayRow = {
  id: string;
  day_number: number;
  label?: string | null;
};

type MealTargetRow = {
  sequence_no: number;
  meal_code: string;
  meal_label: string;
  energy_pct?: number | null;
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
};

type PlanMealRow = {
  meal_id: string;
  plan_day_id: string;
  plan_id: string;
  day_number: number;
  meal_type_code: string;
  meal_type_name: string;
  visible_name?: string | null;
  menu_text?: string | null;
  meal_target_pct?: number | null;
  meal_target_kcal?: number | null;
  meal_actual_kcal?: number | null;
  energy_adequacy_pct?: number | null;
  protein_adequacy_pct?: number | null;
  fat_adequacy_pct?: number | null;
  carbs_adequacy_pct?: number | null;
  fiber_adequacy_pct?: number | null;
  actual_protein_g?: number | null;
  actual_fat_g?: number | null;
  actual_carbs_g?: number | null;
  actual_fiber_g?: number | null;
  actual_sodium_mg?: number | null;
  actual_calcium_mg?: number | null;
  actual_iron_mg?: number | null;
  actual_vitamin_a_ug?: number | null;
  actual_vitamin_c_mg?: number | null;
};

type PlanItemRow = {
  meal_id: string;
  grupo_numero?: number | null;
  grupo_nombre?: string | null;
  alimento?: string | null;
  saved_portion_label?: string | null;
  household_measure?: string | null;
  household_quantity?: number | null;
  quantity_grams?: number | null;
  energy_kcal?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carbs_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  added_sugar_g?: number | null;
  sodium_mg?: number | null;
  potassium_mg?: number | null;
  calcium_mg?: number | null;
  iron_mg?: number | null;
  magnesium_mg?: number | null;
  zinc_mg?: number | null;
  niacin_mg?: number | null;
  folate_efd_ug?: number | null;
  vitamin_a_rae_ug?: number | null;
  vitamin_b12_ug?: number | null;
  vitamin_c_mg?: number | null;
  vitamin_d_ug?: number | null;
};

type DayAdequacyRow = {
  plan_day_id: string;
  plan_id: string;
  day_number: number;
  actual_energy_kcal?: number | null;
  actual_protein_g?: number | null;
  actual_fat_g?: number | null;
  actual_carbs_g?: number | null;
  actual_fiber_g?: number | null;
  actual_sodium_mg?: number | null;
  actual_calcium_mg?: number | null;
  actual_iron_mg?: number | null;
  actual_vitamin_a_ug?: number | null;
  actual_vitamin_c_mg?: number | null;
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
  energy_adequacy_pct?: number | null;
  protein_adequacy_pct?: number | null;
  fat_adequacy_pct?: number | null;
  carbs_adequacy_pct?: number | null;
  fiber_adequacy_pct?: number | null;
  calcium_adequacy_pct?: number | null;
  iron_adequacy_pct?: number | null;
  vitamin_a_adequacy_pct?: number | null;
  vitamin_c_adequacy_pct?: number | null;
};

type NumericTargetMap = {
  daily_energy_target_kcal?: number | null;
  daily_protein_target_g?: number | null;
  daily_fat_target_g?: number | null;
  daily_carbs_target_g?: number | null;
  daily_fiber_target_g?: number | null;
  daily_sodium_target_mg?: number | null;
};

type NutrientAccumulator = {
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  sugar_g: number;
  added_sugar_g: number;
  sodium_mg: number;
  potassium_mg: number;
  calcium_mg: number;
  iron_mg: number;
  magnesium_mg: number;
  zinc_mg: number;
  niacin_mg: number;
  folate_efd_ug: number;
  vitamin_a_rae_ug: number;
  vitamin_b12_ug: number;
  vitamin_c_mg: number;
  vitamin_d_ug: number;
};

const COLORS = {
  title: "FFD62CE0",
  section: "FFF4B0ED",
  subsection: "FFE9D7FA",
  softLilac: "FFF7ECFF",
  mealPct: "FF87F0D0",
  mealLabel: "FFE7C2F2",
  headerDark: "FF221F1F",
  tableHeader: "FFF1B3EC",
  subtotal: "FFBDEFE5",
  total: "FFFFB4B4",
  requirement: "FFFFFF83",
  adequacy: "FFFFD767",
  white: "FFFFFFFF",
  border: "FF6B7280",
  text: "FF111827",
  muted: "FF6B7280",
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } },
};

const NUTRIENT_HEADERS = [
  "%",
  "Comida",
  "Detalle menú",
  "Grupo",
  "Alimento",
  "Medida casera",
  "Peso neto (g)",
  "Kcal",
  "Prot (g)",
  "Grasa (g)",
  "CHO (g)",
  "Fibra (g)",
  "Az total (g)",
  "Az añad (g)",
  "Sodio (mg)",
  "Potasio (mg)",
  "Calcio (mg)",
  "Hierro (mg)",
  "Magnesio (mg)",
  "Zinc (mg)",
  "Niacina (mg)",
  "Folato (ug)",
  "Vit A (ug)",
  "Vit B12 (ug)",
  "Vit C (mg)",
  "Vit D (ug)",
] as const;

function numberOrNull(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return value;
}

function round(value?: number | null, digits = 1) {
  if (value == null || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
}

function safeText(value: unknown) {
  if (value == null) return "";
  return String(value);
}

function pct(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "";
  return `${Number(value).toFixed(0)}%`;
}

function mealLabelFromCode(code: string) {
  if (code === "breakfast") return "Desayuno";
  if (code === "mid_morning") return "Merienda 1";
  if (code === "lunch") return "Almuerzo";
  if (code === "mid_afternoon") return "Merienda 2";
  if (code === "dinner") return "Cena";
  return code;
}

function targetMapFromPlan(plan?: {
  daily_energy_target_kcal?: number | null;
  daily_protein_target_g?: number | null;
  daily_fat_target_g?: number | null;
  daily_carbs_target_g?: number | null;
  daily_fiber_target_g?: number | null;
  daily_sodium_target_mg?: number | null;
} | null): NumericTargetMap {
  return {
    daily_energy_target_kcal: plan?.daily_energy_target_kcal ?? null,
    daily_protein_target_g: plan?.daily_protein_target_g ?? null,
    daily_fat_target_g: plan?.daily_fat_target_g ?? null,
    daily_carbs_target_g: plan?.daily_carbs_target_g ?? null,
    daily_fiber_target_g: plan?.daily_fiber_target_g ?? null,
    daily_sodium_target_mg: plan?.daily_sodium_target_mg ?? null,
  };
}

function makeAccumulator(): NutrientAccumulator {
  return {
    energy_kcal: 0,
    protein_g: 0,
    fat_g: 0,
    carbs_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    added_sugar_g: 0,
    sodium_mg: 0,
    potassium_mg: 0,
    calcium_mg: 0,
    iron_mg: 0,
    magnesium_mg: 0,
    zinc_mg: 0,
    niacin_mg: 0,
    folate_efd_ug: 0,
    vitamin_a_rae_ug: 0,
    vitamin_b12_ug: 0,
    vitamin_c_mg: 0,
    vitamin_d_ug: 0,
  };
}

function sumPlanItems(items: PlanItemRow[]) {
  return items.reduce((acc, item) => {
    acc.energy_kcal += numberOrNull(item.energy_kcal) ?? 0;
    acc.protein_g += numberOrNull(item.protein_g) ?? 0;
    acc.fat_g += numberOrNull(item.fat_g) ?? 0;
    acc.carbs_g += numberOrNull(item.carbs_g) ?? 0;
    acc.fiber_g += numberOrNull(item.fiber_g) ?? 0;
    acc.sugar_g += numberOrNull(item.sugar_g) ?? 0;
    acc.added_sugar_g += numberOrNull(item.added_sugar_g) ?? 0;
    acc.sodium_mg += numberOrNull(item.sodium_mg) ?? 0;
    acc.potassium_mg += numberOrNull(item.potassium_mg) ?? 0;
    acc.calcium_mg += numberOrNull(item.calcium_mg) ?? 0;
    acc.iron_mg += numberOrNull(item.iron_mg) ?? 0;
    acc.magnesium_mg += numberOrNull(item.magnesium_mg) ?? 0;
    acc.zinc_mg += numberOrNull(item.zinc_mg) ?? 0;
    acc.niacin_mg += numberOrNull(item.niacin_mg) ?? 0;
    acc.folate_efd_ug += numberOrNull(item.folate_efd_ug) ?? 0;
    acc.vitamin_a_rae_ug += numberOrNull(item.vitamin_a_rae_ug) ?? 0;
    acc.vitamin_b12_ug += numberOrNull(item.vitamin_b12_ug) ?? 0;
    acc.vitamin_c_mg += numberOrNull(item.vitamin_c_mg) ?? 0;
    acc.vitamin_d_ug += numberOrNull(item.vitamin_d_ug) ?? 0;
    return acc;
  }, makeAccumulator());
}

function applyCellStyle(cell: ExcelJS.Cell, style: {
  fillColor?: string;
  bold?: boolean;
  fontSize?: number;
  align?: Partial<ExcelJS.Alignment>;
  border?: Partial<ExcelJS.Borders>;
  color?: string;
  numFmt?: string;
}) {
  if (style.fillColor) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: style.fillColor },
    };
  }

  cell.font = {
    name: "Arial",
    size: style.fontSize ?? 10,
    bold: style.bold ?? false,
    color: { argb: style.color ?? COLORS.text },
  };
  cell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
    ...style.align,
  };
  cell.border = style.border ?? THIN_BORDER;
  if (style.numFmt) cell.numFmt = style.numFmt;
}

function paintRange(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  style: Parameters<typeof applyCellStyle>[1],
) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      applyCellStyle(sheet.getCell(row, col), style);
    }
  }
}

function mergeTitle(
  sheet: ExcelJS.Worksheet,
  row: number,
  startCol: number,
  endCol: number,
  value: string,
  fillColor: string,
  fontSize = 11,
  color = COLORS.text,
) {
  sheet.mergeCells(row, startCol, row, endCol);
  const cell = sheet.getCell(row, startCol);
  cell.value = value;
  paintRange(sheet, row, startCol, row, endCol, {
    fillColor,
    bold: true,
    fontSize,
    color,
    align: { vertical: "middle", horizontal: "center", wrapText: true },
  });
}

function writeInfoBox(
  sheet: ExcelJS.Worksheet,
  row: number,
  startCol: number,
  endCol: number,
  label: string,
  value: string,
) {
  sheet.mergeCells(row, startCol, row, endCol);
  sheet.mergeCells(row + 1, startCol, row + 1, endCol);
  sheet.getCell(row, startCol).value = label;
  sheet.getCell(row + 1, startCol).value = value;

  paintRange(sheet, row, startCol, row, endCol, {
    fillColor: COLORS.subsection,
    bold: true,
    fontSize: 10,
    align: { vertical: "middle", horizontal: "left", wrapText: true },
  });
  paintRange(sheet, row + 1, startCol, row + 1, endCol, {
    fillColor: COLORS.white,
    fontSize: 10,
    align: { vertical: "middle", horizontal: "left", wrapText: true },
  });
}

function writeMetricBox(
  sheet: ExcelJS.Worksheet,
  row: number,
  startCol: number,
  endCol: number,
  title: string,
  entries: Array<[string, string]>,
) {
  mergeTitle(sheet, row, startCol, endCol, title, COLORS.section);
  let currentRow = row + 1;

  for (const [label, value] of entries) {
    sheet.mergeCells(currentRow, startCol, currentRow, startCol + 2);
    sheet.mergeCells(currentRow, startCol + 3, currentRow, endCol);
    sheet.getCell(currentRow, startCol).value = label;
    sheet.getCell(currentRow, startCol + 3).value = value;
    paintRange(sheet, currentRow, startCol, currentRow, startCol + 2, {
      fillColor: COLORS.softLilac,
      bold: true,
      align: { vertical: "middle", horizontal: "left", wrapText: true },
    });
    paintRange(sheet, currentRow, startCol + 3, currentRow, endCol, {
      fillColor: COLORS.white,
      align: { vertical: "middle", horizontal: "right", wrapText: true },
    });
    currentRow += 1;
  }
}

function writeTableHeader(sheet: ExcelJS.Worksheet, row: number, labels: readonly string[]) {
  labels.forEach((label, index) => {
    const cell = sheet.getCell(row, index + 1);
    cell.value = label;
    applyCellStyle(cell, {
      fillColor: COLORS.tableHeader,
      bold: true,
      fontSize: 9,
      align: { vertical: "middle", horizontal: "center", wrapText: true },
    });
  });
  sheet.getRow(row).height = 24;
}

function writeValueRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  values: Array<string | number>,
  fillColor = COLORS.white,
  bold = false,
) {
  values.forEach((value, index) => {
    const cell = sheet.getCell(row, index + 1);
    cell.value = value;
    applyCellStyle(cell, {
      fillColor,
      bold,
      fontSize: 9,
      align: { vertical: "middle", horizontal: typeof value === "number" ? "right" : "left", wrapText: true },
      numFmt: typeof value === "number" ? "0.0" : undefined,
    });
  });
}

function macroPct(grams?: number | null, energyKcal?: number | null, kcalFactor = 4) {
  if (!grams || !energyKcal) return null;
  return ((grams * kcalFactor) / energyKcal) * 100;
}

function groupedMap<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = map.get(key(row)) ?? [];
    bucket.push(row);
    map.set(key(row), bucket);
  }
  return map;
}

export async function getPatientWorkbookSnapshot(supabase: SupabaseClient, patientId: string) {
  const [
    { data: patient },
    { data: measurements },
    { data: assessments },
    { data: goals },
    { data: plans },
    { data: nutritionCases },
    { data: dailyComparisons },
  ] = await Promise.all([
    supabase.from("patients").select("*").eq("id", patientId).maybeSingle(),
    supabase.from("patient_measurements").select("*").eq("patient_id", patientId).order("measured_at", { ascending: false }),
    supabase.from("patient_assessments").select("*").eq("patient_id", patientId).order("assessed_at", { ascending: false }),
    supabase.from("patient_goals").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
    supabase.from("diet_plans").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
    supabase.from("nutrition_plan_case_v").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
    supabase.from("daily_plan_vs_intake_v").select("*").eq("patient_id", patientId).order("intake_date", { ascending: false }).limit(30),
  ]);

  if (!patient) return null;

  const latestMeasurement = measurements?.[0] ?? null;
  const latestAssessment = assessments?.[0] ?? null;
  const latestGoal = goals?.find((goal) => goal.is_active) ?? goals?.[0] ?? null;
  const latestPlan = plans?.find((plan) => plan.status === "active") ?? plans?.[0] ?? null;
  const latestComparison = dailyComparisons?.[0] ?? null;
  const latestPlanCase = latestPlan?.nutrition_plan_id
    ? (nutritionCases ?? []).find((planCase) => planCase.nutrition_plan_id === latestPlan.nutrition_plan_id) ?? null
    : null;

  const baseTargets = latestPlanCase
    ? {
        daily_energy_target_kcal: latestPlanCase.target_energy_kcal ?? null,
        daily_protein_target_g: latestPlanCase.protein_target_g ?? null,
        daily_fat_target_g: latestPlanCase.fat_target_g ?? null,
        daily_carbs_target_g: latestPlanCase.carbs_target_g ?? null,
        daily_fiber_target_g: latestPlanCase.fiber_target_g ?? null,
        daily_sodium_target_mg: latestPlanCase.sodium_target_mg ?? null,
      }
    : targetMapFromPlan(latestPlan);

  const {
    effectiveDailyTargets,
    referenceTargets,
    resolvedCondition,
    referenceLifeStageLabel,
  } = await getPatientDriContext(supabase, patientId, baseTargets);

  const nutritionCase = buildNutritionCase({
    birthDate: patient.birth_date,
    sex: patient.sex,
    activityLevel: patient.activity_level,
    weightKg: latestMeasurement?.weight_kg ? Number(latestMeasurement.weight_kg) : null,
    referenceTargets,
  });

  let planDays: PlanDayRow[] = [];
  let mealTargets: MealTargetRow[] = [];
  let dayAdequacyRows: DayAdequacyRow[] = [];
  let planMeals: PlanMealRow[] = [];
  let planItems: PlanItemRow[] = [];

  if (latestPlan) {
    const [daysResult, mealTargetsResult, dayAdequacyResult, mealRowsResult] = await Promise.all([
      supabase.from("diet_plan_days").select("id, day_number, label").eq("plan_id", latestPlan.id).order("day_number"),
      latestPlan.nutrition_plan_id
        ? supabase.from("nutrition_plan_meal_target_v").select("*").eq("nutrition_plan_id", latestPlan.nutrition_plan_id).order("sequence_no")
        : Promise.resolve({ data: [] }),
      supabase.from("diet_plan_day_adequacy_v").select("*").eq("plan_id", latestPlan.id).order("day_number"),
      supabase.from("diet_meal_adequacy_v").select("*").eq("plan_id", latestPlan.id).order("day_number"),
    ]);

    planDays = (daysResult.data ?? []) as PlanDayRow[];
    mealTargets = (mealTargetsResult.data ?? []) as MealTargetRow[];
    dayAdequacyRows = (dayAdequacyResult.data ?? []) as DayAdequacyRow[];
    planMeals = (mealRowsResult.data ?? []) as PlanMealRow[];

    if (planMeals.length) {
      const itemRows = await supabase
        .from("diet_meal_item_nutrients_v")
        .select("meal_id, grupo_numero, grupo_nombre, alimento, saved_portion_label, household_measure, household_quantity, quantity_grams, energy_kcal, protein_g, fat_g, carbs_g, fiber_g, sugar_g, added_sugar_g, sodium_mg, potassium_mg, calcium_mg, iron_mg, magnesium_mg, zinc_mg, niacin_mg, folate_efd_ug, vitamin_a_rae_ug, vitamin_b12_ug, vitamin_c_mg, vitamin_d_ug")
        .in("meal_id", planMeals.map((meal) => meal.meal_id));

      planItems = (itemRows.data ?? []) as PlanItemRow[];
    }
  }

  return {
    patient,
    latestMeasurement,
    latestAssessment,
    latestGoal,
    latestPlan,
    latestPlanCase,
    latestComparison,
    measurements: measurements ?? [],
    goals: goals ?? [],
    effectiveDailyTargets,
    referenceTargets,
    resolvedCondition,
    referenceLifeStageLabel,
    nutritionCase,
    planDays,
    mealTargets,
    dayAdequacyRows,
    planMeals,
    planItems,
  };
}

export async function buildPatientWorkbook(snapshot: NonNullable<Awaited<ReturnType<typeof getPatientWorkbookSnapshot>>>) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GitHub Copilot";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Ficha clínica", {
    views: [{ state: "frozen", ySplit: 2 }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.35,
        bottom: 0.35,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  sheet.columns = [
    { width: 8 },
    { width: 18 },
    { width: 28 },
    { width: 15 },
    { width: 24 },
    { width: 15 },
    { width: 11 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 12 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
  ];

  const weightKg = numberOrNull(snapshot.latestMeasurement?.weight_kg) ?? snapshot.nutritionCase?.weightKg ?? null;
  const energyTarget = numberOrNull(snapshot.effectiveDailyTargets.daily_energy_target_kcal);
  const proteinTarget = numberOrNull(snapshot.effectiveDailyTargets.daily_protein_target_g);
  const fatTarget = numberOrNull(snapshot.effectiveDailyTargets.daily_fat_target_g);
  const carbsTarget = numberOrNull(snapshot.effectiveDailyTargets.daily_carbs_target_g);
  const fiberTarget = numberOrNull(snapshot.effectiveDailyTargets.daily_fiber_target_g);
  const sodiumTarget = numberOrNull(snapshot.effectiveDailyTargets.daily_sodium_target_mg);

  const mealTargets = snapshot.mealTargets.length
    ? snapshot.mealTargets
    : (snapshot.nutritionCase?.mealTargets ?? []).map((meal, index) => ({
        sequence_no: index + 1,
        meal_code: meal.code,
        meal_label: meal.label,
        energy_pct: meal.pct,
        target_energy_kcal: meal.targetKcal,
        target_protein_g: proteinTarget != null ? proteinTarget * meal.pct : null,
        target_fat_g: fatTarget != null ? fatTarget * meal.pct : null,
        target_carbs_g: carbsTarget != null ? carbsTarget * meal.pct : null,
        target_fiber_g: fiberTarget != null ? fiberTarget * meal.pct : null,
        target_sodium_mg: sodiumTarget != null ? sodiumTarget * meal.pct : null,
        target_calcium_mg: null,
        target_iron_mg: null,
        target_vitamin_a_ug: null,
        target_vitamin_c_mg: null,
      }));

  const mealsByDayId = groupedMap(snapshot.planMeals, (meal) => meal.plan_day_id);
  const itemsByMealId = groupedMap(snapshot.planItems, (item) => item.meal_id);
  const dayAdequacyByDayId = new Map(snapshot.dayAdequacyRows.map((day) => [day.plan_day_id, day]));
  const mealTargetByCode = new Map(mealTargets.map((target) => [target.meal_code, target]));
  const mealSortOrder = new Map(mealTargets.map((target) => [target.meal_code, target.sequence_no]));

  let row = 1;

  mergeTitle(sheet, row, 1, 26, "FICHA DE PLANIFICACIÓN NUTRICIONAL", COLORS.title, 15);
  row += 1;
  sheet.mergeCells(row, 1, row, 26);
  sheet.getCell(row, 1).value = `Paciente: ${snapshot.patient.first_name} ${snapshot.patient.last_name} · Plan: ${snapshot.latestPlan?.name ?? "Sin plan activo"} · Exportado: ${new Date().toLocaleDateString("es-PE")}`;
  paintRange(sheet, row, 1, row, 26, {
    fillColor: COLORS.softLilac,
    fontSize: 10,
    align: { vertical: "middle", horizontal: "center", wrapText: true },
  });
  row += 2;

  mergeTitle(sheet, row, 1, 26, "DATOS", COLORS.section, 12);
  row += 1;
  writeInfoBox(sheet, row, 1, 6, "Paciente", `${snapshot.patient.first_name} ${snapshot.patient.last_name}`);
  writeInfoBox(sheet, row, 7, 10, "Documento", safeText(snapshot.patient.document_number));
  writeInfoBox(sheet, row, 11, 14, "Sexo", safeText(snapshot.patient.sex));
  writeInfoBox(sheet, row, 15, 18, "Nacimiento", safeText(snapshot.patient.birth_date));
  writeInfoBox(sheet, row, 19, 22, "Actividad", safeText(snapshot.patient.activity_level));
  writeInfoBox(sheet, row, 23, 26, "Condición", safeText(snapshot.resolvedCondition ?? "general"));
  row += 3;
  writeInfoBox(sheet, row, 1, 6, "Peso actual", weightKg != null ? `${round(weightKg)} kg` : "Pendiente");
  writeInfoBox(sheet, row, 7, 10, "Talla", snapshot.latestMeasurement?.height_m ? `${Number(snapshot.latestMeasurement.height_m).toFixed(2)} m` : "Pendiente");
  writeInfoBox(sheet, row, 11, 14, "IMC", snapshot.latestMeasurement?.bmi ? Number(snapshot.latestMeasurement.bmi).toFixed(1) : "Pendiente");
  writeInfoBox(sheet, row, 15, 18, "Última medición", safeText(snapshot.latestMeasurement?.measured_at));
  writeInfoBox(sheet, row, 19, 22, "Objetivo activo", safeText(snapshot.latestGoal?.goal_type?.replaceAll("_", " ")));
  writeInfoBox(sheet, row, 23, 26, "Etapa DRI", safeText(snapshot.referenceLifeStageLabel));
  row += 4;

  mergeTitle(sheet, row, 1, 26, "1 CÁLCULO DEL REQUERIMIENTO NUTRICIONAL", COLORS.section, 12);
  row += 1;
  writeMetricBox(sheet, row, 1, 8, "PASO 1 energía", [
    ["TMB", snapshot.nutritionCase?.estimatedBmrKcal != null ? `${snapshot.nutritionCase.estimatedBmrKcal.toFixed(0)} kcal` : "Pendiente"],
    ["Factor actividad", snapshot.nutritionCase?.activityFactorUsed != null ? snapshot.nutritionCase.activityFactorUsed.toFixed(2) : safeText(snapshot.patient.activity_level)],
    ["Requerimiento", energyTarget != null ? `${energyTarget.toFixed(0)} kcal` : "Pendiente"],
    ["Fuente", snapshot.latestPlanCase?.label ?? snapshot.latestPlan?.name ?? "Caso clínico / DRI"],
  ]);
  writeMetricBox(sheet, row, 9, 16, "PASO 2 proteína", [
    ["Proteína objetivo", proteinTarget != null ? `${proteinTarget.toFixed(1)} g` : "Pendiente"],
    ["Proteína g/kg", proteinTarget != null && weightKg ? (proteinTarget / weightKg).toFixed(2) : "Pendiente"],
    ["Grasa objetivo", fatTarget != null ? `${fatTarget.toFixed(1)} g` : "Pendiente"],
    ["Carbohidrato objetivo", carbsTarget != null ? `${carbsTarget.toFixed(1)} g` : "Pendiente"],
  ]);
  writeMetricBox(sheet, row, 17, 26, "PASO 3 micronutrientes", [
    ["Fibra", fiberTarget != null ? `${fiberTarget.toFixed(1)} g` : "Pendiente"],
    ["Sodio", sodiumTarget != null ? `${sodiumTarget.toFixed(0)} mg` : "Pendiente"],
    ["Calcio", snapshot.referenceTargets.calcio_mg?.value != null ? `${Number(snapshot.referenceTargets.calcio_mg.value).toFixed(0)} mg` : "Pendiente"],
    ["Hierro", snapshot.referenceTargets.hierro_mg?.value != null ? `${Number(snapshot.referenceTargets.hierro_mg.value).toFixed(1)} mg` : "Pendiente"],
    ["Vitamina A", snapshot.referenceTargets.vitamina_a_rae_ug?.value != null ? `${Number(snapshot.referenceTargets.vitamina_a_rae_ug.value).toFixed(0)} ug` : "Pendiente"],
    ["Vitamina C", snapshot.referenceTargets.vitamina_c_mg?.value != null ? `${Number(snapshot.referenceTargets.vitamina_c_mg.value).toFixed(0)} mg` : "Pendiente"],
  ]);
  row += 7;

  mergeTitle(sheet, row, 1, 26, "2 DISTRIBUCIÓN DE MACRONUTRIENTES", COLORS.section, 12);
  row += 1;
  writeTableHeader(sheet, row, ["Macro", "% kcal", "g/día", "g/kg", "kcal aportadas"]);
  row += 1;
  writeValueRow(sheet, row, [
    "Proteína",
    pct(macroPct(proteinTarget, energyTarget, 4)),
    round(proteinTarget) ?? "",
    proteinTarget != null && weightKg ? round(proteinTarget / weightKg, 2) ?? "" : "",
    proteinTarget != null ? round(proteinTarget * 4) ?? "" : "",
  ]);
  row += 1;
  writeValueRow(sheet, row, [
    "Grasa",
    pct(macroPct(fatTarget, energyTarget, 9)),
    round(fatTarget) ?? "",
    fatTarget != null && weightKg ? round(fatTarget / weightKg, 2) ?? "" : "",
    fatTarget != null ? round(fatTarget * 9) ?? "" : "",
  ]);
  row += 1;
  writeValueRow(sheet, row, [
    "Carbohidratos",
    pct(macroPct(carbsTarget, energyTarget, 4)),
    round(carbsTarget) ?? "",
    carbsTarget != null && weightKg ? round(carbsTarget / weightKg, 2) ?? "" : "",
    carbsTarget != null ? round(carbsTarget * 4) ?? "" : "",
  ]);
  row += 3;

  mergeTitle(sheet, row, 1, 26, "3 DISTRIBUCIÓN CALÓRICA POR COMIDAS", COLORS.section, 12);
  row += 1;
  writeTableHeader(sheet, row, [
    "Sec.",
    "Comida",
    "% energía",
    "Kcal meta",
    "Prot meta",
    "Grasa meta",
    "CHO meta",
    "Fibra meta",
    "Sodio meta",
    "Calcio meta",
    "Hierro meta",
    "Vit A meta",
    "Vit C meta",
  ]);
  row += 1;
  for (const target of mealTargets) {
    writeValueRow(sheet, row, [
      target.sequence_no,
      target.meal_label ?? mealLabelFromCode(target.meal_code),
      pct(target.energy_pct != null ? target.energy_pct * 100 : null),
      round(target.target_energy_kcal) ?? "",
      round(target.target_protein_g) ?? "",
      round(target.target_fat_g) ?? "",
      round(target.target_carbs_g) ?? "",
      round(target.target_fiber_g) ?? "",
      round(target.target_sodium_mg, 0) ?? "",
      round(target.target_calcium_mg, 0) ?? "",
      round(target.target_iron_mg) ?? "",
      round(target.target_vitamin_a_ug, 0) ?? "",
      round(target.target_vitamin_c_mg, 0) ?? "",
    ]);
    row += 1;
  }
  row += 2;

  mergeTitle(sheet, row, 1, 26, "4 MENÚ (VARIOS DÍAS)", COLORS.section, 12);
  row += 1;
  mergeTitle(sheet, row, 1, 26, "5 COMPOSICIÓN NUTRICIONAL · ALIMENTOS POR COMIDA · SUBTOTAL POR COMIDA · TOTAL DEL DÍA · REQUERIMIENTO · % ADECUACIÓN", COLORS.subsection, 10);
  row += 2;

  if (!snapshot.planDays.length) {
    mergeTitle(sheet, row, 1, 26, "No existe un plan con días cuantificados para exportar el menú.", COLORS.requirement, 11);
    row += 2;
  }

  for (const day of snapshot.planDays) {
    const dayMeals = [...(mealsByDayId.get(day.id) ?? [])].sort(
      (left, right) => (mealSortOrder.get(left.meal_type_code) ?? 999) - (mealSortOrder.get(right.meal_type_code) ?? 999),
    );
    const dayAdequacy = dayAdequacyByDayId.get(day.id) ?? null;

    mergeTitle(sheet, row, 1, 26, `DÍA ${day.day_number}${day.label ? ` · ${day.label}` : ""}`, COLORS.headerDark, 11, COLORS.white);
    row += 1;
    writeTableHeader(sheet, row, NUTRIENT_HEADERS);
    row += 1;

    if (!dayMeals.length) {
      sheet.mergeCells(row, 1, row, 26);
      sheet.getCell(row, 1).value = "Día sin comidas cargadas todavía.";
      paintRange(sheet, row, 1, row, 26, {
        fillColor: COLORS.white,
        align: { vertical: "middle", horizontal: "left", wrapText: true },
      });
      row += 2;
      continue;
    }

    for (const meal of dayMeals) {
      const items = itemsByMealId.get(meal.meal_id) ?? [];
      const target = mealTargetByCode.get(meal.meal_type_code) ?? null;
      const mealStartRow = row;
      const mealRows = Math.max(items.length, 1);

      for (let index = 0; index < mealRows; index += 1) {
        const item = items[index];
        writeValueRow(sheet, row, [
          "",
          "",
          "",
          item?.grupo_nombre ?? "",
          item?.alimento ?? "",
          item?.saved_portion_label ?? item?.household_measure ?? "",
          round(item?.quantity_grams) ?? "",
          round(item?.energy_kcal) ?? "",
          round(item?.protein_g) ?? "",
          round(item?.fat_g) ?? "",
          round(item?.carbs_g) ?? "",
          round(item?.fiber_g) ?? "",
          round(item?.sugar_g) ?? "",
          round(item?.added_sugar_g) ?? "",
          round(item?.sodium_mg, 0) ?? "",
          round(item?.potassium_mg, 0) ?? "",
          round(item?.calcium_mg, 0) ?? "",
          round(item?.iron_mg) ?? "",
          round(item?.magnesium_mg, 0) ?? "",
          round(item?.zinc_mg) ?? "",
          round(item?.niacin_mg) ?? "",
          round(item?.folate_efd_ug, 0) ?? "",
          round(item?.vitamin_a_rae_ug, 0) ?? "",
          round(item?.vitamin_b12_ug, 2) ?? "",
          round(item?.vitamin_c_mg) ?? "",
          round(item?.vitamin_d_ug, 2) ?? "",
        ]);
        row += 1;
      }

      const mealEndRow = row - 1;
      const mealName = meal.visible_name ?? meal.meal_type_name ?? mealLabelFromCode(meal.meal_type_code);
      const menuText = meal.menu_text ?? target?.meal_label ?? "";
      sheet.mergeCells(mealStartRow, 1, mealEndRow, 1);
      sheet.mergeCells(mealStartRow, 2, mealEndRow, 2);
      sheet.mergeCells(mealStartRow, 3, mealEndRow, 3);
      sheet.getCell(mealStartRow, 1).value = pct((meal.meal_target_pct ?? target?.energy_pct ?? null) != null ? Number(meal.meal_target_pct ?? target?.energy_pct ?? 0) * 100 : null);
      sheet.getCell(mealStartRow, 2).value = mealName;
      sheet.getCell(mealStartRow, 3).value = menuText;
      paintRange(sheet, mealStartRow, 1, mealEndRow, 1, {
        fillColor: COLORS.mealPct,
        bold: true,
        align: { vertical: "middle", horizontal: "center", wrapText: true },
      });
      paintRange(sheet, mealStartRow, 2, mealEndRow, 2, {
        fillColor: COLORS.mealLabel,
        bold: true,
        align: { vertical: "middle", horizontal: "center", wrapText: true },
      });
      paintRange(sheet, mealStartRow, 3, mealEndRow, 3, {
        fillColor: COLORS.softLilac,
        align: { vertical: "middle", horizontal: "left", wrapText: true },
      });

      const computedMealTotals = sumPlanItems(items);
      sheet.mergeCells(row, 1, row, 6);
      sheet.getCell(row, 1).value = `SUBTOTAL POR COMIDA · ${mealName}`;
      paintRange(sheet, row, 1, row, 6, {
        fillColor: COLORS.subtotal,
        bold: true,
        align: { vertical: "middle", horizontal: "left", wrapText: true },
      });
      [
        round(meal.meal_actual_kcal ?? computedMealTotals.energy_kcal) ?? "",
        round(meal.actual_protein_g ?? computedMealTotals.protein_g) ?? "",
        round(meal.actual_fat_g ?? computedMealTotals.fat_g) ?? "",
        round(meal.actual_carbs_g ?? computedMealTotals.carbs_g) ?? "",
        round(meal.actual_fiber_g ?? computedMealTotals.fiber_g) ?? "",
        round(computedMealTotals.sugar_g) ?? "",
        round(computedMealTotals.added_sugar_g) ?? "",
        round(meal.actual_sodium_mg ?? computedMealTotals.sodium_mg, 0) ?? "",
        round(computedMealTotals.potassium_mg, 0) ?? "",
        round(meal.actual_calcium_mg ?? computedMealTotals.calcium_mg, 0) ?? "",
        round(meal.actual_iron_mg ?? computedMealTotals.iron_mg) ?? "",
        round(computedMealTotals.magnesium_mg, 0) ?? "",
        round(computedMealTotals.zinc_mg) ?? "",
        round(computedMealTotals.niacin_mg) ?? "",
        round(computedMealTotals.folate_efd_ug, 0) ?? "",
        round(meal.actual_vitamin_a_ug ?? computedMealTotals.vitamin_a_rae_ug, 0) ?? "",
        round(computedMealTotals.vitamin_b12_ug, 2) ?? "",
        round(meal.actual_vitamin_c_mg ?? computedMealTotals.vitamin_c_mg) ?? "",
        round(computedMealTotals.vitamin_d_ug, 2) ?? "",
      ].forEach((value, index) => {
        const col = index + 8;
        const cell = sheet.getCell(row, col);
        cell.value = value;
        applyCellStyle(cell, {
          fillColor: COLORS.subtotal,
          bold: true,
          align: { vertical: "middle", horizontal: "right", wrapText: true },
          numFmt: typeof value === "number" ? "0.0" : undefined,
        });
      });
      row += 1;
    }

    sheet.mergeCells(row, 1, row, 6);
    sheet.getCell(row, 1).value = "TOTAL DEL DÍA";
    paintRange(sheet, row, 1, row, 6, {
      fillColor: COLORS.total,
      bold: true,
      align: { vertical: "middle", horizontal: "left", wrapText: true },
    });
    [
      round(dayAdequacy?.actual_energy_kcal) ?? "",
      round(dayAdequacy?.actual_protein_g) ?? "",
      round(dayAdequacy?.actual_fat_g) ?? "",
      round(dayAdequacy?.actual_carbs_g) ?? "",
      round(dayAdequacy?.actual_fiber_g) ?? "",
      "",
      "",
      round(dayAdequacy?.actual_sodium_mg, 0) ?? "",
      "",
      round(dayAdequacy?.actual_calcium_mg, 0) ?? "",
      round(dayAdequacy?.actual_iron_mg) ?? "",
      "",
      "",
      "",
      "",
      round(dayAdequacy?.actual_vitamin_a_ug, 0) ?? "",
      "",
      round(dayAdequacy?.actual_vitamin_c_mg) ?? "",
      "",
    ].forEach((value, index) => {
      const col = index + 8;
      const cell = sheet.getCell(row, col);
      cell.value = value;
      applyCellStyle(cell, {
        fillColor: COLORS.total,
        bold: true,
        align: { vertical: "middle", horizontal: "right", wrapText: true },
        numFmt: typeof value === "number" ? "0.0" : undefined,
      });
    });
    row += 1;

    sheet.mergeCells(row, 1, row, 6);
    sheet.getCell(row, 1).value = "REQUERIMIENTO";
    paintRange(sheet, row, 1, row, 6, {
      fillColor: COLORS.requirement,
      bold: true,
      align: { vertical: "middle", horizontal: "left", wrapText: true },
    });
    [
      round(dayAdequacy?.target_energy_kcal ?? energyTarget) ?? "",
      round(dayAdequacy?.protein_target_g ?? proteinTarget) ?? "",
      round(dayAdequacy?.fat_target_g ?? fatTarget) ?? "",
      round(dayAdequacy?.carbs_target_g ?? carbsTarget) ?? "",
      round(dayAdequacy?.fiber_target_g ?? fiberTarget) ?? "",
      "",
      "",
      round(dayAdequacy?.sodium_target_mg ?? sodiumTarget, 0) ?? "",
      "",
      round(dayAdequacy?.calcium_target_mg ?? snapshot.referenceTargets.calcio_mg?.value, 0) ?? "",
      round(dayAdequacy?.iron_target_mg ?? snapshot.referenceTargets.hierro_mg?.value) ?? "",
      "",
      "",
      "",
      "",
      round(dayAdequacy?.vitamin_a_target_ug ?? snapshot.referenceTargets.vitamina_a_rae_ug?.value, 0) ?? "",
      "",
      round(dayAdequacy?.vitamin_c_target_mg ?? snapshot.referenceTargets.vitamina_c_mg?.value) ?? "",
      "",
    ].forEach((value, index) => {
      const col = index + 8;
      const cell = sheet.getCell(row, col);
      cell.value = value;
      applyCellStyle(cell, {
        fillColor: COLORS.requirement,
        bold: true,
        align: { vertical: "middle", horizontal: "right", wrapText: true },
        numFmt: typeof value === "number" ? "0.0" : undefined,
      });
    });
    row += 1;

    sheet.mergeCells(row, 1, row, 6);
    sheet.getCell(row, 1).value = "% ADECUACIÓN";
    paintRange(sheet, row, 1, row, 6, {
      fillColor: COLORS.adequacy,
      bold: true,
      align: { vertical: "middle", horizontal: "left", wrapText: true },
    });
    [
      pct(dayAdequacy?.energy_adequacy_pct),
      pct(dayAdequacy?.protein_adequacy_pct),
      pct(dayAdequacy?.fat_adequacy_pct),
      pct(dayAdequacy?.carbs_adequacy_pct),
      pct(dayAdequacy?.fiber_adequacy_pct),
      "",
      "",
      "",
      "",
      pct(dayAdequacy?.calcium_adequacy_pct),
      pct(dayAdequacy?.iron_adequacy_pct),
      "",
      "",
      "",
      "",
      pct(dayAdequacy?.vitamin_a_adequacy_pct),
      "",
      pct(dayAdequacy?.vitamin_c_adequacy_pct),
      "",
    ].forEach((value, index) => {
      const col = index + 8;
      const cell = sheet.getCell(row, col);
      cell.value = value;
      applyCellStyle(cell, {
        fillColor: COLORS.adequacy,
        bold: true,
        align: { vertical: "middle", horizontal: "center", wrapText: true },
      });
    });
    row += 2;
  }

  sheet.getRow(1).height = 22;
  sheet.getRow(2).height = 18;
  const output = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}