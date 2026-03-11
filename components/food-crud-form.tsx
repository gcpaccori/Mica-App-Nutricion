"use client";

import { useMemo, useState } from "react";

import { FOOD_FIELDS, FOOD_FORM_SECTIONS } from "@/lib/foods/fields";

type FoodGroup = {
  grupo_numero: number;
  grupo_nombre: string;
  grupo_slug: string;
};

type FoodRow = Record<string, string | number | null> & {
  id?: number;
};

type FoodCrudFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  groups: FoodGroup[];
  initialFood?: FoodRow | null;
  submitLabel: string;
  compactInputClass: string;
  includeId?: boolean;
};

const RELATIONAL_BASE_KEYS = new Set(["grupo_numero", "grupo_nombre", "grupo_slug"]);

export function FoodCrudForm({
  action,
  groups,
  initialFood,
  submitLabel,
  compactInputClass,
  includeId = false,
}: FoodCrudFormProps) {
  const initialGroupNumber = Number(initialFood?.grupo_numero) || groups[0]?.grupo_numero || 1;
  const [selectedGroupNumber, setSelectedGroupNumber] = useState(initialGroupNumber);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.grupo_numero === selectedGroupNumber) ?? groups[0],
    [groups, selectedGroupNumber],
  );

  return (
    <form action={action} className="space-y-5">
      {includeId && initialFood?.id ? <input type="hidden" name="id" value={initialFood.id} /> : null}

      {FOOD_FORM_SECTIONS.map((section) => (
        <div key={section.key} className="rounded-[1.25rem] border border-slate-200 bg-white/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{section.title}</p>

          {section.key === "base" ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <label className="block text-xs font-medium text-slate-600">
                Grupo nutricional
                <select
                  name="grupo_numero"
                  value={selectedGroupNumber}
                  onChange={(event) => setSelectedGroupNumber(Number(event.target.value))}
                  className={compactInputClass}
                  required
                >
                  {groups.map((group) => (
                    <option key={group.grupo_numero} value={group.grupo_numero}>
                      {group.grupo_numero}. {group.grupo_nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-600">
                Grupo nombre
                <input value={selectedGroup?.grupo_nombre ?? ""} readOnly className={`${compactInputClass} bg-slate-50`} />
                <input type="hidden" name="grupo_nombre" value={selectedGroup?.grupo_nombre ?? ""} />
              </label>

              <label className="block text-xs font-medium text-slate-600">
                Grupo slug
                <input value={selectedGroup?.grupo_slug ?? ""} readOnly className={`${compactInputClass} bg-slate-50`} />
                <input type="hidden" name="grupo_slug" value={selectedGroup?.grupo_slug ?? ""} />
              </label>

              {FOOD_FIELDS.filter((field) => field.section === "base" && !RELATIONAL_BASE_KEYS.has(field.key)).map((field) => (
                <label key={field.key} className="block text-xs font-medium text-slate-600">
                  {field.label}
                  <input
                    name={field.key}
                    type={field.type === "number" ? "number" : "text"}
                    step={field.step}
                    required={field.required}
                    defaultValue={initialFood?.[field.key] ?? ""}
                    className={compactInputClass}
                  />
                </label>
              ))}
            </div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {FOOD_FIELDS.filter((field) => field.section === section.key).map((field) => (
                <label key={field.key} className="block text-xs font-medium text-slate-600">
                  {field.label}
                  <input
                    name={field.key}
                    type={field.type === "number" ? "number" : "text"}
                    step={field.step}
                    required={field.required}
                    defaultValue={initialFood?.[field.key] ?? ""}
                    className={compactInputClass}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      ))}

      <button type="submit" className="rounded-full bg-[#0f5c4d] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0a4a3d]">
        {submitLabel}
      </button>
    </form>
  );
}