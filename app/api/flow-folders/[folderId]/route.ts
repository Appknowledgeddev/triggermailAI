import { NextResponse } from "next/server";
import { ensureWorkspaceForUser, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";

type RouteContext = {
  params: {
    folderId: string;
  };
};

function getFlowFolderError(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback);

  if (/flow_folders|folder_id|PGRST205|schema cache/i.test(message)) {
    return "Flow folders are not installed in Supabase yet. Run supabase/flow_folders.sql in the Supabase SQL Editor, then refresh this page.";
  }

  return message;
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);
    const folderId = context.params.folderId;

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

    const { count, error: countError } = await supabase
      .from("flows")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("folder_id", folderId);

    if (countError) {
      throw countError;
    }

    if ((count || 0) > 0) {
      return NextResponse.json({ error: "Move or delete the flows inside this folder before deleting it." }, { status: 409 });
    }

    const { error: deleteError } = await supabase
      .from("flow_folders")
      .delete()
      .eq("id", folderId)
      .eq("workspace_id", workspaceId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getFlowFolderError(error, "Flow folder could not be deleted.") }, { status: 500 });
  }
}
