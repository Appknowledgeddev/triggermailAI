import { CheckCircle2, CircleAlert } from "lucide-react";
import { hasSupabaseConfig } from "@/lib/supabase/client";

export function SupabaseStatus() {
  const configured = hasSupabaseConfig();

  return (
    <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${configured ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>
      {configured ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
      {configured ? "Supabase connected" : "Add Supabase keys to connect live data"}
    </div>
  );
}
