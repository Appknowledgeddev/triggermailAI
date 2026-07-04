import { Bot, FileText, Send, Sparkles, Wand2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panels";

export default function AiStudioPage() {
  return (
    <AppShell
      eyebrow="AI Studio"
      title="Prompt AI to create content and flow logic"
      description="Generate email copy, subject lines, CTAs, summaries, and workflow steps from plain English."
      primaryAction="New AI Draft"
      secondaryAction="Prompt Library"
    >
      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_380px]">
        <Panel className="bg-ink text-white">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-full bg-white/10">
              <Sparkles size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">AI Email Generator</h2>
              <p className="text-sm text-slate-300">Prompt to draft</p>
            </div>
          </div>
          <div className="mt-6 rounded-[8px] bg-white/[0.08] p-4">
            <p className="text-sm text-slate-300">Prompt</p>
            <p className="mt-3 text-2xl font-semibold leading-9">Create a professional welcome email for a recruitment company.</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["Subject line", FileText],
              ["Email copy", Bot],
              ["CTA buttons", Send],
            ].map(([label, Icon]) => (
              <div key={label as string} className="rounded-[8px] bg-white/[0.08] p-4">
                <Icon size={18} />
                <p className="mt-3 text-sm font-semibold">{label as string}</p>
              </div>
            ))}
          </div>
          <button className="mt-6 inline-flex h-12 items-center gap-2 rounded-[8px] bg-white px-5 text-sm font-semibold text-slate-950">
            <Wand2 size={18} />
            Generate Draft
          </button>
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold">Draft Output</h2>
          <div className="mt-5 space-y-4">
            <div className="rounded-[8px] border border-slate-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-brand">Subject</p>
              <p className="mt-2 text-sm font-semibold">Welcome to your smarter hiring workflow</p>
            </div>
            <div className="rounded-[8px] border border-slate-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-brand">Body</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Hi {"{{name}}"}, thanks for connecting with {"{{company}}"}. Here is a clear next step for your recruitment team.</p>
            </div>
            <div className="rounded-[8px] border border-slate-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-brand">CTA</p>
              <p className="mt-2 text-sm font-semibold">Book onboarding call</p>
            </div>
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
