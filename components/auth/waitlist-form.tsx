"use client";

import { useState } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "We could not add you to the waiting list.");
      }

      setSuccess(payload.message || "You're on the waiting list. We'll email you when access opens.");
      setEmail("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We could not add you to the waiting list.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
      <AuthMessage error={error} success={success} />
      <label className="block">
        <span className="text-xs font-semibold text-slate-400">Email address</span>
        <div className="mt-2 flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 transition focus-within:border-fuchsia-400/60">
          <Mail size={15} className="text-slate-500" />
          <input
            className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </div>
      </label>
      <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-gradient-to-r from-fuchsia-600 to-violet-brand text-sm font-semibold text-white shadow-lg shadow-fuchsia-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60" disabled={loading} type="submit">
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
        {loading ? "Joining..." : "Join waiting list"}
      </button>
      <p className="text-xs leading-5 text-slate-500">
        Access is currently limited while Trigger Mail AI is under development.
      </p>
    </form>
  );
}
