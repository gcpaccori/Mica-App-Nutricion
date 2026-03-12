"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { inferToastTone, normalizeToastTone, type ToastTone } from "@/lib/toast";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
  title: string;
};

const TOAST_TITLES: Record<ToastTone, string> = {
  success: "Todo bien",
  error: "Hay que corregir algo",
  warning: "Atencion",
  info: "Aviso",
};

const TOAST_THEME: Record<ToastTone, { shell: string; pill: string; accent: string }> = {
  success: {
    shell: "border-[#0f5c4d]/20 bg-[linear-gradient(135deg,rgba(230,246,239,0.98),rgba(255,255,255,0.94))] text-[#16382f] shadow-[0_30px_90px_-44px_rgba(15,92,77,0.55)]",
    pill: "bg-[#d6ebe3] text-[#0f5c4d]",
    accent: "bg-[#0f5c4d]",
  },
  error: {
    shell: "border-[#8f3d2f]/18 bg-[linear-gradient(135deg,rgba(255,240,236,0.98),rgba(255,255,255,0.94))] text-[#512419] shadow-[0_30px_90px_-44px_rgba(143,61,47,0.42)]",
    pill: "bg-[#f6d8d2] text-[#8f3d2f]",
    accent: "bg-[#8f3d2f]",
  },
  warning: {
    shell: "border-[#9a5a1f]/18 bg-[linear-gradient(135deg,rgba(255,247,232,0.98),rgba(255,255,255,0.94))] text-[#5b3412] shadow-[0_30px_90px_-44px_rgba(154,90,31,0.42)]",
    pill: "bg-[#fff1cd] text-[#9a5a1f]",
    accent: "bg-[#9a5a1f]",
  },
  info: {
    shell: "border-black/12 bg-[linear-gradient(135deg,rgba(243,240,234,0.98),rgba(255,255,255,0.94))] text-[#201913] shadow-[0_30px_90px_-44px_rgba(10,10,10,0.24)]",
    pill: "bg-black text-[#f6f1e8]",
    accent: "bg-black",
  },
};

export function AppToastViewport() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledRef = useRef<string>("");
  const timeoutMapRef = useRef<Map<number, number>>(new Map());
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return () => {
      timeoutMapRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutMapRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const message = searchParams.get("message") ?? searchParams.get("error");
    if (!message) return;

    const key = `${pathname}?${searchParams.toString()}`;
    if (handledRef.current === key) return;
    handledRef.current = key;

    const tone = normalizeToastTone(searchParams.get("toast")) ?? inferToastTone(message);
    const title = searchParams.get("title") ?? TOAST_TITLES[tone];
    const id = Date.now() + Math.floor(Math.random() * 1000);

    setToasts((current) => [...current.slice(-2), { id, message, tone, title }]);

    const timeoutId = window.setTimeout(() => {
      timeoutMapRef.current.delete(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4800);

    timeoutMapRef.current.set(id, timeoutId);

    const nextSearch = new URLSearchParams(searchParams.toString());
    nextSearch.delete("message");
    nextSearch.delete("error");
    nextSearch.delete("toast");
    nextSearch.delete("title");

    const nextHref = nextSearch.toString() ? `${pathname}?${nextSearch.toString()}` : pathname;
    router.replace(nextHref, { scroll: false });
  }, [pathname, router, searchParams]);

  function dismissToast(id: number) {
    const timeoutId = timeoutMapRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutMapRef.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[120] flex justify-end px-4 sm:top-14 sm:px-6 lg:px-8">
      <div className="flex w-full max-w-sm flex-col gap-3" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          const theme = TOAST_THEME[toast.tone];

          return (
            <section
              key={toast.id}
              className={`toast-zajno pointer-events-auto overflow-hidden border backdrop-blur-2xl ${theme.shell}`}
            >
              <div className="relative">
                <div className={`absolute inset-y-0 left-0 w-2 ${theme.accent}`} />
                <div className="pl-5">
                  <div className="flex items-start gap-3 p-4">
                    <div className={`mt-0.5 inline-flex shrink-0 rounded-none px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.28em] ${theme.pill}`}>
                      {toast.tone}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-[family-name:var(--font-syne)] text-base font-semibold uppercase tracking-[-0.04em]">
                        {toast.title}
                      </p>
                      <p className="mt-1 text-sm leading-5 opacity-85">{toast.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissToast(toast.id)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-black/10 bg-white/45 text-xs font-semibold text-black/65 transition hover:bg-black hover:text-white"
                      aria-label="Cerrar aviso"
                    >
                      x
                    </button>
                  </div>
                </div>
              </div>
              <div className="px-4 pb-3 pl-5">
                <div className="h-1.5 w-full overflow-hidden border border-black/8 bg-white/35">
                  <div className={`toast-zajno-progress h-full w-full origin-left ${theme.accent}`} />
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}