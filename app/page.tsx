import Link from "next/link";
import { redirect } from "next/navigation";

import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const code = firstParam(params?.code);
  const tokenHash = firstParam(params?.token_hash);
  const type = firstParam(params?.type);
  const next = firstParam(params?.next);

  if (code || tokenHash) {
    const forwardParams = new URLSearchParams();

    if (code) forwardParams.set("code", code);
    if (tokenHash) forwardParams.set("token_hash", tokenHash);
    if (type) forwardParams.set("type", type);
    if (next && next.startsWith("/")) forwardParams.set("next", next);

    redirect(`/auth/confirm?${forwardParams.toString()}`);
  }

  return <HomeContent />;
}

async function HomeContent() {
  const isConfigured = hasSupabaseEnv();
  let isAuthenticated = false;

  if (isConfigured) {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      isAuthenticated = Boolean(user);
    }
  }

  const workflow = [
    "Abrir paciente y revisar contexto clinico.",
    "Definir objetivo nutricional con metas cuantificables.",
    "Prescribir plan alimentario apoyado en alimentos_26_grupos.",
    "Registrar consumo real sin sobrescribir lo prescrito.",
    "Comparar plan vs consumo y revisar adherencia.",
    "Ajustar segun evolucion antropometrica y clinica.",
  ];

  const phases = [
    {
      title: "1. Seguridad y roles",
      detail:
        "Supabase Auth, perfiles, roles, RLS y acceso diferenciado para admin, nutricionista y paciente.",
    },
    {
      title: "2. Ficha clinica",
      detail:
        "Paciente, mediciones seriadas, evaluaciones alimentarias y observaciones clinicas persistentes.",
    },
    {
      title: "3. Objetivos y motor nutricional",
      detail:
        "Metas por energia, macros, fibra, sodio y calculos desde la tabla maestra por regla de 100 g.",
    },
    {
      title: "4. Planes, consumo y seguimiento",
      detail:
        "Plan alimentario, consumo real, comparativas temporales y reportes por grupo alimentario.",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-8 lg:px-10 lg:py-10">
      <section className="overflow-hidden border-b border-black pb-6 pt-4">
        <div className="zajno-marquee">
          {Array.from({ length: 2 }).map((_, index) => (
            <h1
              key={index}
              className="headline px-4 text-[4.5rem] font-extrabold leading-none md:text-[8.75rem]"
            >
              CLINICAL NUTRITION <span className="zajno-outline-text">WORKBOOK</span> SYSTEM /
            </h1>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel-strong editorial-grid relative overflow-hidden border border-black rounded-none p-8 lg:p-10">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#4cff8a]" />
          <p className="display-kicker">Nutrition OS / editorial shell</p>
          <h1 className="headline mt-5 max-w-5xl text-5xl leading-[0.92] text-black md:text-7xl">
            GESTION NUTRICIONAL CON PRESENCIA DE MARCA, NO CON LOOK DE PANEL GENERICO.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-black/68 md:text-lg">
            El sistema ya sostiene seguridad, pacientes, metas, planificacion,
            consumo real y comparativas. Ahora la interfaz cambia de tono:
            mas editorial, mas decidida y mas alineada con un producto premium.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard" className="z-btn">
              {isAuthenticated ? "Continuar al dashboard" : "Abrir dashboard"}
            </Link>
            <Link href="/patients" className="z-btn-secondary">
              Gestionar pacientes
            </Link>
            {!isAuthenticated ? (
              <Link href="/sign-in" className="z-btn-ghost">
                Configurar acceso
              </Link>
            ) : null}
          </div>
        </div>

        <aside className="zajno-card border-black rounded-none p-8">
          <p className="display-kicker">Runtime status</p>
          <div className="mt-6 border border-black bg-black p-5 text-[#f0efeb]">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#4cff8a]">
              Supabase
            </p>
            <p className="mt-3 font-[family-name:var(--font-syne)] text-3xl font-extrabold uppercase tracking-[-0.06em]">
              {isConfigured ? "Variables cargadas" : "Falta configurar"}
            </p>
            <p className="mt-4 text-sm leading-7 text-white/70">
              La app ya esta lista para trabajar con datos reales y vistas de
              adecuacion. Solo necesita conexion valida si aun no la tienes.
            </p>
          </div>

          <div className="mt-6 border border-black/16 bg-white/60 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-black/50">
              Regla del motor
            </p>
            <p className="mt-3 font-[family-name:var(--font-syne)] text-2xl font-bold uppercase tracking-[-0.05em] text-black">
              nutriente = (valor x gramos) / 100
            </p>
          </div>
        </aside>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="zajno-card rounded-none p-8">
          <p className="display-kicker">Workflow</p>
          <ol className="mt-6 space-y-3">
            {workflow.map((step, index) => (
              <li key={step} className="flex items-start gap-4 border border-black/10 bg-white/70 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-black bg-[#9d6cff] text-xs font-bold uppercase tracking-[0.18em] text-white">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="pt-0.5 text-sm leading-7 text-black/74">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {phases.map((phase, index) => (
            <article key={phase.title} className="zajno-card rounded-none p-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-black/45">
                Phase 0{index + 1}
              </p>
              <p className="mt-4 font-[family-name:var(--font-syne)] text-2xl font-bold uppercase tracking-[-0.05em] text-black">
                {phase.title}
              </p>
              <p className="mt-4 text-sm leading-7 text-black/68">
                {phase.detail}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
