import { ArrowUpRight, ChevronRight, Send } from "lucide-react";

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article data-theme-surface className={`rounded-[9px] border border-white/10 bg-[#0D121C] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition-colors duration-300 ${className}`}>
      {children}
    </article>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  change,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  change: string;
  tone: "primary" | "success" | "blue" | "warning";
}) {
  const toneClasses = {
    primary: "from-violet-brand to-slate-950",
    success: "from-green-success to-emerald-900",
    blue: "from-blue-action to-cyan-800",
    warning: "from-amber-warn to-orange-700",
  }[tone];

  return (
    <article className={`rounded-[9px] border border-white/10 bg-gradient-to-br ${toneClasses} p-4 text-white shadow-[0_14px_34px_rgba(0,0,0,0.24)]`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-white/78">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-normal">{value}</p>
        </div>
        <button aria-label={`Open ${label}`} className="grid size-8 place-items-center rounded-full bg-white/16 text-white transition hover:bg-white/24">
          <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-white/78">
        <span>{detail}</span>
        <span className="rounded-full bg-white/16 px-2 py-0.5 font-semibold text-white">{change}</span>
      </div>
    </article>
  );
}

export function FlowItem({
  name,
  trigger,
  status,
  sent,
  rate,
  color,
}: {
  name: string;
  trigger: string;
  status: string;
  sent: string;
  rate: string;
  color: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-[7px] border border-white/10 bg-white/[0.03] p-2.5">
      <div className={`grid size-8 place-items-center rounded-full ${color} text-white`}>
        <Send size={15} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-white">{name}</p>
        <p className="mt-1 text-xs text-slate-400">
          {trigger} · {sent} sent · {rate} opens
        </p>
      </div>
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-300">{status}</span>
    </div>
  );
}

export function DataRow({ values }: { values: string[] }) {
  return (
    <div className="grid gap-3 rounded-[7px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] text-slate-300 md:grid-cols-[1.4fr_1fr_1fr_auto]">
      {values.map((value, index) => (
        <span key={`${value}-${index}`} className={index === 0 ? "font-semibold text-white" : ""}>
          {value}
        </span>
      ))}
      <ChevronRight size={15} className="hidden justify-self-end text-slate-400 md:block" />
    </div>
  );
}
