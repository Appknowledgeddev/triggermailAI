import { NextResponse } from "next/server";
import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/workspace-admin";
import type { Json } from "@/lib/supabase/types";

type InboundPayload = Record<string, Json | undefined>;

function normaliseAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim().toLowerCase();
}

function collectAddressValues(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map(normaliseAddress)
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectAddressValues);
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return collectAddressValues(record.email || record.address || record.to || record.recipient);
  }

  return [];
}

function getNestedValue(source: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, source);
}

function findRecipients(payload: Record<string, unknown>) {
  const candidates = [
    "recipient",
    "recipients",
    "to",
    "To",
    "envelope.to",
    "message.to",
    "headers.to",
    "Headers.To",
  ];

  return Array.from(new Set(candidates.flatMap((path) => collectAddressValues(getNestedValue(payload, path)))));
}

function firstString(payload: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = getNestedValue(payload, key);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

function headersToJson(headers: Headers): Json {
  return Object.fromEntries(Array.from(headers.entries())) as Json;
}

async function parseInboundPayload(request: Request): Promise<InboundPayload> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as InboundPayload;
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
    return JSON.parse(raw) as InboundPayload;
  } catch {
    return { raw };
  }
}

function hasValidSecret(request: Request) {
  const expectedSecret = process.env.INBOUND_MAILHOOK_SECRET;
  if (!expectedSecret) {
    return true;
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const inboundSecret = request.headers.get("x-inbound-secret");
  return bearer === expectedSecret || inboundSecret === expectedSecret;
}

export async function POST(request: Request) {
  try {
    if (!hasSupabaseAdminConfig()) {
      return NextResponse.json({ error: "Supabase service role key is missing on the server." }, { status: 500 });
    }

    if (!hasValidSecret(request)) {
      return NextResponse.json({ error: "Inbound mailhook secret is invalid." }, { status: 401 });
    }

    const payload = await parseInboundPayload(request);
    const payloadRecord = payload as Record<string, unknown>;
    const recipients = findRecipients(payloadRecord);

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No recipient address was found in the inbound email payload." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: mailhook, error: mailhookError } = await supabase
      .from("mailhooks")
      .select("*")
      .in("address", recipients)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (mailhookError) {
      throw mailhookError;
    }

    if (!mailhook) {
      return NextResponse.json({ error: "No active mailhook matches this recipient address.", recipients }, { status: 404 });
    }

    const subject = firstString(payloadRecord, ["subject", "Subject", "message.subject"], "Inbound email received");
    const from = firstString(payloadRecord, ["from", "From", "sender", "message.from"]);
    const text = firstString(payloadRecord, ["text", "textBody", "plain", "body-plain", "message.text"]);
    const html = firstString(payloadRecord, ["html", "htmlBody", "body-html", "message.html"]);
    const receivedPayload: Json = {
      provider: firstString(payloadRecord, ["provider"], "generic"),
      recipient: mailhook.address,
      recipients,
      from,
      subject,
      text,
      html,
      raw: payload,
    };

    const { data: flowRun, error: flowRunError } = await supabase
      .from("flow_runs")
      .insert({
        workspace_id: mailhook.workspace_id,
        flow_id: mailhook.flow_id,
        trigger_id: mailhook.trigger_id,
        status: "queued",
        payload: receivedPayload,
      })
      .select("id")
      .single();

    if (flowRunError) {
      throw flowRunError;
    }

    const { error: triggerEventError } = await supabase.from("trigger_events").insert({
      workspace_id: mailhook.workspace_id,
      trigger_id: mailhook.trigger_id,
      flow_run_id: flowRun.id,
      status: "received",
      payload: receivedPayload,
      headers: headersToJson(request.headers),
    });

    if (triggerEventError) {
      throw triggerEventError;
    }

    const { error: runEventError } = await supabase.from("run_events").insert({
      workspace_id: mailhook.workspace_id,
      flow_id: mailhook.flow_id,
      flow_run_id: flowRun.id,
      event_type: "mailhook_received",
      title: subject,
      metadata: {
        mailhookAddress: mailhook.address,
        from,
        recipients,
      },
    });

    if (runEventError) {
      throw runEventError;
    }

    return NextResponse.json({
      ok: true,
      flowRunId: flowRun.id,
      mailhookAddress: mailhook.address,
      status: "queued",
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Inbound mailhook could not be processed.") }, { status: 500 });
  }
}
