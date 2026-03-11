import { redirect } from "next/navigation";

import { FoodCrudForm } from "@/components/food-crud-form";
import { createFoodAction, deleteFoodAction, updateFoodAction } from "@/lib/actions/foods";
import { FOOD_TABLE_COLUMNS } from "@/lib/foods/fields";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type FoodRow = Record<string, string | number | null> & {
  id: number;
  alimento?: string | null;
};

function msg(v?: string | string[]) {
  return Array.isArray(v) ? v[0] : v;
}

function formatCellValue(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

export default async function FoodCatalogPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sp = searchParams ? await searchParams : {};
  const query = msg(sp.q) ?? "";
  const grupo = msg(sp.grupo) ?? "";
  const page = Math.max(1, Number(msg(sp.page)) || 1);
  const editId = Number(msg(sp.edit)) || null;
  const message = msg(sp.message);
  const pageSize = 30;

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: groups } = await supabase
    .from("alimentos_26_grupos")
    .select("grupo_numero, grupo_nombre, grupo_slug")
    .order("grupo_numero");

  const uniqueGroups = groups
    ? Array.from(new Map(groups.map((group) => [group.grupo_numero, group])).values())
    : [];

  let foodQuery = supabase
    .from("alimentos_26_grupos")
    .select("*", { count: "exact" });

  if (query) {
    foodQuery = foodQuery.ilike("alimento", `%${query}%`);
  }

  if (grupo) {
    foodQuery = foodQuery.eq("grupo_numero", Number(grupo));
  }

  const { data: foodsData, count } = await foodQuery
    .order("grupo_numero")
    .order("alimento")
    .range((page - 1) * pageSize, page * pageSize - 1);

  const foods = (foodsData ?? []) as FoodRow[];
  const totalPages = Math.ceil((count ?? 0) / pageSize);
  const selectedFood = editId
    ? foods.find((food) => Number(food.id) === editId)
      ?? ((await supabase.from("alimentos_26_grupos").select("*").eq("id", editId).maybeSingle()).data as FoodRow | null)
    : null;

  const inputClass = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-[#0f5c4d] focus:outline-none";
  const compactInputClass = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-[#0f5c4d] focus:outline-none";

  return (
    <main className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-8 lg:px-8 lg:py-12">
      <section className="panel-strong rounded-[2rem] p-8">
        <p className="eyebrow">Catálogo de alimentos</p>
        <h1 className="headline mt-3 text-3xl font-semibold text-slate-950 md:text-4xl">
          CRUD de alimentos_26_grupos
        </h1>
        <p className="mt-3 max-w-4xl text-base text-slate-600">
          Aquí puedes crear, editar y eliminar alimentos del catálogo, y revisar todas las columnas nutricionales en una tabla compacta con columnas delgadas para que todo quepa.
        </p>
      </section>

      {message && (
        <div className="rounded-[1.25rem] border border-[#0f5c4d]/15 bg-white/80 px-5 py-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      <section className="panel rounded-[2rem] p-7">
        <form className="flex flex-wrap gap-4">
          <div className="min-w-[220px] flex-1">
            <input name="q" defaultValue={query} placeholder="Buscar alimento..." className={inputClass} />
          </div>
          <div className="w-56">
            <select name="grupo" defaultValue={grupo} className={inputClass}>
              <option value="">Todos los grupos</option>
              {uniqueGroups.map((group) => (
                <option key={group.grupo_numero} value={group.grupo_numero}>
                  {group.grupo_numero}. {group.grupo_nombre}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-full bg-[#0f5c4d] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0a4a3d]">
            Buscar
          </button>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="panel rounded-[2rem] p-7">
          <p className="eyebrow">Agregar alimento</p>
          <p className="mt-2 text-sm text-slate-500">La sección base se amarra a los 26 grupos: eliges el grupo y el nombre/slug se completan correlacionados.</p>

          <div className="mt-4">
            <FoodCrudForm
              action={createFoodAction}
              groups={uniqueGroups as Array<{ grupo_numero: number; grupo_nombre: string; grupo_slug: string }>}
              submitLabel="Crear alimento"
              compactInputClass={compactInputClass}
            />
          </div>
        </div>

        <div className="panel rounded-[2rem] p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Editar alimento</p>
              <p className="mt-2 text-sm text-slate-500">Abre una fila desde la tabla para editarla o eliminarla.</p>
            </div>
            {selectedFood && (
              <a href="/foods" className="text-sm font-semibold text-[#0f5c4d] hover:underline">
                Limpiar
              </a>
            )}
          </div>

          {selectedFood ? (
            <>
              <div className="mt-4 rounded-[1rem] bg-[#f1f7f4] px-4 py-3 text-sm text-slate-700">
                Editando ID {selectedFood.id}: {selectedFood.alimento}
              </div>
              <div className="mt-4">
                <FoodCrudForm
                  action={updateFoodAction}
                  groups={uniqueGroups as Array<{ grupo_numero: number; grupo_nombre: string; grupo_slug: string }>}
                  initialFood={selectedFood}
                  submitLabel="Guardar cambios"
                  compactInputClass={compactInputClass}
                  includeId
                />
              </div>

              <form action={deleteFoodAction} className="mt-4 border-t border-slate-200 pt-4">
                <input type="hidden" name="id" value={selectedFood.id} />
                <button type="submit" className="rounded-full border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100">
                  Eliminar alimento
                </button>
              </form>
            </>
          ) : (
            <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-300 bg-white/60 px-5 py-8 text-sm text-slate-500">
              Selecciona una fila desde la tabla para abrir la edición completa del alimento.
            </div>
          )}
        </div>
      </section>

      <section className="panel rounded-[2rem] p-7">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500">{count ?? 0} alimentos encontrados</p>
          {totalPages > 1 && (
            <div className="flex gap-2 text-sm">
              {page > 1 && (
                <a href={`/foods?q=${encodeURIComponent(query)}&grupo=${grupo}&page=${page - 1}`} className="rounded-full border border-slate-200 px-4 py-1.5 hover:bg-white">
                  ← Anterior
                </a>
              )}
              <span className="px-2 py-1.5 text-slate-500">Pag {page}/{totalPages}</span>
              {page < totalPages && (
                <a href={`/foods?q=${encodeURIComponent(query)}&grupo=${grupo}&page=${page + 1}`} className="rounded-full border border-slate-200 px-4 py-1.5 hover:bg-white">
                  Siguiente →
                </a>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[3200px] table-fixed border-collapse text-[10px] leading-tight text-slate-700">
            <thead>
              <tr className="border-b border-slate-200 bg-[#f8fbfa] text-left uppercase tracking-wide text-slate-500">
                <th className="sticky left-0 z-20 w-16 border-r border-slate-200 bg-[#f8fbfa] px-2 py-2">Acc.</th>
                {FOOD_TABLE_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    title={column.label}
                    className={`border-r border-slate-200 px-1 py-2 ${column.key === "alimento" ? "w-44" : column.key === "grupo_nombre" || column.key === "grupo_slug" ? "w-28" : "w-16"}`}
                  >
                    {column.shortLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {foods.map((food) => (
                <tr key={food.id} className="border-b border-slate-100 hover:bg-[#f1f7f4]/50">
                  <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-1 py-1.5 align-top">
                    <a
                      href={`/foods?q=${encodeURIComponent(query)}&grupo=${grupo}&page=${page}&edit=${food.id}`}
                      className="block rounded-full bg-[#d6ebe3] px-1.5 py-1 text-center text-[10px] font-semibold text-[#0f5c4d]"
                    >
                      Editar
                    </a>
                  </td>
                  {FOOD_TABLE_COLUMNS.map((column) => (
                    <td
                      key={`${food.id}-${column.key}`}
                      title={String(food[column.key] ?? "")}
                      className={`border-r border-slate-100 px-1 py-1.5 align-top whitespace-nowrap ${column.key === "alimento" || column.key === "grupo_nombre" || column.key === "grupo_slug" ? "overflow-hidden text-ellipsis text-left" : "text-right tabular-nums"}`}
                    >
                      {formatCellValue(food[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!foods.length && <p className="py-8 text-center text-sm text-slate-500">No se encontraron alimentos con ese criterio.</p>}
        </div>
      </section>
    </main>
  );
}
