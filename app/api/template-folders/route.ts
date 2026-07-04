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

function getTemplateFolderError(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback);

  if (/template_folders|PGRST205|schema cache/i.test(message)) {
    return "Template folders are not installed in Supabase yet. Run supabase/template_folders.sql in the Supabase SQL Editor, then refresh this page.";
  }

  return message;
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);
    const { data, error } = await supabase
      .from("template_folders")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ folders: data || [] });
  } catch (error) {
    return NextResponse.json({ error: getTemplateFolderError(error, "Template files could not be loaded.") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const body = (await request.json()) as {
      name?: string;
      description?: string | null;
      color?: string;
    };
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "Add a file name first." }, { status: 400 });
    }

    const workspaceId = await ensureWorkspaceForUser(user);
    const { data, error } = await supabase
      .from("template_folders")
      .insert({
        workspace_id: workspaceId,
        name,
        slug: `${slugify(name) || "file"}-${Date.now()}`,
        description: body.description?.trim() || null,
        color: body.color || "#a855f7",
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ folder: data });
  } catch (error) {
    return NextResponse.json({ error: getTemplateFolderError(error, "Template folder could not be created.") }, { status: 500 });
  }
}
