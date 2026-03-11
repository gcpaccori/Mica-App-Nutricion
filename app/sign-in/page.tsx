import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { hasSupabaseEnv } from "@/lib/env";
import { signInAction, signUpAction } from "@/lib/actions/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Acceso | Mico Nutri Heald",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getMessage(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

async function getSupabaseStatus() {
  if (!hasSupabaseEnv()) {
    return {
      label: "Variables pendientes",
      detail: "Faltan variables de entorno para inicializar Supabase.",
      tone: "warning" as const,
    };
  }

  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return {
      label: "Variables pendientes",
      detail: "No se pudo crear el cliente de servidor de Supabase.",
      tone: "warning" as const,
    };
  }

  const { data, error } = await supabase.rpc("calculate_bmi", {
    weight_kg: 70,
    height_m: 1.7,
  });

  if (error) {
    return {
      label: "Supabase con variables pero migracion incompleta",
      detail:
        "Se encontro Supabase, pero la funcion calculate_bmi no respondio. Ejecuta la migracion clinica inicial.",
      tone: "warning" as const,
    };
  }

  return {
    label: "Supabase y migracion clinica listos",
    detail: `Conexion operativa. Prueba de backend correcta con calculate_bmi = ${data}.`,
    tone: "success" as const,
  };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const message = getMessage(params?.message);
  const next = getMessage(params?.next) ?? "/dashboard";
  const status = await getSupabaseStatus();
  const isConfigured = hasSupabaseEnv();

  if (isConfigured) {
    const supabase = await createServerSupabaseClient();

    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        redirect(next);
      }
    }
  }

  const isEmailConfirmationMessage =
    message?.toLowerCase().includes("confirma") ||
    message?.toLowerCase().includes("email not confirmed");

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="panel-strong editorial-grid relative overflow-hidden rounded-none border border-black p-8 lg:p-10">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#9d6cff]" />
          <p className="display-kicker">Access control / roles / auth</p>
          <h1 className="headline mt-5 text-5xl leading-[0.92] text-black md:text-6xl">
            LA CAPA DE SEGURIDAD TAMBIEN DEBE SENTIRSE COMO PRODUCTO.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-black/68">
            Esta entrada resuelve autenticacion con Supabase y prepara el rol
            operativo antes de tocar dashboard, paciente, plan o reportes.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="border border-black bg-black p-5 text-[#f0efeb]">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#4cff8a]">Config</p>
              <p className="mt-3 font-[family-name:var(--font-syne)] text-2xl font-bold uppercase tracking-[-0.05em]">
                {status.label}
              </p>
              <p className="mt-3 text-sm leading-7 text-white/72">{status.detail}</p>
            </div>
            <div className="border border-black/16 bg-white/68 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-black/48">
                Roles base
              </p>
              <p className="mt-3 font-[family-name:var(--font-syne)] text-2xl font-bold uppercase tracking-[-0.05em] text-black">
                admin / nutritionist / patient
              </p>
              <p className="mt-3 text-sm leading-7 text-black/68">
                El control fino se resuelve desde roles y asignaciones ya
                cargadas en la base.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <form action={signInAction} className="zajno-card rounded-none p-7">
            <p className="display-kicker">Ingresar</p>
            <input type="hidden" name="next" value={next} />
            <div className="mt-5 space-y-4">
              <label className="block text-[11px] font-bold uppercase tracking-[0.24em] text-black/55">
                Email
                <input
                  name="email"
                  type="email"
                  className="mt-2 w-full px-4 py-3"
                  placeholder="nutri@consulta.com"
                  required
                />
              </label>
              <label className="block text-[11px] font-bold uppercase tracking-[0.24em] text-black/55">
                Password
                <input
                  name="password"
                  type="password"
                  className="mt-2 w-full px-4 py-3"
                  placeholder="********"
                  required
                />
              </label>
            </div>
            <button type="submit" className="z-btn mt-6 w-full">
              Iniciar sesion
            </button>
          </form>

          <form action={signUpAction} className="zajno-card rounded-none p-7">
            <p className="display-kicker">Alta inicial</p>
            <div className="mt-5 space-y-4">
              <label className="block text-[11px] font-bold uppercase tracking-[0.24em] text-black/55">
                Nombre completo
                <input
                  name="full_name"
                  type="text"
                  className="mt-2 w-full px-4 py-3"
                  placeholder="Dra. Micaela"
                  required
                />
              </label>
              <label className="block text-[11px] font-bold uppercase tracking-[0.24em] text-black/55">
                Email
                <input
                  name="email"
                  type="email"
                  className="mt-2 w-full px-4 py-3"
                  placeholder="mica@consulta.com"
                  required
                />
              </label>
              <label className="block text-[11px] font-bold uppercase tracking-[0.24em] text-black/55">
                Password
                <input
                  name="password"
                  type="password"
                  className="mt-2 w-full px-4 py-3"
                  placeholder="Minimo recomendado por Supabase"
                  required
                />
              </label>
            </div>
            <button type="submit" className="z-btn-secondary mt-6 w-full">
              Crear cuenta
            </button>
          </form>
        </div>
      </section>

      {message ? (
        <div
          className={
            isEmailConfirmationMessage
              ? "rounded-[1.6rem] border border-[#d97706]/20 bg-[#fff7e8] px-6 py-4 text-sm text-[#9a5a1f]"
              : "panel rounded-[1.6rem] px-6 py-4 text-sm text-slate-700"
          }
        >
          {message}
        </div>
      ) : null}

      {isConfigured ? (
        <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/75 px-6 py-4 text-sm leading-7 text-slate-600">
          Si al crear cuenta no puedes entrar y ves el mensaje de confirmacion,
          el problema no es el rol. Primero debes confirmar el email en Supabase
          Auth o desactivar la opcion <strong>Confirm email</strong> para desarrollo.
        </div>
      ) : null}
    </main>
  );
}