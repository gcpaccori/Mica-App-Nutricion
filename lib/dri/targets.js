const valueTypePriority = {
  RDA_AI: 1,
  EAR: 2,
  UL: 3,
};

const foodFieldMapping = {
  protein: { foodKey: "proteinas_g", targetField: "daily_protein_target_g" },
  fat: { foodKey: "lipidos_totales_g", targetField: "daily_fat_target_g" },
  cho: { foodKey: "carbohidratos_disponibles_g", targetField: "daily_carbs_target_g" },
  carbohydrate: { foodKey: "carbohidratos_disponibles_g", targetField: "daily_carbs_target_g" },
  total_fiber: { foodKey: "fibra_alimentaria_g", targetField: "daily_fiber_target_g" },
  sodium: { foodKey: "sodio_mg", targetField: "daily_sodium_target_mg" },
  potassium: { foodKey: "potasio_mg" },
  calcium: { foodKey: "calcio_mg" },
  iron: { foodKey: "hierro_mg" },
  magnesium: { foodKey: "magnesio_mg" },
  zinc: { foodKey: "zinc_mg" },
  niacin: { foodKey: "niacina_mg" },
  folate: { foodKey: "folato_efd_ug" },
  vitamin_a: { foodKey: "vitamina_a_rae_ug" },
  vitamin_b12: { foodKey: "vitamina_b_12_ug" },
  vitamin_c: { foodKey: "vitamina_c_mg" },
  vitamin_d: { foodKey: "vitamina_d_ug" },
};

function normalizeUnit(unit) {
  return String(unit || "").replace(/μ/g, "u").replace(/µ/g, "u").trim().toLowerCase();
}

function convertTargetValue(value, unit, foodKey) {
  if (value == null) return null;
  const normalizedUnit = normalizeUnit(unit);

  if ((foodKey === "sodio_mg" || foodKey === "potasio_mg") && normalizedUnit === "g/d") {
    return Number(value) * 1000;
  }

  return Number(value);
}

function sortRows(left, right) {
  const leftPriority = valueTypePriority[left.value_type] ?? 99;
  const rightPriority = valueTypePriority[right.value_type] ?? 99;
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;

  const leftCondition = left.condition ? 1 : 0;
  const rightCondition = right.condition ? 1 : 0;
  if (leftCondition !== rightCondition) return leftCondition - rightCondition;

  return String(left.source_table || "").localeCompare(String(right.source_table || ""));
}

export function buildFoodReferenceTargets(rows) {
  /** @type {Record<string, { value: number, unit: string, nutrientKey: string, label: string, valueType: string, lifeStageLabel: string | null }>} */
  const targets = {};

  const grouped = new Map();
  for (const row of rows || []) {
    if (!row?.nutrient_key) continue;
    const list = grouped.get(row.nutrient_key) || [];
    list.push(row);
    grouped.set(row.nutrient_key, list);
  }

  for (const [nutrientKey, list] of grouped.entries()) {
    const mapping = foodFieldMapping[nutrientKey];
    if (!mapping) continue;

    const [best] = list.sort(sortRows);
    if (!best || best.value == null) continue;

    const converted = convertTargetValue(best.value, best.unit, mapping.foodKey);
    if (converted == null || Number.isNaN(converted)) continue;

    targets[mapping.foodKey] = {
      value: converted,
      unit: mapping.foodKey.endsWith("_mg") ? "mg" : mapping.foodKey.endsWith("_ug") ? "ug" : mapping.foodKey.endsWith("_kcal") ? "kcal" : "g",
      nutrientKey,
      label: best.nutrient_label || nutrientKey,
      valueType: best.value_type,
      lifeStageLabel: best.life_stage_label || null,
    };
  }

  return targets;
}

export function buildPlanDailyTargetsFromDriRows(rows, baseTargets = {}) {
  const refs = buildFoodReferenceTargets(rows);

  return {
    daily_energy_target_kcal: baseTargets.daily_energy_target_kcal ?? null,
    daily_protein_target_g: baseTargets.daily_protein_target_g ?? refs.proteinas_g?.value ?? null,
    daily_fat_target_g: baseTargets.daily_fat_target_g ?? refs.lipidos_totales_g?.value ?? null,
    daily_carbs_target_g: baseTargets.daily_carbs_target_g ?? refs.carbohidratos_disponibles_g?.value ?? null,
    daily_fiber_target_g: baseTargets.daily_fiber_target_g ?? refs.fibra_alimentaria_g?.value ?? null,
    daily_sodium_target_mg: baseTargets.daily_sodium_target_mg ?? refs.sodio_mg?.value ?? null,
  };
}

export function buildMergedReferenceTargets(rows, baseTargets = {}) {
  const refs = buildFoodReferenceTargets(rows);

  const overlay = {
    valor_energetico_kcal: baseTargets.daily_energy_target_kcal != null
      ? { value: Number(baseTargets.daily_energy_target_kcal), unit: "kcal", nutrientKey: "energy_kcal", label: "Energia", valueType: "PLAN", lifeStageLabel: null }
      : undefined,
    proteinas_g: baseTargets.daily_protein_target_g != null
      ? { value: Number(baseTargets.daily_protein_target_g), unit: "g", nutrientKey: "protein", label: "Proteina", valueType: "PLAN", lifeStageLabel: null }
      : undefined,
    lipidos_totales_g: baseTargets.daily_fat_target_g != null
      ? { value: Number(baseTargets.daily_fat_target_g), unit: "g", nutrientKey: "fat", label: "Grasa", valueType: "PLAN", lifeStageLabel: null }
      : undefined,
    carbohidratos_disponibles_g: baseTargets.daily_carbs_target_g != null
      ? { value: Number(baseTargets.daily_carbs_target_g), unit: "g", nutrientKey: "carbohydrate", label: "Carbohidratos", valueType: "PLAN", lifeStageLabel: null }
      : undefined,
    fibra_alimentaria_g: baseTargets.daily_fiber_target_g != null
      ? { value: Number(baseTargets.daily_fiber_target_g), unit: "g", nutrientKey: "total_fiber", label: "Fibra", valueType: "PLAN", lifeStageLabel: null }
      : undefined,
    sodio_mg: baseTargets.daily_sodium_target_mg != null
      ? { value: Number(baseTargets.daily_sodium_target_mg), unit: "mg", nutrientKey: "sodium", label: "Sodio", valueType: "PLAN", lifeStageLabel: null }
      : undefined,
  };

  return {
    ...refs,
    ...Object.fromEntries(Object.entries(overlay).filter(([, value]) => value != null)),
  };
}
