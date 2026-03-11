type Sex = "male" | "female" | "other";
type ActivityLevel = "sedentary" | "light" | "moderate" | "high" | "very_high";
type ReferenceTarget = {
  value: number;
  unit?: string | null;
  label?: string | null;
  valueType?: string | null;
  lifeStageLabel?: string | null;
};

type BmrRule = {
  sex: Exclude<Sex, "other">;
  ageMinYears: number;
  ageMaxYears: number | null;
  weightMultiplier: number;
  kcalConstant: number;
};

type ActivityRule = {
  code: ActivityLevel;
  label: string;
  factor: number;
};

export const BMR_RULES: BmrRule[] = [
  { sex: "male", ageMinYears: 0, ageMaxYears: 2, weightMultiplier: 60.9, kcalConstant: -54 },
  { sex: "female", ageMinYears: 0, ageMaxYears: 2, weightMultiplier: 61, kcalConstant: -51 },
  { sex: "male", ageMinYears: 3, ageMaxYears: 9, weightMultiplier: 22.7, kcalConstant: 495 },
  { sex: "female", ageMinYears: 3, ageMaxYears: 9, weightMultiplier: 22.5, kcalConstant: 499 },
  { sex: "male", ageMinYears: 10, ageMaxYears: 17, weightMultiplier: 17.5, kcalConstant: 651 },
  { sex: "female", ageMinYears: 10, ageMaxYears: 17, weightMultiplier: 12.2, kcalConstant: 746 },
  { sex: "male", ageMinYears: 18, ageMaxYears: 30, weightMultiplier: 15.06, kcalConstant: 692.2 },
  { sex: "female", ageMinYears: 18, ageMaxYears: 30, weightMultiplier: 14.8, kcalConstant: 486.6 },
  { sex: "male", ageMinYears: 31, ageMaxYears: 60, weightMultiplier: 11.4, kcalConstant: 873.1 },
  { sex: "female", ageMinYears: 31, ageMaxYears: 60, weightMultiplier: 8.13, kcalConstant: 845.6 },
  { sex: "male", ageMinYears: 61, ageMaxYears: null, weightMultiplier: 11.7, kcalConstant: 587.7 },
  { sex: "female", ageMinYears: 61, ageMaxYears: null, weightMultiplier: 9.08, kcalConstant: 658.5 },
];

export const ACTIVITY_RULES: ActivityRule[] = [
  { code: "sedentary", label: "Sedentaria", factor: 1.4 },
  { code: "light", label: "Ligera", factor: 1.55 },
  { code: "moderate", label: "Moderada", factor: 1.85 },
  { code: "high", label: "Alta", factor: 2.2 },
  { code: "very_high", label: "Muy alta", factor: 2.4 },
];

const DEFAULT_MACRO_SPLIT = {
  proteinPct: 0.1,
  carbsPct: 0.6,
  fatPct: 0.3,
};

export const MEAL_DISTRIBUTION = [
  { code: "breakfast", label: "Desayuno", pct: 0.2 },
  { code: "mid_morning", label: "Merienda 1", pct: 0.1 },
  { code: "lunch", label: "Almuerzo", pct: 0.3 },
  { code: "mid_afternoon", label: "Merienda 2", pct: 0.1 },
  { code: "dinner", label: "Cena", pct: 0.3 },
];

type ReferenceTargets = Partial<Record<string, ReferenceTarget>>;

export type NutritionCaseInput = {
  birthDate?: string | null;
  sex?: Sex | null;
  activityLevel?: ActivityLevel | null;
  weightKg?: number | null;
  referenceTargets?: ReferenceTargets;
};

export type NutritionCase = {
  ageYears: number;
  weightKg: number;
  activityLabel: string;
  activityFactorUsed: number;
  estimatedBmrKcal: number;
  estimatedEnergyRequirementKcal: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  proteinGramsPerKg: number;
  carbsGramsPerKg: number;
  fatGramsPerKg: number;
  fiberTargetG: number | null;
  sodiumTargetMg: number | null;
  calciumTargetMg: number | null;
  ironTargetMg: number | null;
  vitaminATargetUg: number | null;
  vitaminCTargetMg: number | null;
  mealTargets: Array<{ code: string; label: string; pct: number; targetKcal: number }>;
};

function getAgeYears(birthDate?: string | null) {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getReferenceValue(referenceTargets: ReferenceTargets | undefined, key: string) {
  const value = referenceTargets?.[key]?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildNutritionCase(input: NutritionCaseInput): NutritionCase | null {
  const ageYears = getAgeYears(input.birthDate);
  const weightKg = input.weightKg != null ? Number(input.weightKg) : null;

  if (!ageYears || ageYears < 0 || !weightKg || weightKg <= 0) {
    return null;
  }

  if (input.sex !== "male" && input.sex !== "female") {
    return null;
  }

  const rule = BMR_RULES.find(
    (candidate) =>
      candidate.sex === input.sex &&
      ageYears >= candidate.ageMinYears &&
      (candidate.ageMaxYears == null || ageYears <= candidate.ageMaxYears),
  );

  const activityRule = ACTIVITY_RULES.find((candidate) => candidate.code === (input.activityLevel ?? "sedentary")) ?? ACTIVITY_RULES[0];

  if (!rule) {
    return null;
  }

  const estimatedBmrKcal = round(rule.weightMultiplier * weightKg + rule.kcalConstant, 1);
  const estimatedEnergyRequirementKcal = round(estimatedBmrKcal * activityRule.factor, 0);
  const proteinGrams = round((estimatedEnergyRequirementKcal * DEFAULT_MACRO_SPLIT.proteinPct) / 4, 1);
  const carbsGrams = round((estimatedEnergyRequirementKcal * DEFAULT_MACRO_SPLIT.carbsPct) / 4, 1);
  const fatGrams = round((estimatedEnergyRequirementKcal * DEFAULT_MACRO_SPLIT.fatPct) / 9, 1);

  return {
    ageYears,
    weightKg,
    activityLabel: activityRule.label,
    activityFactorUsed: activityRule.factor,
    estimatedBmrKcal,
    estimatedEnergyRequirementKcal,
    proteinPct: DEFAULT_MACRO_SPLIT.proteinPct,
    carbsPct: DEFAULT_MACRO_SPLIT.carbsPct,
    fatPct: DEFAULT_MACRO_SPLIT.fatPct,
    proteinGrams,
    carbsGrams,
    fatGrams,
    proteinGramsPerKg: round(proteinGrams / weightKg, 2),
    carbsGramsPerKg: round(carbsGrams / weightKg, 2),
    fatGramsPerKg: round(fatGrams / weightKg, 2),
    fiberTargetG: getReferenceValue(input.referenceTargets, "fibra_alimentaria_g"),
    sodiumTargetMg: getReferenceValue(input.referenceTargets, "sodio_mg"),
    calciumTargetMg: getReferenceValue(input.referenceTargets, "calcio_mg"),
    ironTargetMg: getReferenceValue(input.referenceTargets, "hierro_mg"),
    vitaminATargetUg: getReferenceValue(input.referenceTargets, "vitamina_a_rae_ug"),
    vitaminCTargetMg: getReferenceValue(input.referenceTargets, "vitamina_c_mg"),
    mealTargets: MEAL_DISTRIBUTION.map((item) => ({
      ...item,
      targetKcal: round(estimatedEnergyRequirementKcal * item.pct, 1),
    })),
  };
}