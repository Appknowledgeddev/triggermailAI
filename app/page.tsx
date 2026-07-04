import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  Clock,
  FileText,
  GitBranch,
  Globe2,
  MailCheck,
  MousePointerClick,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/logo";

const features = [
  ["Visual flow builder", "Map welcome journeys, follow-ups, branches, waits, and reminders without losing the logic.", GitBranch],
  ["AI-assisted drafting", "Generate first drafts, subject lines, summaries, and variations directly where your team works.", Bot],
  ["Template system", "Create reusable emails for onboarding, launches, nurture campaigns, reminders, and recovery flows.", FileText],
  ["Flexible triggers", "Start automations from forms, webhooks, mailhooks, subscriber events, and app activity.", Webhook],
  ["Audience context", "Segment by source, lifecycle stage, tags, and behaviour before sending the next message.", Users],
  ["Performance visibility", "Track sends, opens, clicks, bounces, and flow activity from one focused workspace.", MailCheck],
];

const steps = [
  ["Connect", "Bring in subscriber events from forms, APIs, mailhooks, and the tools your team already uses."],
  ["Build", "Design templates and multi-step automations with waits, conditions, and AI-supported copy."],
  ["Improve", "Use activity logs, delivery status, and insights to tune the journeys that matter most."],
];

const useCases = [
  ["SaaS onboarding", "Welcome trial users, nudge activation steps, and alert sales when high-intent actions happen."],
  ["Ecommerce recovery", "Trigger abandoned cart reminders, product follow-ups, and post-purchase education."],
  ["Agencies and services", "Route leads from forms, qualify enquiries, and send polished follow-up sequences."],
];

const integrations = ["Web forms", "Supabase", "Zapier", "Make", "Stripe", "HubSpot", "Shopify", "Slack"];

const pricing = [
  ["Starter", "$0", "For shaping early flows and testing the workspace.", ["1 workspace", "Core templates", "Manual preview", "Community support"]],
  ["Pro", "$49", "For teams running live customer journeys.", ["10,000 emails/month", "AI drafting", "Advanced analytics", "Priority support"]],
  ["Scale", "Custom", "For larger sending volumes and deeper workflows.", ["Custom limits", "Team permissions", "Dedicated onboarding", "SLA options"]],
];

const faqs = [
  ["Can I move around without logging in right now?", "You can browse the website and auth screens, but the app workspace now requires sign in."],
  ["Will this connect to Supabase auth?", "Yes. The auth screens use Supabase sign in, sign up, reset, and logout actions."],
  ["Can I build templates before flows?", "Yes. Templates and the email builder are separate, so you can create reusable email assets first."],
  ["Does the app support dark and light mode?", "Yes. The app shell has both modes, including matching logo variants for each background."],
];

