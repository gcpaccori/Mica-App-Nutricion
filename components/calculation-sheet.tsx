type MealCalculationRow = {
  label: string;
  targetPct?: number | null;
  targetKcal?: number | null;
  actualKcal?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  carbsG?: number | null;
  fiberG?: number | null;
  adequacyPct?: number | null;
};

type ItemCalculationRow = {
  alimento: string;
  grams?: number | null;
  energyKcal?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  carbsG?: number | null;
  fiberG?: number | null;
};

type CalculationSheetProps = {
  eyebrow?: string;
  title: string;
  intro?: string;
  bmrKcal?: number | null;
  activityFactor?: number | null;
  energyTargetKcal?: number | null;
  proteinTargetG?: number | null;
  fatTargetG?: number | null;
  carbsTargetG?: number | null;
  fiberTargetG?: number | null;
  sodiumTargetMg?: number | null;
  totalEnergyKcal?: number | null;
  totalProteinG?: number | null;
  totalFatG?: number | null;
  totalCarbsG?: number | null;
  totalFiberG?: number | null;
  energyAdequacyPct?: number | null;
  proteinAdequacyPct?: number | null;
  fatAdequacyPct?: number | null;
  carbsAdequacyPct?: number | null;
  fiberAdequacyPct?: number | null;
  meals: MealCalculationRow[];
  items: ItemCalculationRow[];
};

function formatValue(value?: number | null, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(digits);
}

