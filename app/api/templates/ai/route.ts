import { NextResponse } from "next/server";
import { ensureWorkspaceForUser, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";

type AiMessage = {
  role: "assistant" | "user";
  content: string;
};

type TemplateContext = {
  name?: string;
  subject?: string;
  preheader?: string;
  html?: string;
  selectedText?: string;
  selectedSection?: {
    id?: string;
    label?: string;
    html?: string;
  };
};

type AiAttachment = {
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  text?: string;
};

type AiAssetRequest = {
  key?: string;
  name?: string;
  prompt?: string;
  alt?: string;
};

type GeneratedAsset = {
  key: string;
  name: string;
  path: string;
  url: string;
  mimeType: string;
  size: number;
  prompt: string;
  alt: string;
};

type AiTemplateResponse = {
  reply: string;
  action: "reply" | "update";
  mode?: "ai" | "demo";
  name?: string;
  subject?: string;
  preheader?: string;
  html?: string;
  attachmentNotes?: string;
  assetRequests?: AiAssetRequest[];
  generatedAssets?: GeneratedAsset[];
};

type EmailIntent = ReturnType<typeof getIntent>;

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripCodeFence(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseAiJson(content: string): AiTemplateResponse {
  const cleaned = stripCodeFence(content);
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return {
      action: "reply",
      reply: cleaned || "Tell me who the email is for, what it should achieve, and the tone you want.",
    };
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<AiTemplateResponse>;

  return {
    action: parsed.action === "update" ? "update" : "reply",
    mode: "ai",
    reply: typeof parsed.reply === "string" ? parsed.reply : "I have updated the email draft.",
    name: typeof parsed.name === "string" ? parsed.name : undefined,
    subject: typeof parsed.subject === "string" ? parsed.subject : undefined,
    preheader: typeof parsed.preheader === "string" ? parsed.preheader : undefined,
    html: typeof parsed.html === "string" ? parsed.html : undefined,
    attachmentNotes: typeof parsed.attachmentNotes === "string" ? parsed.attachmentNotes : undefined,
    assetRequests: Array.isArray(parsed.assetRequests)
      ? parsed.assetRequests.filter((asset): asset is AiAssetRequest => {
        if (!asset || typeof asset !== "object") {
          return false;
        }

        const record = asset as AiAssetRequest;
        return typeof record.prompt === "string" && record.prompt.trim().length > 0;
      }).slice(0, 3)
      : undefined,
  };
}

function getIntent(prompt: string) {
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes("payment") || lowerPrompt.includes("invoice") || lowerPrompt.includes("receipt")) {
    return {
      name: "Payment Confirmation",
      subject: "Your payment has been received",
      preheader: "Your account has been updated and the payment details are inside.",
      headline: "Thanks for your payment, {{first_name}}",
      body: "Your payment has been received and your account has been updated. Keep this email for your records.",
      cta: "View payment details",
    };
  }

  if (lowerPrompt.includes("welcome") || lowerPrompt.includes("onboard")) {
    return {
      name: "Welcome Email",
      subject: "Welcome to Trigger Mail AI",
      preheader: "Everything you need to get started is inside.",
      headline: "Welcome, {{first_name}}",
      body: "We are excited to have you here. This email gives you the first steps to get value quickly.",
      cta: "Start building",
    };
  }

  if (lowerPrompt.includes("sale") || lowerPrompt.includes("lead") || lowerPrompt.includes("demo")) {
    return {
      name: "Sales Follow Up",
      subject: "Following up on your interest",
      preheader: "A quick next step based on your recent enquiry.",
      headline: "Ready to take the next step?",
      body: "Thanks for your interest. Here is a simple next step so we can understand what you need and help you move forward.",
      cta: "Book a call",
    };
  }

  return {
    name: "Campaign Email",
    subject: "A quick update from Trigger Mail AI",
    preheader: "Here is the latest update and the next step.",
    headline: "A quick update for {{first_name}}",
    body: "Here is the key message for your audience. Keep the copy focused on one outcome and make the next action clear.",
    cta: "Take action",
  };
}

function describeAttachments(attachments: AiAttachment[] = []) {
  if (attachments.length === 0) {
    return "";
  }

  return attachments
    .map((attachment) => {
      const readableText = attachment.text?.trim();
      const type = attachment.mimeType || "file";
      return readableText
        ? `${attachment.name} (${type}, ${attachment.size} bytes):\n${readableText.slice(0, 4000)}`
        : `${attachment.name} (${type}, ${attachment.size} bytes)`;
    })
    .join("\n");
}

function getAttachmentNames(attachments: AiAttachment[] = []) {
  return attachments.map((attachment) => attachment.name).join(", ");
}

const assetBucket = "template-assets";
const maxGeneratedAssetSize = 10 * 1024 * 1024;

function cleanGeneratedAssetName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "generated-asset-" + Date.now();
}

