"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, Bot, CheckCircle2, CircleSlash, Clock, Eye, GitBranch, HardDrive, Inbox, Loader2, Mail, Maximize2, Minimize2, MousePointerClick, Move, Paperclip, Pencil, Play, Plus, RefreshCw, Save, Search, Settings, Square, StickyNote, Tag, ToggleRight, Trash2, Users, Webhook, X, Zap, ZoomIn, ZoomOut } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/types";

type Flow = Database["public"]["Tables"]["flows"]["Row"];
type Trigger = Database["public"]["Tables"]["triggers"]["Row"];
type FlowStep = Database["public"]["Tables"]["flow_steps"]["Row"];
type EmailTemplate = Database["public"]["Tables"]["email_templates"]["Row"];
type ConnectedEmailAccount = Pick<Database["public"]["Tables"]["connected_email_accounts"]["Row"], "id" | "provider" | "email" | "display_name" | "status" | "created_at">;
type DeliveryProvider = "resend" | "gmail" | "outlook";
type Mailhook = Database["public"]["Tables"]["mailhooks"]["Row"];
type FlowRun = Database["public"]["Tables"]["flow_runs"]["Row"];
type RunEvent = Database["public"]["Tables"]["run_events"]["Row"];
type FlowStepDraft = Pick<FlowStep, "id" | "type" | "name" | "position" | "branch_key" | "template_id"> & {
  config: Json;
};
type TriggerDraft = {
  triggerType: string;
  eventName: string;
  source: string;
  authMode: string;
  scheduleCron: string;
  mailhookAddress: string;
  samplePayload: string;
  notes: string;
};

type FlowBuilderProps = {
  flowId: string;
};

type CanvasPosition = {
  x: number;
  y: number;
};

type ModuleDragTarget = {
  kind: "trigger" | "step";
  id?: string;
};

type RunBubble = {
  key: string;
  title: string;
  subtitle: string;
  payload: Json;
  position: CanvasPosition;
  count: number;
};

type FlowRunWithEvents = FlowRun & {
  events: RunEvent[];
};

type ModuleContextMenu = {
  target: ModuleDragTarget;
  position: CanvasPosition;
};

type ModuleMenuState = {
  provider: "gmail" | "outlook" | null;
};

type EmailModuleTestResult = {
  ok: boolean;
  id?: string;
  error?: string;
  attemptedEmail?: Json;
};

const stepTypes = [
  { type: "email", label: "Email", name: "Send email", icon: Mail, accent: "border-fuchsia-300/70 text-white", bg: "bg-[linear-gradient(145deg,#f43f8f,#7c3aed)]", iconBg: "bg-white/20 text-white", glow: "shadow-[0_24px_70px_rgba(217,70,239,0.32)]" },
  { type: "webhook", label: "HTTP", name: "HTTP request", icon: Webhook, accent: "border-sky-300/70 text-white", bg: "bg-[linear-gradient(145deg,#0ea5e9,#2563eb)]", iconBg: "bg-white/20 text-white", glow: "shadow-[0_24px_70px_rgba(14,165,233,0.3)]" },
  { type: "wait", label: "Wait", name: "Wait 1 day", icon: Clock, accent: "border-amber-200/80 text-slate-950", bg: "bg-[linear-gradient(145deg,#fde047,#f97316)]", iconBg: "bg-slate-950/15 text-slate-950", glow: "shadow-[0_24px_70px_rgba(251,191,36,0.28)]" },
  { type: "condition", label: "Condition", name: "Check condition", icon: GitBranch, accent: "border-emerald-200/70 text-white", bg: "bg-[linear-gradient(145deg,#10b981,#0f766e)]", iconBg: "bg-white/20 text-white", glow: "shadow-[0_24px_70px_rgba(16,185,129,0.28)]" },
  { type: "tag_contact", label: "Tag", name: "Tag contact", icon: Tag, accent: "border-cyan-200/70 text-white", bg: "bg-[linear-gradient(145deg,#06b6d4,#0891b2)]", iconBg: "bg-white/20 text-white", glow: "shadow-[0_24px_70px_rgba(6,182,212,0.28)]" },
  { type: "ai_generate", label: "AI", name: "Generate with AI", icon: Bot, accent: "border-violet-200/70 text-white", bg: "bg-[linear-gradient(145deg,#8b5cf6,#ec4899)]", iconBg: "bg-white/20 text-white", glow: "shadow-[0_24px_70px_rgba(139,92,246,0.32)]" },
  { type: "end", label: "End", name: "End flow", icon: Settings, accent: "border-slate-200/60 text-white", bg: "bg-[linear-gradient(145deg,#64748b,#111827)]", iconBg: "bg-white/15 text-white", glow: "shadow-[0_24px_70px_rgba(100,116,139,0.24)]" },
];

const triggerTypes = [
  { value: "form", label: "Web form", description: "Start when someone submits a form.", source: "Website form", eventName: "New form submission", icon: MousePointerClick },
  { value: "webhook", label: "Webhook", description: "Start from an external app or website.", source: "External webhook", eventName: "Webhook received", icon: Webhook },
  { value: "mailhook", label: "Mailhook", description: "Start when an inbound email is received.", source: "Inbound email", eventName: "Email received", icon: Mail },
  { value: "schedule", label: "Schedule", description: "Start on a recurring schedule.", source: "Scheduled run", eventName: "Schedule reached", icon: Clock },
  { value: "api", label: "API", description: "Start from an authenticated API call.", source: "API", eventName: "API request received", icon: Settings },
  { value: "manual", label: "Manual", description: "Start when you trigger it yourself.", source: "Manual run", eventName: "Manual start", icon: Users },
];

const emailModuleActions = [
  { value: "send", provider: "Gmail", label: "Send an email", description: "Sends a new email.", category: "Email", icon: Mail },
  { value: "reply", provider: "Gmail", label: "Reply to an email", description: "Replies to the specified email.", category: "Email", icon: Mail },
  { value: "search", provider: "Gmail", label: "Search emails", description: "Searches for emails.", category: "Email", icon: Search },
  { value: "get", provider: "Gmail", label: "Get an email", description: "Gets specific email info.", category: "Email", icon: Inbox },
  { value: "copy", provider: "Gmail", label: "Copy an email", description: "Copies an email or draft into a selected folder.", category: "Email", icon: Inbox },
  { value: "move", provider: "Gmail", label: "Move an email", description: "Moves the chosen email or draft to the selected folder.", category: "Email", icon: Move },
  { value: "update_labels", provider: "Gmail", label: "Update email labels", description: "Updates labels on the specified email message.", category: "Email", icon: Tag },
  { value: "mark_read", provider: "Gmail", label: "Mark an email as read", description: "Marks an email or draft as read.", category: "Email", icon: Mail },
  { value: "mark_unread", provider: "Gmail", label: "Mark an email as unread", description: "Marks an email or draft as unread.", category: "Email", icon: Mail },
  { value: "delete", provider: "Gmail", label: "Delete an email", description: "Deletes an email by moving it to trash.", category: "Email", icon: Trash2 },
  { value: "create_draft", provider: "Gmail", label: "Create a draft email", description: "Creates a new draft email.", category: "Draft", icon: StickyNote },
  { value: "send_draft", provider: "Gmail", label: "Send a draft email", description: "Sends a draft email.", category: "Draft", icon: Mail },
  { value: "list_attachments", provider: "Gmail", label: "List email attachments and media", description: "Retrieves attachments and media for the specified email.", category: "Attachment", icon: Paperclip },
  { value: "api_call", provider: "Gmail", label: "Make an API call", description: "Sends a custom Gmail API call.", category: "Other", icon: Settings },
];

function formatStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const record = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const message = [record.message, record.details, record.hint, record.code].filter(Boolean).map(String).join(" ");
    return message || fallback;
  }

  return fallback;
}

function getDefaultSamplePayload() {
  return "{\n  \"email\": \"alex@example.com\",\n  \"first_name\": \"Alex\"\n}";
}

function parseSamplePayload(value: string): Json {
  try {
    return JSON.parse(value) as Json;
  } catch {
    throw new Error("The trigger sample payload needs to be valid JSON before it can be saved.");
  }
}

function parseSamplePayloadSafely(value: string): Json {
  try {
    return JSON.parse(value) as Json;
  } catch {
    return {};
  }
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

function makeEndpointSlug(flowId: string, triggerType: string) {
  return `${flowId.slice(0, 8)}-${triggerType}`.toLowerCase();
}

function makeWebhookEndpointPath(flowId: string, triggerType: string) {
  return `/api/inbound/webhook/${makeEndpointSlug(flowId, triggerType)}`;
}

function makeMailhookAddress(flowId: string) {
  return `inbound-${flowId.slice(0, 8).toLowerCase()}@mail.triggermail.ai`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatSamplePayload(value: Json) {
  if (!value || typeof value !== "object") {
    return getDefaultSamplePayload();
  }

  return JSON.stringify(value, null, 2);
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

function formatDate(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatHistoryDate(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatDuration(startedAt: string | null, completedAt: string | null) {
  if (!startedAt || !completedAt) {
    return "-";
  }

  const seconds = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  if (seconds === 0) {
    return "Less than 1 sec";
  }
  if (seconds < 60) {
    return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function formatDataSize(value: Json) {
  const bytes = new TextEncoder().encode(JSON.stringify(value || {})).length;
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

function getJsonEntries(value: Json): [string, Json][] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => [String(index), item as Json]);
  }

  return Object.entries(value as Record<string, Json>);
}

function formatJsonLeaf(value: Json) {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  return "";
}

function getCanvasPosition(value: Json | undefined): CanvasPosition | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, Json>;
  return typeof record.x === "number" && typeof record.y === "number" ? { x: record.x, y: record.y } : null;
}

function makeDefaultHandlebarValue(variable: string) {
  const normalised = variable.toLowerCase();
  if (normalised.includes("email")) {
    return "alex@example.com";
  }
  if (normalised.includes("first") || normalised === "name") {
    return "Alex";
  }
  if (normalised.includes("last")) {
    return "Morgan";
  }
  if (normalised.includes("company")) {
    return "Acme Inc";
  }
  if (normalised.includes("amount")) {
    return "49.00";
  }
  if (normalised.includes("date")) {
    return "21 June 2026";
  }
  return "";
}

function flattenJsonPaths(value: Json, prefix = ""): string[] {
  if (!value || typeof value !== "object") {
    return prefix ? [prefix] : [];
  }

  if (Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
      const nestedPaths = flattenJsonPaths(nestedValue, path);
      return nestedPaths.length > 0 ? nestedPaths : [path];
    }

    return [path];
  });
}

function getValueByPath(data: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value && typeof value === "object" && key in value) {
      return (value as Record<string, unknown>)[key];
    }

    return undefined;
  }, data);
}

function renderHandlebars(value: string, data: Record<string, unknown>) {
  return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const replacement = getValueByPath(data, key);
    return replacement === undefined || replacement === null ? "" : String(replacement);
  });
}

