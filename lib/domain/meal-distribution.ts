export const DEFAULT_MEAL_DISTRIBUTION: Record<string, number> = {
  breakfast: 0.2,
  mid_morning: 0.1,
  lunch: 0.3,
  mid_afternoon: 0.1,
  dinner: 0.3,
};

export function getMealDistributionPct(mealTypeCode?: string | null) {
  if (!mealTypeCode) return null;
  return DEFAULT_MEAL_DISTRIBUTION[mealTypeCode] ?? null;
}