async function ensureAssetBucket(supabase: Awaited<ReturnType<typeof getAdminContext>>["supabase"]) {
  const { data: bucket } = await supabase.storage.getBucket(assetBucket);

  if (bucket) {
    return;
  }

  const { error } = await supabase.storage.createBucket(assetBucket, {
    public: true,
    fileSizeLimit: 50 * 1024 * 1024,
  });

  if (error && !/already exists/i.test(error.message)) {
    throw error;
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceGeneratedAssetPlaceholders(html: string, assets: GeneratedAsset[]) {
  return assets.reduce((nextHtml, asset) => {
    const escapedKey = escapeRegExp(asset.key);
    return nextHtml
      .replace(new RegExp("{{\\s*" + escapedKey + "_url\\s*}}", "gi"), asset.url)
      .replace(new RegExp("{{\\s*" + escapedKey + "_alt\\s*}}", "gi"), escapeHtml(asset.alt));
  }, html);
}

function hasImageAttachment(attachments: AiAttachment[]) {
  return attachments.some((attachment) => attachment.dataUrl?.startsWith("data:image/"));
}

function shouldAutoRequestReferenceAsset(
  prompt: string,
  attachments: AiAttachment[],
  attachmentAnalysis: string,
  response: AiTemplateResponse,
) {
  if (response.action !== "update" || response.assetRequests?.length || !hasImageAttachment(attachments)) {
    return false;
  }

  const combinedContext = `${prompt}\n${attachmentAnalysis}`.toLowerCase();
  const asksToCopyVisualStyle = /\b(copy|match|recreate|replicate|reference|style|design|look like|based on|similar to)\b/.test(combinedContext);
  const includesHardToCodeVisuals = /\b(hero|image|photo|photograph|illustration|artwork|graphic|visual|mockup|product|screenshot|background|texture|pattern|decorative|banner|scene|device|person|people)\b/.test(combinedContext);

  return asksToCopyVisualStyle && includesHardToCodeVisuals;
}

function buildReferenceAssetRequest(prompt: string, attachmentAnalysis: string): AiAssetRequest {
  const visualNotes = attachmentAnalysis
    .replace(/\s+/g, " ")
    .slice(0, 1200)
    .trim();

  return {
    key: "generated_asset_1",
    name: "reference-style-banner-asset",
    alt: "Decorative banner asset inspired by the attached reference",
    prompt: [
      "Create one modular visual asset for an editable email template, such as the specific illustration, decorative header strip, product crop, abstract background, texture, or section artwork visible in the reference.",
      "Do not create a full email, newsletter, landing page, UI screenshot, poster, flyer, CTA button, text layout, logo, or complete composed template.",
      "Leave all headline, body copy, buttons, pricing, dates, and footer content out of the image so the email remains editable HTML.",
      "Do not copy logos, exact text, brand marks, protected characters, or a screenshot verbatim.",
      "If the reference has a right-side hero illustration, create only that illustration asset, cropped cleanly so it can be placed in the right hero column.",
      "Match the reference mood, palette, materials, image treatment, lighting, dimensionality, and polish closely enough for this asset to sit inside the surrounding email design.",
      visualNotes ? `Reference observations: ${visualNotes}` : "",
      `User request: ${prompt}`,
    ].filter(Boolean).join(" "),
  };
}

function ensureAssetPlaceholder(html: string, request: AiAssetRequest) {
  const key = request.key || "generated_asset_1";

  if (new RegExp(`{{\\s*${escapeRegExp(key)}_url\\s*}}`, "i").test(html)) {
    return html;
  }

  const assetBlock = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">
  <tr>
    <td align="center">
      <img src="{{${key}_url}}" alt="{{${key}_alt}}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:16px;" />
    </td>
  </tr>
</table>`.trim();

  const firstHeadlineMatch = html.match(/<\/h1>/i);

  if (typeof firstHeadlineMatch?.index !== "number") {
    return `${assetBlock}\n${html}`;
  }

  const insertAt = firstHeadlineMatch.index + firstHeadlineMatch[0].length;
  return `${html.slice(0, insertAt)}\n${assetBlock}\n${html.slice(insertAt)}`;
}

function buildGeneratedAssetBlock(asset: GeneratedAsset) {
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 22px;">
  <tr>
    <td align="center">
      <img src="${asset.url}" alt="${escapeHtml(asset.alt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:16px;" />
    </td>
  </tr>
</table>`.trim();
}

function insertAssetBlockNearHero(html: string, assetBlock: string) {
  const firstHeadlineMatch = html.match(/<\/h1>/i);

  if (typeof firstHeadlineMatch?.index === "number") {
    const insertAt = firstHeadlineMatch.index + firstHeadlineMatch[0].length;
    return `${html.slice(0, insertAt)}\n${assetBlock}\n${html.slice(insertAt)}`;
  }

  const firstParagraphMatch = html.match(/<\/p>/i);

  if (typeof firstParagraphMatch?.index === "number") {
    const insertAt = firstParagraphMatch.index + firstParagraphMatch[0].length;
    return `${html.slice(0, insertAt)}\n${assetBlock}\n${html.slice(insertAt)}`;
  }

  return `${assetBlock}\n${html}`;
}

function ensureGeneratedAssetsEmbedded(html: string, assets: GeneratedAsset[]) {
  return assets.reduce((nextHtml, asset) => {
    if (nextHtml.includes(asset.url)) {
      return nextHtml;
    }

    return insertAssetBlockNearHero(nextHtml, buildGeneratedAssetBlock(asset));
  }, html);
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstTagText(html: string, tagName: string) {
  const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? stripHtml(match[1]) : "";
}

function shouldUseLockedReferenceHero(prompt: string, attachmentAnalysis: string, response: AiTemplateResponse) {
  if (response.action !== "update" || !response.html) {
    return false;
  }

  const context = `${prompt}\n${attachmentAnalysis}\n${stripHtml(response.html)}`.toLowerCase();
  const hasGradientHero = /\b(hero|header)\b/.test(context) && /\b(purple|pink|magenta|gradient)\b/.test(context);
  const hasRightVisual = /\b(right|right-side|two-column|illustration|artwork|image|visual|database|sync|refresh|report)\b/.test(context);
  const wantsRecreation = /\b(copy|match|recreate|replicate|reference|screenshot|style|design|look like)\b/.test(context);

  return hasGradientHero && hasRightVisual && wantsRecreation;
}

function buildLockedReferenceHeroHtml(response: AiTemplateResponse, assetKey = "generated_asset_1") {
  const sourceHtml = response.html || "";
  const headline = extractFirstTagText(sourceHtml, "h1") || response.subject || "Your scheduled refresh is complete!";
  const paragraphs = Array.from(sourceHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
  const brand = paragraphs.find((paragraph) => /app|team|report|acknowledged/i.test(paragraph) && paragraph.length < 48) || "Appknowledged";
  const supportingCopy = paragraphs.find((paragraph) => /updated|ready|view|report|complete/i.test(paragraph) && paragraph !== headline) || "We've updated your data and your report is ready to view.";
  const cta = stripHtml(sourceHtml.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1] || "") || "{{actionLabel}}";
  const footer = paragraphs.find((paragraph) => /knack|reports|unsubscribe|preferences/i.test(paragraph)) || `${brand} • Knack Reports`;

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f3ff;padding:24px 0 34px;">
  <tr>
    <td align="center" style="padding:0 14px;">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:620px;max-width:100%;background:#ffffff;border-radius:20px;overflow:hidden;font-family:Arial,sans-serif;color:#25224f;box-shadow:0 18px 55px rgba(70,38,120,0.18);">
        <tr>
          <td style="background:linear-gradient(135deg,#3412a7 0%,#7416d8 54%,#ec1b76 100%);padding:34px 38px 0;color:#ffffff;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td colspan="2" style="padding:0 0 46px;">
                  <table role="presentation" cellspacing="0" cellpadding="0">
                    <tr>
                      <td width="28" style="width:28px;vertical-align:middle;">
                        <span style="display:block;width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,#6d28d9,#f43f8f);color:#ffffff;text-align:center;line-height:24px;font-size:15px;font-weight:800;">✓</span>
                      </td>
                      <td style="padding-left:10px;font-size:19px;line-height:1.2;font-weight:800;color:#ffffff;">${escapeHtml(brand)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td width="55%" style="width:55%;padding:0 24px 42px 0;vertical-align:middle;">
                  <h1 style="margin:0;font-size:34px;line-height:1.18;font-weight:800;color:#ffffff;">${escapeHtml(headline)}</h1>
                  <p style="margin:20px 0 0;font-size:16px;line-height:1.55;color:#ffffff;">${escapeHtml(supportingCopy)}</p>
                </td>
                <td width="45%" align="right" style="width:45%;padding:0 0 34px 10px;vertical-align:middle;">
                  <img src="{{${assetKey}_url}}" alt="{{${assetKey}_alt}}" width="230" style="display:block;width:100%;max-width:230px;height:auto;border:0;border-radius:18px;" />
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="height:34px;background:#ffffff;border-radius:70% 70% 0 0;line-height:34px;font-size:1px;">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 42px 48px;background:#ffffff;">
            <p style="margin:0 0 22px;font-size:18px;line-height:1.6;color:#25224f;">Hi {{name}},</p>
            <p style="margin:0 0 22px;font-size:18px;line-height:1.6;color:#25224f;">Your scheduled refresh is complete.</p>
            <p style="margin:0 0 28px;font-size:18px;line-height:1.6;color:#25224f;">{{body}}</p>
            <table role="presentation" cellspacing="0" cellpadding="0">
              <tr>
                <td style="border-radius:8px;background:linear-gradient(135deg,#7c1fe7,#ec1b76);">
                  <a href="https://example.com" style="display:inline-block;padding:16px 30px;color:#ffffff;text-decoration:none;font-size:18px;font-weight:800;">${escapeHtml(cta)} →</a>
                </td>
              </tr>
            </table>
            <p style="margin:34px 0 0;font-size:17px;line-height:1.5;color:#363161;">— The ${escapeHtml(brand)} team</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="border-top:1px solid #ece8f7;padding:24px 34px 28px;background:#ffffff;font-size:14px;line-height:1.6;color:#8a78b6;">
            ${escapeHtml(footer)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

function normalizeReferenceReply(reply: string, usedLockedScaffold: boolean) {
  const baseReply = reply.trim() || "I made a close editable recreation from the reference.";
  const bestEffortNote = "It is a close editable recreation rather than a pixel-perfect copy, because some screenshot details and email-client rendering have to be approximated.";

  if (/pixel-perfect|exact copy|exactly copied/i.test(baseReply)) {
    return `${baseReply.replace(/pixel-perfect|exact copy|exactly copied/gi, "close editable")} ${bestEffortNote}`;
  }

  if (/close editable recreation|pixel-perfect copy/i.test(baseReply)) {
    return baseReply;
  }

  return `${baseReply} ${usedLockedScaffold ? "I used a structured hero scaffold to keep the major layout closer to the reference." : bestEffortNote}`;
}
async function generateImageAsset(
  apiKey: string,
  supabase: Awaited<ReturnType<typeof getAdminContext>>["supabase"],
  workspaceId: string,
  request: AiAssetRequest,
  index: number,
): Promise<GeneratedAsset | null> {
  const prompt = request.prompt?.trim();

  if (!prompt) {
    return null;
  }

  const key = request.key?.trim().replace(/[^a-z0-9_]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "generated_asset_" + (index + 1);
  const alt = request.alt?.trim() || request.name?.trim() || "Generated email artwork " + (index + 1);
  const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: imageModel,
      prompt: [
        prompt,
        "Create a polished email-safe visual asset. No tiny unreadable text. Keep composition clean, commercial, and usable inside a marketing or transactional email.",
      ].join(" "),
      size: "1024x1024",
      quality: "medium",
      n: 1,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: { b64_json?: string; url?: string }[];
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || "The image asset could not be generated.");
  }

  const image = payload.data?.[0];
  let bytes: Uint8Array | null = null;

  if (image?.b64_json) {
    bytes = Uint8Array.from(Buffer.from(image.b64_json, "base64"));
  } else if (image?.url) {
    const imageResponse = await fetch(image.url);

    if (!imageResponse.ok) {
      throw new Error("The generated image could not be downloaded.");
    }

    bytes = new Uint8Array(await imageResponse.arrayBuffer());
  }

  if (!bytes || bytes.byteLength === 0) {
    throw new Error("The generated image response was empty.");
  }

  if (bytes.byteLength > maxGeneratedAssetSize) {
    throw new Error("The generated image was too large to save.");
  }

  await ensureAssetBucket(supabase);

  const safeName = cleanGeneratedAssetName(request.name || alt || key);
  const fileName = Date.now() + "-" + (index + 1) + "-" + safeName + ".png";
  const storagePath = workspaceId + "/" + fileName;
  const { error: uploadError } = await supabase.storage.from(assetBucket).upload(storagePath, bytes, {
    contentType: "image/png",
    upsert: false,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(assetBucket).getPublicUrl(storagePath);

  return {
    key,
    name: fileName,
    path: storagePath,
    url: data.publicUrl,
    mimeType: "image/png",
    size: bytes.byteLength,
    prompt,
    alt,
  };
}

async function generateRequestedAssets(
  apiKey: string,
  supabase: Awaited<ReturnType<typeof getAdminContext>>["supabase"],
  workspaceId: string,
  requests: AiAssetRequest[] = [],
) {
  const generatedAssets: GeneratedAsset[] = [];

  const requestedAssets = requests.slice(0, 3);

  for (let index = 0; index < requestedAssets.length; index += 1) {
    const asset = await generateImageAsset(apiKey, supabase, workspaceId, requestedAssets[index], index);

    if (asset) {
      generatedAssets.push(asset);
    }
  }

  return generatedAssets;
}

function sanitizeEmailImages(html: string) {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc=(["'])(.*?)\1/i)?.[2]?.trim() || "";
    const alt = tag.match(/\balt=(["'])(.*?)\1/i)?.[2]?.trim() || "Icon";
    const isUsableSrc = /^(https?:|data:image\/|cid:)/i.test(src);

    if (isUsableSrc && !/placehold\.co|placeholder|dummyimage/i.test(src)) {
      return tag;
    }

    const safeAlt = escapeHtml(alt || "Icon");
    const iconText = safeAlt
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "•";

    return `<span role="img" aria-label="${safeAlt}" style="display:inline-block;width:52px;height:52px;border-radius:16px;background:linear-gradient(135deg,#6d28d9,#ec4899);color:#ffffff;text-align:center;line-height:52px;font-family:Arial,sans-serif;font-size:18px;font-weight:800;box-shadow:0 10px 22px rgba(109,40,217,0.22);">${iconText}</span>`;
  });
}

async function analyzeAttachments(apiKey: string, model: string, attachments: AiAttachment[]) {
  if (attachments.length === 0) {
    return "";
  }

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail?: "high" | "low" | "auto" } }
  > = [
    {
      type: "text",
      text: [
        "Inspect the attached files for an email-template builder.",
        "Return concrete observations only: visible text, layout, colours, hierarchy, imagery, brand cues, tone, and anything that should influence the email design.",
        "For template screenshots, produce a recreation blueprint: outer background, card dimensions/shape, header/logo treatment, hero text, feature blocks/cards, body copy, CTA, footer, decorative shapes, approximate spacing, and colours.",
        "Be specific about spatial relationships: whether the hero is one column or two columns, where imagery sits, where the logo sits, where curves/waves/dividers appear, which edges are rounded, where shadows appear, and what content belongs above or below each divider.",
        "Call out any icons or images and whether they should be recreated as CSS/Unicode rather than <img> tags.",
        "If a file cannot be inspected, say exactly which file and why.",
      ].join(" "),
    },
  ];

  attachments.forEach((attachment) => {
    content.push({
      type: "text",
      text: `File: ${attachment.name} (${attachment.mimeType || "unknown type"}, ${attachment.size} bytes)`,
    });

    if (attachment.text?.trim()) {
      content.push({
        type: "text",
        text: `Readable content from ${attachment.name}:\n${attachment.text.trim().slice(0, 12000)}`,
      });
    }

    if (attachment.dataUrl?.startsWith("data:image/")) {
      content.push({
        type: "image_url",
        image_url: { url: attachment.dataUrl, detail: "high" },
      });
    } else if (!attachment.text?.trim()) {
      content.push({
        type: "text",
        text: `${attachment.name} has no readable text or supported image preview in this request.`,
      });
    }
  });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content: "You are a precise file-inspection assistant. Do not design the email. Only report what is actually visible or readable in the supplied files.",
          },
          {
            role: "user",
            content,
          },
        ],
      }),
    });
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    if (!response.ok) {
      return `Attachment inspection failed: ${payload.error?.message || "OpenAI did not inspect the files."}`;
    }

    return payload.choices?.[0]?.message?.content?.trim() || "Attachment inspection returned no observations.";
  } catch (error) {
    return `Attachment inspection failed: ${getErrorMessage(error, "The files could not be inspected.")}`;
  }
}

async function repairReferenceResponse(
  apiKey: string,
  model: string,
  prompt: string,
  attachments: AiAttachment[],
  attachmentAnalysis: string,
  responseToRepair: AiTemplateResponse,
) {
  if (attachments.length === 0 || responseToRepair.action !== "update" || !responseToRepair.html) {
    return responseToRepair;
  }

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail?: "high" | "low" | "auto" } }
  > = [
    {
      type: "text",
      text: JSON.stringify({
        userRequest: prompt,
        attachmentAnalysis,
        draftResponse: responseToRepair,
        repairGoal: "Rewrite the HTML so it follows the attached reference screenshot much more closely while staying editable and email-safe. Keep the same JSON shape.",
        mandatoryChecks: [
          "The screenshot is a layout spec, not a mood board.",
          "The outer email must remain a centered rounded card on a pale tinted background.",
          "The hero must be one shared purple/pink rounded gradient area, not a separate left colour block plus a white right block.",
          "If the screenshot has artwork on the right side of the hero, place the generated_asset placeholder inside the right hero column within the same gradient area.",
          "Preserve the logo/brand lockup at the upper left of the hero.",
          "Preserve headline and supporting copy position, approximate size, and line breaks.",
          "Preserve the curved or wave transition from hero to white body; do not replace it with a straight horizontal cut.",
          "Preserve body padding, CTA placement, signature placement, footer band, border lines, rounded corners, and soft shadow.",
          "Do not create one full-image email; keep text, CTA, body, and footer editable HTML.",
          "Use email-safe tables and inline styles only.",
        ],
      }),
    },
  ];

  attachments.forEach((attachment) => {
    if (attachment.dataUrl?.startsWith("data:image/")) {
      content.push({
        type: "text",
        text: `Reference screenshot: ${attachment.name}. Compare the draft HTML structure to this image and repair mismatches.`,
      });
      content.push({
        type: "image_url",
        image_url: { url: attachment.dataUrl, detail: "high" },
      });
    }
  });

  try {
    const repairResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 5000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You are a strict email screenshot recreation auditor.",
              "Your job is to repair a generated email template so its layout matches the attached screenshot as closely as email-safe HTML allows.",
              "Return only valid JSON with keys: action, reply, name, subject, preheader, html, attachmentNotes, assetRequests.",
              "Keep generated asset requests modular and ensure each placeholder appears exactly once at the matching visual location.",
              "Do not redesign the reference. Preserve the major structure and visual hierarchy, while accepting that email-safe HTML may only be a close practical recreation.",
            ].join(" "),
          },
          {
            role: "user",
            content,
          },
        ],
      }),
    });
    const payload = (await repairResponse.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    if (!repairResponse.ok) {
      return responseToRepair;
    }

    const repaired = parseAiJson(payload.choices?.[0]?.message?.content || "");

    if (repaired.action !== "update" || !repaired.html) {
      return responseToRepair;
    }

    return {
      ...responseToRepair,
      ...repaired,
      assetRequests: repaired.assetRequests?.length ? repaired.assetRequests : responseToRepair.assetRequests,
      attachmentNotes: repaired.attachmentNotes || responseToRepair.attachmentNotes,
    };
  } catch {
    return responseToRepair;
  }
}

