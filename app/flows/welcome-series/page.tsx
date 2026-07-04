import Link from "next/link";
import { ArrowLeft, Clock, GitBranch, Mail, Save, Settings, ToggleRight, Upload, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";

const flowNodes = [
  { label: "Trigger", detail: "New Subscriber", x: "left-[42%] top-[5%]", icon: Users, accent: "border-cyan-400/50 text-cyan-300" },
  { label: "Email", detail: "Welcome Email", x: "left-[42%] top-[23%]", icon: Mail, accent: "border-fuchsia-400/50 text-fuchsia-300" },
  { label: "Wait", detail: "2 Days", x: "left-[42%] top-[41%]", icon: Clock, accent: "border-yellow-400/50 text-yellow-300" },
  { label: "Condition", detail: "Opened Email?", x: "left-[42%] top-[59%]", icon: GitBranch, accent: "border-emerald-400/50 text-emerald-300" },
  { label: "Email", detail: "Follow Up Email", x: "left-[20%] top-[78%]", icon: Mail, accent: "border-violet-400/50 text-violet-300" },
  { label: "Email", detail: "Reminder Email", x: "left-[64%] top-[78%]", icon: Mail, accent: "border-rose-400/50 text-rose-300" },
];

export default function WelcomeSeriesFlowPage() {
  return (
    <AppShell
      eyebrow="Flow Builder"
      title="Welcome Series"
      description="Visual automation builder."
      primaryAction="Publish"
      secondaryAction="Save"
    >
      <section className="mt-4 grid min-h-[720px] overflow-hidden rounded-[10px] border border-white/10 bg-[#070b12] xl:grid-cols-[1fr_340px]">
        <div className="relative min-h-[680px] bg-[radial-gradient(circle,rgba(148,163,184,0.13)_1px,transparent_1px)] [background-size:22px_22px]">
          <div className="absolute left-4 top-4 flex gap-2">
            <Link href="/flows" className="grid size-9 place-items-center rounded-[8px] border border-white/10 bg-white/[0.04] text-slate-300">
              <ArrowLeft size={16} />
            </Link>
            <button className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-300">
              <Save size={14} />
              Save
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-violet-brand px-3 text-xs font-semibold text-white">
              <Upload size={14} />
              Publish
            </button>
          </div>

          <div className="absolute inset-x-0 top-[14%] mx-auto h-[68%] w-px bg-white/15" />
          <div className="absolute left-[31%] top-[72%] h-px w-[38%] bg-white/15" />

          {flowNodes.map((node) => (
            <div key={`${node.label}-${node.detail}`} className={`absolute ${node.x} w-52 -translate-x-1/2 rounded-[8px] border bg-[#111827] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)] ${node.accent}`}>
              <div className="flex items-center gap-3">
                <node.icon size={18} />
                <div>
                  <p className="text-xs text-slate-400">{node.label}</p>
                  <p className="text-sm font-semibold text-white">{node.detail}</p>
                </div>
              </div>
            </div>
          ))}

          <div className="absolute left-[35%] top-[70%] rounded-[7px] bg-emerald-500 px-4 py-2 text-xs font-bold text-white">Yes</div>
          <div className="absolute left-[58%] top-[70%] rounded-[7px] bg-rose-500 px-4 py-2 text-xs font-bold text-white">No</div>
        </div>

        <aside className="border-t border-white/10 bg-[#0D121C] p-5 xl:border-l xl:border-t-0">
          <h2 className="text-base font-semibold text-white">Email</h2>
          <p className="text-xs text-slate-500">Send an email to your subscribers</p>
          <div className="mt-6 space-y-5">
            {[
              ["Template", "Welcome Email"],
              ["From Name", "Trigger Mail AI"],
              ["Subject", "Welcome to Trigger Mail AI!"],
            ].map(([label, value]) => (
              <label key={label} className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
                <div className="mt-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white">{value}</div>
              </label>
            ))}
            {["Track Opens", "Track Clicks"].map((item) => (
              <div key={item} className="flex items-center justify-between text-sm text-slate-300">
                {item}
                <ToggleRight className="text-violet-400" size={30} />
              </div>
            ))}
          </div>
          <button className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-rose-400">
            <Settings size={16} />
            Delete Step
          </button>
        </aside>
      </section>
    </AppShell>
  );
}
