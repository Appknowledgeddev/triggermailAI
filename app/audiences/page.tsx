import { Filter, Mail, Search, Tags, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panels";

const contacts = [
  ["Johnny Appleseed", "johnny@email.com", "PropertyCo", "lead, valuation", "Today"],
  ["Alex Morgan", "alex@agency.dev", "Northline Recruitment", "agency, hiring", "Yesterday"],
  ["Priya Shah", "priya@saasbox.io", "SaaSBox", "trial, founder", "Jun 17"],
  ["Sam Carter", "sam@buildco.com", "BuildCo", "construction", "Jun 16"],
];

export default function AudiencesPage() {
  return (
    <AppShell
      eyebrow="Audiences"
      title="Organize contacts and segments"
      description="Manage audience lists, contact fields, tags, companies, and personalization variables."
      primaryAction="Add Contact"
      secondaryAction="Import CSV"
    >
      <section className="mt-6 grid gap-4 xl:grid-cols-[280px_1fr]">
        <Panel>
          <h2 className="text-lg font-semibold text-white">Segments</h2>
          <div className="mt-5 space-y-3">
            {["SaaS founders", "Recruitment agencies", "Property enquiries", "Professional services"].map((segment, index) => (
              <button key={segment} className={`flex w-full items-center justify-between rounded-[8px] p-3 text-sm font-semibold ${index === 0 ? "bg-violet-brand text-white" : "bg-white/[0.04] text-slate-200"}`}>
                {segment}
                <span className={index === 0 ? "text-white/70" : "text-slate-400"}>{[8420, 3160, 2940, 1180][index]}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
              <input className="h-11 w-full rounded-[8px] border border-white/10 bg-white/[0.04] pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500" placeholder="Search contacts" />
            </div>
            <button className="inline-flex h-11 items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200">
              <Filter size={16} />
              Filter
            </button>
            <button className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-violet-brand px-4 text-sm font-semibold text-white">
              <UserPlus size={16} />
              Add
            </button>
          </div>
          <div className="mt-5 overflow-hidden rounded-[8px] border border-white/10">
            {contacts.map(([name, email, company, tags, activity]) => (
              <div key={email} className="grid gap-3 border-b border-white/10 p-4 text-sm last:border-b-0 md:grid-cols-[1.1fr_1.2fr_1fr_1fr_auto]">
                <span className="font-semibold text-white">{name}</span>
                <span className="flex items-center gap-2 text-slate-400"><Mail size={15} />{email}</span>
                <span className="text-slate-300">{company}</span>
                <span className="flex items-center gap-2 text-slate-500"><Tags size={15} />{tags}</span>
                <span className="text-slate-400">{activity}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