function buildSectionCard(title: string, body: string) {
  return `
<td width="50%" style="padding:10px;vertical-align:top;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="height:100%;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;">
    <tr>
      <td style="padding:18px;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#111827;">${escapeHtml(title)}</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">${escapeHtml(body)}</p>
      </td>
    </tr>
  </table>
</td>`.trim();
}

function getFallbackCards(intentName: string) {
  if (/payment|invoice/i.test(intentName)) {
    return [
      ["Payment confirmed", "Your payment has been applied successfully, and the account record is now up to date."],
      ["What to keep", "Save this confirmation for your records. You can also use {{email}} to match it to the right customer."],
      ["Need a change?", "If any details look wrong, reply to this email and the team can review the payment trail."],
      ["Next step", "Use the button below to view the payment, invoice, or related account activity."],
    ];
  }

  if (/welcome|onboard/i.test(intentName)) {
    return [
      ["Start with one flow", "Create your first simple automation before adding more complex triggers or branches."],
      ["Connect your data", "Use variables like {{first_name}}, {{company}}, and {{email}} to make each message feel personal."],
      ["Preview before sending", "Check the desktop and mobile preview so the message feels polished in every inbox."],
      ["Build momentum", "Once the first email is live, add a follow-up step to keep the journey moving."],
    ];
  }

  if (/sales|follow/i.test(intentName)) {
    return [
      ["Why we are reaching out", "You showed interest, so this follow-up focuses on the next useful step rather than a hard sell."],
      ["Relevant context", "Reference {{company}} or the original enquiry so the message feels specific and timely."],
      ["Clear next step", "Make it easy to book a call, request pricing, or reply with a question."],
      ["Light proof", "Use a short result, quote, or customer outcome to build trust without slowing the reader down."],
    ];
  }

  return [
    ["Main message", "Lead with the most useful update so the reader understands the value immediately."],
    ["Personal context", "Use available flow data to make the email feel connected to the reader’s situation."],
    ["Reason to act", "Explain what changes or improves if the reader takes the next step now."],
    ["Simple CTA", "Give the email one clear action, then support it with a short reassurance line."],
  ];
}

