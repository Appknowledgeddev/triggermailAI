import { NextResponse } from "next/server";
import { assertTemplateAccess, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";
import type { Json } from "@/lib/supabase/types";

type RouteContext = {
  params: {
    templateId: string;
  };
};

function htmlToText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function getNextVersionNumber(supabase: Awaited<ReturnType<typeof getAdminContext>>["supabase"], templateId: string) {
  const { data, error } = await supabase
    .from("email_template_versions")
    .select("version_number")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data?.version_number || 0) + 1;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const templateId = context.params.templateId;
    await assertTemplateAccess(templateId, user.id);

    const { data, error } = await supabase
      .from("email_template_versions")
      .select("*")
      .eq("template_id", templateId)
      .order("version_number", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ versions: data || [] });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Template versions could not be loaded.") }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const templateId = context.params.templateId;
    await assertTemplateAccess(templateId, user.id);

    const body = (await request.json()) as {
      sourceVersionId?: string;
      subject?: string;
      preheader?: string | null;
      html?: string;
      design?: Json;
    };

    let versionSource = {
      subject: body.subject?.trim() || "Untitled subject",
      preheader: body.preheader?.trim() || null,
      html: body.html || "",
      text: htmlToText(body.html || ""),
      design: body.design || {},
    };

    if (body.sourceVersionId) {
      const { data: sourceVersion, error: sourceError } = await supabase
        .from("email_template_versions")
        .select("*")
        .eq("id", body.sourceVersionId)
        .eq("template_id", templateId)
        .maybeSingle();

      if (sourceError) {
        throw sourceError;
      }

      if (!sourceVersion) {
        return NextResponse.json({ error: "Version was not found." }, { status: 404 });
      }

      versionSource = {
        subject: sourceVersion.subject,
        preheader: sourceVersion.preheader,
        html: sourceVersion.html || "",
        text: sourceVersion.text || htmlToText(sourceVersion.html || ""),
        design: sourceVersion.design || {},
      };
    }

    const versionNumber = await getNextVersionNumber(supabase, templateId);
    const { data: version, error: insertError } = await supabase
      .from("email_template_versions")
      .insert({
        template_id: templateId,
        version_number: versionNumber,
        subject: versionSource.subject,
        preheader: versionSource.preheader,
        html: versionSource.html,
        text: versionSource.text,
        design: versionSource.design,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ version });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Template version could not be created.") }, { status: 500 });
  }
}
