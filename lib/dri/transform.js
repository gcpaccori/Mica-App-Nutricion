function normalizeUnit(unit) {
  return unit == null ? null : String(unit).replace(/μ/g, "u").replace(/µ/g, "u");
}

function parseValueCell(cell, defaultBasis) {
  if (cell == null) {
    return { value: null, basis: defaultBasis, special: null };
  }

  if (typeof cell === "number") {
    return { value: cell, basis: defaultBasis, special: null };
  }

  if (typeof cell === "string") {
    const trimmed = cell.trim();
    if (!trimmed || trimmed.toUpperCase() === "ND") {
      return { value: null, basis: defaultBasis, special: trimmed.toUpperCase() === "ND" ? "ND" : null };
    }

    const numeric = Number(trimmed.replace(/\*/g, ""));
    return {
      value: Number.isFinite(numeric) ? numeric : null,
      basis: trimmed.includes("*") ? "AI" : defaultBasis,
      special: Number.isFinite(numeric) ? null : trimmed,
    };
  }

  if (typeof cell === "object") {
    return {
      value: cell.value == null ? null : Number(cell.value),
      basis: cell.basis || defaultBasis,
      special: cell.special || null,
    };
  }

  return { value: null, basis: defaultBasis, special: null };
}

export function parseLifeStage(label) {
  const value = String(label || "").trim();
  if (!value) return { ageMinMonths: null, ageMaxMonths: null };

  const infantMatch = value.match(/^(\d+)\s*to\s*(\d+)\s*mo$/i);
  if (infantMatch) {
    return {
      ageMinMonths: Number(infantMatch[1]),
      ageMaxMonths: Number(infantMatch[2]),
    };
  }

  const rangeMatch = value.match(/^(\d+)\s*[-–]\s*(\d+)\s*y$/i);
  if (rangeMatch) {
    return {
      ageMinMonths: Number(rangeMatch[1]) * 12,
      ageMaxMonths: (Number(rangeMatch[2]) * 12) + 11,
    };
  }

  const overMatch = value.match(/^>\s*(\d+)\s*y$/i);
  if (overMatch) {
    return {
      ageMinMonths: (Number(overMatch[1]) * 12) + 1,
      ageMaxMonths: 2400,
    };
  }

  return { ageMinMonths: null, ageMaxMonths: null };
}

export function normalizePopulation(group) {
  switch (String(group || "").toLowerCase()) {
    case "males":
      return { sex: "male", condition: null };
    case "females":
      return { sex: "female", condition: null };
    case "pregnancy":
      return { sex: "female", condition: "pregnancy" };
    case "lactation":
      return { sex: "female", condition: "lactation" };
    default:
      return { sex: "other", condition: null };
  }
}

export function flattenDriPayload(payload) {
  const records = [];
  const tables = payload?.tables || {};

  for (const [tableKey, table] of Object.entries(tables)) {
    if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows)) continue;
    const defaultBasis = table.type || null;

    for (const row of table.rows) {
      if (!row || !row.values || typeof row.values !== "object") continue;
      const lifeStage = row.life_stage || row.life_stage_raw || null;
      const ages = parseLifeStage(lifeStage);
      const population = normalizePopulation(row.group);

      for (const column of table.columns) {
        if (!column?.key) continue;
        const parsed = parseValueCell(row.values[column.key], defaultBasis);
        records.push({
          sourceTable: tableKey,
          nutrientKey: column.key,
          nutrientLabel: column.label || column.key,
          unit: normalizeUnit(column.unit),
          valueType: table.type || defaultBasis || "REFERENCE",
          value: parsed.value,
          lifeStageLabel: lifeStage,
          ageMinMonths: ages.ageMinMonths,
          ageMaxMonths: ages.ageMaxMonths,
          sex: population.sex,
          condition: population.condition,
          groupName: row.group || null,
          basis: parsed.basis,
          special: parsed.special,
        });
      }
    }
  }

  return records;
}

function sqlString(value) {
  if (value == null) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function buildDriInsertSql(records) {
  if (!records.length) {
    return "-- No DRI records generated\n";
  }

  const header = [
    "insert into public.dri_values (",
    "  source_table, nutrient_key, nutrient_label, unit, value_type, value,",
    "  life_stage_label, age_min_months, age_max_months, sex, condition, group_name, basis, special",
    ") values",
  ].join("\n");

  const values = records.map((record) => {
    const numericValue = record.value == null || Number.isNaN(Number(record.value)) ? "null" : String(Number(record.value));
    const ageMin = record.ageMinMonths == null ? "null" : String(record.ageMinMonths);
    const ageMax = record.ageMaxMonths == null ? "null" : String(record.ageMaxMonths);

    return `  (${[
      sqlString(record.sourceTable),
      sqlString(record.nutrientKey),
      sqlString(record.nutrientLabel),
      sqlString(record.unit),
      sqlString(record.valueType),
      numericValue,
      sqlString(record.lifeStageLabel),
      ageMin,
      ageMax,
      sqlString(record.sex),
      sqlString(record.condition),
      sqlString(record.groupName),
      sqlString(record.basis),
      sqlString(record.special),
    ].join(", ")})`;
  }).join(",\n");

  return `${header}\n${values}\non conflict do nothing;\n`;
}