function formatAdequacy(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toFixed(0)}%`;
}

function macroPct(grams?: number | null, energyTargetKcal?: number | null, kcalPerGram?: number) {
  if (!grams || !energyTargetKcal || !kcalPerGram || energyTargetKcal <= 0) return null;
  return ((grams * kcalPerGram) / energyTargetKcal) * 100;
}

export function CalculationSheet({
  eyebrow = "Hoja de cálculo",
  title,
  intro,
  bmrKcal,
  activityFactor,
  energyTargetKcal,
  proteinTargetG,
  fatTargetG,
  carbsTargetG,
  fiberTargetG,
  sodiumTargetMg,
  totalEnergyKcal,
  totalProteinG,
  totalFatG,
  totalCarbsG,
  totalFiberG,
  energyAdequacyPct,
  proteinAdequacyPct,
  fatAdequacyPct,
  carbsAdequacyPct,
  fiberAdequacyPct,
  meals,
  items,
}: CalculationSheetProps) {
  const proteinPct = macroPct(proteinTargetG, energyTargetKcal, 4);
  const carbsPct = macroPct(carbsTargetG, energyTargetKcal, 4);
  const fatPct = macroPct(fatTargetG, energyTargetKcal, 9);

  return (
    <section className="panel rounded-[2rem] p-7 lg:p-8">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="headline mt-3 text-2xl font-semibold text-slate-950">{title}</h2>
      {intro ? <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">{intro}</p> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="rounded-[1.5rem] border border-slate-200 bg-white/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">1. TMB</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Base del caso energético. Si hay medición y perfil válidos, se resuelve con FAO / OMS / UNU.</p>
          <div className="mt-4 rounded-[1rem] bg-white p-4 text-sm text-slate-700">
            <p>TMB = {formatValue(bmrKcal)} kcal/día</p>
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-slate-200 bg-white/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">2. Gasto total</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">La energía diaria se ajusta por actividad física usando el factor operativo del caso.</p>
          <div className="mt-4 rounded-[1rem] bg-white p-4 text-sm text-slate-700">
            <p>{formatValue(bmrKcal)} × {formatValue(activityFactor, 2)} = {formatValue(energyTargetKcal)} kcal/día</p>
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-slate-200 bg-white/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">3. Macronutrientes</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Las kcal del día se convierten a gramos con 4 kcal/g para proteína y carbohidratos, 9 kcal/g para grasa.</p>
          <div className="mt-4 space-y-2 rounded-[1rem] bg-white p-4 text-sm text-slate-700">
            <p>Proteína: {formatValue(proteinTargetG, 1)} g {proteinPct != null ? `· ${formatValue(proteinPct)}%` : ""}</p>
            <p>Carbohidratos: {formatValue(carbsTargetG, 1)} g {carbsPct != null ? `· ${formatValue(carbsPct)}%` : ""}</p>
            <p>Grasa: {formatValue(fatTargetG, 1)} g {fatPct != null ? `· ${formatValue(fatPct)}%` : ""}</p>
            <p>Fibra: {formatValue(fiberTargetG, 1)} g</p>
            <p>Sodio: {formatValue(sodiumTargetMg)} mg</p>
          </div>
        </article>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[1.5rem] border border-slate-200 bg-white/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">4. Distribución en cinco comidas</p>
          <div className="mt-4 grid gap-3 md:hidden">
            {meals.length ? meals.map((meal) => (
              <article key={meal.label} className="rounded-[1rem] border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-950">{meal.label}</p>
                  <span className="rounded-full bg-[#f1f7f4] px-3 py-1 text-xs font-semibold text-[#0f5c4d]">{formatAdequacy(meal.adequacyPct)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                  <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">% día: {meal.targetPct != null ? `${formatValue(meal.targetPct * 100)}%` : "—"}</div>
                  <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Meta: {meal.targetKcal != null ? `${formatValue(meal.targetKcal)} kcal` : "—"}</div>
                  <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2 col-span-2">Real: {meal.actualKcal != null ? `${formatValue(meal.actualKcal)} kcal` : "—"}</div>
                </div>
              </article>
            )) : <p className="rounded-[1rem] border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">Sin comidas cuantificadas todavía.</p>}
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4">Comida</th>
                  <th className="pb-2 pr-4">% día</th>
                  <th className="pb-2 pr-4">Meta kcal</th>
                  <th className="pb-2 pr-4">Real kcal</th>
                  <th className="pb-2">Adeq.</th>
                </tr>
              </thead>
              <tbody>
                {meals.length ? meals.map((meal) => (
                  <tr key={meal.label} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium">{meal.label}</td>
                    <td className="py-2 pr-4">{meal.targetPct != null ? `${formatValue(meal.targetPct * 100)}%` : "—"}</td>
                    <td className="py-2 pr-4">{meal.targetKcal != null ? `${formatValue(meal.targetKcal)} kcal` : "—"}</td>
                    <td className="py-2 pr-4">{meal.actualKcal != null ? `${formatValue(meal.actualKcal)} kcal` : "—"}</td>
                    <td className="py-2">{formatAdequacy(meal.adequacyPct)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="py-3 text-slate-500" colSpan={5}>Sin comidas cuantificadas todavía.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-slate-200 bg-white/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">5. Total del día vs requerimiento</p>
          <div className="mt-4 grid gap-3 md:hidden">
            {[
              { label: "Energía", target: `${formatValue(energyTargetKcal)} kcal`, actual: `${formatValue(totalEnergyKcal)} kcal`, adequacy: formatAdequacy(energyAdequacyPct) },
              { label: "Proteína", target: `${formatValue(proteinTargetG, 1)} g`, actual: `${formatValue(totalProteinG, 1)} g`, adequacy: formatAdequacy(proteinAdequacyPct) },
              { label: "Grasa", target: `${formatValue(fatTargetG, 1)} g`, actual: `${formatValue(totalFatG, 1)} g`, adequacy: formatAdequacy(fatAdequacyPct) },
              { label: "Carbohidratos", target: `${formatValue(carbsTargetG, 1)} g`, actual: `${formatValue(totalCarbsG, 1)} g`, adequacy: formatAdequacy(carbsAdequacyPct) },
              { label: "Fibra", target: `${formatValue(fiberTargetG, 1)} g`, actual: `${formatValue(totalFiberG, 1)} g`, adequacy: formatAdequacy(fiberAdequacyPct) },
            ].map((row) => (
              <article key={row.label} className="rounded-[1rem] border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-950">{row.label}</p>
                  <span className="rounded-full bg-[#f1f7f4] px-3 py-1 text-xs font-semibold text-[#0f5c4d]">{row.adequacy}</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Meta: {row.target}</div>
                  <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Real: {row.actual}</div>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4">Nutriente</th>
                  <th className="pb-2 pr-4">Meta</th>
                  <th className="pb-2 pr-4">Real</th>
                  <th className="pb-2">Adeq.</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100"><td className="py-2 pr-4 font-medium">Energía</td><td className="py-2 pr-4">{formatValue(energyTargetKcal)} kcal</td><td className="py-2 pr-4">{formatValue(totalEnergyKcal)} kcal</td><td className="py-2">{formatAdequacy(energyAdequacyPct)}</td></tr>
                <tr className="border-b border-slate-100"><td className="py-2 pr-4 font-medium">Proteína</td><td className="py-2 pr-4">{formatValue(proteinTargetG, 1)} g</td><td className="py-2 pr-4">{formatValue(totalProteinG, 1)} g</td><td className="py-2">{formatAdequacy(proteinAdequacyPct)}</td></tr>
                <tr className="border-b border-slate-100"><td className="py-2 pr-4 font-medium">Grasa</td><td className="py-2 pr-4">{formatValue(fatTargetG, 1)} g</td><td className="py-2 pr-4">{formatValue(totalFatG, 1)} g</td><td className="py-2">{formatAdequacy(fatAdequacyPct)}</td></tr>
                <tr className="border-b border-slate-100"><td className="py-2 pr-4 font-medium">Carbohidratos</td><td className="py-2 pr-4">{formatValue(carbsTargetG, 1)} g</td><td className="py-2 pr-4">{formatValue(totalCarbsG, 1)} g</td><td className="py-2">{formatAdequacy(carbsAdequacyPct)}</td></tr>
                <tr><td className="py-2 pr-4 font-medium">Fibra</td><td className="py-2 pr-4">{formatValue(fiberTargetG, 1)} g</td><td className="py-2 pr-4">{formatValue(totalFiberG, 1)} g</td><td className="py-2">{formatAdequacy(fiberAdequacyPct)}</td></tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <article className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white/70 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">6. Aporte por alimento</p>
        <p className="mt-2 text-sm leading-7 text-slate-600">Cada fila ya representa el resultado de aplicar la regla: nutriente_aportado = nutriente_100g × gramos / 100.</p>
        <div className="mt-4 grid gap-3 md:hidden">
          {items.length ? items.map((item, index) => (
            <article key={`${item.alimento}-${index}`} className="rounded-[1rem] border border-slate-200 bg-white p-4">
              <p className="font-semibold text-slate-950">{item.alimento}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Gramos: {formatValue(item.grams)}</div>
                <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Kcal: {formatValue(item.energyKcal)}</div>
                <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Prot: {formatValue(item.proteinG, 1)}</div>
                <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Grasa: {formatValue(item.fatG, 1)}</div>
                <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Carb: {formatValue(item.carbsG, 1)}</div>
                <div className="rounded-[0.9rem] bg-slate-50 px-3 py-2">Fibra: {formatValue(item.fiberG, 1)}</div>
              </div>
            </article>
          )) : <p className="rounded-[1rem] border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">Sin alimentos cuantificados todavía.</p>}
        </div>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="pb-2 pr-4">Alimento</th>
                <th className="pb-2 pr-4 text-right">Gramos</th>
                <th className="pb-2 pr-4 text-right">Kcal</th>
                <th className="pb-2 pr-4 text-right">Prot</th>
                <th className="pb-2 pr-4 text-right">Grasa</th>
                <th className="pb-2 pr-4 text-right">Carb</th>
                <th className="pb-2 text-right">Fibra</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? items.map((item, index) => (
                <tr key={`${item.alimento}-${index}`} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-900">{item.alimento}</td>
                  <td className="py-2 pr-4 text-right">{formatValue(item.grams)}</td>
                  <td className="py-2 pr-4 text-right">{formatValue(item.energyKcal)}</td>
                  <td className="py-2 pr-4 text-right">{formatValue(item.proteinG, 1)}</td>
                  <td className="py-2 pr-4 text-right">{formatValue(item.fatG, 1)}</td>
                  <td className="py-2 pr-4 text-right">{formatValue(item.carbsG, 1)}</td>
                  <td className="py-2 text-right">{formatValue(item.fiberG, 1)}</td>
                </tr>
              )) : (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={7}>Sin alimentos cuantificados todavía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}