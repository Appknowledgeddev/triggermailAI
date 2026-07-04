import { NextResponse } from "next/server";
import { ensureWorkspaceForUser, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";
import type { Json } from "@/lib/supabase/types";

type ResendDomain = {
  id: string;
  name: string;
  status: string;
  region?: string | null;
  records?: Json;
};

function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function isDomain(value: string) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(value);
}

async function createResendDomain(domain: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new Error("Add RESEND_API_KEY before creating sending domains.");
  }

  const response = await fetch("https://api.resend.com/domains", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: domain,
      capabilities: {
        sending: "enabled",
        receiving: "disabled",
      },
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as ResendDomain & { message?: string; error?: string };

  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Resend could not create this domain.");
  }

  return payload;
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);
    const { data: domains, error } = await supabase
      .from("workspace_sending_domains")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ domains: domains || [] });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Sending domains could not be loaded.") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);
    const body = (await request.json().catch(() => ({}))) as { domain?: string };
    const domain = normalizeDomain(body.domain || "");

    if (!isDomain(domain)) {
      return NextResponse.json({ error: "Enter a valid domain, for example yourdomain.com." }, { status: 400 });
    }

    const resendDomain = await createResendDomain(domain);
    const { data: savedDomain, error } = await supabase
      .from("workspace_sending_domains")
      .upsert({
        workspace_id: workspaceId,
        resend_domain_id: resendDomain.id,
        name: resendDomain.name,
        status: resendDomain.status,
        region: resendDomain.region || null,
        records: resendDomain.records || [],
        created_by: user.id,
      }, { onConflict: "workspace_id,name" })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ domain: savedDomain });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Sending domain could not be created.") }, { status: 500 });
  }
}
