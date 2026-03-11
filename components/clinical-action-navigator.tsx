import Link from "next/link";

type ClinicalActionStatus = "done" | "next" | "pending";

export type ClinicalActionStep = {
  step: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  status: ClinicalActionStatus;
  evidence?: string | null;
};

type ClinicalActionNavigatorProps = {
  eyebrow?: string;
  title: string;
  intro?: string;
  steps: ClinicalActionStep[];
};

const statusMap = {
  done: {
    label: "Hecho",
    cardClass: "border-[#0f5c4d]/18 bg-[#eef7f3]",
    badgeClass: "bg-[#d6ebe3] text-[#0f5c4d]",
    actionClass: "border-[#0f5c4d]/16 bg-white text-[#0f5c4d] hover:bg-[#f1f7f4]",
  },
  next: {
    label: "Siguiente",
    cardClass: "border-[#9a5a1f]/18 bg-[#fff8ea]",
    badgeClass: "bg-[#fff1cd] text-[#9a5a1f]",
    actionClass: "bg-[#0f5c4d] text-white hover:bg-[#0a4a3d]",
  },
  pending: {
    label: "Pendiente",
    cardClass: "border-slate-200 bg-white/75",
    badgeClass: "bg-slate-200 text-slate-600",
    actionClass: "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
  },
} as const;

export function ClinicalActionNavigator({
  eyebrow = "Ruta guiada",
  title,
  intro,
  steps,
}: ClinicalActionNavigatorProps) {
  return (
    <section className="panel rounded-[2rem] p-7 lg:p-8">
      <p className="eyebrow">{eyebrow}</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="headline text-2xl font-semibold text-slate-950">{title}</h2>
          {intro ? (
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{intro}</p>
          ) : null}
        </div>
        <div className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {steps.filter((step) => step.status === "done").length}/{steps.length} hitos listos
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {steps.map((step) => {
          const status = statusMap[step.status];

          return (
            <article
              key={step.step}
              className={`flex h-full flex-col rounded-[1.5rem] border p-5 ${status.cardClass}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Paso {step.step}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">{step.title}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${status.badgeClass}`}>
                  {status.label}
                </span>
              </div>

              <p className="mt-3 text-sm leading-7 text-slate-600">{step.description}</p>

              {step.evidence ? (
                <div className="mt-4 rounded-[1rem] border border-black/5 bg-white/70 px-4 py-3 text-xs leading-6 text-slate-500">
                  {step.evidence}
                </div>
              ) : null}

              <div className="mt-5 pt-1">
                <Link
                  href={step.href}
                  className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold transition ${status.actionClass}`}
                >
                  {step.actionLabel}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}