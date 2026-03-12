import Link from "next/link";

type FormModalShellProps = {
  title: string;
  closeHref: string;
  children: React.ReactNode;
  eyebrow?: string;
  description?: string;
  widthClassName?: string;
};

export function FormModalShell({
  title,
  closeHref,
  children,
  eyebrow = "Formulario",
  description,
  widthClassName = "max-w-5xl",
}: FormModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <Link href={closeHref} aria-label="Cerrar modal" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden bg-[linear-gradient(180deg,_rgba(240,239,235,0.99)_0%,_rgba(247,246,241,0.99)_100%)] shadow-[0_40px_120px_-36px_rgba(10,10,10,0.48)] sm:h-auto sm:max-h-[92dvh] sm:rounded-[2rem] sm:border sm:border-black/10 ${widthClassName}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/8 px-5 py-5 sm:px-7 sm:py-6">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#6b4c9a]">{eyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">{title}</h2>
            {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
          </div>

          <Link
            href={closeHref}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-700 transition hover:border-slate-300"
            aria-label="Cerrar"
          >
            ×
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {children}
        </div>
      </section>
    </div>
  );
}