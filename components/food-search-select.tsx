"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";

type FoodValue = string | number | null;
type FoodRecord = Record<string, FoodValue> & {
  id: number;
  alimento: string;
  grupo_numero?: number | null;
  grupo_nombre?: string | null;
};

type FoodPortionRecord = {
  id: number;
  alimento_id: number;
  portion_label: string;
  net_grams: number;
  source?: string | null;
};

type FoodSearchSelectProps = {
  name: string;
  label?: string;
  required?: boolean;
  quantityName?: string;
  portionIdName?: string;
  portionMultiplierName?: string;
  householdMeasureName?: string;
  householdQuantityName?: string;
  defaultQuantityGrams?: number;
  dailyTargets?: Partial<Record<TargetFieldKey, number | null>>;
  referenceTargets?: Partial<Record<string, { value: number; unit?: string | null; label?: string; valueType?: string; lifeStageLabel?: string | null }>>;
};

type TargetFieldKey =
  | "daily_energy_target_kcal"
  | "daily_protein_target_g"
  | "daily_fat_target_g"
  | "daily_carbs_target_g"
  | "daily_fiber_target_g"
  | "daily_sodium_target_mg";

type NutrientDescriptor = {
  key: string;
  label: string;
  unit: string;
  rawValue: FoodValue;
  scaledValue: number | null;
  targetKey?: TargetFieldKey;
  targetValue?: number | null;
  percentage?: number | null;
  referenceLabel?: string | null;
  referenceType?: string | null;
  referenceLifeStage?: string | null;
};

const inputClass = "mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#0f5c4d] focus:outline-none";
const metaFields = new Set([
  "id",
  "alimento",
  "grupo_numero",
  "grupo_nombre",
  "grupo_slug",
  "created_at",
  "updated_at",
]);

const priorityFields = [
  "valor_energetico_kcal",
  "proteinas_g",
  "lipidos_totales_g",
  "carbohidratos_disponibles_g",
  "fibra_alimentaria_g",
  "azucar_total_g",
  "azucar_agregado_g",
  "sodio_mg",
  "potasio_mg",
  "calcio_mg",
  "hierro_mg",
  "magnesio_mg",
  "zinc_mg",
  "vitamina_c_mg",
  "vitamina_a_rae_ug",
  "vitamina_b_12_ug",
  "vitamina_d_ug",
  "folato_efd_ug",
  "niacina_mg",
];

const fieldLabels: Record<string, string> = {
  valor_energetico_kcal: "Energia",
  proteinas_g: "Proteina",
  lipidos_totales_g: "Lipidos totales",
  carbohidratos_disponibles_g: "Carbohidratos disponibles",
  fibra_alimentaria_g: "Fibra alimentaria",
  azucar_total_g: "Azucar total",
  azucar_agregado_g: "Azucar agregado",
  sodio_mg: "Sodio",
  potasio_mg: "Potasio",
  calcio_mg: "Calcio",
  hierro_mg: "Hierro",
  magnesio_mg: "Magnesio",
  zinc_mg: "Zinc",
  niacina_mg: "Niacina",
  folato_efd_ug: "Folato EFD",
  vitamina_a_rae_ug: "Vitamina A RAE",
  vitamina_b_12_ug: "Vitamina B12",
  vitamina_c_mg: "Vitamina C",
  vitamina_d_ug: "Vitamina D",
};

const targetFieldByNutrient: Partial<Record<string, TargetFieldKey>> = {
  valor_energetico_kcal: "daily_energy_target_kcal",
  proteinas_g: "daily_protein_target_g",
  lipidos_totales_g: "daily_fat_target_g",
  carbohidratos_disponibles_g: "daily_carbs_target_g",
  fibra_alimentaria_g: "daily_fiber_target_g",
  sodio_mg: "daily_sodium_target_mg",
};

function getUnit(key: string) {
  if (key.endsWith("_kcal")) return "kcal";
  if (key.endsWith("_mg")) return "mg";
  if (key.endsWith("_ug")) return "ug";
  if (key.endsWith("_g")) return "g";
  return "";
}

function coerceNumber(value: FoodValue) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function prettifyLabel(key: string) {
  if (fieldLabels[key]) return fieldLabels[key];
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value: FoodValue, decimals = 2) {
  if (value == null || value === "") return "—";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(decimals);
  }
  return value;
}

