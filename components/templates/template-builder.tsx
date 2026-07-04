"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type DragEvent, type FormEvent, type MouseEvent, type UIEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Bot,
  Braces,
  Code2,
  Columns3,
  Copy,
  Download,
  FileJson,
  Film,
  GripVertical,
  ImageIcon,
  Italic,
  Laptop,
  LayoutTemplate,
  List,
  Loader2,
  Mail,
  Minus,
  MousePointerClick,
  Palette,
  Pencil,
  Plus,
  Save,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Smartphone,
  Table2,
  Trash2,
  Type,
  Redo2,
  Underline,
  Undo2,
  UploadCloud,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type EmailTemplate = Database["public"]["Tables"]["email_templates"]["Row"];
type EmailTemplateVersion = Database["public"]["Tables"]["email_template_versions"]["Row"];
type ViewMode = "desktop" | "mobile";
type InspectorMode = "build" | "content" | "blocks" | "assets" | "ai" | "styles" | "advanced" | "settings";
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
  previewPadding: number;
  emailWidth: number;
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

const starterHtml = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7fb;padding:28px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:560px;max-width:100%;background:#ffffff;border-radius:12px;padding:40px;font-family:Arial,sans-serif;color:#111827;">
        <tr>
          <td style="text-align:center;color:#d946ef;font-size:32px;">&#9993;</td>
        </tr>
        <tr>
          <td style="padding-top:28px;font-size:14px;">Hi {{first_name}},</td>
        </tr>
        <tr>
          <td style="padding-top:18px;font-size:34px;line-height:1.15;font-weight:700;">
            Welcome to <span style="color:#d946ef;">Trigger Mail AI</span>
          </td>
        </tr>
        <tr>
          <td style="padding-top:18px;font-size:15px;line-height:1.6;color:#475569;">
            We are excited to have you on board. Create your first flow, connect your triggers, and start sending smarter emails.
          </td>
        </tr>
        <tr>
          <td style="padding-top:28px;">
            <a href="https://example.com" style="display:inline-block;background:#9333ea;color:#ffffff;text-decoration:none;border-radius:8px;padding:13px 24px;font-size:14px;font-weight:700;">Get Started</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();

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

function createSection(label: string, html: string): EmailSection {
  return {
    id: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    html,
  };
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
  const sourceHtml = rawHtml || starterHtml;
  const bodyHtml = extractBodyHtml(sourceHtml);
  const headStyles = extractHeadStyles(sourceHtml);

  if (typeof DOMParser === "undefined") {
    return [createSection(fallbackLabel, bodyHtml)];
  }

  try {
    const document = new DOMParser().parseFromString(bodyHtml, "text/html");
    const bodyStyles = Array.from(document.body.querySelectorAll("style")).map((style) => style.outerHTML).join("\n").trim();
    const documentStyles = [headStyles, bodyStyles].filter(Boolean).join("\n");
    const bodyNodes = meaningfulChildNodes(document.body);

    if (bodyNodes.length > 1) {
      return bodyNodes.map((node, index) => {
        const sectionHtml = `${index === 0 && documentStyles ? `${documentStyles}\n` : ""}${htmlFromNode(node)}`.trim();
        return createSection(`${fallbackLabel} ${index + 1}`, sectionHtml);
      });
    }

    return [createSection(fallbackLabel, `${documentStyles ? `${documentStyles}\n` : ""}${bodyHtml}`.trim())];
  } catch {
    return [createSection(fallbackLabel, bodyHtml)];
  }
}

function createSingleEditableSectionFromHtml(rawHtml: string, fallbackLabel = "Template HTML") {
  const sourceHtml = rawHtml || starterHtml;
  const bodyHtml = extractBodyHtml(sourceHtml);
  const headStyles = extractHeadStyles(sourceHtml);

  if (typeof DOMParser === "undefined") {
    return createSection(fallbackLabel, `${headStyles ? `${headStyles}\n` : ""}${bodyHtml}`.trim());
  }

  try {
    const document = new DOMParser().parseFromString(bodyHtml, "text/html");
    const bodyStyles = Array.from(document.body.querySelectorAll("style")).map((style) => style.outerHTML).join("\n").trim();
    const documentStyles = [headStyles, bodyStyles].filter(Boolean).join("\n");
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

    return createSection(fallbackLabel, `${documentStyles ? `${documentStyles}\n` : ""}${document.body.innerHTML}`.trim());
  } catch {
    return createSection(fallbackLabel, `${headStyles ? `${headStyles}\n` : ""}${bodyHtml}`.trim());
  }
}

