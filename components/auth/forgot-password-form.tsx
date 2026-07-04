"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = hasSupabaseConfig();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!configured) {
      setError("Add your Supabase URL and anon key to .env.local to enable password reset.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/login`,
    });
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccess("Reset link sent. Check your email for the next step.");
  }

  return (
    <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
      <AuthMessage error={error} success={success} />
      <label className="block">
        <span className="text-xs font-semibold text-slate-400">Email address</span>
        <div className="mt-2 flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 transition focus-within:border-fuchsia-400/60">
          <Mail size={15} className="text-slate-500" />
          <input className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
        </div>
      </label>
      <button className="h-10 w-full rounded-[8px] bg-gradient-to-r from-fuchsia-600 to-violet-brand text-sm font-semibold text-white shadow-lg shadow-fuchsia-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60" disabled={loading} type="submit">
        {loading ? "Sending..." : "Send reset link"}
      </button>
    </form>
  );
}
