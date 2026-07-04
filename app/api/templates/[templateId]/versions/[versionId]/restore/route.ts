import { NextResponse } from "next/server";
import { assertTemplateAccess, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";

type RouteContext = {
  params: {
    templateId: string;
    versionId: string;
  };
};

function extractVariables(html: string) {
  return Array.from(new Set(Array.from(html.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)).map((match) => match[1])));
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const { templateId, versionId } = context.params;
    await assertTemplateAccess(templateId, user.id);

    const { data: version, error: versionError } = await supabase
      .from("email_template_versions")
      .select("*")
      .eq("id", versionId)
      .eq("template_id", templateId)
      .maybeSingle();

    if (versionError) {
      throw versionError;
    }

    if (!version) {
      return NextResponse.json({ error: "Version was not found." }, { status: 404 });
    }

    const html = version.html || "";
    const { data: template, error: updateError } = await supabase
      .from("email_templates")
      .update({
        subject: version.subject,
        preheader: version.preheader,
        html,
        text: version.text,
        design: version.design,
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
    return NextResponse.json({ error: getErrorMessage(error, "Version could not be made main.") }, { status: 500 });
  }
}
