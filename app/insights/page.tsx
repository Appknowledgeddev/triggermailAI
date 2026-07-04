import { BarChart3, MousePointerClick, Send, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panels";

const bars = [54, 72, 61, 88, 69, 93, 78, 66, 82, 91, 74, 86];

export default function InsightsPage() {
  return (
    <AppShell
      eyebrow="Insights"
      title="Track email performance and delivery health"
      description="Analyze opens, clicks, sends, failures, AI credit usage, and flow-level performance."
      primaryAction="Create Report"
      secondaryAction="Export CSV"
    >
      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Monthly Sends and Engagement</h2>
              <p className="mt-1 text-sm text-slate-500">Last 12 campaigns</p>
            </div>
            <BarChart3 className="text-violet-brand" size={24} />
          </div>
          <div className="mt-8 grid h-80 grid-cols-12 items-end gap-3">
            {bars.map((height, index) => (
              <div key={`${height}-${index}`} className="flex h-full flex-col justify-end gap-3">
                <div className="rounded-t-[8px] bg-gradient-to-t from-violet-brand to-blue-action" style={{ height: `${height}%` }} />
                <span className="text-center text-[11px] font-semibold text-slate-400">{index + 1}</span>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid gap-4">
          {[
            ["Emails Sent", "48.2k", "+18.4%", Send],
            ["Open Rate", "67%", "+7.1%", TrendingUp],
            ["Click Rate", "21%", "+3.8%", MousePointerClick],
          ].map(([label, value, change, Icon]) => (
            <Panel key={label as string}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{label as string}</p>
                  <p className="mt-3 text-4xl font-semibold">{value as string}</p>
                  <p className="mt-2 text-sm font-semibold text-emerald-700">{change as string}</p>
                </div>
                <div className="grid size-12 place-items-center rounded-full bg-violet-brand/10 text-violet-brand">
                  <Icon size={22} />
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
