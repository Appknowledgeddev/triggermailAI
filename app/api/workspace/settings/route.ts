import { NextResponse } from "next/server";
import { ensureWorkspaceForUser, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);
    const { data: workspace, error } = await supabase
      .from("workspaces")
      .select("id, name, default_from_name, default_from_email, timezone")
      .eq("id", workspaceId)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Workspace settings could not be loaded.") }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);
    const body = (await request.json().catch(() => ({}))) as {
      defaultFromName?: string;
      defaultFromEmail?: string;
    };
    const defaultFromName = body.defaultFromName?.trim() || "Trigger Mail AI";
    const defaultFromEmail = body.defaultFromEmail?.trim() || "";

    if (!isEmail(defaultFromEmail)) {
      return NextResponse.json({ error: "Enter a valid sender email address." }, { status: 400 });
    }

    const { data: workspace, error } = await supabase
      .from("workspaces")
      .update({
        default_from_name: defaultFromName,
        default_from_email: defaultFromEmail,
      })
      .eq("id", workspaceId)
      .select("id, name, default_from_name, default_from_email, timezone")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Workspace settings could not be saved.") }, { status: 500 });
  }
}
