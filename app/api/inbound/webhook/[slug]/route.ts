import { NextResponse } from "next/server";
import { sendEmail, type DeliveryProvider } from "@/lib/email/delivery";
import { buildSendableTemplateHtml, getEmailCustomHead, getEmailGlobalStyles } from "@/lib/email/template-html";
import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/workspace-admin";
import type { Json } from "@/lib/supabase/types";

type RouteContext = {
  params: {
    slug: string;
  };
};

type InboundPayload = Record<string, Json | undefined>;
type FlowStepRow = {
  id: string;
  type: string;
  name: string;
  position: number;
  template_id: string | null;
  config: Json;
};
type EmailTemplateRow = {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  from_name: string | null;
  from_email: string | null;
  html: string | null;
  design: Json;
};
type WorkspaceSender = {
  default_from_name: string | null;
  default_from_email: string | null;
};
type DefaultSendingAccount = {
  id: string;
  provider: DeliveryProvider;
  email: string;
} | null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Trigger-Secret",
};

function jsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...init?.headers,
    },
  });
}

function headersToJson(headers: Headers): Json {
  return Object.fromEntries(Array.from(headers.entries())) as Json;
}

async function parseWebhookPayload(request: Request): Promise<Json> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await request.json() as Json;
  }

  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    const payload: InboundPayload = {};

    form.forEach((value, key) => {
      payload[key] = typeof value === "string"
        ? value
        : {
            name: value.name,
            size: value.size,
            type: value.type,
          };
    });

    return payload;
  }

  const raw = await request.text();
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw) as Json;
  } catch {
    return { raw };
  }
}

function getConfigRecord(config: Json): Record<string, Json> {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {};
  }

  return config as Record<string, Json>;
}

function toRecord(value: Json): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getConfigString(config: Json, key: string, fallback = "") {
  const value = getConfigRecord(config)[key];
  return typeof value === "string" ? value : fallback;
}

function getEmailAction(config: Json) {
  const action = getConfigString(config, "emailAction", "send");
  return action === "retrieve" ? "search" : action;
}

function getConfigStringRecord(config: Json, key: string): Record<string, string> {
  const value = getConfigRecord(config)[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

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
    return templateValueToString(record.email || record.address || toRecord(record.from as Json).email || toRecord(record.to as Json).email || record.value);
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
  return process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : new URL(request.url).origin);
}

function buildStepData(config: Json, context: Record<string, unknown>) {
  const handlebarData = getConfigStringRecord(config, "handlebarData");
  return Object.fromEntries(Object.entries(handlebarData).map(([key, value]) => [key, renderHandlebars(value, context)]));
}

function resolveDeliveryProvider(configuredProvider: string, configuredAccountId: string, defaultSendingAccount: DefaultSendingAccount) {
  if ((configuredProvider === "gmail" || configuredProvider === "outlook") && configuredAccountId) {
    return configuredProvider as DeliveryProvider;
  }

  if (configuredAccountId && defaultSendingAccount?.id === configuredAccountId) {
    return defaultSendingAccount.provider;
  }

  return (configuredProvider || defaultSendingAccount?.provider || "resend") as DeliveryProvider;
}

