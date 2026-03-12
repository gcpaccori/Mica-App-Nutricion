"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/lib/actions/auth";

const baseLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/patients", label: "Pacientes" },
  { href: "/foods", label: "Alimentos" },
];

type AppHeaderClientProps = {
  userEmail: string | null;
  fullName: string | null;
  roles: string[];
  isAuthenticated: boolean;
};

export function AppHeaderClient({
  userEmail,
  fullName,
  roles,
  isAuthenticated,
}: AppHeaderClientProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 16);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const userInitial = (fullName ?? userEmail ?? "U").slice(0, 1).toUpperCase();
  const tabLinkClass = "border border-transparent px-4 py-2 text-black transition-colors duration-200 hover:border-black hover:bg-black hover:!text-white focus-visible:border-black focus-visible:bg-black focus-visible:!text-white";
  const mobileTabLinkClass = "border border-black px-4 py-3 text-black transition-colors duration-200 hover:bg-black hover:!text-white focus-visible:bg-black focus-visible:!text-white";

  return (
    <header
      className={[
        "sticky top-0 z-40 border-b border-black/10 backdrop-blur-xl transition-all duration-300",
        scrolled
          ? "bg-[rgba(240,239,235,0.92)] shadow-[0_10px_30px_rgba(10,10,10,0.08)]"
          : "bg-[rgba(240,239,235,0.74)]",
      ].join(" ")}
    >
      <div
        className={[
          "mx-auto flex w-full max-w-7xl flex-col px-4 sm:px-6 lg:px-10",
          scrolled ? "gap-3 py-3" : "gap-5 py-4",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-4">
          <Link href="/" className="group flex min-w-0 items-center gap-3 sm:gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-black bg-black text-xs font-bold uppercase tracking-[0.3em] text-[#f0efeb] transition group-hover:bg-[#6b4c9a] group-hover:text-white sm:h-12 sm:w-12">
              MN
            </span>
            <div className="min-w-0">
              <p className="truncate font-[family-name:var(--font-syne)] text-xl font-extrabold uppercase tracking-[-0.08em] text-black sm:text-2xl">
                Mico Nutri Heald
              </p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.28em] text-black/45 sm:tracking-[0.34em]">
                Clinical nutrition system
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-3 md:flex">
            <div className="hidden border border-black/10 bg-white/50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.3em] text-black/55 xl:block">
              Workbook integrated edition
            </div>
            {isAuthenticated ? (
              <div className="flex items-center gap-3 border border-black bg-black px-4 py-3 text-[#f0efeb] shadow-[8px_8px_0_rgba(10,10,10,0.08)]">
                <div className="flex h-10 w-10 items-center justify-center border border-white/20 bg-[#6b4c9a] text-sm font-bold uppercase tracking-[0.18em] text-white">
                  {userInitial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{fullName ?? "Usuario autenticado"}</p>
                  <p className="truncate text-[11px] uppercase tracking-[0.18em] text-white/56">{userEmail}</p>
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

          <button
            type="button"
            aria-label={mobileOpen ? "Cerrar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((current) => !current)}
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-black bg-white text-black transition hover:bg-black hover:text-white md:hidden"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {mobileOpen ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : (
                <>
                  <path d="M3 6h18" />
                  <path d="M3 12h18" />
                  <path d="M3 18h18" />
                </>
              )}
            </svg>
          </button>
        </div>

        <div
          className={[
            "hidden overflow-hidden border-t border-black/10 transition-[max-height,opacity,padding,margin] duration-300 md:flex md:items-center md:justify-between md:gap-3",
            scrolled ? "md:max-h-0 md:pt-0 md:opacity-0 md:pointer-events-none" : "md:max-h-24 md:pt-3 md:opacity-100",
          ].join(" ")}
        >
          <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-black/70">
            {baseLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={tabLinkClass}
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

        <div
          className={[
            "overflow-hidden border-t border-black/10 transition-[max-height,opacity,padding] duration-300 md:hidden",
            mobileOpen ? "max-h-[80vh] py-4 opacity-100" : "max-h-0 py-0 opacity-0",
          ].join(" ")}
        >
          <div className="flex flex-col gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-3 border border-black bg-black px-4 py-3 text-[#f0efeb] shadow-[8px_8px_0_rgba(10,10,10,0.08)]">
                <div className="flex h-10 w-10 items-center justify-center border border-white/20 bg-[#6b4c9a] text-sm font-bold uppercase tracking-[0.18em] text-white">
                  {userInitial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{fullName ?? "Usuario autenticado"}</p>
                  <p className="truncate text-[11px] uppercase tracking-[0.18em] text-white/56">{userEmail}</p>
                </div>
              </div>
            ) : (
              <div className="border border-black/15 bg-white/50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.28em] text-black/50">
                Sesion no iniciada
              </div>
            )}

            <nav className="flex flex-col gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-black/70">
              {baseLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={mobileTabLinkClass}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex flex-col gap-2">
              {isAuthenticated ? (
                <form action={signOutAction}>
                  <button type="submit" className="z-btn-secondary w-full">
                    Cerrar sesion
                  </button>
                </form>
              ) : (
                <Link href="/sign-in" className="z-btn text-center">
                  Iniciar sesion
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}