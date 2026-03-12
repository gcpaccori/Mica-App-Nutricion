import Link from "next/link";

import { ACTIVITY_RULES, BMR_RULES, MEAL_DISTRIBUTION } from "@/lib/domain/nutrition-case";

type CurrentCaseSummary = {
  sex?: string | null;
  ageYears?: number | null;
  weightKg?: number | null;
  bmrKcal?: number | null;
  activityLabel?: string | null;
  activityFactor?: number | null;
  energyKcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
};

type MenuPreviewItem = {
  mealLabel: string;
  mealPct?: number | null;
  alimento: string;
  measure?: string | null;
  grams?: number | null;
  energyKcal?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  carbsG?: number | null;
  fiberG?: number | null;
  calciumMg?: number | null;
  ironMg?: number | null;
  vitaminAUg?: number | null;
  vitaminCMg?: number | null;
};

type NutritionBusinessBoardProps = {
  patientId: string;
  currentCase: CurrentCaseSummary | null;
  menuPreview: MenuPreviewItem[];
  latestPlanId?: string | null;
};

function formatValue(value?: number | null, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(digits);
}

function formatEquation(rule: (typeof BMR_RULES)[number]) {
  const sign = rule.kcalConstant >= 0 ? "+" : "-";
  return `${rule.weightMultiplier} × P ${sign} ${Math.abs(rule.kcalConstant)}`;
}

