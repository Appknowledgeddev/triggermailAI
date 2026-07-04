import { NextResponse } from "next/server";
import { assertTemplateAccess, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";

type RouteContext = {
  params: {
    templateId: string;
  };
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const templateId = context.params.templateId;
    const template = await assertTemplateAccess(templateId, user.id);
    const body = (await request.json()) as { folderId?: string | null };
    const folderId = body.folderId || null;

    if (!template.workspace_id) {
      return NextResponse.json({ error: "Template workspace was not found." }, { status: 404 });
    }

    if (folderId) {
      const { data: folder, error: folderError } = await supabase
        .from("template_folders")
        .select("id")
        .eq("id", folderId)
        .eq("workspace_id", template.workspace_id)
        .maybeSingle();

      if (folderError) {
        throw folderError;
      }

      if (!folder) {
        return NextResponse.json({ error: "Template file was not found." }, { status: 404 });
      }
    }

    const { data: updatedTemplate, error } = await supabase
      .from("email_templates")
      .update({ folder_id: folderId })
      .eq("id", templateId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ template: updatedTemplate });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Template file could not be updated.") }, { status: 500 });
  }
}
