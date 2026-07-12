import { NextResponse } from "next/server";
import { sendEmail, type DeliveryProvider } from "@/lib/email/delivery";
import { buildSendableTemplateHtml, getEmailCustomHead, getEmailGlobalStyles } from "@/lib/email/template-html";
import { getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";
import type { Json } from "@/lib/supabase/types";

type RouteContext = {
  params: {
    flowId: string;
  };
};

type TestPayload = {
  payload?: Json;
};
type SupabaseAdminClient = Awaited<ReturnType<typeof getAdminContext>>["supabase"];
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

async function getAccessibleFlow(request: Request, flowId: string) {
  const { supabase, user } = await getAdminContext(request);
  const { data: flow, error: flowError } = await supabase
    .from("flows")
    .select("*")
    .eq("id", flowId)
    .maybeSingle();

  if (flowError) {
    throw flowError;
  }

  if (!flow?.workspace_id) {
    throw new Error("Flow was not found.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", flow.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (!membership) {
    throw new Error("You do not have access to this flow.");
  }

  return { supabase, flow, user };
}

function getDefaultPayload(flow: Awaited<ReturnType<typeof getAccessibleFlow>>["flow"]): Json {
  const settings = flow.settings && typeof flow.settings === "object" && !Array.isArray(flow.settings)
    ? flow.settings as Record<string, Json | undefined>
    : {};
  const trigger = settings.trigger && typeof settings.trigger === "object" && !Array.isArray(settings.trigger)
    ? settings.trigger as Record<string, Json | undefined>
    : {};
  const samplePayload = trigger.samplePayload;

  if (typeof samplePayload === "string") {
    try {
      return JSON.parse(samplePayload) as Json;
    } catch {
      return { samplePayload };
    }
  }

  return {
    email: "alex@example.com",
    first_name: "Alex",
    source: flow.trigger_type || "manual",
    test: true,
  };
}

function withSignedInTestEmail(payload: Json, email: string | null | undefined): Json {
  if (!email || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const record = payload as Record<string, Json>;
  const currentEmail = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  if (currentEmail && currentEmail !== "alex@example.com") {
    return payload;
  }

  return {
    ...record,
    email,
  };
}

function getConfigRecord(config: Json): Record<string, Json> {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {};
  }

  return config as Record<string, Json>;
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

function toRecord(value: Json): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
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
) {
  const stepData = buildStepData(step.config, context);
  const renderContext = {
    ...context,
    ...stepData,
  };
  const config = getConfigRecord(step.config);
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
  supabase: SupabaseAdminClient,
  flow: Awaited<ReturnType<typeof getAccessibleFlow>>["flow"],
  flowRunId: string,
  triggerPayload: Json,
) {
  const { data: steps, error: stepsError } = await supabase
    .from("flow_steps")
    .select("*")
    .eq("flow_id", flow.id)
    .order("position", { ascending: true });

  if (stepsError) {
    throw stepsError;
  }

  if (!flow.workspace_id) {
    return { completed: 0, failed: 0 };
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
            const result = await sendEmailModule(template as EmailTemplateRow, step, context, workspaceSender, defaultSendingAccount as DefaultSendingAccount);
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

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, flow } = await getAccessibleFlow(request, context.params.flowId);
    const { data: run, error: runError } = await supabase
      .from("flow_runs")
      .select("*")
      .eq("flow_id", flow.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runError) {
      throw runError;
    }

    if (!run) {
      return NextResponse.json({ run: null, events: [] });
    }

    const { data: events, error: eventsError } = await supabase
      .from("run_events")
      .select("*")
      .eq("flow_run_id", run.id)
      .order("created_at", { ascending: false })
      .limit(40);

    if (eventsError) {
      throw eventsError;
    }

    return NextResponse.json({ run, events: events || [] });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Test run could not be loaded.") }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, flow, user } = await getAccessibleFlow(request, context.params.flowId);
    const body = await request.json().catch(() => ({})) as TestPayload;
    const payload = withSignedInTestEmail(body.payload || getDefaultPayload(flow), user.email);

    const { data: flowRun, error: flowRunError } = await supabase
      .from("flow_runs")
      .insert({
        workspace_id: flow.workspace_id,
        flow_id: flow.id,
        trigger_id: flow.trigger_id,
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
      workspace_id: flow.workspace_id,
      trigger_id: flow.trigger_id,
      flow_run_id: flowRun.id,
      status: "received",
      payload,
      headers: {
        source: "manual-test",
      },
    });

    if (triggerEventError) {
      throw triggerEventError;
    }

    const { data: runEvent, error: runEventError } = await supabase
      .from("run_events")
      .insert({
        workspace_id: flow.workspace_id,
        flow_id: flow.id,
        flow_run_id: flowRun.id,
        event_type: "trigger_test_received",
        title: `Test ${flow.trigger_type || "trigger"} received`,
        metadata: {
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

    const execution = await executeFlowSteps(supabase, flow, flowRun.id, payload);
    const completedAt = new Date().toISOString();
    const { data: completedRun, error: runCompleteError } = await supabase
      .from("flow_runs")
      .update({
        status: execution.failed > 0 ? "failed" : "completed",
        completed_at: completedAt,
      })
      .eq("id", flowRun.id)
      .select("*")
      .single();

    if (runCompleteError) {
      throw runCompleteError;
    }

    const { data: events, error: eventsError } = await supabase
      .from("run_events")
      .select("*")
      .eq("flow_run_id", flowRun.id)
      .order("created_at", { ascending: false })
      .limit(40);

    if (eventsError) {
      throw eventsError;
    }

    return NextResponse.json({ run: completedRun || flowRun, events: events || [runEvent] });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Trigger test could not be started.") }, { status: 500 });
  }
}
