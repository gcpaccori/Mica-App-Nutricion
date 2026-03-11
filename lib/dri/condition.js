const VALID_DRI_CONDITIONS = new Set(["pregnancy", "lactation"]);

export function normalizeDriCondition(value) {
  if (value == null) return null;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;

  return VALID_DRI_CONDITIONS.has(normalized) ? normalized : null;
}

export function getDriConditionLabel(value) {
  const normalized = normalizeDriCondition(value);
  if (normalized === "pregnancy") return "Embarazo";
  if (normalized === "lactation") return "Lactancia";
  return "General";
}