"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Inbox, Loader2, Mail, RefreshCw, Search, Send, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/panels";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ConnectedEmailAccount = {
  id: string;
  provider: string;
  email: string;
  display_name: string | null;
  status: string;
  metadata?: Record<string, unknown>;
};

async function getAccessToken() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error("Sign in before connecting an email account.");
  }

  return data.session.access_token;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatProvider(provider: string) {
  return provider === "gmail" ? "Gmail" : provider === "outlook" ? "Outlook" : provider.toUpperCase();
}

function isMissingConnectedAccountsTable(message: string) {
  return /connected_email_accounts|schema cache|PGRST205/i.test(message);
}

export function SettingsManager() {
  const [accounts, setAccounts] = useState<ConnectedEmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [setupMissing, setSetupMissing] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setAccountError(null);
    setSetupMissing(false);

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/workspace/connected-email-accounts", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json().catch(() => ({}))) as { accounts?: ConnectedEmailAccount[]; error?: string };

      if (!response.ok) {
        const message = payload.error || "Connected email accounts could not be loaded.";
        if (isMissingConnectedAccountsTable(message)) {
          setSetupMissing(true);
          setAccounts([]);
          return;
        }
        throw new Error(message);
      }

      setSetupMissing(false);
      setAccounts(payload.accounts || []);
    } catch (settingsError) {
      setAccountError(getErrorMessage(settingsError, "Connected email accounts could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function connectProvider(provider: "gmail" | "outlook") {
    setConnectingProvider(provider);
    setAccountError(null);
    setSetupMissing(false);

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/integrations/${provider}/connect`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || `${formatProvider(provider)} connection could not be started.`);
      }

      window.location.href = payload.url;
    } catch (connectError) {
      setAccountError(getErrorMessage(connectError, "Email account connection could not be started."));
      setConnectingProvider(null);
    }
  }

  const providers = [
    {
      id: "gmail" as const,
      title: "Connect Gmail",
      description: "Pair a Gmail account so Trigger Mail AI can send emails, search messages, read replies, and later power AI assistants from mailbox data.",
      icon: Mail,
      buttonClass: "bg-white text-slate-950 hover:bg-slate-200",
    },
    {
      id: "outlook" as const,
      title: "Connect Outlook",
      description: "Pair a Microsoft mailbox so flows can send from Outlook and future assistants can inspect emails, replies, and sales conversations.",
      icon: Inbox,
      buttonClass: "bg-blue-action text-white hover:bg-blue-action/90",
    },
  ];

  return (
    <section className="mt-6 space-y-4">
      <Panel className="p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="flex items-start gap-4">
              <div className="grid size-12 place-items-center rounded-full bg-violet-brand/15 text-fuchsia-300">
                <Mail size={22} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Connect your email accounts</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  Pair Gmail or Outlook with Trigger Mail AI. This lets the app send emails from that mailbox, and gives us the foundation for reading replies, searching inboxes, finding sales contacts, and running AI email assistants.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                { icon: Send, title: "Send email", text: "Use the connected mailbox as the sender in flow email modules." },
                { icon: Search, title: "Find email data", text: "Search messages and replies for contacts, opportunities, and useful context." },
                { icon: Bot, title: "AI assistants", text: "Later, assistants can scan approved mailbox areas and suggest tasks or leads." },
              ].map((item) => (
                <div key={item.title} className="rounded-[9px] border border-white/10 bg-white/[0.03] p-3">
                  <item.icon size={16} className="text-fuchsia-300" />
                  <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[10px] border border-emerald-300/20 bg-emerald-400/10 p-4">
            <div className="flex gap-3">
              <ShieldCheck className="shrink-0 text-emerald-300" size={20} />
              <div>
                <p className="text-sm font-semibold text-emerald-50">What are you approving?</p>
                <p className="mt-2 text-xs leading-5 text-emerald-100/75">
                  You are authorising Trigger Mail AI to use the mailbox connection. We will keep provider tokens encrypted and use them for connected email features.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {providers.map((provider) => (
          <Panel key={provider.id} className="p-5">
            <div className="flex h-full flex-col justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="grid size-12 place-items-center rounded-full bg-white/[0.06] text-white">
                  <provider.icon size={22} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{provider.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{provider.description}</p>
                </div>
              </div>

              <button
                className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-[8px] px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${provider.buttonClass}`}
                disabled={Boolean(connectingProvider)}
                onClick={() => { void connectProvider(provider.id); }}
                type="button"
              >
                {connectingProvider === provider.id ? <Loader2 className="animate-spin" size={15} /> : <provider.icon size={15} />}
                {connectingProvider === provider.id ? "Connecting..." : provider.title}
              </button>
            </div>
          </Panel>
        ))}
      </div>

      {setupMissing && (
        <div className="rounded-[9px] border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <div>
                <p className="font-semibold">Email account storage still is not visible to the app.</p>
                <p className="mt-1 text-amber-100/80">
                  If you have just run <span className="font-mono">supabase/connected_email_accounts.sql</span>, Supabase may need a moment to refresh its schema cache. You can still try connecting above, or check again.
                </p>
              </div>
            </div>
            <button
              className="inline-flex h-8 shrink-0 items-center gap-2 rounded-[7px] border border-amber-100/20 bg-amber-100/10 px-2.5 text-xs font-semibold text-amber-50 transition hover:bg-amber-100/15 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              onClick={() => { void loadAccounts(); }}
              type="button"
            >
              {loading ? <Loader2 className="animate-spin" size={13} /> : <RefreshCw size={13} />}
              Check again
            </button>
          </div>
        </div>
      )}

      {accountError && (
        <div className="rounded-[9px] border border-red-danger/20 bg-red-danger/10 p-4 text-sm leading-6 text-red-100">
          {accountError}
        </div>
      )}

      <Panel className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">Connected mailboxes</h2>
            <p className="mt-1 text-sm text-slate-500">Accounts paired with Trigger Mail AI.</p>
          </div>
          {loading && <Loader2 className="animate-spin text-slate-400" size={18} />}
        </div>

        <div className="mt-4 grid gap-2">
          {accounts.length === 0 ? (
            <div className="rounded-[8px] border border-dashed border-white/15 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
              No mailboxes connected yet. Choose Gmail or Outlook above to start.
            </div>
          ) : accounts.map((account) => (
            <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-full bg-violet-brand/15 text-fuchsia-300">
                  {account.provider === "outlook" ? <Inbox size={16} /> : <Mail size={16} />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{account.email}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatProvider(account.provider)} mailbox</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${account.status === "connected" ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}>
                {account.status === "connected" && <CheckCircle2 size={12} />}
                {account.status}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}
