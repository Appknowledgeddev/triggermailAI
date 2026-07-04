"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Confirming your session...");

  useEffect(() => {
    async function confirmSession() {
      if (!hasSupabaseConfig()) {
        setMessage("Supabase is not configured yet.");
        return;
      }

      const code = searchParams.get("code");
      const next = searchParams.get("next") || "/dashboard";
      const supabase = createSupabaseBrowserClient();

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setMessage("This confirmation link was created with the previous PKCE setup. Please request a fresh confirmation or reset email and open that new link.");
          return;
        }

        router.replace(next);
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        setMessage("No active auth session was found. Please request a fresh confirmation or reset email.");
        return;
      }

      router.replace(next);
      router.refresh();
    }

    confirmSession();
  }, [router, searchParams]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#080d16] px-4 text-white">
      <section className="w-full max-w-md rounded-[10px] border border-white/10 bg-white/[0.04] p-5 text-center">
        <h1 className="text-xl font-semibold">Trigger Mail AI</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{message}</p>
        <Link href="/login" className="mt-5 inline-flex h-9 items-center rounded-[7px] bg-white px-3 text-sm font-semibold text-slate-950">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[#080d16] px-4 text-white">
          <section className="w-full max-w-md rounded-[10px] border border-white/10 bg-white/[0.04] p-5 text-center">
            <h1 className="text-xl font-semibold">Trigger Mail AI</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">Confirming your session...</p>
          </section>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
