import { NextResponse } from "next/server";
import { sendEmail, type DeliveryProvider } from "@/lib/email/delivery";
import { buildSendableTemplateHtml } from "@/lib/email/template-html";
import type { EmailGlobalStyles } from "@/lib/email/template-html";
import { ensureWorkspaceForUser, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";

function getValueByPath(data: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value && typeof value === "object" && key in value) {
      return (value as Record<string, unknown>)[key];
    }

    return undefined;
  }, data);
}

function templateValueToString(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return templateValueToString(value[0]);
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const from = record.from && typeof record.from === "object" && !Array.isArray(record.from) ? record.from as Record<string, unknown> : {};
    const to = record.to && typeof record.to === "object" && !Array.isArray(record.to) ? record.to as Record<string, unknown> : {};
    return templateValueToString(record.email || record.address || from.email || to.email || record.value);
  }

  return String(value);
}

function renderHandlebars(value: string, data: Record<string, unknown>) {
  return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const replacement = getValueByPath(data, key);
    return templateValueToString(replacement);
  });
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getAppBaseUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
  const requestOrigin = new URL(request.url).origin;
  const isLocalRequest = /\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(requestOrigin);
  const isLocalConfiguredUrl = /\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(configuredUrl);

  if (configuredUrl && (!isLocalConfiguredUrl || isLocalRequest)) {
    return configuredUrl;
  }

  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : requestOrigin;
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("default_from_name, default_from_email")
      .eq("id", workspaceId)
      .single();

    if (workspaceError) {
      throw workspaceError;
    }

    const body = (await request.json()) as {
      to?: string;
      subject?: string;
      preheader?: string | null;
      fromName?: string | null;
      fromEmail?: string | null;
      html?: string;
      customHead?: string;
      globalStyles?: Partial<EmailGlobalStyles>;
      data?: Record<string, unknown>;
      provider?: DeliveryProvider;
      connectedAccountId?: string | null;
    };

    const to = body.to?.trim() || "";

    if (!isEmail(to)) {
      return NextResponse.json({ error: "Enter a valid test recipient email." }, { status: 400 });
    }

    if (!body.html?.trim()) {
      return NextResponse.json({ error: "Add email content before sending a test." }, { status: 400 });
    }

    const testData = body.data && typeof body.data === "object" ? body.data : {};
    const renderedSubject = renderHandlebars(body.subject?.trim() || "Trigger Mail AI test email", testData);
    const renderedPreheader = renderHandlebars(body.preheader?.trim() || "", testData);
    const renderedHtml = renderHandlebars(body.html, testData);
    const sendableHtml = buildSendableTemplateHtml({
      html: renderedHtml,
      preheader: renderedPreheader,
      customHead: body.customHead || "",
      globalStyles: body.globalStyles,
      assetBaseUrl: getAppBaseUrl(request),
    });
    const fromName = body.fromName?.trim() || workspace.default_from_name?.trim() || "Trigger Mail AI";
    const configuredFrom = body.fromEmail?.trim() || workspace.default_from_email?.trim() || process.env.TEST_EMAIL_FROM || "onboarding@resend.dev";
    const from = configuredFrom.includes("<") ? configuredFrom : `${fromName} <${configuredFrom}>`;
    const { data: defaultSendingAccount, error: defaultSendingAccountError } = await supabase
      .from("connected_email_accounts")
      .select("id, provider, email")
      .eq("workspace_id", workspaceId)
      .eq("status", "connected")
      .in("provider", ["gmail", "outlook"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (defaultSendingAccountError && !/connected_email_accounts|schema cache|does not exist/i.test(defaultSendingAccountError.message)) {
      throw defaultSendingAccountError;
    }

    const provider = body.connectedAccountId && defaultSendingAccount?.id === body.connectedAccountId
      ? defaultSendingAccount.provider as DeliveryProvider
      : body.provider || (defaultSendingAccount?.provider as DeliveryProvider | undefined) || "resend";
    const connectedAccountId = body.connectedAccountId || defaultSendingAccount?.id || null;
    const attemptedEmail = {
      to,
      from,
      subject: renderedSubject,
      preheader: renderedPreheader,
      senderProvider: provider,
      connectedAccountId,
      handlebarData: testData,
      htmlPreview: sendableHtml.replace(/\s+/g, " ").slice(0, 8000),
      includesBodyCard: /data-builder-empty-body|height="?520"?|bgcolor="?#[fF]{6}"?/i.test(sendableHtml),
      patternImageUrl: sendableHtml.match(/background="([^"]*email-patterns[^"]*)"/)?.[1] || "",
    };

    const result = await sendEmail({
      provider,
      connectedAccountId,
      from,
      to,
      subject: renderedSubject,
      html: sendableHtml,
    });

    if (!result.ok) {
      return NextResponse.json({
        error: result.reason || "The test email could not be sent.",
        attemptedEmail,
      }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id: result.id, provider: result.provider, attemptedEmail });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "The test email could not be sent.") }, { status: 500 });
  }
}
