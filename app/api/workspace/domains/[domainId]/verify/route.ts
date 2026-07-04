import { NextResponse } from "next/server";
import { ensureWorkspaceForUser, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";
import type { Json } from "@/lib/supabase/types";

type RouteContext = {
  params: {
    domainId: string;
  };
};

type ResendDomain = {
  id: string;
  name: string;
  status: string;
  region?: string | null;
  records?: Json;
};

async function requestResendVerification(resendDomainId: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new Error("Add RESEND_API_KEY before verifying sending domains.");
  }

  const response = await fetch(`https://api.resend.com/domains/${resendDomainId}/verify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
  });
  const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string };

  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Resend could not start domain verification.");
  }
}

async function retrieveResendDomain(resendDomainId: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new Error("Add RESEND_API_KEY before verifying sending domains.");
  }

  const response = await fetch(`https://api.resend.com/domains/${resendDomainId}`, {
    headers: {
      Authorization: `Bearer ${resendKey}`,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as ResendDomain & { message?: string; error?: string };

  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Resend could not refresh this domain.");
  }

  return payload;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);
    const { data: existingDomain, error: lookupError } = await supabase
      .from("workspace_sending_domains")
      .select("*")
      .eq("id", context.params.domainId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (!existingDomain) {
      return NextResponse.json({ error: "Sending domain was not found." }, { status: 404 });
    }

    await requestResendVerification(existingDomain.resend_domain_id);
    const resendDomain = await retrieveResendDomain(existingDomain.resend_domain_id);
    const { data: savedDomain, error: updateError } = await supabase
      .from("workspace_sending_domains")
      .update({
        status: resendDomain.status,
        region: resendDomain.region || existingDomain.region,
        records: resendDomain.records || existingDomain.records,
      })
      .eq("id", existingDomain.id)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ domain: savedDomain });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Sending domain could not be verified.") }, { status: 500 });
  }
}