function shouldSplitCodeHtml(rawHtml: string) {
  const topLevelSectionTags = rawHtml.match(/<(section|article)\b/gi) || [];
  return /<(html|body)\b/i.test(rawHtml) || topLevelSectionTags.length > 1;
}

function buildEditableHtmlSnapshot(rawHtml: string, fallbackLabel = "Template HTML", forceSplit = false) {
  const isFullHtmlDocument = /<(html|body)\b/i.test(rawHtml);
  const nextSections = isFullHtmlDocument
    ? [createSingleEditableSectionFromHtml(rawHtml, fallbackLabel)]
    : forceSplit || shouldSplitCodeHtml(rawHtml)
      ? createSectionsFromHtml(rawHtml, fallbackLabel)
      : [createSection(fallbackLabel, rawHtml || starterHtml)];
  const nextHtml = joinSections(nextSections);

  return {
    html: nextHtml || rawHtml || starterHtml,
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
    innerHtml: match?.[2] || sectionHtml,
    style: match?.[1] || "",
  };
}

function buildVisualSectionHtml(sectionHtml: string, background: string, padding: number, color: string) {
  const { innerHtml } = getVisualSectionParts(sectionHtml);
  return `<div data-builder-visual="section" style="background:${background};padding:${padding}px;color:${color};">${innerHtml.trim()}</div>`;
}

