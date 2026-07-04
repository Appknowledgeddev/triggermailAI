import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/server";

export function getErrorMessage(error: unknown, fallback = "Request failed.") {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const record = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const message = [record.message, record.details, record.hint, record.code].filter(Boolean).map(String).join(" ");
    return message || fallback;
  }

  return fallback;
}

export function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function getAdminContext(request: Request) {
  if (!hasSupabaseAdminConfig()) {
    throw new Error("Supabase service role key is missing on the server.");
  }

  const token = getBearerToken(request);
  if (!token) {
    throw new Error("Sign in before managing templates.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error("Sign in before managing templates.");
  }

  return { supabase, user: userData.user };
}

export async function ensureWorkspaceForUser(user: User) {
  const supabase = createSupabaseAdminClient();
  const { data: existingMember, error: memberLookupError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (memberLookupError) {
    throw memberLookupError;
  }

  if (existingMember?.workspace_id) {
    return existingMember.workspace_id;
  }

  const emailName = user.email?.split("@")[0] || "workspace";
  const workspaceSlug = `${slugify(emailName) || "workspace"}-${Date.now()}`;
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({
      name: "My Workspace",
      slug: workspaceSlug,
      created_by: user.id,
      default_from_name: "Trigger Mail AI",
      default_from_email: user.email,
    })
    .select("id")
    .single();

  if (workspaceError) {
    throw workspaceError;
  }

  const { error: memberInsertError } = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberInsertError) {
    throw memberInsertError;
  }

  return workspace.id;
}

export async function assertTemplateAccess(templateId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: template, error: templateError } = await supabase
    .from("email_templates")
    .select("id, workspace_id")
    .eq("id", templateId)
    .maybeSingle();

  if (templateError) {
    throw templateError;
  }

  if (!template?.workspace_id) {
    throw new Error("Template was not found.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", template.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (!membership) {
    throw new Error("You do not have access to this template.");
  }

  return template;
}
