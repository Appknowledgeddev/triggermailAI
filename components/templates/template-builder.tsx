"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type CSSProperties, type ClipboardEvent, type DragEvent, type FormEvent, type MouseEvent, type UIEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Award,
  Bell,
  Bold,
  Bot,
  Braces,
  BriefcaseBusiness,
  Building2,
  Calendar,
  Camera,
  ChartNoAxesColumn,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Cloud,
  Code2,
  Columns3,
  Copy,
  CreditCard,
  Database as DatabaseIcon,
  Download,
  Eye,
  FileCheck2,
  FileJson,
  FileText,
  Film,
  Flag,
  Gift,
  Globe2,
  GripVertical,
  Headphones,
  Heart,
  ImageIcon,
  Info,
  Italic,
  KeyRound,
  Laptop,
  LayoutTemplate,
  Link2,
  List,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Minus,
  MousePointerClick,
  Package,
  Palette,
  Pencil,
  Plus,
  Rocket,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Smartphone,
  Star,
  Table2,
  Tag,
  Target,
  ThumbsUp,
  Trash2,
  Trophy,
  Truck,
  Type,
  Redo2,
  Underline,
  Undo2,
  UploadCloud,
  UserPlus,
  Users,
  Wrench,
  Zap,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buildSendableTemplateHtml } from "@/lib/email/template-html";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type EmailTemplate = Database["public"]["Tables"]["email_templates"]["Row"];
type EmailTemplateVersion = Database["public"]["Tables"]["email_template_versions"]["Row"];
type ViewMode = "desktop" | "mobile";
type PreviewMode = "builder" | "inbox";
type InspectorMode = "build" | "templates" | "content" | "blocks" | "assets" | "ai" | "styles" | "advanced" | "settings";
type CodeSheet = "emailBody" | "outsideBody" | "documentHead";
type DropTarget = "code" | "preview" | `slot-${number}` | null;
type EmailSection = {
  id: string;
  label: string;
  html: string;
};
type SectionCategory = {
  id: string;
  label: string;
  description: string;
  icon: typeof LayoutTemplate;
  examples: string[];
};
type SpacingSides = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};
const heroPatternWhiteFade = "linear-gradient(180deg,rgba(255,255,255,0) 48%,rgba(255,255,255,0.72) 78%,#ffffff 100%),radial-gradient(ellipse at 18% 105%,#ffffff 0 19%,rgba(255,255,255,0) 20%),radial-gradient(ellipse at 58% 112%,#ffffff 0 24%,rgba(255,255,255,0) 25%),radial-gradient(ellipse at 92% 104%,#ffffff 0 17%,rgba(255,255,255,0) 18%)";
const footerPatternWhiteFade = "linear-gradient(0deg,rgba(255,255,255,0) 46%,rgba(255,255,255,0.74) 78%,#ffffff 100%),radial-gradient(ellipse at 16% -6%,#ffffff 0 18%,rgba(255,255,255,0) 19%),radial-gradient(ellipse at 54% -10%,#ffffff 0 24%,rgba(255,255,255,0) 25%),radial-gradient(ellipse at 90% -4%,#ffffff 0 16%,rgba(255,255,255,0) 17%)";
type AiMessage = {
  role: "assistant" | "user";
  content: string;
};
type GeneratedAiAsset = TemplateAsset & {
  key: string;
  prompt: string;
  alt: string;
};

type AiTemplateResponse = {
  action?: "reply" | "update";
  mode?: "ai" | "demo";
  reply?: string;
  name?: string;
  subject?: string;
  preheader?: string;
  html?: string;
  attachmentNotes?: string;
  generatedAssets?: GeneratedAiAsset[];
  error?: string;
};
type AiChatAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  text?: string;
};
type AiAssetReference = {
  id: string;
  name: string;
  kind: "asset" | "attachment";
  label: string;
  detail: string;
  previewUrl?: string;
  promptToken: string;
};
type TemplateAsset = {
  name: string;
  path: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
};
type BuilderSnapshot = {
  html: string;
  sections: EmailSection[];
  globalBackground: string;
  globalBackgroundPattern: string;
  globalBackgroundCanvas: string;
  previewPadding: number;
  emailWidth: number;
  emailBorderRadius: number;
  emailBoxShadow: string;
  bodyTextInsetLeft: number;
  bodyTextInsetRight: number;
  bodyContentMargin: number;
  bodyTextSize: number;
  bodyTextColor: string;
  customHead: string;
};

const initialAiMessages: AiMessage[] = [
  {
    role: "assistant",
    content: "I’m your section assistant. Select a section in the preview, then ask me to rewrite, restyle, expand, or use an attached reference for that section.",
  },
];

const layoutBlockTransferType = "application/x-trigger-mail-ai-layout-block";
const snippetTransferType = "application/x-trigger-mail-ai-snippet";
const visualWrapperPattern = /^<div data-builder-visual="section" style="([^"]*)">([\s\S]*)<\/div>$/;
const shellHeaderMarker = 'data-builder-shell="header"';
const shellFooterMarker = 'data-builder-shell="footer"';
const emptyBodyMarker = 'data-builder-empty-body="true"';
const defaultEmailBoxShadow = "0 24px 70px rgba(15, 23, 42, 0.28)";
const emailShadowPresets = [
  { label: "None", value: "none" },
  { label: "Soft", value: "0 16px 40px rgba(15, 23, 42, 0.14)" },
  { label: "Medium", value: defaultEmailBoxShadow },
  { label: "Strong", value: "0 34px 90px rgba(15, 23, 42, 0.36)" },
] as const;
const backgroundCanvasPresets = [
  { label: "Plain", value: "plain" },
  { label: "Paper", value: "paper" },
  { label: "Studio", value: "studio" },
  { label: "Blueprint", value: "blueprint" },
  { label: "Mist", value: "mist" },
  { label: "Aurora", value: "aurora" },
  { label: "Linen", value: "linen" },
] as const;
const backgroundPatternPresets = [
  { label: "None", value: "none" },
  { label: "Dots", value: "dots" },
  { label: "Grid", value: "grid" },
  { label: "Diagonal", value: "diagonal" },
  { label: "Cross", value: "cross" },
  { label: "Glow", value: "glow" },
  { label: "Waves", value: "waves" },
  { label: "Checker", value: "checker" },
  { label: "Rings", value: "rings" },
  { label: "Plus", value: "plus" },
] as const;
const sidebarMinWidth = 400;
const sidebarMaxWidth = 720;
const blockResizeHandle = `<span data-builder-resize-handle="both" style="position:absolute;right:-7px;bottom:-7px;width:14px;height:14px;border-radius:999px;background:#d946ef;border:2px solid #ffffff;box-shadow:0 4px 12px rgba(15,23,42,0.28);cursor:nwse-resize;z-index:5;"></span>`;
const blockWidthResizeHandle = `<span data-builder-resize-handle="horizontal" style="position:absolute;right:-7px;top:50%;width:14px;height:28px;border-radius:999px;background:#d946ef;border:2px solid #ffffff;box-shadow:0 4px 12px rgba(15,23,42,0.28);cursor:ew-resize;z-index:5;transform:translateY(-50%);"></span>`;
const blockVerticalResizeHandle = `<span data-builder-resize-handle="vertical" style="position:absolute;left:50%;bottom:-7px;width:28px;height:12px;border-radius:999px;background:#d946ef;border:2px solid #ffffff;box-shadow:0 4px 12px rgba(15,23,42,0.28);cursor:ns-resize;z-index:5;transform:translateX(-50%);"></span>`;

function buildResizableImageHtml(imageHtml: string, width = 560) {
  return `
<div data-builder-block="image" style="resize:horizontal;overflow:visible;width:${width}px;min-width:80px;max-width:100%;position:relative;display:inline-block;">
  ${imageHtml}
  ${blockWidthResizeHandle}${blockResizeHandle}
</div>`.trim();
}

function buildPreviewBackgroundStyle(backgroundColor: string, canvas: string, pattern: string) {
  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];

  if (canvas === "paper") {
    images.push("linear-gradient(135deg, rgba(255,255,255,0.12) 0 25%, transparent 25% 50%, rgba(15,23,42,0.035) 50% 75%, transparent 75% 100%)");
    sizes.push("24px 24px");
    positions.push("0 0");
  } else if (canvas === "studio") {
    images.push("radial-gradient(circle at 18% 12%, rgba(217,70,239,0.20), transparent 30%)", "radial-gradient(circle at 82% 18%, rgba(59,130,246,0.16), transparent 28%)", "radial-gradient(circle at 50% 92%, rgba(16,185,129,0.10), transparent 30%)");
    sizes.push("100% 100%", "100% 100%", "100% 100%");
    positions.push("0 0", "0 0", "0 0");
  } else if (canvas === "blueprint") {
    images.push("linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px)", "linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)");
    sizes.push("48px 48px", "48px 48px");
    positions.push("-1px -1px", "-1px -1px");
  } else if (canvas === "mist") {
    images.push("radial-gradient(circle at 30% 20%, rgba(255,255,255,0.26), transparent 34%)", "radial-gradient(circle at 72% 72%, rgba(148,163,184,0.18), transparent 36%)");
    sizes.push("100% 100%", "100% 100%");
    positions.push("0 0", "0 0");
  } else if (canvas === "aurora") {
    images.push("linear-gradient(120deg, rgba(217,70,239,0.20), transparent 34%, rgba(34,211,238,0.16), transparent 72%, rgba(16,185,129,0.14))");
    sizes.push("100% 100%");
    positions.push("0 0");
  } else if (canvas === "linen") {
    images.push("repeating-linear-gradient(0deg, rgba(255,255,255,0.12) 0 1px, transparent 1px 4px)", "repeating-linear-gradient(90deg, rgba(15,23,42,0.05) 0 1px, transparent 1px 5px)");
    sizes.push("auto", "auto");
    positions.push("0 0", "0 0");
  }

  if (pattern === "dots") {
    images.push("radial-gradient(circle, rgba(148,163,184,0.36) 1px, transparent 1.5px)");
    sizes.push("18px 18px");
    positions.push("0 0");
  } else if (pattern === "grid") {
    images.push("linear-gradient(rgba(148,163,184,0.18) 1px, transparent 1px)", "linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)");
    sizes.push("22px 22px", "22px 22px");
    positions.push("-1px -1px", "-1px -1px");
  } else if (pattern === "diagonal") {
    images.push("repeating-linear-gradient(135deg, rgba(148,163,184,0.20) 0 1px, transparent 1px 13px)");
    sizes.push("auto");
    positions.push("0 0");
  } else if (pattern === "cross") {
    images.push("repeating-linear-gradient(45deg, rgba(148,163,184,0.14) 0 1px, transparent 1px 14px)", "repeating-linear-gradient(135deg, rgba(148,163,184,0.14) 0 1px, transparent 1px 14px)");
    sizes.push("auto", "auto");
    positions.push("0 0", "0 0");
  } else if (pattern === "glow") {
    images.push("radial-gradient(circle at 50% 0%, rgba(255,255,255,0.20), transparent 34%)");
    sizes.push("100% 100%");
    positions.push("0 0");
  } else if (pattern === "waves") {
    images.push("radial-gradient(ellipse at top, transparent 52%, rgba(148,163,184,0.18) 53%, transparent 56%)");
    sizes.push("38px 24px");
    positions.push("0 0");
  } else if (pattern === "checker") {
    images.push("linear-gradient(45deg, rgba(148,163,184,0.16) 25%, transparent 25% 75%, rgba(148,163,184,0.16) 75%)", "linear-gradient(45deg, rgba(148,163,184,0.16) 25%, transparent 25% 75%, rgba(148,163,184,0.16) 75%)");
    sizes.push("24px 24px", "24px 24px");
    positions.push("0 0", "12px 12px");
  } else if (pattern === "rings") {
    images.push("radial-gradient(circle, transparent 0 7px, rgba(148,163,184,0.22) 8px, transparent 9px)");
    sizes.push("34px 34px");
    positions.push("0 0");
  } else if (pattern === "plus") {
    images.push("linear-gradient(rgba(148,163,184,0.22) 2px, transparent 2px)", "linear-gradient(90deg, rgba(148,163,184,0.22) 2px, transparent 2px)");
    sizes.push("28px 28px", "28px 28px");
    positions.push("13px 13px", "13px 13px");
  }

  return {
    backgroundColor,
    backgroundImage: images.length ? images.join(", ") : undefined,
    backgroundPosition: positions.length ? positions.join(", ") : undefined,
    backgroundSize: sizes.length ? sizes.join(", ") : undefined,
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue].map((channel) => clampNumber(Math.round(channel), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(value: string) {
  const hex = value.replace("#", "");
  if (!/^[\da-f]{6}$/i.test(hex)) {
    return { red: 0, green: 0, blue: 0 };
  }

  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function parseEmailBoxShadow(value: string) {
  const fallback = {
    vertical: 10,
    blur: 5,
    spread: 0,
    colorHex: "#000000",
    opacity: 0.75,
  };

  if (!value || value === "none") {
    return fallback;
  }

  const rgbaMatch = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)/i);
  const shadowWithoutColor = value.replace(/rgba?\([^)]+\)/gi, "");
  const lengths = Array.from(shadowWithoutColor.matchAll(/(-?\d+(?:\.\d+)?)(?:px)?/g)).map((match) => Number(match[1]));

  return {
    vertical: clampNumber(lengths[1] ?? fallback.vertical, -80, 80),
    blur: clampNumber(lengths[2] ?? fallback.blur, 0, 140),
    spread: clampNumber(lengths[3] ?? fallback.spread, -40, 80),
    colorHex: rgbaMatch ? rgbToHex(Number(rgbaMatch[1]), Number(rgbaMatch[2]), Number(rgbaMatch[3])) : fallback.colorHex,
    opacity: clampNumber(rgbaMatch?.[4] === undefined ? fallback.opacity : Number(rgbaMatch[4]), 0, 1),
  };
}

function buildEmailBoxShadowFromParts(parts: ReturnType<typeof parseEmailBoxShadow>) {
  if (parts.opacity <= 0 || (parts.vertical === 0 && parts.blur === 0 && parts.spread === 0)) {
    return "none";
  }

  const { red, green, blue } = hexToRgb(parts.colorHex);
  return `0 ${parts.vertical}px ${parts.blur}px ${parts.spread}px rgba(${red}, ${green}, ${blue}, ${parts.opacity.toFixed(2)})`;
}

function rgbTextToHex(value: string) {
  const match = value.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!match) {
    return null;
  }

  return rgbToHex(Number(match[1]), Number(match[2]), Number(match[3]));
}

const starterHtml = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4fb;padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:100%;background:#ffffff;border-radius:18px;overflow:hidden;font-family:Arial,sans-serif;color:#111827;box-shadow:0 18px 45px rgba(15,23,42,0.12);">
        <tr>
          <td style="padding:34px 40px 30px;background:#111827;color:#ffffff;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="font-size:18px;font-weight:800;">Trigger Mail AI</td>
                <td align="right" style="font-size:12px;color:#c4b5fd;">Welcome</td>
              </tr>
            </table>
            <div style="padding-top:34px;font-size:42px;line-height:1.05;font-weight:900;letter-spacing:-0.5px;">You are ready to build smarter email journeys</div>
            <div style="padding-top:16px;max-width:450px;font-size:16px;line-height:1.65;color:#dbeafe;">Hi {{first_name}}, your workspace is ready. Start with a simple flow, connect your first trigger, and send emails that react to customer behaviour.</div>
            <div style="padding-top:26px;">
              <a href="https://example.com" style="display:inline-block;background:#d946ef;color:#ffffff;text-decoration:none;border-radius:10px;padding:15px 24px;font-size:14px;font-weight:800;">Create your first flow</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 40px 12px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td width="33.33%" style="padding-right:10px;vertical-align:top;">
                  <div style="font-size:13px;font-weight:800;color:#111827;">1. Connect</div>
                  <p style="margin:8px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Add your sender details and bring in your first contact source.</p>
                </td>
                <td width="33.33%" style="padding:0 10px;vertical-align:top;">
                  <div style="font-size:13px;font-weight:800;color:#111827;">2. Build</div>
                  <p style="margin:8px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Create a flow with a trigger, decision step, and email module.</p>
                </td>
                <td width="33.33%" style="padding-left:10px;vertical-align:top;">
                  <div style="font-size:13px;font-weight:800;color:#111827;">3. Send</div>
                  <p style="margin:8px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Test the journey, publish it, and watch the run history.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 40px 8px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
              <tr>
                <td style="padding:20px 22px;">
                  <div style="font-size:14px;font-weight:900;color:#111827;">Recommended first automation</div>
                  <p style="margin:8px 0 0;font-size:14px;line-height:1.65;color:#64748b;">Start with a welcome series: when a new contact joins {{audience_name}}, send a welcome message, wait two days, then send a useful follow-up.</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
                    <tr>
                      <td style="font-size:12px;font-weight:800;color:#7c3aed;">Trigger</td>
                      <td style="font-size:12px;font-weight:800;color:#7c3aed;">Email</td>
                      <td style="font-size:12px;font-weight:800;color:#7c3aed;">Decision</td>
                    </tr>
                    <tr>
                      <td style="padding-top:6px;font-size:13px;color:#475569;">New signup</td>
                      <td style="padding-top:6px;font-size:13px;color:#475569;">Welcome message</td>
                      <td style="padding-top:6px;font-size:13px;color:#475569;">Opened?</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 26px;">
            <p style="margin:0;font-size:14px;line-height:1.65;color:#475569;">Need a hand? Reply to this email with what you want to automate and we will point you in the right direction.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 40px 34px;font-size:12px;line-height:1.6;color:#94a3b8;border-top:1px solid #eef2f7;">You are receiving this because {{email}} joined Trigger Mail AI.</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();

const newsletterStarterHtml = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff;padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="660" cellspacing="0" cellpadding="0" style="width:660px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;color:#111827;box-shadow:0 18px 45px rgba(15,23,42,0.10);">
        <tr>
          <td style="padding:24px 34px;border-bottom:1px solid #eef2f7;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="font-size:18px;font-weight:900;color:#111827;">App Update</td>
                <td align="right" style="font-size:12px;font-weight:700;color:#7c3aed;">{{month}} edition</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:38px 34px 28px;">
            <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7c3aed;">Product news</div>
            <div style="padding-top:12px;font-size:38px;line-height:1.08;font-weight:900;">Three improvements your team can use this week</div>
            <p style="margin:16px 0 0;font-size:16px;line-height:1.65;color:#475569;">Hi {{first_name}}, here is a quick round-up of the newest updates, workflow ideas, and resources from the team.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 34px 34px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="padding:20px;background:#f8fafc;border-radius:14px;">
                  <div style="font-size:18px;font-weight:800;">New: cleaner run history</div>
                  <p style="margin:8px 0 0;font-size:14px;line-height:1.65;color:#64748b;">See exactly what happened inside each flow run, including passed data and skipped modules.</p>
                </td>
              </tr>
              <tr>
                <td style="padding-top:14px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td width="50%" style="padding:18px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;vertical-align:top;">
                        <div style="font-size:15px;font-weight:800;">Template folders</div>
                        <p style="margin:7px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Organise reusable emails by client, campaign, or journey.</p>
                      </td>
                      <td width="16"></td>
                      <td width="50%" style="padding:18px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;vertical-align:top;">
                        <div style="font-size:15px;font-weight:800;">Asset picker</div>
                        <p style="margin:7px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Tag saved images into prompts and drop them into email sections.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;background:#faf5ff;border-radius:14px;">
              <tr>
                <td style="padding:20px;">
                  <div style="font-size:15px;font-weight:900;color:#581c87;">Workflow idea of the month</div>
                  <p style="margin:8px 0 0;font-size:14px;line-height:1.65;color:#6b21a8;">Use a webhook trigger to receive customer data, map fields into a template, then send a personalised report email automatically.</p>
                  <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#7e22ce;">Suggested merge tags: {{name}}, {{report_url}}, {{last_refresh}}, {{account_status}}</p>
                </td>
              </tr>
            </table>
            <div style="padding-top:24px;">
              <a href="https://example.com" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 22px;font-size:14px;font-weight:800;">Read the update</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 34px;background:#f8fafc;font-size:12px;line-height:1.6;color:#64748b;">Trigger Mail AI • You can change update preferences at any time.</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();

const reportReadyStarterHtml = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f0ff;padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="660" cellspacing="0" cellpadding="0" style="width:660px;max-width:100%;background:#ffffff;border-radius:18px;overflow:hidden;font-family:Arial,sans-serif;color:#1f2147;box-shadow:0 18px 50px rgba(76,29,149,0.18);">
        <tr>
          <td style="padding:34px 42px 52px;background:#4c1d95;color:#ffffff;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="font-size:18px;font-weight:900;">Appknowledged</td>
                <td align="right" style="font-size:12px;color:#e9d5ff;">Knack Reports</td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding-top:30px;">
              <tr>
                <td width="58%" style="vertical-align:middle;">
                  <div style="font-size:38px;line-height:1.12;font-weight:900;">Your scheduled refresh is complete</div>
                  <p style="margin:14px 0 0;font-size:16px;line-height:1.65;color:#f3e8ff;">We have updated your data and your report is ready to view.</p>
                </td>
                <td width="42%" align="right" style="vertical-align:middle;">
                  <div style="display:inline-block;width:190px;height:150px;border-radius:18px;background:#ffffff;box-shadow:0 16px 35px rgba(17,24,39,0.22);text-align:left;overflow:hidden;">
                    <div style="height:32px;background:#111827;padding-left:14px;line-height:32px;color:#ffffff;font-size:18px;">•••</div>
                    <div style="padding:26px 22px;text-align:center;">
                      <div style="font-size:54px;color:#d946ef;line-height:1;">↻</div>
                      <div style="margin-top:-38px;font-size:34px;color:#22c55e;line-height:1;">✓</div>
                    </div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:38px 42px 34px;">
            <p style="margin:0;font-size:16px;line-height:1.7;">Hi {{name}},</p>
            <p style="margin:16px 0 0;font-size:16px;line-height:1.7;color:#475569;">Your scheduled refresh is complete.</p>
            <p style="margin:16px 0 0;font-size:16px;line-height:1.7;color:#475569;">{{body}}</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border:1px solid #ede9fe;border-radius:14px;overflow:hidden;">
              <tr>
                <td style="padding:14px 16px;background:#faf5ff;font-size:13px;font-weight:900;color:#4c1d95;">Refresh summary</td>
                <td style="padding:14px 16px;background:#faf5ff;font-size:13px;color:#4c1d95;">{{refresh_status}}</td>
              </tr>
              <tr>
                <td style="padding:14px 16px;border-top:1px solid #ede9fe;font-size:13px;font-weight:800;color:#475569;">Records updated</td>
                <td style="padding:14px 16px;border-top:1px solid #ede9fe;font-size:13px;color:#111827;">{{records_updated}}</td>
              </tr>
              <tr>
                <td style="padding:14px 16px;border-top:1px solid #ede9fe;font-size:13px;font-weight:800;color:#475569;">Last refreshed</td>
                <td style="padding:14px 16px;border-top:1px solid #ede9fe;font-size:13px;color:#111827;">{{last_refreshed_at}}</td>
              </tr>
              <tr>
                <td style="padding:14px 16px;border-top:1px solid #ede9fe;font-size:13px;font-weight:800;color:#475569;">Report owner</td>
                <td style="padding:14px 16px;border-top:1px solid #ede9fe;font-size:13px;color:#111827;">{{owner_name}}</td>
              </tr>
            </table>
            <div style="padding-top:26px;">
              <a href="{{actionUrl}}" style="display:inline-block;background:#db2777;color:#ffffff;text-decoration:none;border-radius:10px;padding:15px 26px;font-size:14px;font-weight:900;">{{actionLabel}} →</a>
            </div>
            <p style="margin:22px 0 0;font-size:13px;line-height:1.65;color:#64748b;">If anything looks out of place, check the source data in Knack and run the refresh again from your report dashboard.</p>
            <p style="margin:30px 0 0;font-size:15px;line-height:1.7;color:#334155;">The AppKnowledged team</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:24px 42px;border-top:1px solid #ede9fe;font-size:13px;color:#7c6eaa;">AppKnowledged • Knack Reports</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();

const alertStarterHtml = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:620px;max-width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;color:#111827;">
        <tr>
          <td style="padding:28px 34px;border-bottom:1px solid #eef2f7;">
            <div style="font-size:18px;font-weight:900;">Trigger Mail AI</div>
          </td>
        </tr>
        <tr>
          <td style="padding:34px;">
            <div style="display:inline-block;border-radius:999px;background:#dcfce7;color:#166534;padding:7px 12px;font-size:12px;font-weight:800;">Action completed</div>
            <h1 style="margin:18px 0 0;font-size:32px;line-height:1.15;">{{event_name}} has finished successfully</h1>
            <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#475569;">Hi {{first_name}}, the automation finished and the important details are below.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:13px 16px;background:#f8fafc;font-size:13px;font-weight:800;color:#475569;">Run ID</td>
                <td style="padding:13px 16px;background:#f8fafc;font-size:13px;color:#111827;">{{run_id}}</td>
              </tr>
              <tr>
                <td style="padding:13px 16px;border-top:1px solid #e2e8f0;font-size:13px;font-weight:800;color:#475569;">Completed</td>
                <td style="padding:13px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#111827;">{{completed_at}}</td>
              </tr>
              <tr>
                <td style="padding:13px 16px;border-top:1px solid #e2e8f0;font-size:13px;font-weight:800;color:#475569;">Result</td>
                <td style="padding:13px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#111827;">{{result_summary}}</td>
              </tr>
              <tr>
                <td style="padding:13px 16px;border-top:1px solid #e2e8f0;font-size:13px;font-weight:800;color:#475569;">Operations</td>
                <td style="padding:13px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#111827;">{{operation_count}}</td>
              </tr>
              <tr>
                <td style="padding:13px 16px;border-top:1px solid #e2e8f0;font-size:13px;font-weight:800;color:#475569;">Data size</td>
                <td style="padding:13px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#111827;">{{data_size}}</td>
              </tr>
            </table>
            <div style="margin-top:20px;padding:18px;background:#f8fafc;border-radius:12px;">
              <div style="font-size:14px;font-weight:900;color:#111827;">What happened next</div>
              <p style="margin:8px 0 0;font-size:13px;line-height:1.65;color:#64748b;">{{next_step_summary}}</p>
            </div>
            <div style="padding-top:26px;">
              <a href="{{dashboard_url}}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 22px;font-size:14px;font-weight:800;">View details</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 34px;background:#f8fafc;font-size:12px;line-height:1.6;color:#64748b;">This message was sent to {{email}} because you receive workflow notifications.</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();

const inviteStarterHtml = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff7ed;padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:620px;max-width:100%;background:#ffffff;border-radius:18px;overflow:hidden;font-family:Arial,sans-serif;color:#111827;box-shadow:0 18px 45px rgba(154,52,18,0.12);">
        <tr>
          <td style="padding:36px 38px;background:#7c2d12;color:#ffffff;">
            <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#fed7aa;">Invitation</div>
            <div style="padding-top:14px;font-size:38px;line-height:1.08;font-weight:900;">{{inviter_name}} invited you to join {{workspace_name}}</div>
            <p style="margin:16px 0 0;font-size:16px;line-height:1.65;color:#ffedd5;">Work with your team on flows, templates, assets, and sending settings in one shared workspace.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:34px 38px;">
            <p style="margin:0;font-size:16px;line-height:1.7;color:#475569;">Accept the invitation to start collaborating with {{workspace_name}}.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;">
              <tr>
                <td style="padding:18px 20px;">
                  <div style="font-size:14px;font-weight:900;color:#7c2d12;">You will be able to</div>
                  <p style="margin:9px 0 0;font-size:14px;line-height:1.65;color:#9a3412;">Create and edit templates, review flow runs, manage assets, and collaborate with {{team_count}} teammates.</p>
                  <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#9a3412;">Role: {{role_name}} • Workspace: {{workspace_name}}</p>
                </td>
              </tr>
            </table>
            <div style="padding-top:26px;">
              <a href="{{invite_url}}" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;border-radius:10px;padding:15px 24px;font-size:14px;font-weight:900;">Accept invitation</a>
            </div>
            <p style="margin:20px 0 0;font-size:14px;line-height:1.65;color:#475569;">After accepting, you can update your profile, notification settings, and connected email account from Settings.</p>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">This invitation expires on {{expiry_date}}. If you were not expecting this, you can ignore this email.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();

const promotionStarterHtml = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#111827;padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="650" cellspacing="0" cellpadding="0" style="width:650px;max-width:100%;background:#ffffff;border-radius:18px;overflow:hidden;font-family:Arial,sans-serif;color:#111827;box-shadow:0 22px 60px rgba(0,0,0,0.28);">
        <tr>
          <td style="padding:38px 42px;background:#fdf2f8;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="font-size:13px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#db2777;">Limited offer</td>
                <td align="right" style="font-size:13px;font-weight:800;color:#831843;">Ends {{offer_end_date}}</td>
              </tr>
            </table>
            <div style="padding-top:20px;font-size:44px;line-height:1.02;font-weight:900;letter-spacing:-0.6px;">Save 20% on your next plan</div>
            <p style="margin:16px 0 0;max-width:440px;font-size:16px;line-height:1.65;color:#475569;">Hi {{first_name}}, unlock more sends, richer automations, and better reporting with a plan built for growing teams.</p>
            <div style="padding-top:26px;">
              <a href="{{offer_url}}" style="display:inline-block;background:#db2777;color:#ffffff;text-decoration:none;border-radius:10px;padding:15px 26px;font-size:14px;font-weight:900;">Claim the offer</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 42px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td width="33.33%" style="padding-right:10px;vertical-align:top;">
                  <div style="font-size:24px;font-weight:900;color:#db2777;">{{send_limit}}</div>
                  <div style="font-size:13px;line-height:1.5;color:#64748b;">monthly sends</div>
                </td>
                <td width="33.33%" style="padding:0 10px;vertical-align:top;">
                  <div style="font-size:24px;font-weight:900;color:#db2777;">{{flow_count}}</div>
                  <div style="font-size:13px;line-height:1.5;color:#64748b;">active flows</div>
                </td>
                <td width="33.33%" style="padding-left:10px;vertical-align:top;">
                  <div style="font-size:24px;font-weight:900;color:#db2777;">20%</div>
                  <div style="font-size:13px;line-height:1.5;color:#64748b;">discount today</div>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:26px;background:#fdf2f8;border-radius:14px;">
              <tr>
                <td style="padding:20px;">
                  <div style="font-size:15px;font-weight:900;color:#831843;">What is included</div>
                  <p style="margin:9px 0 0;font-size:14px;line-height:1.65;color:#9d174d;">More monthly sends, advanced flow testing, saved template folders, asset management, and run history for debugging live journeys.</p>
                </td>
              </tr>
            </table>
            <p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">Offer applies to the first billing period. You can change or cancel your plan at any time.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();

const starterLayouts = {
  basic: {
    name: "Basic blank template",
    subject: "Untitled subject",
    preheader: "",
    description: "A blank email canvas for building sections and testing controls from scratch.",
    category: "Basic",
    settings: { globalBackground: "#e5e7eb", previewPadding: 24, emailWidth: 680, emailBorderRadius: 12, emailBoxShadow: defaultEmailBoxShadow, globalBackgroundPattern: "none", globalBackgroundCanvas: "plain" },
    html: "",
    sections: [] as Array<{ label: string; html: string }>,
  },
  simple: {
    name: "Welcome onboarding email",
    subject: "Welcome to Trigger Mail AI, {{first_name}}",
    preheader: "Your workspace is ready. Build your first flow.",
    description: "A polished welcome email with onboarding steps and a primary CTA.",
    category: "Onboarding",
    settings: { globalBackground: "#f3f4fb", previewPadding: 24, emailWidth: 760, emailBorderRadius: 10, emailBoxShadow: defaultEmailBoxShadow, globalBackgroundPattern: "none", globalBackgroundCanvas: "plain" },
    html: starterHtml,
  },
  reportReady: {
    name: "Report refresh complete",
    subject: "Your scheduled refresh is complete",
    preheader: "Your report data has been updated and is ready to view.",
    description: "A complete report-ready notification with hero, body copy, CTA, and footer.",
    category: "Transactional",
    settings: { globalBackground: "#f3f0ff", previewPadding: 24, emailWidth: 720, emailBorderRadius: 18, emailBoxShadow: defaultEmailBoxShadow, globalBackgroundPattern: "none", globalBackgroundCanvas: "plain" },
    html: reportReadyStarterHtml,
  },
  newsletter: {
    name: "Product update newsletter",
    subject: "Your latest product news",
    preheader: "Three improvements your team can use this week.",
    description: "A richer newsletter email for announcements, features, and product updates.",
    category: "Newsletter",
    settings: { globalBackground: "#eef2ff", previewPadding: 24, emailWidth: 740, emailBorderRadius: 16, emailBoxShadow: defaultEmailBoxShadow, globalBackgroundPattern: "none", globalBackgroundCanvas: "plain" },
    html: newsletterStarterHtml,
  },
  promotion: {
    name: "Limited offer campaign",
    subject: "Save 20% on your next plan",
    preheader: "A time-limited upgrade offer for your account.",
    description: "A sales email with offer timing, CTA, usage stats, and footer copy.",
    category: "Sales",
    settings: { globalBackground: "#111827", previewPadding: 28, emailWidth: 720, emailBorderRadius: 18, emailBoxShadow: defaultEmailBoxShadow, globalBackgroundPattern: "none", globalBackgroundCanvas: "plain" },
    html: promotionStarterHtml,
  },
  alert: {
    name: "Workflow alert email",
    subject: "{{event_name}} has finished successfully",
    preheader: "Your automation completed and the details are ready.",
    description: "A practical operational alert with run details and a dashboard CTA.",
    category: "Transactional",
    settings: { globalBackground: "#f8fafc", previewPadding: 24, emailWidth: 680, emailBorderRadius: 16, emailBoxShadow: defaultEmailBoxShadow, globalBackgroundPattern: "none", globalBackgroundCanvas: "plain" },
    html: alertStarterHtml,
  },
  invite: {
    name: "Workspace invitation",
    subject: "{{inviter_name}} invited you to join {{workspace_name}}",
    preheader: "Accept your invitation to start collaborating.",
    description: "A warm invite email for adding team members to a shared workspace.",
    category: "Onboarding",
    settings: { globalBackground: "#fff7ed", previewPadding: 24, emailWidth: 680, emailBorderRadius: 18, emailBoxShadow: defaultEmailBoxShadow, globalBackgroundPattern: "none", globalBackgroundCanvas: "plain" },
    html: inviteStarterHtml,
  },
} satisfies Record<string, { name: string; subject: string; preheader: string; description: string; category: string; settings: Pick<BuilderSnapshot, "globalBackground" | "previewPadding" | "emailWidth" | "emailBorderRadius" | "emailBoxShadow" | "globalBackgroundPattern" | "globalBackgroundCanvas">; html: string; sections?: Array<{ label: string; html: string }> }>;

type StarterLayoutId = keyof typeof starterLayouts;
const starterLayoutNames = new Set(Object.values(starterLayouts).map((layout) => layout.name));

function getStarterLayout(value: string | null) {
  return value && value in starterLayouts ? starterLayouts[value as keyof typeof starterLayouts] : starterLayouts.simple;
}

function isWholeEmailSection(section: EmailSection) {
  if (starterLayoutNames.has(section.label) || section.html.includes("data-builder-whole-email")) {
    return true;
  }

  return false;
}

function prepareWholeEmailTemplateHtml(rawHtml: string) {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return rawHtml;
  }

  const parsedDocument = new DOMParser().parseFromString(rawHtml, "text/html");
  const outerTable = parsedDocument.body.firstElementChild as HTMLTableElement | null;
  const outerCell = outerTable?.tBodies?.[0]?.rows?.[0]?.cells?.[0] || outerTable?.querySelector("td");
  const emailTable = Array.from(outerCell?.children || []).find((child) => child.tagName.toLowerCase() === "table") as HTMLTableElement | undefined;

  if (!emailTable) {
    return rawHtml;
  }

  emailTable.setAttribute("width", "100%");
  emailTable.setAttribute("cellspacing", "0");
  emailTable.setAttribute("cellpadding", "0");
  emailTable.setAttribute("data-builder-whole-email", "true");
  emailTable.style.width = "100%";
  emailTable.style.maxWidth = "100%";
  emailTable.style.borderRadius = "0";
  emailTable.style.boxShadow = "none";
  emailTable.style.margin = "0";
  emailTable.style.borderCollapse = "collapse";
  emailTable.style.tableLayout = "fixed";

  emailTable.querySelectorAll("table").forEach((table) => {
    table.setAttribute("cellspacing", "0");
    table.setAttribute("cellpadding", "0");
    table.style.maxWidth = "100%";
    table.style.tableLayout = table.style.tableLayout || "fixed";
  });

  emailTable.querySelectorAll("td").forEach((cell) => {
    cell.style.boxSizing = "border-box";
    cell.style.wordBreak = "normal";
    cell.style.overflowWrap = "break-word";
  });

  return emailTable.outerHTML;
}

function buildLogoHeaderHtml(logoHtml = `<img src="https://placehold.co/180x48/png?text=Logo" alt="Logo" width="180" style="display:block;width:180px;max-width:70%;height:auto;border:0;" />`, alignment: "left" | "center" | "right" = "center") {
  const logo = extractFirstImageHtml(logoHtml) || logoHtml;

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" ${shellHeaderMarker} style="background:transparent;font-family:Arial,sans-serif;">
  <tr>
    <td align="${alignment}" style="padding:24px 32px 18px;text-align:${alignment};">
      ${logo}
    </td>
  </tr>
</table>`.trim();
}

function getLogoHeaderAlignment(html: string): "left" | "center" | "right" {
  const alignMatch = html.match(/\balign=["'](left|center|right)["']/i);
  if (alignMatch?.[1]) {
    return alignMatch[1].toLowerCase() as "left" | "center" | "right";
  }

  const textAlignMatch = html.match(/text-align\s*:\s*(left|center|right)/i);
  if (textAlignMatch?.[1]) {
    return textAlignMatch[1].toLowerCase() as "left" | "center" | "right";
  }

  return "center";
}

type FooterShellContent = {
  note: string;
  links: Array<{ label: string; href: string }>;
};

const defaultFooterShellContent: FooterShellContent = {
  note: "Trigger Mail AI · You are receiving this because you subscribed to updates.",
  links: [
    { label: "LinkedIn", href: "https://example.com" },
    { label: "X", href: "https://example.com" },
    { label: "Website", href: "https://example.com" },
  ],
};

function buildFooterShellHtml(content: FooterShellContent = defaultFooterShellContent) {
  const links = content.links.length ? content.links : defaultFooterShellContent.links;

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" ${shellFooterMarker} style="background:transparent;font-family:Arial,sans-serif;">
  <tr>
    <td align="center" style="padding:24px 32px 28px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">${escapeHtml(content.note || defaultFooterShellContent.note)}</p>
      <p style="margin:12px 0 0;font-size:13px;line-height:1.6;">
        ${links.map((link) => `<a href="${escapeAttribute(link.href || "https://example.com")}" style="color:#7c3aed;text-decoration:none;font-weight:700;">${escapeHtml(link.label || "Link")}</a>`).join("\n        &nbsp;·&nbsp;\n        ")}
      </p>
    </td>
  </tr>
</table>`.trim();
}

function getFooterShellContent(html: string): FooterShellContent {
  if (typeof DOMParser !== "undefined") {
    try {
      const document = new DOMParser().parseFromString(html, "text/html");
      const paragraphs = Array.from(document.body.querySelectorAll("p"));
      const note = paragraphs[0]?.textContent?.trim() || defaultFooterShellContent.note;
      const links = Array.from(document.body.querySelectorAll("a")).map((anchor) => ({
        label: anchor.textContent?.trim() || "Link",
        href: anchor.getAttribute("href") || "https://example.com",
      }));

      return { note, links: links.length ? links.slice(0, 3) : defaultFooterShellContent.links };
    } catch {
      return defaultFooterShellContent;
    }
  }

  return defaultFooterShellContent;
}

function extractFirstImageHtml(html: string) {
  if (typeof DOMParser !== "undefined") {
    try {
      const document = new DOMParser().parseFromString(html, "text/html");
      const image = document.body.querySelector("img");

      if (image) {
        image.setAttribute("style", "display:block;width:180px;max-width:70%;height:auto;border:0;");
        image.setAttribute("width", image.getAttribute("width") || "180");
        return image.outerHTML;
      }
    } catch {
      return "";
    }
  }

  return html.match(/<img\b[\s\S]*?>/i)?.[0] || "";
}

function isShellHeaderSection(section: EmailSection) {
  return section.html.includes(shellHeaderMarker);
}

function isShellFooterSection(section: EmailSection) {
  return section.html.includes(shellFooterMarker);
}

function isShellSection(section: EmailSection) {
  return isShellHeaderSection(section) || isShellFooterSection(section);
}

function isHeroPatternSection(section: EmailSection) {
  return section.html.includes("data-builder-hero-pattern");
}

function isHeroPatternHtml(sectionHtml: string) {
  return sectionHtml.includes("data-builder-hero-pattern");
}

function isFooterPatternSection(section: EmailSection) {
  return section.html.includes("data-builder-footer-pattern");
}

function isFooterPatternHtml(sectionHtml: string) {
  return sectionHtml.includes("data-builder-footer-pattern");
}

function isBodyPatternSection(section: EmailSection) {
  return isHeroPatternSection(section) || isFooterPatternSection(section);
}

function buildEmptyBodySectionHtml() {
  return `<table role="presentation" width="100%" height="520" cellspacing="0" cellpadding="0" border="0" ${emptyBodyMarker} style="width:100%;height:520px;background:#ffffff;border-radius:10px;">
  <tr>
    <td height="520" style="height:520px;font-size:1px;line-height:1px;">&nbsp;</td>
  </tr>
</table>`.trim();
}

function isEmptyBodyPlaceholderSection(section: EmailSection) {
  return section.html.includes(emptyBodyMarker);
}

function ensurePersistedBodyCanvas(nextSections: EmailSection[]) {
  const orderedSections = orderShellSections(nextSections);
  const needsPersistedCanvas = orderedSections.some((section) => isShellSection(section) || isBodyPatternSection(section));

  if (!needsPersistedCanvas) {
    return orderedSections;
  }

  const hasBodyContent = orderedSections.some((section) => !isShellSection(section) && !isBodyPatternSection(section) && !isEmptyBodyPlaceholderSection(section));

  if (hasBodyContent) {
    return orderedSections.filter((section) => !isEmptyBodyPlaceholderSection(section));
  }

  const hasPlaceholder = orderedSections.some(isEmptyBodyPlaceholderSection);

  if (hasPlaceholder) {
    return orderedSections;
  }

  const sectionsWithCanvas = [...orderedSections];
  sectionsWithCanvas.splice(getBodyInsertIndex(sectionsWithCanvas), 0, createSection("Email body", buildEmptyBodySectionHtml()));
  return orderShellSections(sectionsWithCanvas);
}

function removeEmptyBodyPlaceholder(nextSections: EmailSection[]) {
  return nextSections.filter((section) => !isEmptyBodyPlaceholderSection(section));
}

function orderShellSections(nextSections: EmailSection[]) {
  const header = nextSections.find(isShellHeaderSection);
  const footer = nextSections.find(isShellFooterSection);
  const body = nextSections.filter((section) => !isShellSection(section));

  return [header, ...body, footer].filter(Boolean) as EmailSection[];
}

function getBodyInsertIndex(nextSections: EmailSection[]) {
  const footerIndex = nextSections.findIndex(isShellFooterSection);

  return footerIndex === -1 ? nextSections.length : footerIndex;
}

const snippets = [
  {
    label: "Text",
    icon: Type,
    html: `<p style="font-size:15px;line-height:1.6;color:#475569;">Add your email copy here.</p>`,
  },
  {
    label: "Image",
    icon: ImageIcon,
    html: buildResizableImageHtml(`<img src="https://placehold.co/560x260/png" alt="" width="560" style="display:block;width:100%;max-width:100%;height:auto;border-radius:10px;" />`),
  },
  {
    label: "Button",
    icon: MousePointerClick,
    html: `<a href="https://example.com" style="display:inline-block;background:#d946ef;color:#ffffff;text-decoration:none;border-radius:8px;padding:13px 24px;font-size:14px;font-weight:700;">Call to action</a>`,
  },
  {
    label: "Divider",
    icon: Minus,
    html: `<hr style="border:0;border-top:1px solid #e2e8f0;margin:28px 0;" />`,
  },
  {
    label: "Two columns",
    icon: Columns3,
    html: `<div data-builder-block="columns-2" style="resize:both;overflow:auto;width:72%;min-width:180px;min-height:72px;max-width:100%;border:1px dashed #c084fc;padding:12px;"><table role="presentation" width="100%" height="100%" cellspacing="0" cellpadding="0"><tr><td width="50%" style="border-right:1px dashed #c084fc;padding-right:10px;vertical-align:top;">Column one</td><td width="50%" style="padding-left:10px;vertical-align:top;">Column two</td></tr></table></div>`,
  },
  {
    label: "Variable",
    icon: Braces,
    html: `{{first_name}}`,
  },
];

const iconOptions = [
  { label: "Success", icon: CheckCircle2, glyph: "&#10003;", color: "#16a34a", background: "#dcfce7" },
  { label: "Approved", icon: ShieldCheck, glyph: "&#10003;", color: "#059669", background: "#d1fae5" },
  { label: "Alert", icon: Bell, glyph: "&#128276;", color: "#f97316", background: "#ffedd5" },
  { label: "Important", icon: Flag, glyph: "&#9873;", color: "#dc2626", background: "#fee2e2" },
  { label: "Info", icon: Info, glyph: "i", color: "#0284c7", background: "#e0f2fe" },
  { label: "Star", icon: Star, glyph: "&#9733;", color: "#ca8a04", background: "#fef9c3" },
  { label: "Award", icon: Award, glyph: "&#9733;", color: "#b45309", background: "#ffedd5" },
  { label: "Trophy", icon: Trophy, glyph: "&#127942;", color: "#ca8a04", background: "#fef3c7" },
  { label: "Gift", icon: Gift, glyph: "&#127873;", color: "#db2777", background: "#fce7f3" },
  { label: "Tag", icon: Tag, glyph: "&#9670;", color: "#be185d", background: "#fce7f3" },
  { label: "Offer", icon: CircleDollarSign, glyph: "&#163;", color: "#16a34a", background: "#dcfce7" },
  { label: "Payment", icon: CreditCard, glyph: "&#9679;", color: "#0f766e", background: "#ccfbf1" },
  { label: "Cart", icon: ShoppingCart, glyph: "&#128722;", color: "#2563eb", background: "#dbeafe" },
  { label: "Package", icon: Package, glyph: "&#9632;", color: "#92400e", background: "#fef3c7" },
  { label: "Delivery", icon: Truck, glyph: "&#10148;", color: "#475569", background: "#f1f5f9" },
  { label: "Calendar", icon: Calendar, glyph: "&#128197;", color: "#2563eb", background: "#dbeafe" },
  { label: "Clock", icon: Clock, glyph: "&#9200;", color: "#7c3aed", background: "#ede9fe" },
  { label: "Target", icon: Target, glyph: "&#9679;", color: "#7c3aed", background: "#ede9fe" },
  { label: "Secure", icon: ShieldCheck, glyph: "&#128274;", color: "#0f766e", background: "#ccfbf1" },
  { label: "Lock", icon: LockKeyhole, glyph: "&#128274;", color: "#334155", background: "#e2e8f0" },
  { label: "Key", icon: KeyRound, glyph: "&#9906;", color: "#7c2d12", background: "#ffedd5" },
  { label: "Heart", icon: Heart, glyph: "&#9829;", color: "#e11d48", background: "#ffe4e6" },
  { label: "Like", icon: ThumbsUp, glyph: "&#128077;", color: "#2563eb", background: "#dbeafe" },
  { label: "Smile", icon: Smile, glyph: "&#9786;", color: "#d97706", background: "#fef3c7" },
  { label: "Lightning", icon: Zap, glyph: "&#9889;", color: "#d97706", background: "#fef3c7" },
  { label: "Rocket", icon: Rocket, glyph: "&#9650;", color: "#7c3aed", background: "#ede9fe" },
  { label: "Spark", icon: Sparkles, glyph: "&#10022;", color: "#d946ef", background: "#fae8ff" },
  { label: "Message", icon: MessageCircle, glyph: "&#9993;", color: "#0891b2", background: "#cffafe" },
  { label: "Mail", icon: Mail, glyph: "&#9993;", color: "#7c3aed", background: "#ede9fe" },
  { label: "Support", icon: Headphones, glyph: "&#9742;", color: "#0284c7", background: "#e0f2fe" },
  { label: "Users", icon: Users, glyph: "&#9679;", color: "#4f46e5", background: "#e0e7ff" },
  { label: "New User", icon: UserPlus, glyph: "+", color: "#16a34a", background: "#dcfce7" },
  { label: "Business", icon: BriefcaseBusiness, glyph: "&#9632;", color: "#334155", background: "#e2e8f0" },
  { label: "Company", icon: Building2, glyph: "&#9632;", color: "#475569", background: "#f1f5f9" },
  { label: "Globe", icon: Globe2, glyph: "&#9675;", color: "#0d9488", background: "#ccfbf1" },
  { label: "Location", icon: MapPin, glyph: "&#9679;", color: "#e11d48", background: "#ffe4e6" },
  { label: "Link", icon: Link2, glyph: "&#8734;", color: "#2563eb", background: "#dbeafe" },
  { label: "Search", icon: Search, glyph: "&#8981;", color: "#475569", background: "#f1f5f9" },
  { label: "View", icon: Eye, glyph: "&#9675;", color: "#7c3aed", background: "#ede9fe" },
  { label: "File", icon: FileText, glyph: "&#9633;", color: "#334155", background: "#e2e8f0" },
  { label: "File Done", icon: FileCheck2, glyph: "&#10003;", color: "#16a34a", background: "#dcfce7" },
  { label: "Download", icon: Download, glyph: "&#8595;", color: "#2563eb", background: "#dbeafe" },
  { label: "Database", icon: DatabaseIcon, glyph: "&#9679;", color: "#7c3aed", background: "#ede9fe" },
  { label: "Cloud", icon: Cloud, glyph: "&#9729;", color: "#0284c7", background: "#e0f2fe" },
  { label: "Report", icon: ChartNoAxesColumn, glyph: "&#9632;", color: "#0891b2", background: "#cffafe" },
  { label: "Campaign", icon: Megaphone, glyph: "&#9658;", color: "#db2777", background: "#fce7f3" },
  { label: "Camera", icon: Camera, glyph: "&#9679;", color: "#475569", background: "#f1f5f9" },
  { label: "Mobile", icon: Smartphone, glyph: "&#9647;", color: "#4f46e5", background: "#e0e7ff" },
  { label: "Desktop", icon: Laptop, glyph: "&#9645;", color: "#334155", background: "#e2e8f0" },
  { label: "Tools", icon: Wrench, glyph: "&#9881;", color: "#475569", background: "#f1f5f9" },
] as const;

function buildIconBlockHtml(icon: (typeof iconOptions)[number]) {
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" data-builder-block="icon" style="display:inline-table;border-collapse:separate;font-family:Arial,sans-serif;">
  <tr>
    <td align="center" valign="middle" style="width:56px;height:56px;border-radius:999px;background:${icon.background};color:${icon.color};font-size:28px;line-height:56px;font-weight:900;text-align:center;">${icon.glyph}</td>
  </tr>
</table>`.trim();
}

const contentBlocks = [
  {
    label: "Title",
    icon: Type,
    html: `<h2 style="margin:0;font-family:Arial,sans-serif;font-size:28px;line-height:1.2;font-weight:800;color:#111827;">Add a title</h2>`,
  },
  {
    label: "Paragraph",
    icon: AlignLeft,
    html: `<p style="margin:0;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#475569;">Add your paragraph copy here.</p>`,
  },
  {
    label: "List",
    icon: List,
    html: `<ul style="margin:0;padding-left:22px;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#475569;"><li>First point</li><li>Second point</li><li>Third point</li></ul>`,
  },
  {
    label: "Image",
    icon: ImageIcon,
    html: buildResizableImageHtml(`<img src="https://placehold.co/560x260/png" alt="" width="560" style="display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:10px;" />`),
  },
  {
    label: "Button",
    icon: MousePointerClick,
    html: `<a href="https://example.com" style="display:inline-block;background:#d946ef;color:#ffffff;text-decoration:none;border-radius:8px;padding:13px 24px;font-family:Arial,sans-serif;font-size:14px;font-weight:800;">Call to action</a>`,
  },
  {
    label: "Icon",
    icon: Sparkles,
    html: buildIconBlockHtml(iconOptions[0]),
  },
  {
    label: "Table",
    icon: Table2,
    html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;font-family:Arial,sans-serif;"><tr><td style="background:#f8fafc;padding:12px;font-size:13px;font-weight:800;color:#111827;">Item</td><td style="background:#f8fafc;padding:12px;font-size:13px;font-weight:800;color:#111827;">Detail</td></tr><tr><td style="border-top:1px solid #e5e7eb;padding:12px;font-size:14px;color:#475569;">Label</td><td style="border-top:1px solid #e5e7eb;padding:12px;font-size:14px;color:#475569;">Value</td></tr></table>`,
  },
  {
    label: "Divider",
    icon: Minus,
    html: `<hr style="border:0;border-top:1px solid #e2e8f0;margin:28px 0;" />`,
  },
  {
    label: "Spacer",
    icon: AlignCenter,
    html: `<div data-builder-block="spacer" style="height:32px;line-height:32px;font-size:1px;">&nbsp;</div>`,
  },
  {
    label: "Social",
    icon: Plus,
    html: `<p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#64748b;"><a href="https://example.com" style="color:#7c3aed;text-decoration:none;font-weight:700;">LinkedIn</a> &nbsp; <a href="https://example.com" style="color:#7c3aed;text-decoration:none;font-weight:700;">X</a> &nbsp; <a href="https://example.com" style="color:#7c3aed;text-decoration:none;font-weight:700;">Website</a></p>`,
  },
  {
    label: "HTML",
    icon: Code2,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#475569;">Custom HTML block</div>`,
  },
  {
    label: "Video",
    icon: Film,
    html: `<a href="https://example.com/video" style="display:block;text-decoration:none;"><span style="display:block;border-radius:12px;background:#111827;padding:34px 20px;text-align:center;font-family:Arial,sans-serif;color:#ffffff;"><span style="display:inline-block;border-radius:999px;background:#ffffff;color:#111827;padding:12px 15px;font-size:16px;font-weight:800;">▶</span><span style="display:block;margin-top:14px;font-size:15px;font-weight:800;">Watch video</span></span></a>`,
  },
  {
    label: "Menu",
    icon: AlignLeft,
    html: `<p style="margin:0;text-align:center;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;"><a href="https://example.com" style="color:#475569;text-decoration:none;font-weight:700;">Home</a> &nbsp; | &nbsp; <a href="https://example.com" style="color:#475569;text-decoration:none;font-weight:700;">Features</a> &nbsp; | &nbsp; <a href="https://example.com" style="color:#475569;text-decoration:none;font-weight:700;">Support</a></p>`,
  },
];

const layoutBlocks = [
  {
    label: "Container",
    description: "Inner content frame",
    icon: LayoutTemplate,
    html: `
<div data-builder-block="container" style="resize:both;overflow:auto;width:80%;min-width:180px;min-height:74px;max-width:100%;border:1px dashed #c084fc;border-radius:10px;padding:18px;font-family:Arial,sans-serif;color:#111827;">
  <div style="font-size:15px;line-height:1.6;color:#475569;">Container content</div>
</div>`.trim(),
  },
  {
    label: "Row",
    description: "Horizontal separator",
    icon: Minus,
    html: `
<div data-builder-block="row" style="resize:both;overflow:auto;width:80%;min-width:180px;min-height:56px;max-width:100%;border-top:1px dashed #c084fc;border-bottom:1px dashed #c084fc;padding:14px 0;font-family:Arial,sans-serif;color:#111827;">
  <div style="font-size:15px;line-height:1.6;color:#475569;">Add row content here.</div>
</div>`.trim(),
  },
  {
    label: "Two columns",
    description: "50 / 50 grid",
    icon: Columns3,
    html: `
<div data-builder-block="columns-2" style="resize:both;overflow:auto;width:72%;min-width:220px;min-height:92px;max-width:100%;border:1px dashed #c084fc;padding:12px;font-family:Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" height="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td width="50%" style="border-right:1px dashed #c084fc;padding-right:12px;vertical-align:top;">
        <div style="font-size:14px;line-height:1.6;color:#475569;">Column one</div>
      </td>
      <td width="50%" style="padding-left:12px;vertical-align:top;">
        <div style="font-size:14px;line-height:1.6;color:#475569;">Column two</div>
      </td>
    </tr>
  </table>
</div>`.trim(),
  },
  {
    label: "Three columns",
    description: "Three-way grid",
    icon: Columns3,
    html: `
<div data-builder-block="columns-3" style="resize:both;overflow:auto;width:72%;min-width:260px;min-height:96px;max-width:100%;border:1px dashed #c084fc;padding:12px;font-family:Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" height="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td width="33.33%" style="border-right:1px dashed #c084fc;padding-right:8px;vertical-align:top;">
        <div style="font-size:13px;line-height:1.5;color:#475569;">Column one</div>
      </td>
      <td width="33.33%" style="border-right:1px dashed #c084fc;padding:0 8px;vertical-align:top;">
        <div style="font-size:13px;line-height:1.5;color:#475569;">Column two</div>
      </td>
      <td width="33.33%" style="padding-left:8px;vertical-align:top;">
        <div style="font-size:13px;line-height:1.5;color:#475569;">Column three</div>
      </td>
    </tr>
  </table>
</div>`.trim(),
  },
  {
    label: "Inset",
    description: "Padded separator",
    icon: LayoutTemplate,
    html: `
<div data-builder-block="inset" style="resize:both;overflow:auto;width:78%;min-width:180px;min-height:76px;max-width:100%;border:1px dashed #c084fc;background:#f8fafc;padding:20px;font-family:Arial,sans-serif;color:#111827;">
  <div style="font-size:15px;line-height:1.6;color:#475569;">Inset content</div>
</div>`.trim(),
  },
  {
    label: "Spacer",
    description: "Vertical spacing",
    icon: Minus,
    html: `<div data-builder-block="spacer" style="resize:vertical;overflow:auto;width:100%;height:28px;min-height:12px;line-height:28px;font-size:28px;border:1px dashed #c084fc;">&nbsp;</div>`,
  },
];

const predesignedSections = [
  {
    label: "Hero",
    description: "Centered lead section",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:28px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:560px;max-width:100%;background:#ffffff;border-radius:14px;padding:42px;font-family:Arial,sans-serif;color:#111827;text-align:center;">
        <tr><td style="font-size:13px;font-weight:700;color:#d946ef;text-transform:uppercase;letter-spacing:1.2px;">Trigger Mail AI</td></tr>
        <tr><td style="padding-top:16px;font-size:34px;line-height:1.12;font-weight:800;">Build email automations that feel personal</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.6;color:#475569;">Hi {{first_name}}, start with templates, triggers, and flows that adapt to each subscriber.</td></tr>
        <tr><td style="padding-top:26px;"><a href="https://example.com" style="display:inline-block;background:#d946ef;color:#ffffff;text-decoration:none;border-radius:8px;padding:13px 24px;font-size:14px;font-weight:700;">Get Started</a></td></tr>
      </table>
    </td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Announcement",
    description: "Launch update",
    icon: Mail,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:30px;font-family:Arial,sans-serif;color:#111827;">
  <tr><td style="font-size:13px;font-weight:700;color:#7c3aed;">New this week</td></tr>
  <tr><td style="padding-top:10px;font-size:26px;line-height:1.2;font-weight:800;">Your launch sequence is ready</td></tr>
  <tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#475569;">Use this section to announce a feature, campaign, product release, or important customer update.</td></tr>
</table>`.trim(),
  },
  {
    label: "Dark Hero",
    description: "High contrast opener",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#080b12;padding:34px;font-family:Arial,sans-serif;color:#ffffff;">
  <tr><td style="font-size:12px;font-weight:800;color:#f0abfc;text-transform:uppercase;letter-spacing:1.4px;">Automation launch</td></tr>
  <tr><td style="padding-top:16px;font-size:36px;line-height:1.08;font-weight:900;">Send the right message at exactly the right moment.</td></tr>
  <tr><td style="padding-top:16px;font-size:15px;line-height:1.7;color:#cbd5e1;">Use this bold lead section for launches, waitlists, onboarding, and reactivation campaigns.</td></tr>
  <tr><td style="padding-top:26px;"><a href="https://example.com" style="display:inline-block;background:#d946ef;color:#ffffff;text-decoration:none;border-radius:999px;padding:13px 24px;font-size:14px;font-weight:800;">Explore flows</a></td></tr>
</table>`.trim(),
  },
  {
    label: "Split Hero",
    description: "Copy and visual block",
    icon: Columns3,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:28px;font-family:Arial,sans-serif;color:#111827;">
  <tr>
    <td width="58%" style="padding-right:18px;vertical-align:middle;">
      <div style="font-size:12px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;">Welcome</div>
      <div style="padding-top:10px;font-size:30px;line-height:1.15;font-weight:900;">Your first workflow is ready to build.</div>
      <div style="padding-top:12px;font-size:15px;line-height:1.6;color:#475569;">Add your audience, choose a trigger, and send a personalised sequence.</div>
    </td>
    <td width="42%" style="vertical-align:middle;">
      <div style="background:#f5f3ff;border-radius:18px;padding:22px;text-align:center;color:#7c3aed;font-size:42px;">&#9993;</div>
    </td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Soft Wave",
    description: "Light wave wash",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="soft-wave" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="padding:0;">
      <div style="height:150px;background:${heroPatternWhiteFade},radial-gradient(ellipse at 16% 22%,rgba(124,58,237,0.14) 0 16%,transparent 38%),radial-gradient(ellipse at 72% 12%,rgba(217,70,239,0.13) 0 14%,transparent 34%),radial-gradient(ellipse at 48% 44%,rgba(14,165,233,0.09) 0 18%,transparent 42%),linear-gradient(180deg,#ffffff 0%,#fbf7ff 100%);">&nbsp;</div>
    </td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Dot Field",
    description: "Soft dotted background",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="dot-field" style="background:#f8fafc;font-family:Arial,sans-serif;">
  <tr>
    <td style="padding:0;">
      <div style="height:154px;background-color:#ffffff;background-image:${heroPatternWhiteFade},radial-gradient(circle,rgba(124,58,237,0.16) 1.2px,transparent 1.8px),radial-gradient(ellipse at 20% 28%,rgba(217,70,239,0.10),transparent 28%),radial-gradient(ellipse at 82% 46%,rgba(14,165,233,0.10),transparent 30%);background-size:100% 100%,22px 22px,100% 100%,100% 100%;">&nbsp;</div>
    </td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Diagonal Haze",
    description: "Soft angled shapes",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="diagonal-band" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="padding:0;">
      <div style="height:132px;background:${heroPatternWhiteFade},linear-gradient(150deg,transparent 0 22%,rgba(124,58,237,0.10) 22% 38%,transparent 38% 100%),linear-gradient(150deg,transparent 0 58%,rgba(217,70,239,0.10) 58% 72%,transparent 72% 100%),linear-gradient(180deg,#ffffff,#fbf7ff);">&nbsp;</div>
    </td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Shape Drift",
    description: "Sparse pastel shapes",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="shape-cluster" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="padding:0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;overflow:hidden;">
        <tr>
          <td style="height:154px;background:${heroPatternWhiteFade},radial-gradient(circle at 18% 30%,rgba(217,70,239,0.15) 0 10%,transparent 11%),radial-gradient(circle at 72% 24%,rgba(56,189,248,0.14) 0 8%,transparent 9%),radial-gradient(circle at 82% 62%,rgba(167,139,250,0.13) 0 12%,transparent 13%),radial-gradient(ellipse at 42% 38%,rgba(124,58,237,0.08),transparent 36%),linear-gradient(180deg,#ffffff,#fbfdff);">&nbsp;</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Mesh Glow",
    description: "Soft layered gradient",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="mesh-glow" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:164px;background:${heroPatternWhiteFade},radial-gradient(circle at 16% 30%,rgba(217,70,239,0.16),transparent 28%),radial-gradient(circle at 82% 18%,rgba(56,189,248,0.14),transparent 26%),radial-gradient(circle at 64% 66%,rgba(16,185,129,0.10),transparent 30%),linear-gradient(135deg,#ffffff,#f8fbff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Warm Glow",
    description: "Light warm shapes",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="sunrise" style="background:#fff7ed;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:164px;background:${heroPatternWhiteFade},radial-gradient(ellipse at 50% 18%,rgba(251,146,60,0.16) 0 16%,transparent 40%),radial-gradient(ellipse at 22% 42%,rgba(244,63,94,0.11) 0 12%,transparent 34%),radial-gradient(ellipse at 78% 46%,rgba(250,204,21,0.12) 0 10%,transparent 30%),linear-gradient(180deg,#ffffff 0%,#fffaf3 100%);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Light Grid",
    description: "Airy technical grid",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="blueprint-grid" style="background:#0f172a;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:154px;background-color:#ffffff;background-image:${heroPatternWhiteFade},linear-gradient(rgba(124,58,237,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.08) 1px,transparent 1px),radial-gradient(circle at 72% 34%,rgba(217,70,239,0.10),transparent 28%);background-size:100% 100%,28px 28px,28px 28px,100% 100%;">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Checker Fade",
    description: "Subtle checker pattern",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="checker-fade" style="background:#f8fafc;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:150px;background-color:#ffffff;background-image:${heroPatternWhiteFade},linear-gradient(45deg,rgba(124,58,237,0.055) 25%,transparent 25% 75%,rgba(124,58,237,0.055) 75%),linear-gradient(45deg,rgba(14,165,233,0.05) 25%,transparent 25% 75%,rgba(14,165,233,0.05) 75%),radial-gradient(ellipse at 80% 24%,rgba(217,70,239,0.10),transparent 28%);background-size:100% 100%,34px 34px,34px 34px,100% 100%;background-position:0 0,0 0,17px 17px,0 0;">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Ring Stack",
    description: "Circular contour pattern",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="ring-stack" style="background:#faf5ff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:156px;background:${heroPatternWhiteFade},radial-gradient(circle at 18% 50%,transparent 0 18px,rgba(124,58,237,0.10) 19px 21px,transparent 22px 42px,rgba(217,70,239,0.08) 43px 45px,transparent 46px),radial-gradient(circle at 74% 36%,transparent 0 22px,rgba(14,165,233,0.10) 23px 25px,transparent 26px 54px,rgba(124,58,237,0.08) 55px 57px,transparent 58px),linear-gradient(135deg,#ffffff,#fbfaff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Soft Sprinkles",
    description: "Light celebration marks",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="confetti" style="background:#111827;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:154px;background-color:#ffffff;background-image:${heroPatternWhiteFade},radial-gradient(circle at 14% 28%,rgba(244,114,182,0.28) 0 3px,transparent 4px),radial-gradient(circle at 28% 58%,rgba(56,189,248,0.24) 0 2px,transparent 3px),radial-gradient(circle at 52% 30%,rgba(167,139,250,0.26) 0 3px,transparent 4px),radial-gradient(circle at 76% 54%,rgba(52,211,153,0.20) 0 3px,transparent 4px),linear-gradient(135deg,#ffffff,#fbfdff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Soft Curve",
    description: "Subtle curved accents",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="split-curve" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:160px;background:${heroPatternWhiteFade},radial-gradient(ellipse at 76% 0%,rgba(217,70,239,0.15) 0 28%,transparent 29%),radial-gradient(ellipse at 12% 62%,rgba(56,189,248,0.12) 0 26%,transparent 27%),radial-gradient(ellipse at 52% 28%,rgba(124,58,237,0.08) 0 22%,transparent 23%),linear-gradient(135deg,#ffffff,#fbfaff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Minimal Lines",
    description: "Clean line texture",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="minimal-lines" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:142px;background-color:#ffffff;background-image:${heroPatternWhiteFade},repeating-linear-gradient(135deg,rgba(124,58,237,0.07) 0 1px,transparent 1px 18px),radial-gradient(ellipse at 76% 22%,rgba(14,165,233,0.10),transparent 30%),linear-gradient(135deg,#ffffff,#fbfaff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Corner Bloom",
    description: "Soft corner colour",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="corner-bloom" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:156px;background:${heroPatternWhiteFade},radial-gradient(ellipse at 0% 0%,rgba(124,58,237,0.18) 0 24%,transparent 46%),radial-gradient(ellipse at 100% 18%,rgba(14,165,233,0.10) 0 18%,transparent 38%),linear-gradient(180deg,#ffffff,#fffaff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Floating Pills",
    description: "Rounded pastel marks",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="floating-pills" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:158px;background:${heroPatternWhiteFade},radial-gradient(ellipse at 22% 32%,rgba(124,58,237,0.12) 0 9%,transparent 10%),radial-gradient(ellipse at 52% 18%,rgba(217,70,239,0.10) 0 12%,transparent 13%),radial-gradient(ellipse at 82% 42%,rgba(14,165,233,0.11) 0 10%,transparent 11%),radial-gradient(ellipse at 38% 62%,rgba(16,185,129,0.08) 0 8%,transparent 9%),linear-gradient(180deg,#ffffff,#fbfdff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Arc Lines",
    description: "Fine curved contours",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="arc-lines" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:154px;background:${heroPatternWhiteFade},radial-gradient(circle at 12% 18%,transparent 0 30px,rgba(124,58,237,0.09) 31px 32px,transparent 33px 64px,rgba(217,70,239,0.07) 65px 66px,transparent 67px),radial-gradient(circle at 90% 12%,transparent 0 34px,rgba(14,165,233,0.08) 35px 36px,transparent 37px 74px,rgba(124,58,237,0.06) 75px 76px,transparent 77px),linear-gradient(180deg,#ffffff,#fbfaff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Tiny Stars",
    description: "Small airy sparkle",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="tiny-stars" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:146px;background-color:#ffffff;background-image:${heroPatternWhiteFade},radial-gradient(circle at 16% 24%,rgba(124,58,237,0.20) 0 2px,transparent 3px),radial-gradient(circle at 34% 44%,rgba(217,70,239,0.16) 0 1.5px,transparent 2.5px),radial-gradient(circle at 62% 20%,rgba(14,165,233,0.18) 0 2px,transparent 3px),radial-gradient(circle at 84% 50%,rgba(16,185,129,0.14) 0 1.5px,transparent 2.5px),linear-gradient(180deg,#ffffff,#fbfdff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Paper Grain",
    description: "Quiet textured wash",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="paper-grain" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:150px;background-color:#ffffff;background-image:${heroPatternWhiteFade},radial-gradient(circle,rgba(124,58,237,0.07) 0 1px,transparent 1.5px),radial-gradient(circle,rgba(14,165,233,0.05) 0 1px,transparent 1.5px),radial-gradient(ellipse at 74% 18%,rgba(217,70,239,0.09),transparent 30%);background-size:100% 100%,16px 16px,22px 22px,100% 100%;background-position:0 0,0 0,8px 10px,0 0;">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Ribbon Mist",
    description: "Thin sweeping ribbons",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="ribbon-mist" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:156px;background:${heroPatternWhiteFade},linear-gradient(165deg,transparent 0 24%,rgba(124,58,237,0.09) 24% 30%,transparent 30% 100%),linear-gradient(168deg,transparent 0 44%,rgba(217,70,239,0.08) 44% 49%,transparent 49% 100%),linear-gradient(160deg,transparent 0 68%,rgba(14,165,233,0.07) 68% 73%,transparent 73% 100%),linear-gradient(180deg,#ffffff,#fbfaff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Pebble Field",
    description: "Organic pale pebbles",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="pebble-field" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:158px;background:${heroPatternWhiteFade},radial-gradient(ellipse at 18% 22%,rgba(124,58,237,0.12) 0 8%,transparent 9%),radial-gradient(ellipse at 40% 46%,rgba(14,165,233,0.09) 0 7%,transparent 8%),radial-gradient(ellipse at 66% 26%,rgba(217,70,239,0.10) 0 9%,transparent 10%),radial-gradient(ellipse at 88% 54%,rgba(16,185,129,0.08) 0 7%,transparent 8%),linear-gradient(180deg,#ffffff,#fbfdff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Soft Horizon",
    description: "Gentle upper glow",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="soft-horizon" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:148px;background:${heroPatternWhiteFade},radial-gradient(ellipse at 50% 0%,rgba(124,58,237,0.14) 0 24%,transparent 54%),radial-gradient(ellipse at 82% 10%,rgba(14,165,233,0.10) 0 16%,transparent 36%),linear-gradient(180deg,#ffffff,#fbfaff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Offset Grid",
    description: "Light broken grid",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="offset-grid" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:154px;background-color:#ffffff;background-image:${heroPatternWhiteFade},linear-gradient(rgba(124,58,237,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(14,165,233,0.055) 1px,transparent 1px),radial-gradient(ellipse at 18% 24%,rgba(217,70,239,0.08),transparent 28%);background-size:100% 100%,32px 32px,46px 46px,100% 100%;background-position:0 0,0 0,14px 10px,0 0;">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Orb Pair",
    description: "Two soft focal shapes",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="orb-pair" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:160px;background:${heroPatternWhiteFade},radial-gradient(circle at 24% 30%,rgba(124,58,237,0.16) 0 16%,transparent 34%),radial-gradient(circle at 76% 32%,rgba(14,165,233,0.12) 0 14%,transparent 32%),radial-gradient(ellipse at 50% 50%,rgba(217,70,239,0.06),transparent 42%),linear-gradient(180deg,#ffffff,#fbfdff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Calm Chevrons",
    description: "Very light direction marks",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="calm-chevrons" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:150px;background-color:#ffffff;background-image:${heroPatternWhiteFade},linear-gradient(135deg,rgba(124,58,237,0.07) 25%,transparent 25% 75%,rgba(124,58,237,0.07) 75%),linear-gradient(225deg,rgba(14,165,233,0.055) 25%,transparent 25% 75%,rgba(14,165,233,0.055) 75%),radial-gradient(ellipse at 78% 20%,rgba(217,70,239,0.08),transparent 28%);background-size:100% 100%,42px 42px,42px 42px,100% 100%;background-position:0 0,0 0,21px 0,0 0;">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Cloud Bands",
    description: "Layered pale clouds",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="cloud-bands" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:162px;background:${heroPatternWhiteFade},radial-gradient(ellipse at 12% 28%,rgba(124,58,237,0.10) 0 14%,transparent 36%),radial-gradient(ellipse at 42% 16%,rgba(217,70,239,0.09) 0 16%,transparent 38%),radial-gradient(ellipse at 78% 30%,rgba(14,165,233,0.10) 0 18%,transparent 40%),radial-gradient(ellipse at 60% 58%,rgba(255,255,255,0.78),transparent 44%),linear-gradient(180deg,#ffffff,#fbfaff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Studio Wash",
    description: "Premium soft colour wash",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="studio-wash" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:170px;background:${heroPatternWhiteFade},radial-gradient(ellipse at 18% 18%,rgba(124,58,237,0.15) 0 18%,transparent 42%),radial-gradient(ellipse at 88% 20%,rgba(236,72,153,0.11) 0 18%,transparent 42%),radial-gradient(ellipse at 56% 34%,rgba(14,165,233,0.10) 0 16%,transparent 40%),linear-gradient(180deg,#ffffff 0%,#fbf8ff 100%);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Layered Petals",
    description: "Elegant overlapping shapes",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="layered-petals" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:166px;background:${heroPatternWhiteFade},radial-gradient(ellipse at 26% 24%,rgba(167,139,250,0.15) 0 13%,transparent 14%),radial-gradient(ellipse at 34% 28%,rgba(217,70,239,0.10) 0 14%,transparent 15%),radial-gradient(ellipse at 72% 30%,rgba(56,189,248,0.11) 0 13%,transparent 14%),radial-gradient(ellipse at 78% 36%,rgba(16,185,129,0.08) 0 12%,transparent 13%),linear-gradient(180deg,#ffffff,#fbfdff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Halo Corners",
    description: "Subtle corner balance",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="halo-corners" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:162px;background:${heroPatternWhiteFade},radial-gradient(circle at 8% 8%,rgba(124,58,237,0.15) 0 18%,transparent 40%),radial-gradient(circle at 92% 8%,rgba(14,165,233,0.12) 0 16%,transparent 38%),radial-gradient(ellipse at 50% 24%,rgba(217,70,239,0.06),transparent 46%),linear-gradient(180deg,#ffffff,#fcfbff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Editorial Arcs",
    description: "Magazine-style fine arcs",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="editorial-arcs" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:164px;background:${heroPatternWhiteFade},radial-gradient(circle at 22% 6%,transparent 0 44px,rgba(124,58,237,0.12) 45px 46px,transparent 47px 88px,rgba(217,70,239,0.08) 89px 90px,transparent 91px),radial-gradient(circle at 82% 2%,transparent 0 38px,rgba(14,165,233,0.10) 39px 40px,transparent 41px 82px,rgba(124,58,237,0.07) 83px 84px,transparent 85px),linear-gradient(180deg,#ffffff,#fbfaff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Frosted Tiles",
    description: "Soft tile hints",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="frosted-tiles" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:160px;background-color:#ffffff;background-image:${heroPatternWhiteFade},linear-gradient(90deg,rgba(124,58,237,0.06) 1px,transparent 1px),linear-gradient(rgba(14,165,233,0.05) 1px,transparent 1px),radial-gradient(ellipse at 72% 18%,rgba(217,70,239,0.09),transparent 34%);background-size:100% 100%,52px 52px,52px 52px,100% 100%;">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Pastel Sweep",
    description: "Clean sweeping movement",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="pastel-sweep" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:168px;background:${heroPatternWhiteFade},linear-gradient(155deg,transparent 0 20%,rgba(124,58,237,0.11) 20% 29%,transparent 29% 100%),linear-gradient(158deg,transparent 0 42%,rgba(236,72,153,0.09) 42% 49%,transparent 49% 100%),linear-gradient(162deg,transparent 0 63%,rgba(14,165,233,0.08) 63% 70%,transparent 70% 100%),linear-gradient(180deg,#ffffff,#fcfbff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Signal Dots",
    description: "Refined data-dot field",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="signal-dots" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:158px;background-color:#ffffff;background-image:${heroPatternWhiteFade},radial-gradient(circle,rgba(124,58,237,0.12) 1px,transparent 1.7px),radial-gradient(circle,rgba(14,165,233,0.08) 1px,transparent 1.7px),radial-gradient(ellipse at 20% 20%,rgba(217,70,239,0.08),transparent 28%);background-size:100% 100%,26px 26px,38px 38px,100% 100%;background-position:0 0,0 0,13px 11px,0 0;">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Glass Loops",
    description: "Translucent loop forms",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="glass-loops" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:166px;background:${heroPatternWhiteFade},radial-gradient(circle at 24% 30%,transparent 0 22px,rgba(124,58,237,0.11) 23px 32px,transparent 33px),radial-gradient(circle at 54% 18%,transparent 0 18px,rgba(217,70,239,0.09) 19px 28px,transparent 29px),radial-gradient(circle at 80% 38%,transparent 0 24px,rgba(14,165,233,0.09) 25px 34px,transparent 35px),linear-gradient(180deg,#ffffff,#fbfdff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Luxe Mist",
    description: "Warm luxury softness",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="luxe-mist" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:166px;background:${heroPatternWhiteFade},radial-gradient(ellipse at 20% 18%,rgba(251,191,36,0.13) 0 16%,transparent 40%),radial-gradient(ellipse at 76% 22%,rgba(244,114,182,0.10) 0 16%,transparent 38%),radial-gradient(ellipse at 54% 42%,rgba(167,139,250,0.08) 0 18%,transparent 42%),linear-gradient(180deg,#ffffff,#fffdf8);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Airy Blueprint",
    description: "Clean SaaS blueprint",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="airy-blueprint" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:164px;background-color:#ffffff;background-image:${heroPatternWhiteFade},linear-gradient(rgba(14,165,233,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.055) 1px,transparent 1px),radial-gradient(circle at 22% 28%,transparent 0 18px,rgba(124,58,237,0.09) 19px 20px,transparent 21px),radial-gradient(ellipse at 82% 16%,rgba(14,165,233,0.08),transparent 28%);background-size:100% 100%,34px 34px,34px 34px,100% 100%,100% 100%;">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Gentle Scatter",
    description: "Sparse polished accents",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="gentle-scatter" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:158px;background:${heroPatternWhiteFade},radial-gradient(circle at 14% 24%,rgba(124,58,237,0.16) 0 5px,transparent 6px),radial-gradient(circle at 34% 16%,rgba(14,165,233,0.12) 0 4px,transparent 5px),radial-gradient(circle at 62% 32%,rgba(217,70,239,0.13) 0 6px,transparent 7px),radial-gradient(circle at 84% 18%,rgba(16,185,129,0.10) 0 4px,transparent 5px),linear-gradient(180deg,#ffffff,#fbfdff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Soft Topography",
    description: "Premium contour texture",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="soft-topography" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:166px;background:${heroPatternWhiteFade},radial-gradient(circle at 18% 18%,transparent 0 20px,rgba(124,58,237,0.075) 21px 22px,transparent 23px 44px,rgba(124,58,237,0.055) 45px 46px,transparent 47px 70px),radial-gradient(circle at 76% 24%,transparent 0 22px,rgba(14,165,233,0.07) 23px 24px,transparent 25px 50px,rgba(217,70,239,0.055) 51px 52px,transparent 53px 78px),linear-gradient(180deg,#ffffff,#fcfbff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Quiet Prism",
    description: "Subtle angular prism",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="quiet-prism" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:160px;background:${heroPatternWhiteFade},linear-gradient(135deg,rgba(124,58,237,0.10) 0 13%,transparent 13% 100%),linear-gradient(225deg,rgba(14,165,233,0.08) 0 12%,transparent 12% 100%),linear-gradient(40deg,transparent 0 62%,rgba(217,70,239,0.07) 62% 72%,transparent 72% 100%),linear-gradient(180deg,#ffffff,#fbfdff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Hero Pearl Gradient",
    description: "Barely-there pearl wash",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-hero-pattern="pearl-gradient" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:168px;background:${heroPatternWhiteFade},radial-gradient(ellipse at 30% 16%,rgba(226,232,240,0.72) 0 18%,transparent 40%),radial-gradient(ellipse at 70% 20%,rgba(243,232,255,0.72) 0 16%,transparent 38%),radial-gradient(ellipse at 50% 44%,rgba(224,242,254,0.56) 0 20%,transparent 44%),linear-gradient(180deg,#ffffff,#ffffff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Footer Studio Fade",
    description: "Soft closing wash",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-footer-pattern="studio-fade" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:138px;background:${footerPatternWhiteFade},radial-gradient(ellipse at 18% 82%,rgba(124,58,237,0.14) 0 18%,transparent 42%),radial-gradient(ellipse at 86% 74%,rgba(14,165,233,0.11) 0 16%,transparent 38%),linear-gradient(180deg,#ffffff,#fbf8ff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Footer Pearl Lift",
    description: "Barely-there pearl base",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-footer-pattern="pearl-lift" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:132px;background:${footerPatternWhiteFade},radial-gradient(ellipse at 34% 86%,rgba(243,232,255,0.72) 0 18%,transparent 42%),radial-gradient(ellipse at 76% 80%,rgba(224,242,254,0.58) 0 16%,transparent 38%),linear-gradient(180deg,#ffffff,#ffffff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Footer Arc Close",
    description: "Fine contour footer",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-footer-pattern="arc-close" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:140px;background:${footerPatternWhiteFade},radial-gradient(circle at 22% 100%,transparent 0 34px,rgba(124,58,237,0.10) 35px 36px,transparent 37px 74px,rgba(217,70,239,0.07) 75px 76px,transparent 77px),radial-gradient(circle at 84% 96%,transparent 0 28px,rgba(14,165,233,0.09) 29px 30px,transparent 31px 64px,rgba(124,58,237,0.06) 65px 66px,transparent 67px),linear-gradient(180deg,#ffffff,#fbfaff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Footer Quiet Grid",
    description: "Light technical base",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-footer-pattern="quiet-grid" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:136px;background-color:#ffffff;background-image:${footerPatternWhiteFade},linear-gradient(rgba(124,58,237,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(14,165,233,0.05) 1px,transparent 1px),radial-gradient(ellipse at 78% 78%,rgba(217,70,239,0.08),transparent 30%);background-size:100% 100%,34px 34px,34px 34px,100% 100%;">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Footer Soft Curve",
    description: "Elegant curved base",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-footer-pattern="soft-curve" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:142px;background:${footerPatternWhiteFade},radial-gradient(ellipse at 78% 100%,rgba(217,70,239,0.13) 0 28%,transparent 29%),radial-gradient(ellipse at 12% 88%,rgba(56,189,248,0.10) 0 24%,transparent 25%),linear-gradient(180deg,#ffffff,#fbfaff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Footer Luxe Mist",
    description: "Warm soft ending",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-footer-pattern="luxe-mist" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:140px;background:${footerPatternWhiteFade},radial-gradient(ellipse at 20% 78%,rgba(251,191,36,0.12) 0 16%,transparent 38%),radial-gradient(ellipse at 76% 82%,rgba(244,114,182,0.10) 0 16%,transparent 38%),radial-gradient(ellipse at 54% 70%,rgba(167,139,250,0.07) 0 18%,transparent 42%),linear-gradient(180deg,#ffffff,#fffdf8);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Footer Signal Dots",
    description: "Refined lower dot field",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-footer-pattern="signal-dots" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:132px;background-color:#ffffff;background-image:${footerPatternWhiteFade},radial-gradient(circle,rgba(124,58,237,0.11) 1px,transparent 1.7px),radial-gradient(circle,rgba(14,165,233,0.075) 1px,transparent 1.7px),radial-gradient(ellipse at 26% 76%,rgba(217,70,239,0.08),transparent 28%);background-size:100% 100%,26px 26px,38px 38px,100% 100%;background-position:0 0,0 0,13px 11px,0 0;">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Footer Glass Loops",
    description: "Translucent bottom loops",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-footer-pattern="glass-loops" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:142px;background:${footerPatternWhiteFade},radial-gradient(circle at 24% 82%,transparent 0 20px,rgba(124,58,237,0.10) 21px 30px,transparent 31px),radial-gradient(circle at 56% 90%,transparent 0 18px,rgba(217,70,239,0.08) 19px 28px,transparent 29px),radial-gradient(circle at 82% 78%,transparent 0 22px,rgba(14,165,233,0.08) 23px 32px,transparent 33px),linear-gradient(180deg,#ffffff,#fbfdff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Footer Ribbon Close",
    description: "Thin sweeping footer",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-footer-pattern="ribbon-close" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:136px;background:${footerPatternWhiteFade},linear-gradient(20deg,transparent 0 30%,rgba(124,58,237,0.09) 30% 36%,transparent 36% 100%),linear-gradient(16deg,transparent 0 54%,rgba(217,70,239,0.08) 54% 60%,transparent 60% 100%),linear-gradient(24deg,transparent 0 72%,rgba(14,165,233,0.07) 72% 78%,transparent 78% 100%),linear-gradient(180deg,#ffffff,#fbfaff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Footer Calm Pebbles",
    description: "Organic pale base shapes",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-footer-pattern="calm-pebbles" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:140px;background:${footerPatternWhiteFade},radial-gradient(ellipse at 18% 78%,rgba(124,58,237,0.11) 0 8%,transparent 9%),radial-gradient(ellipse at 42% 88%,rgba(14,165,233,0.09) 0 7%,transparent 8%),radial-gradient(ellipse at 70% 76%,rgba(217,70,239,0.10) 0 9%,transparent 10%),radial-gradient(ellipse at 90% 92%,rgba(16,185,129,0.08) 0 7%,transparent 8%),linear-gradient(180deg,#ffffff,#fbfdff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Footer Gentle Scatter",
    description: "Sparse lower accents",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-footer-pattern="gentle-scatter" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:134px;background:${footerPatternWhiteFade},radial-gradient(circle at 14% 76%,rgba(124,58,237,0.15) 0 5px,transparent 6px),radial-gradient(circle at 34% 88%,rgba(14,165,233,0.11) 0 4px,transparent 5px),radial-gradient(circle at 62% 72%,rgba(217,70,239,0.12) 0 6px,transparent 7px),radial-gradient(circle at 84% 84%,rgba(16,185,129,0.10) 0 4px,transparent 5px),linear-gradient(180deg,#ffffff,#fbfdff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Footer Quiet Prism",
    description: "Subtle angular close",
    icon: LayoutTemplate,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" data-builder-footer-pattern="quiet-prism" style="background:#ffffff;font-family:Arial,sans-serif;">
  <tr>
    <td style="height:138px;background:${footerPatternWhiteFade},linear-gradient(45deg,rgba(124,58,237,0.09) 0 13%,transparent 13% 100%),linear-gradient(315deg,rgba(14,165,233,0.075) 0 12%,transparent 12% 100%),linear-gradient(140deg,transparent 0 62%,rgba(217,70,239,0.065) 62% 72%,transparent 72% 100%),linear-gradient(180deg,#ffffff,#fbfdff);">&nbsp;</td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Payment Confirmation",
    description: "Receipt style update",
    icon: Mail,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:30px;font-family:Arial,sans-serif;color:#111827;">
  <tr><td style="font-size:24px;font-weight:900;">Payment received</td></tr>
  <tr><td style="padding-top:10px;font-size:15px;line-height:1.6;color:#475569;">Hi {{first_name}}, thanks for your payment. Your account has been updated.</td></tr>
  <tr><td style="padding-top:18px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:12px;padding:16px;">
      <tr><td style="font-size:13px;color:#64748b;">Amount</td><td align="right" style="font-size:13px;font-weight:800;">{{amount}}</td></tr>
      <tr><td style="padding-top:8px;font-size:13px;color:#64748b;">Reference</td><td align="right" style="padding-top:8px;font-size:13px;font-weight:800;">{{reference}}</td></tr>
    </table>
  </td></tr>
</table>`.trim(),
  },
  {
    label: "Trial Reminder",
    description: "Urgency notice",
    icon: Mail,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff7ed;padding:28px;font-family:Arial,sans-serif;color:#111827;">
  <tr><td style="font-size:13px;font-weight:800;color:#ea580c;">Trial update</td></tr>
  <tr><td style="padding-top:10px;font-size:27px;line-height:1.2;font-weight:900;">Your trial ends soon</td></tr>
  <tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#475569;">Keep your templates, flows, and analytics active by choosing a plan before {{trial_end_date}}.</td></tr>
  <tr><td style="padding-top:20px;"><a href="https://example.com" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 20px;font-size:14px;font-weight:800;">Choose plan</a></td></tr>
</table>`.trim(),
  },
  {
    label: "Feature Pair",
    description: "Two column benefits",
    icon: Columns3,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:28px;font-family:Arial,sans-serif;color:#111827;">
  <tr>
    <td width="50%" style="padding-right:12px;vertical-align:top;">
      <div style="font-size:22px;">&#9889;</div>
      <div style="padding-top:10px;font-size:17px;font-weight:800;">Trigger instantly</div>
      <div style="padding-top:8px;font-size:14px;line-height:1.6;color:#475569;">Start flows from forms, webhooks, mailhooks, or scheduled events.</div>
    </td>
    <td width="50%" style="padding-left:12px;vertical-align:top;">
      <div style="font-size:22px;">&#9993;</div>
      <div style="padding-top:10px;font-size:17px;font-weight:800;">Send smarter</div>
      <div style="padding-top:8px;font-size:14px;line-height:1.6;color:#475569;">Personalise your message with variables and reusable templates.</div>
    </td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Product Card",
    description: "Image and CTA",
    icon: ImageIcon,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:28px;font-family:Arial,sans-serif;color:#111827;">
  <tr><td><img src="https://placehold.co/560x260/f4e8ff/7c3aed?text=Trigger+Mail+AI" alt="" width="560" style="display:block;width:100%;max-width:560px;border-radius:12px;" /></td></tr>
  <tr><td style="padding-top:18px;font-size:24px;line-height:1.2;font-weight:800;">Featured workflow</td></tr>
  <tr><td style="padding-top:10px;font-size:15px;line-height:1.6;color:#475569;">Showcase a template, offer, event, or new automation your audience should explore.</td></tr>
  <tr><td style="padding-top:20px;"><a href="https://example.com" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 20px;font-size:14px;font-weight:700;">View details</a></td></tr>
</table>`.trim(),
  },
  {
    label: "Article Teaser",
    description: "Editorial preview",
    icon: Type,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:28px;font-family:Arial,sans-serif;color:#111827;">
  <tr><td style="font-size:12px;font-weight:800;color:#d946ef;text-transform:uppercase;letter-spacing:1px;">Guide</td></tr>
  <tr><td style="padding-top:10px;font-size:26px;line-height:1.2;font-weight:900;">How to build a welcome series that converts</td></tr>
  <tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#475569;">Share an article, resource, or playbook with a concise summary and a simple next step.</td></tr>
  <tr><td style="padding-top:18px;"><a href="https://example.com" style="color:#7c3aed;font-size:14px;font-weight:800;text-decoration:none;">Read the guide &rarr;</a></td></tr>
</table>`.trim(),
  },
  {
    label: "Stats Row",
    description: "Three metrics",
    icon: Columns3,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;padding:28px;font-family:Arial,sans-serif;color:#ffffff;text-align:center;">
  <tr>
    <td width="33.33%" style="vertical-align:top;"><div style="font-size:28px;font-weight:900;color:#f0abfc;">42%</div><div style="padding-top:6px;font-size:12px;color:#cbd5e1;">Open rate</div></td>
    <td width="33.33%" style="vertical-align:top;"><div style="font-size:28px;font-weight:900;color:#f0abfc;">18k</div><div style="padding-top:6px;font-size:12px;color:#cbd5e1;">Emails sent</div></td>
    <td width="33.33%" style="vertical-align:top;"><div style="font-size:28px;font-weight:900;color:#f0abfc;">24</div><div style="padding-top:6px;font-size:12px;color:#cbd5e1;">Active flows</div></td>
  </tr>
</table>`.trim(),
  },
  {
    label: "Checklist",
    description: "Action list",
    icon: Type,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:28px;font-family:Arial,sans-serif;color:#111827;">
  <tr><td style="font-size:24px;font-weight:900;">Before you launch</td></tr>
  <tr><td style="padding-top:14px;font-size:15px;line-height:1.9;color:#475569;">&#10003; Confirm your audience<br />&#10003; Check personalisation variables<br />&#10003; Send yourself a test email</td></tr>
</table>`.trim(),
  },
  {
    label: "Event Invite",
    description: "Webinar or launch",
    icon: Mail,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:28px;font-family:Arial,sans-serif;color:#111827;">
  <tr><td style="font-size:13px;font-weight:800;color:#7c3aed;">Live session</td></tr>
  <tr><td style="padding-top:10px;font-size:28px;line-height:1.2;font-weight:900;">Join us on {{event_date}}</td></tr>
  <tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#475569;">Invite subscribers to a webinar, demo, launch, or customer event with one clear CTA.</td></tr>
  <tr><td style="padding-top:20px;"><a href="https://example.com" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 20px;font-size:14px;font-weight:800;">Reserve your spot</a></td></tr>
</table>`.trim(),
  },
  {
    label: "Quote",
    description: "Social proof",
    icon: Type,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:30px;font-family:Arial,sans-serif;color:#111827;">
  <tr><td style="font-size:24px;line-height:1.45;font-weight:700;">"Trigger Mail AI helped us turn our manual follow-ups into a simple automated journey."</td></tr>
  <tr><td style="padding-top:18px;font-size:14px;color:#475569;">Alex Morgan, Growth Lead</td></tr>
</table>`.trim(),
  },
  {
    label: "Testimonial Card",
    description: "Customer story",
    icon: Type,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:28px;font-family:Arial,sans-serif;color:#111827;">
  <tr><td style="background:#f5f3ff;border-left:4px solid #a855f7;border-radius:12px;padding:22px;">
    <div style="font-size:20px;line-height:1.45;font-weight:800;">"We built our onboarding journey in an afternoon and improved follow-up quality immediately."</div>
    <div style="padding-top:14px;font-size:13px;color:#64748b;">Maya Patel, Customer Success</div>
  </td></tr>
</table>`.trim(),
  },
  {
    label: "Logo Strip",
    description: "Brand proof row",
    icon: Columns3,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#111827;text-align:center;">
  <tr><td style="font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Trusted by teams like</td></tr>
  <tr><td style="padding-top:16px;color:#334155;font-size:14px;font-weight:900;">ACME &nbsp;&nbsp; BUILDERLY &nbsp;&nbsp; NORTHSTAR &nbsp;&nbsp; LUMEN</td></tr>
</table>`.trim(),
  },
  {
    label: "CTA Band",
    description: "Button section",
    icon: MousePointerClick,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#4c1d95;padding:32px;font-family:Arial,sans-serif;color:#ffffff;text-align:center;">
  <tr><td style="font-size:26px;line-height:1.2;font-weight:800;">Ready to build your next flow?</td></tr>
  <tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#ede9fe;">Create a template, connect a trigger, and launch your automation.</td></tr>
  <tr><td style="padding-top:22px;"><a href="https://example.com" style="display:inline-block;background:#ffffff;color:#4c1d95;text-decoration:none;border-radius:8px;padding:12px 22px;font-size:14px;font-weight:800;">Start now</a></td></tr>
</table>`.trim(),
  },
  {
    label: "Coupon Offer",
    description: "Promo code",
    icon: MousePointerClick,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ecfeff;padding:30px;font-family:Arial,sans-serif;color:#111827;text-align:center;">
  <tr><td style="font-size:13px;font-weight:800;color:#0891b2;">Limited offer</td></tr>
  <tr><td style="padding-top:8px;font-size:30px;font-weight:900;">Save 20% this week</td></tr>
  <tr><td style="padding-top:14px;"><span style="display:inline-block;border:1px dashed #0891b2;border-radius:8px;background:#ffffff;padding:10px 18px;font-size:18px;font-weight:900;color:#0e7490;">WELCOME20</span></td></tr>
  <tr><td style="padding-top:20px;"><a href="https://example.com" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 22px;font-size:14px;font-weight:800;">Use offer</a></td></tr>
</table>`.trim(),
  },
  {
    label: "Survey Ask",
    description: "Feedback CTA",
    icon: MousePointerClick,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:28px;font-family:Arial,sans-serif;color:#111827;text-align:center;">
  <tr><td style="font-size:25px;font-weight:900;">How did we do?</td></tr>
  <tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#475569;">Ask for quick feedback after a purchase, support interaction, or onboarding step.</td></tr>
  <tr><td style="padding-top:20px;"><a href="https://example.com" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 22px;font-size:14px;font-weight:800;">Share feedback</a></td></tr>
</table>`.trim(),
  },
  {
    label: "Minimal Footer",
    description: "Simple footer",
    icon: Minus,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:24px;font-family:Arial,sans-serif;color:#64748b;text-align:center;">
  <tr><td style="font-size:13px;line-height:1.6;">Trigger Mail AI, 1 Automation Street, London</td></tr>
  <tr><td style="padding-top:10px;font-size:12px;"><a href="https://example.com" style="color:#7c3aed;text-decoration:none;">Unsubscribe</a> &nbsp;|&nbsp; <a href="https://example.com" style="color:#7c3aed;text-decoration:none;">Preferences</a></td></tr>
</table>`.trim(),
  },
  {
    label: "Legal Footer",
    description: "Detailed compliance",
    icon: Minus,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:26px;font-family:Arial,sans-serif;color:#475569;text-align:left;">
  <tr><td style="font-size:13px;line-height:1.6;">You are receiving this because you opted in to updates from Trigger Mail AI. This message was sent to {{email}}.</td></tr>
  <tr><td style="padding-top:12px;font-size:12px;color:#64748b;">Trigger Mail AI Ltd. Manage preferences or unsubscribe at any time.</td></tr>
</table>`.trim(),
  },
  {
    label: "Footer",
    description: "Brand footer",
    icon: Minus,
    html: `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;padding:26px;font-family:Arial,sans-serif;color:#cbd5e1;text-align:center;">
  <tr><td style="font-size:15px;font-weight:800;color:#ffffff;">Trigger Mail AI</td></tr>
  <tr><td style="padding-top:10px;font-size:13px;line-height:1.6;">You are receiving this email because you signed up for updates.</td></tr>
  <tr><td style="padding-top:12px;font-size:12px;color:#94a3b8;">Unsubscribe | Manage preferences</td></tr>
</table>`.trim(),
  },
];

const sectionCategories: SectionCategory[] = [
  {
    id: "hero",
    label: "Hero sections",
    description: "Opening sections and lead messages",
    icon: LayoutTemplate,
    examples: ["Hero", "Dark Hero", "Split Hero", "Announcement", "Payment Confirmation", "Trial Reminder"],
  },
  {
    id: "hero-patterns",
    label: "Hero patterns",
    description: "Decorative patterns and shape sections for the top of the body",
    icon: LayoutTemplate,
    examples: ["Hero Studio Wash", "Hero Layered Petals", "Hero Halo Corners", "Hero Editorial Arcs", "Hero Frosted Tiles", "Hero Pastel Sweep", "Hero Signal Dots", "Hero Glass Loops", "Hero Luxe Mist", "Hero Airy Blueprint", "Hero Gentle Scatter", "Hero Soft Topography", "Hero Quiet Prism", "Hero Pearl Gradient", "Hero Soft Wave", "Hero Dot Field", "Hero Diagonal Haze", "Hero Shape Drift", "Hero Mesh Glow", "Hero Warm Glow", "Hero Light Grid", "Hero Ring Stack", "Hero Soft Curve", "Hero Cloud Bands", "Hero Corner Bloom", "Hero Floating Pills", "Hero Arc Lines", "Hero Ribbon Mist", "Hero Pebble Field", "Hero Soft Horizon", "Hero Orb Pair", "Hero Minimal Lines"],
  },
  {
    id: "footer-patterns",
    label: "Footer patterns",
    description: "Decorative shape sections for the bottom inside the body",
    icon: LayoutTemplate,
    examples: ["Footer Studio Fade", "Footer Pearl Lift", "Footer Arc Close", "Footer Quiet Grid", "Footer Soft Curve", "Footer Luxe Mist", "Footer Signal Dots", "Footer Glass Loops", "Footer Ribbon Close", "Footer Calm Pebbles", "Footer Gentle Scatter", "Footer Quiet Prism"],
  },
  {
    id: "content",
    label: "Content blocks",
    description: "Feature, product, and update layouts",
    icon: Columns3,
    examples: ["Feature Pair", "Product Card", "Article Teaser", "Stats Row", "Checklist", "Event Invite"],
  },
  {
    id: "proof",
    label: "Trust and proof",
    description: "Quotes and customer proof points",
    icon: Type,
    examples: ["Quote", "Testimonial Card", "Logo Strip"],
  },
  {
    id: "conversion",
    label: "Conversion",
    description: "CTA and action-focused sections",
    icon: MousePointerClick,
    examples: ["CTA Band", "Coupon Offer", "Survey Ask"],
  },
  {
    id: "footer",
    label: "Footers",
    description: "Compliance, preferences, and brand endings",
    icon: Minus,
    examples: ["Footer", "Minimal Footer", "Legal Footer"],
  },
];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const record = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [record.message, record.details, record.hint, record.code].filter(Boolean).map(String).join(" ");
  }

  return fallback;
}

function buildPreviewDocument(html: string, preheader: string, customHead = "") {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; background: #eef2ff; }
      img { max-width: 100%; height: auto; }
    </style>
    ${customHead}
  </head>
  <body>
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
    ${html}
  </body>
</html>`;
}

function buildMiniPreviewDocument(html: string, preheader: string, customHead = "", scale = 0.34) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #eef2ff; }
      img { max-width: 100%; height: auto; }
      .preview-stage { width: 100%; height: 100%; display: flex; justify-content: center; align-items: flex-start; overflow: hidden; box-sizing: border-box; padding-top: 12px; }
      .preview-scale { width: 720px; flex: 0 0 720px; transform: scale(${scale}); transform-origin: top center; }
    </style>
    ${customHead}
  </head>
  <body>
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
    <div class="preview-stage">
      <div class="preview-scale">${html}</div>
    </div>
  </body>
</html>`;
}

function createSection(label: string, html: string): EmailSection {
  return {
    id: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    html,
  };
}

function createStarterLayoutSections(layout: (typeof starterLayouts)[StarterLayoutId]) {
  if ("sections" in layout) {
    return layout.sections.map((section) => createSection(section.label, section.html));
  }

  return [createSection(layout.name, prepareWholeEmailTemplateHtml(layout.html))];
}

function joinSections(sections: EmailSection[]) {
  return sections.map((section) => section.html.trim()).filter(Boolean).join("\n\n");
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(text: string) {
  return escapeHtml(text).replace(/'/g, "&#39;");
}

const persistableTextStyleProperties = [
  "color",
  "font-size",
  "font-weight",
  "font-style",
  "font-family",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-decoration",
  "text-transform",
  "background",
  "background-color",
  "background-image",
  "background-clip",
  "-webkit-background-clip",
  "-webkit-text-fill-color",
  "display",
];

function getPersistableTextStyle(element: HTMLElement) {
  return persistableTextStyleProperties
    .map((property) => {
      const value = element.style.getPropertyValue(property);
      return value ? `${property}:${value}` : "";
    })
    .filter(Boolean)
    .join(";");
}

function getTemplateDesignHead(design: EmailTemplate["design"]) {
  if (design && typeof design === "object" && !Array.isArray(design) && "customHead" in design) {
    const customHead = (design as { customHead?: unknown }).customHead;
    return typeof customHead === "string" ? customHead : "";
  }

  return "";
}

function getTemplateDesignAiMessages(design: EmailTemplate["design"]) {
  if (design && typeof design === "object" && !Array.isArray(design) && "aiMessages" in design) {
    const aiMessages = (design as { aiMessages?: unknown }).aiMessages;

    if (Array.isArray(aiMessages)) {
      const parsedMessages = aiMessages.filter((message): message is AiMessage => {
        if (!message || typeof message !== "object") {
          return false;
        }

        const record = message as { role?: unknown; content?: unknown };
        return (record.role === "assistant" || record.role === "user") && typeof record.content === "string";
      });

      if (parsedMessages.length > 0) {
        return parsedMessages.slice(-80);
      }
    }
  }

  return initialAiMessages;
}

function getTemplateDesignGlobalStyles(design: EmailTemplate["design"]) {
  const defaults = {
    globalBackground: "#111827",
    globalBackgroundPattern: "none",
    globalBackgroundCanvas: "plain",
    previewPadding: 20,
    emailWidth: 760,
    emailBorderRadius: 10,
    emailBoxShadow: defaultEmailBoxShadow,
    bodyTextInsetLeft: 0,
    bodyTextInsetRight: 0,
    bodyContentMargin: 0,
    bodyTextSize: 15,
    bodyTextColor: "#475569",
  };

  if (!design || typeof design !== "object" || Array.isArray(design) || !("globalStyles" in design)) {
    return defaults;
  }

  const globalStyles = (design as { globalStyles?: unknown }).globalStyles;

  if (!globalStyles || typeof globalStyles !== "object" || Array.isArray(globalStyles)) {
    return defaults;
  }

  const record = globalStyles as Partial<Record<keyof typeof defaults, unknown>>;

  return {
    globalBackground: typeof record.globalBackground === "string" ? record.globalBackground : defaults.globalBackground,
    globalBackgroundPattern: typeof record.globalBackgroundPattern === "string" ? record.globalBackgroundPattern : defaults.globalBackgroundPattern,
    globalBackgroundCanvas: typeof record.globalBackgroundCanvas === "string" ? record.globalBackgroundCanvas : defaults.globalBackgroundCanvas,
    previewPadding: typeof record.previewPadding === "number" ? record.previewPadding : defaults.previewPadding,
    emailWidth: typeof record.emailWidth === "number" ? record.emailWidth : defaults.emailWidth,
    emailBorderRadius: typeof record.emailBorderRadius === "number" ? record.emailBorderRadius : defaults.emailBorderRadius,
    emailBoxShadow: typeof record.emailBoxShadow === "string" ? record.emailBoxShadow : defaults.emailBoxShadow,
    bodyTextInsetLeft: typeof record.bodyTextInsetLeft === "number" ? record.bodyTextInsetLeft : defaults.bodyTextInsetLeft,
    bodyTextInsetRight: typeof record.bodyTextInsetRight === "number" ? record.bodyTextInsetRight : defaults.bodyTextInsetRight,
    bodyContentMargin: typeof record.bodyContentMargin === "number" ? record.bodyContentMargin : defaults.bodyContentMargin,
    bodyTextSize: typeof record.bodyTextSize === "number" ? record.bodyTextSize : defaults.bodyTextSize,
    bodyTextColor: typeof record.bodyTextColor === "string" ? record.bodyTextColor : defaults.bodyTextColor,
  };
}

function formatVersionDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getAssetExtension(asset: Pick<TemplateAsset, "name" | "url">) {
  return (asset.name || asset.url).split("?")[0].split(".").pop()?.toLowerCase() || "";
}

function getAssetKind(asset: Pick<TemplateAsset, "name" | "url" | "mimeType">) {
  const extension = getAssetExtension(asset);

  if (asset.mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(extension)) {
    return "image";
  }

  if (asset.mimeType.startsWith("video/") || ["mp4", "webm", "mov"].includes(extension)) {
    return "video";
  }

  if (asset.mimeType.includes("json") || extension === "json") {
    return "lottie";
  }

  return "file";
}

function formatAssetSize(size: number) {
  if (!size) {
    return "";
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))}KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

function formatAiReply(reply: string, details: { action?: string; name?: string; subject?: string; preheader?: string; sectionCount?: number; mode?: "ai" | "demo"; attachmentNotes?: string; generatedAssets?: GeneratedAiAsset[] }) {
  const lines = [reply.trim()];

  if (details.attachmentNotes) {
    lines.push(`Files looked at: ${details.attachmentNotes}`);
  }

  if (details.generatedAssets?.length) {
    lines.push(`Generated assets: ${details.generatedAssets.map((asset) => asset.name).join(", ")}`);
  }

  if (details.action === "update") {
    const changed: string[] = [];

    if (details.name) {
      changed.push(`template name to "${details.name}"`);
    }

    if (details.subject) {
      changed.push(`subject to "${details.subject}"`);
    }

    if (details.preheader) {
      changed.push("preheader text");
    }

    if (details.sectionCount) {
      changed.push(`${details.sectionCount} editable section${details.sectionCount === 1 ? "" : "s"}`);
    }

    if (changed.length > 0) {
      lines.push(`Changed: ${changed.join(", ")}.`);
    }

    lines.push("Next, you can ask me to make it shorter, more premium, more friendly, add proof, add product imagery, or change the CTA.");
  }

  if (details.mode === "demo") {
    lines.push("Note: this is demo mode, so the response is limited until the live AI service is active.");
  }

  return lines.filter(Boolean).join("\n\n");
}

function buildAssetHtml(asset: TemplateAsset) {
  const safeUrl = escapeAttribute(asset.url);
  const safeName = escapeAttribute(asset.name.replace(/^\d+-/, ""));
  const assetKind = getAssetKind(asset);

  if (assetKind === "image") {
    return buildResizableImageHtml(`<img src="${safeUrl}" alt="${safeName}" width="560" style="display:block;width:100%;max-width:100%;height:auto;border-radius:10px;" />`);
  }

  if (assetKind === "video") {
    return `<video controls width="560" style="display:block;width:100%;max-width:560px;border-radius:10px;"><source src="${safeUrl}" type="${escapeAttribute(asset.mimeType)}" />View video: ${safeName}</video>`;
  }

  if (assetKind === "lottie") {
    return `<a href="${safeUrl}" style="display:inline-block;color:#7c3aed;font-weight:700;text-decoration:none;">View animation: ${safeName}</a>`;
  }

  return `<a href="${safeUrl}" style="color:#7c3aed;font-weight:700;">${safeName}</a>`;
}

function extractBodyHtml(rawHtml: string) {
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (bodyMatch?.[1] || rawHtml).trim();
}

function extractHeadStyles(rawHtml: string) {
  const headMatch = rawHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return (headMatch?.[1].match(/<style[\s\S]*?<\/style>/gi) || []).join("\n").trim();
}

function isFullEmailDocument(rawHtml: string) {
  return /<(html|head|body)\b/i.test(rawHtml);
}

function splitEmailDocumentCode(rawHtml: string) {
  const sourceHtml = rawHtml || "";

  if (!isFullEmailDocument(sourceHtml)) {
    return { bodyHtml: sourceHtml, headHtml: "", wasSplit: false };
  }

  if (typeof DOMParser === "undefined") {
    const bodyHtml = extractBodyHtml(sourceHtml).replace(/<style[\s\S]*?<\/style>/gi, "").trim();
    const headMatch = sourceHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const bodyStyles = (extractBodyHtml(sourceHtml).match(/<style[\s\S]*?<\/style>/gi) || []).join("\n").trim();
    const headHtml = [headMatch?.[1]?.trim() || "", bodyStyles].filter(Boolean).join("\n").trim();

    return { bodyHtml, headHtml, wasSplit: true };
  }

  try {
    const document = new DOMParser().parseFromString(sourceHtml, "text/html");
    const bodyStyles = Array.from(document.body.querySelectorAll("style")).map((style) => {
      const outerHtml = style.outerHTML;
      style.remove();
      return outerHtml;
    });
    const headHtml = [document.head.innerHTML.trim(), ...bodyStyles].filter(Boolean).join("\n").trim();
    const bodyHtml = document.body.innerHTML.trim();

    return { bodyHtml, headHtml, wasSplit: true };
  } catch {
    const bodyHtml = extractBodyHtml(sourceHtml).replace(/<style[\s\S]*?<\/style>/gi, "").trim();
    const headHtml = extractHeadStyles(sourceHtml);

    return { bodyHtml, headHtml, wasSplit: true };
  }
}

function mergeDocumentHeadCode(existingHead: string, incomingHead: string) {
  const nextHead = incomingHead.trim();

  if (!nextHead) {
    return existingHead;
  }

  const currentHead = existingHead.trim();

  if (!currentHead) {
    return nextHead;
  }

  if (currentHead.includes(nextHead)) {
    return currentHead;
  }

  return `${currentHead}\n\n${nextHead}`;
}

function meaningfulChildNodes(parent: ParentNode) {
  return Array.from(parent.childNodes).filter((node) => {
    if (node.nodeType === 3) {
      return Boolean(node.textContent?.trim());
    }

    return node.nodeType === 1 && !["script", "style"].includes((node as Element).tagName.toLowerCase());
  });
}

function htmlFromNode(node: ChildNode) {
  if (node.nodeType === 3) {
    return `<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#475569;">${escapeHtml(node.textContent?.trim() || "")}</p>`;
  }

  return (node as Element).outerHTML;
}

function createSectionsFromHtml(rawHtml: string, fallbackLabel = "Template HTML") {
  const sourceHtml = rawHtml;
  const { bodyHtml } = splitEmailDocumentCode(sourceHtml);

  if (!bodyHtml.trim()) {
    return [];
  }

  if (typeof DOMParser === "undefined") {
    return [createSection(fallbackLabel, bodyHtml)];
  }

  try {
    const document = new DOMParser().parseFromString(bodyHtml, "text/html");
    const bodyNodes = meaningfulChildNodes(document.body);

    if (bodyNodes.length > 1) {
      return bodyNodes.map((node, index) => {
        return createSection(`${fallbackLabel} ${index + 1}`, htmlFromNode(node).trim());
      });
    }

    return [createSection(fallbackLabel, bodyHtml.trim())];
  } catch {
    return [createSection(fallbackLabel, bodyHtml)];
  }
}

function createSingleEditableSectionFromHtml(rawHtml: string, fallbackLabel = "Template HTML") {
  const sourceHtml = rawHtml;
  const { bodyHtml } = splitEmailDocumentCode(sourceHtml);

  if (typeof DOMParser === "undefined") {
    return createSection(fallbackLabel, bodyHtml.trim());
  }

  try {
    const document = new DOMParser().parseFromString(bodyHtml, "text/html");
    const firstTable = document.body.querySelector("table");

    if (firstTable && !firstTable.getAttribute("width")) {
      firstTable.setAttribute("width", "100%");
    }

    if (firstTable) {
      const style = firstTable.getAttribute("style") || "";
      if (!/width\s*:/i.test(style)) {
        firstTable.setAttribute("style", `${style.trim().replace(/;$/, "")};width:100%;max-width:100%;`.replace(/^;/, ""));
      }
    }

    return createSection(fallbackLabel, document.body.innerHTML.trim());
  } catch {
    return createSection(fallbackLabel, bodyHtml.trim());
  }
}

function shouldSplitCodeHtml(rawHtml: string) {
  const topLevelSectionTags = rawHtml.match(/<(section|article)\b/gi) || [];

  if (isFullEmailDocument(rawHtml) || topLevelSectionTags.length > 1) {
    return true;
  }

  if (typeof DOMParser !== "undefined") {
    try {
      const { bodyHtml } = splitEmailDocumentCode(rawHtml);
      const document = new DOMParser().parseFromString(bodyHtml, "text/html");

      return meaningfulChildNodes(document.body).length > 1;
    } catch {
      return false;
    }
  }

  return false;
}

function buildEditableHtmlSnapshot(rawHtml: string, fallbackLabel = "Template HTML", forceSplit = false) {
  if (!rawHtml.trim()) {
    return {
      html: "",
      sections: [],
    };
  }

  const htmlForSnapshot = rawHtml;
  const isFullHtmlDocument = /<(html|body)\b/i.test(htmlForSnapshot);
  const nextSections = isFullHtmlDocument
    ? [createSingleEditableSectionFromHtml(htmlForSnapshot, fallbackLabel)]
    : forceSplit || shouldSplitCodeHtml(htmlForSnapshot)
      ? createSectionsFromHtml(htmlForSnapshot, fallbackLabel)
      : [createSection(fallbackLabel, htmlForSnapshot)];
  const nextHtml = joinSections(nextSections);

  return {
    html: nextHtml || rawHtml,
    sections: nextSections,
  };
}

function cloneSections(nextSections: EmailSection[]) {
  return nextSections.map((section) => ({ ...section }));
}

function cloneSnapshot(snapshot: BuilderSnapshot) {
  return {
    ...snapshot,
    sections: cloneSections(snapshot.sections),
  };
}

function getStyleValue(style: string, property: string) {
  const match = style.match(new RegExp(`${property}\\s*:\\s*([^;]+)`, "i"));
  return match?.[1]?.trim();
}

function setStyleValue(style: string, property: string, value: string) {
  const declaration = `${property}:${value}`;
  const propertyPattern = new RegExp(`${property}\\s*:\\s*[^;]+`, "i");

  if (propertyPattern.test(style)) {
    return style.replace(propertyPattern, declaration);
  }

  return `${style.trim().replace(/;$/, "")};${declaration}`.replace(/^;/, "");
}

function getVisualSectionParts(sectionHtml: string) {
  const match = sectionHtml.trim().match(visualWrapperPattern);
  return {
    innerHtml: stripSectionWaveHtml(match?.[2] || sectionHtml),
    style: match?.[1] || "",
  };
}

function stripSectionWaveHtml(sectionHtml: string) {
  return sectionHtml.replace(/<div data-builder-wave="(?:top|bottom)"[\s\S]*?<\/div>/g, "").trim();
}

function getSectionWaveStyle(style: string, position: "top" | "bottom") {
  return getStyleValue(style, `--builder-wave-${position}`) === "1";
}

const emptySpacingSides: SpacingSides = { top: 0, right: 0, bottom: 0, left: 0 };

function parseCssPixel(value: string | undefined) {
  const number = Number.parseFloat(value || "");
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function hasStyleProperty(style: string, property: string) {
  return new RegExp(`${property}\\s*:`, "i").test(style);
}

function parseSpacingShorthand(value: string) {
  const parts = value.trim().split(/\s+/).map(parseCssPixel);

  if (parts.length === 1) {
    return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  }

  if (parts.length === 2) {
    return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
  }

  if (parts.length === 3) {
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
  }

  return {
    top: parts[0] || 0,
    right: parts[1] || 0,
    bottom: parts[2] || 0,
    left: parts[3] || 0,
  };
}

function getSpacingSides(style: string, property: "padding" | "margin"): SpacingSides {
  const shorthand = getStyleValue(style, property);
  const base = shorthand ? parseSpacingShorthand(shorthand) : emptySpacingSides;
  const top = getStyleValue(style, `${property}-top`);
  const right = getStyleValue(style, `${property}-right`);
  const bottom = getStyleValue(style, `${property}-bottom`);
  const left = getStyleValue(style, `${property}-left`);

  return {
    top: top ? parseCssPixel(top) : base.top,
    right: right ? parseCssPixel(right) : base.right,
    bottom: bottom ? parseCssPixel(bottom) : base.bottom,
    left: left ? parseCssPixel(left) : base.left,
  };
}

function setSpacingSides(style: string, property: "padding" | "margin", spacing: SpacingSides) {
  let nextStyle = style;
  nextStyle = setStyleValue(nextStyle, `${property}-top`, `${Math.max(0, spacing.top)}px`);
  nextStyle = setStyleValue(nextStyle, `${property}-right`, `${Math.max(0, spacing.right)}px`);
  nextStyle = setStyleValue(nextStyle, `${property}-bottom`, `${Math.max(0, spacing.bottom)}px`);
  nextStyle = setStyleValue(nextStyle, `${property}-left`, `${Math.max(0, spacing.left)}px`);
  return nextStyle;
}

function buildSectionVisualStyle(style: string, options: { background?: string; padding?: number | SpacingSides; margin?: SpacingSides; color?: string; waveTop?: boolean; waveBottom?: boolean }) {
  let nextStyle = style || "background:#ffffff;padding:0;color:#111827";
  const currentWaveTop = getSectionWaveStyle(nextStyle, "top");
  const currentWaveBottom = getSectionWaveStyle(nextStyle, "bottom");
  const waveTop = options.waveTop ?? currentWaveTop;
  const waveBottom = options.waveBottom ?? currentWaveBottom;

  if (options.background !== undefined) {
    nextStyle = setStyleValue(nextStyle, "background", options.background);
  }

  if (options.padding !== undefined) {
    const spacing = typeof options.padding === "number"
      ? { top: options.padding, right: options.padding, bottom: options.padding, left: options.padding }
      : options.padding;
    nextStyle = setSpacingSides(nextStyle, "padding", spacing);
  }

  if (options.margin !== undefined) {
    nextStyle = setSpacingSides(nextStyle, "margin", options.margin);
  }

  if (options.color !== undefined) {
    nextStyle = setStyleValue(nextStyle, "color", options.color);
  }

  nextStyle = setStyleValue(nextStyle, "--builder-wave-top", waveTop ? "1" : "0");
  nextStyle = setStyleValue(nextStyle, "--builder-wave-bottom", waveBottom ? "1" : "0");
  nextStyle = setStyleValue(nextStyle, "position", "relative");
  nextStyle = setStyleValue(nextStyle, "overflow", "visible");
  if (options.margin === undefined && !hasStyleProperty(nextStyle, "margin-top")) {
    nextStyle = setStyleValue(nextStyle, "margin-top", waveTop ? "18px" : "0");
  }
  if (options.margin === undefined && !hasStyleProperty(nextStyle, "margin-bottom")) {
    nextStyle = setStyleValue(nextStyle, "margin-bottom", waveBottom ? "18px" : "0");
  }

  return nextStyle;
}

function buildSectionWaveHtml(position: "top" | "bottom", background: string) {
  const safeBackground = escapeAttribute(background || "#ffffff");
  const verticalPosition = position === "top" ? "top:-18px;" : "bottom:-18px;";
  const path = position === "top"
    ? "M0 18 C140 2 260 2 400 18 C500 30 560 24 640 18 V18 H0 Z"
    : "M0 0 C140 16 260 16 400 0 C500 -12 560 -6 640 0 V0 H0 Z";

  return `<div data-builder-wave="${position}" contenteditable="false" style="position:absolute;left:0;right:0;${verticalPosition}height:18px;line-height:0;overflow:hidden;pointer-events:none;z-index:1;"><svg role="presentation" width="100%" height="18" viewBox="0 0 640 18" preserveAspectRatio="none" style="display:block;width:100%;height:18px;"><path fill="${safeBackground}" d="${path}"></path></svg></div>`;
}

function buildSectionWrapperHtml(innerHtml: string, style: string) {
  const background = getStyleValue(style, "background") || "#ffffff";
  const waveTop = getSectionWaveStyle(style, "top");
  const waveBottom = getSectionWaveStyle(style, "bottom");

  return `<div data-builder-visual="section" style="${style}">${waveTop ? buildSectionWaveHtml("top", background) : ""}${stripSectionWaveHtml(innerHtml)}${waveBottom ? buildSectionWaveHtml("bottom", background) : ""}</div>`;
}

function buildVisualSectionHtml(sectionHtml: string, background: string, padding: SpacingSides, margin: SpacingSides, color: string, waveTop?: boolean, waveBottom?: boolean) {
  const { innerHtml } = getVisualSectionParts(sectionHtml);
  const nextStyle = buildSectionVisualStyle(getVisualSectionParts(sectionHtml).style, { background, padding, margin, color, waveTop, waveBottom });

  return buildSectionWrapperHtml(innerHtml, nextStyle);
}

function buildSectionBackgroundHtml(sectionHtml: string, background: string) {
  const visualParts = getVisualSectionParts(sectionHtml);
  const nextStyle = buildSectionVisualStyle(visualParts.style, { background });
  let nextInnerHtml = visualParts.innerHtml.trim();

  if (typeof DOMParser !== "undefined") {
    try {
      const document = new DOMParser().parseFromString(nextInnerHtml, "text/html");
      const firstElement = document.body.firstElementChild as HTMLElement | null;

      if (firstElement) {
        firstElement.style.background = background;
        firstElement.style.backgroundColor = background;
        const firstTable = firstElement instanceof HTMLTableElement ? firstElement : firstElement.querySelector("table");

        if (firstTable instanceof HTMLTableElement) {
          Array.from(firstTable.rows).forEach((row) => {
            Array.from(row.cells).forEach((cell) => {
              cell.style.background = background;
              cell.style.backgroundColor = background;
              cell.setAttribute("bgcolor", background);
            });
          });
        }

        nextInnerHtml = document.body.innerHTML.trim();
      }
    } catch {
      nextInnerHtml = visualParts.innerHtml.trim();
    }
  }

  return buildSectionWrapperHtml(nextInnerHtml, nextStyle);
}

function getSectionBackgroundColor(sectionHtml: string) {
  const visualBackground = getStyleValue(getVisualSectionParts(sectionHtml).style, "background");

  if (visualBackground?.startsWith("#")) {
    return visualBackground;
  }

  if (typeof DOMParser !== "undefined") {
    try {
      const document = new DOMParser().parseFromString(getVisualSectionParts(sectionHtml).innerHtml, "text/html");
      const firstElement = document.body.firstElementChild as HTMLElement | null;
      const firstTable = firstElement instanceof HTMLTableElement ? firstElement : firstElement?.querySelector("table");
      const firstCell = firstTable instanceof HTMLTableElement ? firstTable.rows[0]?.cells[0] : null;
      const background = firstCell?.style.backgroundColor || firstCell?.style.background || firstElement?.style.backgroundColor || firstElement?.style.background || "";
      const rgbMatch = background.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);

      if (background.startsWith("#")) {
        return background;
      }

      if (rgbMatch) {
        return rgbToHex(Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3]));
      }
    } catch {
      return "#ffffff";
    }
  }

  return "#ffffff";
}

function buildSectionMinHeightHtml(sectionHtml: string, minHeight: number) {
  const visualParts = getVisualSectionParts(sectionHtml);
  const nextStyle = setStyleValue(visualParts.style || "background:#ffffff;padding:0;color:#111827", "min-height", `${minHeight}px`);

  return buildSectionWrapperHtml(visualParts.innerHtml, buildSectionVisualStyle(nextStyle, {}));
}

function prepareResizableBuilderHtml(elementHtml: string) {
  if (!elementHtml.includes("data-builder-block") || elementHtml.includes("data-builder-resize-handle")) {
    return elementHtml;
  }

  const handle = elementHtml.includes('data-builder-block="spacer"') ? blockVerticalResizeHandle : `${blockWidthResizeHandle}${blockResizeHandle}`;
  const withPosition = elementHtml.replace(/(<div[^>]*data-builder-block="[^"]+"[^>]*style=")([^"]*)(")/, (_match, prefix: string, style: string, suffix: string) => {
    const positionedStyle = /position\s*:/i.test(style) ? style : `position:relative;${style}`;
    const overflowVisibleStyle = positionedStyle.replace(/overflow\s*:\s*auto/gi, "overflow:visible");
    return `${prefix}${overflowVisibleStyle}${suffix}`;
  });

  return withPosition.replace(/<\/div>\s*$/, `${handle}</div>`);
}

function renderHighlightedHtml(code: string) {
  const chunks = code.split(/(<\/?[\s\S]*?>)/g);

  return chunks.map((chunk, chunkIndex) => {
    if (!chunk.startsWith("<")) {
      return <span key={`text-${chunkIndex}`} className="text-slate-300">{chunk}</span>;
    }

    const tagParts = chunk.split(/(\s+|<\/?|\/?>|=|"[^"]*"|'[^']*')/g).filter(Boolean);
    let tagNameSeen = false;

    return (
      <span key={`tag-${chunkIndex}`}>
        {tagParts.map((part, partIndex) => {
          const key = `${chunkIndex}-${partIndex}`;

          if (/^<\/?|\/?>$/.test(part)) {
            return <span key={key} className="text-fuchsia-300">{part}</span>;
          }

          if (/^\s+$/.test(part)) {
            return <span key={key}>{part}</span>;
          }

          if (part === "=") {
            return <span key={key} className="text-slate-500">{part}</span>;
          }

          if (/^["']/.test(part)) {
            return <span key={key} className="text-emerald-300">{part}</span>;
          }

          if (!tagNameSeen) {
            tagNameSeen = true;
            return <span key={key} className="text-sky-300">{part}</span>;
          }

          return <span key={key} className="text-violet-300">{part}</span>;
        })}
      </span>
    );
  });
}

async function getAccessToken() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error("Sign in before editing templates.");
  }

  return data.session.access_token;
}

export function TemplateBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTemplateId = searchParams.get("template");
  const requestedFolderId = searchParams.get("folder");
  const requestedStarter = searchParams.get("starter");
  const codeRef = useRef<HTMLTextAreaElement | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const aiFileInputRef = useRef<HTMLInputElement | null>(null);
  const codeHighlightRef = useRef<HTMLPreElement | null>(null);
  const codeLineNumbersRef = useRef<HTMLPreElement | null>(null);
  const builderRef = useRef<HTMLElement | null>(null);
  const historyRef = useRef<BuilderSnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const hoveredInspectableRef = useRef<HTMLElement | null>(null);
  const pendingContentEditsRef = useRef<Record<string, string>>({});
  const activeTextRangeRef = useRef<Range | null>(null);
  const activeTextTargetRef = useRef<HTMLElement | null>(null);
  const activeButtonTargetRef = useRef<HTMLAnchorElement | null>(null);
  const activeImageTargetRef = useRef<HTMLImageElement | null>(null);
  const activeImageIdRef = useRef<string | null>(null);
  const saveTemplateRef = useRef<(() => void) | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(requestedTemplateId);
  const [templateName, setTemplateName] = useState("Untitled Template");
  const [subject, setSubject] = useState("Untitled subject");
  const [preheader, setPreheader] = useState("");
  const [fromName, setFromName] = useState("Trigger Mail AI");
  const [fromEmail, setFromEmail] = useState("hello@triggermail.ai");
  const [html, setHtml] = useState(starterHtml);
  const [sections, setSections] = useState<EmailSection[]>(() => [createSection("Template HTML", starterHtml)]);
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAsNew, setSavingAsNew] = useState(false);
  const [savedState, setSavedState] = useState<"saved" | "dirty">("saved");
  const [showSavedReturnAction, setShowSavedReturnAction] = useState(false);
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeSheet, setCodeSheet] = useState<CodeSheet>("emailBody");
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>("build");
  const [activeSectionCategoryId, setActiveSectionCategoryId] = useState<string | null>(null);
  const [assets, setAssets] = useState<TemplateAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetUploading, setAssetUploading] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [templateVersions, setTemplateVersions] = useState<EmailTemplateVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionActionId, setVersionActionId] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [imageToolsSectionId, setImageToolsSectionId] = useState<string | null>(null);
  const [buttonToolsSectionId, setButtonToolsSectionId] = useState<string | null>(null);
  const [sectionEditor, setSectionEditor] = useState<EmailSection | null>(null);
  const [sectionLabelDraft, setSectionLabelDraft] = useState("");
  const [sectionDraft, setSectionDraft] = useState("");
  const [sectionBackgroundDraft, setSectionBackgroundDraft] = useState("#ffffff");
  const [sectionPaddingDraft, setSectionPaddingDraft] = useState<SpacingSides>(emptySpacingSides);
  const [sectionMarginDraft, setSectionMarginDraft] = useState<SpacingSides>(emptySpacingSides);
  const [sectionTextColorDraft, setSectionTextColorDraft] = useState("#111827");
  const [sectionWaveTopDraft, setSectionWaveTopDraft] = useState(false);
  const [sectionWaveBottomDraft, setSectionWaveBottomDraft] = useState(false);
  const [textToolsSectionId, setTextToolsSectionId] = useState<string | null>(null);
  const [textColorDraft, setTextColorDraft] = useState("#111827");
  const [textHighlightDraft, setTextHighlightDraft] = useState("#ffffff");
  const [textGradientStartDraft, setTextGradientStartDraft] = useState("#7c3aed");
  const [textGradientEndDraft, setTextGradientEndDraft] = useState("#d946ef");
  const [textFontDraft, setTextFontDraft] = useState("Arial, sans-serif");
  const [textSizeDraft, setTextSizeDraft] = useState(16);
  const [textLinkDraft, setTextLinkDraft] = useState("");
  const [buttonLabelDraft, setButtonLabelDraft] = useState("");
  const [buttonUrlDraft, setButtonUrlDraft] = useState("");
  const [buttonTextColorDraft, setButtonTextColorDraft] = useState("#ffffff");
  const [selectedElementLabel, setSelectedElementLabel] = useState("Element");
  const [elementWidthDraft, setElementWidthDraft] = useState(0);
  const [elementPaddingDraft, setElementPaddingDraft] = useState(0);
  const [elementMarginDraft, setElementMarginDraft] = useState(0);
  const [elementRadiusDraft, setElementRadiusDraft] = useState(0);
  const [elementBackgroundDraft, setElementBackgroundDraft] = useState("#ffffff");
  const [sidebarWidth, setSidebarWidth] = useState(sidebarMinWidth);
  const [globalBackground, setGlobalBackground] = useState("#111827");
  const [globalBackgroundPattern, setGlobalBackgroundPattern] = useState("none");
  const [globalBackgroundCanvas, setGlobalBackgroundCanvas] = useState("plain");
  const [previewPadding, setPreviewPadding] = useState(20);
  const [emailWidth, setEmailWidth] = useState(760);
  const [emailBorderRadius, setEmailBorderRadius] = useState(10);
  const [emailBoxShadow, setEmailBoxShadow] = useState(defaultEmailBoxShadow);
  const [bodyTextInsetLeft, setBodyTextInsetLeft] = useState(0);
  const [bodyTextInsetRight, setBodyTextInsetRight] = useState(0);
  const [bodyContentMargin, setBodyContentMargin] = useState(0);
  const [bodyTextSize, setBodyTextSize] = useState(15);
  const [bodyTextColor, setBodyTextColor] = useState("#475569");
  const [customHead, setCustomHead] = useState("");
  const [exportMinified, setExportMinified] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const [codeCopyMessage, setCodeCopyMessage] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiAssetPickerOpen, setAiAssetPickerOpen] = useState(false);
  const [aiAttachments, setAiAttachments] = useState<AiChatAttachment[]>([]);
  const [aiAttachmentError, setAiAttachmentError] = useState<string | null>(null);
  const [aiDragActive, setAiDragActive] = useState(false);
  const [aiMode, setAiMode] = useState<"unknown" | "ai" | "demo">("unknown");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiWorkingStatus, setAiWorkingStatus] = useState("");
  const [aiMessages, setAiMessages] = useState<AiMessage[]>(initialAiMessages);
  const [aiWorking, setAiWorking] = useState(false);
  const [contentAssetPicker, setContentAssetPicker] = useState<"image" | "icon" | null>(null);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testHandlebarData, setTestHandlebarData] = useState(JSON.stringify({
    first_name: "Alex",
    company: "Acme Co",
    email: "alex@example.com",
  }, null, 2));
  const [testSending, setTestSending] = useState(false);
  const [testSendMessage, setTestSendMessage] = useState<string | null>(null);
  const [testSendError, setTestSendError] = useState<string | null>(null);
  const [testSendHtmlPreview, setTestSendHtmlPreview] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("builder");

  const supabaseReady = hasSupabaseConfig();
  const previewBackgroundStyle = useMemo(() => buildPreviewBackgroundStyle(globalBackground, globalBackgroundCanvas, globalBackgroundPattern), [globalBackground, globalBackgroundCanvas, globalBackgroundPattern]);
  const emailBoxShadowParts = useMemo(() => parseEmailBoxShadow(emailBoxShadow), [emailBoxShadow]);
  const emailPreviewFrameStyle = useMemo(() => ({ borderRadius: emailBorderRadius, boxShadow: emailBoxShadow }), [emailBorderRadius, emailBoxShadow]);
  const bodyTextInsetStyle = useMemo(() => ({
    "--body-text-inset-left": `${bodyTextInsetLeft}px`,
    "--body-text-inset-right": `${bodyTextInsetRight}px`,
    "--body-content-margin": `${bodyContentMargin}px`,
    "--body-text-size": `${bodyTextSize}px`,
    "--body-text-color": bodyTextColor,
  }) as CSSProperties, [bodyContentMargin, bodyTextColor, bodyTextInsetLeft, bodyTextInsetRight, bodyTextSize]);
  const displaySections = useMemo(() => orderShellSections(sections), [sections]);
  const sendPreviewSections = useMemo(() => {
    void dirtyVersion;
    return ensurePersistedBodyCanvas(sections.map((section) => pendingContentEditsRef.current[section.id] === undefined ? section : { ...section, html: pendingContentEditsRef.current[section.id] }));
  }, [dirtyVersion, sections]);
  const sendPreviewHtml = useMemo(() => buildSendableTemplateHtml({
    html: joinSections(sendPreviewSections),
    preheader,
    customHead,
    assetBaseUrl: typeof window === "undefined" ? "" : window.location.origin,
    globalStyles: {
      globalBackground,
      globalBackgroundPattern,
      globalBackgroundCanvas,
      previewPadding,
      emailWidth,
      emailBorderRadius,
      emailBoxShadow,
      bodyTextInsetLeft,
      bodyTextInsetRight,
      bodyContentMargin,
      bodyTextSize,
      bodyTextColor,
    },
  }), [bodyContentMargin, bodyTextColor, bodyTextInsetLeft, bodyTextInsetRight, bodyTextSize, customHead, emailBorderRadius, emailBoxShadow, emailWidth, globalBackground, globalBackgroundCanvas, globalBackgroundPattern, preheader, previewPadding, sendPreviewSections]);
  const bodySections = useMemo(() => displaySections.filter((section) => !isShellSection(section)), [displaySections]);
  const bodyPatternSections = useMemo(() => bodySections.filter(isHeroPatternSection), [bodySections]);
  const bodyFooterPatternSections = useMemo(() => bodySections.filter(isFooterPatternSection), [bodySections]);
  const bodyContentSections = useMemo(() => bodySections.filter((section) => !isBodyPatternSection(section)), [bodySections]);
  const outsideBodySections = useMemo(() => displaySections.filter(isShellSection), [displaySections]);
  const emailBodyCode = useMemo(() => joinSections(bodySections), [bodySections]);
  const outsideBodyCode = useMemo(() => joinSections(outsideBodySections), [outsideBodySections]);
  const activeCode = codeSheet === "emailBody" ? emailBodyCode : codeSheet === "outsideBody" ? outsideBodyCode : customHead;
  const lineNumbers = useMemo(() => activeCode.split("\n").map((_, index) => index + 1).join("\n"), [activeCode]);
  const footerEditorContent = useMemo(() => sectionEditor && isShellFooterSection(sectionEditor) ? getFooterShellContent(sectionEditor.html) : null, [sectionEditor]);
  const highlightedCode = useMemo(() => renderHighlightedHtml(activeCode), [activeCode]);
  const headerSection = useMemo(() => displaySections.find(isShellHeaderSection) || null, [displaySections]);
  const footerSection = useMemo(() => displaySections.find(isShellFooterSection) || null, [displaySections]);
  const hasLogoHeader = useMemo(() => displaySections.some(isShellHeaderSection), [displaySections]);
  const hasFooterShell = useMemo(() => displaySections.some(isShellFooterSection), [displaySections]);
  const activeSectionCategory = useMemo(
    () => sectionCategories.find((category) => category.id === activeSectionCategoryId) || null,
    [activeSectionCategoryId],
  );
  const activeSectionExamples = useMemo(() => {
    if (!activeSectionCategory) {
      return [];
    }

    return activeSectionCategory.examples
      .map((exampleLabel) => predesignedSections.find((section) => section.label === exampleLabel))
      .filter(Boolean) as typeof predesignedSections;
  }, [activeSectionCategory]);
  const detectedVariables = useMemo(() => {
    const source = `${subject}\n${preheader}\n${html}`;
    return Array.from(new Set(Array.from(source.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)).map((match) => match[1]))).sort();
  }, [html, preheader, subject]);
  const aiTargetSectionId = textToolsSectionId || imageToolsSectionId || buttonToolsSectionId || sectionEditor?.id || null;
  const aiTargetSection = useMemo(
    () => sections.find((section) => section.id === aiTargetSectionId) || null,
    [aiTargetSectionId, sections],
  );
  const aiAssetReferences = useMemo<AiAssetReference[]>(() => {
    const savedAssets = assets
      .filter((asset) => getAssetKind(asset) === "image")
      .map((asset) => {
        const displayName = asset.name.replace(/^\d+-/, "");
        return {
          id: `asset-${asset.path}`,
          name: displayName,
          kind: "asset" as const,
          label: displayName,
          detail: "Saved image asset",
          previewUrl: asset.url,
          promptToken: `[image asset: ${displayName} | url: ${asset.url}]`,
        };
      });
    const attachedFiles = aiAttachments.map((attachment) => ({
      id: `attachment-${attachment.id}`,
      name: attachment.name,
      kind: "attachment" as const,
      label: attachment.name,
      detail: attachment.dataUrl ? "Attached image" : "Attached file",
      previewUrl: attachment.dataUrl,
      promptToken: `[attached file: ${attachment.name}]`,
    }));

    return [...attachedFiles, ...savedAssets].slice(0, 8);
  }, [aiAttachments, assets]);
  const inspectorTabs = [
    { id: "build" as const, label: "Build", icon: LayoutTemplate },
    { id: "templates" as const, label: "Templates", icon: FileText },
    { id: "content" as const, label: "Content", icon: Type },
    { id: "blocks" as const, label: "Blocks", icon: Braces },
    { id: "assets" as const, label: "Assets", icon: ImageIcon },
    { id: "ai" as const, label: "AI chat", icon: Bot },
    { id: "styles" as const, label: "Global styles", icon: Palette },
    { id: "advanced" as const, label: "Advanced", icon: SlidersHorizontal },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];
  const markDirty = useCallback(() => {
    setSavedState("dirty");
    setShowSavedReturnAction(false);
    setDirtyVersion((version) => version + 1);
  }, []);
  const canUndo = historyVersion >= 0 && historyIndexRef.current > 0;
  const canRedo = historyVersion >= 0 && historyIndexRef.current < historyRef.current.length - 1;
  const previewUsesWholeEmailBody = bodySections.length === 1 && isWholeEmailSection(bodySections[0]);

  const loadAssets = useCallback(async () => {
    if (!supabaseReady) {
      return;
    }

    setAssetsLoading(true);
    setAssetError(null);

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/assets", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json()) as { assets?: TemplateAsset[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Assets could not be loaded.");
      }

      setAssets(payload.assets || []);
    } catch (loadError) {
      setAssetError(getErrorMessage(loadError, "Assets could not be loaded."));
    } finally {
      setAssetsLoading(false);
    }
  }, [supabaseReady]);

  async function uploadAssets(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setAssetUploading(true);
    setAssetError(null);

    try {
      const token = await getAccessToken();
      const uploadedAssets: TemplateAsset[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/assets", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
        const payload = (await response.json()) as { asset?: TemplateAsset; error?: string };

        if (!response.ok || !payload.asset) {
          throw new Error(payload.error || `${file.name} could not be uploaded.`);
        }

        uploadedAssets.push(payload.asset);
      }

      setAssets((currentAssets) => [...uploadedAssets, ...currentAssets]);
    } catch (uploadError) {
      setAssetError(getErrorMessage(uploadError, "Asset could not be uploaded."));
    } finally {
      setAssetUploading(false);

      if (assetInputRef.current) {
        assetInputRef.current.value = "";
      }
    }
  }

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error(`${file.name} could not be read.`));
      reader.readAsDataURL(file);
    });
  }

  function readFileAsText(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error(`${file.name} could not be read.`));
      reader.readAsText(file);
    });
  }

  async function addAiFiles(files: FileList | File[] | null) {
    const nextFiles = Array.from(files || []);

    if (nextFiles.length === 0) {
      return;
    }

    setAiAttachmentError(null);

    try {
      const remainingSlots = Math.max(0, 6 - aiAttachments.length);
      const acceptedFiles = nextFiles.slice(0, remainingSlots);

      if (acceptedFiles.length === 0) {
        throw new Error("You can attach up to 6 files to one chat message.");
      }

      const preparedFiles = await Promise.all(acceptedFiles.map(async (file) => {
        if (file.size > 8 * 1024 * 1024) {
          throw new Error(`${file.name} is too large. Use files under 8MB for AI chat context.`);
        }

        const isImage = file.type.startsWith("image/");
        const isReadableText = file.type.startsWith("text/")
          || ["application/json", "image/svg+xml"].includes(file.type)
          || /\.(txt|md|csv|json|svg|html|css)$/i.test(file.name);

        return {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          dataUrl: isImage ? await readFileAsDataUrl(file) : undefined,
          text: isReadableText ? (await readFileAsText(file)).slice(0, 18000) : undefined,
        };
      }));

      setAiAttachments((currentAttachments) => [...currentAttachments, ...preparedFiles]);

      if (nextFiles.length > acceptedFiles.length) {
        setAiAttachmentError("I attached the first 6 files. Remove one to add more.");
      }
    } catch (fileError) {
      setAiAttachmentError(getErrorMessage(fileError, "Those files could not be attached."));
    } finally {
      setAiDragActive(false);

      if (aiFileInputRef.current) {
        aiFileInputRef.current.value = "";
      }
    }
  }

  function removeAiAttachment(attachmentId: string) {
    setAiAttachments((currentAttachments) => currentAttachments.filter((attachment) => attachment.id !== attachmentId));
    setAiAttachmentError(null);
  }

  function shouldShowAiAssetPicker(value: string) {
    return /\b(image|picture|photo|file|logo|asset)\s*$/i.test(value);
  }

  function updateAiPrompt(value: string) {
    setAiPrompt(value);
    setAiAssetPickerOpen(shouldShowAiAssetPicker(value));
  }

  function insertAiAssetReference(reference: AiAssetReference) {
    const trimmedPrompt = aiPrompt.replace(/\b(image|picture|photo|file|logo|asset)\s*$/i, "").trimEnd();
    const separator = trimmedPrompt ? " " : "";
    setAiPrompt(`${trimmedPrompt}${separator}${reference.promptToken} `);
    setAiAssetPickerOpen(false);
  }

  const loadTemplateVersions = useCallback(async () => {
    if (!templateId || !supabaseReady) {
      setTemplateVersions([]);
      return;
    }

    setVersionsLoading(true);
    setVersionError(null);

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/templates/${templateId}/versions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json()) as { versions?: EmailTemplateVersion[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Template versions could not be loaded.");
      }

      setTemplateVersions(payload.versions || []);
    } catch (versionsError) {
      setVersionError(getErrorMessage(versionsError, "Template versions could not be loaded."));
    } finally {
      setVersionsLoading(false);
    }
  }, [supabaseReady, templateId]);

  async function createTemplateVersion(sourceVersionId?: string) {
    if (!templateId) {
      setVersionError("Open a saved template before creating versions.");
      return;
    }

    setVersionActionId(sourceVersionId || "current");
    setVersionError(null);

    try {
      const sectionsForVersion = ensurePersistedBodyCanvas(getSectionsWithPendingContentEdits());
      const token = await getAccessToken();
      const response = await fetch(`/api/templates/${templateId}/versions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sourceVersionId ? {
          sourceVersionId,
        } : {
          subject,
          preheader,
          html: joinSections(sectionsForVersion),
          design: { editor: "html", customHead, aiMessages: aiMessages.slice(-80), updatedAt: new Date().toISOString() },
        }),
      });
      const payload = (await response.json()) as { version?: EmailTemplateVersion; error?: string };

      if (!response.ok || !payload.version) {
        throw new Error(payload.error || "Template version could not be created.");
      }

      setTemplateVersions((currentVersions) => [payload.version as EmailTemplateVersion, ...currentVersions]);
    } catch (versionCreateError) {
      setVersionError(getErrorMessage(versionCreateError, "Template version could not be created."));
    } finally {
      setVersionActionId(null);
    }
  }

  async function makeVersionMain(version: EmailTemplateVersion) {
    if (!templateId) {
      return;
    }

    const confirmed = window.confirm(`Make version ${version.version_number} the main template?`);
    if (!confirmed) {
      return;
    }

    setVersionActionId(version.id);
    setVersionError(null);

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/templates/${templateId}/versions/${version.id}/restore`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json()) as { template?: EmailTemplate; error?: string };

      if (!response.ok || !payload.template) {
        throw new Error(payload.error || "Version could not be made main.");
      }

      applyTemplate(payload.template);
      await loadTemplateVersions();
    } catch (restoreError) {
      setVersionError(getErrorMessage(restoreError, "Version could not be made main."));
    } finally {
      setVersionActionId(null);
    }
  }

  function getBuilderSnapshot(overrides: Partial<BuilderSnapshot> = {}): BuilderSnapshot {
    const snapshotSections = overrides.sections ? cloneSections(overrides.sections) : cloneSections(getSectionsWithPendingContentEdits());

    return {
      html: overrides.html ?? joinSections(snapshotSections),
      sections: snapshotSections,
      globalBackground: overrides.globalBackground ?? globalBackground,
      globalBackgroundPattern: overrides.globalBackgroundPattern ?? globalBackgroundPattern,
      globalBackgroundCanvas: overrides.globalBackgroundCanvas ?? globalBackgroundCanvas,
      previewPadding: overrides.previewPadding ?? previewPadding,
      emailWidth: overrides.emailWidth ?? emailWidth,
      emailBorderRadius: overrides.emailBorderRadius ?? emailBorderRadius,
      emailBoxShadow: overrides.emailBoxShadow ?? emailBoxShadow,
      bodyTextInsetLeft: overrides.bodyTextInsetLeft ?? bodyTextInsetLeft,
      bodyTextInsetRight: overrides.bodyTextInsetRight ?? bodyTextInsetRight,
      bodyContentMargin: overrides.bodyContentMargin ?? bodyContentMargin,
      bodyTextSize: overrides.bodyTextSize ?? bodyTextSize,
      bodyTextColor: overrides.bodyTextColor ?? bodyTextColor,
      customHead: overrides.customHead ?? customHead,
    };
  }

  function getSectionsWithPendingContentEdits() {
    const pendingEdits = pendingContentEditsRef.current;
    return sections.map((section) => {
      const liveHtml = getCleanEditableSectionHtml(section.id);

      if (liveHtml !== null) {
        return { ...section, html: liveHtml };
      }

      return pendingEdits[section.id] === undefined ? section : { ...section, html: pendingEdits[section.id] };
    });
  }

  function markSectionContentEditing(sectionId: string, nextSectionHtml: string, options: { silent?: boolean } = {}) {
    pendingContentEditsRef.current = {
      ...pendingContentEditsRef.current,
      [sectionId]: nextSectionHtml,
    };

    if (options.silent) {
      return;
    }

    if (sectionEditor?.id === sectionId) {
      setSectionDraft(nextSectionHtml);
    }

    markDirty();
  }

  function getEditableSectionElement(sectionId: string) {
    return document.querySelector(`[data-editable-section="${sectionId}"]`) as HTMLDivElement | null;
  }

  function getCleanEditableSectionHtml(sectionId: string) {
    const editableElement = getEditableSectionElement(sectionId);

    if (!editableElement) {
      return null;
    }

    const clone = editableElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-builder-selected]").forEach((element) => {
      element.removeAttribute("data-builder-selected");
    });

    const wrapperTextStyle = getPersistableTextStyle(clone);
    const cleanHtml = clone.innerHTML;

    if (!wrapperTextStyle) {
      return cleanHtml;
    }

    return `<div style="${escapeAttribute(wrapperTextStyle)}">${cleanHtml}</div>`;
  }

  function clearSelectedInspectTarget(sectionId?: string | null) {
    const root = sectionId ? getEditableSectionElement(sectionId) : document;
    root?.querySelectorAll("[data-builder-selected]").forEach((element) => {
      element.removeAttribute("data-builder-selected");
    });
  }

  function getTextStyleTarget(sectionId: string, target?: EventTarget | null) {
    const editableElement = getEditableSectionElement(sectionId);

    if (!editableElement) {
      return null;
    }

    const targetElement = target instanceof HTMLElement
      ? target
      : window.getSelection()?.anchorNode?.parentElement || null;
    const styleTarget = targetElement?.closest("a, span, p, h1, h2, h3, h4, h5, h6, td, th, li, div") as HTMLElement | null;

    if (!styleTarget || !editableElement.contains(styleTarget) || styleTarget === editableElement) {
      const fallbackTarget = editableElement.querySelector("a, span, p, h1, h2, h3, h4, h5, h6, td, th, li, div") as HTMLElement | null;
      return fallbackTarget || editableElement;
    }

    return styleTarget;
  }

  function getInspectableTarget(sectionId: string, target?: EventTarget | null) {
    const editableElement = getEditableSectionElement(sectionId);

    if (!editableElement || !(target instanceof HTMLElement)) {
      return null;
    }

    const inspectableTarget = target.closest("img, video, a, button, h1, h2, h3, h4, h5, h6, p, span, td, th, table, tr, li, div") as HTMLElement | null;

    if (!inspectableTarget || !editableElement.contains(inspectableTarget) || inspectableTarget === editableElement) {
      return null;
    }

    return inspectableTarget;
  }

  function clearHoveredInspectTarget(sectionId: string) {
    const editableElement = getEditableSectionElement(sectionId);
    const removeButton = document.querySelector(`[data-hover-remove-section="${sectionId}"]`) as HTMLButtonElement | null;

    if (removeButton) {
      removeButton.style.display = "none";
      removeButton.style.top = "0px";
      removeButton.style.left = "0px";
    }

    if (!editableElement) {
      return;
    }

    hoveredInspectableRef.current?.removeAttribute("data-builder-hovered");
    hoveredInspectableRef.current = null;
    editableElement.querySelectorAll("[data-builder-hovered]").forEach((element) => {
      element.removeAttribute("data-builder-hovered");
    });
  }

  function hoverInspectTarget(sectionId: string, target?: EventTarget | null) {
    if (target instanceof HTMLElement && target.closest(`[data-hover-remove-section="${sectionId}"]`)) {
      return;
    }

    const inspectableTarget = getInspectableTarget(sectionId, target);

    if (!inspectableTarget) {
      clearHoveredInspectTarget(sectionId);
      return;
    }

    if (hoveredInspectableRef.current === inspectableTarget) {
      return;
    }

    hoveredInspectableRef.current?.removeAttribute("data-builder-hovered");
    hoveredInspectableRef.current = inspectableTarget;
    inspectableTarget.setAttribute("data-builder-hovered", inspectableTarget.tagName.toLowerCase());
    const sectionElement = document.querySelector(`[data-preview-section="${sectionId}"]`) as HTMLElement | null;
    const sectionRect = sectionElement?.getBoundingClientRect();
    const targetRect = inspectableTarget.getBoundingClientRect();

    if (!sectionRect) {
      return;
    }

    const removeButton = document.querySelector(`[data-hover-remove-section="${sectionId}"]`) as HTMLButtonElement | null;

    if (removeButton) {
      const rawTop = targetRect.top - sectionRect.top - 28;
      const top = rawTop < 48 ? Math.min(sectionRect.height - 36, targetRect.bottom - sectionRect.top + 8) : rawTop;
      const left = Math.max(6, Math.min(sectionRect.width - 92, targetRect.right - sectionRect.left - 86));
      removeButton.style.display = "inline-flex";
      removeButton.style.top = `${Math.max(6, top)}px`;
      removeButton.style.left = `${left}px`;
      removeButton.setAttribute("aria-label", `Remove ${inspectableTarget.tagName.toLowerCase()}`);
    }
  }

  function removeHoveredElement(sectionId: string) {
    const editableElement = getEditableSectionElement(sectionId);
    const hoveredElement = hoveredInspectableRef.current && editableElement?.contains(hoveredInspectableRef.current)
      ? hoveredInspectableRef.current
      : editableElement?.querySelector("[data-builder-hovered]") as HTMLElement | null;

    if (!editableElement || !hoveredElement) {
      return;
    }

    const removeButton = document.querySelector(`[data-hover-remove-section="${sectionId}"]`) as HTMLButtonElement | null;
    hoveredElement.remove();
    hoveredInspectableRef.current = null;
    if (removeButton) {
      removeButton.style.display = "none";
    }
    closeInspectorOverlays();
    commitSectionContentEdit(sectionId, editableElement.innerHTML);
  }

  function numberFromStyle(value: string) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? Math.round(number) : 0;
  }

  function rgbToHex(value: string, fallback: string) {
    const values = value.match(/\d+/g)?.slice(0, 3).map((part) => Number(part).toString(16).padStart(2, "0"));
    return values?.length === 3 ? `#${values.join("")}` : fallback;
  }

  function syncElementInspector(target: HTMLElement) {
    const computedStyle = window.getComputedStyle(target);
    const displayName = target.tagName.toLowerCase();
    const background = computedStyle.backgroundColor;

    setSelectedElementLabel(displayName);
    setElementWidthDraft(Math.round(target.getBoundingClientRect().width));
    setElementPaddingDraft(numberFromStyle(computedStyle.paddingTop));
    setElementMarginDraft(numberFromStyle(computedStyle.marginTop));
    setElementRadiusDraft(numberFromStyle(computedStyle.borderTopLeftRadius));

    if (/^rgb/.test(background)) {
      setElementBackgroundDraft(rgbToHex(background, "#ffffff"));
    }
  }

  function saveTextSelection(sectionId: string, target?: EventTarget | null) {
    const selection = window.getSelection();
    const editableElement = getEditableSectionElement(sectionId);
    const buttonTarget = target instanceof HTMLElement ? target.closest("a") as HTMLAnchorElement | null : null;

    if (buttonTarget && editableElement?.contains(buttonTarget)) {
      selectPreviewButton(sectionId, buttonTarget);
      return;
    }

    const styleTarget = getInspectableTarget(sectionId, target) || getTextStyleTarget(sectionId, target);

    setImageToolsSectionId(null);
    setButtonToolsSectionId(null);

    if (styleTarget) {
      clearSelectedInspectTarget();
      activeTextTargetRef.current = styleTarget;
      styleTarget.setAttribute("data-builder-selected", styleTarget.tagName.toLowerCase());
      syncElementInspector(styleTarget);
    }

    if (!selection || !editableElement || selection.rangeCount === 0) {
      setTextToolsSectionId(sectionId);
      return;
    }

    const range = selection.getRangeAt(0);

    if (!editableElement.contains(range.commonAncestorContainer)) {
      return;
    }

    activeTextRangeRef.current = range.collapsed ? null : range.cloneRange();
    setTextToolsSectionId(sectionId);
  }

  function selectPreviewButton(sectionId: string, button: HTMLAnchorElement) {
    clearSelectedInspectTarget();
    activeButtonTargetRef.current = button;
    activeTextTargetRef.current = button;
    button.setAttribute("data-builder-selected", "button");
    syncElementInspector(button);
    const computedStyle = window.getComputedStyle(button);
    setButtonLabelDraft(button.textContent?.trim() || "");
    setButtonUrlDraft(button.getAttribute("href") || "");
    setButtonTextColorDraft(rgbToHex(computedStyle.color, "#ffffff"));
    setElementPaddingDraft(numberFromStyle(computedStyle.paddingTop));
    setElementMarginDraft(numberFromStyle(computedStyle.paddingLeft));
    setTextSizeDraft(numberFromStyle(computedStyle.fontSize) || 14);
    setButtonToolsSectionId(sectionId);
    setTextToolsSectionId(null);
    setImageToolsSectionId(null);
  }

  function syncButtonToolsHtml(sectionId: string) {
    const editableElement = getEditableSectionElement(sectionId);

    if (!editableElement) {
      return;
    }

    markSectionContentEditing(sectionId, editableElement.innerHTML);
  }

  function getActiveButtonTarget(sectionId: string) {
    const editableElement = getEditableSectionElement(sectionId);

    if (!editableElement) {
      return null;
    }

    const currentTarget = activeButtonTargetRef.current;

    if (currentTarget && editableElement.contains(currentTarget)) {
      return currentTarget;
    }

    const selectedButton = editableElement.querySelector('a[data-builder-selected="button"]') as HTMLAnchorElement | null;
    activeButtonTargetRef.current = selectedButton;
    return selectedButton;
  }

  function updateSelectedButton(updates: {
    label?: string;
    href?: string;
    width?: number;
    paddingY?: number;
    paddingX?: number;
    radius?: number;
    background?: string;
    color?: string;
    fontSize?: number;
    align?: "left" | "center" | "right";
  }) {
    if (!buttonToolsSectionId) {
      return;
    }

    const editableElement = getEditableSectionElement(buttonToolsSectionId);
    const button = getActiveButtonTarget(buttonToolsSectionId);

    if (!editableElement || !button || !editableElement.contains(button)) {
      return;
    }

    if (updates.label !== undefined) {
      button.textContent = updates.label;
    }

    if (updates.href !== undefined) {
      button.setAttribute("href", updates.href || "https://example.com");
    }

    if (typeof updates.width === "number") {
      button.style.width = `${Math.max(80, Math.min(720, updates.width))}px`;
      button.style.maxWidth = "100%";
      button.style.textAlign = "center";
    }

    if (typeof updates.paddingY === "number" || typeof updates.paddingX === "number") {
      const currentStyle = window.getComputedStyle(button);
      const nextY = typeof updates.paddingY === "number" ? updates.paddingY : numberFromStyle(currentStyle.paddingTop);
      const nextX = typeof updates.paddingX === "number" ? updates.paddingX : numberFromStyle(currentStyle.paddingLeft);
      button.style.padding = `${nextY}px ${nextX}px`;
    }

    if (typeof updates.radius === "number") {
      button.style.borderRadius = `${Math.max(0, Math.min(48, updates.radius))}px`;
    }

    if (updates.background) {
      button.style.background = updates.background;
    }

    if (updates.color) {
      button.style.color = updates.color;
    }

    if (typeof updates.fontSize === "number") {
      button.style.fontSize = `${Math.max(10, Math.min(32, updates.fontSize))}px`;
    }

    if (updates.align) {
      const parent = button.parentElement as HTMLElement | null;
      if (parent) {
        parent.style.textAlign = updates.align;
      }
    }

    syncElementInspector(button);
    syncButtonToolsHtml(buttonToolsSectionId);
    markDirty();
  }

  function restoreTextSelection() {
    const range = activeTextRangeRef.current;

    if (!range) {
      return false;
    }

    const selection = window.getSelection();

    if (!selection) {
      return false;
    }

    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function rangeBelongsToTarget(range: Range, target: HTMLElement) {
    const commonAncestor = range.commonAncestorContainer;
    return target.contains(commonAncestor) || commonAncestor.contains(target);
  }

  function getActiveTextRangeForTarget(sectionId: string, target: HTMLElement | null) {
    const editableElement = getEditableSectionElement(sectionId);
    const range = activeTextRangeRef.current;

    if (!editableElement || !range || range.collapsed || !editableElement.contains(range.commonAncestorContainer)) {
      return null;
    }

    if (target && target !== editableElement && !rangeBelongsToTarget(range, target)) {
      return null;
    }

    return range;
  }

  function syncTextToolsHtml(sectionId: string) {
    const editableElement = getEditableSectionElement(sectionId);

    if (!editableElement) {
      return;
    }

    markSectionContentEditing(sectionId, editableElement.innerHTML);
  }

  function updateImageInSectionHtml(sectionId: string, imageId: string, mutate: (image: HTMLImageElement, wrapper: HTMLElement | null, document: Document) => void) {
    const currentSection = getSectionsWithPendingContentEdits().find((section) => section.id === sectionId);

    if (!currentSection) {
      return;
    }

    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(`<div>${currentSection.html}</div>`, "text/html");
    const image = parsedDocument.querySelector(`img[data-builder-id="${CSS.escape(imageId)}"]`) as HTMLImageElement | null;

    if (!image) {
      return;
    }

    mutate(image, image.closest('[data-builder-block="image"]') as HTMLElement | null, parsedDocument);

    const nextHtml = parsedDocument.body.firstElementChild?.innerHTML || currentSection.html;
    markSectionContentEditing(sectionId, nextHtml);
  }

  function selectPreviewImage(sectionId: string, image: HTMLImageElement) {
    clearSelectedInspectTarget();
    let selectedImage = image;
    let resizeBlock = selectedImage.closest('[data-builder-block="image"]') as HTMLElement | null;

    if (!resizeBlock) {
      const currentWidth = Number(selectedImage.getAttribute("width")) || numberFromStyle(selectedImage.style.width) || Math.round(selectedImage.getBoundingClientRect().width) || 560;
      const wrapper = document.createElement("div");
      wrapper.setAttribute("data-builder-block", "image");
      wrapper.setAttribute("style", `resize:horizontal;overflow:visible;width:${currentWidth}px;min-width:80px;max-width:100%;position:relative;display:inline-block;`);
      selectedImage.style.width = "100%";
      selectedImage.style.maxWidth = "100%";
      selectedImage.style.height = "auto";
      selectedImage.parentNode?.insertBefore(wrapper, selectedImage);
      wrapper.appendChild(selectedImage);
      wrapper.insertAdjacentHTML("beforeend", blockWidthResizeHandle + blockResizeHandle);
      resizeBlock = wrapper;
    }

    const imageId = selectedImage.dataset.builderId || `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    selectedImage.dataset.builderId = imageId;
    activeImageIdRef.current = imageId;

    activeImageTargetRef.current = selectedImage;
    selectedImage.setAttribute("data-builder-selected", "img");
    syncElementInspector(resizeBlock || selectedImage);
    setElementWidthDraft(numberFromStyle(resizeBlock?.style.width || "") || Number(selectedImage.getAttribute("width")) || Math.round(selectedImage.getBoundingClientRect().width));
    setElementRadiusDraft(numberFromStyle(selectedImage.style.borderRadius));
    setImageToolsSectionId(sectionId);
    setButtonToolsSectionId(null);
    setTextToolsSectionId(null);

    const editableElement = getEditableSectionElement(sectionId);
    if (editableElement) {
      markSectionContentEditing(sectionId, editableElement.innerHTML);
    }
  }

  function replaceSelectedImage(asset: TemplateAsset) {
    if (!imageToolsSectionId || getAssetKind(asset) !== "image") {
      return;
    }

    const imageId = activeImageIdRef.current;

    if (!imageId) {
      return;
    }

    updateImageInSectionHtml(imageToolsSectionId, imageId, (image) => {
      image.src = asset.url;
      image.alt = asset.name.replace(/^\d+-/, "");
      image.setAttribute("data-asset-path", asset.path);
      image.setAttribute("data-builder-selected", "img");
    });
  }

  function getActiveImageTarget(sectionId: string) {
    const editableElement = getEditableSectionElement(sectionId);

    if (!editableElement) {
      return null;
    }

    const currentTarget = activeImageTargetRef.current;

    if (currentTarget && editableElement.contains(currentTarget)) {
      return currentTarget;
    }

    const selectedImage = editableElement.querySelector('img[data-builder-selected="img"]') as HTMLImageElement | null;
    activeImageTargetRef.current = selectedImage;
    return selectedImage;
  }

  function updateSelectedImageStyle(updates: { width?: number; radius?: number }) {
    if (!imageToolsSectionId) {
      return;
    }

    const imageId = activeImageIdRef.current;

    if (!imageId) {
      return;
    }

    updateImageInSectionHtml(imageToolsSectionId, imageId, (image, resizeBlock) => {
      if (typeof updates.width === "number") {
        const nextWidth = Math.max(80, Math.min(720, updates.width));
        if (resizeBlock) {
          resizeBlock.style.width = `${nextWidth}px`;
          resizeBlock.style.maxWidth = "100%";
        }
        image.width = nextWidth;
        image.style.width = resizeBlock ? "100%" : `${nextWidth}px`;
        image.style.maxWidth = "100%";
        image.style.height = "auto";
      }

      if (typeof updates.radius === "number") {
        image.style.borderRadius = `${Math.max(0, Math.min(48, updates.radius))}px`;
      }

      image.setAttribute("data-builder-selected", "img");
    });
  }

  function getActiveTextTarget(sectionId: string) {
    const editableElement = getEditableSectionElement(sectionId);
    const target = activeTextTargetRef.current;

    if (!editableElement) {
      return null;
    }

    if (target && target !== editableElement && editableElement.contains(target)) {
      return target;
    }

    const fallbackTarget = editableElement.querySelector("a, span, p, h1, h2, h3, h4, h5, h6, td, th, li, div") as HTMLElement | null;

    if (fallbackTarget) {
      activeTextTargetRef.current = fallbackTarget;
      return fallbackTarget;
    }

    if (editableElement.childNodes.length > 0) {
      const wrapper = document.createElement("div");
      wrapper.setAttribute("data-builder-block", "text");
      while (editableElement.firstChild) {
        wrapper.appendChild(editableElement.firstChild);
      }
      editableElement.appendChild(wrapper);
      activeTextTargetRef.current = wrapper;
      return wrapper;
    }

    return editableElement;
  }

  function applyStyleToActiveTextTarget(style: Record<string, string>) {
    if (!textToolsSectionId) {
      return;
    }

    const target = getActiveTextTarget(textToolsSectionId);

    if (!target) {
      return;
    }

    Object.entries(style).forEach(([property, value]) => {
      target.style.setProperty(property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`), value);
    });
    syncElementInspector(target);
    syncTextToolsHtml(textToolsSectionId);
  }

  function applyTextCommand(command: string, value?: string) {
    if (!textToolsSectionId) {
      return;
    }

    const target = getActiveTextTarget(textToolsSectionId);
    const activeRange = getActiveTextRangeForTarget(textToolsSectionId, target);
    const hasSelection = Boolean(activeRange);

    if (hasSelection && restoreTextSelection() && !window.getSelection()?.getRangeAt(0).collapsed) {
      const selection = window.getSelection();
      const selectedElement = selection?.anchorNode?.parentElement || null;
      const selectedStyle = selectedElement ? window.getComputedStyle(selectedElement) : null;

      if (command === "bold") {
        const isBold = selectedStyle ? Number.parseInt(selectedStyle.fontWeight, 10) >= 600 || selectedStyle.fontWeight === "bold" : false;
        applyInlineTextStyle({ fontWeight: isBold ? "400" : "700" });
        return;
      }

      if (command === "italic") {
        applyInlineTextStyle({ fontStyle: selectedStyle?.fontStyle === "italic" ? "normal" : "italic" });
        return;
      }

      if (command === "underline") {
        applyInlineTextStyle({ textDecoration: selectedStyle?.textDecorationLine.includes("underline") ? "none" : "underline" });
        return;
      }

      document.execCommand("styleWithCSS", false, "true");
      document.execCommand(command, false, value);
      saveTextSelection(textToolsSectionId);
      syncTextToolsHtml(textToolsSectionId);
      return;
    }

    if (!target) {
      return;
    }

    if (command === "bold") {
      target.style.fontWeight = target.style.fontWeight === "700" || target.style.fontWeight === "bold" ? "400" : "700";
    } else if (command === "italic") {
      target.style.fontStyle = target.style.fontStyle === "italic" ? "normal" : "italic";
    } else if (command === "underline") {
      target.style.textDecoration = target.style.textDecoration.includes("underline") ? "none" : "underline";
    } else if (command === "justifyLeft") {
      target.style.textAlign = "left";
    } else if (command === "justifyCenter") {
      target.style.textAlign = "center";
    } else if (command === "justifyRight") {
      target.style.textAlign = "right";
    } else if (command === "createLink" && value) {
      const link = target.closest("a") as HTMLAnchorElement | null;
      if (link) {
        link.href = value;
      } else {
        const wrapper = document.createElement("a");
        wrapper.href = value;
        wrapper.style.color = "inherit";
        wrapper.innerHTML = target.innerHTML;
        target.replaceChildren(wrapper);
        activeTextTargetRef.current = wrapper;
      }
    } else if (command === "unlink") {
      const link = target.closest("a");
      if (link) {
        link.replaceWith(...Array.from(link.childNodes));
      }
    }

    syncTextToolsHtml(textToolsSectionId);
  }

  function applyInlineTextStyle(style: Record<string, string>) {
    if (!textToolsSectionId) {
      return;
    }

    const target = getActiveTextTarget(textToolsSectionId);
    const activeRange = getActiveTextRangeForTarget(textToolsSectionId, target);
    const hasSelection = Boolean(activeRange);
    const selection = window.getSelection();

    if (!hasSelection || !restoreTextSelection() || !selection || selection.rangeCount === 0 || selection.getRangeAt(0).collapsed) {
      applyStyleToActiveTextTarget(style);
      return;
    }

    const range = selection.getRangeAt(0);
    const span = document.createElement("span");

    Object.entries(style).forEach(([property, value]) => {
      if (value) {
        span.style.setProperty(property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`), value);
      }
    });

    if (range.collapsed) {
      span.appendChild(document.createTextNode("\u200b"));
      range.insertNode(span);
      range.selectNodeContents(span);
    } else {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      range.selectNodeContents(span);
    }

    selection.removeAllRanges();
    selection.addRange(range);
    activeTextRangeRef.current = range.cloneRange();
    syncTextToolsHtml(textToolsSectionId);
  }

  function applyGradientText(startColor = textGradientStartDraft, endColor = textGradientEndDraft) {
    const gradient = `linear-gradient(135deg, ${startColor}, ${endColor})`;
    applyInlineTextStyle({
      color: startColor,
      backgroundImage: gradient,
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      display: "inline-block",
    });
  }

  function snapshotsMatch(first: BuilderSnapshot | undefined, second: BuilderSnapshot) {
    return first ? JSON.stringify(first) === JSON.stringify(second) : false;
  }

  function applyBuilderSnapshot(snapshot: BuilderSnapshot) {
    const nextSnapshot = cloneSnapshot(snapshot);
    pendingContentEditsRef.current = {};
    setHtml(nextSnapshot.html);
    setSections(nextSnapshot.sections);
    setGlobalBackground(nextSnapshot.globalBackground);
    setGlobalBackgroundPattern(nextSnapshot.globalBackgroundPattern);
    setGlobalBackgroundCanvas(nextSnapshot.globalBackgroundCanvas);
    setPreviewPadding(nextSnapshot.previewPadding);
    setEmailWidth(nextSnapshot.emailWidth);
    setEmailBorderRadius(nextSnapshot.emailBorderRadius);
    setEmailBoxShadow(nextSnapshot.emailBoxShadow);
    setBodyTextInsetLeft(nextSnapshot.bodyTextInsetLeft);
    setBodyTextInsetRight(nextSnapshot.bodyTextInsetRight);
    setBodyContentMargin(nextSnapshot.bodyContentMargin ?? 0);
    setBodyTextSize(nextSnapshot.bodyTextSize ?? 15);
    setBodyTextColor(nextSnapshot.bodyTextColor ?? "#475569");
    setCustomHead(nextSnapshot.customHead);

    if (sectionEditor && !nextSnapshot.sections.some((section) => section.id === sectionEditor.id)) {
      closeSectionEditor();
    }
  }

  const resetBuilderHistory = useCallback((snapshot: BuilderSnapshot) => {
    historyRef.current = [cloneSnapshot(snapshot)];
    historyIndexRef.current = 0;
    setHistoryVersion((version) => version + 1);
  }, []);

  function pushBuilderHistory(snapshot: BuilderSnapshot) {
    const nextSnapshot = cloneSnapshot(snapshot);
    const currentSnapshot = historyRef.current[historyIndexRef.current];

    if (snapshotsMatch(currentSnapshot, nextSnapshot)) {
      return;
    }

    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(nextSnapshot);

    if (nextHistory.length > 100) {
      nextHistory.shift();
    }

    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    setHistoryVersion((version) => version + 1);
  }

  function commitBuilderSnapshot(snapshot: BuilderSnapshot) {
    applyBuilderSnapshot(snapshot);
    pushBuilderHistory(snapshot);
    markDirty();
  }

  function undoBuilder() {
    if (!canUndo) {
      return;
    }

    historyIndexRef.current -= 1;
    applyBuilderSnapshot(historyRef.current[historyIndexRef.current]);
    setHistoryVersion((version) => version + 1);
    markDirty();
  }

  function redoBuilder() {
    if (!canRedo) {
      return;
    }

    historyIndexRef.current += 1;
    applyBuilderSnapshot(historyRef.current[historyIndexRef.current]);
    setHistoryVersion((version) => version + 1);
    markDirty();
  }

  const applyTemplate = useCallback((template: EmailTemplate) => {
    pendingContentEditsRef.current = {};
    setTemplateId(template.id);
    setTemplateName(template.name);
    setSubject(template.subject);
    setPreheader(template.preheader || "");
    setFromName(template.from_name || "Trigger Mail AI");
    setFromEmail(template.from_email || "hello@triggermail.ai");
    const nextCustomHead = getTemplateDesignHead(template.design);
    const nextAiMessages = getTemplateDesignAiMessages(template.design);
    const nextGlobalStyles = getTemplateDesignGlobalStyles(template.design);
    const editableSnapshot = buildEditableHtmlSnapshot(template.html ?? starterHtml, template.name || "Template HTML");
    const nextHtml = editableSnapshot.html;
    const nextSections = editableSnapshot.sections;
    setHtml(nextHtml);
    setSections(nextSections);
    setGlobalBackground(nextGlobalStyles.globalBackground);
    setGlobalBackgroundPattern(nextGlobalStyles.globalBackgroundPattern);
    setGlobalBackgroundCanvas(nextGlobalStyles.globalBackgroundCanvas);
    setPreviewPadding(nextGlobalStyles.previewPadding);
    setEmailWidth(nextGlobalStyles.emailWidth);
    setEmailBorderRadius(nextGlobalStyles.emailBorderRadius);
    setEmailBoxShadow(nextGlobalStyles.emailBoxShadow);
    setBodyTextInsetLeft(nextGlobalStyles.bodyTextInsetLeft);
    setBodyTextInsetRight(nextGlobalStyles.bodyTextInsetRight);
    setBodyContentMargin(nextGlobalStyles.bodyContentMargin);
    setBodyTextSize(nextGlobalStyles.bodyTextSize);
    setBodyTextColor(nextGlobalStyles.bodyTextColor);
    setCustomHead(nextCustomHead);
    setAiMessages(nextAiMessages);
    setAiMode("unknown");
    setAiError(null);
    setAiAttachments([]);
    setAiAttachmentError(null);
    resetBuilderHistory({
      html: nextHtml,
      sections: nextSections,
      globalBackground: nextGlobalStyles.globalBackground,
      globalBackgroundPattern: nextGlobalStyles.globalBackgroundPattern,
      globalBackgroundCanvas: nextGlobalStyles.globalBackgroundCanvas,
      previewPadding: nextGlobalStyles.previewPadding,
      emailWidth: nextGlobalStyles.emailWidth,
      emailBorderRadius: nextGlobalStyles.emailBorderRadius,
      emailBoxShadow: nextGlobalStyles.emailBoxShadow,
      bodyTextInsetLeft: nextGlobalStyles.bodyTextInsetLeft,
      bodyTextInsetRight: nextGlobalStyles.bodyTextInsetRight,
      bodyContentMargin: nextGlobalStyles.bodyContentMargin,
      bodyTextSize: nextGlobalStyles.bodyTextSize,
      bodyTextColor: nextGlobalStyles.bodyTextColor,
      customHead: nextCustomHead,
    });
    setSavedState("saved");
  }, [resetBuilderHistory]);

  const startBlankTemplate = useCallback(() => {
    const starterLayout = getStarterLayout(requestedStarter);
    const blankSections = createStarterLayoutSections(starterLayout);
    const starterLayoutHtml = joinSections(blankSections);
    pendingContentEditsRef.current = {};
    setTemplateId(null);
    setTemplateName(starterLayout.name);
    setSubject(starterLayout.subject);
    setPreheader(starterLayout.preheader);
    setFromName("Trigger Mail AI");
    setFromEmail("hello@triggermail.ai");
    setHtml(starterLayoutHtml);
    setSections(blankSections);
    setGlobalBackground(starterLayout.settings.globalBackground);
    setGlobalBackgroundPattern(starterLayout.settings.globalBackgroundPattern);
    setGlobalBackgroundCanvas(starterLayout.settings.globalBackgroundCanvas);
    setPreviewPadding(starterLayout.settings.previewPadding);
    setEmailWidth(starterLayout.settings.emailWidth);
    setEmailBorderRadius(starterLayout.settings.emailBorderRadius);
    setEmailBoxShadow(starterLayout.settings.emailBoxShadow);
    setBodyTextInsetLeft(0);
    setBodyTextInsetRight(0);
    setBodyContentMargin(0);
    setBodyTextSize(15);
    setBodyTextColor("#475569");
    setCustomHead("");
    setAiMessages(initialAiMessages);
    setAiMode("unknown");
    setAiError(null);
    setAiAttachments([]);
    setAiAttachmentError(null);
    resetBuilderHistory({
      html: starterLayoutHtml,
      sections: blankSections,
      globalBackground: starterLayout.settings.globalBackground,
      globalBackgroundPattern: starterLayout.settings.globalBackgroundPattern,
      globalBackgroundCanvas: starterLayout.settings.globalBackgroundCanvas,
      previewPadding: starterLayout.settings.previewPadding,
      emailWidth: starterLayout.settings.emailWidth,
      emailBorderRadius: starterLayout.settings.emailBorderRadius,
      emailBoxShadow: starterLayout.settings.emailBoxShadow,
      bodyTextInsetLeft: 0,
      bodyTextInsetRight: 0,
      bodyContentMargin: 0,
      bodyTextSize: 15,
      bodyTextColor: "#475569",
      customHead: "",
    });
    setSavedState("dirty");
  }, [requestedStarter, resetBuilderHistory]);

  function applyWholeEmailTemplate(layoutId: StarterLayoutId) {
    if (savedState === "dirty" && !window.confirm("Replace the current email with this whole template? Unsaved changes in this draft will be replaced.")) {
      return;
    }

    const isEditingSavedTemplate = Boolean(templateId);
    const starterLayout = starterLayouts[layoutId];
    const nextSections = createStarterLayoutSections(starterLayout);
    const starterLayoutHtml = joinSections(nextSections);
    pendingContentEditsRef.current = {};
    clearSelectedInspectTarget();
    if (!isEditingSavedTemplate) {
      setTemplateId(null);
      setTemplateName(starterLayout.name);
    }
    setSubject(starterLayout.subject);
    setPreheader(starterLayout.preheader);
    setFromName("Trigger Mail AI");
    setFromEmail("hello@triggermail.ai");
    setHtml(starterLayoutHtml);
    setSections(nextSections);
    setGlobalBackground(starterLayout.settings.globalBackground);
    setGlobalBackgroundPattern(starterLayout.settings.globalBackgroundPattern);
    setGlobalBackgroundCanvas(starterLayout.settings.globalBackgroundCanvas);
    setPreviewPadding(starterLayout.settings.previewPadding);
    setEmailWidth(starterLayout.settings.emailWidth);
    setEmailBorderRadius(starterLayout.settings.emailBorderRadius);
    setEmailBoxShadow(starterLayout.settings.emailBoxShadow);
    setBodyTextInsetLeft(0);
    setBodyTextInsetRight(0);
    setBodyContentMargin(0);
    setBodyTextSize(15);
    setBodyTextColor("#475569");
    setCustomHead("");
    setAiMessages(initialAiMessages);
    setAiMode("unknown");
    setAiError(null);
    setAiAttachments([]);
    setAiAttachmentError(null);
    setTextToolsSectionId(null);
    setImageToolsSectionId(null);
    setButtonToolsSectionId(null);
    setSectionEditor(null);
    setSectionDraft("");
    resetBuilderHistory({
      html: starterLayoutHtml,
      sections: nextSections,
      globalBackground: starterLayout.settings.globalBackground,
      globalBackgroundPattern: starterLayout.settings.globalBackgroundPattern,
      globalBackgroundCanvas: starterLayout.settings.globalBackgroundCanvas,
      previewPadding: starterLayout.settings.previewPadding,
      emailWidth: starterLayout.settings.emailWidth,
      emailBorderRadius: starterLayout.settings.emailBorderRadius,
      emailBoxShadow: starterLayout.settings.emailBoxShadow,
      bodyTextInsetLeft: 0,
      bodyTextInsetRight: 0,
      bodyContentMargin: 0,
      bodyTextSize: 15,
      bodyTextColor: "#475569",
      customHead: "",
    });
    markDirty();
  }

  useEffect(() => {
    let mounted = true;

    async function loadTemplate() {
      if (!requestedTemplateId) {
        startBlankTemplate();
        setLoading(false);
        setError(null);
        return;
      }

      if (!supabaseReady) {
        setLoading(false);
        setError("Supabase keys are missing, so saved templates cannot be loaded yet.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error: loadError } = await supabase
          .from("email_templates")
          .select("*")
          .eq("id", requestedTemplateId)
          .maybeSingle();

        if (loadError) {
          throw loadError;
        }

        if (mounted && data) {
          applyTemplate(data);
        } else if (mounted) {
          setError("That template could not be found.");
        }
      } catch (loadError) {
        if (mounted) {
          setError(getErrorMessage(loadError, "Template could not be loaded."));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadTemplate();

    return () => {
      mounted = false;
    };
  }, [applyTemplate, requestedTemplateId, startBlankTemplate, supabaseReady]);

  useEffect(() => {
    if (!loading && historyIndexRef.current === -1) {
      resetBuilderHistory({
        html,
        sections: cloneSections(sections),
        globalBackground,
        globalBackgroundPattern,
        globalBackgroundCanvas,
        previewPadding,
        emailWidth,
        emailBorderRadius,
        emailBoxShadow,
        bodyTextInsetLeft,
        bodyTextInsetRight,
        bodyContentMargin,
        bodyTextSize,
        bodyTextColor,
        customHead,
      });
    }
  }, [bodyContentMargin, bodyTextColor, bodyTextInsetLeft, bodyTextInsetRight, bodyTextSize, customHead, emailBorderRadius, emailBoxShadow, emailWidth, globalBackground, globalBackgroundCanvas, globalBackgroundPattern, html, loading, previewPadding, resetBuilderHistory, sections]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    void loadTemplateVersions();
  }, [loadTemplateVersions]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const nextSections = ensurePersistedBodyCanvas(sections);

    if (nextSections.length === sections.length) {
      return;
    }

    setSections(nextSections);
    setHtml(joinSections(nextSections));
  }, [loading, sections]);

  function insertHtmlAtCursor(sectionHtml: string) {
    const textarea = codeRef.current;
    if (!textarea) {
      const nextSections = [...sections];
      nextSections.splice(getBodyInsertIndex(nextSections), 0, createSection("Custom section", sectionHtml));
      commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const prefix = start > 0 && !html.slice(0, start).endsWith("\n") ? "\n\n" : "";
    const suffix = end < html.length && !html.slice(end).startsWith("\n") ? "\n\n" : "";
    const nextHtml = `${html.slice(0, start)}${prefix}${sectionHtml}${suffix}${html.slice(end)}`;
    const editableSnapshot = buildEditableHtmlSnapshot(nextHtml, "Custom HTML");
    commitBuilderSnapshot(getBuilderSnapshot(editableSnapshot));

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + prefix.length + sectionHtml.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function appendSection(sectionHtml: string) {
    if (isHeroPatternHtml(sectionHtml)) {
      replaceHeroPatternSection(sectionHtml);
      return;
    }

    if (isFooterPatternHtml(sectionHtml)) {
      replaceFooterPatternSection(sectionHtml);
      return;
    }

    const matchingSection = predesignedSections.find((section) => section.html === sectionHtml);
    const nextSections = removeEmptyBodyPlaceholder([...sections]);
    nextSections.splice(getBodyInsertIndex(nextSections), 0, createSection(matchingSection?.label || "Custom section", sectionHtml));
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function insertSectionAt(sectionHtml: string, index: number) {
    if (isHeroPatternHtml(sectionHtml)) {
      replaceHeroPatternSection(sectionHtml);
      return;
    }

    if (isFooterPatternHtml(sectionHtml)) {
      replaceFooterPatternSection(sectionHtml);
      return;
    }

    const matchingSection = predesignedSections.find((section) => section.html === sectionHtml);
    const nextSections = removeEmptyBodyPlaceholder([...sections]);
    const headerOffset = nextSections.some(isShellHeaderSection) ? 1 : 0;
    const footerIndex = nextSections.findIndex(isShellFooterSection);
    const nextIndex = Math.max(headerOffset, footerIndex === -1 ? index : Math.min(index, footerIndex));
    nextSections.splice(nextIndex, 0, createSection(matchingSection?.label || "Custom section", sectionHtml));
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function insertSectionAtBodyTop(sectionHtml: string) {
    if (isHeroPatternHtml(sectionHtml)) {
      replaceHeroPatternSection(sectionHtml);
      return;
    }

    if (isFooterPatternHtml(sectionHtml)) {
      replaceFooterPatternSection(sectionHtml);
      return;
    }

    const matchingSection = predesignedSections.find((section) => section.html === sectionHtml);
    const nextSections = removeEmptyBodyPlaceholder([...sections]);
    const headerOffset = nextSections.some(isShellHeaderSection) ? 1 : 0;
    nextSections.splice(headerOffset, 0, createSection(matchingSection?.label || "Custom section", sectionHtml));
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function replaceHeroPatternSection(sectionHtml: string) {
    const matchingSection = predesignedSections.find((section) => section.html === sectionHtml);
    const nextSections = sections.filter((section) => !isHeroPatternSection(section));
    const headerOffset = nextSections.some(isShellHeaderSection) ? 1 : 0;
    nextSections.splice(headerOffset, 0, createSection(matchingSection?.label || "Custom section", sectionHtml));
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function replaceFooterPatternSection(sectionHtml: string) {
    const matchingSection = predesignedSections.find((section) => section.html === sectionHtml);
    const nextSections = sections.filter((section) => !isFooterPatternSection(section));
    nextSections.splice(getBodyInsertIndex(nextSections), 0, createSection(matchingSection?.label || "Custom section", sectionHtml));
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function addSectionAt(index: number) {
    const nextSections = removeEmptyBodyPlaceholder([...sections]);
    const headerOffset = nextSections.some(isShellHeaderSection) ? 1 : 0;
    const footerIndex = nextSections.findIndex(isShellFooterSection);
    const nextIndex = Math.max(headerOffset, footerIndex === -1 ? index : Math.min(index, footerIndex));
    nextSections.splice(nextIndex, 0, createSection("New section", `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:28px 32px;font-family:Arial,sans-serif;color:#111827;">
  <tr>
    <td style="font-size:22px;line-height:1.3;font-weight:800;">New section</td>
  </tr>
  <tr>
    <td style="padding-top:10px;font-size:15px;line-height:1.6;color:#475569;">Add content here.</td>
  </tr>
</table>`.trim()));
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function addLogoHeader() {
    if (hasLogoHeader) {
      const header = displaySections.find(isShellHeaderSection);
      if (header) {
        openSectionEditor(header);
      }
      return;
    }

    const nextSections = orderShellSections([createSection("Logo header", buildLogoHeaderHtml()), ...sections]);
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function addFooterShell() {
    if (hasFooterShell) {
      const footer = displaySections.find(isShellFooterSection);
      if (footer) {
        openSectionEditor(footer);
      }
      return;
    }

    const nextSections = orderShellSections([...sections, createSection("Footer", buildFooterShellHtml())]);
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function applyLogoHeaderAlignment(alignment: "left" | "center" | "right") {
    if (!sectionEditor || !isShellHeaderSection(sectionEditor)) {
      return;
    }

    const logoHtml = extractFirstImageHtml(sectionEditor.html) || `<img src="https://placehold.co/180x48/png?text=Logo" alt="Logo" width="180" style="display:block;width:180px;max-width:70%;height:auto;border:0;" />`;
    const nextSections = sections.map((section) => section.id === sectionEditor.id ? { ...section, html: buildLogoHeaderHtml(logoHtml, alignment) } : section);
    const nextSelectedSection = nextSections.find((section) => section.id === sectionEditor.id) || null;

    setSectionEditor(nextSelectedSection);
    if (nextSelectedSection) {
      setSectionDraft(nextSelectedSection.html);
    }
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function applyFooterShellContent(nextContent: FooterShellContent) {
    if (!sectionEditor || !isShellFooterSection(sectionEditor)) {
      return;
    }

    const nextSections = sections.map((section) => section.id === sectionEditor.id ? { ...section, html: buildFooterShellHtml(nextContent) } : section);
    const nextSelectedSection = nextSections.find((section) => section.id === sectionEditor.id) || null;

    setSectionEditor(nextSelectedSection);
    if (nextSelectedSection) {
      setSectionDraft(nextSelectedSection.html);
    }
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function insertSnippet(snippetHtml: string) {
    if (sectionEditor && !codeOpen) {
      insertBodyElement(snippetHtml, sectionEditor.id);
      return;
    }

    insertHtmlAtCursor(snippetHtml);
  }

  function insertAsset(asset: TemplateAsset) {
    insertSnippet(buildAssetHtml(asset));
  }

  function insertContentImageAsset(asset: TemplateAsset) {
    insertSnippet(buildAssetHtml(asset));
    setContentAssetPicker(null);
  }

  function insertContentIcon(icon: (typeof iconOptions)[number]) {
    insertSnippet(buildIconBlockHtml(icon));
    setContentAssetPicker(null);
  }

  function handleContentBlockInsert(block: (typeof contentBlocks)[number]) {
    if (block.label === "Image") {
      setContentAssetPicker("image");
      return;
    }

    if (block.label === "Icon") {
      setContentAssetPicker("icon");
      return;
    }

    setContentAssetPicker(null);
    insertSnippet(block.html);
  }

  function getDraggedHtml(dataTransfer: DataTransfer) {
    return dataTransfer.getData("text/html") || dataTransfer.getData("text/plain");
  }

  function isLayoutBlockDrag(dataTransfer: DataTransfer) {
    return dataTransfer.getData(layoutBlockTransferType) === "true";
  }

  function isSnippetDrag(dataTransfer: DataTransfer) {
    return dataTransfer.getData(snippetTransferType) === "true";
  }

  function insertBodyElement(elementHtml: string, targetSectionId?: string) {
    const preparedElementHtml = prepareResizableBuilderHtml(elementHtml);
    const explicitTarget = targetSectionId ? sections.find((section) => section.id === targetSectionId) : sectionEditor;

    if (explicitTarget && isShellHeaderSection(explicitTarget)) {
      const imageHtml = extractFirstImageHtml(preparedElementHtml);
      if (!imageHtml) {
        setError("The logo header only accepts an image.");
        return;
      }

      const nextSections = sections.map((section) => section.id === explicitTarget.id ? { ...section, html: buildLogoHeaderHtml(imageHtml, getLogoHeaderAlignment(section.html)) } : section);
      commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
      return;
    }

    if (explicitTarget && isShellFooterSection(explicitTarget) && /<(img|table|video)\b/i.test(preparedElementHtml)) {
      setError("The footer only accepts text and social links.");
      return;
    }

    const placeholderSection = sections.find(isEmptyBodyPlaceholderSection);
    const lastBodySection = [...sections].reverse().find((section) => !isShellSection(section) && !isEmptyBodyPlaceholderSection(section));
    const targetId = targetSectionId || sectionEditor?.id || lastBodySection?.id;

    if (!targetId || targetId === placeholderSection?.id) {
      const nextSections = removeEmptyBodyPlaceholder([...sections]);
      nextSections.splice(getBodyInsertIndex(nextSections), 0, createSection("Email body", preparedElementHtml));
      commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
      return;
    }

    const nextSections = sections.map((section) => {
      if (section.id !== targetId) {
        return section;
      }

      return {
        ...section,
        html: `${section.html.trim()}\n\n${preparedElementHtml}`,
      };
    });
    const nextSelectedSection = nextSections.find((section) => section.id === targetId);

    if (sectionEditor?.id === targetId && nextSelectedSection) {
      setSectionEditor(nextSelectedSection);
      setSectionDraft(nextSelectedSection.html);
    }

    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function getDropInsertionElement(editableElement: HTMLElement, target: EventTarget | null) {
    let element = target instanceof HTMLElement ? target : null;

    while (element && element !== editableElement) {
      const parent = element.parentElement;

      if (parent === editableElement || element.hasAttribute("data-builder-block")) {
        return element;
      }

      element = parent;
    }

    return null;
  }

  function insertBodyElementAtDropPoint(elementHtml: string, sectionId: string, event: DragEvent<HTMLDivElement>) {
    const preparedElementHtml = prepareResizableBuilderHtml(elementHtml);
    const targetSection = sections.find((section) => section.id === sectionId);

    if (!targetSection) {
      insertBodyElement(elementHtml, sectionId);
      return;
    }

    if (isShellHeaderSection(targetSection) || isShellFooterSection(targetSection)) {
      insertBodyElement(elementHtml, sectionId);
      return;
    }

    const editableElement = getEditableSectionElement(sectionId);

    if (!editableElement) {
      insertBodyElement(elementHtml, sectionId);
      return;
    }

    const template = document.createElement("template");
    template.innerHTML = preparedElementHtml.trim();
    const fragment = template.content;

    if (!fragment.childNodes.length) {
      return;
    }

    const insertionElement = getDropInsertionElement(editableElement, event.target);

    if (insertionElement) {
      const rect = insertionElement.getBoundingClientRect();
      const insertBefore = event.clientY < rect.top + rect.height / 2;

      if (insertBefore) {
        insertionElement.before(fragment);
      } else {
        insertionElement.after(fragment);
      }
    } else {
      editableElement.append(fragment);
    }

    commitSectionContentEdit(sectionId, editableElement.innerHTML);
  }

  function insertLayoutBlock(blockHtml: string, targetSectionId?: string) {
    insertBodyElement(blockHtml, targetSectionId);
  }

  function getPromptText(prompt: string) {
    const cleanedPrompt = prompt.trim().replace(/\s+/g, " ");
    return cleanedPrompt.charAt(0).toUpperCase() + cleanedPrompt.slice(1);
  }

  function buildAiParagraph(prompt: string) {
    const promptText = getPromptText(prompt);

    return `<p style="font-size:15px;line-height:1.6;color:#475569;">${escapeHtml(promptText)}</p>`;
  }

  function updateSelectedTextWithAiCopy(prompt: string) {
    if (!textToolsSectionId) {
      return false;
    }

    const target = getActiveTextTarget(textToolsSectionId);

    if (!target) {
      return false;
    }

    const currentText = target.textContent?.trim() || "your message";
    const lowerPrompt = prompt.toLowerCase();
    const nextText = lowerPrompt.includes("short")
      ? currentText.split(/[.!?]\s/).slice(0, 2).join(". ").trim() || currentText
      : lowerPrompt.includes("friendly")
        ? `${currentText.replace(/[.!?]*$/, "")}. We are excited to help you take the next step.`
        : getPromptText(prompt);

    target.textContent = nextText;
    syncTextToolsHtml(textToolsSectionId);
    markDirty();
    return true;
  }

  function applyAiPromptToEmail(prompt: string) {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes("subject")) {
      const nextSubject = lowerPrompt.includes("welcome")
        ? "Welcome to Trigger Mail AI"
        : lowerPrompt.includes("payment")
          ? "Your payment confirmation"
          : lowerPrompt.includes("trial")
            ? "Your trial is ready"
            : getPromptText(prompt).replace(/^subject[:\s-]*/i, "").slice(0, 86);
      setSubject(nextSubject);
      markDirty();
      return `I updated the subject line to "${nextSubject}".`;
    }

    if (lowerPrompt.includes("preheader")) {
      const nextPreheader = lowerPrompt.includes("payment")
        ? "Your account has been updated and your payment details are below."
        : lowerPrompt.includes("welcome")
          ? "Everything you need to get started is inside."
          : getPromptText(prompt).replace(/^preheader[:\s-]*/i, "").slice(0, 120);
      setPreheader(nextPreheader);
      markDirty();
      return "I updated the preheader text.";
    }

    if (lowerPrompt.includes("footer") || lowerPrompt.includes("unsubscribe")) {
      const footerSection = predesignedSections.find((section) => section.label === "Footer");

      if (footerSection) {
        appendSection(footerSection.html);
        return "I added a footer section with preference and unsubscribe text.";
      }
    }

    if (lowerPrompt.includes("cta") || lowerPrompt.includes("button") || lowerPrompt.includes("call to action")) {
      insertBodyElement(`<p style="padding-top:22px;"><a href="https://example.com" style="display:inline-block;background:#d946ef;color:#ffffff;text-decoration:none;border-radius:8px;padding:13px 24px;font-size:14px;font-weight:700;">${lowerPrompt.includes("pay") ? "View payment" : "Get started"}</a></p>`);
      return "I added a CTA button to the email.";
    }

    if (lowerPrompt.includes("friendly") || lowerPrompt.includes("short") || lowerPrompt.includes("rewrite") || lowerPrompt.includes("change text")) {
      if (updateSelectedTextWithAiCopy(prompt)) {
        return "I updated the selected text in the preview.";
      }
    }

    insertBodyElement(buildAiParagraph(prompt));
    return "I added that copy to the email body.";
  }

  async function submitAiPrompt(promptOverride?: string) {
    const targetSectionId = aiTargetSectionId;
    const prompt = (promptOverride ?? aiPrompt).trim() || (aiAttachments.length > 0 ? "Use the attached files as inspiration and improve this selected section." : "");

    if (!prompt) {
      return;
    }

    if (!targetSectionId) {
      setAiError("Select a section in the preview before using the section assistant.");
      return;
    }

    setAiWorking(true);
    setAiError(null);
    setAiWorkingStatus("Preparing the selected section...");
    setAiPrompt("");
    const attachmentsForMessage = aiAttachments;
    const attachmentSummary = attachmentsForMessage.length > 0
      ? `\n\nAttached: ${attachmentsForMessage.map((attachment) => attachment.name).join(", ")}`
      : "";
    setAiAttachments([]);
    setAiAttachmentError(null);
    setAiMessages((currentMessages) => [...currentMessages, { role: "user", content: `${prompt}${attachmentSummary}` }]);
    markDirty();

    try {
      const token = await getAccessToken();
      const sectionsForAi = getSectionsWithPendingContentEdits();
      const selectedSection = sectionsForAi.find((section) => section.id === targetSectionId);

      if (!selectedSection) {
        throw new Error("Select a section in the preview before using the section assistant.");
      }

      const selectedText = textToolsSectionId === targetSectionId ? getActiveTextTarget(targetSectionId)?.textContent?.trim() : "";
      setAiWorkingStatus(attachmentsForMessage.length > 0
        ? `Inspecting ${attachmentsForMessage.length} attached reference file${attachmentsForMessage.length === 1 ? "" : "s"} for ${selectedSection.label}...`
        : `Reading ${selectedSection.label}...`);
      const response = await fetch("/api/templates/ai", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          messages: aiMessages,
          template: {
            name: templateName,
            subject,
            preheader,
            html: selectedSection.html,
            selectedText,
            selectedSection: {
              id: selectedSection.id,
              label: selectedSection.label,
              html: selectedSection.html,
            },
          },
          attachments: attachmentsForMessage.map(({ id: _id, ...attachment }) => attachment),
        }),
      });
      const payload = (await response.json()) as AiTemplateResponse;

      if (!response.ok) {
        throw new Error(payload.error || "The AI assistant could not update the template.");
      }

      setAiWorkingStatus(payload.generatedAssets?.length ? "Saving generated image assets..." : payload.action === "update" ? "Applying the generated template updates..." : "Preparing the assistant response...");

      if (payload.generatedAssets?.length) {
        setAssets((currentAssets) => {
          const existingPaths = new Set(currentAssets.map((asset) => asset.path));
          const nextAssets = payload.generatedAssets?.filter((asset) => !existingPaths.has(asset.path)) || [];
          return [...nextAssets, ...currentAssets];
        });
      }
      setAiMode(payload.mode === "demo" ? "demo" : "ai");

      if (payload.action === "update" && payload.html) {
        const nextSectionHtml = payload.html.trim();
        const nextSections = sectionsForAi.map((section) => section.id === selectedSection.id ? { ...section, html: nextSectionHtml } : section);
        pendingContentEditsRef.current = Object.fromEntries(Object.entries(pendingContentEditsRef.current).filter(([id]) => id !== selectedSection.id));
        setAiWorkingStatus(`Updating ${selectedSection.label} in the preview...`);
        commitBuilderSnapshot(getBuilderSnapshot({
          html: joinSections(nextSections),
          sections: nextSections,
        }));
        setAiMessages((currentMessages) => [
          ...currentMessages,
          {
            role: "assistant",
            content: formatAiReply(payload.reply || "I updated the email draft.", {
              action: payload.action,
              sectionCount: 1,
              mode: payload.mode,
              attachmentNotes: payload.attachmentNotes,
              generatedAssets: payload.generatedAssets,
            }),
          },
        ]);
      } else {
        setAiMessages((currentMessages) => [
          ...currentMessages,
          {
            role: "assistant",
            content: formatAiReply(payload.reply || "Tell me a bit more about what you want this email to do.", {
              action: payload.action,
              mode: payload.mode,
              attachmentNotes: payload.attachmentNotes,
              generatedAssets: payload.generatedAssets,
            }),
          },
        ]);
      }
    } catch (aiError) {
      const errorMessage = getErrorMessage(aiError, "AI request failed.");
      setAiError(errorMessage);
      setAiMessages((currentMessages) => [
        ...currentMessages,
        { role: "assistant", content: `I could not reach the AI service, so I did not change the template. ${errorMessage}` },
      ]);
    } finally {
      setAiWorkingStatus("");
      setAiWorking(false);
    }
  }

  function handleAiSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitAiPrompt();
  }

  function buildDetectedTestData() {
    const defaults: Record<string, string> = {
      first_name: "Alex",
      name: "Alex Morgan",
      company: "Acme Co",
      email: testEmailTo || "alex@example.com",
    };

    return Object.fromEntries(detectedVariables.map((variable) => [variable, defaults[variable] || `Example ${variable.replace(/_/g, " ")}`]));
  }

  function useDetectedTestData() {
    setTestHandlebarData(JSON.stringify(buildDetectedTestData(), null, 2));
    setTestSendError(null);
    setTestSendMessage(null);
    setTestSendHtmlPreview("");
  }

  async function sendTestEmail() {
    setTestSending(true);
    setTestSendError(null);
    setTestSendMessage(null);
    setTestSendHtmlPreview("");

    try {
      let handlebarData: Record<string, unknown>;

      try {
        const parsedData = JSON.parse(testHandlebarData || "{}") as unknown;

        if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) {
          throw new Error("Use a JSON object for the test data.");
        }

        handlebarData = parsedData as Record<string, unknown>;
      } catch (parseError) {
        throw new Error(getErrorMessage(parseError, "The handlebar data is not valid JSON."));
      }

      const sectionsForSend = ensurePersistedBodyCanvas(getSectionsWithPendingContentEdits());
      const token = await getAccessToken();
      const response = await fetch("/api/templates/test-send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: testEmailTo,
          subject,
          preheader,
          fromName,
          fromEmail,
          html: joinSections(sectionsForSend),
          customHead,
          globalStyles: {
            globalBackground,
            globalBackgroundPattern,
            globalBackgroundCanvas,
            previewPadding,
            emailWidth,
            emailBorderRadius,
            emailBoxShadow,
            bodyTextInsetLeft,
            bodyTextInsetRight,
            bodyContentMargin,
            bodyTextSize,
            bodyTextColor,
          },
          data: handlebarData,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; id?: string; error?: string; attemptedEmail?: { htmlPreview?: string; includesBodyCard?: boolean; patternImageUrl?: string } };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "The test email could not be sent.");
      }

      const includesBodyCard = Boolean(payload.attemptedEmail?.includesBodyCard);
      const patternImageUrl = payload.attemptedEmail?.patternImageUrl || "";
      setTestSendHtmlPreview(payload.attemptedEmail?.htmlPreview || "");
      setTestSendMessage(`Test email sent to ${testEmailTo}. Body card payload: ${includesBodyCard ? "included" : "not detected"}.${patternImageUrl ? ` Pattern image: ${patternImageUrl}` : ""}`);
    } catch (sendError) {
      setTestSendError(getErrorMessage(sendError, "The test email could not be sent."));
    } finally {
      setTestSending(false);
    }
  }

  function getCurrentFullHtml() {
    const currentHtml = joinSections(ensurePersistedBodyCanvas(getSectionsWithPendingContentEdits()));
    const fullHtml = buildPreviewDocument(currentHtml, preheader, customHead);

    return exportMinified ? fullHtml.replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim() : fullHtml;
  }

  async function copyTextToClipboard(value: string, successMessage: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCodeCopyMessage(successMessage);
      window.setTimeout(() => setCodeCopyMessage(null), 1800);
    } catch {
      setCodeCopyMessage("Copy failed");
      window.setTimeout(() => setCodeCopyMessage(null), 1800);
    }
  }

  async function copyFullHtml() {
    await copyTextToClipboard(getCurrentFullHtml(), "Full HTML copied");
    setExportCopied(true);
    window.setTimeout(() => setExportCopied(false), 1800);
  }

  function copyActiveCodeSheet() {
    const message = codeSheet === "emailBody" ? "Body HTML copied" : codeSheet === "outsideBody" ? "Outside body copied" : "Document head copied";

    void copyTextToClipboard(activeCode, message);
  }

  function downloadFullHtml() {
    const blob = new Blob([getCurrentFullHtml()], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeName = templateName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "template";

    anchor.href = url;
    anchor.download = `${safeName}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function syncPreviewEditsToCode() {
    const sectionsForSync = ensurePersistedBodyCanvas(getSectionsWithPendingContentEdits());
    pendingContentEditsRef.current = {};
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(sectionsForSync), sections: sectionsForSync }));
  }

  function resetCustomHead() {
    commitBuilderSnapshot(getBuilderSnapshot({ customHead: "" }));
  }

  function mergeShellSections(existingShellSections: EmailSection[], incomingShellSections: EmailSection[]) {
    const incomingHeader = incomingShellSections.find(isShellHeaderSection);
    const incomingFooter = incomingShellSections.find(isShellFooterSection);
    const existingHeader = existingShellSections.find(isShellHeaderSection);
    const existingFooter = existingShellSections.find(isShellFooterSection);

    return [incomingHeader || existingHeader, incomingFooter || existingFooter].filter(Boolean) as EmailSection[];
  }

  function applyBodyCodeChange(nextCode: string, label = "Custom HTML", incomingHeadHtml = "") {
    const splitCode = splitEmailDocumentCode(nextCode);
    const nextBodyCode = splitCode.wasSplit ? splitCode.bodyHtml : nextCode;
    const nextCustomHead = mergeDocumentHeadCode(splitCode.wasSplit ? mergeDocumentHeadCode(customHead, splitCode.headHtml) : customHead, incomingHeadHtml);
    const existingShellSections = sections.filter(isShellSection);

    if (!nextBodyCode.trim()) {
      const nextSections = orderShellSections(existingShellSections);
      commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections, customHead: nextCustomHead }));
    } else {
      const editableSnapshot = buildEditableHtmlSnapshot(nextBodyCode, label);
      const incomingShellSections = editableSnapshot.sections.filter(isShellSection);
      const nextBodySections = editableSnapshot.sections.filter((section) => !isShellSection(section));
      const nextSections = orderShellSections([...mergeShellSections(existingShellSections, incomingShellSections), ...nextBodySections]);

      commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections, customHead: nextCustomHead }));
    }

    if (splitCode.wasSplit) {
      setCodeCopyMessage("Moved head code to Document head");
      window.setTimeout(() => setCodeCopyMessage(null), 2200);
    }
  }

  function applyOutsideBodyCodeChange(nextCode: string, label = "Outside body", incomingHeadHtml = "") {
    const splitCode = splitEmailDocumentCode(nextCode);
    const nextOutsideCode = splitCode.wasSplit ? splitCode.bodyHtml : nextCode;
    const nextCustomHead = mergeDocumentHeadCode(splitCode.wasSplit ? mergeDocumentHeadCode(customHead, splitCode.headHtml) : customHead, incomingHeadHtml);
    const currentBodySections = sections.filter((section) => !isShellSection(section));

    if (!nextOutsideCode.trim()) {
      const nextSections = orderShellSections(currentBodySections);
      commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections, customHead: nextCustomHead }));
      return;
    }

    const editableSnapshot = buildEditableHtmlSnapshot(nextOutsideCode, label, true);
    const nextShellSections = editableSnapshot.sections.filter(isShellSection);
    const nextSections = orderShellSections([...nextShellSections, ...currentBodySections]);

    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections, customHead: nextCustomHead }));

    if (splitCode.wasSplit) {
      setCodeCopyMessage("Moved head code to Document head");
      window.setTimeout(() => setCodeCopyMessage(null), 2200);
    }
  }

  function handleCodePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pastedText = event.clipboardData.getData("text");

    if (!pastedText || !isFullEmailDocument(pastedText)) {
      return;
    }

    event.preventDefault();

    const splitCode = splitEmailDocumentCode(pastedText);

    if (codeSheet === "documentHead") {
      const nextCode = mergeDocumentHeadCode(customHead, splitCode.headHtml || pastedText);
      commitBuilderSnapshot(getBuilderSnapshot({ customHead: nextCode }));
      setCodeCopyMessage(splitCode.bodyHtml ? "Added document head only" : "Added head code");
      window.setTimeout(() => setCodeCopyMessage(null), 2200);
      return;
    }

    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextSheetCode = `${activeCode.slice(0, start)}${splitCode.bodyHtml}${activeCode.slice(end)}`;

    if (codeSheet === "outsideBody") {
      applyOutsideBodyCodeChange(nextSheetCode, "Outside body", splitCode.headHtml);
    } else {
      applyBodyCodeChange(nextSheetCode, "Custom HTML", splitCode.headHtml);
    }
    setCodeCopyMessage(codeSheet === "outsideBody" ? "Split paste into Outside body and Document head" : "Split paste into Body and Document head");
    window.setTimeout(() => setCodeCopyMessage(null), 2200);

    requestAnimationFrame(() => {
      const cursor = start + splitCode.bodyHtml.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function handleCodeDrop(event: DragEvent<HTMLTextAreaElement>) {
    if (codeSheet !== "emailBody") {
      return;
    }

    const sectionHtml = getDraggedHtml(event.dataTransfer);
    if (!sectionHtml) {
      return;
    }

    event.preventDefault();
    setDropTarget(null);

    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const prefix = start > 0 && !emailBodyCode.slice(0, start).endsWith("\n") ? "\n\n" : "";
    const suffix = end < emailBodyCode.length && !emailBodyCode.slice(end).startsWith("\n") ? "\n\n" : "";
    const nextHtml = `${emailBodyCode.slice(0, start)}${prefix}${sectionHtml}${suffix}${emailBodyCode.slice(end)}`;
    applyBodyCodeChange(nextHtml);

    requestAnimationFrame(() => {
      const cursor = start + prefix.length + sectionHtml.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function handleCodeScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (codeHighlightRef.current) {
      codeHighlightRef.current.scrollTop = event.currentTarget.scrollTop;
      codeHighlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }

    if (codeLineNumbersRef.current) {
      codeLineNumbersRef.current.scrollTop = event.currentTarget.scrollTop;
    }
  }

  function handlePreviewDrop(event: DragEvent<HTMLDivElement>) {
    const sectionHtml = getDraggedHtml(event.dataTransfer);
    if (!sectionHtml) {
      return;
    }

    event.preventDefault();
    setDropTarget(null);

    if (isLayoutBlockDrag(event.dataTransfer) || isSnippetDrag(event.dataTransfer)) {
      insertBodyElement(sectionHtml);
      return;
    }

    appendSection(sectionHtml);
  }

  function handleSectionDrop(event: DragEvent<HTMLDivElement>, sectionId: string) {
    const sectionHtml = getDraggedHtml(event.dataTransfer);
    if (!sectionHtml || (!isLayoutBlockDrag(event.dataTransfer) && !isSnippetDrag(event.dataTransfer))) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDropTarget(null);
    insertBodyElementAtDropPoint(sectionHtml, sectionId, event);
  }

  function handleSectionContentMouseUp(event: MouseEvent<HTMLDivElement>, sectionId: string) {
    const resizedBlock = (event.target as HTMLElement | null)?.closest("[data-builder-block]");

    if (!resizedBlock) {
      return;
    }

    const nextSectionHtml = event.currentTarget.innerHTML;
    const currentSection = sections.find((section) => section.id === sectionId);

    if (!currentSection || currentSection.html.trim() === nextSectionHtml.trim()) {
      return;
    }

    const nextSections = sections.map((section) => section.id === sectionId ? { ...section, html: nextSectionHtml } : section);
    const nextSelectedSection = nextSections.find((section) => section.id === sectionId);

    if (sectionEditor?.id === sectionId && nextSelectedSection) {
      setSectionEditor(nextSelectedSection);
      setSectionDraft(nextSelectedSection.html);
    }

    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function commitSectionContentEdit(sectionId: string, nextSectionHtml: string) {
    const currentSection = sections.find((section) => section.id === sectionId);
    pendingContentEditsRef.current = Object.fromEntries(Object.entries(pendingContentEditsRef.current).filter(([id]) => id !== sectionId));

    if (!currentSection || currentSection.html.trim() === nextSectionHtml.trim()) {
      return;
    }

    const nextSections = sections.map((section) => section.id === sectionId ? { ...section, html: nextSectionHtml } : section);
    const nextSelectedSection = nextSections.find((section) => section.id === sectionId);

    if (sectionEditor?.id === sectionId && nextSelectedSection) {
      setSectionEditor(nextSelectedSection);
      setSectionDraft(nextSelectedSection.html);
    }

    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function handleBuilderBlockResizeMouseDown(event: MouseEvent<HTMLDivElement>, sectionId: string) {
    const handle = (event.target as HTMLElement | null)?.closest("[data-builder-resize-handle]") as HTMLElement | null;

    const contentElement = event.currentTarget;

    if (!handle) {
      const image = (event.target as HTMLElement | null)?.closest("img") as HTMLImageElement | null;

      if (!image || !contentElement.contains(image)) {
        return;
      }

      const imageRect = image.getBoundingClientRect();
      const isResizeCorner = event.clientX >= imageRect.right - 24 && event.clientY >= imageRect.bottom - 24;

      if (!isResizeCorner) {
        return;
      }

      const resizeImage = image;
      selectPreviewImage(sectionId, resizeImage);

      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = Number(resizeImage.getAttribute("width")) || imageRect.width;
      const maxWidth = contentElement.getBoundingClientRect().width;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;

      const handlePointerMove = (pointerEvent: PointerEvent) => {
        const nextWidth = Math.min(maxWidth, Math.max(80, Math.round(startWidth + pointerEvent.clientX - startX)));
        const resizeBlock = resizeImage.closest('[data-builder-block="image"]') as HTMLElement | null;
        if (resizeBlock) {
          resizeBlock.style.width = `${nextWidth}px`;
          resizeBlock.style.maxWidth = "100%";
        }
        resizeImage.width = nextWidth;
        resizeImage.style.width = resizeBlock ? "100%" : `${nextWidth}px`;
        resizeImage.style.maxWidth = "100%";
        resizeImage.style.height = "auto";
        setElementWidthDraft(nextWidth);
      };

      const handlePointerUp = () => {
        const nextSectionHtml = contentElement.innerHTML;
        const nextSections = sections.map((section) => section.id === sectionId ? { ...section, html: nextSectionHtml } : section);
        const nextSelectedSection = nextSections.find((section) => section.id === sectionId);

        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);

        if (sectionEditor?.id === sectionId && nextSelectedSection) {
          setSectionEditor(nextSelectedSection);
          setSectionDraft(nextSelectedSection.html);
        }

        commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
      };

      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      return;
    }

    const block = handle.closest("[data-builder-block]") as HTMLElement | null;

    if (!block) {
      return;
    }

    const resizeBlock = block;

    event.preventDefault();
    event.stopPropagation();

    const axis = handle.dataset.builderResizeHandle || "both";
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = resizeBlock.getBoundingClientRect().width;
    const startHeight = resizeBlock.getBoundingClientRect().height;
    const maxWidth = contentElement.getBoundingClientRect().width;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    function handlePointerMove(pointerEvent: PointerEvent) {
      const nextWidth = Math.min(maxWidth, Math.max(80, Math.round(startWidth + pointerEvent.clientX - startX)));
      const nextHeight = Math.max(24, Math.round(startHeight + pointerEvent.clientY - startY));

      if (axis !== "vertical") {
        resizeBlock.style.width = `${nextWidth}px`;
        resizeBlock.style.maxWidth = "100%";
        if (resizeBlock.dataset.builderBlock === "image") {
          const blockImage = resizeBlock.querySelector("img") as HTMLImageElement | null;
          if (blockImage) {
            blockImage.width = nextWidth;
            blockImage.style.width = "100%";
            blockImage.style.maxWidth = "100%";
            blockImage.style.height = "auto";
          }
          setElementWidthDraft(nextWidth);
        }
      }

      if (axis !== "horizontal") {
        resizeBlock.style.height = `${nextHeight}px`;
      }
    }

    function handlePointerUp() {
      const nextSectionHtml = contentElement.innerHTML;
      const nextSections = sections.map((section) => section.id === sectionId ? { ...section, html: nextSectionHtml } : section);
      const nextSelectedSection = nextSections.find((section) => section.id === sectionId);

      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      if (sectionEditor?.id === sectionId && nextSelectedSection) {
        setSectionEditor(nextSelectedSection);
        setSectionDraft(nextSelectedSection.html);
      }

      commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
    }

    document.body.style.cursor = axis === "vertical" ? "ns-resize" : axis === "horizontal" ? "ew-resize" : "nwse-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function startDividerResize(event: MouseEvent<HTMLButtonElement>, dividerIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    const targetIndex = dividerIndex > 0 ? dividerIndex - 1 : 0;
    const targetSection = sections[targetIndex];

    if (!targetSection) {
      return;
    }

    const sectionElement = document.querySelector(`[data-preview-section="${targetSection.id}"]`);
    const startY = event.clientY;
    const startHeight = sectionElement?.getBoundingClientRect().height || 120;
    let latestSections = sections;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    function handlePointerMove(pointerEvent: PointerEvent) {
      const nextHeight = Math.max(80, Math.round(startHeight + pointerEvent.clientY - startY));
      latestSections = sections.map((section) => section.id === targetSection.id ? { ...section, html: buildSectionMinHeightHtml(section.html, nextHeight) } : section);
      setSections(latestSections);
      setHtml(joinSections(latestSections));
    }

    function handlePointerUp() {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(latestSections), sections: latestSections }));
    }

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleSlotDrop(event: DragEvent<HTMLDivElement>, index: number) {
    const sectionHtml = getDraggedHtml(event.dataTransfer);
    if (!sectionHtml) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDropTarget(null);

    if (isLayoutBlockDrag(event.dataTransfer) || isSnippetDrag(event.dataTransfer)) {
      insertSectionAt(sectionHtml, index);
      return;
    }

    insertSectionAt(sectionHtml, index);
  }

  function handleBodyInsertDrop(event: DragEvent<HTMLDivElement>, index: number) {
    const sectionHtml = getDraggedHtml(event.dataTransfer);
    if (!sectionHtml) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDropTarget(null);

    if (isLayoutBlockDrag(event.dataTransfer) || isSnippetDrag(event.dataTransfer)) {
      insertSectionAt(sectionHtml, index);
      return;
    }

    insertSectionAt(sectionHtml, index);
  }

  function removeSection(sectionId: string) {
    const nextSections = sections.filter((section) => section.id !== sectionId);
    if (sectionEditor?.id === sectionId) {
      setSectionEditor(null);
      setSectionLabelDraft("");
      setSectionDraft("");
    }
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function openSectionEditor(section: EmailSection) {
    const visualParts = getVisualSectionParts(section.html);
    setSectionEditor(section);
    setSectionLabelDraft(section.label);
    setSectionDraft(section.html);
    setSectionBackgroundDraft(getStyleValue(visualParts.style, "background") || "#ffffff");
    setSectionPaddingDraft(getSpacingSides(visualParts.style, "padding"));
    setSectionMarginDraft(getSpacingSides(visualParts.style, "margin"));
    setSectionTextColorDraft(getStyleValue(visualParts.style, "color") || "#111827");
    setSectionWaveTopDraft(getSectionWaveStyle(visualParts.style, "top"));
    setSectionWaveBottomDraft(getSectionWaveStyle(visualParts.style, "bottom"));
  }

  function renderOutsideBodyControls(position: "top" | "bottom") {
    const addOutside = position === "top" ? addLogoHeader : addFooterShell;
    const outsideExists = position === "top" ? hasLogoHeader : hasFooterShell;

    if (outsideExists) {
      return null;
    }

    return (
      <div className="group relative h-12">
        <div className="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 bg-white/55 opacity-0 transition group-hover:opacity-100" />
        <button
          aria-label={`Add ${position === "top" ? "top" : "bottom"} outside body section`}
          className="absolute left-1/2 top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/45 bg-white/90 text-slate-700 opacity-0 shadow-sm transition group-hover:opacity-100 hover:scale-105 hover:border-fuchsia-300 hover:bg-white hover:text-fuchsia-700 hover:shadow-md"
          onClick={addOutside}
          type="button"
          title="Add outside body"
        >
          <Plus size={16} strokeWidth={2.4} />
        </button>
      </div>
    );
  }

  function renderSectionDropSlot(index: number, label = "Drop") {
    return (
      <div
        className={`group relative h-4 transition-all duration-200 ${dropTarget === `slot-${index}` ? "h-12 bg-fuchsia-500/10" : "hover:h-12 hover:bg-fuchsia-500/5"}`}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDropTarget(`slot-${index}`);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "copy";
          setDropTarget(`slot-${index}`);
        }}
        onDrop={(event) => handleSlotDrop(event, index)}
      >
        <div className={`absolute left-4 right-4 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-fuchsia-500 transition ${dropTarget === `slot-${index}` ? "opacity-100" : "opacity-0 group-hover:opacity-70"}`} />
        <div className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-fuchsia-300/60 bg-white px-1.5 py-1 text-slate-700 shadow-lg transition ${dropTarget === `slot-${index}` ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <button aria-label="Add section here" className="grid size-6 place-items-center rounded-full text-fuchsia-600 transition hover:bg-fuchsia-50" onClick={() => addSectionAt(index)} type="button">
            <Plus size={14} />
          </button>
          <span className="px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-fuchsia-600">{label}</span>
          <button aria-label="Resize nearby section" className="grid h-6 w-7 cursor-row-resize place-items-center rounded-full text-slate-500 transition hover:bg-slate-100" onMouseDown={(event) => startDividerResize(event, index)} type="button">
            <Minus size={14} />
          </button>
        </div>
      </div>
    );
  }

  function renderBodyAddControl(insertIndex: number, position: "top" | "bottom") {
    return (
      <div
        className={`group relative ${position === "top" ? "h-0 overflow-visible rounded-t-[10px]" : "h-12 rounded-b-[10px]"} ${dropTarget === `slot-${insertIndex}` ? "bg-fuchsia-500/10" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDropTarget(`slot-${insertIndex}`);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "copy";
          setDropTarget(`slot-${insertIndex}`);
        }}
        onDrop={(event) => handleBodyInsertDrop(event, insertIndex)}
      >
        <div className="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 bg-fuchsia-200 opacity-0 transition group-hover:opacity-100" />
        <button
          aria-label={`Add section at the ${position} of the body`}
          className="absolute left-1/2 top-1/2 z-10 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-fuchsia-200 bg-white text-fuchsia-700 opacity-0 shadow-sm transition group-hover:opacity-100 hover:scale-105 hover:border-fuchsia-300 hover:shadow-md"
          onClick={() => addSectionAt(insertIndex)}
          title="Add section"
          type="button"
        >
          <Plus size={17} strokeWidth={2.4} />
        </button>
      </div>
    );
  }

  function renderBlankBodyCanvas(insertIndex: number) {
    return (
      <div className="min-h-[520px] rounded-[10px] bg-white">
        {renderBodyAddControl(insertIndex, "top")}
        <div className="min-h-[424px]" />
        {renderBodyAddControl(insertIndex, "bottom")}
      </div>
    );
  }

  function syncEditableSectionHtml(element: HTMLDivElement | null, nextHtml: string) {
    if (!element) {
      return;
    }

    const activeElement = document.activeElement;
    const isActivelyEditing = activeElement === element || (activeElement instanceof Node && element.contains(activeElement));

    if (isActivelyEditing) {
      return;
    }

    if (element.innerHTML !== nextHtml) {
      element.innerHTML = nextHtml;
    }
  }

  function renderEditablePreviewSection(section: EmailSection) {
    const sectionIsWholeEmailBody = previewUsesWholeEmailBody && isWholeEmailSection(section);
    const sectionIsShell = isShellSection(section);
    const sectionIsShellFooter = isShellFooterSection(section);
    const sectionIsHeroPattern = isHeroPatternSection(section);
    const sectionIsFooterPattern = isFooterPatternSection(section);
    const renderedSectionHtml = pendingContentEditsRef.current[section.id] ?? section.html;

    return (
      <div
        data-preview-section={section.id}
        className={sectionIsWholeEmailBody
          ? "group relative w-full cursor-pointer overflow-hidden"
          : sectionIsHeroPattern
            ? `group absolute inset-x-0 top-0 z-0 cursor-grab overflow-hidden transition active:cursor-grabbing ${sectionEditor?.id === section.id ? "bg-fuchsia-500/[0.03] ring-2 ring-inset ring-fuchsia-400/90 shadow-[0_0_0_3px_rgba(217,70,239,0.14)]" : "hover:bg-fuchsia-500/[0.025] hover:ring-2 hover:ring-inset hover:ring-fuchsia-400/80 hover:shadow-[0_0_0_3px_rgba(217,70,239,0.10)]"}`
            : sectionIsFooterPattern
              ? `group absolute inset-x-0 bottom-0 z-0 cursor-grab overflow-hidden transition active:cursor-grabbing ${sectionEditor?.id === section.id ? "bg-fuchsia-500/[0.03] ring-2 ring-inset ring-fuchsia-400/90 shadow-[0_0_0_3px_rgba(217,70,239,0.14)]" : "hover:bg-fuchsia-500/[0.025] hover:ring-2 hover:ring-inset hover:ring-fuchsia-400/80 hover:shadow-[0_0_0_3px_rgba(217,70,239,0.10)]"}`
            : `group relative z-10 cursor-grab border-2 transition active:cursor-grabbing ${sectionEditor?.id === section.id ? "border-fuchsia-400/90 bg-fuchsia-500/[0.03] shadow-[0_0_0_3px_rgba(217,70,239,0.14)]" : "border-transparent hover:border-fuchsia-400/80 hover:bg-fuchsia-500/[0.025] hover:shadow-[0_0_0_3px_rgba(217,70,239,0.10)]"}`}
        style={{ cursor: sectionIsWholeEmailBody ? "pointer" : sectionIsShellFooter ? "text" : "grab" }}
        onDragOver={(event) => {
          if (!isLayoutBlockDrag(event.dataTransfer) && !isSnippetDrag(event.dataTransfer)) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => handleSectionDrop(event, section.id)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openSectionEditor(section);
        }}
        onMouseLeave={() => clearHoveredInspectTarget(section.id)}
      >
        <div className="pointer-events-none absolute right-2 top-2 z-10 hidden max-w-[calc(100%-16px)] flex-wrap items-center gap-1 rounded-[7px] border border-slate-200 bg-white/95 p-1 shadow-lg group-hover:flex">
            <span className="px-2 text-[11px] font-semibold text-slate-500">{sectionIsShell ? `${section.label} slot` : section.label}</span>
            {!sectionIsShell && (
              <label className="pointer-events-auto relative grid size-7 !cursor-pointer place-items-center rounded-[6px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-950" onClick={(event) => event.stopPropagation()} title="Section background">
                <span className="size-4 rounded-full border border-slate-300 shadow-inner" style={{ backgroundColor: getSectionBackgroundColor(renderedSectionHtml) }} />
                <input
                  aria-label={`Change ${section.label} background`}
                  className="absolute inset-0 !cursor-pointer opacity-0"
                  type="color"
                  value={getSectionBackgroundColor(renderedSectionHtml)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation();
                    updateSectionBackground(section, event.target.value);
                  }}
                />
              </label>
            )}
            <button
              aria-label={`Edit ${section.label}`}
              className="pointer-events-auto grid size-7 !cursor-pointer place-items-center rounded-[6px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
              onClick={(event) => {
                event.stopPropagation();
                openSectionEditor(section);
              }}
              type="button"
            >
              <Pencil size={14} />
            </button>
            {!sectionIsWholeEmailBody && (
            <button
              aria-label={`Remove ${section.label}`}
              className="pointer-events-auto grid size-7 !cursor-pointer place-items-center rounded-[6px] text-red-500 transition hover:bg-red-50"
              onClick={(event) => {
                event.stopPropagation();
                removeSection(section.id);
              }}
              type="button"
            >
              <Trash2 size={14} />
            </button>
            )}
          </div>
        <button
          aria-label="Remove hovered element"
          className="absolute z-20 hidden h-7 !cursor-pointer items-center gap-1 rounded-[7px] border border-white/15 bg-slate-950/90 px-2 text-[11px] font-semibold text-white opacity-95 shadow-lg backdrop-blur transition hover:border-red-300/70 hover:bg-red-500"
          data-hover-remove-section={section.id}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            removeHoveredElement(section.id);
          }}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            removeHoveredElement(section.id);
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            removeHoveredElement(section.id);
          }}
          style={{ display: "none", top: 0, left: 0 }}
          type="button"
        >
          <Trash2 size={12} />
          Remove
        </button>
        <div
          data-editable-section={section.id}
          ref={(element) => syncEditableSectionHtml(element, renderedSectionHtml)}
          className={`${sectionIsWholeEmailBody ? "block w-full overflow-hidden [&_table]:w-full [&_table]:max-w-full" : sectionIsHeroPattern ? "block w-full [&_table]:w-full [&_table]:max-w-full" : "min-h-[24px]"} cursor-text select-text outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60 [&_a]:cursor-pointer [&_div]:cursor-text [&_h1]:cursor-text [&_h2]:cursor-text [&_h3]:cursor-text [&_h4]:cursor-text [&_h5]:cursor-text [&_h6]:cursor-text [&_li]:cursor-text [&_p]:cursor-text [&_span]:cursor-text [&_table]:cursor-text [&_td]:cursor-text [&_th]:cursor-text [&_[data-builder-block]]:cursor-move`}
          style={{ cursor: sectionIsWholeEmailBody ? "pointer" : "text" }}
          contentEditable
          suppressContentEditableWarning
          onBlur={(event) => {
            commitSectionContentEdit(section.id, event.currentTarget.innerHTML);
          }}
          onClick={(event) => {
            event.stopPropagation();
            const image = (event.target as HTMLElement | null)?.closest("img") as HTMLImageElement | null;

            if (image) {
              selectPreviewImage(section.id, image);
              return;
            }

            const button = (event.target as HTMLElement | null)?.closest("a") as HTMLAnchorElement | null;

            if (button) {
              selectPreviewButton(section.id, button);
              return;
            }

            saveTextSelection(section.id, event.target);
          }}
          onKeyUp={(event) => saveTextSelection(section.id, event.target)}
          onInput={(event) => markSectionContentEditing(section.id, event.currentTarget.innerHTML, { silent: true })}
          onDragEnter={(event) => {
            if (!isLayoutBlockDrag(event.dataTransfer) && !isSnippetDrag(event.dataTransfer)) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
          }}
          onDragOver={(event) => {
            if (!isLayoutBlockDrag(event.dataTransfer) && !isSnippetDrag(event.dataTransfer)) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => handleSectionDrop(event, section.id)}
          onMouseDown={(event) => handleBuilderBlockResizeMouseDown(event, section.id)}
          onMouseMove={(event) => hoverInspectTarget(section.id, event.target)}
          onMouseUp={(event) => {
            const image = (event.target as HTMLElement | null)?.closest("img") as HTMLImageElement | null;

            if (image) {
              selectPreviewImage(section.id, image);
            } else {
              const button = (event.target as HTMLElement | null)?.closest("a") as HTMLAnchorElement | null;

              if (button) {
                selectPreviewButton(section.id, button);
              } else {
                saveTextSelection(section.id, event.target);
              }
            }
            handleSectionContentMouseUp(event, section.id);
          }}
        />
      </div>
    );
  }

  function renderStaticPreviewSection(section: EmailSection) {
    const sectionIsWholeEmailBody = previewUsesWholeEmailBody && isWholeEmailSection(section);
    const sectionIsHeroPattern = isHeroPatternSection(section);
    const sectionIsFooterPattern = isFooterPatternSection(section);
    const renderedSectionHtml = pendingContentEditsRef.current[section.id] ?? section.html;

    return (
      <div className={sectionIsWholeEmailBody ? "block w-full overflow-hidden [&_table]:w-full [&_table]:max-w-full" : sectionIsHeroPattern ? "absolute inset-x-0 top-0 z-0 block w-full overflow-hidden [&_table]:w-full [&_table]:max-w-full" : sectionIsFooterPattern ? "absolute inset-x-0 bottom-0 z-0 block w-full overflow-hidden [&_table]:w-full [&_table]:max-w-full" : "relative z-10 min-h-[24px]"} dangerouslySetInnerHTML={{ __html: renderedSectionHtml }} />
    );
  }

  function saveSectionDraft() {
    if (!sectionEditor) {
      return;
    }

    const currentSections = getSectionsWithPendingContentEdits();
    const nextSections = currentSections.map((section) => section.id === sectionEditor.id ? { ...section, label: sectionLabelDraft || "Section", html: sectionDraft } : section);
    setSectionEditor(nextSections.find((section) => section.id === sectionEditor.id) || null);
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function applySectionVisualStyles() {
    if (!sectionEditor) {
      return;
    }

    const currentSections = getSectionsWithPendingContentEdits();
    const currentSection = currentSections.find((section) => section.id === sectionEditor.id) || sectionEditor;
    const nextSectionHtml = buildVisualSectionHtml(currentSection.html, sectionBackgroundDraft, sectionPaddingDraft, sectionMarginDraft, sectionTextColorDraft, sectionWaveTopDraft, sectionWaveBottomDraft);
    const nextSections = currentSections.map((section) => section.id === sectionEditor.id ? { ...section, label: sectionLabelDraft || "Section", html: nextSectionHtml } : section);
    const nextSelectedSection = nextSections.find((section) => section.id === sectionEditor.id) || null;
    setSectionEditor(nextSelectedSection);
    setSectionDraft(nextSectionHtml);
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function updateSectionBackground(section: EmailSection, background: string) {
    if (isShellSection(section)) {
      return;
    }

    const currentSections = getSectionsWithPendingContentEdits();
    const nextSections = currentSections.map((item) => item.id === section.id ? { ...item, html: buildSectionBackgroundHtml(item.html, background) } : item);
    const nextSelectedSection = nextSections.find((item) => item.id === section.id) || null;

    if (sectionEditor?.id === section.id && nextSelectedSection) {
      setSectionEditor(nextSelectedSection);
      setSectionDraft(nextSelectedSection.html);
      setSectionBackgroundDraft(background);
    }

    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function updateSectionWave(section: EmailSection, position: "top" | "bottom") {
    if (isShellSection(section)) {
      return;
    }

    const currentSections = getSectionsWithPendingContentEdits();
    const currentSection = currentSections.find((item) => item.id === section.id) || section;
    const visualParts = getVisualSectionParts(currentSection.html);
    const currentTop = getSectionWaveStyle(visualParts.style, "top");
    const currentBottom = getSectionWaveStyle(visualParts.style, "bottom");
    const nextStyle = buildSectionVisualStyle(visualParts.style, {
      waveTop: position === "top" ? !currentTop : currentTop,
      waveBottom: position === "bottom" ? !currentBottom : currentBottom,
    });
    const nextHtml = buildSectionWrapperHtml(visualParts.innerHtml, nextStyle);
    const nextSections = currentSections.map((item) => item.id === section.id ? { ...item, html: nextHtml } : item);
    const nextSelectedSection = nextSections.find((item) => item.id === section.id) || null;

    if (sectionEditor?.id === section.id && nextSelectedSection) {
      setSectionEditor(nextSelectedSection);
      setSectionDraft(nextSelectedSection.html);
      setSectionWaveTopDraft(getSectionWaveStyle(nextStyle, "top"));
      setSectionWaveBottomDraft(getSectionWaveStyle(nextStyle, "bottom"));
    }

    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function duplicateSection(section: EmailSection) {
    const currentSections = getSectionsWithPendingContentEdits();
    const currentIndex = currentSections.findIndex((item) => item.id === section.id);
    const nextSections = [...currentSections];
    nextSections.splice(currentIndex + 1, 0, createSection(`${section.label} copy`, section.html));
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function closeSectionEditor() {
    setSectionEditor(null);
    setSectionLabelDraft("");
    setSectionDraft("");
    setSectionBackgroundDraft("#ffffff");
    setSectionPaddingDraft(emptySpacingSides);
    setSectionMarginDraft(emptySpacingSides);
    setSectionTextColorDraft("#111827");
    setSectionWaveTopDraft(false);
    setSectionWaveBottomDraft(false);
  }

  function closeInspectorOverlays() {
    setImageToolsSectionId(null);
    setButtonToolsSectionId(null);
    setTextToolsSectionId(null);
    clearSelectedInspectTarget();
    activeImageTargetRef.current = null;
    activeImageIdRef.current = null;
    activeButtonTargetRef.current = null;
    activeTextTargetRef.current = null;
    activeTextRangeRef.current = null;
    closeSectionEditor();
  }

  function switchInspectorTab(tabId: InspectorMode) {
    closeInspectorOverlays();
    setInspectorMode(tabId);
  }

  function startSidebarResize() {
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    function handlePointerMove(event: PointerEvent) {
      const maxWidth = Math.min(sidebarMaxWidth, Math.max(sidebarMinWidth, Math.floor(window.innerWidth * 0.55)));
      const nextWidth = Math.min(maxWidth, Math.max(sidebarMinWidth, Math.round(window.innerWidth - event.clientX)));
      setSidebarWidth(nextWidth);
    }

    function handlePointerUp() {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  async function handleSave(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    setSaving(true);
    setError(null);

    try {
      const sectionsForSave = ensurePersistedBodyCanvas(getSectionsWithPendingContentEdits());
      const htmlForSave = joinSections(sectionsForSave);
      pendingContentEditsRef.current = {};
      setSections(sectionsForSave);
      setHtml(htmlForSave);
      const token = await getAccessToken();
      const response = await fetch(templateId ? `/api/templates/${templateId}` : "/api/templates", {
        method: templateId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: templateName,
          subject,
          preheader,
          fromName,
          fromEmail,
          folderId: templateId ? undefined : requestedFolderId,
          html: htmlForSave,
          customHead,
          globalStyles: {
            globalBackground,
            globalBackgroundPattern,
            globalBackgroundCanvas,
            previewPadding,
            emailWidth,
            emailBorderRadius,
            emailBoxShadow,
            bodyTextInsetLeft,
            bodyTextInsetRight,
            bodyContentMargin,
            bodyTextSize,
            bodyTextColor,
          },
          aiMessages: aiMessages.slice(-80),
        }),
      });
      const payload = (await response.json()) as { template?: EmailTemplate; error?: string };

      if (!response.ok || !payload.template) {
        throw new Error(payload.error || "Template could not be saved.");
      }

      applyTemplate(payload.template);
      if (!templateId) {
        router.replace(`/templates/welcome-email?template=${payload.template.id}`, { scroll: false });
      }
      setSavedState("saved");
      setShowSavedReturnAction(true);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Template could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAsNewTemplate() {
    setSavingAsNew(true);
    setError(null);

    try {
      const sectionsForSave = ensurePersistedBodyCanvas(getSectionsWithPendingContentEdits());
      const htmlForSave = joinSections(sectionsForSave);
      const nextName = templateId ? `${templateName || "Untitled Template"} copy` : templateName;
      pendingContentEditsRef.current = {};
      setSections(sectionsForSave);
      setHtml(htmlForSave);
      const token = await getAccessToken();
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nextName,
          subject,
          preheader,
          fromName,
          fromEmail,
          folderId: requestedFolderId,
          html: htmlForSave,
          customHead,
          globalStyles: {
            globalBackground,
            globalBackgroundPattern,
            globalBackgroundCanvas,
            previewPadding,
            emailWidth,
            emailBorderRadius,
            emailBoxShadow,
            bodyTextInsetLeft,
            bodyTextInsetRight,
            bodyContentMargin,
            bodyTextSize,
            bodyTextColor,
          },
          aiMessages: aiMessages.slice(-80),
        }),
      });
      const payload = (await response.json()) as { template?: EmailTemplate; error?: string };

      if (!response.ok || !payload.template) {
        throw new Error(payload.error || "Template could not be saved as a new template.");
      }

      applyTemplate(payload.template);
      router.replace(`/templates/welcome-email?template=${payload.template.id}`, { scroll: false });
      setSavedState("saved");
      setShowSavedReturnAction(true);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Template could not be saved as a new template."));
    } finally {
      setSavingAsNew(false);
    }
  }

  useEffect(() => {
    saveTemplateRef.current = () => {
      void handleSave();
    };
  });

  useEffect(() => {
    if (!autoSaveEnabled || savedState !== "dirty" || saving || loading || !templateId) {
      return;
    }

    const timer = window.setTimeout(() => {
      saveTemplateRef.current?.();
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [aiMessages, autoSaveEnabled, bodyContentMargin, bodyTextColor, bodyTextInsetLeft, bodyTextInsetRight, bodyTextSize, customHead, dirtyVersion, emailBorderRadius, emailBoxShadow, emailWidth, fromEmail, fromName, globalBackground, globalBackgroundCanvas, globalBackgroundPattern, loading, preheader, previewPadding, savedState, saving, subject, templateId, templateName]);

  return (
    <AppShell
      eyebrow="Email Builder"
      title={templateName}
      description="Edit the email settings, code, and live preview in one workspace."
      primaryAction="Save"
      secondaryAction="Templates"
      primaryActionOnClick={() => { void handleSave(); }}
      primaryActionDisabled={saving || loading}
      primaryActionHidden={autoSaveEnabled}
      primaryActionAccessory={(
        <label className="inline-flex h-9 items-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] px-2.5 text-[13px] font-semibold text-slate-200">
          Autosave
          <button
            aria-checked={autoSaveEnabled}
            aria-label="Toggle autosave"
            className={`relative h-5 w-9 rounded-full border transition ${autoSaveEnabled ? "border-fuchsia-400/60 bg-fuchsia-500" : "border-white/10 bg-white/[0.08]"}`}
            onClick={() => setAutoSaveEnabled((enabled) => !enabled)}
            role="switch"
            type="button"
          >
            <span className={`absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-white shadow-sm transition ${autoSaveEnabled ? "left-5" : "left-1"}`} />
          </button>
        </label>
      )}
      secondaryActionHref="/templates"
    >
      <style>
        {`
          [data-body-text-inset] p,
          [data-body-text-inset] h1,
          [data-body-text-inset] h2,
          [data-body-text-inset] h3,
          [data-body-text-inset] h4,
          [data-body-text-inset] h5,
          [data-body-text-inset] h6,
          [data-body-text-inset] li,
          [data-body-text-inset] blockquote {
            box-sizing: border-box;
            padding-left: var(--body-text-inset-left);
            padding-right: var(--body-text-inset-right);
          }
          [data-body-text-inset] p,
          [data-body-text-inset] li,
          [data-body-text-inset] blockquote,
          [data-body-text-inset] td,
          [data-body-text-inset] div,
          [data-body-text-inset] span {
            color: var(--body-text-color);
            font-size: var(--body-text-size);
          }
        `}
      </style>
      <section ref={builderRef} className="fixed bottom-0 left-0 right-0 top-[58px] z-20 min-w-0 overflow-hidden bg-[#070b12] lg:left-[64px]">
        <form className="flex h-full min-w-0 flex-col" id="save-template" onSubmit={handleSave} style={{ paddingRight: sidebarWidth }}>
          {error && (
            <div className="mx-4 mt-4 rounded-[8px] border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[13px] text-amber-200">
              {error}
            </div>
          )}
          {showSavedReturnAction && !error && (
            <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[13px] text-emerald-100">
              <span>Template saved.</span>
              <Link className="inline-flex h-8 items-center rounded-[7px] bg-emerald-300 px-3 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-200" href="/templates">
                Return to templates
              </Link>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
            <div>
              <p className="text-sm font-semibold text-white">{previewMode === "builder" ? "Builder preview" : "Inbox preview"}</p>
              <p className="mt-1 text-xs text-slate-500">{previewMode === "builder" ? "Drag sections onto the editable preview." : "Generated with the same renderer used for sent emails."}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-[8px] border border-white/10 bg-white/[0.04] p-1">
                {[
                  { id: "builder" as const, label: "Builder" },
                  { id: "inbox" as const, label: "Inbox" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    className={`h-8 rounded-[6px] px-3 text-xs font-semibold transition ${previewMode === mode.id ? "bg-violet-brand text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
                    onClick={() => setPreviewMode(mode.id)}
                    type="button"
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <div className="flex rounded-[8px] border border-white/10 bg-white/[0.04] p-1">
                <button aria-label="Desktop preview" className={`grid size-8 place-items-center rounded-[6px] ${viewMode === "desktop" ? "bg-violet-brand text-white" : "text-slate-400"}`} onClick={() => setViewMode("desktop")} type="button">
                  <Laptop size={16} />
                </button>
                <button aria-label="Mobile preview" className={`grid size-8 place-items-center rounded-[6px] ${viewMode === "mobile" ? "bg-violet-brand text-white" : "text-slate-400"}`} onClick={() => setViewMode("mobile")} type="button">
                  <Smartphone size={16} />
                </button>
              </div>
            </div>
          </div>

          <div
            className={`flex flex-1 items-start justify-center overflow-auto transition ${dropTarget === "preview" ? "ring-2 ring-inset ring-fuchsia-400/60" : ""}`}
            style={{ ...previewBackgroundStyle, padding: previewPadding }}
            onDragEnter={() => setDropTarget("preview")}
            onDragLeave={() => setDropTarget(null)}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setDropTarget("preview");
            }}
            onDrop={handlePreviewDrop}
          >
            {loading ? (
              <div className="flex items-center gap-2 self-center text-sm text-slate-400">
                <Loader2 className="animate-spin" size={17} />
                Loading template...
              </div>
            ) : (
              <div
                className={`max-w-full transition-all ${viewMode === "mobile" ? "w-[375px]" : "w-full"}`}
                style={viewMode === "desktop" ? { maxWidth: emailWidth } : undefined}
              >
                {previewMode === "inbox" ? (
                  <iframe
                    className="min-h-[720px] w-full rounded-[10px] border border-white/10 bg-white shadow-2xl"
                    sandbox=""
                    srcDoc={sendPreviewHtml}
                    title="Inbox render preview"
                  />
                ) : displaySections.length === 0 ? (
                  <>
                    {renderOutsideBodyControls("top")}
                    <div data-body-text-inset className="min-h-[520px] overflow-hidden rounded-[10px] bg-white ring-1 ring-white/10" style={{ ...emailPreviewFrameStyle, ...bodyTextInsetStyle }}>
                      {renderBlankBodyCanvas(0)}
                    </div>
                    {renderOutsideBodyControls("bottom")}
                  </>
                ) : (
                  <>
                    {headerSection && renderEditablePreviewSection(headerSection)}
                    {renderOutsideBodyControls("top")}
                      <div
                        data-body-text-inset
                        className={previewUsesWholeEmailBody ? "relative overflow-hidden rounded-[10px] bg-transparent" : "relative flex min-h-[520px] flex-col overflow-hidden rounded-[10px] bg-white ring-1 ring-white/10"}
                        style={{ ...emailPreviewFrameStyle, ...bodyTextInsetStyle }}
                      >
                      <div style={{ display: "none", maxHeight: 0, overflow: "hidden", opacity: 0 }}>{preheader}</div>
                      {bodySections.length === 0 ? (
                        renderBlankBodyCanvas(getBodyInsertIndex(displaySections))
                      ) : (
                        <>
                          {bodyPatternSections.map((section) => renderEditablePreviewSection(section))}
                          {bodyFooterPatternSections.map((section) => renderEditablePreviewSection(section))}
                          {!previewUsesWholeEmailBody && renderBodyAddControl(getBodyInsertIndex(displaySections), "top")}
                          <div className={previewUsesWholeEmailBody ? undefined : "relative z-10"} style={previewUsesWholeEmailBody ? undefined : { padding: bodyContentMargin }}>
                            {bodyContentSections.map((section, bodySectionIndex) => {
                              const displayIndex = displaySections.findIndex((displaySection) => displaySection.id === section.id);
                              return (
                                <div key={section.id} className={previewUsesWholeEmailBody && isWholeEmailSection(section) ? "w-full overflow-hidden" : undefined}>
                                  {!previewUsesWholeEmailBody && bodySectionIndex > 0 && renderSectionDropSlot(Math.max(0, displayIndex))}
                                  {renderEditablePreviewSection(section)}
                                </div>
                              );
                            })}
                          </div>
                          {!previewUsesWholeEmailBody && <div className="relative z-10 min-h-0 flex-1" />}
                          {!previewUsesWholeEmailBody && renderBodyAddControl(getBodyInsertIndex(displaySections), "bottom")}
                        </>
                      )}
                    </div>
                    {renderOutsideBodyControls("bottom")}
                    {footerSection && renderEditablePreviewSection(footerSection)}
                  </>
                )}
              </div>
            )}
          </div>
        </form>

        <aside className="fixed bottom-0 right-0 top-[58px] z-40 flex min-h-0 flex-col border-l border-white/10 bg-[#0D121C] p-2.5 shadow-[-18px_0_44px_rgba(0,0,0,0.32)]" style={{ width: sidebarWidth }}>
          <button
            aria-label="Resize editor panel"
            aria-valuemax={sidebarMaxWidth}
            aria-valuemin={sidebarMinWidth}
            aria-valuenow={sidebarWidth}
            className="group absolute -left-1.5 top-0 z-40 hidden h-full w-3 cursor-col-resize touch-none border-x border-transparent outline-none transition hover:border-fuchsia-400/40 focus-visible:border-fuchsia-400/80 xl:block"
            onPointerDown={(event) => {
              event.preventDefault();
              startSidebarResize();
            }}
            role="separator"
            type="button"
          >
            <span className="absolute left-1/2 top-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15 transition group-hover:bg-fuchsia-400/70" />
          </button>
          <div className="grid min-h-0 flex-1 grid-cols-[38px_minmax(0,1fr)]">
            <nav className="flex min-h-0 flex-col items-center gap-1.5 border-r border-white/10 pr-1.5">
              <Link href="/templates" aria-label="Back to templates" className="group relative grid size-8 place-items-center rounded-[7px] border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-fuchsia-400/50 hover:text-white" onClick={closeInspectorOverlays}>
                <ArrowLeft size={17} />
                <span className="pointer-events-none absolute left-10 top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-[6px] border border-white/10 bg-[#05070d] px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover:opacity-100">Templates</span>
              </Link>

              <div className="my-2 h-px w-7 bg-white/10" />

              {inspectorTabs.map((tab) => (
                <button
                  key={tab.id}
                  aria-label={tab.label}
                  className={`group relative grid size-8 place-items-center rounded-[7px] transition ${inspectorMode === tab.id ? "bg-violet-brand text-white shadow-lg shadow-violet-brand/20" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
                  onClick={() => switchInspectorTab(tab.id)}
                  type="button"
                >
                  <tab.icon size={17} />
                  <span className="pointer-events-none absolute left-10 top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-[6px] border border-white/10 bg-[#05070d] px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover:opacity-100">{tab.label}</span>
                </button>
              ))}

              <div className="mt-auto grid gap-2">
                <button aria-label="Undo" className="group relative grid size-8 place-items-center rounded-[7px] text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-slate-400" disabled={!canUndo} onClick={undoBuilder} type="button">
                  <Undo2 size={17} />
                  <span className="pointer-events-none absolute left-10 top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-[6px] border border-white/10 bg-[#05070d] px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover:opacity-100">Undo</span>
                </button>
                <button aria-label="Redo" className="group relative grid size-8 place-items-center rounded-[7px] text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-slate-400" disabled={!canRedo} onClick={redoBuilder} type="button">
                  <Redo2 size={17} />
                  <span className="pointer-events-none absolute left-10 top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-[6px] border border-white/10 bg-[#05070d] px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover:opacity-100">Redo</span>
                </button>
                <div className="h-px w-7 bg-white/10" />
                <button aria-label="Open code editor" className="group relative grid size-8 place-items-center rounded-[7px] text-slate-400 transition hover:bg-white/10 hover:text-white" onClick={() => setCodeOpen(true)} type="button">
                  <Code2 size={17} />
                  <span className="pointer-events-none absolute left-10 top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-[6px] border border-white/10 bg-[#05070d] px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover:opacity-100">Code editor</span>
                </button>
                {!autoSaveEnabled && (
                  <button aria-label="Save template" className="group relative grid size-8 place-items-center rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={saving || loading} form="save-template" type="submit">
                    {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
                    <span className="pointer-events-none absolute left-10 top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-[6px] border border-white/10 bg-[#05070d] px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover:opacity-100">Save</span>
                  </button>
                )}
              </div>
            </nav>

            <div className={`min-h-0 pl-2.5 ${inspectorMode === "ai" ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}>
              <div className="mb-3">
                <p className="truncate text-sm font-semibold text-white">{templateName}</p>
                <p className="text-xs text-slate-500">{loading ? "Loading" : saving ? "Saving" : savedState === "saved" ? "Saved" : autoSaveEnabled ? "Autosave pending" : "Unsaved changes"}</p>
              </div>

              {inspectorMode === "build" && (
                <div>
                  {activeSectionCategory ? (
                    <>
                      <button className="mb-3 inline-flex h-8 items-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] px-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10" onClick={() => setActiveSectionCategoryId(null)} type="button">
                        <ArrowLeft size={14} />
                        Categories
                      </button>
                      <div className="mb-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{activeSectionCategory.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{activeSectionCategory.description}</p>
                      </div>
                      <div className="grid gap-3">
                        {activeSectionExamples.map((section) => (
                          <button
                            key={section.label}
                            className="group w-full overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.04] text-left transition hover:border-fuchsia-400/50 hover:bg-white/10"
                            draggable
                            onClick={() => activeSectionCategory.id === "hero-patterns" || activeSectionCategory.id === "footer-patterns" ? insertSectionAtBodyTop(section.html) : appendSection(section.html)}
                            onDragEnd={() => setDropTarget(null)}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "copy";
                              event.dataTransfer.setData("text/html", section.html);
                              event.dataTransfer.setData("text/plain", section.html);
                            }}
                            type="button"
                          >
                            <span className="block h-[132px] overflow-hidden border-b border-white/10 bg-slate-100">
                              <iframe
                                className="pointer-events-none h-[300px] w-[620px] origin-top-left scale-[0.49] bg-white"
                                sandbox=""
                                srcDoc={buildPreviewDocument(section.html, "", "")}
                                title={`${section.label} preview`}
                              />
                            </span>
                            <span className="grid grid-cols-[auto_1fr_auto] items-center gap-2 p-2.5">
                              <span className="grid size-8 place-items-center rounded-[7px] bg-violet-brand/15 text-fuchsia-300">
                                <section.icon size={15} />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] font-semibold text-white">{section.label}</span>
                                <span className="mt-0.5 block truncate text-xs text-slate-500">{section.description}</span>
                              </span>
                              <GripVertical size={15} className="text-slate-600 transition group-hover:text-slate-400" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Section categories</p>
                      <div className="space-y-2">
                        {sectionCategories.map((category) => (
                          <button
                            key={category.id}
                            className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] p-2 text-left transition hover:border-fuchsia-400/40 hover:bg-white/10"
                            onClick={() => setActiveSectionCategoryId(category.id)}
                            type="button"
                          >
                            <span className="grid size-8 place-items-center rounded-[7px] bg-violet-brand/15 text-fuchsia-300">
                              <category.icon size={15} />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-semibold text-white">{category.label}</span>
                              <span className="mt-0.5 block truncate text-xs text-slate-500">{category.description}</span>
                            </span>
                            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-slate-400">{category.examples.length}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {inspectorMode === "templates" && (
                <div>
                  <div className="mb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Templates</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Choose a complete email template. This replaces the current draft.</p>
                  </div>
                  <div className="grid gap-3">
                    {(Object.entries(starterLayouts) as Array<[StarterLayoutId, (typeof starterLayouts)[StarterLayoutId]]>).map(([layoutId, layout]) => (
                      <article key={layoutId} className="overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.04] transition hover:border-fuchsia-400/40 hover:bg-white/[0.07]">
                        <div className="h-[188px] overflow-hidden border-b border-white/10 bg-slate-100">
                          <iframe
                            className="pointer-events-none h-full w-full bg-white"
                            loading="lazy"
                            sandbox=""
                            srcDoc={buildMiniPreviewDocument(layout.html, layout.preheader)}
                            title={`${layout.name} preview`}
                          />
                        </div>
                        <div className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-[13px] font-semibold text-white">{layout.name}</p>
                            <span className="shrink-0 rounded-full bg-violet-400/10 px-2 py-0.5 text-[11px] font-semibold text-violet-300">{layout.category}</span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{layout.description}</p>
                          <div className="mt-2 rounded-[7px] border border-white/10 bg-black/10 p-2">
                            <p className="truncate text-[11px] text-slate-400">Subject: <span className="text-slate-200">{layout.subject}</span></p>
                            <p className="mt-1 truncate text-[11px] text-slate-400">Preheader: <span className="text-slate-300">{layout.preheader}</span></p>
                            <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px] font-semibold text-slate-400">
                              <span className="rounded-[6px] bg-white/[0.04] px-1.5 py-1">Width {layout.settings.emailWidth}px</span>
                              <span className="rounded-[6px] bg-white/[0.04] px-1.5 py-1">Pad {layout.settings.previewPadding}px</span>
                              <span className="flex items-center gap-1 rounded-[6px] bg-white/[0.04] px-1.5 py-1">
                                <span className="size-2 rounded-full border border-white/20" style={{ backgroundColor: layout.settings.globalBackground }} />
                                BG
                              </span>
                            </div>
                          </div>
                          <button
                            className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-3 text-xs font-semibold text-white transition hover:brightness-110"
                            onClick={() => applyWholeEmailTemplate(layoutId)}
                            type="button"
                          >
                            Use template
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {inspectorMode === "content" && (
                <div>
                  <div className="mb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Content</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Add common email elements to the selected section or the current draft.</p>
                  </div>
                  <div className="mb-3 grid gap-2 rounded-[8px] border border-white/10 bg-white/[0.03] p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Email shell</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className={`grid min-h-[78px] gap-1 rounded-[7px] border p-2 text-left transition ${hasLogoHeader ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-white/[0.04] hover:border-fuchsia-400/40 hover:bg-white/10"}`}
                        onClick={addLogoHeader}
                        type="button"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-white">
                          <ImageIcon size={14} />
                          {hasLogoHeader ? "Edit logo" : "Add logo"}
                        </span>
                        <span className="text-xs leading-5 text-slate-500">One header above the body. Images only.</span>
                      </button>
                      <button
                        className={`grid min-h-[78px] gap-1 rounded-[7px] border p-2 text-left transition ${hasFooterShell ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-white/[0.04] hover:border-fuchsia-400/40 hover:bg-white/10"}`}
                        onClick={addFooterShell}
                        type="button"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-white">
                          <Plus size={14} />
                          {hasFooterShell ? "Edit footer" : "Add footer"}
                        </span>
                        <span className="text-xs leading-5 text-slate-500">One footer below the body. Text/socials only.</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {contentBlocks.map((block) => (
                      <button
                        key={block.label}
                        className="group flex h-[92px] flex-col items-center justify-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] p-2 text-center transition hover:border-fuchsia-400/40 hover:bg-white/10"
                        draggable
                        onClick={() => handleContentBlockInsert(block)}
                        onDragEnd={() => setDropTarget(null)}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "copy";
                          event.dataTransfer.setData(snippetTransferType, "true");
                          event.dataTransfer.setData("text/html", block.html);
                          event.dataTransfer.setData("text/plain", block.html);
                        }}
                        type="button"
                      >
                        <block.icon className="text-slate-300 transition group-hover:text-white" size={24} />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-400 transition group-hover:text-slate-200">{block.label}</span>
                      </button>
                    ))}
                  </div>
                  {contentAssetPicker && (
                    <div className="mt-3 rounded-[8px] border border-white/10 bg-white/[0.03] p-2.5">
                      {contentAssetPicker === "image" ? (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-white">Choose image</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">Insert a saved asset into the selected section.</p>
                            </div>
                            <button className="inline-flex h-8 shrink-0 items-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={assetUploading} onClick={() => assetInputRef.current?.click()} type="button">
                              {assetUploading ? <Loader2 className="animate-spin" size={14} /> : <UploadCloud size={14} />}
                              Upload
                            </button>
                          </div>
                          <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1">
                            {assets.filter((asset) => getAssetKind(asset) === "image").length === 0 ? (
                              <div className="rounded-[7px] border border-dashed border-white/15 bg-black/10 p-4 text-center">
                                <ImageIcon className="mx-auto text-slate-500" size={22} />
                                <p className="mt-2 text-sm font-semibold text-white">No image assets</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">Upload an image, GIF, or SVG, then choose it here.</p>
                              </div>
                            ) : (
                              assets.filter((asset) => getAssetKind(asset) === "image").map((asset) => (
                                <button
                                  key={asset.path}
                                  className="grid grid-cols-[56px_1fr] gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] p-2 text-left transition hover:border-fuchsia-400/50 hover:bg-white/10"
                                  onClick={() => insertContentImageAsset(asset)}
                                  type="button"
                                >
                                  <span className="h-12 rounded-[6px] bg-cover bg-center" style={{ backgroundImage: `url(${asset.url})` }} />
                                  <span className="min-w-0">
                                    <span className="block truncate text-[13px] font-semibold text-white">{asset.name.replace(/^\d+-/, "")}</span>
                                    <span className="mt-1 block text-xs text-slate-500">{formatAssetSize(asset.size)}</span>
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-white">Choose icon</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">Insert a simple email-safe symbol.</p>
                            </div>
                            <button className="grid size-8 place-items-center rounded-[7px] border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={() => setContentAssetPicker(null)} type="button">
                              <X size={14} />
                            </button>
                          </div>
                          <div className="mt-3 grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1">
                            {iconOptions.map((icon) => {
                              const iconHtml = buildIconBlockHtml(icon);
                              return (
                                <button
                                  key={icon.label}
                                  className="group grid min-h-[62px] grid-cols-[34px_1fr] items-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] p-2 text-left transition hover:border-fuchsia-400/50 hover:bg-white/10"
                                  draggable
                                  onClick={() => insertContentIcon(icon)}
                                  onDragEnd={() => setDropTarget(null)}
                                  onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = "copy";
                                    event.dataTransfer.setData(snippetTransferType, "true");
                                    event.dataTransfer.setData("text/html", iconHtml);
                                    event.dataTransfer.setData("text/plain", iconHtml);
                                  }}
                                  type="button"
                                >
                                  <span className="grid size-8 place-items-center rounded-full" style={{ backgroundColor: icon.background, color: icon.color }}>
                                    <icon.icon size={16} />
                                  </span>
                                  <span className="min-w-0 text-[12px] font-semibold text-slate-300 transition group-hover:text-white">{icon.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {inspectorMode === "blocks" && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Layout grid</p>
                  <div className="space-y-2">
                    {layoutBlocks.map((block) => (
                      <button
                        key={block.label}
                        className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] p-2 text-left transition hover:border-fuchsia-400/40 hover:bg-white/10"
                        draggable
                        onClick={() => insertLayoutBlock(block.html)}
                        onDragEnd={() => setDropTarget(null)}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "copy";
                          event.dataTransfer.setData(layoutBlockTransferType, "true");
                          const preparedBlockHtml = prepareResizableBuilderHtml(block.html);
                          event.dataTransfer.setData("text/html", preparedBlockHtml);
                          event.dataTransfer.setData("text/plain", preparedBlockHtml);
                        }}
                        type="button"
                      >
                        <span className="grid size-8 place-items-center rounded-[7px] bg-violet-brand/15 text-fuchsia-300">
                          <block.icon size={15} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-white">{block.label}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{block.description}</span>
                        </span>
                        <GripVertical size={15} className="text-slate-600 transition group-hover:text-slate-400" />
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 border-t border-white/10 pt-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Content snippets</p>
                    <div className="grid grid-cols-2 gap-2">
                    {snippets.map((snippet) => (
                      <button
                        key={snippet.label}
                        className="flex items-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                        draggable
                        onClick={() => insertSnippet(snippet.html)}
                        onDragEnd={() => setDropTarget(null)}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "copy";
                          event.dataTransfer.setData(snippetTransferType, "true");
                          event.dataTransfer.setData("text/html", snippet.html);
                          event.dataTransfer.setData("text/plain", snippet.html);
                        }}
                        type="button"
                      >
                        <snippet.icon size={14} />
                        {snippet.label}
                      </button>
                    ))}
                    </div>
                  </div>

                  <div className="mt-3 rounded-[7px] border border-white/10 bg-white/[0.03] p-2.5">
                    <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
                      <Mail size={15} />
                      Personalisation
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["{{first_name}}", "{{company}}", "{{email}}"].map((token) => (
                        <button
                          key={token}
                          className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
                          draggable
                          onClick={() => insertSnippet(token)}
                          onDragEnd={() => setDropTarget(null)}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "copy";
                            event.dataTransfer.setData(snippetTransferType, "true");
                            event.dataTransfer.setData("text/html", token);
                            event.dataTransfer.setData("text/plain", token);
                          }}
                          type="button"
                        >
                          {token}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {inspectorMode === "assets" && (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Assets</p>
                      <p className="mt-1 text-xs text-slate-500">Images, GIFs, SVGs, videos, and Lottie files.</p>
                    </div>
                    <button className="inline-flex h-9 items-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={assetUploading} onClick={() => assetInputRef.current?.click()} type="button">
                      {assetUploading ? <Loader2 className="animate-spin" size={15} /> : <UploadCloud size={15} />}
                      Upload
                    </button>
                    <input
                      ref={assetInputRef}
                      accept="image/*,.svg,.gif,video/mp4,video/webm,video/quicktime,.json,application/json"
                      className="hidden"
                      multiple
                      onChange={(event) => { void uploadAssets(event.target.files); }}
                      type="file"
                    />
                  </div>

                  {assetError && (
                    <div className="mt-3 rounded-[7px] border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-200">
                      {assetError}
                    </div>
                  )}

                  {assetsLoading ? (
                    <div className="mt-4 flex items-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-400">
                      <Loader2 className="animate-spin" size={15} />
                      Loading assets...
                    </div>
                  ) : assets.length === 0 ? (
                    <div className="mt-4 rounded-[7px] border border-dashed border-white/15 bg-white/[0.03] p-4 text-center">
                      <UploadCloud className="mx-auto text-slate-500" size={22} />
                      <p className="mt-2 text-sm font-semibold text-white">No assets yet</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Upload reusable media for all templates in this workspace.</p>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-2">
                      {assets.map((asset) => {
                        const assetKind = getAssetKind(asset);
                        const assetHtml = buildAssetHtml(asset);
                        const displayName = asset.name.replace(/^\d+-/, "");

                        return (
                          <div key={asset.path} className="grid grid-cols-[72px_1fr] gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] p-2">
                            <div className="grid h-[64px] place-items-center overflow-hidden rounded-[6px] bg-black/25">
                              {assetKind === "image" ? (
                                <span className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${asset.url})` }} />
                              ) : assetKind === "video" ? (
                                <Film className="text-fuchsia-300" size={24} />
                              ) : assetKind === "lottie" ? (
                                <FileJson className="text-fuchsia-300" size={24} />
                              ) : (
                                <ImageIcon className="text-fuchsia-300" size={24} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-white">{displayName}</p>
                              <p className="mt-0.5 text-xs capitalize text-slate-500">{assetKind}{asset.size ? ` · ${formatAssetSize(asset.size)}` : ""}</p>
                              <div className="mt-2 flex gap-2">
                                <button
                                  className="inline-flex h-8 flex-1 items-center justify-center rounded-[7px] bg-violet-brand px-2 text-xs font-semibold text-white"
                                  draggable
                                  onClick={() => insertAsset(asset)}
                                  onDragEnd={() => setDropTarget(null)}
                                  onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = "copy";
                                    event.dataTransfer.setData(snippetTransferType, "true");
                                    event.dataTransfer.setData("text/html", assetHtml);
                                    event.dataTransfer.setData("text/plain", assetHtml);
                                  }}
                                  type="button"
                                >
                                  Insert
                                </button>
                                <a className="inline-flex h-8 items-center justify-center rounded-[7px] border border-white/10 bg-white/[0.04] px-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10" href={asset.url} rel="noreferrer" target="_blank">
                                  View
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {inspectorMode === "ai" && (
                <div
                  className={`flex min-h-0 flex-1 flex-col rounded-[10px] transition ${aiDragActive ? "bg-fuchsia-500/10 ring-2 ring-inset ring-fuchsia-400/60" : ""}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.dataTransfer.types.includes("Files")) {
                      setAiDragActive(true);
                    }
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.currentTarget === event.target) {
                      setAiDragActive(false);
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = "copy";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void addAiFiles(event.dataTransfer.files);
                  }}
                >
                  <input
                    ref={aiFileInputRef}
                    accept="image/*,.svg,.gif,.json,.txt,.md,.csv,.html,.css,application/json,text/*"
                    className="hidden"
                    multiple
                    onChange={(event) => { void addAiFiles(event.target.files); }}
                    type="file"
                  />

                  <div>
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <Sparkles size={14} />
                      Section assistant
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {aiTargetSection ? `Editing ${aiTargetSection.label}.` : "Select a section in the preview to use AI."}
                    </p>
                  </div>

                  {!aiTargetSection && (
                    <div className="mt-3 rounded-[8px] border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-2 text-xs leading-5 text-fuchsia-100">
                      Click a section in the email preview first, then ask AI to edit that section.
                    </div>
                  )}

                  {aiMode === "demo" && (
                    <div className="mt-3 rounded-[8px] border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
                      Real AI is not connected yet. Add <span className="font-mono font-semibold">OPENAI_API_KEY</span> to <span className="font-mono font-semibold">.env.local</span> so this chat can understand images, discuss ideas, and build templates properly.
                    </div>
                  )}

                  {aiError && (
                    <div className="mt-3 rounded-[8px] border border-red-danger/30 bg-red-danger/10 px-3 py-2 text-xs leading-5 text-red-100">
                      {aiError}
                    </div>
                  )}

                  <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-[8px] border border-white/10 bg-black/15 p-2">
                    {aiMessages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={`whitespace-pre-wrap rounded-[8px] px-3 py-2 text-xs leading-5 ${message.role === "user" ? "ml-8 bg-violet-brand text-white" : "mr-5 border border-white/10 bg-white/[0.04] text-slate-300"}`}
                      >
                        {message.content}
                      </div>
                    ))}
                    {aiWorking && (
                      <div className="mr-5 flex items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-5 text-slate-300">
                        <Loader2 className="animate-spin text-fuchsia-300" size={14} />
                        {aiWorkingStatus || "Working on the email template..."}
                      </div>
                    )}
                  </div>

                  <form className="mt-2 grid gap-2 border-t border-white/10 pt-2" onSubmit={handleAiSubmit}>
                    {aiAttachmentError && (
                      <div className="rounded-[7px] border border-amber-400/20 bg-amber-400/10 px-2.5 py-2 text-xs leading-5 text-amber-200">
                        {aiAttachmentError}
                      </div>
                    )}

                    {aiAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {aiAttachments.map((attachment) => (
                          <span key={attachment.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] font-semibold text-slate-300">
                            {attachment.dataUrl ? <ImageIcon size={12} /> : <FileJson size={12} />}
                            <span className="max-w-[190px] truncate">{attachment.name}</span>
                            <button
                              aria-label={`Remove ${attachment.name}`}
                              className="grid size-4 place-items-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-white"
                              onClick={() => removeAiAttachment(attachment.id)}
                              type="button"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="relative">
                      <button
                        aria-label="Attach reference file"
                        className="absolute bottom-2 left-2 z-10 grid size-8 shrink-0 place-items-center rounded-[7px] text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={aiWorking || !aiTargetSection}
                        onClick={() => aiFileInputRef.current?.click()}
                        title="Attach reference file"
                        type="button"
                      >
                        <UploadCloud size={16} />
                      </button>
                      <textarea
                        className="min-h-[50px] max-h-32 w-full resize-none rounded-[8px] border border-white/10 bg-white/[0.04] py-3 pl-12 pr-12 text-[13px] leading-5 text-white outline-none transition placeholder:text-slate-600 focus:border-fuchsia-400/60"
                        disabled={aiWorking || !aiTargetSection}
                        onChange={(event) => updateAiPrompt(event.target.value)}
                        onFocus={() => setAiAssetPickerOpen(shouldShowAiAssetPicker(aiPrompt))}
                        placeholder={aiTargetSection ? `Ask AI to edit ${aiTargetSection.label}...` : "Select a section first..."}
                        value={aiPrompt}
                      />
                      {aiAssetPickerOpen && aiTargetSection && (
                        <div className="absolute bottom-[58px] left-0 right-0 z-30 overflow-hidden rounded-[8px] border border-white/10 bg-[#0D121C] shadow-[0_18px_44px_rgba(0,0,0,0.35)]">
                          {aiAssetReferences.length > 0 ? (
                            <div className="max-h-56 overflow-y-auto p-1.5">
                              {aiAssetReferences.map((reference) => (
                                <button
                                  key={reference.id}
                                  className="grid w-full grid-cols-[38px_1fr] items-center gap-2 rounded-[7px] px-2 py-2 text-left transition hover:bg-white/[0.06]"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    insertAiAssetReference(reference);
                                  }}
                                  type="button"
                                >
                                  <span className="grid size-9 place-items-center overflow-hidden rounded-[6px] bg-black/25">
                                    {reference.previewUrl ? (
                                      <span className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${reference.previewUrl})` }} />
                                    ) : (
                                      <FileJson className="text-fuchsia-300" size={18} />
                                    )}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-xs font-semibold text-white">{reference.label}</span>
                                    <span className="block truncate text-[11px] text-slate-500">{reference.detail}</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="px-3 py-2 text-xs leading-5 text-slate-400">
                              Upload or attach an image first, then type image, picture, file, logo, or asset to tag it here.
                            </div>
                          )}
                        </div>
                      )}
                      <button className="absolute bottom-2 right-2 z-10 grid size-8 place-items-center rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 text-white shadow-[0_10px_26px_rgba(217,70,239,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60" disabled={!aiTargetSection || (!aiPrompt.trim() && aiAttachments.length === 0) || aiWorking} aria-label="Send message" type="submit">
                        {aiWorking ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {inspectorMode === "styles" && (
                <div className="space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Styles</p>
                  <details className="group rounded-[8px] border border-white/10 bg-white/[0.03]" open>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-semibold text-slate-200">
                      Selected section
                      <span className="text-slate-500 transition group-open:rotate-180">⌄</span>
                    </summary>
                    <div className="grid gap-3 border-t border-white/10 p-3">
                      {sectionEditor && !isShellSection(sectionEditor) ? (
                        <>
                          <div>
                            <p className="truncate text-[13px] font-semibold text-white">{sectionEditor.label}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Choose the section in the preview, then style its edge shape here.</p>
                          </div>
                          <div className="grid gap-2 text-xs font-semibold text-slate-400">
                            Edge shape
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { label: "Top wave", position: "top" as const },
                                { label: "Bottom wave", position: "bottom" as const },
                              ].map((item) => {
                                const isActive = getSectionWaveStyle(getVisualSectionParts(sectionEditor.html).style, item.position);
                                return (
                                  <button
                                    key={item.position}
                                    className={`h-9 rounded-[7px] border px-3 text-xs font-semibold transition ${isActive ? "border-fuchsia-400/70 bg-fuchsia-500/15 text-white" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white"}`}
                                    onClick={() => updateSectionWave(sectionEditor, item.position)}
                                    type="button"
                                  >
                                    {item.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-[7px] border border-dashed border-white/15 bg-white/[0.03] p-3 text-xs leading-5 text-slate-500">
                          Select a body section in the preview to show section styling controls.
                        </div>
                      )}
                    </div>
                  </details>
                  <details className="group rounded-[8px] border border-white/10 bg-white/[0.03]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-semibold text-slate-200">
                      Background design
                      <span className="text-slate-500 transition group-open:rotate-180">⌄</span>
                    </summary>
                    <div className="grid gap-3 border-t border-white/10 p-3">
                      <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                        Background colour
                        <span className="grid grid-cols-[42px_1fr] gap-2">
                          <input className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] p-1" type="color" value={globalBackground} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ globalBackground: event.target.value }))} />
                          <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" value={globalBackground} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ globalBackground: event.target.value }))} />
                        </span>
                      </label>
                      <div className="grid gap-2 text-xs font-semibold text-slate-400">
                        Canvas
                        <div className="grid grid-cols-2 gap-2">
                          {backgroundCanvasPresets.map((canvas) => (
                            <button
                              key={canvas.value}
                              className={`grid min-h-[54px] gap-1 rounded-[7px] border p-2 text-left transition ${globalBackgroundCanvas === canvas.value ? "border-fuchsia-400/70 bg-fuchsia-500/15 text-white" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"}`}
                              onClick={() => commitBuilderSnapshot(getBuilderSnapshot({ globalBackgroundCanvas: canvas.value }))}
                              type="button"
                            >
                              <span className="h-5 rounded-[5px] border border-white/10" style={buildPreviewBackgroundStyle(globalBackground, canvas.value, "none")} />
                              <span>{canvas.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-2 text-xs font-semibold text-slate-400">
                        Pattern
                        <div className="grid grid-cols-2 gap-2">
                          {backgroundPatternPresets.map((pattern) => (
                            <button
                              key={pattern.value}
                              className={`grid min-h-[54px] gap-1 rounded-[7px] border p-2 text-left transition ${globalBackgroundPattern === pattern.value ? "border-fuchsia-400/70 bg-fuchsia-500/15 text-white" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"}`}
                              onClick={() => commitBuilderSnapshot(getBuilderSnapshot({ globalBackgroundPattern: pattern.value }))}
                              type="button"
                            >
                              <span className="h-5 rounded-[5px] border border-white/10" style={buildPreviewBackgroundStyle(globalBackground, "plain", pattern.value)} />
                              <span>{pattern.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </details>

                  <details className="group rounded-[8px] border border-white/10 bg-white/[0.03]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-semibold text-slate-200">
                      Box shadow
                      <span className="text-slate-500 transition group-open:rotate-180">⌄</span>
                    </summary>
                    <div className="grid gap-3 border-t border-white/10 p-3">
                      <div className="grid grid-cols-2 gap-2">
                        {emailShadowPresets.map((preset) => (
                          <button
                            key={preset.label}
                            className={`h-9 rounded-[7px] border px-3 text-left text-xs font-semibold transition ${emailBoxShadow === preset.value ? "border-fuchsia-400/70 bg-fuchsia-500/15 text-white" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"}`}
                            onClick={() => commitBuilderSnapshot(getBuilderSnapshot({ emailBoxShadow: preset.value }))}
                            type="button"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <label className="grid gap-2 text-xs font-semibold text-slate-400">
                        Vertical shadow length
                        <input min={-80} max={80} type="range" value={emailBoxShadowParts.vertical} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ emailBoxShadow: buildEmailBoxShadowFromParts({ ...emailBoxShadowParts, vertical: Number(event.target.value) }) }))} />
                        <span className="text-xs text-slate-500">{emailBoxShadowParts.vertical}px</span>
                      </label>
                      <label className="grid gap-2 text-xs font-semibold text-slate-400">
                        Blur radius
                        <input min={0} max={140} type="range" value={emailBoxShadowParts.blur} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ emailBoxShadow: buildEmailBoxShadowFromParts({ ...emailBoxShadowParts, blur: Number(event.target.value) }) }))} />
                        <span className="text-xs text-slate-500">{emailBoxShadowParts.blur}px</span>
                      </label>
                      <label className="grid gap-2 text-xs font-semibold text-slate-400">
                        Spread radius
                        <input min={-40} max={80} type="range" value={emailBoxShadowParts.spread} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ emailBoxShadow: buildEmailBoxShadowFromParts({ ...emailBoxShadowParts, spread: Number(event.target.value) }) }))} />
                        <span className="text-xs text-slate-500">{emailBoxShadowParts.spread}px</span>
                      </label>
                      <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                        Shadow colour
                        <span className="grid grid-cols-[42px_1fr] gap-2">
                          <input className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] p-1" type="color" value={emailBoxShadowParts.colorHex} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ emailBoxShadow: buildEmailBoxShadowFromParts({ ...emailBoxShadowParts, colorHex: event.target.value }) }))} />
                          <input
                            className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 font-mono text-[12px] text-white outline-none"
                            onBlur={(event) => {
                              const nextHex = rgbTextToHex(event.target.value);
                              if (nextHex) {
                                commitBuilderSnapshot(getBuilderSnapshot({ emailBoxShadow: buildEmailBoxShadowFromParts({ ...emailBoxShadowParts, colorHex: nextHex }) }));
                              }
                            }}
                            value={`rgb(${hexToRgb(emailBoxShadowParts.colorHex).red},${hexToRgb(emailBoxShadowParts.colorHex).green},${hexToRgb(emailBoxShadowParts.colorHex).blue})`}
                            onChange={(event) => {
                              const nextHex = rgbTextToHex(event.target.value);
                              if (nextHex) {
                                commitBuilderSnapshot(getBuilderSnapshot({ emailBoxShadow: buildEmailBoxShadowFromParts({ ...emailBoxShadowParts, colorHex: nextHex }) }));
                              }
                            }}
                          />
                        </span>
                      </label>
                      <label className="grid gap-2 text-xs font-semibold text-slate-400">
                        Shadow colour opacity
                        <input min={0} max={1} step={0.01} type="range" value={emailBoxShadowParts.opacity} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ emailBoxShadow: buildEmailBoxShadowFromParts({ ...emailBoxShadowParts, opacity: Number(event.target.value) }) }))} />
                        <span className="text-xs text-slate-500">{emailBoxShadowParts.opacity.toFixed(2)}</span>
                      </label>
                      <input
                        className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 font-mono text-[12px] text-white outline-none transition focus:border-fuchsia-400/60"
                        onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ emailBoxShadow: event.target.value || "none" }))}
                        placeholder="0 10px 5px 0 rgba(0, 0, 0, 0.75)"
                        value={emailBoxShadow}
                      />
                    </div>
                  </details>

                  <details className="group rounded-[8px] border border-white/10 bg-white/[0.03]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-semibold text-slate-200">
                      Email frame
                      <span className="text-slate-500 transition group-open:rotate-180">⌄</span>
                    </summary>
                    <div className="grid gap-3 border-t border-white/10 p-3">
                      <label className="grid gap-2 text-xs font-semibold text-slate-400">
                        Preview margin
                        <input min={0} max={56} type="range" value={previewPadding} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ previewPadding: Number(event.target.value) }))} />
                        <span className="text-xs text-slate-500">{previewPadding}px</span>
                      </label>
                      <label className="grid gap-2 text-xs font-semibold text-slate-400">
                        Email corner radius
                        <input min={0} max={32} type="range" value={emailBorderRadius} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ emailBorderRadius: Number(event.target.value) }))} />
                        <span className="text-xs text-slate-500">{emailBorderRadius}px</span>
                      </label>
                      <label className="grid gap-2 text-xs font-semibold text-slate-400">
                        Email width
                        <input min={520} max={920} type="range" value={emailWidth} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ emailWidth: Number(event.target.value) }))} />
                        <span className="text-xs text-slate-500">{emailWidth}px</span>
                      </label>
                      <label className="grid gap-2 text-xs font-semibold text-slate-400">
                        Body content margin
                        <input min={0} max={96} type="range" value={bodyContentMargin} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ bodyContentMargin: Number(event.target.value) }))} />
                        <span className="text-xs text-slate-500">{bodyContentMargin}px</span>
                      </label>
                      <label className="grid gap-2 text-xs font-semibold text-slate-400">
                        Body text left margin
                        <input min={0} max={96} type="range" value={bodyTextInsetLeft} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ bodyTextInsetLeft: Number(event.target.value) }))} />
                        <span className="text-xs text-slate-500">{bodyTextInsetLeft}px</span>
                      </label>
                      <label className="grid gap-2 text-xs font-semibold text-slate-400">
                        Body text right margin
                        <input min={0} max={96} type="range" value={bodyTextInsetRight} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ bodyTextInsetRight: Number(event.target.value) }))} />
                        <span className="text-xs text-slate-500">{bodyTextInsetRight}px</span>
                      </label>
                      <label className="grid gap-2 text-xs font-semibold text-slate-400">
                        Global text size
                        <input min={11} max={22} type="range" value={bodyTextSize} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ bodyTextSize: Number(event.target.value) }))} />
                        <span className="text-xs text-slate-500">{bodyTextSize}px</span>
                      </label>
                      <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                        Global text colour
                        <span className="grid grid-cols-[42px_1fr] gap-2">
                          <input className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] p-1" type="color" value={bodyTextColor} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ bodyTextColor: event.target.value }))} />
                          <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" value={bodyTextColor} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ bodyTextColor: event.target.value }))} />
                        </span>
                      </label>
                    </div>
                  </details>
                </div>
              )}

              {inspectorMode === "advanced" && (
                <div className="space-y-4">
                  <div>
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <SlidersHorizontal size={14} />
                      Advanced
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Export HTML, edit the document head, and prepare the template for handoff.</p>
                  </div>

                  <div className="rounded-[8px] border border-white/10 bg-white/[0.03] p-2.5">
                    <p className="text-xs font-semibold text-slate-200">Export HTML</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Exports the current draft as a full HTML document.</p>
                    <label className="mt-3 flex items-center justify-between gap-3 rounded-[7px] border border-white/10 bg-black/10 px-3 py-2 text-xs font-semibold text-slate-300">
                      Minify export
                      <input className="size-4 accent-fuchsia-500" checked={exportMinified} onChange={(event) => setExportMinified(event.target.checked)} type="checkbox" />
                    </label>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button className="inline-flex h-9 items-center justify-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-100 transition hover:bg-white/10" onClick={() => { void copyFullHtml(); }} type="button">
                        <Copy size={14} />
                        {exportCopied ? "Copied" : "Copy HTML"}
                      </button>
                      <button className="inline-flex h-9 items-center justify-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-3 text-xs font-semibold text-white" onClick={downloadFullHtml} type="button">
                        <Download size={14} />
                        Download
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[8px] border border-white/10 bg-white/[0.03] p-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-200">Versions</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Save snapshots, copy older versions, or make one the main template.</p>
                      </div>
                      <button className="inline-flex h-8 shrink-0 items-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={versionActionId === "current"} onClick={() => { void createTemplateVersion(); }} type="button">
                        {versionActionId === "current" ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                        Save version
                      </button>
                    </div>

                    {versionError && (
                      <div className="mt-3 rounded-[7px] border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-200">
                        {versionError}
                      </div>
                    )}

                    {versionsLoading ? (
                      <div className="mt-3 flex items-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-400">
                        <Loader2 className="animate-spin" size={15} />
                        Loading versions...
                      </div>
                    ) : templateVersions.length === 0 ? (
                      <div className="mt-3 rounded-[7px] border border-dashed border-white/15 bg-white/[0.03] p-4 text-center">
                        <FileJson className="mx-auto text-slate-500" size={22} />
                        <p className="mt-2 text-sm font-semibold text-white">No versions yet</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Save a version before making bigger changes.</p>
                      </div>
                    ) : (
                      <div className="mt-3 grid gap-3">
                        {templateVersions.map((version) => {
                          const versionHead = getTemplateDesignHead(version.design);
                          const isMainVersion = (version.html || "").trim() === html.trim() && version.subject === subject;

                          return (
                            <div key={version.id} className="overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.04]">
                              <div className="h-[122px] overflow-hidden border-b border-white/10 bg-slate-100">
                                <iframe
                                  className="pointer-events-none h-[680px] w-[760px] origin-top-left scale-[0.32] bg-white"
                                  sandbox=""
                                  srcDoc={buildPreviewDocument(version.html || "", version.preheader || "", versionHead)}
                                  title={`Version ${version.version_number} preview`}
                                />
                              </div>
                              <div className="p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-[13px] font-semibold text-white">Version {version.version_number}</p>
                                    <p className="mt-0.5 truncate text-xs text-slate-500">{version.subject}</p>
                                  </div>
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isMainVersion ? "bg-emerald-400/10 text-emerald-300" : "bg-white/[0.06] text-slate-400"}`}>
                                    {isMainVersion ? "Main" : formatVersionDate(version.created_at)}
                                  </span>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  <button className="inline-flex h-8 items-center justify-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] px-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60" disabled={versionActionId === version.id} onClick={() => { void createTemplateVersion(version.id); }} type="button">
                                    {versionActionId === version.id ? <Loader2 className="animate-spin" size={14} /> : <Copy size={14} />}
                                    Copy
                                  </button>
                                  <button className="inline-flex h-8 items-center justify-center gap-2 rounded-[7px] bg-violet-brand px-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60" disabled={isMainVersion || versionActionId === version.id} onClick={() => { void makeVersionMain(version); }} type="button">
                                    {versionActionId === version.id ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                    Make main
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">HTML head</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Add email-safe meta, style, or tracking tags.</p>
                      </div>
                      <button className="inline-flex h-8 shrink-0 items-center rounded-[7px] border border-white/10 bg-white/[0.04] px-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10" onClick={resetCustomHead} type="button">
                        Reset
                      </button>
                    </div>
                    <textarea
                      className="min-h-[180px] w-full resize-y rounded-[8px] border border-white/10 bg-[#070b12] px-3 py-2 font-mono text-[12px] leading-5 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-fuchsia-400/60"
                      onChange={(event) => {
                        setCustomHead(event.target.value);
                        markDirty();
                      }}
                      placeholder="<style> .button { border-radius: 8px; } </style>"
                      spellCheck={false}
                      value={customHead}
                    />
                  </div>

                  <div className="rounded-[8px] border border-white/10 bg-white/[0.03] p-2.5">
                    <p className="text-xs font-semibold text-slate-200">Maintenance</p>
                    <div className="mt-3 grid gap-2">
                      <button className="inline-flex h-9 items-center justify-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-100 transition hover:bg-white/10" onClick={syncPreviewEditsToCode} type="button">
                        <Code2 size={14} />
                        Sync preview edits
                      </button>
                      <button className="inline-flex h-9 items-center justify-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-100 transition hover:bg-white/10" onClick={() => setCodeOpen(true)} type="button">
                        <Code2 size={14} />
                        Open code editor
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {inspectorMode === "settings" && (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Template settings</p>
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                    Template name
                    <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" value={templateName} onChange={(event) => { setTemplateName(event.target.value); markDirty(); }} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                    Subject
                    <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" value={subject} onChange={(event) => { setSubject(event.target.value); markDirty(); }} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                    From name
                    <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" value={fromName} onChange={(event) => { setFromName(event.target.value); markDirty(); }} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                    From email
                    <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" value={fromEmail} onChange={(event) => { setFromEmail(event.target.value); markDirty(); }} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                    Preheader
                    <textarea className="min-h-[86px] resize-none rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none" value={preheader} onChange={(event) => { setPreheader(event.target.value); markDirty(); }} />
                  </label>

                  <div className="rounded-[8px] border border-white/10 bg-white/[0.03] p-2.5">
                    <p className="text-xs font-semibold text-slate-200">Save to templates</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Create a new saved template from the current build without overwriting the original.</p>
                    <button
                      className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[7px] border border-fuchsia-400/40 bg-fuchsia-500/12 px-3 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={saving || savingAsNew || loading}
                      onClick={() => { void handleSaveAsNewTemplate(); }}
                      type="button"
                    >
                      {savingAsNew ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />}
                      Save as new template
                    </button>
                  </div>

                  <div className="border-t border-white/10 pt-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Send test email</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Send the current draft with test handlebar data.</p>
                      </div>
                      <button className="inline-flex h-8 shrink-0 items-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] px-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10" onClick={useDetectedTestData} type="button">
                        <Braces size={14} />
                        Fill data
                      </button>
                    </div>

                    <label className="mt-3 grid gap-1.5 text-xs font-semibold text-slate-400">
                      Send to
                      <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" placeholder="you@example.com" type="email" value={testEmailTo} onChange={(event) => { setTestEmailTo(event.target.value); setTestSendError(null); setTestSendMessage(null); setTestSendHtmlPreview(""); }} />
                    </label>

                    <div className="mt-3 rounded-[7px] border border-white/10 bg-white/[0.03] p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-300">Detected variables</p>
                        <span className="text-[11px] text-slate-500">{detectedVariables.length}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {detectedVariables.length === 0 ? (
                          <span className="text-xs text-slate-500">No variables found in this template.</span>
                        ) : detectedVariables.map((variable) => (
                          <button key={variable} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-slate-300 transition hover:bg-white/10" onClick={() => setTestHandlebarData((currentData) => currentData.includes(`"${variable}"`) ? currentData : JSON.stringify({ ...buildDetectedTestData(), [variable]: `Example ${variable.replace(/_/g, " ")}` }, null, 2))} type="button">
                            {`{{${variable}}}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="mt-3 grid gap-1.5 text-xs font-semibold text-slate-400">
                      Handlebar test data
                      <textarea className="min-h-[150px] resize-y rounded-[8px] border border-white/10 bg-[#070b12] px-3 py-2 font-mono text-[12px] leading-5 text-slate-100 outline-none transition focus:border-fuchsia-400/60" spellCheck={false} value={testHandlebarData} onChange={(event) => { setTestHandlebarData(event.target.value); setTestSendError(null); setTestSendMessage(null); setTestSendHtmlPreview(""); }} />
                    </label>

                    {testSendError && (
                      <div className="mt-3 rounded-[7px] border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-200">
                        {testSendError}
                      </div>
                    )}
                    {testSendMessage && (
                      <div className="mt-3 rounded-[7px] border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs leading-5 text-emerald-200">
                        {testSendMessage}
                      </div>
                    )}
                    {testSendHtmlPreview && (
                      <div className="mt-3 rounded-[7px] border border-white/10 bg-white/[0.03] p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-300">Outgoing HTML preview</p>
                          <button className="inline-flex h-7 items-center gap-1 rounded-[6px] border border-white/10 bg-white/[0.04] px-2 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10" onClick={() => { void copyTextToClipboard(testSendHtmlPreview, "Sent HTML preview copied"); }} type="button">
                            <Copy size={12} />
                            Copy
                          </button>
                        </div>
                        <textarea className="mt-2 max-h-[180px] min-h-[96px] w-full resize-y rounded-[6px] border border-white/10 bg-[#05070d] px-2 py-2 font-mono text-[11px] leading-5 text-slate-300 outline-none" readOnly value={testSendHtmlPreview} />
                      </div>
                    )}

                    <button className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-3 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={testSending || !testEmailTo.trim()} onClick={() => { void sendTestEmail(); }} type="button">
                      {testSending ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
                      Send test
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {imageToolsSectionId && inspectorMode !== "ai" && (
            <div className="absolute bottom-0 right-0 top-0 z-40 flex flex-col border-l border-white/10 bg-[#0D121C] p-2.5 shadow-2xl transition-transform duration-300" style={{ left: 48 }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ImageIcon size={16} />
                    Image tools
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">Drag the image corner to resize, or use the controls below.</p>
                </div>
                <button aria-label="Close image tools" className="grid size-8 shrink-0 place-items-center rounded-[7px] border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={closeInspectorOverlays} type="button">
                  <X size={16} />
                </button>
              </div>

              <div className="mt-3 border-t border-white/10 pt-3">
                <div className="mb-3 grid gap-2 rounded-[8px] border border-white/10 bg-white/[0.03] p-2.5">
                  <label className="grid gap-2 text-xs font-semibold text-slate-400">
                    Image width
                    <input
                      max={720}
                      min={80}
                      type="range"
                      value={elementWidthDraft || 560}
                      onChange={(event) => {
                        const nextWidth = Number(event.target.value);
                        setElementWidthDraft(nextWidth);
                        updateSelectedImageStyle({ width: nextWidth });
                      }}
                    />
                    <span className="text-xs text-slate-500">{elementWidthDraft || 560}px max</span>
                  </label>
                  <label className="grid gap-2 text-xs font-semibold text-slate-400">
                    Corner radius
                    <input
                      max={48}
                      min={0}
                      type="range"
                      value={elementRadiusDraft}
                      onChange={(event) => {
                        const nextRadius = Number(event.target.value);
                        setElementRadiusDraft(nextRadius);
                        updateSelectedImageStyle({ radius: nextRadius });
                      }}
                    />
                    <span className="text-xs text-slate-500">{elementRadiusDraft}px</span>
                  </label>
                </div>

                <button className="mb-3 inline-flex h-9 items-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={assetUploading} onClick={() => assetInputRef.current?.click()} type="button">
                  {assetUploading ? <Loader2 className="animate-spin" size={15} /> : <UploadCloud size={15} />}
                  Upload asset
                </button>

                {assetError && (
                  <div className="mb-3 rounded-[7px] border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-200">
                    {assetError}
                  </div>
                )}

                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Image assets</p>
                <div className="grid max-h-[calc(100vh-210px)] gap-2 overflow-y-auto pr-1">
                  {assets.filter((asset) => getAssetKind(asset) === "image").length === 0 ? (
                    <div className="rounded-[7px] border border-dashed border-white/15 bg-white/[0.03] p-4 text-center">
                      <ImageIcon className="mx-auto text-slate-500" size={22} />
                      <p className="mt-2 text-sm font-semibold text-white">No image assets</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Upload an image, GIF, or SVG to replace this image.</p>
                    </div>
                  ) : (
                    assets.filter((asset) => getAssetKind(asset) === "image").map((asset) => (
                      <button
                        key={asset.path}
                        className="grid grid-cols-[64px_1fr] gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] p-2 text-left transition hover:border-fuchsia-400/50 hover:bg-white/10"
                        onClick={() => replaceSelectedImage(asset)}
                        type="button"
                      >
                        <span className="h-14 rounded-[6px] bg-cover bg-center" style={{ backgroundImage: `url(${asset.url})` }} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-white">{asset.name.replace(/^\d+-/, "")}</span>
                          <span className="mt-1 block text-xs text-slate-500">{formatAssetSize(asset.size)}</span>
                          <span className="mt-2 inline-flex rounded-full bg-violet-brand/20 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-200">Replace</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {buttonToolsSectionId && inspectorMode !== "ai" && (
            <div className="absolute bottom-0 right-0 top-0 z-35 flex flex-col border-l border-white/10 bg-[#0D121C] p-2.5 shadow-2xl transition-transform duration-300" style={{ left: 48 }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <MousePointerClick size={16} />
                    Button tools
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">Edit button text, link, colour, size, spacing, and alignment.</p>
                </div>
                <button aria-label="Close button tools" className="grid size-8 shrink-0 place-items-center rounded-[7px] border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={closeInspectorOverlays} type="button">
                  <X size={16} />
                </button>
              </div>

              <div className="mt-3 grid gap-3 overflow-y-auto border-t border-white/10 pt-3">
                <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                  Label
                  <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none transition focus:border-fuchsia-400/60" value={buttonLabelDraft} onChange={(event) => { setButtonLabelDraft(event.target.value); updateSelectedButton({ label: event.target.value }); }} />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                  Link URL
                  <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none transition focus:border-fuchsia-400/60" placeholder="https://example.com" value={buttonUrlDraft} onChange={(event) => { setButtonUrlDraft(event.target.value); updateSelectedButton({ href: event.target.value }); }} />
                </label>

                <div className="rounded-[7px] border border-white/10 bg-white/[0.03] p-2.5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Alignment</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Left", icon: AlignLeft, value: "left" as const },
                      { label: "Center", icon: AlignCenter, value: "center" as const },
                      { label: "Right", icon: AlignRight, value: "right" as const },
                    ].map((item) => (
                      <button key={item.label} aria-label={item.label} className="grid h-9 place-items-center rounded-[7px] border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/10" onClick={() => updateSelectedButton({ align: item.value })} type="button">
                        <item.icon size={16} />
                      </button>
                    ))}
                  </div>
                </div>

                <label className="grid gap-2 text-xs font-semibold text-slate-400">
                  Width
                  <input min={80} max={720} type="range" value={elementWidthDraft || 160} onChange={(event) => { const nextWidth = Number(event.target.value); setElementWidthDraft(nextWidth); updateSelectedButton({ width: nextWidth }); }} />
                  <span className="text-xs text-slate-500">{elementWidthDraft || 160}px</span>
                </label>
                <label className="grid gap-2 text-xs font-semibold text-slate-400">
                  Vertical padding
                  <input min={4} max={32} type="range" value={elementPaddingDraft || 12} onChange={(event) => { const nextPadding = Number(event.target.value); setElementPaddingDraft(nextPadding); updateSelectedButton({ paddingY: nextPadding }); }} />
                  <span className="text-xs text-slate-500">{elementPaddingDraft || 12}px</span>
                </label>
                <label className="grid gap-2 text-xs font-semibold text-slate-400">
                  Horizontal padding
                  <input min={8} max={64} type="range" value={elementMarginDraft || 24} onChange={(event) => { const nextPadding = Number(event.target.value); setElementMarginDraft(nextPadding); updateSelectedButton({ paddingX: nextPadding }); }} />
                  <span className="text-xs text-slate-500">{elementMarginDraft || 24}px</span>
                </label>
                <label className="grid gap-2 text-xs font-semibold text-slate-400">
                  Radius
                  <input min={0} max={40} type="range" value={elementRadiusDraft} onChange={(event) => { const nextRadius = Number(event.target.value); setElementRadiusDraft(nextRadius); updateSelectedButton({ radius: nextRadius }); }} />
                  <span className="text-xs text-slate-500">{elementRadiusDraft}px</span>
                </label>
                <label className="grid gap-2 text-xs font-semibold text-slate-400">
                  Text size
                  <input min={10} max={28} type="range" value={textSizeDraft} onChange={(event) => { const nextSize = Number(event.target.value); setTextSizeDraft(nextSize); updateSelectedButton({ fontSize: nextSize }); }} />
                  <span className="text-xs text-slate-500">{textSizeDraft}px</span>
                </label>

                <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                  Button colour
                  <span className="grid grid-cols-[42px_1fr] gap-2">
                    <input className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] p-1" type="color" value={elementBackgroundDraft} onChange={(event) => { setElementBackgroundDraft(event.target.value); updateSelectedButton({ background: event.target.value }); }} />
                    <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" value={elementBackgroundDraft} onChange={(event) => setElementBackgroundDraft(event.target.value)} onBlur={() => updateSelectedButton({ background: elementBackgroundDraft })} />
                  </span>
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                  Text colour
                  <span className="grid grid-cols-[42px_1fr] gap-2">
                    <input className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] p-1" type="color" value={buttonTextColorDraft} onChange={(event) => { setButtonTextColorDraft(event.target.value); updateSelectedButton({ color: event.target.value }); }} />
                    <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" value={buttonTextColorDraft} onChange={(event) => setButtonTextColorDraft(event.target.value)} onBlur={() => updateSelectedButton({ color: buttonTextColorDraft })} />
                  </span>
                </label>
              </div>
            </div>
          )}

          {textToolsSectionId && !imageToolsSectionId && !buttonToolsSectionId && inspectorMode !== "ai" && (
            <div className="absolute bottom-0 right-0 top-0 z-30 flex flex-col border-l border-white/10 bg-[#0D121C] p-2.5 shadow-2xl transition-transform duration-300" style={{ left: 48 }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Type size={16} />
                    Element inspector
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">Inspect and style the clicked HTML element</p>
                </div>
                <button aria-label="Close element inspector" className="grid size-8 shrink-0 place-items-center rounded-[7px] border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={closeInspectorOverlays} type="button">
                  <X size={16} />
                </button>
              </div>

              <div className="mt-3 grid gap-3 overflow-y-auto border-t border-white/10 pt-3">
                <div className="rounded-[7px] border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Selected</p>
                    <span className="rounded-full bg-violet-brand/20 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-200">{selectedElementLabel}</span>
                  </div>

                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-2 text-xs font-semibold text-slate-400">
                      Width
                      <input min={80} max={920} type="range" value={elementWidthDraft} onChange={(event) => { const nextWidth = Number(event.target.value); setElementWidthDraft(nextWidth); applyStyleToActiveTextTarget({ width: `${nextWidth}px`, maxWidth: "100%" }); }} />
                      <span className="text-xs text-slate-500">{elementWidthDraft}px</span>
                    </label>

                    <label className="grid gap-2 text-xs font-semibold text-slate-400">
                      Padding
                      <input min={0} max={80} type="range" value={elementPaddingDraft} onChange={(event) => { const nextPadding = Number(event.target.value); setElementPaddingDraft(nextPadding); applyStyleToActiveTextTarget({ padding: `${nextPadding}px` }); }} />
                      <span className="text-xs text-slate-500">{elementPaddingDraft}px</span>
                    </label>

                    <label className="grid gap-2 text-xs font-semibold text-slate-400">
                      Margin
                      <input min={0} max={80} type="range" value={elementMarginDraft} onChange={(event) => { const nextMargin = Number(event.target.value); setElementMarginDraft(nextMargin); applyStyleToActiveTextTarget({ margin: `${nextMargin}px` }); }} />
                      <span className="text-xs text-slate-500">{elementMarginDraft}px</span>
                    </label>

                    <label className="grid gap-2 text-xs font-semibold text-slate-400">
                      Radius
                      <input min={0} max={48} type="range" value={elementRadiusDraft} onChange={(event) => { const nextRadius = Number(event.target.value); setElementRadiusDraft(nextRadius); applyStyleToActiveTextTarget({ borderRadius: `${nextRadius}px` }); }} />
                      <span className="text-xs text-slate-500">{elementRadiusDraft}px</span>
                    </label>

                    <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                      Background
                      <span className="grid grid-cols-[42px_1fr] gap-2">
                        <input className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] p-1" type="color" value={elementBackgroundDraft} onChange={(event) => { setElementBackgroundDraft(event.target.value); applyStyleToActiveTextTarget({ backgroundColor: event.target.value }); }} />
                        <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" value={elementBackgroundDraft} onChange={(event) => setElementBackgroundDraft(event.target.value)} onBlur={() => applyStyleToActiveTextTarget({ backgroundColor: elementBackgroundDraft })} />
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Format</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Bold", icon: Bold, command: "bold" },
                      { label: "Italic", icon: Italic, command: "italic" },
                      { label: "Underline", icon: Underline, command: "underline" },
                    ].map((item) => (
                      <button key={item.label} aria-label={item.label} className="grid h-9 place-items-center rounded-[7px] border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/10" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand(item.command)} type="button">
                        <item.icon size={16} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Alignment</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Left", icon: AlignLeft, command: "justifyLeft" },
                      { label: "Center", icon: AlignCenter, command: "justifyCenter" },
                      { label: "Right", icon: AlignRight, command: "justifyRight" },
                    ].map((item) => (
                      <button key={item.label} aria-label={item.label} className="grid h-9 place-items-center rounded-[7px] border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/10" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand(item.command)} type="button">
                        <item.icon size={16} />
                      </button>
                    ))}
                  </div>
                </div>

                <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                  Text colour
                  <span className="grid grid-cols-[42px_1fr] gap-2">
                    <input className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] p-1" type="color" value={textColorDraft} onChange={(event) => { setTextColorDraft(event.target.value); applyInlineTextStyle({ color: event.target.value }); }} />
                    <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" value={textColorDraft} onChange={(event) => setTextColorDraft(event.target.value)} onBlur={() => applyInlineTextStyle({ color: textColorDraft })} />
                  </span>
                </label>

                <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                  Highlight colour
                  <span className="grid grid-cols-[42px_1fr] gap-2">
                    <input className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] p-1" type="color" value={textHighlightDraft} onChange={(event) => { setTextHighlightDraft(event.target.value); applyInlineTextStyle({ backgroundColor: event.target.value }); }} />
                    <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" value={textHighlightDraft} onChange={(event) => setTextHighlightDraft(event.target.value)} onBlur={() => applyInlineTextStyle({ backgroundColor: textHighlightDraft })} />
                  </span>
                </label>

                <div className="grid gap-2 rounded-[8px] border border-white/10 bg-white/[0.03] p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Gradient text</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      ["#7c3aed", "#d946ef"],
                      ["#0ea5e9", "#22c55e"],
                      ["#f97316", "#ec4899"],
                      ["#111827", "#7c3aed"],
                    ].map(([start, end]) => (
                      <button
                        key={`${start}-${end}`}
                        aria-label="Apply text gradient"
                        className="h-9 rounded-[7px] border border-white/10 transition hover:scale-[1.02] hover:border-fuchsia-300/60"
                        onClick={() => {
                          setTextGradientStartDraft(start);
                          setTextGradientEndDraft(end);
                          applyGradientText(start, end);
                        }}
                        style={{ background: `linear-gradient(135deg, ${start}, ${end})` }}
                        type="button"
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-1 text-xs font-semibold text-slate-400">
                      Start
                      <input className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] p-1" type="color" value={textGradientStartDraft} onChange={(event) => { setTextGradientStartDraft(event.target.value); applyGradientText(event.target.value, textGradientEndDraft); }} />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-slate-400">
                      End
                      <input className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] p-1" type="color" value={textGradientEndDraft} onChange={(event) => { setTextGradientEndDraft(event.target.value); applyGradientText(textGradientStartDraft, event.target.value); }} />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="inline-flex h-9 items-center justify-center rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-3 text-xs font-semibold text-white" onMouseDown={(event) => event.preventDefault()} onClick={() => applyGradientText()} type="button">
                      Apply gradient
                    </button>
                    <button
                      className="inline-flex h-9 items-center justify-center rounded-[7px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyInlineTextStyle({ backgroundImage: "none", backgroundClip: "initial", WebkitBackgroundClip: "initial", WebkitTextFillColor: "currentColor", display: "inline" })}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                  Font style
                  <select className="h-9 rounded-[8px] border border-white/10 bg-[#0D121C] px-3 text-[13px] text-white outline-none" value={textFontDraft} onChange={(event) => { setTextFontDraft(event.target.value); applyInlineTextStyle({ fontFamily: event.target.value }); }}>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="Helvetica, Arial, sans-serif">Helvetica</option>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                    <option value="'Courier New', monospace">Courier New</option>
                    <option value="Verdana, sans-serif">Verdana</option>
                    <option value="Tahoma, sans-serif">Tahoma</option>
                  </select>
                </label>

                <label className="grid gap-2 text-xs font-semibold text-slate-400">
                  Text size
                  <input min={10} max={72} type="range" value={textSizeDraft} onChange={(event) => { const nextSize = Number(event.target.value); setTextSizeDraft(nextSize); applyInlineTextStyle({ fontSize: `${nextSize}px` }); }} />
                  <span className="text-xs text-slate-500">{textSizeDraft}px</span>
                </label>

                <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                  Link URL
                  <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" placeholder="https://example.com" value={textLinkDraft} onChange={(event) => setTextLinkDraft(event.target.value)} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button className="inline-flex h-9 items-center justify-center rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-3 text-[13px] font-semibold text-white" onMouseDown={(event) => event.preventDefault()} onClick={() => textLinkDraft.trim() && applyTextCommand("createLink", textLinkDraft.trim())} type="button">
                    Apply link
                  </button>
                  <button className="inline-flex h-9 items-center justify-center rounded-[7px] border border-white/10 bg-white/[0.04] px-3 text-[13px] font-semibold text-slate-100 transition hover:bg-white/10" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand("unlink")} type="button">
                    Remove link
                  </button>
                </div>
              </div>
            </div>
          )}

          {sectionEditor && !textToolsSectionId && inspectorMode !== "ai" && (
            <div className="absolute bottom-0 right-0 top-0 z-20 flex flex-col overflow-y-auto border-l border-white/10 bg-[#0D121C] p-2.5 shadow-2xl" style={{ left: 48 }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Pencil size={16} />
                    Edit section
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">{sectionEditor.label}</p>
                </div>
                <button aria-label="Close section tools" className="grid size-8 shrink-0 place-items-center rounded-[7px] border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={closeSectionEditor} type="button">
                  <X size={16} />
                </button>
              </div>

              <div className="mt-3 grid gap-2.5 border-t border-white/10 pt-3">
                <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                  Section name
                  <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none transition focus:border-fuchsia-400/60" value={sectionLabelDraft} onChange={(event) => setSectionLabelDraft(event.target.value)} />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                  Background
                  <span className="grid grid-cols-[42px_1fr] gap-2">
                    <input className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] p-1" type="color" value={sectionBackgroundDraft} onChange={(event) => setSectionBackgroundDraft(event.target.value)} />
                    <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" value={sectionBackgroundDraft} onChange={(event) => setSectionBackgroundDraft(event.target.value)} />
                  </span>
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                  Text colour
                  <span className="grid grid-cols-[42px_1fr] gap-2">
                    <input className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] p-1" type="color" value={sectionTextColorDraft} onChange={(event) => setSectionTextColorDraft(event.target.value)} />
                    <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" value={sectionTextColorDraft} onChange={(event) => setSectionTextColorDraft(event.target.value)} />
                  </span>
                </label>
                <div className="grid gap-2">
                  <p className="text-xs font-semibold text-slate-400">Padding</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["top", "right", "bottom", "left"] as const).map((side) => (
                      <label key={side} className="grid gap-1 text-[11px] font-semibold capitalize text-slate-500">
                        {side}
                        <input
                          className="h-8 rounded-[7px] border border-white/10 bg-white/[0.04] px-2 text-[13px] text-white outline-none transition focus:border-fuchsia-400/60"
                          min={0}
                          max={160}
                          type="number"
                          value={sectionPaddingDraft[side]}
                          onChange={(event) => setSectionPaddingDraft((current) => ({ ...current, [side]: Math.max(0, Number(event.target.value) || 0) }))}
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <p className="text-xs font-semibold text-slate-400">Margin</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["top", "right", "bottom", "left"] as const).map((side) => (
                      <label key={side} className="grid gap-1 text-[11px] font-semibold capitalize text-slate-500">
                        {side}
                        <input
                          className="h-8 rounded-[7px] border border-white/10 bg-white/[0.04] px-2 text-[13px] text-white outline-none transition focus:border-fuchsia-400/60"
                          min={0}
                          max={160}
                          type="number"
                          value={sectionMarginDraft[side]}
                          onChange={(event) => setSectionMarginDraft((current) => ({ ...current, [side]: Math.max(0, Number(event.target.value) || 0) }))}
                        />
                      </label>
                    ))}
                  </div>
                </div>
                {isShellHeaderSection(sectionEditor) && (
                  <div className="grid gap-2 text-xs font-semibold text-slate-400">
                    Logo alignment
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Left", value: "left" as const, icon: AlignLeft },
                        { label: "Centre", value: "center" as const, icon: AlignCenter },
                        { label: "Right", value: "right" as const, icon: AlignRight },
                      ].map((item) => {
                        const isActive = getLogoHeaderAlignment(sectionEditor.html) === item.value;
                        return (
                          <button
                            key={item.value}
                            aria-label={`Align logo ${item.label.toLowerCase()}`}
                            className={`grid h-9 place-items-center rounded-[7px] border transition ${isActive ? "border-fuchsia-400/70 bg-fuchsia-500/15 text-white" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white"}`}
                            onClick={() => applyLogoHeaderAlignment(item.value)}
                            type="button"
                          >
                            <item.icon size={16} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {isShellFooterSection(sectionEditor) && footerEditorContent && (
                  <div className="grid gap-3 rounded-[8px] border border-white/10 bg-white/[0.03] p-2.5">
                    <div>
                      <p className="text-xs font-semibold text-slate-200">Footer content</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Edit the footer text and social links.</p>
                    </div>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                      Footer text
                      <textarea
                        className="min-h-[76px] resize-none rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none transition focus:border-fuchsia-400/60"
                        value={footerEditorContent.note}
                        onChange={(event) => applyFooterShellContent({ ...footerEditorContent, note: event.target.value })}
                      />
                    </label>
                    <div className="grid gap-2">
                      {footerEditorContent.links.map((link, index) => (
                        <div key={index} className="grid gap-1.5 rounded-[7px] border border-white/10 bg-black/10 p-2">
                          <label className="grid gap-1 text-xs font-semibold text-slate-400">
                            Link label
                            <input
                              className="h-8 rounded-[7px] border border-white/10 bg-white/[0.04] px-2.5 text-[13px] text-white outline-none transition focus:border-fuchsia-400/60"
                              value={link.label}
                              onChange={(event) => {
                                const nextLinks = footerEditorContent.links.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item);
                                applyFooterShellContent({ ...footerEditorContent, links: nextLinks });
                              }}
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-semibold text-slate-400">
                            Link URL
                            <input
                              className="h-8 rounded-[7px] border border-white/10 bg-white/[0.04] px-2.5 text-[13px] text-white outline-none transition focus:border-fuchsia-400/60"
                              value={link.href}
                              onChange={(event) => {
                                const nextLinks = footerEditorContent.links.map((item, itemIndex) => itemIndex === index ? { ...item, href: event.target.value } : item);
                                applyFooterShellContent({ ...footerEditorContent, links: nextLinks });
                              }}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Layout</p>
                <div className="grid gap-2">
                  {layoutBlocks.filter((block) => block.label === "Two columns" || block.label === "Three columns" || block.label === "Row").map((block) => (
                    <button key={block.label} className="flex items-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={() => insertBodyElement(block.html, sectionEditor.id)} type="button">
                      <block.icon size={14} />
                      {block.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Add element</p>
                <div className="grid grid-cols-2 gap-2">
                  {snippets.filter((snippet) => snippet.label !== "Variable").map((snippet) => (
                    <button key={snippet.label} className="flex items-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={() => insertBodyElement(snippet.html, sectionEditor.id)} type="button">
                      <snippet.icon size={14} />
                      {snippet.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["{{first_name}}", "{{company}}", "{{email}}"].map((token) => (
                    <button key={token} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-slate-300 transition hover:bg-white/10" onClick={() => insertBodyElement(token, sectionEditor.id)} type="button">
                      {token}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
                <button className="inline-flex h-9 items-center justify-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-3 text-[13px] font-semibold text-white" onClick={applySectionVisualStyles} type="button">
                  <Save size={15} />
                  Apply
                </button>
                <button className="inline-flex h-9 items-center justify-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] px-3 text-[13px] font-semibold text-slate-100 transition hover:bg-white/10" onClick={() => duplicateSection(sectionEditor)} type="button">
                  <Copy size={15} />
                  Duplicate
                </button>
                <button className="col-span-2 inline-flex h-9 items-center justify-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] px-3 text-[13px] font-semibold text-slate-100 transition hover:bg-white/10" onClick={() => setCodeOpen(true)} type="button">
                  <Code2 size={15} />
                  Advanced code
                </button>
                <button className="col-span-2 inline-flex h-9 items-center justify-center gap-2 rounded-[7px] border border-red-400/20 bg-red-500/10 px-3 text-[13px] font-semibold text-red-200 transition hover:bg-red-500/15" onClick={() => removeSection(sectionEditor.id)} type="button">
                  <Trash2 size={15} />
                  Delete section
                </button>
              </div>
            </div>
          )}
        </aside>
      </section>

      {codeOpen && (
        <div className="fixed inset-0 z-[80] overflow-hidden bg-black/55 backdrop-blur-sm code-workspace-backdrop">
          <div className="code-workspace-panel ml-auto flex h-full w-full flex-col border-l border-white/10 bg-[#070b12] shadow-[-28px_0_70px_rgba(0,0,0,0.55)]">
            <div className="flex min-h-[54px] items-center justify-between gap-3 border-b border-white/10 bg-[#0b101b] px-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-8 place-items-center rounded-[8px] bg-violet-brand/15 text-fuchsia-300">
                  <Code2 size={16} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">HTML code editor</p>
                  <p className="truncate text-xs text-slate-500">{subject}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button aria-label="Undo" className="grid size-9 place-items-center rounded-[7px] border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35" disabled={!canUndo} onClick={undoBuilder} type="button">
                  <Undo2 size={17} />
                </button>
                <button aria-label="Redo" className="grid size-9 place-items-center rounded-[7px] border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35" disabled={!canRedo} onClick={redoBuilder} type="button">
                  <Redo2 size={17} />
                </button>
                <button className="inline-flex h-9 items-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-3 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={saving || loading} onClick={() => { void handleSave(); }} type="button">
                  {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
                  Save
                </button>
                <button aria-label="Close code editor" className="grid size-9 place-items-center rounded-[7px] border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={() => setCodeOpen(false)} type="button">
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
              <section className="flex min-h-0 flex-col bg-[#111827]">
                <div className="flex h-10 items-center justify-between border-b border-white/10 bg-[#0d1220] px-3">
                  <p className="text-xs font-semibold text-slate-200">Live preview</p>
                  <div className="flex rounded-[7px] border border-white/10 bg-white/[0.04] p-0.5">
                    <button aria-label="Desktop code preview" className={`grid size-7 place-items-center rounded-[5px] ${viewMode === "desktop" ? "bg-violet-brand text-white" : "text-slate-400"}`} onClick={() => setViewMode("desktop")} type="button">
                      <Laptop size={14} />
                    </button>
                    <button aria-label="Mobile code preview" className={`grid size-7 place-items-center rounded-[5px] ${viewMode === "mobile" ? "bg-violet-brand text-white" : "text-slate-400"}`} onClick={() => setViewMode("mobile")} type="button">
                      <Smartphone size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-1 items-start justify-center overflow-auto" style={{ ...previewBackgroundStyle, padding: previewPadding }}>
                  <div
                    className={`max-w-full transition-all ${viewMode === "mobile" ? "w-[375px]" : "w-full"}`}
                    style={viewMode === "desktop" ? { maxWidth: emailWidth } : undefined}
                  >
                    {displaySections.length === 0 ? (
                      <div data-body-text-inset className="min-h-[520px] overflow-hidden rounded-[10px] bg-white ring-1 ring-white/10" style={{ ...emailPreviewFrameStyle, ...bodyTextInsetStyle }}>
                        <div className="min-h-[520px] rounded-[10px] bg-white" />
                      </div>
                    ) : (
                      <>
                        {headerSection && renderStaticPreviewSection(headerSection)}
                        <div
                          data-body-text-inset
                          className={previewUsesWholeEmailBody ? "relative overflow-hidden rounded-[10px] bg-transparent" : "relative min-h-[520px] overflow-hidden rounded-[10px] bg-white ring-1 ring-white/10"}
                          style={{ ...emailPreviewFrameStyle, ...bodyTextInsetStyle }}
                        >
                          <div style={{ display: "none", maxHeight: 0, overflow: "hidden", opacity: 0 }}>{preheader}</div>
                          {bodySections.length === 0 ? (
                            <div className="min-h-[520px] rounded-[10px] bg-white" />
                          ) : (
                            <>
                              {bodyPatternSections.map((section) => renderStaticPreviewSection(section))}
                              {bodyFooterPatternSections.map((section) => renderStaticPreviewSection(section))}
                              <div className={previewUsesWholeEmailBody ? undefined : "relative z-10"} style={previewUsesWholeEmailBody ? undefined : { padding: bodyContentMargin }}>
                                {bodyContentSections.map((section, index) => (
                                  <div key={section.id} className={previewUsesWholeEmailBody && isWholeEmailSection(section) ? "w-full overflow-hidden" : "relative z-10"}>
                                    {!previewUsesWholeEmailBody && index > 0 && <div className="h-4" />}
                                    {renderStaticPreviewSection(section)}
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                          {!previewUsesWholeEmailBody && <div className="relative z-10 h-10" />}
                        </div>
                        {footerSection && renderStaticPreviewSection(footerSection)}
                      </>
                    )}
                  </div>
                </div>
              </section>

              <section className="flex min-h-0 flex-col border-l border-white/10 bg-[#05070d]">
                <div className="flex min-h-[42px] flex-wrap items-center gap-1 border-b border-white/10 bg-[#0d1220] px-3 py-1.5">
                  {[
                    { id: "emailBody" as const, label: "Body", detail: "white card" },
                    { id: "outsideBody" as const, label: "Outside body", detail: "background shell" },
                    { id: "documentHead" as const, label: "Document head", detail: "head/styles" },
                  ].map((sheet) => (
                    <button
                      key={sheet.id}
                      className={`flex h-8 items-center gap-2 rounded-t-[7px] border-x border-t px-3 text-xs font-semibold transition ${codeSheet === sheet.id ? "border-white/10 bg-[#05070d] text-slate-100" : "border-transparent text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"}`}
                      onClick={() => setCodeSheet(sheet.id)}
                      type="button"
                    >
                      <Code2 size={14} />
                      {sheet.label}
                    </button>
                  ))}
                  <div className="ml-auto flex items-center gap-2">
                    {codeCopyMessage && <span className="text-xs font-semibold text-emerald-300">{codeCopyMessage}</span>}
                    <button className="inline-flex h-8 items-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white" onClick={copyActiveCodeSheet} type="button">
                      <Copy size={14} />
                      {codeSheet === "emailBody" ? "Copy body HTML" : codeSheet === "outsideBody" ? "Copy outside HTML" : "Copy head code"}
                    </button>
                  </div>
                </div>
                <div className="grid min-h-0 flex-1 grid-cols-[58px_1fr] overflow-hidden">
                  <pre ref={codeLineNumbersRef} className="select-none overflow-hidden border-r border-white/10 bg-black/25 px-3 py-4 text-right font-mono text-xs leading-6 text-slate-600">{lineNumbers}</pre>
                  <div className={`relative min-h-0 overflow-hidden bg-[#05070d] transition ${dropTarget === "code" ? "bg-violet-brand/10 ring-2 ring-inset ring-fuchsia-400/60" : ""}`}>
                    <pre
                      ref={codeHighlightRef}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 select-none overflow-hidden whitespace-pre p-4 font-mono text-xs leading-6"
                    >
                      {highlightedCode}
                    </pre>
                    <textarea
                      ref={codeSheet === "emailBody" ? codeRef : undefined}
                      className="absolute inset-0 z-10 resize-none overflow-auto bg-transparent p-4 font-mono text-xs leading-6 text-transparent caret-fuchsia-300 outline-none placeholder:text-slate-600 selection:bg-fuchsia-400/30 selection:text-transparent"
                      onDragEnter={() => codeSheet === "emailBody" && setDropTarget("code")}
                      onDragLeave={() => setDropTarget(null)}
                      onDragOver={(event) => {
                        if (codeSheet !== "emailBody") {
                          return;
                        }
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                        setDropTarget("code");
                      }}
                      onDrop={handleCodeDrop}
                      onKeyDown={(event) => {
                        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
                          event.currentTarget.select();
                        }
                      }}
                      onPaste={handleCodePaste}
                      onScroll={handleCodeScroll}
                      onChange={(event) => {
                        const nextCode = event.target.value;

                        if (codeSheet === "emailBody") {
                          applyBodyCodeChange(nextCode);
                          return;
                        }

                        if (codeSheet === "outsideBody") {
                          applyOutsideBodyCodeChange(nextCode);
                          return;
                        }

                        commitBuilderSnapshot(getBuilderSnapshot({ customHead: nextCode }));
                      }}
                      placeholder={codeSheet === "emailBody" ? "Edit only the white email body HTML..." : codeSheet === "outsideBody" ? "Edit the logo/header and footer code outside the white body..." : "Add optional <style>, meta, or email-client head code here..."}
                      spellCheck={false}
                      value={activeCode}
                      wrap="off"
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
}
