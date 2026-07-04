import { CreditCard, Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panels";

export default function BillingPage() {
  return (
    <AppShell eyebrow="Billing" title="Billing" description="Manage your subscription and billing." primaryAction="Upgrade" secondaryAction="Invoices">
      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel>
          <h2 className="text-base font-semibold text-white">Current Plan</h2>
          <div className="mt-5 rounded-[10px] border border-violet-brand/30 bg-gradient-to-br from-white/[0.05] to-violet-950/30 p-6">
            <p className="text-lg font-semibold text-white">Pro Plan</p>
            <p className="mt-3 text-5xl font-semibold text-white">$49<span className="text-base text-slate-400">/month</span></p>
            <div className="mt-6 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              {["10,000 emails / month", "Unlimited flows", "Advanced analytics", "Priority support"].map((item) => <p key={item}>✓ {item}</p>)}
            </div>
            <button className="mt-6 w-full rounded-[8px] bg-white/[0.06] py-3 text-sm font-semibold text-white">Manage Subscription</button>
          </div>
          <div className="mt-4 rounded-[10px] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex justify-between text-sm"><span className="text-slate-400">Emails sent</span><span className="text-violet-300">7,126 / 10,000</span></div>
            <div className="mt-4 h-2 rounded-full bg-white/10"><div className="h-2 w-[71%] rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-brand" /></div>
            <p className="mt-3 text-xs text-slate-500">Resets on Jul 1, 2024</p>
          </div>
        </Panel>

        <Panel>
          <h2 className="text-base font-semibold text-white">Payment Method</h2>
          <div className="mt-5 rounded-[10px] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-[8px] bg-violet-brand text-white"><CreditCard size={18} /></div>
              <div>
                <p className="text-sm font-semibold text-white">•••• •••• •••• 4242</p>
                <p className="text-xs text-slate-500">Expires 04/28</p>
              </div>
            </div>
            <button className="mt-5 text-sm font-semibold text-fuchsia-300">Edit</button>
          </div>
          <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] py-3 text-sm font-semibold text-slate-200"><Download size={16} />View Billing History</button>
        </Panel>
      </section>
    </AppShell>
  );
}