function makeModuleOutputFields(step: FlowStepDraft) {
  if (step.type === "email") {
    const emailAction = getEmailAction(step.config);
    if (emailAction === "search") {
      return ["messages", "count", "latest.from", "latest.subject"];
    }
    if (emailAction === "get") {
      return ["message.id", "message.from", "message.subject", "message.body"];
    }
    if (emailAction === "list_attachments") {
      return ["attachments", "count", "media"];
    }
    if (emailAction === "api_call") {
      return ["status", "response.body", "response.headers"];
    }
    if (emailAction !== "send") {
      return ["ok", "messageId", "threadId"];
    }
    return ["sent", "opened", "clicked", "bounced"];
  }
  if (step.type === "webhook") {
    return ["status", "response.body", "response.headers"];
  }
  if (step.type === "condition") {
    return ["matched", "field", "value"];
  }
  if (step.type === "ai_generate") {
    return ["text", "summary"];
  }
  if (step.type === "tag_contact") {
    return ["tag", "applied"];
  }
  if (step.type === "wait") {
    return ["completed_at"];
  }
  return ["result"];
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function clampZoom(nextZoom: number) {
  return Math.min(1.35, Math.max(0.55, Number(nextZoom.toFixed(3))));
}

export function FlowBuilder({ flowId }: FlowBuilderProps) {
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const canvasInitialViewSetRef = useRef(false);
  const moduleTitleInputRef = useRef<HTMLInputElement | null>(null);
  const panStartRef = useRef({ pointerId: null as number | null, x: 0, y: 0, left: 0, top: 0 });
  const moduleDragRef = useRef<{
    target: ModuleDragTarget;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const touchGestureRef = useRef<{
    mode: "pan" | "pinch";
    x: number;
    y: number;
    left: number;
    top: number;
    distance: number;
    zoom: number;
    canvasX: number;
    canvasY: number;
  } | null>(null);
  const listeningBaselineRunIdRef = useRef<string | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [steps, setSteps] = useState<FlowStepDraft[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedEmailAccount[]>([]);
  const [liveRun, setLiveRun] = useState<FlowRun | null>(null);
  const [liveEvents, setLiveEvents] = useState<RunEvent[]>([]);
  const [runHistory, setRunHistory] = useState<FlowRunWithEvents[]>([]);
  const [runHistoryLoading, setRunHistoryLoading] = useState(false);
  const [runHistoryView, setRunHistoryView] = useState<"list" | "details">("list");
  const [runLogExpanded, setRunLogExpanded] = useState(false);
  const [publicBaseUrl, setPublicBaseUrl] = useState("");
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [visibleRunBubbleKeys, setVisibleRunBubbleKeys] = useState<string[]>([]);
  const [openRunBubbleKey, setOpenRunBubbleKey] = useState<string | null>(null);
  const [expandedCanvasPopup, setExpandedCanvasPopup] = useState<"settings" | "data" | null>(null);
  const [dataInspectorSearch, setDataInspectorSearch] = useState("");
  const [collapsedDataPaths, setCollapsedDataPaths] = useState<string[]>([]);
  const [webhookTestSending, setWebhookTestSending] = useState(false);
  const [emailModuleTestSending, setEmailModuleTestSending] = useState(false);
  const [emailModuleTestResult, setEmailModuleTestResult] = useState<EmailModuleTestResult | null>(null);
  const [activeDataPickerVariable, setActiveDataPickerVariable] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<"trigger" | "step">("trigger");
  const [moduleSettingsOpen, setModuleSettingsOpen] = useState(false);
  const [activeInspectorTab, setActiveInspectorTab] = useState<"settings" | "data" | "modules">("settings");
  const [moduleMenuIndex, setModuleMenuIndex] = useState<number | null>(null);
  const [moduleMenuState, setModuleMenuState] = useState<ModuleMenuState>({ provider: null });
  const [moduleContextMenu, setModuleContextMenu] = useState<ModuleContextMenu | null>(null);
  const [draggingModule, setDraggingModule] = useState<ModuleDragTarget | null>(null);
  const [triggerPosition, setTriggerPosition] = useState<CanvasPosition>({ x: 240, y: 300 });
  const [zoom, setZoom] = useState(0.92);
  const zoomRef = useRef(0.92);
  const [canvasDragging, setCanvasDragging] = useState(false);
  const [runStage, setRunStage] = useState<"idle" | "saving" | "listening" | "playing" | "complete" | "error">("idle");
  const [activeRunIndex, setActiveRunIndex] = useState<number | null>(null);
  const [listeningForTrigger, setListeningForTrigger] = useState(false);
  const [payloadBounceKey, setPayloadBounceKey] = useState(0);
  const [moduleFlash, setModuleFlash] = useState<{ key: string; nonce: number } | null>(null);
  const [triggerAdded, setTriggerAdded] = useState(false);
  const [triggerDraft, setTriggerDraft] = useState<TriggerDraft>({
    triggerType: "form",
    eventName: "",
    source: "",
    authMode: "none",
    scheduleCron: "",
    mailhookAddress: makeMailhookAddress(flowId),
    samplePayload: getDefaultSamplePayload(),
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [testingTrigger, setTestingTrigger] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabaseReady = hasSupabaseConfig();

  const loadFlow = useCallback(async () => {
    if (!supabaseReady) {
      setError("Supabase keys are missing, so this flow cannot be loaded yet.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    canvasInitialViewSetRef.current = false;

    try {
      const supabase = createSupabaseBrowserClient();
      const [{ data, error: loadError }, { data: stepRows, error: stepsError }] = await Promise.all([
        supabase
          .from("flows")
          .select("*")
          .eq("id", flowId)
          .maybeSingle(),
        supabase
          .from("flow_steps")
          .select("*")
          .eq("flow_id", flowId)
          .order("position", { ascending: true }),
      ]);

      if (loadError) {
        throw loadError;
      }

      if (stepsError) {
        throw stepsError;
      }

      if (!data) {
        throw new Error("Flow was not found.");
      }

      if (data.workspace_id) {
        const { data: templateRows, error: templatesError } = await supabase
          .from("email_templates")
          .select("*")
          .eq("workspace_id", data.workspace_id)
          .order("updated_at", { ascending: false });

        if (templatesError) {
          throw templatesError;
        }

        setTemplates(templateRows || []);

        const { data: accountRows, error: accountsError } = await supabase
          .from("connected_email_accounts")
          .select("id, provider, email, display_name, status, created_at")
          .eq("workspace_id", data.workspace_id)
          .order("created_at", { ascending: false });

        if (accountsError && !/connected_email_accounts|schema cache|does not exist/i.test(accountsError.message)) {
          throw accountsError;
        }

        setConnectedAccounts(accountRows || []);
      } else {
        setTemplates([]);
        setConnectedAccounts([]);
      }

      let triggerRow: Trigger | null = null;
      let mailhookRow: Mailhook | null = null;
      if (data.trigger_id) {
        const { data: loadedTrigger, error: triggerError } = await supabase
          .from("triggers")
          .select("*")
          .eq("id", data.trigger_id)
          .maybeSingle();

        if (triggerError) {
          throw triggerError;
        }

        triggerRow = loadedTrigger;
      }

      if (data.workspace_id) {
        const { data: loadedMailhook, error: mailhookError } = await supabase
          .from("mailhooks")
          .select("*")
          .eq("workspace_id", data.workspace_id)
          .eq("flow_id", flowId)
          .maybeSingle();

        if (mailhookError) {
          throw mailhookError;
        }

        mailhookRow = loadedMailhook;
      }

      setFlow(data);
      const settings = data.settings && typeof data.settings === "object" && !Array.isArray(data.settings) ? data.settings as Record<string, Json | undefined> : {};
      const triggerSettings = settings.trigger && typeof settings.trigger === "object" && !Array.isArray(settings.trigger) ? settings.trigger as Record<string, Json | undefined> : {};
      setTriggerPosition(getCanvasPosition(settings.triggerCanvasPosition) || { x: 240, y: 300 });
      const hasTriggerModule = Boolean(triggerRow || data.trigger_id || data.trigger_type || triggerSettings.eventName);
      setTriggerAdded(hasTriggerModule);
      setTriggerDraft({
        triggerType: triggerRow?.type || data.trigger_type || "form",
        eventName: triggerRow?.event_name || (typeof triggerSettings.eventName === "string" ? triggerSettings.eventName : ""),
        source: triggerRow?.source || (typeof triggerSettings.source === "string" ? triggerSettings.source : ""),
        authMode: triggerRow?.auth_mode || (typeof triggerSettings.authMode === "string" ? triggerSettings.authMode : "none"),
        scheduleCron: triggerRow?.schedule_cron || (typeof triggerSettings.scheduleCron === "string" ? triggerSettings.scheduleCron : ""),
        mailhookAddress: mailhookRow?.address || (typeof triggerSettings.mailhookAddress === "string" ? triggerSettings.mailhookAddress : makeMailhookAddress(flowId)),
        samplePayload: triggerRow ? formatSamplePayload(triggerRow.sample_payload) : (typeof triggerSettings.samplePayload === "string" ? triggerSettings.samplePayload : getDefaultSamplePayload()),
        notes: typeof triggerSettings.notes === "string" ? triggerSettings.notes : "",
      });
      const nextSteps = (stepRows || []).map((step) => ({
        id: step.id,
        type: step.type,
        name: step.name,
        position: step.position,
        branch_key: step.branch_key,
        template_id: step.template_id,
        config: step.config,
      }));
      setSteps(nextSteps);
      setSelectedStepId(null);
      setSelectedPanel("trigger");
      setModuleSettingsOpen(false);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Flow could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [flowId, supabaseReady]);

  useEffect(() => {
    void loadFlow();
  }, [loadFlow]);

  useEffect(() => {
    setPublicBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const title = flow?.name || "Flow";
  const selectedStep = steps.find((step) => step.id === selectedStepId) || null;
  const selectedStepIndex = selectedStep ? steps.findIndex((step) => step.id === selectedStep.id) : -1;
  const previousSteps = selectedStepIndex > -1 ? steps.slice(0, selectedStepIndex) : [];
  const moduleY = triggerPosition.y;
  const triggerX = triggerPosition.x;
  const moduleGap = 230;
  const canvasWorkspacePadding = 900;
  const stepPositions = steps.map((step, index) => getStepCanvasPosition(step, index));
  const canvasWidth = Math.max(980, triggerPosition.x + 520, ...stepPositions.map((position) => position.x + 320));
  const canvasHeight = Math.max(640, triggerPosition.y + 280, ...stepPositions.map((position) => position.y + 280));
  const canvasScrollWidth = canvasWidth + canvasWorkspacePadding * 2;
  const canvasScrollHeight = canvasHeight + canvasWorkspacePadding * 2;
  const selectedEmailTemplate = selectedStep?.template_id ? templates.find((template) => template.id === selectedStep.template_id) || null : null;
  const defaultConnectedSendingAccount = connectedAccounts.find((account) => account.status === "connected" && (account.provider === "gmail" || account.provider === "outlook")) || null;
  const livePayloadText = liveRun ? JSON.stringify(liveRun.payload, null, 2) : "";
  const webhookEndpointPath = makeWebhookEndpointPath(flowId, triggerDraft.triggerType);
  const webhookEndpoint = `${publicBaseUrl}${webhookEndpointPath}`;
  const listensForExternalData = triggerDraft.triggerType === "webhook" || triggerDraft.triggerType === "api";
  const triggerPayloadPaths = Array.from(new Set([
    ...flattenJsonPaths(liveRun?.payload || null),
    ...flattenJsonPaths(parseSamplePayloadSafely(triggerDraft.samplePayload)),
  ])).slice(0, 18);
  const selectedModulePosition = selectedPanel === "trigger"
    ? triggerPosition
    : selectedStep && selectedStepIndex > -1
      ? getStepCanvasPosition(selectedStep, selectedStepIndex)
      : null;

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (loading || !viewport || canvasInitialViewSetRef.current) {
      return;
    }

    viewport.scrollLeft = Math.max(0, canvasWorkspacePadding * zoom - 120);
    viewport.scrollTop = Math.max(0, canvasWorkspacePadding * zoom - 140);
    canvasInitialViewSetRef.current = true;
  }, [canvasWorkspacePadding, loading, zoom]);

  function getStepType(type: string) {
    return stepTypes.find((stepType) => stepType.type === type) || stepTypes[0];
  }

  function getStepCanvasPosition(step: FlowStepDraft, index: number): CanvasPosition {
    return getCanvasPosition(getConfigRecord(step.config).canvasPosition) || {
      x: triggerPosition.x + moduleGap * (index + 1),
      y: triggerPosition.y,
    };
  }

  function getRunEventForModule(moduleKey: string) {
    return getRunEventsForModule(moduleKey)[0] || null;
  }

  function getRunEventsForModule(moduleKey: string) {
    if (moduleKey === "trigger") {
      const triggerEvents = liveEvents.filter((event) => event.event_type.includes("trigger") || event.event_type.includes("webhook"));
      return triggerEvents.length > 0 ? triggerEvents : liveEvents.slice(0, 1);
    }

    return liveEvents.filter((event) => {
      const metadata = getConfigRecord(event.metadata);
      return metadata.stepId === moduleKey;
    });
  }

  function getRunEventSummary(event: RunEvent) {
    const metadata = getConfigRecord(event.metadata);
    const result = getConfigRecord(metadata.result);
    const attemptedEmail = getConfigRecord(result.attemptedEmail);
    const sentData = Object.keys(attemptedEmail).length > 0 ? attemptedEmail : getConfigRecord(result.sentData);
    const reason = typeof result.reason === "string"
      ? result.reason
      : typeof metadata.error === "string"
        ? metadata.error
        : "";
    const sentTo = typeof sentData.to === "string" ? sentData.to : typeof result.to === "string" ? result.to : "";
    const providerId = typeof result.id === "string" ? result.id : "";

    if (providerId) {
      return `Sent by Resend. Provider id: ${providerId}`;
    }

    if (reason && sentTo) {
      return `${reason} Recipient: ${sentTo}`;
    }

    if (reason) {
      return reason;
    }

    if (sentTo) {
      return `Recipient: ${sentTo}`;
    }

    return "";
  }

  function getRunEventStatus(event: RunEvent) {
    const metadata = getConfigRecord(event.metadata);
    const result = getConfigRecord(metadata.result);
    if (event.event_type.includes("failed") || result.ok === false && !result.skipped) {
      return "failed";
    }
    if (event.event_type.includes("skipped") || result.skipped === true) {
      return "skipped";
    }
    return "completed";
  }

  function getRunEventAccent(event: RunEvent) {
    const status = getRunEventStatus(event);
    if (status === "failed") {
      return "bg-red-danger text-white";
    }
    if (status === "skipped") {
      return "bg-fuchsia-700 text-white";
    }
    if (event.event_type.includes("webhook") || event.event_type.includes("trigger")) {
      return "bg-rose-600 text-white";
    }
    if (event.event_type.includes("http")) {
      return "bg-sky-600 text-white";
    }
    return "bg-fuchsia-700 text-white";
  }

  function getRunEventModuleName(event: RunEvent) {
    const metadata = getConfigRecord(event.metadata);
    if (!metadata.stepId) {
      return triggerDraft.eventName || "Webhook";
    }

    return steps.find((step) => step.id === metadata.stepId)?.name || event.title;
  }

  function getRunEventOperation(event: RunEvent, index: number) {
    const metadata = getConfigRecord(event.metadata);
    return typeof metadata.position === "number" ? metadata.position : index + 1;
  }

  function getRunEventLogMessage(event: RunEvent) {
    const status = getRunEventStatus(event);
    const summary = getRunEventSummary(event);
    if (summary) {
      return summary;
    }
    if (status === "failed") {
      return "The operation failed.";
    }
    if (status === "skipped") {
      const metadata = getConfigRecord(event.metadata);
      const result = getConfigRecord(metadata.result);
      return typeof result.reason === "string" ? result.reason : "The bundle did not pass through the filter.";
    }
    return "The operation was completed.";
  }

  function getRunBubble(moduleKey: string): RunBubble | null {
    if (!liveRun) {
      return null;
    }

    if (moduleKey === "trigger") {
      const triggerEvents = getRunEventsForModule("trigger");
      return {
        key: "trigger",
        title: "Data received",
        subtitle: liveEvents[0]?.event_type === "trigger_test_received" ? "Sample test data" : "Live trigger data",
        payload: liveRun.payload,
        position: triggerPosition,
        count: Math.max(1, triggerEvents.length),
      };
    }

    const stepIndex = steps.findIndex((step) => step.id === moduleKey);
    const step = steps[stepIndex];
    if (!step) {
      return null;
    }

    const event = getRunEventForModule(moduleKey);
    if (!event) {
      return null;
    }

    const moduleEvents = getRunEventsForModule(moduleKey);
    const eventMetadata = event ? getConfigRecord(event.metadata) : {};
    const result = getConfigRecord(eventMetadata.result);
    const attemptedEmail = getConfigRecord(result.attemptedEmail);
    const stepType = getStepType(step.type);
    const singleEventPayload = step.type === "email" && Object.keys(attemptedEmail).length > 0
      ? {
          status: event.event_type,
          reason: typeof result.reason === "string" ? result.reason : undefined,
          providerId: typeof result.id === "string" ? result.id : undefined,
          attemptedEmail,
        }
      : event.metadata;
    const bubblePayload = moduleEvents.length > 1
      ? moduleEvents.map((moduleEvent) => ({
          title: moduleEvent.title,
          eventType: moduleEvent.event_type,
          createdAt: moduleEvent.created_at,
          metadata: moduleEvent.metadata,
        }))
      : singleEventPayload;

    return {
      key: moduleKey,
      title: `${stepType.label} data`,
      subtitle: formatStatus(event.event_type),
      payload: Object.keys(eventMetadata).length > 0 ? bubblePayload : {
        module: step.name,
        type: step.type,
        status: "No run data was recorded for this module.",
      },
      position: getStepCanvasPosition(step, stepIndex),
      count: Math.max(1, moduleEvents.length),
    };
  }

  const runBubbles = visibleRunBubbleKeys
    .map((moduleKey) => getRunBubble(moduleKey))
    .filter((bubble): bubble is RunBubble => Boolean(bubble));
  const orderedLiveEvents = [...liveEvents].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const visibleRunEvents = runLogExpanded ? orderedLiveEvents : orderedLiveEvents.slice(0, 8);
  const selectedRunHistoryIndex = liveRun ? runHistory.findIndex((run) => run.id === liveRun.id) : -1;
  const selectedRunLabel = selectedRunHistoryIndex > -1 ? `Run ${runHistory.length - selectedRunHistoryIndex}` : "Run";

  function jsonTreeMatches(key: string, value: Json, search: string): boolean {
    if (!search) {
      return true;
    }

    const needle = search.toLowerCase();
    if (key.toLowerCase().includes(needle) || formatJsonLeaf(value).toLowerCase().includes(needle)) {
      return true;
    }

    return getJsonEntries(value).some(([childKey, childValue]) => jsonTreeMatches(childKey, childValue, search));
  }

  function toggleDataPath(path: string) {
    setCollapsedDataPaths((paths) => paths.includes(path) ? paths.filter((item) => item !== path) : [...paths, path]);
  }

  function openModuleSettingsPanel() {
    setOpenRunBubbleKey(null);
    setExpandedCanvasPopup(null);
    setModuleSettingsOpen(true);
  }

  function openRunDataPanel(moduleKey: string) {
    setModuleSettingsOpen(false);
    setExpandedCanvasPopup(null);
    setOpenRunBubbleKey(moduleKey);
    setDataInspectorSearch("");
    setCollapsedDataPaths([]);
    setPayloadBounceKey((key) => key + 1);
  }

  function closeRunDataPanel() {
    setOpenRunBubbleKey(null);
    setExpandedCanvasPopup(null);
  }

  function closeModuleSettingsPanel() {
    setModuleSettingsOpen(false);
    setExpandedCanvasPopup(null);
  }

  function renderJsonTree(value: Json, depth = 0, parentPath = "root", search = dataInspectorSearch.trim().toLowerCase()): React.ReactNode {
    const entries = getJsonEntries(value);
    if (entries.length === 0) {
      return <span className="text-slate-500">{formatJsonLeaf(value)}</span>;
    }

    const visibleEntries = entries.filter(([key, entryValue]) => jsonTreeMatches(key, entryValue, search));
    if (visibleEntries.length === 0) {
      return <p className="text-[11px] text-slate-400">No matching fields.</p>;
    }

    return (
      <div className={depth === 0 ? "space-y-1.5" : "ml-3 border-l border-cyan-400/15 pl-2"}>
        {visibleEntries.map(([key, entryValue]) => {
          const childEntries = getJsonEntries(entryValue);
          const isCollection = childEntries.length > 0;
          const path = `${parentPath}.${key}`;
          const isCollapsed = collapsedDataPaths.includes(path) && !search;
          return (
            <div key={path} className="text-[11px] leading-4">
              <div className="flex min-w-0 items-start gap-1">
                {isCollection ? (
                  <button
                    aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${key}`}
                    className="mt-[3px] grid size-3.5 shrink-0 place-items-center rounded-[4px] border border-cyan-300/35 bg-cyan-300/10 text-[9px] leading-none text-cyan-200"
                    onClick={() => toggleDataPath(path)}
                    type="button"
                  >
                    {isCollapsed ? "+" : "-"}
                  </button>
                ) : (
                  <span className="mt-[7px] h-px w-3 shrink-0 bg-cyan-300/25" />
                )}
                <p className="min-w-0 break-words">
                  <span className="text-cyan-200">{key}</span>
                  {isCollection ? (
                    <span className="text-slate-500">: {Array.isArray(entryValue) ? "array" : "group"}</span>
                  ) : (
                    <>
                      <span className="text-slate-500">: </span>
                      <span className="text-slate-300">{formatJsonLeaf(entryValue)}</span>
                    </>
                  )}
                </p>
              </div>
              {isCollection && !isCollapsed && renderJsonTree(entryValue, depth + 1, path, search)}
            </div>
          );
        })}
      </div>
    );
  }

  function renderDataInspector(bubble: RunBubble) {
    const operationLabel = bubble.key === "trigger" ? "Operation 1" : bubble.title;
    const inputPayload = bubble.key === "trigger" && liveEvents[0]
      ? getConfigRecord(liveEvents[0].metadata)
      : { bundle: bubble.payload } as Record<string, Json>;
    const outputPayload = bubble.key === "trigger" ? liveRun?.payload || bubble.payload : bubble.payload;

    return (
      <div className="max-h-[520px] overflow-auto rounded-[10px] border border-cyan-300/15 bg-[#07111D] p-3 text-slate-100 shadow-inner">
        <div className="rounded-[8px] border border-cyan-300/15 bg-cyan-300/[0.06] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">Packet overview</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-200">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-emerald-200"><CheckCircle2 size={13} /> {bubble.count} {bubble.count === 1 ? "step" : "steps"}</span>
            <span className="rounded-full bg-white/[0.06] px-2 py-1">{bubble.count} credit</span>
            <span className="rounded-full bg-white/[0.06] px-2 py-1">{formatDataSize(outputPayload)}</span>
          </div>
        </div>

        <div className="mt-3 flex h-9 items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-2 text-xs text-slate-400">
          <Search size={13} />
          <input
            className="min-w-0 flex-1 bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500"
            onChange={(event) => setDataInspectorSearch(event.target.value)}
            placeholder="Find a field or value"
            value={dataInspectorSearch}
          />
          {dataInspectorSearch && (
            <button className="text-slate-500 transition hover:text-white" onClick={() => setDataInspectorSearch("")} type="button">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.65)]" />
            Packet opened
          </div>

          <section className="rounded-[9px] border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center justify-between gap-2 text-sm text-slate-100">
              <span className="inline-flex items-center gap-2"><span className="grid size-5 place-items-center rounded-full bg-cyan-300/15 text-[11px] font-bold text-cyan-200">1</span>{operationLabel}</span>
              <span className="text-xs text-slate-500">{bubble.count} events</span>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Received</p>
                {renderJsonTree(inputPayload as Json)}
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Resolved</p>
                {renderJsonTree(outputPayload)}
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Usage</p>
                {renderJsonTree({ cost: `${bubble.count} credit`, size: formatDataSize(outputPayload) })}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div className="rounded-[8px] border border-white/10 bg-white/[0.03] px-2 py-2">Stored in run log</div>
            <div className="rounded-[8px] border border-white/10 bg-white/[0.03] px-2 py-2">Ready for mapping</div>
          </div>
        </div>
      </div>
    );
  }

  function triggerModuleFlash(moduleKey: string) {
    const nonce = Date.now();
    setModuleFlash({ key: moduleKey, nonce });
    window.setTimeout(() => {
      setModuleFlash((current) => current?.nonce === nonce ? null : current);
    }, 760);
  }

  function getModulePosition(target: ModuleDragTarget): CanvasPosition {
    if (target.kind === "trigger") {
      return triggerPosition;
    }

    const stepIndex = steps.findIndex((step) => step.id === target.id);
    return stepIndex > -1 ? getStepCanvasPosition(steps[stepIndex], stepIndex) : triggerPosition;
  }

  function updateStepCanvasPosition(stepId: string, position: CanvasPosition) {
    setSteps((currentSteps) => currentSteps.map((step) => {
      if (step.id !== stepId) {
        return step;
      }

      return {
        ...step,
        config: {
          ...getConfigRecord(step.config),
          canvasPosition: position,
        },
      };
    }));
  }

  function updateZoom(nextZoom: number) {
    const clampedZoom = clampZoom(nextZoom);
    zoomRef.current = clampedZoom;
    setZoom(clampedZoom);
  }

  function getTouchCenter(touches: React.TouchList) {
    const touchA = touches[0];
    const touchB = touches[1] || touches[0];
    return {
      x: (touchA.clientX + touchB.clientX) / 2,
      y: (touchA.clientY + touchB.clientY) / 2,
    };
  }

  function getTouchDistance(touches: React.TouchList) {
    if (touches.length < 2) {
      return 0;
    }

    const touchA = touches[0];
    const touchB = touches[1];
    return Math.hypot(touchB.clientX - touchA.clientX, touchB.clientY - touchA.clientY);
  }

  const zoomCanvasAtPoint = useCallback((clientX: number, clientY: number, wheelDelta: number) => {
    const viewport = canvasViewportRef.current;
    if (!viewport) {
      return;
    }

    const currentZoom = zoomRef.current;
    const boundedWheelDelta = Math.max(-80, Math.min(80, wheelDelta));
    const nextZoom = clampZoom(currentZoom * Math.exp(-boundedWheelDelta * 0.0012));
    if (nextZoom === currentZoom) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;
    const contentX = (viewport.scrollLeft + pointerX) / currentZoom;
    const contentY = (viewport.scrollTop + pointerY) / currentZoom;

    zoomRef.current = nextZoom;
    flushSync(() => {
      setZoom(nextZoom);
    });
    viewport.scrollLeft = contentX * nextZoom - pointerX;
    viewport.scrollTop = contentY * nextZoom - pointerY;
  }, []);

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (loading || !viewport) {
      return undefined;
    }

    function handleNativeCanvasWheel(event: WheelEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea, select, [data-canvas-control='true']")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      zoomCanvasAtPoint(event.clientX, event.clientY, event.deltaY || event.deltaX);
    }

    viewport.addEventListener("wheel", handleNativeCanvasWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleNativeCanvasWheel);
  }, [loading, zoomCanvasAtPoint]);

  function handleCanvasTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [data-canvas-control='true']")) {
      return;
    }

    const viewport = canvasViewportRef.current;
    if (!viewport) {
      return;
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchGestureRef.current = {
        mode: "pan",
        x: touch.clientX,
        y: touch.clientY,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
        distance: 0,
        zoom: zoomRef.current,
        canvasX: 0,
        canvasY: 0,
      };
      return;
    }

    if (event.touches.length >= 2) {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const center = getTouchCenter(event.touches);
      const pointerX = center.x - rect.left;
      const pointerY = center.y - rect.top;

      touchGestureRef.current = {
        mode: "pinch",
        x: center.x,
        y: center.y,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
        distance: getTouchDistance(event.touches),
        zoom: zoomRef.current,
        canvasX: (viewport.scrollLeft + pointerX) / zoomRef.current,
        canvasY: (viewport.scrollTop + pointerY) / zoomRef.current,
      };
    }
  }

  function handleCanvasTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    const gesture = touchGestureRef.current;
    const viewport = canvasViewportRef.current;
    if (!gesture || !viewport) {
      return;
    }

    event.preventDefault();

    if (gesture.mode === "pan" && event.touches.length === 1) {
      const touch = event.touches[0];
      viewport.scrollLeft = gesture.left - (touch.clientX - gesture.x);
      viewport.scrollTop = gesture.top - (touch.clientY - gesture.y);
      return;
    }

    if (event.touches.length >= 2 && gesture.distance > 0) {
      const rect = viewport.getBoundingClientRect();
      const center = getTouchCenter(event.touches);
      const pointerX = center.x - rect.left;
      const pointerY = center.y - rect.top;
      const nextZoom = clampZoom(gesture.zoom * (getTouchDistance(event.touches) / gesture.distance));

      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      viewport.scrollLeft = gesture.canvasX * nextZoom - pointerX;
      viewport.scrollTop = gesture.canvasY * nextZoom - pointerY;
    }
  }

  function handleCanvasTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const viewport = canvasViewportRef.current;
    if (!viewport || event.touches.length === 0) {
      touchGestureRef.current = null;
      return;
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchGestureRef.current = {
        mode: "pan",
        x: touch.clientX,
        y: touch.clientY,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
        distance: 0,
        zoom: zoomRef.current,
        canvasX: 0,
        canvasY: 0,
      };
    }
  }

  function handleModulePointerDown(event: React.PointerEvent<HTMLButtonElement>, target: ModuleDragTarget) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setModuleContextMenu(null);

    const position = getModulePosition(target);
    moduleDragRef.current = {
      target,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    };
    setDraggingModule(target);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleModulePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = moduleDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const deltaX = (event.clientX - drag.startX) / zoomRef.current;
    const deltaY = (event.clientY - drag.startY) / zoomRef.current;
    const nextPosition = {
      x: Math.max(120, Math.round(drag.originX + deltaX)),
      y: Math.max(120, Math.round(drag.originY + deltaY)),
    };

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      drag.moved = true;
    }

    if (drag.target.kind === "trigger") {
      setTriggerPosition(nextPosition);
      return;
    }

    if (drag.target.id) {
      updateStepCanvasPosition(drag.target.id, nextPosition);
    }
  }

  function handleModulePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = moduleDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!drag.moved) {
      if (drag.target.kind === "trigger") {
        setSelectedPanel("trigger");
        setSelectedStepId(null);
      } else if (drag.target.id) {
        setSelectedStepId(drag.target.id);
        setSelectedPanel("step");
      }
      setActiveInspectorTab("settings");
      openModuleSettingsPanel();
      setModuleMenuIndex(null);
    }

    moduleDragRef.current = null;
    setDraggingModule(null);
  }

  function handleModulePointerCancel() {
    moduleDragRef.current = null;
    setDraggingModule(null);
  }

  function handleModuleContextMenu(event: React.MouseEvent<HTMLButtonElement>, target: ModuleDragTarget) {
    event.preventDefault();
    event.stopPropagation();

    const modulePosition = getModulePosition(target);
    setModuleMenuIndex(null);
    setOpenRunBubbleKey(null);
    setModuleContextMenu({
      target,
      position: {
        x: modulePosition.x + 94,
        y: Math.max(40, modulePosition.y - 72),
      },
    });

    if (target.kind === "trigger") {
      setSelectedPanel("trigger");
      setSelectedStepId(null);
      setActiveInspectorTab("settings");
      return;
    }

    if (target.id) {
      setSelectedStepId(target.id);
      setSelectedPanel("step");
      setActiveInspectorTab("settings");
    }
  }

  function openModuleNotes(target: ModuleDragTarget) {
    setModuleContextMenu(null);
    if (target.kind === "trigger") {
      setSelectedPanel("trigger");
      setSelectedStepId(null);
      setActiveInspectorTab("settings");
      openModuleSettingsPanel();
      return;
    }

    if (target.id) {
      setSelectedStepId(target.id);
      setSelectedPanel("step");
      setActiveInspectorTab("settings");
      openModuleSettingsPanel();
    }
  }

  function renameModuleFromMenu(target: ModuleDragTarget) {
    setModuleContextMenu(null);
    if (target.kind === "trigger") {
      setSelectedPanel("trigger");
      setSelectedStepId(null);
    } else if (target.id) {
      setSelectedStepId(target.id);
      setSelectedPanel("step");
    }
    setActiveInspectorTab("settings");
    openModuleSettingsPanel();

    window.requestAnimationFrame(() => {
      moduleTitleInputRef.current?.focus();
      moduleTitleInputRef.current?.select();
    });
  }

  function deleteModuleFromMenu(target: ModuleDragTarget) {
    setModuleContextMenu(null);
    if (target.kind === "step" && target.id) {
      removeStep(target.id);
    }
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [data-canvas-control='true']")) {
      return;
    }

    setModuleContextMenu(null);

    const viewport = canvasViewportRef.current;
    if (!viewport) {
      return;
    }

    event.preventDefault();
    panStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
    setCanvasDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCanvasPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!canvasDragging || panStartRef.current.pointerId !== event.pointerId) {
      return;
    }

    const viewport = canvasViewportRef.current;
    if (!viewport) {
      return;
    }

    event.preventDefault();
    viewport.scrollLeft = panStartRef.current.left - (event.clientX - panStartRef.current.x);
    viewport.scrollTop = panStartRef.current.top - (event.clientY - panStartRef.current.y);
  }

  function stopCanvasDrag(event?: React.PointerEvent<HTMLDivElement>) {
    if (event && panStartRef.current.pointerId !== event.pointerId) {
      return;
    }

    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    panStartRef.current.pointerId = null;
    setCanvasDragging(false);
  }

  async function copyWebhookEndpoint() {
    if (!webhookEndpoint) {
      return;
    }

    await navigator.clipboard.writeText(webhookEndpoint);
    setCopiedEndpoint(true);
    window.setTimeout(() => setCopiedEndpoint(false), 1600);
  }

  function addTriggerModule(triggerType: string) {
    const nextTrigger = triggerTypes.find((trigger) => trigger.value === triggerType) || triggerTypes[0];

    setTriggerDraft((draft) => ({
      ...draft,
      triggerType: nextTrigger.value,
      eventName: draft.eventName || nextTrigger.eventName,
      source: draft.source || (nextTrigger.value === "mailhook" ? makeMailhookAddress(flowId) : nextTrigger.source),
      authMode: nextTrigger.value === "webhook" || nextTrigger.value === "api" ? "none" : "none",
      scheduleCron: nextTrigger.value === "schedule" ? draft.scheduleCron || "0 9 * * 1" : "",
      mailhookAddress: draft.mailhookAddress || makeMailhookAddress(flowId),
    }));
    setTriggerAdded(true);
    setSelectedStepId(null);
    setSelectedPanel("trigger");
    setActiveInspectorTab("settings");
    openModuleSettingsPanel();
    setModuleMenuIndex(null);
    setModuleContextMenu(null);
  }

  function addStep(type: string, insertAfterIndex?: number, options: { emailProvider?: "gmail" | "outlook"; emailAction?: string } = {}) {
    if (!triggerAdded) {
      setError("Add the first trigger module before adding follow-up steps.");
      return;
    }

    const stepType = getStepType(type);
    const sourcePosition = typeof insertAfterIndex === "number" && insertAfterIndex >= 0
      ? getStepCanvasPosition(steps[insertAfterIndex], insertAfterIndex)
      : triggerPosition;
    const nextPosition = {
      x: sourcePosition.x + moduleGap,
      y: sourcePosition.y,
    };
    const emailAction = stepType.type === "email" ? emailModuleActions.find((action) => action.value === (options.emailAction || "send")) : null;
    const nextStep: FlowStepDraft = {
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: stepType.type,
      name: emailAction?.label || stepType.name,
      position: steps.length + 1,
      branch_key: null,
      template_id: null,
      config: stepType.type === "email" ? {
        canvasPosition: nextPosition,
        emailProvider: options.emailProvider || "gmail",
        emailAction: options.emailAction || "send",
      } : stepType.type === "webhook" ? {
        canvasPosition: nextPosition,
        method: "POST",
        url: "",
        authType: "none",
        headers: "{\n  \"Content-Type\": \"application/json\"\n}",
        body: "{\n  \"email\": \"{{email}}\"\n}",
      } : {
        canvasPosition: nextPosition,
      },
    };

    setSteps((currentSteps) => {
      const nextSteps = [...currentSteps];
      const insertAt = typeof insertAfterIndex === "number" ? insertAfterIndex + 1 : nextSteps.length;
      nextSteps.splice(insertAt, 0, nextStep);
      return nextSteps.map((step, index) => ({ ...step, position: index + 1 }));
    });
    setSelectedStepId(nextStep.id);
    setSelectedPanel("step");
    setActiveInspectorTab("settings");
    openModuleSettingsPanel();
    setModuleMenuIndex(null);
    setModuleMenuState({ provider: null });
    setModuleContextMenu(null);
  }

  function addEmailStep(provider: "gmail" | "outlook", action: string, insertAfterIndex?: number) {
    addStep("email", insertAfterIndex, { emailProvider: provider, emailAction: action });
  }

  function renderEmailActionChoices(provider: "gmail" | "outlook", insertAfterIndex?: number, compact = false) {
    return (
      <div className={compact ? "max-h-72 space-y-3 overflow-auto pr-1" : "max-h-80 space-y-3 overflow-auto pr-1"} data-canvas-control="true" onWheel={(event) => event.stopPropagation()}>
        {["Email", "Draft", "Attachment", "Other"].map((category) => (
          <div key={category}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{category}</p>
            <div className="space-y-1">
              {emailModuleActions.filter((action) => action.category === category).map((action) => (
                <button
                  key={action.value}
                  className="flex w-full items-start gap-2 rounded-[7px] px-2 py-1.5 text-left transition hover:bg-white/10"
                  onClick={() => addEmailStep(provider, action.value, insertAfterIndex)}
                  type="button"
                >
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[6px] bg-fuchsia-400/15 text-fuchsia-200">
                    <action.icon size={13} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-slate-100">{action.label}</span>
                    {!compact && <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{action.description}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderAddModuleMenu(insertAfterIndex?: number, compact = false) {
    if (moduleMenuState.provider) {
      return (
        <div data-canvas-control="true">
          <button
            className="mb-2 inline-flex items-center gap-1.5 rounded-[7px] px-2 py-1 text-xs font-semibold text-slate-400 transition hover:bg-white/10 hover:text-white"
            onClick={() => setModuleMenuState({ provider: null })}
            type="button"
          >
            <ArrowLeft size={13} />
            {moduleMenuState.provider === "gmail" ? "Gmail" : "Outlook"}
          </button>
          {renderEmailActionChoices(moduleMenuState.provider, insertAfterIndex, compact)}
        </div>
      );
    }

    return (
      <div className={compact ? "grid grid-cols-2 gap-2" : "space-y-1"} data-canvas-control="true">
        {stepTypes.map((stepType) => {
          if (stepType.type === "email") {
            return (
              <div key={stepType.type} className={compact ? "col-span-2 rounded-[8px] border border-white/10 bg-white/[0.03] p-2" : ""}>
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Email</p>
                <div className={compact ? "grid grid-cols-2 gap-2" : "space-y-1"}>
                  {(["gmail", "outlook"] as const).map((provider) => (
                    <button
                      key={provider}
                      className={`${compact ? "inline-flex h-9 items-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] px-2" : "flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2"} text-left text-xs font-semibold text-slate-200 transition hover:bg-white/10`}
                      onClick={() => setModuleMenuState({ provider })}
                      type="button"
                    >
                      <Mail size={14} className="text-fuchsia-300" />
                      {provider === "gmail" ? "Gmail" : "Outlook"}
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <button key={stepType.type} className={`${compact ? "inline-flex h-9 items-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] px-2" : "flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2"} text-left text-xs font-semibold text-slate-200 transition hover:bg-white/10`} onClick={() => addStep(stepType.type, insertAfterIndex)} type="button">
              <stepType.icon size={14} className="text-fuchsia-300" />
              {stepType.label}
            </button>
          );
        })}
      </div>
    );
  }

  function updateSelectedStepName(name: string) {
    if (!selectedStep) {
      return;
    }

    setSteps((currentSteps) => currentSteps.map((step) => step.id === selectedStep.id ? { ...step, name } : step));
  }

  function updateSelectedStepConfig(key: string, value: Json) {
    if (!selectedStep) {
      return;
    }

    setSteps((currentSteps) => currentSteps.map((step) => {
      if (step.id !== selectedStep.id) {
        return step;
      }

      return {
        ...step,
        config: {
          ...getConfigRecord(step.config),
          [key]: value,
        },
      };
    }));
  }

  function updateSelectedStepHandlebarData(variable: string, value: string) {
    if (!selectedStep) {
      return;
    }

    setSteps((currentSteps) => currentSteps.map((step) => {
      if (step.id !== selectedStep.id) {
        return step;
      }

      return {
        ...step,
        config: {
          ...getConfigRecord(step.config),
          handlebarData: {
            ...getConfigStringRecord(step.config, "handlebarData"),
            [variable]: value,
          },
        },
      };
    }));
  }

  function removeSelectedStepHandlebarData(variable: string) {
    if (!selectedStep) {
      return;
    }

    setSteps((currentSteps) => currentSteps.map((step) => {
      if (step.id !== selectedStep.id) {
        return step;
      }

      const nextData = { ...getConfigStringRecord(step.config, "handlebarData") };
      delete nextData[variable];

      return {
        ...step,
        config: {
          ...getConfigRecord(step.config),
          handlebarData: nextData,
        },
      };
    }));
  }

  function renameSelectedStepHandlebarData(previousVariable: string, nextVariable: string) {
    if (!selectedStep) {
      return;
    }

    const trimmedVariable = nextVariable.trim();
    if (!trimmedVariable || trimmedVariable === previousVariable) {
      return;
    }

    setSteps((currentSteps) => currentSteps.map((step) => {
      if (step.id !== selectedStep.id) {
        return step;
      }

      const currentData = getConfigStringRecord(step.config, "handlebarData");
      const nextData = { ...currentData };
      nextData[trimmedVariable] = currentData[previousVariable] || "";
      delete nextData[previousVariable];

      return {
        ...step,
        config: {
          ...getConfigRecord(step.config),
          handlebarData: nextData,
        },
      };
    }));
  }

  function addSelectedStepHandlebarData() {
    if (!selectedStep) {
      return;
    }

    const currentData = getConfigStringRecord(selectedStep.config, "handlebarData");
    let index = 1;
    let nextKey = "custom_value";
    while (currentData[nextKey] !== undefined) {
      index += 1;
      nextKey = `custom_value_${index}`;
    }

    updateSelectedStepHandlebarData(nextKey, "");
  }

  function insertSelectedStepDataToken(variable: string, token: string) {
    updateSelectedStepHandlebarData(variable, token);
    setActiveDataPickerVariable(null);
  }

  function getDefaultVariableMapping(variable: string) {
    const normalised = variable.toLowerCase();
    const exactPath = triggerPayloadPaths.find((path) => path.toLowerCase() === normalised);
    if (exactPath) {
      return `{{trigger.${exactPath}}}`;
    }

    const loosePath = triggerPayloadPaths.find((path) => {
      const lowerPath = path.toLowerCase();
      return lowerPath.endsWith(`.${normalised}`) || lowerPath.includes(normalised) || normalised.includes(lowerPath);
    });
    if (loosePath) {
      return `{{trigger.${loosePath}}}`;
    }

    return makeDefaultHandlebarValue(variable);
  }

  function applyTemplateToSelectedStep(templateId: string) {
    if (!selectedStep) {
      return;
    }

    const template = templates.find((item) => item.id === templateId) || null;
    const fallbackSendingAccount = connectedAccounts.find((account) => account.status === "connected" && (account.provider === "gmail" || account.provider === "outlook")) || null;

    setSteps((currentSteps) => currentSteps.map((step) => {
      if (step.id !== selectedStep.id) {
        return step;
      }

      if (!template) {
        return {
          ...step,
          template_id: null,
          config: {
            ...getConfigRecord(step.config),
            templateName: "",
            subject: "",
          preheader: "",
          recipientEmail: "",
          fromName: "",
          fromEmail: "",
          sendingAccountId: fallbackSendingAccount?.id || "",
          sendingAccountProvider: fallbackSendingAccount?.provider || "resend",
            replyTo: "",
            variables: [],
          },
        };
      }

      return {
        ...step,
        name: step.name === "Send email" ? `Send ${template.name}` : step.name,
        template_id: template.id,
        config: {
          ...getConfigRecord(step.config),
          templateName: template.name,
          subject: template.subject,
          preheader: template.preheader || "",
          recipientEmail: getConfigString(step.config, "recipientEmail", "{{trigger.email}}"),
          fromName: template.from_name || "",
          fromEmail: template.from_email || "",
          sendingAccountId: getConfigString(step.config, "sendingAccountId", "") || fallbackSendingAccount?.id || "",
          sendingAccountProvider: getConfigString(step.config, "sendingAccountProvider", "") || fallbackSendingAccount?.provider || "resend",
          replyTo: template.reply_to || "",
          category: template.category,
          status: template.status,
          variables: template.variables,
          handlebarData: Object.fromEntries(template.variables.map((variable) => {
            const currentData = getConfigStringRecord(step.config, "handlebarData");
            return [variable, currentData[variable] ?? getDefaultVariableMapping(variable)];
          })),
        },
      };
    }));
  }

  async function getAccessToken() {
    const supabase = createSupabaseBrowserClient();
    const { data, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!data.session) {
      throw new Error("Sign in before running this trigger.");
    }

    return data.session.access_token;
  }

  async function getSignedInEmail() {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.user.email || null;
  }

  async function loadRunHistory(selectLatest = false) {
    if (!supabaseReady) {
      return;
    }

    setRunHistoryLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: runs, error: runsError } = await supabase
        .from("flow_runs")
        .select("*")
        .eq("flow_id", flowId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (runsError) {
        throw runsError;
      }

      const runIds = (runs || []).map((run) => run.id);
      const { data: events, error: eventsError } = runIds.length > 0
        ? await supabase
          .from("run_events")
          .select("*")
          .in("flow_run_id", runIds)
          .order("created_at", { ascending: false })
        : { data: [], error: null };

      if (eventsError) {
        throw eventsError;
      }

      const nextHistory = (runs || []).map((run) => ({
        ...run,
        events: (events || []).filter((event) => event.flow_run_id === run.id),
      }));

      setRunHistory(nextHistory);
      if (selectLatest && nextHistory[0]) {
        selectRunFromHistory(nextHistory[0], false);
      }
    } catch (historyError) {
      setLiveError(getErrorMessage(historyError, "Run history could not be loaded."));
    } finally {
      setRunHistoryLoading(false);
    }
  }

  function selectRunFromHistory(run: FlowRunWithEvents, openDetails = true) {
    setLiveRun(run);
    setLiveEvents(run.events);
    setRunHistoryView(openDetails ? "details" : runHistoryView);
    setRunLogExpanded(false);
    setOpenRunBubbleKey(null);
    setPayloadBounceKey((key) => key + 1);
    setVisibleRunBubbleKeys([
      "trigger",
      ...steps
        .filter((step) => run.events.some((event) => getConfigRecord(event.metadata).stepId === step.id))
        .map((step) => step.id),
    ]);
  }

  useEffect(() => {
    void loadRunHistory(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId, supabaseReady, steps.length]);

  function buildStepData(config: Json, context: Record<string, unknown>) {
    const handlebarData = getConfigStringRecord(config, "handlebarData");
    return Object.fromEntries(Object.entries(handlebarData).map(([key, value]) => [key, renderHandlebars(value, context)]));
  }

  async function sendSelectedEmailModuleTest() {
    if (!selectedStep || !selectedEmailTemplate) {
      setEmailModuleTestResult({ ok: false, error: "Choose an email template before sending a module test." });
      return;
    }

    setEmailModuleTestSending(true);
    setEmailModuleTestResult(null);

    try {
      const token = await getAccessToken();
      const triggerPayload = withSignedInTestEmail(liveRun?.payload || parseSamplePayload(triggerDraft.samplePayload), await getSignedInEmail());
      const triggerRecord = triggerPayload && typeof triggerPayload === "object" && !Array.isArray(triggerPayload)
        ? triggerPayload as Record<string, unknown>
        : {};
      const context = { trigger: triggerRecord };
      const handlebarData = buildStepData(selectedStep.config, context);
      const renderContext = {
        ...context,
        ...handlebarData,
      };
      const recipientExpression = getConfigString(selectedStep.config, "recipientEmail", "{{trigger.email}}");
      const to = renderHandlebars(recipientExpression, renderContext).trim();
      const response = await fetch("/api/templates/test-send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          subject: getConfigString(selectedStep.config, "subject", selectedEmailTemplate.subject),
          preheader: getConfigString(selectedStep.config, "preheader", selectedEmailTemplate.preheader || ""),
          fromName: selectedEmailTemplate.from_name,
          fromEmail: selectedEmailTemplate.from_email,
          html: selectedEmailTemplate.html || "",
          data: handlebarData,
          provider: (getConfigString(selectedStep.config, "sendingAccountProvider", "") || defaultConnectedSendingAccount?.provider || "resend") as DeliveryProvider,
          connectedAccountId: getConfigString(selectedStep.config, "sendingAccountId", "") || defaultConnectedSendingAccount?.id || null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as EmailModuleTestResult;

      setEmailModuleTestResult({
        ok: response.ok && Boolean(payload.ok),
        id: payload.id,
        error: payload.error || (!response.ok ? "The email provider rejected this module test." : undefined),
        attemptedEmail: payload.attemptedEmail,
      });
    } catch (testError) {
      setEmailModuleTestResult({ ok: false, error: getErrorMessage(testError, "The email module test could not be sent.") });
    } finally {
      setEmailModuleTestSending(false);
    }
  }

  const loadLatestTestRun = useCallback(async (options: { showPayloadCard?: boolean } = {}) => {
    if (!supabaseReady) {
      return null;
    }

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/flows/${flowId}/test-trigger`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json()) as { run?: FlowRun | null; events?: RunEvent[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Latest test run could not be loaded.");
      }

      setLiveRun(payload.run || null);
      setLiveEvents(payload.events || []);
      if (payload.run) {
        if (options.showPayloadCard !== false) {
          setRunHistoryView("details");
        }
        void loadRunHistory();
      }
      if (options.showPayloadCard !== false) {
        if (payload.run) {
          setVisibleRunBubbleKeys(["trigger"]);
          setModuleSettingsOpen(false);
          setOpenRunBubbleKey("trigger");
          setPayloadBounceKey((key) => key + 1);
          triggerModuleFlash("trigger");
        }
      }
      setLiveError(null);
      return payload;
    } catch (runError) {
      setLiveError(getErrorMessage(runError, "Latest test run could not be loaded."));
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId, supabaseReady]);

  const playRunAnimation = useCallback(async () => {
    setRunStage("playing");
    setVisibleRunBubbleKeys([]);
    setOpenRunBubbleKey(null);

    const totalModules = steps.length + 1;
    for (let index = 0; index < totalModules; index += 1) {
      setActiveRunIndex(index - 1);
      await wait(320);
      const moduleKey = index === 0 ? "trigger" : steps[index - 1]?.id;
      if (moduleKey) {
        triggerModuleFlash(moduleKey);
        setVisibleRunBubbleKeys((keys) => keys.includes(moduleKey) ? keys : [...keys, moduleKey]);
        setPayloadBounceKey((key) => key + 1);
      }
    }

    setActiveRunIndex(null);
    setRunStage("complete");
  }, [steps]);

  async function startListeningForTrigger() {
    setTestingTrigger(true);
    setLiveError(null);
    setRunStage("listening");
    setActiveRunIndex(null);
    setVisibleRunBubbleKeys([]);
    setOpenRunBubbleKey(null);

    try {
      const saved = await saveFlowSteps({ reload: false });
      if (!saved) {
        throw new Error("Save the flow before listening for data.");
      }

      const latest = await loadLatestTestRun({ showPayloadCard: false });
      listeningBaselineRunIdRef.current = latest?.run?.id || null;
      setListeningForTrigger(true);
      setRunStage("listening");
      setActiveRunIndex(-1);
    } catch (runError) {
      setRunStage("error");
      setListeningForTrigger(false);
      setLiveError(getErrorMessage(runError, "Listening could not be started."));
    } finally {
      setTestingTrigger(false);
    }
  }

  function stopListeningForTrigger() {
    setListeningForTrigger(false);
    setTestingTrigger(false);
    setRunStage("idle");
    setActiveRunIndex(null);
  }

  async function togglePublished() {
    if (!flow) {
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      const nextPublished = flow.status !== "running";
      if (nextPublished) {
        const saved = await saveFlowSteps({ reload: false });
        if (!saved) {
          throw new Error("Save the flow before publishing.");
        }
      }

      const supabase = createSupabaseBrowserClient();
      const { data: updatedFlow, error: publishError } = await supabase
        .from("flows")
        .update({
          status: nextPublished ? "running" : "draft",
          published_at: nextPublished ? new Date().toISOString() : null,
        })
        .eq("id", flowId)
        .select("*")
        .single();

      if (publishError) {
        throw publishError;
      }

      setFlow(updatedFlow);
    } catch (publishError) {
      setError(getErrorMessage(publishError, "Flow publish state could not be updated."));
    } finally {
      setPublishing(false);
    }
  }

  async function sendWebhookTestPayload() {
    setWebhookTestSending(true);
    setLiveError(null);
    setRunStage("saving");
    setActiveRunIndex(null);
    setVisibleRunBubbleKeys([]);
    setOpenRunBubbleKey(null);

    try {
      const saved = await saveFlowSteps({ reload: false });
      if (!saved) {
        throw new Error("Save the webhook trigger before sending test data.");
      }

      const samplePayload = withSignedInTestEmail(parseSamplePayload(triggerDraft.samplePayload), await getSignedInEmail());
      setRunStage("listening");
      setActiveRunIndex(-1);

      const response = await fetch(webhookEndpointPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...getConfigRecord(samplePayload),
          source: "Trigger Mail AI test sender",
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "The webhook endpoint rejected the test payload.");
      }

      await loadLatestTestRun({ showPayloadCard: true });
      await playRunAnimation();
    } catch (sendError) {
      setRunStage("error");
      setActiveRunIndex(null);
      setLiveError(getErrorMessage(sendError, "Webhook test payload could not be sent."));
    } finally {
      setWebhookTestSending(false);
    }
  }

  async function runTriggerTest() {
    setTestingTrigger(true);
    setLiveError(null);
    setRunStage("saving");
    setActiveRunIndex(null);
    setVisibleRunBubbleKeys([]);
    setOpenRunBubbleKey(null);

    try {
      const saved = await saveFlowSteps({ reload: false });
      if (!saved) {
        throw new Error("Save the flow before running the trigger.");
      }

      setRunStage("listening");
      setActiveRunIndex(-1);
      const token = await getAccessToken();
      const samplePayload = withSignedInTestEmail(parseSamplePayload(triggerDraft.samplePayload), await getSignedInEmail());
      const response = await fetch(`/api/flows/${flowId}/test-trigger`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: triggerDraft.triggerType === "mailhook"
            ? {
                provider: "manual-test",
                to: triggerDraft.mailhookAddress,
                from: "alex@example.com",
                subject: triggerDraft.eventName || "Test inbound email",
                text: "This is a test inbound email payload.",
                ...getConfigRecord(samplePayload),
              }
            : samplePayload,
        }),
      });
      const payload = (await response.json()) as { run?: FlowRun; events?: RunEvent[]; error?: string };

      if (!response.ok || !payload.run) {
        throw new Error(payload.error || "Trigger test could not be started.");
      }

      setLiveRun(payload.run);
      setLiveEvents(payload.events || []);
      setRunHistoryView("details");
      setPayloadBounceKey((key) => key + 1);
      void loadRunHistory();
      await playRunAnimation();
    } catch (runError) {
      setRunStage("error");
      setLiveError(getErrorMessage(runError, "Trigger test could not be started."));
    } finally {
      setTestingTrigger(false);
    }
  }

  useEffect(() => {
    if (!listeningForTrigger) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void (async () => {
        const latest = await loadLatestTestRun({ showPayloadCard: false });
        const latestRun = latest?.run || null;

        if (latestRun && latestRun.id !== listeningBaselineRunIdRef.current) {
          setListeningForTrigger(false);
          listeningBaselineRunIdRef.current = latestRun.id;
          setOpenRunBubbleKey(null);
          setPayloadBounceKey((key) => key + 1);
          await playRunAnimation();
        }
      })();
    }, 2000);

    return () => window.clearInterval(interval);
  }, [listeningForTrigger, loadLatestTestRun, playRunAnimation]);

  function removeStep(stepId: string) {
    const nextSteps = steps
      .filter((step) => step.id !== stepId)
      .map((step, index) => ({ ...step, position: index + 1 }));

    setSteps(nextSteps);
    setSelectedStepId(nextSteps[0]?.id || null);
    setSelectedPanel(nextSteps.length > 0 ? "step" : "trigger");
    setActiveInspectorTab("settings");
    setModuleSettingsOpen(false);
    setModuleContextMenu(null);
  }

  async function saveFlowSteps(options: { reload?: boolean } = {}) {
    setSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      let triggerId = triggerAdded ? flow?.trigger_id || null : null;

      if (!flow?.workspace_id) {
        throw new Error("This flow needs a workspace before the trigger can be saved.");
      }

      if (triggerAdded) {
        const samplePayload = parseSamplePayload(triggerDraft.samplePayload);
        const triggerPayload = {
          workspace_id: flow.workspace_id,
          name: triggerDraft.eventName.trim() || `${title} trigger`,
          type: triggerDraft.triggerType,
          endpoint_slug: makeEndpointSlug(flowId, triggerDraft.triggerType),
          event_name: triggerDraft.eventName.trim() || null,
          source: triggerDraft.source.trim() || null,
          auth_mode: triggerDraft.authMode,
          schedule_cron: triggerDraft.triggerType === "schedule" ? triggerDraft.scheduleCron.trim() || null : null,
          sample_payload: samplePayload,
          config: {
            flowId,
            builder: "visual",
            ...(triggerDraft.triggerType === "mailhook" ? { mailhookAddress: triggerDraft.mailhookAddress.trim() || makeMailhookAddress(flowId) } : {}),
          },
        };

        if (triggerId) {
          const { data: updatedTrigger, error: triggerError } = await supabase
            .from("triggers")
            .update(triggerPayload)
            .eq("id", triggerId)
            .select("id")
            .single();

          if (triggerError) {
            throw triggerError;
          }

          triggerId = updatedTrigger.id;
        } else {
          const { data: createdTrigger, error: triggerError } = await supabase
            .from("triggers")
            .insert(triggerPayload)
            .select("id")
            .single();

          if (triggerError) {
            throw triggerError;
          }

          triggerId = createdTrigger.id;
        }

        if (triggerId && triggerId !== flow?.trigger_id) {
          setFlow((currentFlow) => currentFlow ? { ...currentFlow, trigger_id: triggerId } : currentFlow);
        }

        if (triggerDraft.triggerType === "mailhook") {
          const address = triggerDraft.mailhookAddress.trim() || makeMailhookAddress(flowId);
          const { data: existingMailhook, error: lookupMailhookError } = await supabase
            .from("mailhooks")
            .select("id")
            .eq("workspace_id", flow.workspace_id)
            .eq("flow_id", flowId)
            .maybeSingle();

          if (lookupMailhookError) {
            throw lookupMailhookError;
          }

          const mailhookPayload = {
            workspace_id: flow.workspace_id,
            trigger_id: triggerId,
            flow_id: flowId,
            address,
            name: triggerDraft.eventName.trim() || `${title} mailhook`,
            status: "active",
          };

          if (existingMailhook) {
            const { error: updateMailhookError } = await supabase
              .from("mailhooks")
              .update(mailhookPayload)
              .eq("id", existingMailhook.id);

            if (updateMailhookError) {
              throw updateMailhookError;
            }
          } else {
            const { error: insertMailhookError } = await supabase
              .from("mailhooks")
              .insert(mailhookPayload);

            if (insertMailhookError) {
              throw insertMailhookError;
            }
          }
        }
      }

      const { error: flowUpdateError } = await supabase
        .from("flows")
        .update({
          trigger_id: triggerId,
          trigger_type: triggerAdded ? triggerDraft.triggerType : null,
          settings: {
            builder: "visual",
            isBlank: !triggerAdded,
            triggerCanvasPosition: triggerPosition,
            trigger: triggerAdded ? {
              eventName: triggerDraft.eventName,
              source: triggerDraft.source,
              authMode: triggerDraft.authMode,
              scheduleCron: triggerDraft.scheduleCron,
              mailhookAddress: triggerDraft.mailhookAddress,
              samplePayload: triggerDraft.samplePayload,
              notes: triggerDraft.notes,
            } : null,
          },
        })
        .eq("id", flowId);

      if (flowUpdateError) {
        throw flowUpdateError;
      }

      const { error: deleteError } = await supabase.from("flow_steps").delete().eq("flow_id", flowId);

      if (deleteError) {
        throw deleteError;
      }

      if (steps.length > 0) {
        const { error: insertError } = await supabase.from("flow_steps").insert(steps.map((step, index) => ({
          ...(isUuid(step.id) ? { id: step.id } : {}),
          flow_id: flowId,
          type: step.type,
          name: step.name,
          position: index + 1,
          branch_key: step.branch_key,
          template_id: step.template_id,
          config: step.config,
        })));

        if (insertError) {
          throw insertError;
        }
      }

      if (options.reload !== false) {
        await loadFlow();
      }
      return true;
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Flow steps could not be saved."));
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      eyebrow="Flow Builder"
      title={title}
      description={flow?.description || "Visual automation builder."}
      primaryActionHidden
      secondaryActionHidden
    >
      <section className="-mx-3 -mb-4 -mt-[14px] grid h-[calc(100vh-58px)] min-h-[620px] overflow-hidden bg-[#070b12] sm:-mx-4 lg:-ml-4 lg:-mr-4 xl:grid-cols-[1fr_340px]">
        <div className="relative min-h-0 bg-[radial-gradient(circle,rgba(148,163,184,0.13)_1px,transparent_1px)] [background-size:22px_22px]">
          <div className="absolute left-4 top-4 z-40 flex gap-2" data-canvas-control="true">
            <Link href="/flows" className="grid size-9 place-items-center rounded-[8px] border border-white/10 bg-white/[0.04] text-slate-300">
              <ArrowLeft size={16} />
            </Link>
            <button aria-label="Save flow" className="grid size-9 place-items-center rounded-[8px] border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} onClick={() => { void saveFlowSteps(); }} title="Save flow" type="button">
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            </button>
            <button
              aria-label={listeningForTrigger ? "Stop listening" : listensForExternalData ? "Play and listen for data" : "Run test"}
              className={`grid size-9 place-items-center rounded-[8px] border text-emerald-100 transition disabled:cursor-not-allowed disabled:opacity-60 ${listeningForTrigger ? "animate-pulse border-red-danger/40 bg-red-danger/20 text-red-100 hover:bg-red-danger/25" : "border-emerald-300/30 bg-emerald-400/10 hover:bg-emerald-400/15"}`}
              disabled={saving || (!listeningForTrigger && testingTrigger) || !triggerAdded}
              onClick={() => {
                if (listeningForTrigger) {
                  stopListeningForTrigger();
                  return;
                }
                void (listensForExternalData ? startListeningForTrigger() : runTriggerTest());
              }}
              title={listeningForTrigger ? "Stop listening" : listensForExternalData ? "Play and listen for data" : "Run test"}
              type="button"
            >
              {testingTrigger && !listeningForTrigger ? <Loader2 className="animate-spin" size={14} /> : listeningForTrigger ? <Square size={13} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            </button>
            <button
              aria-pressed={flow?.status === "running"}
              className={`inline-flex h-9 items-center gap-2.5 rounded-[8px] border px-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${flow?.status === "running" ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"}`}
              disabled={publishing || saving || !triggerAdded}
              onClick={() => { void togglePublished(); }}
              type="button"
            >
              <span className={`relative h-5 w-10 shrink-0 rounded-full transition ${flow?.status === "running" ? "bg-emerald-400" : "bg-slate-700"}`}>
                <span className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform ${flow?.status === "running" ? "translate-x-5" : "translate-x-0"}`} />
              </span>
              <span className="min-w-[58px] text-left">{publishing ? "Updating" : flow?.status === "running" ? "Published" : "Publish"}</span>
            </button>
          </div>

          {loading ? (
            <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="animate-spin" size={17} />
                Loading flow...
              </span>
            </div>
          ) : error ? (
            <div className="absolute left-1/2 top-1/2 w-[min(420px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-200">
              {error}
            </div>
          ) : (
            <div
              ref={canvasViewportRef}
              className={`scrollbar-none absolute inset-0 touch-none overflow-auto ${canvasDragging ? "cursor-grabbing" : "cursor-grab"}`}
              onPointerCancel={stopCanvasDrag}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={stopCanvasDrag}
              onTouchCancel={handleCanvasTouchEnd}
              onTouchEnd={handleCanvasTouchEnd}
              onTouchMove={handleCanvasTouchMove}
              onTouchStart={handleCanvasTouchStart}
            >
              <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-[9px] border border-white/10 bg-[#0D121C]/95 p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur" data-canvas-control="true">
                <button className="grid size-8 place-items-center rounded-[7px] text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={() => updateZoom(zoom - 0.08)} type="button">
                  <ZoomOut size={15} />
                </button>
                <span className="min-w-12 text-center text-xs font-semibold text-slate-300">{Math.round(zoom * 100)}%</span>
                <button className="grid size-8 place-items-center rounded-[7px] text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={() => updateZoom(zoom + 0.08)} type="button">
                  <ZoomIn size={15} />
                </button>
              </div>

              {runStage !== "idle" && (
                <div className={`absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur ${
                  runStage === "error"
                    ? "border-red-danger/30 bg-red-danger/15 text-red-100"
                    : runStage === "complete"
                      ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100"
                      : "border-fuchsia-300/30 bg-fuchsia-500/15 text-fuchsia-100"
                }`}>
                  {(runStage === "saving" || runStage === "listening" || runStage === "playing") && <Loader2 className="animate-spin" size={14} />}
                  {runStage === "saving" ? "Saving trigger..." : runStage === "listening" ? "Waiting for webhook data..." : runStage === "playing" ? "Payload received. Running scenario..." : runStage === "complete" ? "Scenario run complete" : "Run failed"}
                </div>
              )}

              <div
                className="relative"
                style={{
                  width: canvasScrollWidth * zoom,
                  height: canvasScrollHeight * zoom,
                }}
              >
                <div
                  className="absolute left-0 top-0 origin-top-left"
                  style={{
                    left: canvasWorkspacePadding * zoom,
                    top: canvasWorkspacePadding * zoom,
                    width: canvasWidth,
                    height: canvasHeight,
                    transform: `scale(${zoom})`,
                    transformOrigin: "0 0",
                  }}
                >
                {!triggerAdded ? (
                  <div className="absolute left-[240px] top-[190px] w-[420px] rounded-[16px] border border-dashed border-white/15 bg-[#0D121C]/92 p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
                    <div className="mx-auto grid size-16 place-items-center rounded-full border border-fuchsia-400/30 bg-violet-brand/20 text-fuchsia-300">
                      <Plus size={25} />
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-white">Add first module</h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">Choose what starts this flow. The module will land on the canvas.</p>
                    <div className="mt-5 grid gap-2">
                      {triggerTypes.slice(0, 4).map((trigger) => (
                        <button key={trigger.value} className="flex items-center gap-3 rounded-[9px] border border-white/10 bg-white/[0.04] p-3 text-left text-sm font-semibold text-white transition hover:border-fuchsia-400/50 hover:bg-white/[0.08]" onClick={() => addTriggerModule(trigger.value)} type="button">
                          <trigger.icon size={17} className="text-fuchsia-300" />
                          <span>
                            <span className="block">{trigger.label}</span>
                            <span className="mt-0.5 block text-xs font-normal text-slate-500">{trigger.description}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {[...steps, null].map((_, index) => {
                      const sourcePosition = index === 0 ? triggerPosition : getStepCanvasPosition(steps[index - 1], index - 1);
                      const sourceStep = index === 0 ? null : steps[index - 1];
                      const isTrailingEndConnector = index === steps.length && sourceStep?.type === "end";
                      const targetPosition = index < steps.length ? getStepCanvasPosition(steps[index], index) : { x: sourcePosition.x + 150, y: sourcePosition.y };
                      const lineStartX = sourcePosition.x + 76;
                      const lineStartY = sourcePosition.y;
                      const lineEndX = index < steps.length ? targetPosition.x - 76 : targetPosition.x;
                      const lineEndY = targetPosition.y;
                      const lineLength = Math.hypot(lineEndX - lineStartX, lineEndY - lineStartY);
                      const lineAngle = Math.atan2(lineEndY - lineStartY, lineEndX - lineStartX) * 180 / Math.PI;
                      const plusX = isTrailingEndConnector ? sourcePosition.x + 104 : lineStartX + (lineEndX - lineStartX) / 2;
                      const plusY = isTrailingEndConnector ? sourcePosition.y : lineStartY + (lineEndY - lineStartY) / 2;
                      const insertAfter = index - 1;
                      const connectorPlayed = runStage === "complete" || (activeRunIndex !== null && index <= activeRunIndex + 1);

                      return (
                        <div key={`connector-${index}`}>
                          {!isTrailingEndConnector && (
                            <div className={`absolute h-[3px] origin-left rounded-full transition-colors duration-300 ${connectorPlayed ? "bg-emerald-300/90 shadow-[0_0_18px_rgba(110,231,183,0.7)]" : "bg-white/35 shadow-[0_0_10px_rgba(148,163,184,0.16)]"}`} style={{ left: lineStartX, top: lineStartY - 1, width: lineLength, transform: `rotate(${lineAngle}deg)` }} />
                          )}
                          <button className="absolute z-10 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-[#111827] text-fuchsia-300 shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition hover:scale-105 hover:border-fuchsia-400/60 hover:bg-fuchsia-500/15" onClick={() => { setModuleMenuState({ provider: null }); setModuleMenuIndex(moduleMenuIndex === insertAfter ? null : insertAfter); }} style={{ left: plusX, top: plusY }} type="button">
                            <Plus size={17} />
                          </button>
                          {moduleMenuIndex === insertAfter && (
                            <div className="absolute z-30 w-72 -translate-x-1/2 rounded-[10px] border border-white/10 bg-[#0D121C] p-2 shadow-[0_20px_55px_rgba(0,0,0,0.48)]" data-canvas-control="true" onWheel={(event) => event.stopPropagation()} style={{ left: plusX, top: plusY + 28 }}>
                              {renderAddModuleMenu(insertAfter)}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {activeRunIndex !== null && (
                      <div
                        className="absolute z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-emerald-200/50 bg-emerald-400 px-3 py-1.5 text-xs font-bold text-emerald-950 shadow-[0_0_28px_rgba(110,231,183,0.75)] transition-all duration-300"
                        style={{
                          left: activeRunIndex === -1 ? triggerPosition.x : getStepCanvasPosition(steps[activeRunIndex], activeRunIndex).x,
                          top: (activeRunIndex === -1 ? triggerPosition.y : getStepCanvasPosition(steps[activeRunIndex], activeRunIndex).y) - 92,
                        }}
                      >
                        <span className="size-2 rounded-full bg-emerald-950" />
                        Bundle
                      </div>
                    )}

                    {runBubbles.map((bubble) => {
                      const isOpen = openRunBubbleKey === bubble.key;
                      return isOpen ? (
                        <div
                          key={`${bubble.key}-card-${payloadBounceKey}`}
                          className={`absolute z-[70] animate-[payloadBounceIn_420ms_cubic-bezier(0.18,0.89,0.32,1.28)] rounded-[10px] border border-emerald-300/25 bg-[#0D121C]/98 p-3 shadow-[0_22px_60px_rgba(0,0,0,0.48)] backdrop-blur ${expandedCanvasPopup === "data" ? "w-[680px]" : "w-[500px]"}`}
                          data-canvas-control="true"
                          style={{ left: bubble.position.x + 105, top: bubble.position.y - 150 }}
                        >
                          <span className="absolute -left-2 top-16 size-4 rotate-45 border-b border-l border-emerald-300/25 bg-[#0D121C]" />
                          <div className="relative mb-2 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200">{bubble.title}</p>
                              <p className="mt-1 text-xs text-slate-500">{bubble.subtitle} · {bubble.count} {bubble.count === 1 ? "record" : "records"}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                aria-label={expandedCanvasPopup === "data" ? "Shrink data popup" : "Expand data popup"}
                                className="grid size-7 place-items-center rounded-[7px] text-slate-400 transition hover:bg-white/10 hover:text-white"
                                onClick={() => setExpandedCanvasPopup(expandedCanvasPopup === "data" ? null : "data")}
                                type="button"
                              >
                                {expandedCanvasPopup === "data" ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                              </button>
                              <button
                                aria-label="Close data popup"
                                className="grid size-7 place-items-center rounded-[7px] text-slate-400 transition hover:bg-white/10 hover:text-white"
                                onClick={closeRunDataPanel}
                                type="button"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                          {renderDataInspector(bubble)}
                        </div>
                      ) : (
                        <button
                          key={`${bubble.key}-bubble`}
                          className="absolute z-40 flex -translate-x-1/2 -translate-y-1/2 animate-[payloadBubbleIn_320ms_cubic-bezier(0.18,0.89,0.32,1.28)] items-center gap-2 rounded-full border border-emerald-200/40 bg-emerald-400 px-3 py-2 text-xs font-black text-emerald-950 shadow-[0_0_28px_rgba(52,211,153,0.55)] transition hover:scale-105"
                          data-canvas-control="true"
                          onClick={() => {
                            openRunDataPanel(bubble.key);
                          }}
                          style={{ left: bubble.position.x + 116, top: bubble.position.y - 88 }}
                          type="button"
                        >
                          <span className="grid min-w-6 place-items-center rounded-full bg-emerald-950 px-1.5 py-0.5 text-[11px] text-emerald-100">{bubble.count}</span>
                          {bubble.key === "trigger" ? "Data received" : "Module data"}
                        </button>
                      );
                    })}

                    {moduleContextMenu && (
                      <div
                        className="absolute z-50 w-48 rounded-[10px] border border-white/10 bg-[#0D121C]/98 p-1.5 text-left shadow-[0_22px_60px_rgba(0,0,0,0.48)] backdrop-blur"
                        data-canvas-control="true"
                        style={{ left: moduleContextMenu.position.x, top: moduleContextMenu.position.y }}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 px-2 py-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Module actions</p>
                          <button className="grid size-6 place-items-center rounded-[6px] text-slate-400 transition hover:bg-white/10 hover:text-white" onClick={() => setModuleContextMenu(null)} type="button">
                            <X size={13} />
                          </button>
                        </div>
                        <button
                          className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
                          onClick={() => renameModuleFromMenu(moduleContextMenu.target)}
                          type="button"
                        >
                          <Pencil size={14} className="text-cyan-300" />
                          Rename module
                        </button>
                        <button
                          className="mt-1 flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
                          onClick={() => openModuleNotes(moduleContextMenu.target)}
                          type="button"
                        >
                          <StickyNote size={14} className="text-fuchsia-300" />
                          Create notes
                        </button>
                        {moduleContextMenu.target.kind === "step" && (
                          <button
                            className="mt-1 flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-danger/15"
                            onClick={() => deleteModuleFromMenu(moduleContextMenu.target)}
                            type="button"
                          >
                            <Trash2 size={14} />
                            Delete module
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      className={`group absolute z-20 flex size-36 -translate-x-1/2 -translate-y-1/2 touch-none flex-col items-center justify-center overflow-hidden rounded-full border text-center text-white shadow-[0_24px_70px_rgba(6,182,212,0.28)] transition hover:scale-[1.04] ${draggingModule?.kind === "trigger" ? "cursor-grabbing scale-[1.04]" : "cursor-grab"} ${runStage === "listening" && activeRunIndex === -1 ? "animate-[triggerListening_1.15s_ease-in-out_infinite] border-emerald-200 bg-[linear-gradient(145deg,#10b981,#0ea5e9)] ring-8 ring-emerald-400/25 shadow-[0_0_50px_rgba(52,211,153,0.5)]" : activeRunIndex === -1 ? "animate-pulse border-emerald-200 bg-[linear-gradient(145deg,#10b981,#0ea5e9)] ring-4 ring-emerald-400/25" : selectedPanel === "trigger" ? "border-cyan-100 bg-[linear-gradient(145deg,#06b6d4,#2563eb)] ring-4 ring-cyan-400/20" : "border-cyan-200/70 bg-[linear-gradient(145deg,#06b6d4,#2563eb)]"}`}
                      onContextMenu={(event) => handleModuleContextMenu(event, { kind: "trigger" })}
                      onPointerDown={(event) => handleModulePointerDown(event, { kind: "trigger" })}
                      onPointerMove={handleModulePointerMove}
                      onPointerCancel={handleModulePointerCancel}
                      onPointerUp={handleModulePointerUp}
                      style={{ left: triggerPosition.x, top: triggerPosition.y }}
                      type="button"
                    >
                      {moduleFlash?.key === "trigger" && (
                        <span key={`trigger-flash-${moduleFlash.nonce}`} className="pointer-events-none absolute inset-[-14px] z-10 grid place-items-center rounded-full bg-white/20 animate-[moduleThunderFlash_720ms_ease-out_forwards]">
                          <span className="absolute inset-0 rounded-full border-2 border-amber-200/80 animate-[moduleThunderRing_720ms_ease-out_forwards]" />
                          <Zap className="animate-[moduleThunderBolt_720ms_cubic-bezier(0.18,0.89,0.32,1.28)_forwards] fill-amber-200 text-amber-200 drop-shadow-[0_0_18px_rgba(251,191,36,0.95)]" size={52} />
                        </span>
                      )}
                      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.34),transparent_34%)]" />
                      <span className="relative grid size-12 animate-[moduleIconFloat_2.8s_ease-in-out_infinite] place-items-center rounded-full bg-white/20 text-white ring-1 ring-white/25 transition group-hover:animate-[moduleIconPop_700ms_ease-in-out_infinite]">
                        <Users size={22} />
                      </span>
                      <span className="relative mt-2 text-[11px] font-black uppercase tracking-[0.1em] text-white/80">Trigger</span>
                      <span className="relative mt-1 max-w-[106px] truncate text-sm font-black text-white">{triggerDraft.eventName || formatStatus(triggerDraft.triggerType)}</span>
                    </button>

                    {steps.map((step, index) => {
                      const stepType = getStepType(step.type);
                      const moduleRunning = activeRunIndex === index;
                      const stepPosition = getStepCanvasPosition(step, index);
                      return (
                        <button
                          key={step.id}
                          className={`group absolute z-20 flex size-36 -translate-x-1/2 -translate-y-1/2 touch-none flex-col items-center justify-center overflow-hidden rounded-full border text-center transition hover:scale-[1.04] ${stepType.bg} ${stepType.glow} ${draggingModule?.kind === "step" && draggingModule.id === step.id ? "cursor-grabbing scale-[1.04]" : "cursor-grab"} ${moduleRunning ? "animate-pulse border-emerald-100 text-white ring-4 ring-emerald-400/30" : selectedStepId === step.id && selectedPanel === "step" ? "border-white text-white ring-4 ring-white/20" : stepType.accent}`}
                          onContextMenu={(event) => handleModuleContextMenu(event, { kind: "step", id: step.id })}
                          onPointerDown={(event) => handleModulePointerDown(event, { kind: "step", id: step.id })}
                          onPointerMove={handleModulePointerMove}
                          onPointerCancel={handleModulePointerCancel}
                          onPointerUp={handleModulePointerUp}
                          style={{ left: stepPosition.x, top: stepPosition.y }}
                          type="button"
                        >
                          {moduleFlash?.key === step.id && (
                            <span key={`${step.id}-flash-${moduleFlash.nonce}`} className="pointer-events-none absolute inset-[-14px] z-10 grid place-items-center rounded-full bg-white/20 animate-[moduleThunderFlash_720ms_ease-out_forwards]">
                              <span className="absolute inset-0 rounded-full border-2 border-amber-200/80 animate-[moduleThunderRing_720ms_ease-out_forwards]" />
                              <Zap className="animate-[moduleThunderBolt_720ms_cubic-bezier(0.18,0.89,0.32,1.28)_forwards] fill-amber-200 text-amber-200 drop-shadow-[0_0_18px_rgba(251,191,36,0.95)]" size={52} />
                            </span>
                          )}
                          <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.34),transparent_34%)]" />
                          <span className={`relative grid size-12 place-items-center rounded-full ${stepType.iconBg} animate-[moduleIconFloat_2.8s_ease-in-out_infinite] ring-1 ring-white/25 transition group-hover:animate-[moduleIconPop_700ms_ease-in-out_infinite]`}>
                            <stepType.icon size={22} />
                          </span>
                          <span className="relative mt-2 text-[11px] font-black uppercase tracking-[0.1em] text-white/78">{stepType.label}</span>
                          <span className="relative mt-1 max-w-[108px] truncate text-sm font-black text-white">{step.name}</span>
                        </button>
                      );
                    })}

                    {steps.length === 0 && (
                      <div className="absolute rounded-[10px] border border-white/10 bg-[#0D121C]/92 px-4 py-3 text-sm text-slate-400 shadow-[0_18px_44px_rgba(0,0,0,0.32)]" style={{ left: triggerX + 180, top: moduleY + 56 }}>
                        Use the plus button to add the next module.
                      </div>
                    )}

                    {moduleSettingsOpen && selectedModulePosition && (
                      <div
                        className={`absolute z-[60] rounded-[12px] border border-white/10 bg-[#0D121C]/96 p-3 text-sm shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur ${expandedCanvasPopup === "settings" ? "w-[620px]" : "w-[460px]"}`}
                        data-canvas-control="true"
                        style={{
                          left: selectedModulePosition.x + (92 / zoom),
                          top: Math.max(20 / zoom, selectedModulePosition.y - (118 / zoom)),
                          transform: `scale(${1 / zoom})`,
                          transformOrigin: "top left",
                        }}
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-fuchsia-200">Module settings</p>
                            <h3 className="mt-1 truncate text-sm font-semibold text-white">
                              {selectedPanel === "trigger" ? (triggerDraft.eventName || "Trigger") : selectedStep?.name || "Module"}
                            </h3>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              aria-label={expandedCanvasPopup === "settings" ? "Shrink module settings" : "Expand module settings"}
                              className="grid size-7 place-items-center rounded-[7px] text-slate-400 transition hover:bg-white/10 hover:text-white"
                              onClick={() => setExpandedCanvasPopup(expandedCanvasPopup === "settings" ? null : "settings")}
                              type="button"
                            >
                              {expandedCanvasPopup === "settings" ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </button>
                            <button
                              aria-label="Close module settings"
                              className="grid size-7 place-items-center rounded-[7px] text-slate-400 transition hover:bg-white/10 hover:text-white"
                              onClick={closeModuleSettingsPanel}
                              type="button"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>

                        {selectedPanel === "trigger" ? (
                          <div className="space-y-2">
                            <label className="block">
                              <span className="text-xs font-semibold text-slate-400">Trigger type</span>
                              <select className="mt-1 h-9 w-full rounded-[8px] border border-white/10 bg-[#111827] px-2 text-sm text-white outline-none" value={triggerDraft.triggerType} onChange={(event) => setTriggerDraft((draft) => ({ ...draft, triggerType: event.target.value }))}>
                                {triggerTypes.map((trigger) => (
                                  <option key={trigger.value} value={trigger.value}>{trigger.label}</option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="text-xs font-semibold text-slate-400">Event name</span>
                              <input className="mt-1 h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] px-2 text-sm text-white outline-none" value={triggerDraft.eventName} onChange={(event) => setTriggerDraft((draft) => ({ ...draft, eventName: event.target.value }))} />
                            </label>
                            {(triggerDraft.triggerType === "webhook" || triggerDraft.triggerType === "api") && (
                              <div className="rounded-[8px] border border-fuchsia-300/20 bg-fuchsia-400/10 p-2 text-xs leading-5 text-fuchsia-50">
                                <span className="font-semibold">Webhook:</span> <code className="break-all">{webhookEndpoint || webhookEndpointPath}</code>
                              </div>
                            )}
                            <label className="block">
                              <span className="text-xs font-semibold text-slate-400">Sample payload</span>
                              <textarea className="mt-1 min-h-[92px] w-full resize-y rounded-[8px] border border-white/10 bg-[#070b12] px-2 py-2 font-mono text-xs leading-5 text-slate-100 outline-none" value={triggerDraft.samplePayload} onChange={(event) => setTriggerDraft((draft) => ({ ...draft, samplePayload: event.target.value }))} />
                            </label>
                          </div>
                        ) : selectedStep ? (
                          <div className="space-y-2">
                            <label className="block">
                              <span className="text-xs font-semibold text-slate-400">Module name</span>
                              <input className="mt-1 h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] px-2 text-sm text-white outline-none" value={selectedStep.name} onChange={(event) => updateSelectedStepName(event.target.value)} />
                            </label>
                            {selectedStep.type === "email" && (
                              <>
                                <label className="block">
                                  <span className="text-xs font-semibold text-slate-400">Email template</span>
                                  <select className="mt-1 h-9 w-full rounded-[8px] border border-white/10 bg-[#111827] px-2 text-sm text-white outline-none" value={selectedStep.template_id || ""} onChange={(event) => applyTemplateToSelectedStep(event.target.value)}>
                                    <option value="">Choose template...</option>
                                    {templates.map((template) => (
                                      <option key={template.id} value={template.id}>{template.name}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="text-xs font-semibold text-slate-400">Send to</span>
                                  <input className="mt-1 h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] px-2 text-sm text-white outline-none" value={getConfigString(selectedStep.config, "recipientEmail", "{{trigger.email}}")} onChange={(event) => updateSelectedStepConfig("recipientEmail", event.target.value)} />
                                </label>
                                {selectedEmailTemplate && (
                                  <div className="max-h-48 space-y-2 overflow-auto rounded-[8px] border border-emerald-300/15 bg-emerald-400/10 p-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200">Data mapping</p>
                                    {selectedEmailTemplate.variables.map((variable) => {
                                      const data = getConfigStringRecord(selectedStep.config, "handlebarData");
                                      const currentValue = data[variable] ?? "";
                                      const selectedTriggerPath = currentValue.match(/^\{\{\s*trigger\.([\w.]+)\s*\}\}$/)?.[1] || "";
                                      return (
                                        <label key={variable} className="block">
                                          <span className="font-mono text-xs text-emerald-100">{`{{${variable}}}`}</span>
                                          <select
                                            className="mt-1 h-8 w-full rounded-[7px] border border-white/10 bg-[#111827] px-2 text-xs text-white outline-none"
                                            value={selectedTriggerPath || (currentValue ? "__custom" : "")}
                                            onChange={(event) => updateSelectedStepHandlebarData(variable, event.target.value === "__custom" ? currentValue : event.target.value ? `{{trigger.${event.target.value}}}` : "")}
                                          >
                                            <option value="">Choose webhook field...</option>
                                            {triggerPayloadPaths.map((path) => (
                                              <option key={path} value={path}>{path}</option>
                                            ))}
                                            <option value="__custom">Manual</option>
                                          </select>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            )}
                            {selectedStep.type === "wait" && (
                              <div className="grid grid-cols-[1fr_120px] gap-2">
                                <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-2 text-sm text-white outline-none" min="1" type="number" value={getConfigString(selectedStep.config, "duration", "1")} onChange={(event) => updateSelectedStepConfig("duration", event.target.value)} />
                                <select className="h-9 rounded-[8px] border border-white/10 bg-[#111827] px-2 text-sm text-white outline-none" value={getConfigString(selectedStep.config, "unit", "days")} onChange={(event) => updateSelectedStepConfig("unit", event.target.value)}>
                                  <option value="minutes">Minutes</option>
                                  <option value="hours">Hours</option>
                                  <option value="days">Days</option>
                                </select>
                              </div>
                            )}
                            <label className="block">
                              <span className="text-xs font-semibold text-slate-400">Notes</span>
                              <textarea className="mt-1 min-h-[64px] w-full resize-y rounded-[8px] border border-white/10 bg-[#070b12] px-2 py-2 text-sm leading-5 text-slate-100 outline-none" value={getConfigString(selectedStep.config, "notes")} onChange={(event) => updateSelectedStepConfig("notes", event.target.value)} />
                            </label>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </>
                )}
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="flex min-h-0 flex-col border-t border-white/10 bg-[#0D121C] xl:border-l xl:border-t-0">
          <div className="border-b border-white/10 p-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-fuchsia-300">Flow AI</p>
                <h2 className="mt-1 text-base font-semibold text-white">{runHistoryView === "details" ? "Run details" : "Run conversation"}</h2>
              </div>
              {runHistoryView === "details" && (
                <button
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-[7px] border border-white/10 px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                  onClick={() => setRunHistoryView("list")}
                  type="button"
                >
                  <ArrowLeft size={13} />
                  History
                </button>
              )}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">Use this space to reason about webhook data, module results, and what should happen next.</p>
          </div>

          <div className={`min-h-0 flex-1 overflow-y-auto ${runHistoryView === "list" ? "space-y-4 bg-[#0B111B] px-3 py-4 text-slate-300" : "space-y-3 px-4 py-4"}`}>
            {runHistoryView === "list" ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-fuchsia-200">History</p>
                  <button
                    aria-label="Refresh history"
                    className="grid size-8 place-items-center rounded-[7px] text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={runHistoryLoading}
                    onClick={() => { void loadRunHistory(); }}
                    type="button"
                  >
                    {runHistoryLoading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                  </button>
                </div>

                <div className="flex items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-slate-400">
                  <Pencil size={13} className="text-cyan-300" />
                  <span className="truncate">{flow?.updated_at ? `Flow was edited ${formatDate(flow.updated_at)}` : "Flow changes will appear here."}</span>
                </div>

                <div className="space-y-6">
                  {runHistory.length > 0 ? runHistory.map((run) => {
                    const statusLabel = run.status === "completed" ? "Success" : run.status === "failed" ? "Failed" : formatStatus(run.status);
                    const statusClass = run.status === "completed"
                      ? "bg-emerald-400/15 text-emerald-200"
                      : run.status === "failed"
                        ? "bg-red-danger/15 text-red-100"
                        : "bg-fuchsia-400/15 text-fuchsia-100";
                    return (
                      <button
                        key={run.id}
                        className="group -mx-1 w-[calc(100%+8px)] rounded-[8px] px-1 py-0.5 text-left transition hover:bg-white/[0.06]"
                        onClick={() => selectRunFromHistory(run)}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 truncate text-sm font-semibold text-white">{formatHistoryDate(run.started_at || run.created_at)}</p>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass}`}>{statusLabel}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5 text-slate-400">
                          <span className="inline-flex items-center gap-1"><Zap size={11} /> {formatStatus(triggerDraft.triggerType)}</span>
                          <span className="inline-flex items-center gap-1"><Clock size={11} /> {formatDuration(run.started_at, run.completed_at)}</span>
                          <span className="inline-flex items-center gap-1"><Settings size={11} /> {run.events.length} operations</span>
                          <span className="inline-flex items-center gap-1"><Eye size={11} /> {run.events.length} credits</span>
                        </div>
                        <div className="mt-1 text-[11px] leading-5 text-slate-400">
                          <span className="inline-flex items-center gap-1"><HardDrive size={11} /> {formatDataSize(run.payload)}</span>
                        </div>
                      </button>
                    );
                  }) : (
                    <div className="rounded-[10px] border border-dashed border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-500">
                      No runs yet. Run a test or send data to the webhook, then refresh this list.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3 rounded-[10px] border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{liveRun ? formatDateTime(liveRun.started_at || liveRun.created_at) : "No run selected"}</p>
                      <h3 className="mt-1 truncate text-sm font-semibold text-white">{selectedRunLabel}</h3>
                    </div>
                    <button className="inline-flex shrink-0 items-center gap-2 rounded-[7px] border border-white/10 px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10" onClick={() => setRunHistoryView("list")} type="button">
                      <ArrowLeft size={13} />
                      Back
                    </button>
                  </div>

                  {liveRun ? (
                    <dl className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-1.5 text-xs leading-5">
                      <dt className="font-semibold text-slate-400">Run ID:</dt>
                      <dd className="truncate font-mono text-slate-200">{liveRun.id}</dd>
                      <dt className="font-semibold text-slate-400">Run name:</dt>
                      <dd className="text-slate-200">{selectedRunLabel}</dd>
                      <dt className="font-semibold text-slate-400">Trigger:</dt>
                      <dd className="text-slate-200">{formatStatus(triggerDraft.triggerType)}</dd>
                      <dt className="font-semibold text-slate-400">Duration:</dt>
                      <dd className="text-slate-200">{formatDuration(liveRun.started_at, liveRun.completed_at)}</dd>
                      <dt className="font-semibold text-slate-400">Operations:</dt>
                      <dd className="text-slate-200">{orderedLiveEvents.length}</dd>
                      <dt className="font-semibold text-slate-400">Credits:</dt>
                      <dd className="text-slate-200">{orderedLiveEvents.length}</dd>
                      <dt className="font-semibold text-slate-400">Data size:</dt>
                      <dd className="text-slate-200">{formatDataSize(liveRun.payload)}</dd>
                      <dt className="font-semibold text-slate-400">Source run:</dt>
                      <dd className="text-slate-200">-</dd>
                    </dl>
                  ) : (
                    <p className="rounded-[8px] border border-dashed border-white/10 p-3 text-xs leading-5 text-slate-500">Select a run to inspect its operation breakdown.</p>
                  )}
                </div>

                <div className="flex items-center gap-2 border-y border-white/10 py-2">
                  <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-[11px] font-semibold text-cyan-100">Timeline</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-slate-400">Raw events</span>
                </div>

                <div className="space-y-2.5">
                  {visibleRunEvents.length > 0 ? visibleRunEvents.map((event, index) => {
                    const status = getRunEventStatus(event);
                    return (
                      <article key={event.id} className="rounded-[10px] border border-white/10 bg-white/[0.035] p-3">
                        <div className="flex items-start gap-2">
                          {status === "completed" ? (
                            <CheckCircle2 className="mt-0.5 text-emerald-400" size={15} />
                          ) : (
                            <CircleSlash className={`mt-0.5 ${status === "failed" ? "text-red-300" : "text-red-danger"}`} size={15} />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className={`max-w-[180px] truncate rounded-full px-2 py-0.5 text-[11px] font-bold ${getRunEventAccent(event)}`}>{getRunEventModuleName(event)}</span>
                              <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-1.5 text-[10px] text-slate-400">#{getRunEventOperation(event, index)}</span>
                              <span className="ml-auto shrink-0 text-[11px] text-slate-500">0.{index + 2}s</span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-slate-400">{getRunEventLogMessage(event)}</p>
                          </div>
                        </div>
                      </article>
                    );
                  }) : (
                    <div className="rounded-[10px] border border-dashed border-white/10 p-4 text-sm leading-6 text-slate-500">
                      Module results will appear here after a run.
                    </div>
                  )}
                </div>

                {orderedLiveEvents.length > visibleRunEvents.length && (
                  <div className="flex justify-center pt-2">
                    <button className="rounded-[7px] border border-violet-400 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-400/10" onClick={() => setRunLogExpanded(true)} type="button">
                      Show all
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </section>
      <style jsx global>{`
        @keyframes triggerListening {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42), 0 0 0 0 rgba(52, 211, 153, 0.42);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.08);
            box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42), 0 0 0 18px rgba(52, 211, 153, 0);
          }
        }

        @keyframes moduleThunderFlash {
          0% {
            opacity: 0;
            transform: scale(0.78) rotate(-8deg);
            filter: brightness(1);
          }
          18% {
            opacity: 1;
            transform: scale(1.05) rotate(4deg);
            filter: brightness(1.9);
          }
          38% {
            opacity: 0.92;
            transform: scale(1.16) rotate(-2deg);
            filter: brightness(1.45);
          }
          100% {
            opacity: 0;
            transform: scale(1.42) rotate(0deg);
            filter: brightness(1);
          }
        }

        @keyframes moduleThunderRing {
          0% {
            opacity: 0;
            transform: scale(0.55);
          }
          22% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(1.55);
          }
        }

        @keyframes moduleThunderBolt {
          0% {
            opacity: 0;
            transform: scale(0.35) rotate(-18deg);
          }
          18% {
            opacity: 1;
            transform: scale(1.18) rotate(7deg);
          }
          42% {
            opacity: 1;
            transform: scale(0.96) rotate(-4deg);
          }
          100% {
            opacity: 0;
            transform: scale(0.72) rotate(10deg);
          }
        }

        @keyframes payloadBounceIn {
          0% {
            opacity: 0;
            transform: translateX(-16px) scale(0.88);
          }
          62% {
            opacity: 1;
            transform: translateX(8px) scale(1.04);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @keyframes payloadBubbleIn {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.7);
          }
          70% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.08);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes moduleIconFloat {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-3px) rotate(-2deg);
          }
        }

        @keyframes moduleIconPop {
          0%, 100% {
            transform: translateY(0) scale(1) rotate(0deg);
          }
          50% {
            transform: translateY(-4px) scale(1.08) rotate(3deg);
          }
        }
      `}</style>
    </AppShell>
  );
}
