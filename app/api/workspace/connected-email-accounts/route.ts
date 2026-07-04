import { NextResponse } from "next/server";
import { ensureWorkspaceForUser, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";

const providers = new Set(["gmail", "outlook", "smtp", "resend"]);

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);
    const { data: accounts, error } = await supabase
      .from("connected_email_accounts")
      .select("id, provider, email, display_name, status, scopes, metadata, last_used_at, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ accounts: accounts || [] });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Connected email accounts could not be loaded.") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);
    const body = (await request.json().catch(() => ({}))) as {
      provider?: string;
      email?: string;
      displayName?: string;
    };
    const provider = (body.provider || "").trim().toLowerCase();
    const email = (body.email || "").trim().toLowerCase();

    if (!providers.has(provider)) {
      return NextResponse.json({ error: "Choose Gmail, Outlook, SMTP, or Resend." }, { status: 400 });
    }

    if (!isEmail(email)) {
      return NextResponse.json({ error: "Enter the email address for this sending account." }, { status: 400 });
    }

    const { data: account, error } = await supabase
      .from("connected_email_accounts")
      .upsert({
        workspace_id: workspaceId,
        provider,
        email,
        display_name: body.displayName?.trim() || null,
        status: provider === "resend" ? "connected" : "setup_required",
        metadata: {
          setup: provider === "gmail" || provider === "outlook"
            ? "OAuth app credentials are required before this account can send."
            : "Manual sending account added.",
        },
        created_by: user.id,
      }, { onConflict: "workspace_id,provider,email" })
      .select("id, provider, email, display_name, status, scopes, metadata, last_used_at, created_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ account });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Connected email account could not be saved.") }, { status: 500 });
  }
}