export default function WebsiteHome() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_75%_12%,rgba(217,70,239,0.2),transparent_30%),linear-gradient(135deg,#f8fafc_0%,#eef2ff_44%,#ffffff_100%)] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="block w-[178px] shrink-0">
            <Logo variant="darkText" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#features" className="hover:text-slate-950">Features</a>
            <a href="#workflow" className="hover:text-slate-950">Workflow</a>
            <a href="#use-cases" className="hover:text-slate-950">Use cases</a>
            <a href="#pricing" className="hover:text-slate-950">Pricing</a>
            <a href="#faq" className="hover:text-slate-950">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-[7px] px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
              Sign in
            </Link>
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-950/20">
              Open app
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1fr_0.92fr] lg:items-center lg:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-white px-3 py-1 text-xs font-semibold text-fuchsia-700">
            <Sparkles size={14} />
            AI email automation
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
            Trigger smarter emails from every customer action.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            Trigger Mail AI helps teams build automated email flows, manage templates, and improve campaign performance from one focused workspace.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/sign-up" className="inline-flex h-10 items-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-4 text-sm font-semibold text-white shadow-lg shadow-fuchsia-950/20">
              Start free
              <ArrowRight size={15} />
            </Link>
            <Link href="/login" className="inline-flex h-10 items-center rounded-[7px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Sign in
            </Link>
          </div>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            {[
              ["128k", "emails sent"],
              ["42.7%", "open rate"],
              ["24", "active flows"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-[9px] border border-slate-200 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
                <p className="text-xl font-semibold">{value}</p>
                <p className="mt-1 text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[12px] border border-slate-200 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
          <div className="rounded-[9px] bg-[#080d16] p-4 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-sm font-semibold">Welcome Series</span>
              <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-300">Active</span>
            </div>
            <div className="mt-5 grid gap-3">
              {["New subscriber", "Welcome email", "Wait 2 days", "Opened email?", "Follow-up email"].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm">
                  <span className="grid size-7 place-items-center rounded-[7px] bg-fuchsia-500/15 text-fuchsia-300">{index + 1}</span>
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
              {["Sent", "Opened", "Clicked"].map((label, index) => (
                <div key={label} className="rounded-[8px] bg-white/[0.04] p-2">
                  <p className="text-sm font-semibold">{["12,643", "42.7%", "18.3%"][index]}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white/70 px-4 py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold text-slate-500">
          {integrations.map((item) => (
            <span key={item} className="inline-flex items-center gap-2">
              <PlugZap size={15} className="text-fuchsia-500" />
              {item}
            </span>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-14">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-brand">Features</p>
          <h2 className="mt-2 text-3xl font-semibold">Everything needed to launch useful email automation.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Keep planning, writing, triggering, and reporting in one place so the team can move faster.</p>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, description, Icon]) => (
            <article key={title as string} className="rounded-[10px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
              <div className="grid size-9 place-items-center rounded-[8px] bg-fuchsia-50 text-fuchsia-600">
                <Icon size={18} />
              </div>
              <h3 className="mt-4 text-base font-semibold">{title as string}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description as string}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-[12px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-brand">Workflow</p>
              <h2 className="mt-2 text-2xl font-semibold">From trigger to email in minutes.</h2>
            </div>
            <Link href="/dashboard" className="inline-flex h-9 items-center gap-2 rounded-[7px] border border-slate-200 px-3 text-sm font-semibold text-slate-700">
              Explore app
              <Zap size={15} />
            </Link>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {steps.map(([title, description], index) => (
              <div key={title} className="rounded-[9px] bg-slate-50 p-4">
                <span className="grid size-7 place-items-center rounded-[7px] bg-slate-950 text-xs font-semibold text-white">{index + 1}</span>
                <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="use-cases" className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-6 lg:grid-cols-[0.75fr_1fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-brand">Use cases</p>
            <h2 className="mt-2 text-3xl font-semibold">Built for the journeys that happen after someone raises their hand.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Trigger Mail AI is most useful when timing, context, and follow-through matter.</p>
          </div>
          <div className="grid gap-3">
            {useCases.map(([title, description]) => (
              <article key={title} className="flex gap-4 rounded-[10px] border border-slate-200 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
                <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-[8px] bg-emerald-50 text-emerald-600">
                  <Check size={17} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-4 rounded-[12px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.14)] lg:grid-cols-3">
          {[
            [ShieldCheck, "Designed for trust", "Centralise activity, account data, and sending controls before connecting live auth."],
            [Clock, "Fast setup", "Move between website, auth, and app screens freely while the product takes shape."],
            [Globe2, "Website and app", "A public marketing layer now sits beside the internal app experience."],
          ].map(([Icon, title, description]) => (
            <div key={title as string} className="rounded-[9px] bg-white/[0.04] p-4">
              <Icon size={20} className="text-fuchsia-300" />
              <h3 className="mt-4 text-sm font-semibold">{title as string}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{description as string}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-brand">Pricing</p>
            <h2 className="mt-2 text-3xl font-semibold">Simple plans for the setup phase.</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-600">These are placeholder product plans for the website. They can be wired into billing later.</p>
        </div>
        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          {pricing.map(([name, price, description, items], index) => (
            <article key={name as string} className={`rounded-[10px] border p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ${index === 1 ? "border-fuchsia-300 bg-slate-950 text-white" : "border-slate-200 bg-white"}`}>
              <h3 className="text-base font-semibold">{name as string}</h3>
              <p className="mt-3 text-3xl font-semibold">{price as string}</p>
              <p className={`mt-2 text-sm leading-6 ${index === 1 ? "text-slate-400" : "text-slate-600"}`}>{description as string}</p>
              <div className="mt-5 grid gap-2">
                {(items as string[]).map((item) => (
                  <span key={item} className={`flex items-center gap-2 text-sm ${index === 1 ? "text-slate-300" : "text-slate-600"}`}>
                    <Check size={15} className="text-emerald-500" />
                    {item}
                  </span>
                ))}
              </div>
              <Link href={index === 0 ? "/sign-up" : "/login"} className={`mt-6 inline-flex h-9 w-full items-center justify-center rounded-[7px] text-sm font-semibold ${index === 1 ? "bg-white text-slate-950" : "border border-slate-200 text-slate-700"}`}>
                {index === 0 ? "Start free" : "Choose plan"}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-6 lg:grid-cols-[0.7fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-brand">FAQ</p>
            <h2 className="mt-2 text-3xl font-semibold">Questions for the first build.</h2>
          </div>
          <div className="grid gap-3">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group rounded-[9px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold">
                  {question}
                  <ChevronRight size={16} className="transition group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-600">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="rounded-[12px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-brand">Workspace access</p>
              <h2 className="mt-2 text-2xl font-semibold">Sign in to enter the app workspace.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">The website stays public, while dashboards, templates, flows, assets, billing, and settings now require an active account.</p>
            </div>
            <Link href="/login" className="inline-flex h-10 items-center justify-center gap-2 rounded-[7px] bg-slate-950 px-4 text-sm font-semibold text-white">
              Go to sign in
              <MousePointerClick size={15} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="block w-[170px]">
            <Logo variant="darkText" />
          </Link>
          <div className="flex flex-wrap gap-4 text-sm font-semibold text-slate-500">
            <Link href="/login" className="hover:text-slate-950">Sign in</Link>
            <Link href="/sign-up" className="hover:text-slate-950">Create account</Link>
            <Link href="/dashboard" className="hover:text-slate-950">Open app</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
