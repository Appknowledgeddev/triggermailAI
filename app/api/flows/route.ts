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

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const body = (await request.json()) as {
      name?: string;
      description?: string | null;
    };
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "Give the flow a name first." }, { status: 400 });
    }

    const workspaceId = await ensureWorkspaceForUser(user);
    const { data: flow, error } = await supabase
      .from("flows")
      .insert({
        workspace_id: workspaceId,
        name,
        slug: `${slugify(name) || "flow"}-${Date.now()}`,
        description: body.description?.trim() || null,
        trigger_type: null,
        status: "draft",
        timezone: "Europe/London",
        settings: { builder: "visual", steps: [], isBlank: true },
        stats: { sent: 0, opened: 0, clicked: 0 },
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ flow });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "The flow could not be created.") }, { status: 500 });
  }
}
