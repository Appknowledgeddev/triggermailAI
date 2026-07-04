import { Code2, Globe, MousePointerClick, Play, Save, Webhook, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panels";

export default function TriggersPage() {
  return (
    <AppShell
      eyebrow="Trigger Configuration"
      title="New Trigger"
      description="Configure when this trigger should run."
      primaryAction="Save Trigger"
      secondaryAction="Run Test"
    >
      <section className="mt-4 max-w-3xl">
        <Panel>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Trigger Type</span>
            <div className="mt-2 flex items-center justify-between rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white">
              <span className="flex items-center gap-2"><Webhook size={16} className="text-fuchsia-300" />New Subscriber</span>
              <span className="text-slate-500">⌄</span>
            </div>
          </label>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Source</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              {[
                ["Web Form", MousePointerClick],
                ["API", Code2],
                ["Zapier", Zap],
                ["Make", Globe],
              ].map(([label, Icon], index) => (
                <button key={label as string} className={`rounded-[8px] border p-4 text-sm font-semibold ${index === 0 ? "border-violet-brand bg-violet-brand/15 text-white" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>
                  <Icon className="mx-auto mb-3 text-fuchsia-300" size={22} />
                  {label as string}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[10px] border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-base font-semibold text-white">Web Form</h2>
            {["Newsletter Signup Form", "All Subscribers"].map((value, index) => (
              <label key={value} className="mt-4 block">
                <span className="text-xs text-slate-500">{index === 0 ? "Select a form" : "List / Segment"}</span>
                <div className="mt-2 rounded-[8px] border border-white/10 bg-[#080d16] px-3 py-3 text-sm text-white">{value}</div>
              </label>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between rounded-[10px] border border-white/10 bg-white/[0.03] p-5">
            <div>
              <p className="text-sm font-semibold text-white">Run Test</p>
              <p className="mt-1 text-xs text-slate-500">Test this trigger</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-[8px] bg-violet-brand px-4 py-2 text-sm font-semibold text-white"><Play size={16} />Run Test</button>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button className="rounded-[8px] border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200">Cancel</button>
            <button className="inline-flex items-center gap-2 rounded-[8px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white"><Save size={16} />Save Trigger</button>
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