async function sendEmailModule(
  template: EmailTemplateRow,
  step: FlowStepRow,
  context: Record<string, unknown>,
  workspaceSender: WorkspaceSender | null,
  defaultSendingAccount: DefaultSendingAccount,
  assetBaseUrl: string,
) {
  const config = getConfigRecord(step.config);
  const stepData = buildStepData(step.config, context);
  const renderContext = {
    ...context,
    ...stepData,
  };
  const recipientExpression = getConfigString(step.config, "recipientEmail", "{{trigger.email}}");
  const to = renderHandlebars(recipientExpression, renderContext).trim();
  const fromName = template.from_name?.trim() || workspaceSender?.default_from_name?.trim() || "Trigger Mail AI";
  const configuredFrom = template.from_email?.trim() || workspaceSender?.default_from_email?.trim() || process.env.TEST_EMAIL_FROM || "onboarding@resend.dev";
  const from = configuredFrom.includes("<") ? configuredFrom : `${fromName} <${configuredFrom}>`;
  const renderedPreheader = renderHandlebars(template.preheader || "", renderContext);
  const subject = renderHandlebars(template.subject || "Trigger Mail AI", renderContext);
  const renderedHtml = template.html ? renderHandlebars(template.html, renderContext) : "";
  const html = buildSendableTemplateHtml({
    html: renderedHtml,
    preheader: renderedPreheader,
    customHead: getEmailCustomHead(template.design),
    globalStyles: getEmailGlobalStyles(template.design),
    assetBaseUrl,
  });
  const configuredProvider = typeof config.sendingAccountProvider === "string" ? config.sendingAccountProvider : "";
  const configuredAccountId = typeof config.sendingAccountId === "string" ? config.sendingAccountId : "";
  const connectedAccountId = configuredAccountId || defaultSendingAccount?.id || null;
  const provider = resolveDeliveryProvider(configuredProvider, configuredAccountId, defaultSendingAccount);
  const attemptedEmail = {
    templateId: template.id,
    templateName: template.name,
    senderProvider: provider,
    connectedAccountId,
    recipientExpression,
    to,
    from,
    subject,
    preheader: renderedPreheader,
    handlebarData: stepData,
    htmlPreview: html.replace(/\s+/g, " ").slice(0, 500),
  };

  if (!isEmail(to)) {
    return {
      ok: false,
      skipped: true,
      reason: "Recipient email is missing or invalid.",
      attemptedEmail,
    };
  }

  if (!template.html?.trim()) {
    return {
      ok: false,
      skipped: true,
      reason: "Selected email template has no HTML content.",
      attemptedEmail,
    };
  }

  const result = await sendEmail({
    provider,
    connectedAccountId,
    from,
    to,
    subject,
    html,
  });

  if (!result.ok) {
    return {
      ok: false,
      skipped: false,
      provider: result.provider,
      reason: result.reason || "Email provider rejected the message.",
      attemptedEmail,
    };
  }

  return {
    ok: true,
    skipped: false,
    provider: result.provider,
    id: result.id,
    attemptedEmail,
  };
}

