import { NextResponse } from "next/server";
import { assertTemplateAccess, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";

type RouteContext = {
  params: {
    templateId: string;
  };
};

function extractVariables(html: string) {
  return Array.from(new Set(Array.from(html.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)).map((match) => match[1])));
}

function htmlToText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizeAiMessages(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((message) => {
      if (!message || typeof message !== "object") {
        return false;
      }

      const record = message as { role?: unknown; content?: unknown };
      return (record.role === "assistant" || record.role === "user") && typeof record.content === "string";
    })
    .slice(-80)
    .map((message) => {
      const record = message as { role: "assistant" | "user"; content: string };
      return {
        role: record.role,
        content: record.content.slice(0, 8000),
      };
    });
}

function sanitizeGlobalStyles(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as {
    globalBackground?: unknown;
    globalBackgroundPattern?: unknown;
    globalBackgroundCanvas?: unknown;
    previewPadding?: unknown;
    emailWidth?: unknown;
    emailBorderRadius?: unknown;
    emailBoxShadow?: unknown;
    bodyTextInsetLeft?: unknown;
    bodyTextInsetRight?: unknown;
    bodyContentMargin?: unknown;
    bodyTextSize?: unknown;
    bodyTextColor?: unknown;
  };

  return {
    ...(typeof record.globalBackground === "string" ? { globalBackground: record.globalBackground.slice(0, 32) } : {}),
    ...(typeof record.globalBackgroundPattern === "string" ? { globalBackgroundPattern: record.globalBackgroundPattern.slice(0, 32) } : {}),
    ...(typeof record.globalBackgroundCanvas === "string" ? { globalBackgroundCanvas: record.globalBackgroundCanvas.slice(0, 32) } : {}),
    ...(typeof record.previewPadding === "number" ? { previewPadding: Math.max(0, Math.min(120, record.previewPadding)) } : {}),
    ...(typeof record.emailWidth === "number" ? { emailWidth: Math.max(320, Math.min(1200, record.emailWidth)) } : {}),
    ...(typeof record.emailBorderRadius === "number" ? { emailBorderRadius: Math.max(0, Math.min(64, record.emailBorderRadius)) } : {}),
    ...(typeof record.emailBoxShadow === "string" ? { emailBoxShadow: record.emailBoxShadow.slice(0, 160) } : {}),
    ...(typeof record.bodyTextInsetLeft === "number" ? { bodyTextInsetLeft: Math.max(0, Math.min(160, record.bodyTextInsetLeft)) } : {}),
    ...(typeof record.bodyTextInsetRight === "number" ? { bodyTextInsetRight: Math.max(0, Math.min(160, record.bodyTextInsetRight)) } : {}),
    ...(typeof record.bodyContentMargin === "number" ? { bodyContentMargin: Math.max(0, Math.min(160, record.bodyContentMargin)) } : {}),
    ...(typeof record.bodyTextSize === "number" ? { bodyTextSize: Math.max(10, Math.min(32, record.bodyTextSize)) } : {}),
    ...(typeof record.bodyTextColor === "string" ? { bodyTextColor: record.bodyTextColor.slice(0, 32) } : {}),
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const templateId = context.params.templateId;
    await assertTemplateAccess(templateId, user.id);

    const body = (await request.json()) as {
      name?: string;
      subject?: string;
      preheader?: string | null;
      fromName?: string | null;
      fromEmail?: string | null;
      html?: string;
      customHead?: string | null;
      globalStyles?: unknown;
      aiMessages?: unknown;
    };

    const html = body.html || "";
    const { data: template, error: updateError } = await supabase
      .from("email_templates")
      .update({
        name: body.name?.trim() || "Untitled Template",
        subject: body.subject?.trim() || "Untitled subject",
        preheader: body.preheader?.trim() || null,
        from_name: body.fromName?.trim() || null,
        from_email: body.fromEmail?.trim() || null,
        html,
        text: htmlToText(html),
        design: { editor: "html", customHead: body.customHead || "", globalStyles: sanitizeGlobalStyles(body.globalStyles), aiMessages: sanitizeAiMessages(body.aiMessages), updatedAt: new Date().toISOString() },
        variables: extractVariables(html),
      })
      .eq("id", templateId)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ template });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Template could not be saved.") }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const templateId = context.params.templateId;
    await assertTemplateAccess(templateId, user.id);

    const { error: deleteError } = await supabase.from("email_templates").delete().eq("id", templateId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "The template could not be deleted.") }, { status: 500 });
  }
}
