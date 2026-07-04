import Link from "next/link";
import { ArrowRight, Check, FileText, GitBranch, MailCheck } from "lucide-react";
import { Logo } from "@/components/logo";

const benefits = [
  ["Build emails", "Create reusable templates with content blocks, images, buttons, and AI help."],
  ["Connect triggers", "Start flows from forms, webhooks, mailhooks, or customer activity."],
  ["Send and improve", "Test journeys, review activity, and keep each message easy to update."],
];

const workspaceLinks = [
  ["Templates", "/templates", FileText],
  ["Flows", "/flows", GitBranch],
  ["Activity", "/activity", MailCheck],
];

export default function WebsiteHome() {
  return (
    <main className="min-h-screen bg-[#f7f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link href="/" className="block w-[168px] shrink-0">
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
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-10 px-4 py-16 lg:grid-cols-[1fr_360px] lg:items-center lg:py-24">
        <div>
          <p className="text-sm font-semibold text-violet-brand">Email automation workspace</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
            Build, trigger, and manage customer emails in one place.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            Trigger Mail AI gives you a simple workspace for email templates, automated flows, test sends, and AI-assisted editing.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/sign-up" className="inline-flex h-10 items-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-4 text-sm font-semibold text-white shadow-lg shadow-fuchsia-950/15">
              Create account
              <ArrowRight size={15} />
            </Link>
            <Link href="/login" className="inline-flex h-10 items-center rounded-[7px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Sign in
            </Link>
          </div>
        </div>

        <div className="rounded-[10px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-950">Today</p>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Ready</span>
            </div>
            <div className="mt-5 space-y-3">
              {["Welcome email updated", "Webhook trigger tested", "Flow ready to publish"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-[8px] bg-white px-3 py-3 text-sm text-slate-700 shadow-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-brand">
                    <Check size={14} />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-12">
        <div className="grid gap-3 md:grid-cols-3">
          {benefits.map(([title, description]) => (
            <article key={title} className="rounded-[10px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="rounded-[10px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Go straight to the workspace</h2>
              <p className="mt-1 text-sm text-slate-600">Pick up where you left off, or start with templates and flows.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {workspaceLinks.map(([label, href, Icon]) => (
                <Link key={label as string} href={href as string} className="inline-flex h-9 items-center gap-2 rounded-[7px] border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  <Icon size={15} />
                  {label as string}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="block w-[150px]">
            <Logo variant="darkText" />
          </Link>
          <div className="flex flex-wrap gap-4 font-semibold">
            <Link href="/login" className="hover:text-slate-950">Sign in</Link>
            <Link href="/sign-up" className="hover:text-slate-950">Create account</Link>
            <Link href="/dashboard" className="hover:text-slate-950">Open app</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
