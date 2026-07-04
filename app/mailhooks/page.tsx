import { Bot, Inbox, MailOpen, Reply, Tags } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panels";

const messages = [
  ["orders@triggermail.ai", "New order confirmation from BuildCo", "Extract order number and customer email"],
  ["support@triggermail.ai", "Customer reply: booked consultation", "Summarize intent and update contact"],
  ["leads@triggermail.ai", "Website enquiry: commercial property", "Create lead and start nurture flow"],
];

export default function MailhooksPage() {
  return (
    <AppShell
      eyebrow="Mailhooks"
      title="Process inbound emails automatically"
      description="Turn incoming messages into structured data, AI summaries, contact updates, and flow runs."
      primaryAction="New Mailhook"
      secondaryAction="Test Inbound"
    >
      <section className="mt-6 grid gap-4 lg:grid-cols-[340px_1fr]">
        <Panel>
          <h2 className="text-lg font-semibold text-white">Inbox Addresses</h2>
          <div className="mt-5 space-y-3">
            {["orders@triggermail.ai", "support@triggermail.ai", "leads@triggermail.ai"].map((address, index) => (
              <button key={address} className={`w-full rounded-[8px] border p-4 text-left ${index === 0 ? "border-violet-brand bg-violet-brand text-white" : "border-white/10 bg-white/[0.04] text-slate-200"}`}>
                <p className="text-sm font-semibold">{address}</p>
                <p className={`mt-1 text-xs ${index === 0 ? "text-white/70" : "text-slate-500"}`}>{index === 0 ? "Order Processing" : "Customer Replies"}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Inbound Processing Queue</h2>
              <p className="mt-1 text-sm text-slate-500">Emails waiting to be parsed, summarized, and routed.</p>
            </div>
            <Inbox className="text-violet-brand" size={24} />
          </div>
          <div className="mt-6 space-y-4">
            {messages.map(([address, subject, action]) => (
              <div key={subject} className="rounded-[8px] border border-slate-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{subject}</p>
                    <p className="mt-1 text-xs text-slate-500">{address}</p>
                  </div>
                  <span className="rounded-full bg-green-success/10 px-3 py-1 text-xs font-bold text-emerald-300">Parsed</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Open", MailOpen],
                    ["Summarize", Bot],
                    ["Reply", Reply],
                  ].map(([label, Icon]) => (
                    <button key={label as string} className="flex items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200">
                      <Icon size={15} />
                      {label as string}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-[8px] bg-white/[0.04] p-3 text-sm text-slate-300">
                  <Tags size={16} className="text-violet-brand" />
                  {action}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
