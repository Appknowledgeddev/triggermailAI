import { NextResponse } from "next/server";
import { ensureWorkspaceForUser, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function defaultHtml(name: string, subject: string) {
  return `
<div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
  <p>Hi {{first_name}},</p>
  <h1 style="font-size: 28px; line-height: 1.2;">${subject}</h1>
  <p>This is the starting point for ${name}. Update this copy in the email builder.</p>
  <p>Thanks,<br />Trigger Mail AI</p>
</div>`.trim();
}

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

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const body = (await request.json()) as {
      name?: string;
      subject?: string;
      category?: string;
      folderId?: string | null;
      preheader?: string | null;
      fromName?: string | null;
      fromEmail?: string | null;
      html?: string;
      customHead?: string | null;
      aiMessages?: unknown;
    };

    const name = body.name?.trim();
    const subject = body.subject?.trim();
    const category = body.category?.trim() || "general";
    const folderId = body.folderId || null;
    const html = body.html?.trim() || defaultHtml(name || "Untitled Template", subject || "Untitled subject");

    if (!name || !subject) {
      return NextResponse.json({ error: "Add a template name and subject first." }, { status: 400 });
    }

    const workspaceId = await ensureWorkspaceForUser(user);

    if (folderId) {
      const { data: folder, error: folderError } = await supabase
        .from("template_folders")
        .select("id")
        .eq("id", folderId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (folderError) {
        throw folderError;
      }

      if (!folder) {
        return NextResponse.json({ error: "Template file was not found." }, { status: 404 });
      }
    }

    const templatePayload = {
      workspace_id: workspaceId,
      ...(folderId ? { folder_id: folderId } : {}),
      name,
      slug: `${slugify(name) || "template"}-${Date.now()}`,
      category,
      subject,
      description: "Created from the templates list.",
      preheader: body.preheader?.trim() || null,
      from_name: body.fromName?.trim() || null,
      from_email: body.fromEmail?.trim() || null,
      html,
      text: htmlToText(html),
      design: { editor: "html", customHead: body.customHead || "", aiMessages: sanitizeAiMessages(body.aiMessages), createdAt: new Date().toISOString() },
      variables: extractVariables(html),
      status: "draft",
      created_by: user.id,
    };

    const { data: createdTemplate, error: createError } = await supabase
      .from("email_templates")
      .insert(templatePayload)
      .select("*")
      .single();

    if (createError) {
      throw createError;
    }

    return NextResponse.json({ template: createdTemplate });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "The template could not be created.") }, { status: 500 });
  }
}
