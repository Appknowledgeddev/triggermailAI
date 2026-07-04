"use client";

import { useState } from "react";
import { Building2, Eye, Lock, Mail, User } from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";

export function SignUpForm() {
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = hasSupabaseConfig();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!configured) {
      setError("Add your Supabase URL and anon key to .env.local to enable account creation.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          company,
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setSuccess("Account created. Check your email to confirm your address, then sign in.");
  }

  return (
    <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
      <AuthMessage error={error} success={success} />
      <label className="block">
        <span className="text-xs font-semibold text-slate-400">Full name</span>
        <div className="mt-2 flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 transition focus-within:border-fuchsia-400/60">
          <User size={15} className="text-slate-500" />
          <input className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600" onChange={(event) => setFullName(event.target.value)} placeholder="Totok Michael" required value={fullName} />
        </div>
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-slate-400">Company</span>
        <div className="mt-2 flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 transition focus-within:border-fuchsia-400/60">
          <Building2 size={15} className="text-slate-500" />
          <input className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600" onChange={(event) => setCompany(event.target.value)} placeholder="Acme Inc." value={company} />
        </div>
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-slate-400">Email address</span>
        <div className="mt-2 flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 transition focus-within:border-fuchsia-400/60">
          <Mail size={15} className="text-slate-500" />
          <input className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
        </div>
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-slate-400">Password</span>
        <div className="mt-2 flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 transition focus-within:border-fuchsia-400/60">
          <Lock size={15} className="text-slate-500" />
          <input className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600" minLength={6} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" required type="password" value={password} />
          <Eye size={15} className="text-slate-500" />
        </div>
      </label>
      <button className="h-10 w-full rounded-[8px] bg-gradient-to-r from-fuchsia-600 to-violet-brand text-sm font-semibold text-white shadow-lg shadow-fuchsia-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60" disabled={loading} type="submit">
        {loading ? "Creating account..." : "Create account"}
      </button>
      <p className="text-xs leading-5 text-slate-500">
        By creating an account, you agree to the Trigger Mail AI terms and privacy policy.
      </p>
    </form>
  );
}
