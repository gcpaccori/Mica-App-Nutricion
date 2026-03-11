import { redirect } from "next/navigation";
import Link from "next/link";

import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RoleRelation = { code?: string | null } | Array<{ code?: string | null }> | null;

type CountResult = {
  count: number | null;
  error: string | null;
};

async function getCount(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  table: string,
  filter?: [column: string, value: string | boolean],
): Promise<CountResult> {
  let query = supabase.from(table).select("id", { count: "exact", head: true });

  if (filter) {
    query = query.eq(filter[0], filter[1]);
  }

  const { count, error } = await query;
  return { count, error: error?.message ?? null };
}

export default async function DashboardPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-12 lg:px-10">
        <div className="panel rounded-[2rem] p-8 text-slate-700">
          Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
          para habilitar autenticacion, queries clinicas y RLS.
        </div>
      </main>
    );
  }

  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    redirect("/sign-in");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [
    { data: profile },
    { data: roleRows },
    patientCount,
    activeNutritionCaseCount,
    activePlanCount,
    { data: recentPatients, error: recentPatientsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("roles(code, name)")
      .eq("user_id", user.id),
    getCount(supabase, "patients"),
    getCount(supabase, "nutrition_plan", ["status", "active"]),
    getCount(supabase, "diet_plans", ["status", "active"]),
    supabase
      .from("patients")
      .select("id, first_name, last_name, activity_level, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const roles =
    roleRows
      ?.flatMap((row) => {
        const relation = row.roles as RoleRelation;

        if (Array.isArray(relation)) {
          return relation.map((item) => item?.code).filter(Boolean);
        }

        return relation?.code ? [relation.code] : [];
      })
      .filter(Boolean) ?? [];

  const cards = [
    {
      label: "Pacientes",
      value: patientCount.count ?? 0,
      helper: patientCount.error ?? "Ficha clinica y seguimiento longitudinal.",
    },
    {
      label: "Casos activos",
      value: activeNutritionCaseCount.count ?? 0,
      helper: activeNutritionCaseCount.error ?? "Caso formal integrado con metas macro, micro y distribución.",
    },
    {
      label: "Planes activos",
      value: activePlanCount.count ?? 0,
      helper: activePlanCount.error ?? "Plan y consumo siempre separados.",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10 lg:py-14">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel-strong rounded-[2rem] p-8 lg:p-10">
          <p className="eyebrow">Vista rapida</p>
          <h1 className="headline mt-4 text-4xl leading-tight text-slate-950 md:text-5xl">
            {profile?.full_name ?? user.email ?? "Panel clinico"}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
            Esta primera entrega ya deja lista la base de acceso, ficha de
            paciente y estructura para que el backend calcule desde
            public.alimentos_26_grupos.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {roles.length ? (
              roles.map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-[#d6ebe3] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0f5c4d]"
                >
                  {role}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-[#fff3db] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#9a5a1f]">
                Sin rol asignado aun
              </span>
            )}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-8">
          <p className="eyebrow">Accion</p>
          <p className="mt-4 text-lg font-semibold text-slate-950">
            Flujo operativo recomendado
          </p>
          <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
            <li>1. Validar roles y acceso RLS.</li>
            <li>2. Completar ficha clinica del paciente.</li>
            <li>3. Definir objetivos y referencias nutricionales.</li>
            <li>4. Prescribir plan con alimentos_26_grupos.</li>
            <li>5. Registrar consumo real y contrastar.</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/patients"
              className="rounded-full bg-[#123f37] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0e312b]"
            >
              Ir a pacientes
            </Link>
            <Link
              href="/foods"
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white"
            >
              Revisar alimentos
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {cards.map((card) => (
          <article key={card.label} className="panel rounded-[2rem] p-7">
            <p className="text-sm font-semibold text-slate-500">{card.label}</p>
            <p className="mt-3 text-4xl font-semibold text-slate-950">{card.value}</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">{card.helper}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="panel rounded-[2rem] p-8">
          <p className="eyebrow">Motor nutricional</p>
          <div className="mt-5 rounded-[1.6rem] bg-[#143d35] p-6 text-[#f4f8f5]">
            <p className="text-sm uppercase tracking-[0.24em] text-[#9fd0c0]">
              Formula central
            </p>
            <p className="mt-3 text-lg leading-8">
              nutriente_aportado = (valor_por_100g x gramos_consumidos) / 100
            </p>
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-600">
            La migracion incluye funciones SQL para IMC, porcentaje de adecuacion,
            cambio de peso, escalado por porcion y vistas comparativas entre plan
            y consumo.
          </p>
        </div>

        <div className="panel rounded-[2rem] p-8">
          <p className="eyebrow">Pacientes recientes</p>
          <div className="mt-5 space-y-4">
            {recentPatientsError ? (
              <div className="rounded-[1.4rem] bg-[#fff3db] p-4 text-sm text-[#9a5a1f]">
                {recentPatientsError.message}
              </div>
            ) : recentPatients?.length ? (
              recentPatients.map((patient) => (
                <a
                  key={patient.id}
                  href={`/patients/${patient.id}`}
                  className="rounded-[1.4rem] border border-[#0f5c4d]/10 bg-white/80 p-4 block transition hover:border-[#0f5c4d]/30"
                >
                  <p className="font-semibold text-slate-950">
                    {patient.first_name} {patient.last_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Actividad: {patient.activity_level ?? "sedentary"}
                  </p>
                  <p className="mt-1 text-xs text-[#0f5c4d] font-semibold">Ver ficha →</p>
                </a>
              ))
            ) : (
              <div className="rounded-[1.4rem] border border-dashed border-[#0f5c4d]/20 bg-white/80 p-4 text-sm text-slate-600">
                Todavia no hay pacientes cargados para esta cuenta.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}