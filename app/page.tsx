import Link from "next/link";
import { ArrowRight, Check, FileText, GitBranch, MailCheck } from "lucide-react";
import { Logo } from "@/components/logo";

const highlights = [
  ["Templates", "Design reusable emails.", FileText],
  ["Flows", "Trigger messages from activity.", GitBranch],
  ["Activity", "Review sends and tests.", MailCheck],
];

export default function WebsiteHome() {
  return (
    <main className="min-h-screen bg-[#f7f7fb] px-4 py-5 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-5xl flex-col rounded-[12px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <Link href="/" className="block w-[160px] shrink-0">
            <Logo variant="darkText" />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-[7px] px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
              Sign in
            </Link>
            <Link href="/dashboard" className="inline-flex h-9 items-center gap-2 rounded-[7px] bg-slate-950 px-3 text-sm font-semibold text-white">
              Open app
              <ArrowRight size={15} />
            </Link>
          </div>
        </header>

        <section className="grid flex-1 gap-8 px-5 py-10 lg:grid-cols-[1fr_360px] lg:items-center lg:px-10">
          <div>
            <p className="text-sm font-semibold text-violet-brand">Trigger Mail AI</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
              Simple email automation for templates, triggers, and flows.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              Build reusable emails, connect customer actions, and test automated journeys from one workspace.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/sign-up" className="inline-flex h-10 items-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-4 text-sm font-semibold text-white shadow-lg shadow-fuchsia-950/15">
                Join waitlist
                <ArrowRight size={15} />
              </Link>
              <Link href="/login" className="inline-flex h-10 items-center rounded-[7px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Sign in
              </Link>
            </div>
          </div>

          <div className="rounded-[10px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">Workspace</p>
            <div className="mt-4 space-y-3">
              {highlights.map(([title, description, Icon]) => (
                <Link key={title as string} href={`/${String(title).toLowerCase()}`} className="flex items-center gap-3 rounded-[8px] bg-white px-3 py-3 text-left shadow-sm transition hover:bg-slate-50">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-violet-50 text-violet-brand">
                    <Icon size={17} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-950">{title as string}</span>
                    <span className="block text-sm text-slate-500">{description as string}</span>
                  </span>
                </Link>
              ))}
            </div>
            <div className="mt-4 rounded-[8px] border border-emerald-100 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              <span className="inline-flex items-center gap-2 font-semibold">
                <Check size={15} />
                Ready to build
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
