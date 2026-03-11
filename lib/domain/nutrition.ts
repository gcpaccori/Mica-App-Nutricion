export type NutrientPortion = {
  energyKcal?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  carbsG?: number | null;
  fiberG?: number | null;
  sodiumMg?: number | null;
  grams: number;
};

function safeNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function scalePer100g(valuePer100g?: number | null, grams?: number | null) {
  return (safeNumber(valuePer100g) * safeNumber(grams)) / 100;
}

export function calculateBmi(weightKg?: number | null, heightM?: number | null) {
  const safeWeight = safeNumber(weightKg);
  const safeHeight = safeNumber(heightM);

  if (!safeWeight || !safeHeight) {
    return null;
  }

  return safeWeight / (safeHeight * safeHeight);
}

export function calculatePercentage(actual?: number | null, target?: number | null) {
  const safeTarget = safeNumber(target);

  if (!safeTarget) {
    return null;
  }

  return (safeNumber(actual) / safeTarget) * 100;
}

export function calculateWeightChangePercent(
  currentWeightKg?: number | null,
  referenceWeightKg?: number | null,
) {
  const current = safeNumber(currentWeightKg);
  const reference = safeNumber(referenceWeightKg);

  if (!current || !reference) {
    return null;
  }

  return ((current - reference) / reference) * 100;
}

export function calculateMealDistributionPct(
  mealEnergyKcal?: number | null,
  dayEnergyKcal?: number | null,
) {
  return calculatePercentage(mealEnergyKcal, dayEnergyKcal);
}

export function summarizeNutrition(items: NutrientPortion[]) {
  return items.reduce(
    (totals, item) => ({
      energyKcal: totals.energyKcal + scalePer100g(item.energyKcal, item.grams),
      proteinG: totals.proteinG + scalePer100g(item.proteinG, item.grams),
      fatG: totals.fatG + scalePer100g(item.fatG, item.grams),
      carbsG: totals.carbsG + scalePer100g(item.carbsG, item.grams),
      fiberG: totals.fiberG + scalePer100g(item.fiberG, item.grams),
      sodiumMg: totals.sodiumMg + scalePer100g(item.sodiumMg, item.grams),
    }),
    {
      energyKcal: 0,
      proteinG: 0,
      fatG: 0,
      carbsG: 0,
      fiberG: 0,
      sodiumMg: 0,
    },
  );
}