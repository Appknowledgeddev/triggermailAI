import { Bot, MailCheck, Search, UserPlus, Webhook, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panels";

const rows = [
  ["Email sent to 128 subscribers", "Email", "2 minutes ago", MailCheck],
  ["Flow 'Welcome Series' executed", "Flow", "5 minutes ago", Zap],
  ["Subscriber added", "Subscriber", "12 minutes ago", UserPlus],
  ["Email opened", "Email", "15 minutes ago", MailCheck],
  ["AI draft generated", "AI", "18 minutes ago", Bot],
  ["Webhook received", "Webhook", "2 hours ago", Webhook],
];

export default function ActivityPage() {
  return (
    <AppShell eyebrow="Activity Logs" title="Activity" description="Review all your system activity." primaryAction="Export" secondaryAction="All Time">
      <Panel className="mt-4">
        <div className="flex flex-wrap gap-3">
          <button className="rounded-[8px] border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200">All Activity</button>
          <button className="rounded-[8px] border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200">All Time</button>
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input className="h-10 w-full rounded-[8px] border border-white/10 bg-white/[0.04] pl-10 text-sm text-white outline-none placeholder:text-slate-500" placeholder="Search activity..." />
          </div>
        </div>
        <div className="mt-6 overflow-hidden rounded-[8px] border border-white/10">
          <div className="grid grid-cols-[1fr_140px_150px] border-b border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <span>Event</span><span>Type</span><span>Time</span>
          </div>
          {rows.map(([event, type, time, Icon]) => (
            <div key={event as string} className="grid grid-cols-[1fr_140px_150px] items-center border-b border-white/10 px-4 py-4 text-sm last:border-b-0">
              <span className="flex items-center gap-3 text-slate-200"><Icon size={16} className="text-fuchsia-300" />{event as string}</span>
              <span className="text-slate-400">{type as string}</span>
              <span className="text-slate-500">{time as string}</span>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