export function NutritionBusinessBoard({
  patientId,
  currentCase,
  menuPreview,
  latestPlanId,
}: NutritionBusinessBoardProps) {
  const bmrCards = BMR_RULES.filter((rule) => rule.sex === "male").map((maleRule) => {
    const femaleRule = BMR_RULES.find(
      (rule) =>
        rule.sex === "female" &&
        rule.ageMinYears === maleRule.ageMinYears &&
        rule.ageMaxYears === maleRule.ageMaxYears,
    );

    return {
      key: `${maleRule.ageMinYears}-${maleRule.ageMaxYears ?? "plus"}`,
      ageLabel: maleRule.ageMaxYears == null ? `>${maleRule.ageMinYears - 1}` : `${maleRule.ageMinYears} - ${maleRule.ageMaxYears}`,
      maleEquation: formatEquation(maleRule),
      femaleEquation: femaleRule ? formatEquation(femaleRule) : "—",
    };
  });

  return (
    <section className="panel-strong rounded-[2rem] p-5 md:p-7 lg:p-8">
      <p className="eyebrow">Base del negocio</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="headline text-2xl font-semibold text-slate-950 md:text-3xl">La lógica clínica, visible como hoja operativa</h2>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">
            Esta sección deja a la vista exactamente lo que esperas ver en el negocio: ecuaciones de TMB, clasificación NAF, reparto energético en cinco comidas y una hoja de menú cuantificado con alimentos reales.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Link href={`/patients/${patientId}?tab=measurements`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:border-slate-300">
            Peso / TMB
          </Link>
          <Link href={`/patients/${patientId}?tab=goals`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:border-slate-300">
            Requerimientos
          </Link>
          <Link href={latestPlanId ? `/plans/${latestPlanId}` : `/patients/${patientId}?tab=plans`} className="rounded-full bg-[#0f5c4d] px-4 py-2 text-center text-sm font-semibold text-white hover:bg-[#0a4a3d]">
            Menú cuantificado
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <article className="rounded-[1.6rem] border border-slate-200 bg-white/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">1. Tasa de metabolismo basal</p>
          <div className="mt-4 grid gap-3 md:hidden">
            {bmrCards.map((rule) => (
              <div key={rule.key} className="rounded-[1rem] border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{rule.ageLabel} años</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Varón</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{rule.maleEquation}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Mujer</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{rule.femaleEquation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4">Edad</th>
                  <th className="pb-2 pr-4">Varón</th>
                  <th className="pb-2">Mujer</th>
                </tr>
              </thead>
              <tbody>
                {BMR_RULES.filter((rule) => rule.sex === "male").map((maleRule) => {
                  const femaleRule = BMR_RULES.find(
                    (rule) =>
                      rule.sex === "female" &&
                      rule.ageMinYears === maleRule.ageMinYears &&
                      rule.ageMaxYears === maleRule.ageMaxYears,
                  );
                  const ageLabel = maleRule.ageMaxYears == null
                    ? `>${maleRule.ageMinYears - 1}`
                    : `${maleRule.ageMinYears} – ${maleRule.ageMaxYears}`;

                  return (
                    <tr key={`${maleRule.ageMinYears}-${maleRule.ageMaxYears ?? "plus"}`} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium">{ageLabel}</td>
                      <td className="py-2 pr-4">{formatEquation(maleRule)}</td>
                      <td className="py-2">{femaleRule ? formatEquation(femaleRule) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-[1.6rem] border border-slate-200 bg-white/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">2. Nivel de actividad física</p>
          <div className="mt-4 grid gap-3 md:hidden">
            {ACTIVITY_RULES.map((rule) => (
              <div key={rule.code} className="rounded-[1rem] border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">{rule.label}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-[#f1f7f4] px-3 py-1 text-[#0f5c4d]">NAF {formatValue(rule.factor, 2)}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{rule.code.replaceAll("_", " ")}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4">Actividad</th>
                  <th className="pb-2 pr-4">NAF promedio</th>
                  <th className="pb-2">Lectura</th>
                </tr>
              </thead>
              <tbody>
                {ACTIVITY_RULES.map((rule) => (
                  <tr key={rule.code} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium">{rule.label}</td>
                    <td className="py-2 pr-4">{formatValue(rule.factor, 2)}</td>
                    <td className="py-2">{rule.code.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[1.6rem] border border-slate-200 bg-white/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Caso actual del paciente</p>
          {currentCase ? (
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="rounded-[1rem] bg-white p-4">
                <p>Paciente: {currentCase.sex ?? "—"} · {currentCase.ageYears ?? "—"} años · {formatValue(currentCase.weightKg, 1)} kg</p>
                <p className="mt-2">TMB = {formatValue(currentCase.bmrKcal)} kcal</p>
                <p>Energía total = {formatValue(currentCase.bmrKcal)} × {formatValue(currentCase.activityFactor, 2)} = {formatValue(currentCase.energyKcal)} kcal</p>
              </div>
              <div className="rounded-[1rem] bg-white p-4">
                <p>Proteína = {formatValue(currentCase.proteinG, 1)} g</p>
                <p>Carbohidratos = {formatValue(currentCase.carbsG, 1)} g</p>
                <p>Grasa = {formatValue(currentCase.fatG, 1)} g</p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Aún falta una medición válida para resolver el caso con números reales.</p>
          )}
        </article>

        <article className="rounded-[1.6rem] border border-slate-200 bg-white/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">3. Distribución de comidas</p>
          <div className="mt-4 grid gap-3 md:hidden">
            {MEAL_DISTRIBUTION.map((meal) => (
              <div key={meal.code} className="rounded-[1rem] border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">{meal.label}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-[#f1f7f4] px-3 py-1 text-[#0f5c4d]">{formatValue(meal.pct * 100)}% del día</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    {currentCase?.energyKcal != null ? `${formatValue(currentCase.energyKcal * meal.pct, 1)} kcal` : "—"}
                  </span>
                </div>
              </div>
            ))}
            <div className="rounded-[1rem] border border-slate-200 bg-[#0f5c4d] p-4 text-white">
              <p className="text-xs uppercase tracking-[0.18em] text-white/70">Total</p>
              <p className="mt-1 text-base font-semibold">{currentCase?.energyKcal != null ? `${formatValue(currentCase.energyKcal)} kcal` : "—"}</p>
            </div>
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4">Comida</th>
                  <th className="pb-2 pr-4">%</th>
                  <th className="pb-2">Kcal objetivo</th>
                </tr>
              </thead>
              <tbody>
                {MEAL_DISTRIBUTION.map((meal) => (
                  <tr key={meal.code} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium">{meal.label}</td>
                    <td className="py-2 pr-4">{formatValue(meal.pct * 100)}%</td>
                    <td className="py-2">
                      {currentCase?.energyKcal != null ? `${formatValue(currentCase.energyKcal * meal.pct, 1)} kcal` : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold text-slate-950">
                  <td className="pt-3 pr-4">Total</td>
                  <td className="pt-3 pr-4">100%</td>
                  <td className="pt-3">{currentCase?.energyKcal != null ? `${formatValue(currentCase.energyKcal)} kcal` : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <article className="mt-6 rounded-[1.6rem] border border-slate-200 bg-white/70 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">4. Planificación de menú cuantificada</p>
            <p className="mt-2 text-sm text-slate-600">Esto es lo más parecido a la hoja que mostraste: distribución por tiempo de comida, alimento, medida casera, peso neto y nutrientes calculados.</p>
          </div>
          <Link href={latestPlanId ? `/plans/${latestPlanId}` : `/patients/${patientId}?tab=plans`} className="w-full rounded-full border border-[#0f5c4d]/18 bg-white px-4 py-2 text-center text-sm font-semibold text-[#0f5c4d] hover:bg-[#f1f7f4] sm:w-auto">
            Abrir hoja completa
          </Link>
        </div>
        <div className="mt-4 grid gap-3 lg:hidden">
          {menuPreview.length ? menuPreview.map((item, index) => (
            <article key={`${item.mealLabel}-${item.alimento}-${index}`} className="rounded-[1.15rem] border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.mealLabel}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{item.alimento}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.measure ?? "Sin medida casera"}</p>
                </div>
                <div className="rounded-full bg-[#f1f7f4] px-3 py-1 text-xs font-semibold text-[#0f5c4d]">
                  {item.mealPct != null ? `${formatValue(item.mealPct * 100)}%` : "Sin %"}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
                <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">
                  <p className="text-slate-400">Gramos</p>
                  <p className="mt-1 font-semibold text-slate-900">{formatValue(item.grams, 1)}</p>
                </div>
                <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">
                  <p className="text-slate-400">Kcal</p>
                  <p className="mt-1 font-semibold text-slate-900">{formatValue(item.energyKcal, 1)}</p>
                </div>
                <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">
                  <p className="text-slate-400">Prot</p>
                  <p className="mt-1 font-semibold text-slate-900">{formatValue(item.proteinG, 1)}</p>
                </div>
                <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">
                  <p className="text-slate-400">CHO</p>
                  <p className="mt-1 font-semibold text-slate-900">{formatValue(item.carbsG, 1)}</p>
                </div>
              </div>
            </article>
          )) : (
            <div className="rounded-[1.15rem] border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm text-slate-500">
              Todavía no hay un día de plan cuantificado para mostrar esta hoja como en tu referencia.
            </div>
          )}
        </div>
        <div className="mt-4 hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="pb-2 pr-4">Tiempo de comida</th>
                <th className="pb-2 pr-4">% comida</th>
                <th className="pb-2 pr-4">Alimento</th>
                <th className="pb-2 pr-4">Medida casera</th>
                <th className="pb-2 pr-4 text-right">Peso neto</th>
                <th className="pb-2 pr-4 text-right">Energía</th>
                <th className="pb-2 pr-4 text-right">Prot</th>
                <th className="pb-2 pr-4 text-right">Grasa</th>
                <th className="pb-2 pr-4 text-right">CHO</th>
                <th className="pb-2 pr-4 text-right">Fibra</th>
                <th className="pb-2 pr-4 text-right">Ca</th>
                <th className="pb-2 pr-4 text-right">Fe</th>
                <th className="pb-2 pr-4 text-right">Vit A</th>
                <th className="pb-2 text-right">Vit C</th>
              </tr>
            </thead>
            <tbody>
              {menuPreview.length ? menuPreview.map((item, index) => (
                <tr key={`${item.mealLabel}-${item.alimento}-${index}`} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium">{item.mealLabel}</td>
                  <td className="py-2 pr-4">{item.mealPct != null ? `${formatValue(item.mealPct * 100)}%` : "—"}</td>
                  <td className="py-2 pr-4">{item.alimento}</td>
                  <td className="py-2 pr-4 text-slate-600">{item.measure ?? "—"}</td>
                  <td className="py-2 pr-4 text-right">{formatValue(item.grams, 1)}</td>
                  <td className="py-2 pr-4 text-right">{formatValue(item.energyKcal, 1)}</td>
                  <td className="py-2 pr-4 text-right">{formatValue(item.proteinG, 1)}</td>
                  <td className="py-2 pr-4 text-right">{formatValue(item.fatG, 1)}</td>
                  <td className="py-2 pr-4 text-right">{formatValue(item.carbsG, 1)}</td>
                  <td className="py-2 pr-4 text-right">{formatValue(item.fiberG, 1)}</td>
                  <td className="py-2 pr-4 text-right">{formatValue(item.calciumMg, 1)}</td>
                  <td className="py-2 pr-4 text-right">{formatValue(item.ironMg, 2)}</td>
                  <td className="py-2 pr-4 text-right">{formatValue(item.vitaminAUg, 1)}</td>
                  <td className="py-2 text-right">{formatValue(item.vitaminCMg, 1)}</td>
                </tr>
              )) : (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={14}>Todavía no hay un día de plan cuantificado para mostrar esta hoja como en tu referencia.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}