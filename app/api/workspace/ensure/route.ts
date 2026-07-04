import { NextResponse } from "next/server";
import { ensureWorkspaceForUser, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";

export async function POST(request: Request) {
  try {
    const { user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);
    return NextResponse.json({ workspaceId });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Workspace could not be prepared.") }, { status: 500 });
  }
}