function buildSectionMinHeightHtml(sectionHtml: string, minHeight: number) {
  const visualParts = getVisualSectionParts(sectionHtml);
  const nextStyle = setStyleValue(visualParts.style || "background:#ffffff;padding:0;color:#111827", "min-height", `${minHeight}px`);

  return `<div data-builder-visual="section" style="${nextStyle}">${visualParts.innerHtml.trim()}</div>`;
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
  const codeRef = useRef<HTMLTextAreaElement | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const aiFileInputRef = useRef<HTMLInputElement | null>(null);
  const codeHighlightRef = useRef<HTMLPreElement | null>(null);
  const builderRef = useRef<HTMLElement | null>(null);
  const historyRef = useRef<BuilderSnapshot[]>([]);
  const historyIndexRef = useRef(-1);
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
  const [savedState, setSavedState] = useState<"saved" | "dirty">("saved");
  const [showSavedReturnAction, setShowSavedReturnAction] = useState(false);
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [codeOpen, setCodeOpen] = useState(false);
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
  const [sectionPaddingDraft, setSectionPaddingDraft] = useState(0);
  const [sectionTextColorDraft, setSectionTextColorDraft] = useState("#111827");
  const [textToolsSectionId, setTextToolsSectionId] = useState<string | null>(null);
  const [textColorDraft, setTextColorDraft] = useState("#111827");
  const [textHighlightDraft, setTextHighlightDraft] = useState("#ffffff");
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
  const [previewPadding, setPreviewPadding] = useState(20);
  const [emailWidth, setEmailWidth] = useState(760);
  const [customHead, setCustomHead] = useState("");
  const [exportMinified, setExportMinified] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
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
  const [contentAssetPicker, setContentAssetPicker] = useState<"image" | null>(null);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testHandlebarData, setTestHandlebarData] = useState(JSON.stringify({
    first_name: "Alex",
    company: "Acme Co",
    email: "alex@example.com",
  }, null, 2));
  const [testSending, setTestSending] = useState(false);
  const [testSendMessage, setTestSendMessage] = useState<string | null>(null);
  const [testSendError, setTestSendError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  const supabaseReady = hasSupabaseConfig();
  const lineNumbers = useMemo(() => html.split("\n").map((_, index) => index + 1).join("\n"), [html]);
  const highlightedCode = useMemo(() => renderHighlightedHtml(html), [html]);
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
      const sectionsForVersion = getSectionsWithPendingContentEdits();
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
    return {
      html: overrides.html ?? html,
      sections: overrides.sections ? cloneSections(overrides.sections) : cloneSections(sections),
      globalBackground: overrides.globalBackground ?? globalBackground,
      previewPadding: overrides.previewPadding ?? previewPadding,
      emailWidth: overrides.emailWidth ?? emailWidth,
      customHead: overrides.customHead ?? customHead,
    };
  }

  function getSectionsWithPendingContentEdits() {
    const pendingEdits = pendingContentEditsRef.current;
    return sections.map((section) => pendingEdits[section.id] === undefined ? section : { ...section, html: pendingEdits[section.id] });
  }

  function markSectionContentEditing(sectionId: string, nextSectionHtml: string) {
    pendingContentEditsRef.current = {
      ...pendingContentEditsRef.current,
      [sectionId]: nextSectionHtml,
    };
    setSections((currentSections) => {
      const nextSections = currentSections.map((section) => section.id === sectionId ? { ...section, html: nextSectionHtml } : section);
      setHtml(joinSections(nextSections));

      if (sectionEditor?.id === sectionId) {
        const nextSelectedSection = nextSections.find((section) => section.id === sectionId);
        if (nextSelectedSection) {
          setSectionEditor(nextSelectedSection);
          setSectionDraft(nextSelectedSection.html);
        }
      }

      return nextSections;
    });
    markDirty();
  }

  function getEditableSectionElement(sectionId: string) {
    return document.querySelector(`[data-editable-section="${sectionId}"]`) as HTMLDivElement | null;
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
      return editableElement;
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

    if (!editableElement) {
      return;
    }

    editableElement.querySelectorAll("[data-builder-hovered]").forEach((element) => {
      element.removeAttribute("data-builder-hovered");
    });
  }

  function hoverInspectTarget(sectionId: string, target?: EventTarget | null) {
    const inspectableTarget = getInspectableTarget(sectionId, target);

    clearHoveredInspectTarget(sectionId);

    if (!inspectableTarget) {
      return;
    }

    inspectableTarget.setAttribute("data-builder-hovered", inspectableTarget.tagName.toLowerCase());
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

    activeTextRangeRef.current = range.cloneRange();
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

    if (!editableElement || !target || !editableElement.contains(target)) {
      return editableElement;
    }

    return target;
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

    const hasSelection = restoreTextSelection();

    if (hasSelection && !window.getSelection()?.getRangeAt(0).collapsed) {
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand(command, false, value);
      saveTextSelection(textToolsSectionId);
      syncTextToolsHtml(textToolsSectionId);
      return;
    }

    const target = getActiveTextTarget(textToolsSectionId);

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

    const hasSelection = restoreTextSelection();
    const selection = window.getSelection();

    if (!hasSelection || !selection || selection.rangeCount === 0 || selection.getRangeAt(0).collapsed) {
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

  function snapshotsMatch(first: BuilderSnapshot | undefined, second: BuilderSnapshot) {
    return first ? JSON.stringify(first) === JSON.stringify(second) : false;
  }

  function applyBuilderSnapshot(snapshot: BuilderSnapshot) {
    const nextSnapshot = cloneSnapshot(snapshot);
    pendingContentEditsRef.current = {};
    setHtml(nextSnapshot.html);
    setSections(nextSnapshot.sections);
    setGlobalBackground(nextSnapshot.globalBackground);
    setPreviewPadding(nextSnapshot.previewPadding);
    setEmailWidth(nextSnapshot.emailWidth);
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
    const editableSnapshot = buildEditableHtmlSnapshot(template.html || starterHtml, template.name || "Template HTML");
    const nextHtml = editableSnapshot.html;
    const nextSections = editableSnapshot.sections;
    setHtml(nextHtml);
    setSections(nextSections);
    setCustomHead(nextCustomHead);
    setAiMessages(nextAiMessages);
    setAiMode("unknown");
    setAiError(null);
    setAiAttachments([]);
    setAiAttachmentError(null);
    resetBuilderHistory({
      html: nextHtml,
      sections: nextSections,
      globalBackground: "#111827",
      previewPadding: 20,
      emailWidth: 760,
      customHead: nextCustomHead,
    });
    setSavedState("saved");
  }, [resetBuilderHistory]);

  const startBlankTemplate = useCallback(() => {
    const blankSections = [createSection("Template HTML", starterHtml)];
    pendingContentEditsRef.current = {};
    setTemplateId(null);
    setTemplateName("Untitled Template");
    setSubject("Untitled subject");
    setPreheader("");
    setFromName("Trigger Mail AI");
    setFromEmail("hello@triggermail.ai");
    setHtml(starterHtml);
    setSections(blankSections);
    setCustomHead("");
    setAiMessages(initialAiMessages);
    setAiMode("unknown");
    setAiError(null);
    setAiAttachments([]);
    setAiAttachmentError(null);
    resetBuilderHistory({
      html: starterHtml,
      sections: blankSections,
      globalBackground: "#111827",
      previewPadding: 20,
      emailWidth: 760,
      customHead: "",
    });
    setSavedState("dirty");
  }, [resetBuilderHistory]);

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
        previewPadding,
        emailWidth,
        customHead,
      });
    }
  }, [customHead, emailWidth, globalBackground, html, loading, previewPadding, resetBuilderHistory, sections]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    void loadTemplateVersions();
  }, [loadTemplateVersions]);

  function insertHtmlAtCursor(sectionHtml: string) {
    const textarea = codeRef.current;
    if (!textarea) {
      const nextSections = [...sections, createSection("Custom section", sectionHtml)];
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
    const matchingSection = predesignedSections.find((section) => section.html === sectionHtml);
    const nextSections = [...sections, createSection(matchingSection?.label || "Custom section", sectionHtml)];
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function insertSectionAt(sectionHtml: string, index: number) {
    const matchingSection = predesignedSections.find((section) => section.html === sectionHtml);
    const nextSections = [...sections];
    nextSections.splice(index, 0, createSection(matchingSection?.label || "Custom section", sectionHtml));
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function addSectionAt(index: number) {
    const nextSections = [...sections];
    nextSections.splice(index, 0, createSection("New section", `
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

  function handleContentBlockInsert(block: (typeof contentBlocks)[number]) {
    if (block.label === "Image") {
      setContentAssetPicker("image");
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
    const targetId = targetSectionId || sectionEditor?.id || sections[sections.length - 1]?.id;

    if (!targetId) {
      const nextSections = [createSection("Email body", preparedElementHtml)];
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
  }

  async function sendTestEmail() {
    setTestSending(true);
    setTestSendError(null);
    setTestSendMessage(null);

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

      const sectionsForSend = getSectionsWithPendingContentEdits();
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
          data: handlebarData,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; id?: string; error?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "The test email could not be sent.");
      }

      setTestSendMessage(`Test email sent to ${testEmailTo}.`);
    } catch (sendError) {
      setTestSendError(getErrorMessage(sendError, "The test email could not be sent."));
    } finally {
      setTestSending(false);
    }
  }

  function getCurrentFullHtml() {
    const currentHtml = joinSections(getSectionsWithPendingContentEdits());
    const fullHtml = buildPreviewDocument(currentHtml, preheader, customHead);

    return exportMinified ? fullHtml.replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim() : fullHtml;
  }

  async function copyFullHtml() {
    await navigator.clipboard.writeText(getCurrentFullHtml());
    setExportCopied(true);
    window.setTimeout(() => setExportCopied(false), 1800);
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
    const sectionsForSync = getSectionsWithPendingContentEdits();
    pendingContentEditsRef.current = {};
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(sectionsForSync), sections: sectionsForSync }));
  }

  function resetCustomHead() {
    commitBuilderSnapshot(getBuilderSnapshot({ customHead: "" }));
  }

  function handleCodeDrop(event: DragEvent<HTMLTextAreaElement>) {
    const sectionHtml = getDraggedHtml(event.dataTransfer);
    if (!sectionHtml) {
      return;
    }

    event.preventDefault();
    setDropTarget(null);

    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const prefix = start > 0 && !html.slice(0, start).endsWith("\n") ? "\n\n" : "";
    const suffix = end < html.length && !html.slice(end).startsWith("\n") ? "\n\n" : "";
    const nextHtml = `${html.slice(0, start)}${prefix}${sectionHtml}${suffix}${html.slice(end)}`;
    const editableSnapshot = buildEditableHtmlSnapshot(nextHtml, "Custom HTML");
    commitBuilderSnapshot(getBuilderSnapshot(editableSnapshot));

    requestAnimationFrame(() => {
      const cursor = start + prefix.length + sectionHtml.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function handleCodeScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (!codeHighlightRef.current) {
      return;
    }

    codeHighlightRef.current.scrollTop = event.currentTarget.scrollTop;
    codeHighlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
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
    insertBodyElement(sectionHtml, sectionId);
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
      insertBodyElement(sectionHtml, sections[Math.max(0, index - 1)]?.id);
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
    setSectionPaddingDraft(Number.parseInt(getStyleValue(visualParts.style, "padding") || "0", 10) || 0);
    setSectionTextColorDraft(getStyleValue(visualParts.style, "color") || "#111827");
  }

  function saveSectionDraft() {
    if (!sectionEditor) {
      return;
    }

    const nextSections = sections.map((section) => section.id === sectionEditor.id ? { ...section, label: sectionLabelDraft || "Section", html: sectionDraft } : section);
    setSectionEditor(nextSections.find((section) => section.id === sectionEditor.id) || null);
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function applySectionVisualStyles() {
    if (!sectionEditor) {
      return;
    }

    const nextSectionHtml = buildVisualSectionHtml(sectionEditor.html, sectionBackgroundDraft, sectionPaddingDraft, sectionTextColorDraft);
    const nextSections = sections.map((section) => section.id === sectionEditor.id ? { ...section, label: sectionLabelDraft || "Section", html: nextSectionHtml } : section);
    const nextSelectedSection = nextSections.find((section) => section.id === sectionEditor.id) || null;
    setSectionEditor(nextSelectedSection);
    setSectionDraft(nextSectionHtml);
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function duplicateSection(section: EmailSection) {
    const currentIndex = sections.findIndex((item) => item.id === section.id);
    const nextSections = [...sections];
    nextSections.splice(currentIndex + 1, 0, createSection(`${section.label} copy`, section.html));
    commitBuilderSnapshot(getBuilderSnapshot({ html: joinSections(nextSections), sections: nextSections }));
  }

  function closeSectionEditor() {
    setSectionEditor(null);
    setSectionLabelDraft("");
    setSectionDraft("");
    setSectionBackgroundDraft("#ffffff");
    setSectionPaddingDraft(0);
    setSectionTextColorDraft("#111827");
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
      const sectionsForSave = getSectionsWithPendingContentEdits();
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
  }, [aiMessages, autoSaveEnabled, customHead, dirtyVersion, fromEmail, fromName, loading, preheader, savedState, saving, subject, templateId, templateName]);

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
              <p className="text-sm font-semibold text-white">Live preview</p>
              <p className="mt-1 text-xs text-slate-500">Drag a section from the right onto the preview to append it.</p>
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

          <div
            className={`flex flex-1 justify-center overflow-auto transition ${dropTarget === "preview" ? "ring-2 ring-inset ring-fuchsia-400/60" : ""}`}
            style={{ backgroundColor: globalBackground, padding: previewPadding, paddingBottom: previewPadding + 96 }}
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
              <div className={`min-h-[720px] overflow-visible rounded-[10px] border border-white/10 bg-white shadow-2xl transition-all ${viewMode === "mobile" ? "w-[375px]" : "w-full min-w-[520px]"}`} style={viewMode === "desktop" ? { maxWidth: emailWidth } : undefined}>
                <div style={{ display: "none", maxHeight: 0, overflow: "hidden", opacity: 0 }}>{preheader}</div>
                {sections.length === 0 ? (
                  <div className="grid min-h-[520px] place-items-center bg-slate-50 p-8 text-center">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">No sections yet</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">Drag a section from Build onto the preview.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {sections.map((section, index) => (
                      <div key={section.id}>
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
                            <span className="px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-fuchsia-600">Drop</span>
                            <button aria-label="Resize nearby section" className="grid h-6 w-7 cursor-row-resize place-items-center rounded-full text-slate-500 transition hover:bg-slate-100" onMouseDown={(event) => startDividerResize(event, index)} type="button">
                              <Minus size={14} />
                            </button>
                          </div>
                        </div>
                        <div
                          data-preview-section={section.id}
                          className={`group relative border-2 transition ${sectionEditor?.id === section.id ? "border-fuchsia-400/90 shadow-[0_0_0_3px_rgba(217,70,239,0.14)]" : "border-transparent hover:border-fuchsia-400/80"}`}
                          onDragOver={(event) => {
                            if (!isLayoutBlockDrag(event.dataTransfer)) {
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
                        >
                          <div className="pointer-events-none absolute right-2 top-2 z-10 hidden items-center gap-1 rounded-[7px] border border-slate-200 bg-white/95 p-1 shadow-lg group-hover:flex">
                            <span className="px-2 text-[11px] font-semibold text-slate-500">{section.label}</span>
                            <button
                              aria-label={`Edit ${section.label}`}
                              className="pointer-events-auto grid size-7 place-items-center rounded-[6px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                              onClick={(event) => {
                                event.stopPropagation();
                                openSectionEditor(section);
                              }}
                              type="button"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              aria-label={`Remove ${section.label}`}
                              className="pointer-events-auto grid size-7 place-items-center rounded-[6px] text-red-500 transition hover:bg-red-50"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeSection(section.id);
                              }}
                              type="button"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div
                            data-editable-section={section.id}
                            className="min-h-[24px] select-text outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60"
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(event) => {
                              if (textToolsSectionId === section.id || imageToolsSectionId === section.id || buttonToolsSectionId === section.id) {
                                markSectionContentEditing(section.id, event.currentTarget.innerHTML);
                                return;
                              }

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
                            onInput={(event) => markSectionContentEditing(section.id, event.currentTarget.innerHTML)}
                            onMouseLeave={() => clearHoveredInspectTarget(section.id)}
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
                            dangerouslySetInnerHTML={{ __html: section.html }}
                          />
                        </div>
                      </div>
                    ))}
                    <div
                      className={`group relative h-10 transition-all duration-200 ${dropTarget === `slot-${sections.length}` ? "h-12 bg-fuchsia-500/10" : "hover:h-12 hover:bg-fuchsia-500/5"}`}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDropTarget(`slot-${sections.length}`);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = "copy";
                        setDropTarget(`slot-${sections.length}`);
                      }}
                      onDrop={(event) => handleSlotDrop(event, sections.length)}
                    >
                      <div className={`absolute left-4 right-4 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-fuchsia-500 transition ${dropTarget === `slot-${sections.length}` ? "opacity-100" : "opacity-35 group-hover:opacity-70"}`} />
                      <div className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-fuchsia-300/60 bg-white px-1.5 py-1 text-slate-700 shadow-lg transition ${dropTarget === `slot-${sections.length}` ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                        <button aria-label="Add section here" className="grid size-6 place-items-center rounded-full text-fuchsia-600 transition hover:bg-fuchsia-50" onClick={() => addSectionAt(sections.length)} type="button">
                          <Plus size={14} />
                        </button>
                        <span className="px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-fuchsia-600">Drop</span>
                        <button aria-label="Resize previous section" className="grid h-6 w-7 cursor-row-resize place-items-center rounded-full text-slate-500 transition hover:bg-slate-100" onMouseDown={(event) => startDividerResize(event, sections.length)} type="button">
                          <Minus size={14} />
                        </button>
                      </div>
                    </div>
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
                            onClick={() => appendSection(section.html)}
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

              {inspectorMode === "content" && (
                <div>
                  <div className="mb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Content</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Add common email elements to the selected section or the current draft.</p>
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Global styles</p>
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-400">
                    Background
                    <span className="grid grid-cols-[42px_1fr] gap-2">
                      <input className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.04] p-1" type="color" value={globalBackground} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ globalBackground: event.target.value }))} />
                      <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" value={globalBackground} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ globalBackground: event.target.value }))} />
                    </span>
                  </label>
                  <label className="grid gap-2 text-xs font-semibold text-slate-400">
                    Preview margin
                    <input min={0} max={56} type="range" value={previewPadding} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ previewPadding: Number(event.target.value) }))} />
                    <span className="text-xs text-slate-500">{previewPadding}px</span>
                  </label>
                  <label className="grid gap-2 text-xs font-semibold text-slate-400">
                    Email width
                    <input min={520} max={920} type="range" value={emailWidth} onChange={(event) => commitBuilderSnapshot(getBuilderSnapshot({ emailWidth: Number(event.target.value) }))} />
                    <span className="text-xs text-slate-500">{emailWidth}px</span>
                  </label>
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
                      <input className="h-9 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none" placeholder="you@example.com" type="email" value={testEmailTo} onChange={(event) => { setTestEmailTo(event.target.value); setTestSendError(null); setTestSendMessage(null); }} />
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
                      <textarea className="min-h-[150px] resize-y rounded-[8px] border border-white/10 bg-[#070b12] px-3 py-2 font-mono text-[12px] leading-5 text-slate-100 outline-none transition focus:border-fuchsia-400/60" spellCheck={false} value={testHandlebarData} onChange={(event) => { setTestHandlebarData(event.target.value); setTestSendError(null); setTestSendMessage(null); }} />
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
            <div className="absolute bottom-0 right-0 top-0 z-20 flex flex-col border-l border-white/10 bg-[#0D121C] p-2.5 shadow-2xl" style={{ left: 48 }}>
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
                <label className="grid gap-2 text-xs font-semibold text-slate-400">
                  Padding
                  <input min={0} max={64} type="range" value={sectionPaddingDraft} onChange={(event) => setSectionPaddingDraft(Number(event.target.value))} />
                  <span className="text-xs text-slate-500">{sectionPaddingDraft}px</span>
                </label>
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
                <button className="inline-flex h-9 items-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-3 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={saving || loading} onClick={() => handleSave()} type="button">
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
                <div className="flex flex-1 justify-center overflow-auto" style={{ backgroundColor: globalBackground, padding: previewPadding, paddingBottom: previewPadding + 96 }}>
                  <iframe
                    className={`min-h-[720px] border border-white/10 bg-white shadow-2xl transition-all ${viewMode === "mobile" ? "w-[375px]" : "w-full"}`}
                    sandbox=""
                    srcDoc={buildPreviewDocument(html, preheader, customHead)}
                    style={viewMode === "desktop" ? { maxWidth: emailWidth } : undefined}
                    title="Email code preview"
                  />
                </div>
              </section>

              <section className="flex min-h-0 flex-col border-l border-white/10 bg-[#05070d]">
                <div className="flex h-10 items-center border-b border-white/10 bg-[#0d1220] px-3">
                  <div className="flex h-full items-center gap-2 border-x border-t border-white/10 bg-[#05070d] px-3 text-xs font-semibold text-slate-200">
                    <Code2 size={14} />
                    template.html
                  </div>
                  <div className="ml-auto text-xs text-slate-600">HTML</div>
                </div>
                <div className="grid min-h-0 flex-1 grid-cols-[58px_1fr] overflow-hidden">
                  <pre className="select-none overflow-hidden border-r border-white/10 bg-black/25 px-3 py-4 text-right font-mono text-xs leading-6 text-slate-600">{lineNumbers}</pre>
                  <div className={`relative min-h-0 overflow-hidden bg-[#05070d] transition ${dropTarget === "code" ? "bg-violet-brand/10 ring-2 ring-inset ring-fuchsia-400/60" : ""}`}>
                    <pre
                      ref={codeHighlightRef}
                      aria-hidden="true"
                      className="absolute inset-0 overflow-hidden whitespace-pre p-4 font-mono text-xs leading-6"
                    >
                      {highlightedCode}
                    </pre>
                    <textarea
                      ref={codeRef}
                      className="absolute inset-0 z-10 resize-none overflow-auto bg-transparent p-4 font-mono text-xs leading-6 text-transparent caret-fuchsia-300 outline-none placeholder:text-slate-600 selection:bg-fuchsia-400/30 selection:text-white"
                      onDragEnter={() => setDropTarget("code")}
                      onDragLeave={() => setDropTarget(null)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                        setDropTarget("code");
                      }}
                      onDrop={handleCodeDrop}
                      onScroll={handleCodeScroll}
                      onChange={(event) => {
                        const nextHtml = event.target.value;
                        const editableSnapshot = buildEditableHtmlSnapshot(nextHtml, "Custom HTML");
                        commitBuilderSnapshot(getBuilderSnapshot(editableSnapshot));
                      }}
                      spellCheck={false}
                      value={html}
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
