"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, Lock, Mail } from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = hasSupabaseConfig();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!configured) {
      setError("Add your Supabase URL and anon key to .env.local to enable sign in.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    const next = new URLSearchParams(window.location.search).get("next") || "/dashboard";
    router.push(next.startsWith("/") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
      <AuthMessage error={error} />
      <label className="block">
        <span className="text-xs font-semibold text-slate-400">Email address</span>
        <div className="mt-2 flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 transition focus-within:border-fuchsia-400/60">
          <Mail size={15} className="text-slate-500" />
          <input className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
        </div>
      </label>
      <label className="block">
        <span className="flex justify-between gap-3 text-xs font-semibold text-slate-400">
          Password
          <Link className="text-fuchsia-300" href="/forgot-password">Forgot password?</Link>
        </span>
        <div className="mt-2 flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 transition focus-within:border-fuchsia-400/60">
          <Lock size={15} className="text-slate-500" />
          <input className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600" onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required type="password" value={password} />
          <Eye size={15} className="text-slate-500" />
        </div>
      </label>
      <button className="h-10 w-full rounded-[8px] bg-gradient-to-r from-fuchsia-600 to-violet-brand text-sm font-semibold text-white shadow-lg shadow-fuchsia-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60" disabled={loading} type="submit">
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
