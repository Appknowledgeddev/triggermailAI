import { Activity, CalendarDays, MailCheck, MousePointerClick, Plus, Radio, Sparkles, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricCard, Panel } from "@/components/panels";

const stats = [
  { label: "Emails Sent", value: "128,924", change: "+12.5%", detail: "vs last month", tone: "primary" as const },
  { label: "Open Rate", value: "42.7%", change: "+8.3%", detail: "vs last month", tone: "success" as const },
  { label: "Click Rate", value: "18.3%", change: "+6.7%", detail: "vs last month", tone: "blue" as const },
  { label: "Active Flows", value: "24", change: "+4", detail: "vs last month", tone: "warning" as const },
];

const chart = [6, 12, 18, 15, 21, 28, 25, 30, 35, 31, 37, 34];
const topFlows = [
  ["Welcome Series", "12,643", "+15.2%"],
  ["Abandoned Cart", "8,312", "+11.7%"],
  ["Product Launch", "7,421", "+9.3%"],
  ["Re-engagement", "6,125", "+8.1%"],
  ["Trial Expiry", "4,213", "+6.4%"],
];

export default function Home() {
  return (
    <AppShell
      eyebrow="Dashboard"
      title="Dashboard"
      description="Overview of your email automation."
      primaryAction="New"
      secondaryAction="May 12 - Jun 12, 2024"
    >
      <section className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {stats.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Emails Sent</h2>
            <button className="rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300">Daily</button>
          </div>
          <div className="mt-8 h-72">
            <div className="flex h-full items-end gap-3 border-b border-l border-white/10 px-3 pb-3">
              {chart.map((height, index) => (
                <div key={`${height}-${index}`} className="flex flex-1 flex-col items-center justify-end gap-3">
                  <div
                    className="w-full rounded-t-[6px] bg-gradient-to-t from-fuchsia-600 to-violet-brand shadow-[0_0_28px_rgba(217,70,239,0.25)]"
                    style={{ height: `${height * 2}%` }}
                  />
                  <span className="text-[10px] text-slate-500">{index % 3 === 0 ? ["May 12", "May 19", "May 26", "Jun 2"][index / 3] : ""}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel>
          <h2 className="text-base font-semibold text-white">Top Performing Flows</h2>
          <div className="mt-5 space-y-4">
            {topFlows.map(([name, total, lift]) => (
              <div key={name} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 text-sm">
                <span className="font-medium text-slate-200">{name}</span>
                <span className="font-semibold text-white">{total}</span>
                <span className="text-emerald-300">{lift}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Recent Activity</h2>
            <button className="text-xs font-semibold text-fuchsia-300">View all</button>
          </div>
          <div className="space-y-4">
            {[
              ["Flow 'Welcome Series' executed", "2 minutes ago", Zap],
              ["Email sent to 128 subscribers", "12 minutes ago", MailCheck],
              ["New subscriber added", "23 minutes ago", Plus],
              ["Flow 'Abandoned Cart' executed", "1 hour ago", Activity],
            ].map(([label, time, Icon]) => (
              <div key={label as string} className="flex items-center gap-3 text-sm">
                <Icon size={16} className="text-fuchsia-300" />
                <span className="flex-1 text-slate-300">{label as string}</span>
                <span className="text-xs text-slate-500">{time as string}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-base font-semibold text-white">Email Status</h2>
          <div className="mt-6 grid place-items-center">
            <div className="grid size-40 place-items-center rounded-full bg-[conic-gradient(#7C3AED_0_42%,#EC4899_42%_72%,#22C55E_72%_91%,#334155_91%_100%)]">
              <div className="grid size-28 place-items-center rounded-full bg-[#0D121C] text-center">
                <div>
                  <p className="text-2xl font-semibold text-white">128,924</p>
                  <p className="text-xs text-slate-400">Total Sent</p>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
