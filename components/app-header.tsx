import Link from "next/link";

import { signOutAction } from "@/lib/actions/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RoleRelation = { code?: string | null; name?: string | null } | Array<{ code?: string | null; name?: string | null }> | null;

const baseLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/patients", label: "Pacientes" },
  { href: "/foods", label: "Alimentos" },
];

export async function AppHeader() {
  let userEmail: string | null = null;
  let fullName: string | null = null;
  let roles: string[] = [];

  if (hasSupabaseEnv()) {
    const supabase = await createServerSupabaseClient();

    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        userEmail = user.email ?? null;

        const [{ data: profile }, { data: roleRows }] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
          supabase.from("user_roles").select("roles(code, name)").eq("user_id", user.id),
        ]);

        fullName = profile?.full_name ?? null;
        roles =
          roleRows
            ?.flatMap((row) => {
              const relation = row.roles as RoleRelation;

              if (Array.isArray(relation)) {
                return relation.map((item) => item?.code).filter(Boolean);
              }

              return relation?.code ? [relation.code] : [];
            })
            .filter(Boolean) as string[] ?? [];
      }
    }
  }

  const isAuthenticated = Boolean(userEmail);

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-[rgba(240,239,235,0.74)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-4 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Link href="/" className="group flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center border border-black bg-black text-xs font-bold uppercase tracking-[0.3em] text-[#f0efeb] transition group-hover:bg-[#6b4c9a] group-hover:text-white">
              MN
            </span>
            <div>
              <p className="font-[family-name:var(--font-syne)] text-2xl font-extrabold uppercase tracking-[-0.08em] text-black">
                Mico Nutri Heald
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-black/45">
                Clinical nutrition system
              </p>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden border border-black/10 bg-white/50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.3em] text-black/55 md:block">
              Workbook integrated edition
            </div>
            {isAuthenticated ? (
              <div className="flex items-center gap-3 border border-black bg-black px-4 py-3 text-[#f0efeb] shadow-[8px_8px_0_rgba(10,10,10,0.08)]">
                <div className="flex h-10 w-10 items-center justify-center border border-white/20 bg-[#6b4c9a] text-sm font-bold uppercase tracking-[0.18em] text-white">
                  {(fullName ?? userEmail ?? "U").slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{fullName ?? "Usuario autenticado"}</p>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/56">{userEmail}</p>
                </div>
                {roles.length ? (
                  <div className="hidden flex-wrap gap-2 xl:flex">
                    {roles.slice(0, 2).map((role) => (
                      <span
                        key={role}
                        className="border border-white/18 bg-white/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#4cff8a]"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="border border-black/15 bg-white/50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.28em] text-black/50">
                Sesion no iniciada
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3">
          <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-black/70">
            {baseLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="border border-transparent px-4 py-2 transition hover:border-black hover:bg-black hover:text-[#f0efeb]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            {isAuthenticated ? (
              <form action={signOutAction}>
                <button type="submit" className="z-btn-secondary">
                  Cerrar sesion
                </button>
              </form>
            ) : (
              <Link href="/sign-in" className="z-btn">
                Iniciar sesion
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}