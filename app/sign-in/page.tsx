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
      label: "Acceso en preparacion",
      detail: "Estamos terminando la configuracion del ingreso seguro.",
      tone: "warning" as const,
    };
  }

  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return {
      label: "Acceso en preparacion",
      detail: "Todavia no pudimos abrir el acceso seguro de la app.",
      tone: "warning" as const,
    };
  }

  const { data, error } = await supabase.rpc("calculate_bmi", {
    weight_kg: 70,
    height_m: 1.7,
  });

  if (error) {
    return {
      label: "Ingreso casi listo",
      detail: "La app ya reconoce la conexion, pero aun falta completar el cierre del acceso.",
      tone: "warning" as const,
    };
  }

  return {
    label: "Acceso listo",
    detail: `Tu cuenta puede entrar y confirmar correo desde la version oficial de la app.`,
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

  const wellnessNotes = [
    "Los planes que se adaptan a la rutina suelen sostenerse mejor con el tiempo.",
    "Comer con estructura diaria ayuda a tomar decisiones con menos cansancio.",
    "La adherencia mejora cuando el plan respeta gustos, cultura y horarios reales.",
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(214,235,227,0.62),_transparent_32%),linear-gradient(180deg,_#fffdf8_0%,_#f5efe4_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="grid gap-4 sm:grid-cols-2 sm:grid-rows-[1.1fr_0.9fr]">
            <article className="relative overflow-hidden rounded-[2rem] border border-[#dfd4c4] bg-[#f3e6d1] sm:row-span-2">
              <img
                src="https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80"
                alt="Preparacion de alimentos frescos con vegetales y frutas"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2c241c]/72 via-[#2c241c]/22 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Bienestar diario</p>
                <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
                  Ingresar deberia sentirse tan claro y amable como una buena consulta.
                </h1>
              </div>
            </article>

            <article className="relative overflow-hidden rounded-[2rem] border border-[#d6dccf] bg-[#deeadf]">
              <img
                src="https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=1000&q=80"
                alt="Mesa con alimentos coloridos y preparaciones frescas"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#305847]/48 to-transparent" />
            </article>

            <article className="rounded-[2rem] border border-[#dfe4d8] bg-[#f8fbf7] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#58705f]">Notas utiles</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[#4d5c53]">
                {wellnessNotes.map((note) => (
                  <li key={note} className="rounded-[1.25rem] bg-white px-4 py-3 shadow-[0_18px_40px_-34px_rgba(47,107,82,0.55)]">
                    {note}
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <div className="rounded-[2rem] border border-[#ddd2c0] bg-[#fffaf3]/95 p-7 shadow-[0_30px_90px_-44px_rgba(98,72,38,0.32)] sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8c6a3d]">Acceso</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#2f2418] sm:text-4xl">
                  Entra, confirma tu correo y sigue cuidando el proceso sin rodeos.
                </h2>
              </div>
              <div className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${status.tone === "success" ? "bg-[#e4f4ea] text-[#2f6b52]" : "bg-[#fff1da] text-[#9a6a27]"}`}>
                {status.label}
              </div>
            </div>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#6c5740] sm:text-base">
              {status.detail}
            </p>

            <div className="mt-8 grid gap-5 xl:grid-cols-2">
              <form action={signInAction} className="rounded-[1.7rem] border border-[#e8dccb] bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8c6a3d]">Ya tengo cuenta</p>
                <input type="hidden" name="next" value={next} />
                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-medium text-[#5f4b35]">
                    Correo
                    <input
                      name="email"
                      type="email"
                      className="mt-2 w-full rounded-[1rem] border border-[#e6dccf] bg-[#fffdf9] px-4 py-3 text-sm text-[#2f2418] outline-none transition focus:border-[#2f6b52]"
                      placeholder="nutri@consulta.com"
                      required
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#5f4b35]">
                    Contrasena
                    <input
                      name="password"
                      type="password"
                      className="mt-2 w-full rounded-[1rem] border border-[#e6dccf] bg-[#fffdf9] px-4 py-3 text-sm text-[#2f2418] outline-none transition focus:border-[#2f6b52]"
                      placeholder="Ingresa tu contrasena"
                      required
                    />
                  </label>
                </div>
                <button type="submit" className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#2f6b52] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#255640]">
                  Iniciar sesion
                </button>
              </form>

              <form action={signUpAction} className="rounded-[1.7rem] border border-[#dce6dc] bg-[#f8fbf7] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#55705d]">Crear cuenta</p>
                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-medium text-[#425248]">
                    Nombre completo
                    <input
                      name="full_name"
                      type="text"
                      className="mt-2 w-full rounded-[1rem] border border-[#dce4db] bg-white px-4 py-3 text-sm text-[#23362c] outline-none transition focus:border-[#2f6b52]"
                      placeholder="Micaela Gonzales"
                      required
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#425248]">
                    Correo
                    <input
                      name="email"
                      type="email"
                      className="mt-2 w-full rounded-[1rem] border border-[#dce4db] bg-white px-4 py-3 text-sm text-[#23362c] outline-none transition focus:border-[#2f6b52]"
                      placeholder="mica@consulta.com"
                      required
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#425248]">
                    Contrasena
                    <input
                      name="password"
                      type="password"
                      className="mt-2 w-full rounded-[1rem] border border-[#dce4db] bg-white px-4 py-3 text-sm text-[#23362c] outline-none transition focus:border-[#2f6b52]"
                      placeholder="Crea una contrasena segura"
                      required
                    />
                  </label>
                </div>
                <button type="submit" className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-[#2f6b52]/18 bg-white px-6 py-3 text-sm font-semibold text-[#2f6b52] transition hover:bg-[#eef6f1]">
                  Crear cuenta
                </button>
              </form>
            </div>
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
        <div className="rounded-[1.6rem] border border-[#e6dccf] bg-white/80 px-6 py-4 text-sm leading-7 text-[#6b5640]">
          Si acabas de crear tu cuenta, abre el correo de confirmacion y entra desde el enlace oficial de la app.
        </div>
      ) : null}
      </div>
    </main>
  );
}