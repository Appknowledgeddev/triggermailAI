import { NextResponse } from "next/server";
import { ensureWorkspaceForUser, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";

type RouteContext = {
  params: {
    flowId: string;
  };
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);
    const body = (await request.json()) as { folderId?: string | null };
    const folderId = body.folderId || null;

    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("id")
      .eq("id", context.params.flowId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (flowError) {
      throw flowError;
    }

    if (!flow) {
      return NextResponse.json({ error: "Flow was not found." }, { status: 404 });
    }

    if (folderId) {
      const { data: folder, error: folderError } = await supabase
        .from("flow_folders")
        .select("id")
        .eq("id", folderId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (folderError) {
        throw folderError;
      }

      if (!folder) {
        return NextResponse.json({ error: "Flow folder was not found." }, { status: 404 });
      }
    }

    const { data: updatedFlow, error } = await supabase
      .from("flows")
      .update({ folder_id: folderId })
      .eq("id", context.params.flowId)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ flow: updatedFlow });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Flow folder could not be updated.") }, { status: 500 });
  }
}