async function executeFlowSteps(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  flow: { id: string; workspace_id: string | null },
  flowRunId: string,
  triggerPayload: Json,
  assetBaseUrl: string,
) {
  if (!flow.workspace_id) {
    return { completed: 0, failed: 0 };
  }

  const { data: steps, error: stepsError } = await supabase
    .from("flow_steps")
    .select("*")
    .eq("flow_id", flow.id)
    .order("position", { ascending: true });

  if (stepsError) {
    throw stepsError;
  }

  const { data: workspaceSender, error: workspaceSenderError } = await supabase
    .from("workspaces")
    .select("default_from_name, default_from_email")
    .eq("id", flow.workspace_id)
    .maybeSingle();

  if (workspaceSenderError) {
    throw workspaceSenderError;
  }

  const { data: defaultSendingAccount, error: defaultSendingAccountError } = await supabase
    .from("connected_email_accounts")
    .select("id, provider, email")
    .eq("workspace_id", flow.workspace_id)
    .eq("status", "connected")
    .in("provider", ["gmail", "outlook"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (defaultSendingAccountError && !/connected_email_accounts|schema cache|does not exist/i.test(defaultSendingAccountError.message)) {
    throw defaultSendingAccountError;
  }

  const context: Record<string, unknown> = {
    trigger: toRecord(triggerPayload),
  };
  let completed = 0;
  let failed = 0;

  const flowSteps = (steps || []) as FlowStepRow[];
  for (let index = 0; index < flowSteps.length; index += 1) {
    const step = flowSteps[index];
    const moduleKey = `module_${index + 1}`;
    const metadata: Record<string, unknown> = {
      stepId: step.id,
      stepType: step.type,
      position: step.position,
    };
    let eventType = `${step.type}_processed`;
    let title = `${step.name} processed`;

    try {
      if (step.type === "email") {
        const emailAction = getEmailAction(step.config);
        if (emailAction !== "send") {
          metadata.result = {
            ok: true,
            skipped: true,
            reason: "This Gmail action is configured. Gmail action execution is not connected yet.",
            action: emailAction,
            provider: getConfigString(step.config, "emailProvider", "gmail"),
            query: {
              accountId: getConfigString(step.config, "sendingAccountId"),
              provider: getConfigString(step.config, "sendingAccountProvider"),
              search: getConfigString(step.config, "retrieveQuery"),
              from: getConfigString(step.config, "retrieveFrom"),
              subject: getConfigString(step.config, "retrieveSubject"),
              limit: getConfigString(step.config, "retrieveLimit", "10"),
              since: getConfigString(step.config, "retrieveSince", "7d"),
              messageId: getConfigString(step.config, "messageId"),
              draftId: getConfigString(step.config, "draftId"),
              destinationLabel: getConfigString(step.config, "destinationLabel"),
              addLabels: getConfigString(step.config, "addLabels"),
              removeLabels: getConfigString(step.config, "removeLabels"),
              apiMethod: getConfigString(step.config, "apiMethod"),
              apiPath: getConfigString(step.config, "apiPath"),
            },
          };
          title = `${step.name} configured`;
          eventType = `gmail_${emailAction}_configured`;
          context[moduleKey] = metadata.result;
        } else if (!step.template_id) {
          metadata.result = { ok: false, skipped: true, reason: "No email template selected." };
          title = `${step.name} skipped`;
          eventType = "email_skipped";
          context[moduleKey] = metadata.result;
        } else {
          const { data: template, error: templateError } = await supabase
            .from("email_templates")
            .select("id, name, subject, preheader, from_name, from_email, html, design")
            .eq("id", step.template_id)
            .maybeSingle();

          if (templateError) {
            throw templateError;
          }

          if (!template) {
            metadata.result = { ok: false, skipped: true, reason: "Email template was not found." };
            title = `${step.name} skipped`;
            eventType = "email_skipped";
            context[moduleKey] = metadata.result;
          } else {
            const result = await sendEmailModule(
              template as EmailTemplateRow,
              step,
              context,
              workspaceSender,
              defaultSendingAccount as DefaultSendingAccount,
              assetBaseUrl,
            );
            metadata.result = result;
            title = result.ok ? `${step.name} sent` : `${step.name} ${result.skipped ? "skipped" : "failed"}`;
            eventType = result.ok ? "email_sent" : result.skipped ? "email_skipped" : "email_failed";
            context[moduleKey] = result;
            if (!result.ok && !result.skipped) {
              failed += 1;
            }
          }
        }
      } else if (step.type === "webhook") {
        metadata.result = { ok: true, skipped: true, reason: "HTTP request execution is not connected yet." };
        eventType = "http_skipped";
        title = `${step.name} skipped`;
        context[moduleKey] = metadata.result;
      } else {
        metadata.result = { ok: true };
        context[moduleKey] = metadata.result;
      }

      const { error: runEventError } = await supabase.from("run_events").insert({
        workspace_id: flow.workspace_id,
        flow_id: flow.id,
        flow_run_id: flowRunId,
        event_type: eventType,
        title,
        metadata: metadata as Json,
      });

      if (runEventError) {
        throw runEventError;
      }

      completed += 1;
    } catch (error) {
      failed += 1;
      const { error: failedEventError } = await supabase.from("run_events").insert({
        workspace_id: flow.workspace_id,
        flow_id: flow.id,
        flow_run_id: flowRunId,
        event_type: `${step.type}_failed`,
        title: `${step.name} failed`,
        metadata: {
          ...metadata,
          error: getErrorMessage(error, "Module failed."),
        },
      });

      if (failedEventError) {
        throw failedEventError;
      }
    }
  }

  return { completed, failed };
}

function hasValidSecret(request: Request, authMode: string, config: Json) {
  if (authMode !== "secret") {
    return true;
  }

  const secret = getConfigRecord(config).webhookSecret;
  if (typeof secret !== "string" || !secret) {
    return true;
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const triggerSecret = request.headers.get("x-trigger-secret");
  return bearer === secret || triggerSecret === secret;
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    if (!hasSupabaseAdminConfig()) {
      return jsonResponse({ ok: false, error: "Supabase service role key is missing on the server." }, { status: 500 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: trigger, error: triggerError } = await supabase
      .from("triggers")
      .select("id, type, status, event_name, endpoint_slug")
      .eq("endpoint_slug", context.params.slug)
      .in("type", ["webhook", "api", "form"])
      .limit(1)
      .maybeSingle();

    if (triggerError) {
      throw triggerError;
    }

    if (!trigger) {
      return jsonResponse({ ok: false, error: "No webhook trigger matches this endpoint. Save the webhook trigger first." }, { status: 404 });
    }

    return jsonResponse({
      ok: trigger.status === "active",
      status: trigger.status,
      type: trigger.type,
      eventName: trigger.event_name,
      endpoint: trigger.endpoint_slug,
      accepts: "POST",
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: getErrorMessage(error, "Webhook endpoint could not be checked.") }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    if (!hasSupabaseAdminConfig()) {
      return jsonResponse({ ok: false, error: "Supabase service role key is missing on the server." }, { status: 500 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: trigger, error: triggerError } = await supabase
      .from("triggers")
      .select("*")
      .eq("endpoint_slug", context.params.slug)
      .in("type", ["webhook", "api", "form"])
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (triggerError) {
      throw triggerError;
    }

    if (!trigger?.workspace_id) {
      return jsonResponse({ ok: false, error: "No active webhook trigger matches this endpoint. Save the webhook trigger first, then try again." }, { status: 404 });
    }

    if (!hasValidSecret(request, trigger.auth_mode, trigger.config)) {
      return jsonResponse({ ok: false, error: "Webhook secret is invalid." }, { status: 401 });
    }

    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("*")
      .eq("trigger_id", trigger.id)
      .eq("workspace_id", trigger.workspace_id)
      .limit(1)
      .maybeSingle();

    if (flowError) {
      throw flowError;
    }

    if (!flow) {
      return jsonResponse({ ok: false, error: "This webhook trigger is not attached to a flow yet. Save the flow and try again." }, { status: 404 });
    }

    const payload = await parseWebhookPayload(request);

    const { data: flowRun, error: flowRunError } = await supabase
      .from("flow_runs")
      .insert({
        workspace_id: trigger.workspace_id,
        flow_id: flow.id,
        trigger_id: trigger.id,
        status: "queued",
        payload,
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (flowRunError) {
      throw flowRunError;
    }

    const { error: triggerEventError } = await supabase.from("trigger_events").insert({
      workspace_id: trigger.workspace_id,
      trigger_id: trigger.id,
      flow_run_id: flowRun.id,
      status: "received",
      payload,
      headers: headersToJson(request.headers),
    });

    if (triggerEventError) {
      throw triggerEventError;
    }

    const { data: runEvent, error: runEventError } = await supabase
      .from("run_events")
      .insert({
        workspace_id: trigger.workspace_id,
        flow_id: flow.id,
        flow_run_id: flowRun.id,
        event_type: "webhook_received",
        title: `${trigger.event_name || trigger.name} received`,
        metadata: {
          endpoint: context.params.slug,
          payload,
        },
      })
      .select("*")
      .single();

    if (runEventError) {
      throw runEventError;
    }

    const { error: runStartError } = await supabase
      .from("flow_runs")
      .update({ status: "running" })
      .eq("id", flowRun.id);

    if (runStartError) {
      throw runStartError;
    }

    const execution = await executeFlowSteps(supabase, flow, flowRun.id, payload, getAppBaseUrl(request));

    const { error: updateTriggerError } = await supabase
      .from("triggers")
      .update({ last_received_at: new Date().toISOString() })
      .eq("id", trigger.id);

    if (updateTriggerError) {
      throw updateTriggerError;
    }

    const completedAt = new Date().toISOString();
    const { error: runCompleteError } = await supabase
      .from("flow_runs")
      .update({
        status: execution.failed > 0 ? "failed" : "completed",
        completed_at: completedAt,
      })
      .eq("id", flowRun.id);

    if (runCompleteError) {
      throw runCompleteError;
    }

    return jsonResponse({
      ok: true,
      flowRunId: flowRun.id,
      eventId: runEvent.id,
      status: execution.failed > 0 ? "failed" : "completed",
      modulesCompleted: execution.completed,
      modulesFailed: execution.failed,
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: getErrorMessage(error, "Webhook could not be processed.") }, { status: 500 });
  }
}
