"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type MobilePatientSidebarItem = {
  key: string;
  label: string;
  description: string;
  href: string;
  active: boolean;
  index: number;
};

type MobilePatientSidebarProps = {
  currentLabel: string;
  items: MobilePatientSidebarItem[];
};

export function MobilePatientSidebar({ currentLabel, items }: MobilePatientSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <div className="fixed bottom-5 left-4 z-40 xl:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex min-h-12 items-center gap-3 rounded-full border border-black bg-black px-4 py-3 text-left text-sm font-semibold text-white shadow-[0_24px_60px_-24px_rgba(10,10,10,0.55)]"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls="mobile-patient-sidebar"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-xs font-bold uppercase tracking-[0.18em]">
            {items.find((item) => item.active)?.index ?? 1}
          </span>
          <span className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">Secciones</span>
            <span className="max-w-[9rem] truncate text-sm font-semibold text-white">{currentLabel}</span>
          </span>
        </button>
      </div>

      <div
        className={`fixed inset-0 z-50 xl:hidden ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className={`absolute inset-0 bg-black/45 transition duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
          aria-label="Cerrar navegación de la ficha"
        />

        <aside
          id="mobile-patient-sidebar"
          role="dialog"
          aria-modal="true"
          aria-label="Navegación de la ficha clínica"
          className={`absolute inset-y-0 left-0 flex w-[min(22rem,86vw)] flex-col border-r border-black/10 bg-[linear-gradient(180deg,_rgba(240,239,235,0.98)_0%,_rgba(247,246,241,0.98)_100%)] shadow-[0_28px_90px_-28px_rgba(10,10,10,0.45)] backdrop-blur-xl transition duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="border-b border-black/8 px-5 pb-4 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#6b4c9a]">Ficha clínica</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">Secciones</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Navega la ficha desde un sidebar móvil real, separado del contenido.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-700"
                aria-label="Cerrar sidebar móvil"
              >
                ×
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label="Secciones móviles de la ficha clínica">
            <div className="space-y-2">
              {items.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`block rounded-[1.15rem] border px-4 py-3 transition ${
                    item.active
                      ? "border-[#0f5c4d] bg-[#0f5c4d] text-white shadow-[0_18px_50px_-30px_rgba(15,92,77,0.9)]"
                      : "border-slate-200 bg-white/92 text-slate-700"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        item.active
                          ? "bg-white/16 text-white"
                          : "bg-[#f1f7f4] text-[#0f5c4d]"
                      }`}
                    >
                      {item.index}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold ${item.active ? "text-white" : "text-slate-950"}`}>{item.label}</p>
                      <p className={`mt-1 text-xs leading-5 ${item.active ? "text-white/78" : "text-slate-500"}`}>{item.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </nav>
        </aside>
      </div>
    </>
  );
}