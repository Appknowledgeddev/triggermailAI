import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { Logo } from "@/components/logo";

type AuthShellProps = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  footerText: string;
  footerHref: string;
  footerLink: string;
};

export function AuthShell({
  children,
  eyebrow,
  title,
  description,
  footerText,
  footerHref,
  footerLink,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_72%_18%,rgba(217,70,239,0.28),transparent_30%),linear-gradient(135deg,#05070d_0%,#080d16_48%,#05070d_100%)] px-4 py-6 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block">
          <Link href="/" className="block w-[220px]">
            <Logo variant="lightText" />
          </Link>
          <div className="mt-12 max-w-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-300">Trigger Mail AI</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-normal">Automate the emails that move customers forward.</h1>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Build trigger-based journeys, monitor performance, and use AI to help draft the right message at the right moment.
            </p>
          </div>
          <div className="mt-10 grid max-w-lg gap-3">
            {["AI-assisted email workflows", "Supabase-ready account data", "Templates, triggers, flows, and activity in one place"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-300">
                <span className="grid size-7 place-items-center rounded-[7px] bg-fuchsia-500/15 text-fuchsia-300">
                  <Mail size={14} />
                </span>
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[430px] rounded-[10px] border border-white/10 bg-[#080d16]/90 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur">
          <div className="mb-5 flex justify-end">
            <Link href="/" className="rounded-[7px] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white">
              View website
            </Link>
          </div>
          <Link href="/" className="mx-auto mb-8 block w-[210px] lg:hidden">
            <Logo variant="lightText" />
          </Link>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fuchsia-300">{eyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal">{title}</h2>
            <p className="mt-2 text-sm leading-5 text-slate-400">{description}</p>
          </div>

          {children}

          <p className="mt-6 text-center text-xs text-slate-400">
            {footerText}{" "}
            <Link href={footerHref} className="inline-flex items-center gap-1 font-semibold text-fuchsia-300">
              {footerLink}
              <ArrowRight size={13} />
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