function formatMetric(value: number | null, unit: string) {
  if (value == null) return "—";
  const decimals = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return `${formatValue(value, decimals)}${unit ? ` ${unit}` : ""}`;
}

function formatInputNumber(value: number) {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(3)));
}

export function FoodSearchSelect({
  name,
  label = "Alimento",
  required,
  quantityName = "quantity_grams",
  portionIdName = "food_portion_id",
  portionMultiplierName = "portion_multiplier",
  householdMeasureName = "household_measure",
  householdQuantityName = "household_quantity",
  defaultQuantityGrams = 100,
  dailyTargets,
  referenceTargets,
}: FoodSearchSelectProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodRecord[]>([]);
  const [portions, setPortions] = useState<FoodPortionRecord[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodRecord | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [selectedPortionId, setSelectedPortionId] = useState("");
  const [portionMultiplier, setPortionMultiplier] = useState("1");
  const [quantityGrams, setQuantityGrams] = useState(String(defaultQuantityGrams));
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portionError, setPortionError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query.trim());

  useEffect(() => {
    let isCancelled = false;

    async function loadFoods() {
      setIsLoading(true);
      setError(null);

      try {
        const url = new URL("/api/foods/search", window.location.origin);
        if (deferredQuery) {
          url.searchParams.set("q", deferredQuery);
        }
        url.searchParams.set("limit", deferredQuery ? "12" : "20");

        const response = await fetch(url.toString(), {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("No fue posible cargar alimentos.");
        }

        const payload = (await response.json()) as { foods?: FoodRecord[] };
        if (!isCancelled) {
          setResults(payload.foods ?? []);
        }
      } catch (err) {
        if (!isCancelled) {
          setResults([]);
          setError(err instanceof Error ? err.message : "No fue posible cargar alimentos.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadFoods();

    return () => {
      isCancelled = true;
    };
  }, [deferredQuery]);

  useEffect(() => {
    let isCancelled = false;

    async function loadPortions() {
      if (!selectedId) {
        setPortions([]);
        setPortionError(null);
        setSelectedPortionId("");
        setPortionMultiplier("1");
        return;
      }

      try {
        setPortionError(null);

        const url = new URL("/api/foods/portions", window.location.origin);
        url.searchParams.set("foodId", selectedId);

        const response = await fetch(url.toString(), {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("No fue posible cargar porciones guardadas.");
        }

        const payload = (await response.json()) as { portions?: FoodPortionRecord[] };
        if (!isCancelled) {
          setPortions(payload.portions ?? []);
          setSelectedPortionId("");
          setPortionMultiplier("1");
        }
      } catch (err) {
        if (!isCancelled) {
          setPortions([]);
          setSelectedPortionId("");
          setPortionMultiplier("1");
          setPortionError(err instanceof Error ? err.message : "No fue posible cargar porciones guardadas.");
        }
      }
    }

    loadPortions();

    return () => {
      isCancelled = true;
    };
  }, [selectedId]);

  const selectedPortion = useMemo(
    () => portions.find((portion) => String(portion.id) === selectedPortionId) ?? null,
    [portions, selectedPortionId],
  );

  useEffect(() => {
    if (!selectedPortion) return;

    const multiplier = Number(portionMultiplier);
    const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
    setQuantityGrams(formatInputNumber(selectedPortion.net_grams * safeMultiplier));
  }, [portionMultiplier, selectedPortion]);

  const nutrientEntries = useMemo(() => {
    if (!selectedFood) return [] as NutrientDescriptor[];

    const grams = Number(quantityGrams);
    const portionFactor = Number.isFinite(grams) && grams > 0 ? grams / 100 : 0;

    return Object.entries(selectedFood)
      .filter(([key]) => !metaFields.has(key))
      .sort(([left], [right]) => {
        const leftIndex = priorityFields.indexOf(left);
        const rightIndex = priorityFields.indexOf(right);

        if (leftIndex !== -1 || rightIndex !== -1) {
          if (leftIndex === -1) return 1;
          if (rightIndex === -1) return -1;
          return leftIndex - rightIndex;
        }

        return left.localeCompare(right);
      })
      .map(([key, rawValue]) => {
        const numericValue = coerceNumber(rawValue);
        const unit = getUnit(key);
        const targetKey = targetFieldByNutrient[key];
        const genericReference = referenceTargets?.[key];
        const targetValue = genericReference?.value ?? (targetKey ? dailyTargets?.[targetKey] ?? null : null);
        const scaledValue = numericValue != null ? numericValue * portionFactor : null;
        const percentage = scaledValue != null && targetValue && targetValue > 0
          ? (scaledValue / targetValue) * 100
          : null;

        return {
          key,
          label: prettifyLabel(key),
          unit,
          rawValue,
          scaledValue,
          targetKey,
          targetValue,
          percentage,
          referenceLabel: genericReference?.label ?? null,
          referenceType: genericReference?.valueType ?? null,
          referenceLifeStage: genericReference?.lifeStageLabel ?? null,
        };
      });
  }, [dailyTargets, quantityGrams, referenceTargets, selectedFood]);

  const summaryMetrics = useMemo(() => {
    const topKeys = [
      "valor_energetico_kcal",
      "proteinas_g",
      "lipidos_totales_g",
      "carbohidratos_disponibles_g",
      "fibra_alimentaria_g",
      "sodio_mg",
    ];

    return nutrientEntries.filter((entry) => topKeys.includes(entry.key));
  }, [nutrientEntries]);

  return (
    <div className="flex-1 min-w-[320px]">
      <label htmlFor={inputId} className="text-xs text-slate-500">{label}</label>
      <input type="hidden" name={name} value={selectedId} />
      <input type="hidden" name={portionIdName} value={selectedPortionId} />
      <input type="hidden" name={portionMultiplierName} value={selectedPortion ? portionMultiplier : ""} />
      <input type="hidden" name={householdMeasureName} value={selectedPortion?.portion_label ?? ""} />
      <input type="hidden" name={householdQuantityName} value={selectedPortion ? portionMultiplier : ""} />
      <div className="mt-1 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_110px_132px] xl:items-start">
        <div className="relative">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id={inputId}
            value={query}
            onChange={(event) => {
              const nextValue = event.target.value;
              setQuery(nextValue);
              setIsOpen(true);

              if (selectedFood && nextValue !== selectedFood.alimento) {
                setSelectedFood(null);
                setSelectedId("");
              }
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Buscar por nombre del alimento"
            className={`${inputClass} pl-10`}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={`${inputId}-results`}
            aria-haspopup="listbox"
            required={required && !selectedId}
          />
          {isOpen && (
            <div
              id={`${inputId}-results`}
              role="listbox"
              className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-[1.25rem] border border-slate-200 bg-white p-2 shadow-[0_24px_64px_-32px_rgba(15,92,77,0.4)]"
            >
              <div className="flex items-center justify-between px-2 pb-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
                <span>{deferredQuery ? "Resultados" : "Explorar catalogo"}</span>
                <span>{isLoading ? "Buscando..." : `${results.length} items`}</span>
              </div>

              {error && (
                <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              )}

              {!error && results.length === 0 && !isLoading && (
                <p className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  No hay alimentos para ese criterio.
                </p>
              )}

              <div className="space-y-1">
                {results.map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    role="option"
                    aria-selected={selectedId === String(food.id)}
                    onClick={() => {
                      setSelectedFood(food);
                      setSelectedId(String(food.id));
                      setQuery(food.alimento);
                      setQuantityGrams(String(defaultQuantityGrams));
                      setIsOpen(false);
                    }}
                    className={`w-full rounded-2xl px-3 py-2 text-left transition ${
                      selectedId === String(food.id)
                        ? "bg-[#d6ebe3] text-[#0f5c4d]"
                        : "hover:bg-[#f1f7f4]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{food.alimento}</p>
                        <p className="text-xs text-slate-500">
                          Grupo {food.grupo_numero ?? "—"} · {food.grupo_nombre ?? "Sin grupo"}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>{formatValue(coerceNumber(food.valor_energetico_kcal))} kcal</p>
                        <p>P {formatValue(coerceNumber(food.proteinas_g))} · C {formatValue(coerceNumber(food.carbohidratos_disponibles_g))}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-slate-500" htmlFor={`${inputId}-portion`}>Porcion guardada</label>
          <select
            id={`${inputId}-portion`}
            value={selectedPortionId}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSelectedPortionId(nextValue);
              if (!nextValue) {
                setPortionMultiplier("1");
              }
            }}
            className={inputClass}
            disabled={!selectedId || portions.length === 0}
          >
            <option value="">Gramos manuales</option>
            {portions.map((portion) => (
              <option key={portion.id} value={portion.id}>
                {portion.portion_label} · {formatInputNumber(portion.net_grams)} g
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-400">
            {selectedId
              ? portions.length > 0
                ? `${portions.length} porciones disponibles`
                : "Sin porciones guardadas; usa gramos manuales"
              : "Selecciona un alimento primero"}
          </p>
        </div>

        <div>
          <label className="text-xs text-slate-500" htmlFor={`${inputId}-multiplier`}>Multiplicador</label>
          <input
            id={`${inputId}-multiplier`}
            type="number"
            step="0.25"
            min="0.25"
            value={portionMultiplier}
            onChange={(event) => setPortionMultiplier(event.target.value)}
            className={inputClass}
            disabled={!selectedPortion}
          />
          <p className="mt-1 text-[11px] text-slate-400">Usa 0.5, 1, 2, etc.</p>
        </div>

        <div>
          <label className="text-xs text-slate-500" htmlFor={`${inputId}-grams`}>Porcion</label>
          <input
            id={`${inputId}-grams`}
            name={quantityName}
            type="number"
            step="1"
            min="1"
            value={quantityGrams}
            onChange={(event) => setQuantityGrams(event.target.value)}
            className={inputClass}
            placeholder="100"
            readOnly={Boolean(selectedPortion)}
            required
          />
          <p className="mt-1 text-[11px] text-slate-400">
            {selectedPortion ? "gramos netos calculados desde la porcion" : "gramos a prescribir manualmente"}
          </p>
        </div>
      </div>

      {portionError && (
        <p className="mt-2 text-xs text-red-700">{portionError}</p>
      )}

      <p className="mt-2 text-xs text-slate-500">
        Busca por nombre, elige una porcion guardada si existe o usa gramos manuales, y revisa el aporte calculado frente a la meta diaria del plan cuando exista.
      </p>
      {required && !selectedId && query.trim().length > 0 && (
        <p className="mt-1 text-xs text-amber-700">Selecciona un alimento de la lista para poder agregarlo.</p>
      )}

      {selectedFood && (
        <div className="mt-4 rounded-[1.5rem] border border-[#0f5c4d]/15 bg-[#f7fbf9] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#0f5c4d]/10 pb-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">{selectedFood.alimento}</p>
              <p className="text-xs text-slate-500">
                Grupo {selectedFood.grupo_numero ?? "—"} · {selectedFood.grupo_nombre ?? "Sin grupo"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full bg-[#d6ebe3] px-3 py-1 text-xs font-semibold text-[#0f5c4d]">
                {nutrientEntries.length} campos nutricionales
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                {quantityGrams || defaultQuantityGrams} g calculados
              </div>
              {selectedPortion && (
                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  {selectedPortion.portion_label} × {portionMultiplier}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {summaryMetrics.map((entry) => (
              <div key={entry.key} className="rounded-[1rem] border border-slate-200 bg-white px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">{entry.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatMetric(entry.scaledValue, entry.unit)}</p>
                <p className="text-[11px] text-slate-500">{formatMetric(coerceNumber(entry.rawValue), entry.unit)} / 100 g</p>
                <p className="text-[11px] text-slate-500">
                  {entry.percentage != null ? `${formatValue(entry.percentage, 0)}% ref.` : "sin referencia"}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white">
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Nutriente</th>
                    <th className="px-3 py-2 text-right font-medium">Unidad</th>
                    <th className="px-3 py-2 text-right font-medium">Por 100 g</th>
                    <th className="px-3 py-2 text-right font-medium">Porcion</th>
                    <th className="px-3 py-2 text-right font-medium">% referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {nutrientEntries.map((entry) => (
                    <tr key={entry.key} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-2 font-medium text-slate-800">{entry.label}</td>
                      <td className="px-3 py-2 text-right text-slate-500">{entry.unit || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {formatMetric(coerceNumber(entry.rawValue), entry.unit)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                        {formatMetric(entry.scaledValue, entry.unit)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                        {entry.percentage != null ? `${formatValue(entry.percentage, 0)}%` : "—"}
                        {(entry.referenceType || entry.referenceLifeStage) && (
                          <div className="mt-1 text-[10px] text-slate-400">
                            {[entry.referenceType, entry.referenceLifeStage].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}