function buildRichFallbackHtml(intent: EmailIntent, options: { body: string; cta: string; accent: string; friendlyTone: boolean; attachmentSummary: string }) {
  const fallbackCards = getFallbackCards(intent.name);
  const brandLabel = options.attachmentSummary ? "Reference Email" : "Trigger Mail AI";
  const footerReason = options.attachmentSummary ? "You are receiving this because you opted in to these updates." : "You are receiving this because you opted in to updates from Trigger Mail AI.";
  const footerLabel = options.attachmentSummary ? "Manage preferences or unsubscribe at any time." : "Trigger Mail AI Ltd. Manage preferences or unsubscribe at any time.";

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7fb;padding:28px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:100%;background:#ffffff;border-radius:18px;overflow:hidden;font-family:Arial,sans-serif;color:#111827;">
        <tr>
          <td style="background:linear-gradient(135deg,#101827 0%,#3b0764 58%,#d946ef 100%);padding:38px 38px 34px;color:#ffffff;">
            <p style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#f5d0fe;">${escapeHtml(brandLabel)}</p>
            <h1 style="margin:0;font-size:34px;line-height:1.1;">${escapeHtml(intent.headline)}</h1>
            <p style="margin:17px 0 0;font-size:16px;line-height:1.65;color:#f8fafc;">${escapeHtml(options.body)}</p>
            <p style="margin:26px 0 0;"><a href="https://example.com" style="display:inline-block;background:#ffffff;color:#701a75;text-decoration:none;border-radius:999px;padding:13px 22px;font-size:14px;font-weight:800;">${escapeHtml(options.cta)}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 34px 10px;">
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#475569;">${escapeHtml(options.attachmentSummary ? "I used the attached references as direction for the structure, tone, and visual emphasis." : options.friendlyTone ? "Here is a clear, warm version with more useful content and a stronger next step." : "Here is the key information and the next action in a fuller email layout.")}</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                ${buildSectionCard(fallbackCards[0][0], fallbackCards[0][1])}
                ${buildSectionCard(fallbackCards[1][0], fallbackCards[1][1])}
              </tr>
              <tr>
                ${buildSectionCard(fallbackCards[2][0], fallbackCards[2][1])}
                ${buildSectionCard(fallbackCards[3][0], fallbackCards[3][1])}
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 34px 34px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#111827;border-radius:16px;">
              <tr>
                <td style="padding:24px;color:#ffffff;">
                  <p style="margin:0;font-size:20px;line-height:1.3;font-weight:800;">Ready for the next step?</p>
                  <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#cbd5e1;">Keep the journey moving with one obvious call to action.</p>
                  <p style="margin:20px 0 0;"><a href="https://example.com" style="display:inline-block;background:${options.accent};color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 22px;font-size:14px;font-weight:800;">${escapeHtml(options.cta)}</a></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #e5e7eb;padding:22px 34px;font-size:12px;line-height:1.6;color:#64748b;">
            ${escapeHtml(footerReason)} This message was sent to {{email}}.
            <br />${escapeHtml(footerLabel)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

function buildFallbackEmail(prompt: string, context: TemplateContext, attachments: AiAttachment[] = []): AiTemplateResponse {
  const intent = getIntent(prompt);
  const lowerPrompt = prompt.toLowerCase();
  const attachmentSummary = describeAttachments(attachments);

  if (prompt.trim().length < 18 && !/(build|create|write|make|email|template)/i.test(prompt)) {
    return {
      action: "reply",
      mode: "demo",
      reply: "I can build that with you. Who is the email for, what should they do after reading it, and should the tone feel friendly, premium, urgent, or simple?",
    };
  }

  const friendlyTone = lowerPrompt.includes("friendly") || lowerPrompt.includes("warm");
  const premiumTone = lowerPrompt.includes("premium") || lowerPrompt.includes("luxury");
  const selectedText = context.selectedText?.trim();
  const body = selectedText && /(rewrite|change|improve|make)/i.test(prompt)
    ? `${selectedText.replace(/[.!?]*$/, "")}. ${friendlyTone ? "We are here to make the next step feel simple and clear." : "The next step is ready when you are."}`
    : intent.body;
  const accent = premiumTone ? "#8b5cf6" : "#d946ef";

  return {
    action: "update",
    mode: "demo",
    reply: attachments.some((attachment) => attachment.dataUrl?.startsWith("data:image/"))
      ? "I made a fuller draft using the request as the main direction. I can see that a reference image was attached, but image understanding only works when the live AI service is active. Next I would connect the AI service, then ask me to match the screenshot’s layout, colour, and tone more closely."
      : "I made a fuller draft with a hero, supporting content, CTA, and footer. This is still demo-mode behaviour, so it is more limited than the live AI assistant. Next, ask me to make it more premium, more concise, add proof, or tailor it to a specific audience.",
    attachmentNotes: attachments.length > 0
      ? `Attached files received: ${getAttachmentNames(attachments)}. Demo mode cannot deeply inspect image content.`
      : undefined,
    name: intent.name,
    subject: intent.subject,
    preheader: intent.preheader,
    html: buildRichFallbackHtml(intent, {
      body,
      cta: intent.cta,
      accent,
      friendlyTone,
      attachmentSummary,
    }),
  };
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);

    const body = (await request.json()) as {
      prompt?: string;
      messages?: AiMessage[];
      template?: TemplateContext;
      attachments?: AiAttachment[];
    };
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json({ error: "Add a message for the AI assistant." }, { status: 400 });
    }

    const attachments = (body.attachments || []).slice(0, 6);
    const selectedSection = body.template?.selectedSection;
    const selectedSectionLabel = selectedSection?.label?.trim() || "selected section";
    const isSectionScoped = Boolean(selectedSection);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      if (isSectionScoped) {
        return NextResponse.json({
          action: "reply",
          mode: "demo",
          reply: "Real AI is not connected yet, so I did not change the selected section. Add OPENAI_API_KEY to enable section editing.",
        });
      }

      return NextResponse.json(buildFallbackEmail(prompt, body.template || {}, attachments));
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o";
    const attachmentText = describeAttachments(attachments);
    const attachmentNames = getAttachmentNames(attachments);
    const attachmentAnalysis = await analyzeAttachments(apiKey, model, attachments);
    const attachmentContext = [
      attachmentText ? `Raw readable attachment context:\n${attachmentText}` : "",
      attachmentAnalysis ? `Attachment inspection notes:\n${attachmentAnalysis}` : "",
    ].filter(Boolean).join("\n\n");
    const lowerPrompt = prompt.toLowerCase();
    const taskType = lowerPrompt.includes("add more") || lowerPrompt.includes("improve") || lowerPrompt.includes("expand")
      ? "expand_or_improve_existing_template"
      : attachments.length > 0
        ? "build_from_reference"
        : /build|create|make|write|new/i.test(prompt)
          ? "create_template"
          : "refine_template";
    const assistantJob = attachments.length > 0
      ? "RECREATE_REFERENCE"
      : taskType === "create_template"
        ? "BUILD_FROM_BRIEF"
        : "EDIT_CURRENT_DRAFT";
    const hasReferenceAttachments = attachments.length > 0;
    const generationTemperature = hasReferenceAttachments ? 0.25 : 0.75;
    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail?: "high" | "low" | "auto" } }
    > = [
      {
        type: "text",
        text: JSON.stringify({
          currentTemplate: body.template || {},
          conversation: (body.messages || []).slice(-8),
          request: prompt,
          taskType,
          assistantJob,
          editingScope: "selected_section_only",
          selectedSection: selectedSection
            ? {
              id: selectedSection.id,
              label: selectedSectionLabel,
              html: selectedSection.html || body.template?.html || "",
            }
            : {
              label: selectedSectionLabel,
              html: body.template?.html || "",
            },
          attachedFileNotes: attachmentContext,
          attachedFileNames: attachmentNames,
          expectedOutput: {
            action: "update unless a brief is truly impossible",
            quality: "polished, specific, email-safe, commercially useful, editable",
            scopeRule: "Return HTML for the selected section only. Do not return a full email document or replace unrelated sections. Use the surrounding template only as context.",
            assetGeneration: "When the design needs artwork, illustrations, realistic product imagery, decorative banners, background strips, texture, photography, product scenes, device mockups, or anything too hard to recreate well with email-safe HTML/CSS, request up to 3 generated assets. Generate modular image assets only: banners, backgrounds, decorative pieces, product crops, section illustrations, or texture panels. Never generate the whole email, text layout, CTA button, footer, pricing table, card grid, or newsletter as one image. Every requested asset must be incorporated into the html with its matching placeholder, such as {{generated_asset_1_url}} and {{generated_asset_1_alt}}. Keep all text, buttons, sections, and layout editable in table HTML.",
            sourceOfTruth: hasReferenceAttachments
              ? "The attached reference file is the primary source of truth. Match its structure, visual direction, copy hierarchy, colours, and tone as closely as email-safe HTML allows. Do not default to Trigger Mail AI branding unless the user explicitly asks."
              : "Use the user's prompt and current template as the source of truth.",
            referenceFidelity: hasReferenceAttachments
              ? isSectionScoped
                ? `Create the closest practical editable recreation for ${selectedSectionLabel} only. Preserve only the visual signals relevant to that selected section, and do not create missing header, body, CTA, footer, or wrapper sections unless they are already part of the selected section.`
                : "Create the closest practical editable email recreation from the screenshot. Preserve the major layout signals: outer email width, centered card, rounded corners, background tint, hero height, logo position, headline position, supporting-copy position, image position, divider/wave placement, body spacing, CTA position, signature, footer band, borders, and shadows whenever they are visible."
              : "No reference screenshot was provided.",
            brandRule: hasReferenceAttachments
              ? "Do not insert Trigger Mail AI branding, Trigger Mail AI logo text, Trigger Mail AI footer, or Trigger Mail AI product copy unless those words appear in the reference or prompt."
              : "Use Trigger Mail AI only when the user is asking for a Trigger Mail AI branded email or the current template clearly requires it.",
            avoid: ["generic filler", "samey purple gradients", "single paragraph edits", "placeholder section titles"],
            attachmentNotes: attachments.length > 0
              ? "Required: include attachmentNotes in the JSON. Be specific about what you observed from the attached file(s), or say clearly if a file could not be inspected."
              : "No attachments were provided.",
          },
        }),
      },
    ];

    attachments.forEach((attachment) => {
      if (attachment.dataUrl?.startsWith("data:image/")) {
        userContent.push({
          type: "text",
          text: `Image reference: ${attachment.name}. Inspect this image and use concrete visual observations in attachmentNotes and the email direction.`,
        });
        userContent.push({
          type: "image_url",
          image_url: { url: attachment.dataUrl, detail: "high" },
        });
      }
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: generationTemperature,
        max_tokens: 5000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "MISSION: You are not a general chatbot. You are the template-building engine for an email builder.",
              "Your only purpose is to help the user create, recreate, or edit an email template that can be saved and sent.",
              "Current product rule: you edit only the selected section. Never rewrite the whole email unless the selected section itself contains the whole email.",
              "Return html for the selected section only. Do not include unrelated template sections, full documents, <html>, <head>, or <body>.",
              "In selected-section mode, do not add an email wrapper, outer canvas, global header, global footer, signature, unsubscribe footer, or extra body sections unless that exact structure already exists inside the selected section HTML.",
              "For every request, first decide the job type: RECREATE_REFERENCE, BUILD_FROM_BRIEF, or EDIT_CURRENT_DRAFT.",
              "RECREATE_REFERENCE means the attachment is the source of truth and you should reproduce it as closely as email-safe HTML allows.",
              "In RECREATE_REFERENCE, do not treat the screenshot as a style mood board. Treat it as a visual spec to reproduce section-by-section.",
              "BUILD_FROM_BRIEF means make a complete email template from the user's goal, audience, offer, tone, and available variables.",
              "EDIT_CURRENT_DRAFT means preserve the current email's intent and apply the requested change without unnecessary replacement.",
              "You are a senior lifecycle email designer, conversion copywriter, and email-safe HTML builder inside Trigger Mail AI.",
              "Your job is to turn rough user ideas, screenshots, reference files, or current drafts into polished email templates that feel designed and commercially useful.",
              "Important: Trigger Mail AI is the app the user is working inside, not automatically the brand of the email being created.",
              "When attachments are provided, treat the attached reference as the primary source of truth and the current Trigger Mail AI draft as secondary context only.",
              "Do not brand the email as Trigger Mail AI unless the user explicitly asks for a Trigger Mail AI email or the reference itself contains Trigger Mail AI branding.",
              "For screenshot recreation, preserve the visible composition before improving anything: outer canvas, centered email card width, corner radius, hero height, logo/header placement, left/right column split, image/illustration placement, curved or angled dividers, body padding, CTA alignment, signature, footer band, border lines, and shadows.",
              "If the reference hero has text on the left and artwork on the right, build a two-column hero table inside one shared hero background. Do not make the right column a separate white panel unless the screenshot clearly shows that.",
              "If the reference has a wave, curve, diagonal, or layered divider between hero and body, recreate it with an email-safe table row, border-radius, angled/curved colour band, or generated modular divider asset. Do not replace it with a straight horizontal cut unless no closer email-safe approximation is possible.",
              "If the reference includes a logo or brand lockup, recreate its placement and approximate shape/colour treatment with HTML/CSS or a small generated asset, while keeping brand text editable when possible.",
              "Be proactive and substantial. When the user asks to build, improve, add more, or uses an attached reference, create a fuller production-style email, not a tiny edit.",
              "Return only valid JSON with keys: action, reply, name, subject, preheader, html, attachmentNotes, assetRequests.",
              "Use assetRequests when an email would be better with generated artwork or imagery that is hard to create with table HTML. Each asset request should include key, name, prompt, and alt. Use keys like generated_asset_1, generated_asset_2, generated_asset_3.",
              "Generated assets must be modular pieces used inside an editable email: banners, background strips, decorative panels, product crops, section illustrations, abstract textures, or image accents.",
              "If you include assetRequests, every requested asset must appear in the html exactly once using its matching placeholder key, for example <img src=\"{{generated_asset_1_url}}\" alt=\"{{generated_asset_1_alt}}\" ...>.",
              "Place generated assets inside the relevant section of the email, such as below the hero headline, inside a visual banner area, beside supporting content, or within a feature section. Do not leave assets detached above or below the finished email.",
              "Never request or prompt for an image of the entire email, full newsletter, full landing page, complete template, text-heavy composition, CTA button, footer, table of details, or card grid. All layout, copy, headings, CTAs, links, pricing, dates, and footer content must remain editable HTML.",
              "Reference asset rule: if the user asks you to copy, match, recreate, replicate, or use the style of an attached design and the reference includes photography, illustration, product/device mockup, rich texture, decorative scene, or other visual that cannot be faithfully created with table HTML/CSS, request modular assets for those parts only.",
              "Do not avoid assetRequests just because colours, cards, borders, spacing, simple icons, or typography can be recreated with code. Recreate those with code, and generate only the image-like parts that code cannot faithfully reproduce.",
              "Only skip assetRequests when every visible visual element is genuinely simple email-safe code: text, flat colour blocks, borders, simple dividers, buttons, tiny glyph icons, or basic geometric shapes.",
              "When you request an asset, place it in the HTML with <img src=\"{{generated_asset_1_url}}\" alt=\"{{generated_asset_1_alt}}\" ...> at the same relative location as the source visual. For a right-side hero illustration, put the placeholder inside the right hero column, not above the whole email or below the headline.",
              "The reply should start by naming the job type in plain English, then say what you used, what you changed, and one sensible next suggestion. For reference screenshots, mention that it is a close editable recreation rather than a pixel-perfect copy. Use 2 to 5 short sentences.",
              "Use action='reply' when you need more information. Use action='update' when changing the template.",
              "Only ask a question if the brief is impossible to act on. Otherwise make sensible assumptions and build.",
              "The html must be email-safe table-based HTML only for the body content, not a full document.",
              "Use inline styles and table layouts. Do not use external CSS, scripts, forms, videos, or unsupported email layout.",
              "Do not output broken image placeholders. Only use <img> when the src is a real http(s), data, or cid URL supplied by the user/reference, or one of the generated asset placeholders you requested such as {{generated_asset_1_url}}. Never use empty src, fake filenames, relative asset paths, or third-party placeholder image URLs.",
              "If the reference uses small icons, recreate them with email-safe styled circles/squares and Unicode symbols or simple text glyphs, not missing images.",
              isSectionScoped
                ? "Produce one improved selected section. It can contain multiple rows or columns internally, but it must still be a replacement for only the selected section."
                : "Produce 5 to 8 meaningful sections where useful: preheader-hidden content is handled outside, hero, intro, specific details, benefits/proof, supporting content, CTA band, footer.",
              "Make the design visually rich with spacing, cards, accent colours, hierarchy, and buttons while staying email-safe.",
              "Do not use generic filler headings like 'Why it matters', 'What happens next', 'Main message', or 'Ready for the next step' unless the user specifically asks for that wording.",
              "Every section must contain concrete copy that matches the user's purpose. Avoid placeholder copy, lorem ipsum, vague SaaS language, and repeated generic phrases.",
              "Use a distinctive design direction for each answer: choose a palette, rhythm, card style, spacing, and CTA treatment that fits the brief instead of always using the same purple gradient.",
              "If the current template already has useful content, preserve the intent and improve it rather than replacing everything blindly.",
              "For transactional emails, prioritise clarity, receipt/detail blocks, reassurance, and support. For sales emails, prioritise relevance, proof, frictionless next step, and concise value. For newsletters, prioritise skimmable hierarchy and multiple story blocks.",
              "Preserve useful handlebars such as {{first_name}}, {{company}}, and {{email}} and introduce relevant variables when helpful.",
              "If the user says add more stuff or improve this draft, expand the existing email with new sections instead of just rewriting one paragraph.",
              "For images or screenshots, infer layout, mood, palette, and content direction. Mention in reply what you used from the reference.",
              "For template screenshots, recreate the reference's design language: approximate layout, section order, typography scale, spacing, palette, CTA placement, image treatment, and visible copy. Do not invent a different brand or different layout unless the user asks.",
              "Fidelity rule: if the reference has a centered rounded white card on a pale background, do not turn it into a flat full-width email with a top gradient bar. Preserve the card, softness, shadows, rounded corners, centered logo/header, feature cards, CTA position, and footer band.",
              "Fidelity rule: if the reference has a large rounded purple/pink hero with logo at the upper left, headline beneath it, supporting copy below, an illustration on the right inside the same gradient hero, and a curved white body transition, preserve those elements and their order.",
              "If the reference includes decorative waves, confetti, dots, or soft background shapes, approximate them with email-safe table rows, bordered elements, gradients, or text glyphs instead of ignoring them.",
              "When files are attached, you must populate attachmentNotes with concrete observations from those files. If a file cannot be inspected, say that directly in attachmentNotes instead of pretending.",
              "Quality check before responding: would this look like a respectable email from a real product team, or does it still feel like a template stub? If it feels stubby, improve it before returning.",
            ].join(" "),
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(payload.error?.message || "The AI assistant could not respond.");
    }

    let aiResponse = parseAiJson(payload.choices?.[0]?.message?.content || "");
    if (shouldAutoRequestReferenceAsset(prompt, attachments, attachmentAnalysis, aiResponse)) {
      const inferredAssetRequest = buildReferenceAssetRequest(prompt, attachmentAnalysis);
      aiResponse = {
        ...aiResponse,
        assetRequests: [inferredAssetRequest],
        html: aiResponse.html ? ensureAssetPlaceholder(aiResponse.html, inferredAssetRequest) : aiResponse.html,
        reply: `${aiResponse.reply} I also generated a reference-style visual because the attached design includes imagery that email-safe code cannot faithfully reproduce.`,
      };
    }

    if (!isSectionScoped && hasReferenceAttachments && aiResponse.action === "update") {
      aiResponse = await repairReferenceResponse(apiKey, model, prompt, attachments, attachmentAnalysis, aiResponse);
    }

    let usedLockedScaffold = false;

    if (!isSectionScoped && hasReferenceAttachments && shouldUseLockedReferenceHero(prompt, attachmentAnalysis, aiResponse)) {
      const existingAssetRequest = aiResponse.assetRequests?.[0];
      const assetRequest = existingAssetRequest || buildReferenceAssetRequest(prompt, attachmentAnalysis);
      const assetKey = assetRequest.key?.trim().replace(/[^a-z0-9_]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "generated_asset_1";
      usedLockedScaffold = true;
      aiResponse = {
        ...aiResponse,
        assetRequests: [{ ...assetRequest, key: assetKey }],
        html: buildLockedReferenceHeroHtml(aiResponse, assetKey),
        reply: `${aiResponse.reply} I used a structured two-column hero scaffold so the generated asset sits inside the gradient header.`,
      };
    }

    if (hasReferenceAttachments) {
      aiResponse = {
        ...aiResponse,
        reply: normalizeReferenceReply(aiResponse.reply, usedLockedScaffold),
      };
    }

    const generatedAssets = aiResponse.action === "update" && aiResponse.assetRequests?.length
      ? await generateRequestedAssets(apiKey, supabase, workspaceId, aiResponse.assetRequests)
      : [];
    const htmlWithGeneratedAssets = aiResponse.html && generatedAssets.length > 0
      ? ensureGeneratedAssetsEmbedded(replaceGeneratedAssetPlaceholders(aiResponse.html, generatedAssets), generatedAssets)
      : aiResponse.html;
    const sanitizedAiResponse = htmlWithGeneratedAssets
      ? { ...aiResponse, html: sanitizeEmailImages(htmlWithGeneratedAssets), generatedAssets }
      : { ...aiResponse, generatedAssets };

    if (!isSectionScoped && sanitizedAiResponse.action === "update" && (!sanitizedAiResponse.html || sanitizedAiResponse.html.length < 1200)) {
      return NextResponse.json({
        ...buildFallbackEmail(prompt, body.template || {}, attachments),
        mode: "ai",
        attachmentNotes: attachmentAnalysis || undefined,
        reply: "I tried to build this with AI, but the returned draft was too thin, so I expanded it into a fuller editable template. Ask me for a more specific tone, layout, or audience and I can refine it further.",
      });
    }

    return NextResponse.json({
      ...sanitizedAiResponse,
      attachmentNotes: sanitizedAiResponse.attachmentNotes || attachmentAnalysis || undefined,
      generatedAssets: sanitizedAiResponse.generatedAssets,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "The AI assistant could not update the template.") }, { status: 500 });
  }
}
