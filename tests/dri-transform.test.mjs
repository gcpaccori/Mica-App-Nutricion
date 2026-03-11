import test from "node:test";
import assert from "node:assert/strict";

import { getDriConditionLabel, normalizeDriCondition } from "../lib/dri/condition.js";
import { buildFoodReferenceTargets, buildPlanDailyTargetsFromDriRows } from "../lib/dri/targets.js";
import { buildDriInsertSql, flattenDriPayload, parseLifeStage } from "../lib/dri/transform.js";

const fixture = {
  tables: {
    total_water_and_macronutrients: {
      type: "RDA_AI",
      columns: [
        { key: "carbohydrate", label: "Carbohydrate", unit: "g/d" },
        { key: "total_fiber", label: "Total Fiber", unit: "g/d" },
        { key: "fat", label: "Fat", unit: "g/d" },
        { key: "protein", label: "Protein", unit: "g/d" },
      ],
      rows: [
        {
          group: "Females",
          life_stage: "19-30 y",
          values: { carbohydrate: 130, total_fiber: 25, fat: 70, protein: 46 },
        },
      ],
    },
    elements_rda_ai: {
      type: "RDA_AI",
      columns: [
        { key: "sodium", label: "Sodium", unit: "g/d" },
        { key: "potassium", label: "Potassium", unit: "g/d" },
        { key: "iron", label: "Iron", unit: "mg/d" },
      ],
      rows: [
        {
          group: "Females",
          life_stage: "19-30 y",
          values: { sodium: 1.5, potassium: 2.6, iron: 18 },
        },
      ],
    },
    vitamins_rda_ai: {
      type: "RDA_AI",
      columns: [
        { key: "vitamin_a", label: "Vitamin A", unit: "ug/d" },
        { key: "vitamin_c", label: "Vitamin C", unit: "mg/d" },
        { key: "folate", label: "Folate", unit: "ug/d" },
      ],
      rows: [
        {
          group: "Females",
          life_stage: "19-30 y",
          values: { vitamin_a: 700, vitamin_c: 75, folate: { value: 400, basis: "RDA_AI" } },
        },
      ],
    },
  },
};

test("parseLifeStage handles ranges", () => {
  assert.deepEqual(parseLifeStage("19-30 y"), { ageMinMonths: 228, ageMaxMonths: 371 });
  assert.deepEqual(parseLifeStage("0 to 6 mo"), { ageMinMonths: 0, ageMaxMonths: 6 });
  assert.deepEqual(parseLifeStage("> 70 y"), { ageMinMonths: 841, ageMaxMonths: 2400 });
});

test("flattenDriPayload produces normalized records", () => {
  const records = flattenDriPayload(fixture);
  assert.equal(records.length, 10);
  assert.equal(records[0].sourceTable, "total_water_and_macronutrients");
  assert.equal(records[0].sex, "female");
});

test("buildDriInsertSql creates insert statement", () => {
  const sql = buildDriInsertSql(flattenDriPayload(fixture));
  assert.match(sql, /insert into public\.dri_values/i);
  assert.match(sql, /carbohydrate/);
  assert.match(sql, /vitamin_a/);
});

test("buildFoodReferenceTargets maps DRI nutrients to food fields with unit conversions", () => {
  const records = flattenDriPayload(fixture).map((row) => ({
    nutrient_key: row.nutrientKey,
    nutrient_label: row.nutrientLabel,
    unit: row.unit,
    value_type: row.valueType,
    value: row.value,
    life_stage_label: row.lifeStageLabel,
    source_table: row.sourceTable,
    condition: row.condition,
  }));

  const refs = buildFoodReferenceTargets(records);
  assert.equal(refs.carbohidratos_disponibles_g.value, 130);
  assert.equal(refs.fibra_alimentaria_g.value, 25);
  assert.equal(refs.lipidos_totales_g.value, 70);
  assert.equal(refs.sodio_mg.value, 1500);
  assert.equal(refs.potasio_mg.value, 2600);
  assert.equal(refs.hierro_mg.value, 18);
  assert.equal(refs.vitamina_a_rae_ug.value, 700);
});

test("buildPlanDailyTargetsFromDriRows fills missing plan targets", () => {
  const records = flattenDriPayload(fixture).map((row) => ({
    nutrient_key: row.nutrientKey,
    nutrient_label: row.nutrientLabel,
    unit: row.unit,
    value_type: row.valueType,
    value: row.value,
    life_stage_label: row.lifeStageLabel,
    source_table: row.sourceTable,
    condition: row.condition,
  }));

  const targets = buildPlanDailyTargetsFromDriRows(records, { daily_energy_target_kcal: 2100 });
  assert.equal(targets.daily_energy_target_kcal, 2100);
  assert.equal(targets.daily_protein_target_g, 46);
  assert.equal(targets.daily_fat_target_g, 70);
  assert.equal(targets.daily_carbs_target_g, 130);
  assert.equal(targets.daily_fiber_target_g, 25);
  assert.equal(targets.daily_sodium_target_mg, 1500);
});

test("normalizeDriCondition accepts only supported physiological states", () => {
  assert.equal(normalizeDriCondition("pregnancy"), "pregnancy");
  assert.equal(normalizeDriCondition(" Lactation "), "lactation");
  assert.equal(normalizeDriCondition("other"), null);
  assert.equal(normalizeDriCondition(""), null);
});

test("getDriConditionLabel returns user-facing labels", () => {
  assert.equal(getDriConditionLabel("pregnancy"), "Embarazo");
  assert.equal(getDriConditionLabel("lactation"), "Lactancia");
  assert.equal(getDriConditionLabel(null), "General");
});
