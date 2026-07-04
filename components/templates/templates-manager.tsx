"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Filter, Folder, FolderPlus, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panels";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type EmailTemplate = Database["public"]["Tables"]["email_templates"]["Row"];
type TemplateFolder = Database["public"]["Tables"]["template_folders"]["Row"];
type TemplateCategory = "general" | "onboarding" | "newsletter" | "sales" | "transactional" | "retention";

const categories: { value: TemplateCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "onboarding", label: "Onboarding" },
  { value: "newsletter", label: "Newsletter" },
  { value: "sales", label: "Sales" },
  { value: "transactional", label: "Transactional" },
  { value: "retention", label: "Retention" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function formatStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not updated yet";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getTemplateDesignHead(design: EmailTemplate["design"]) {
  if (design && typeof design === "object" && !Array.isArray(design) && "customHead" in design) {
    const customHead = (design as { customHead?: unknown }).customHead;
    return typeof customHead === "string" ? customHead : "";
  }

  return "";
}

function buildTemplatePreviewDocument(template: EmailTemplate) {
  const customHead = getTemplateDesignHead(template.design);
  const html = template.html?.trim() || `
<div style="font-family:Arial,sans-serif;color:#111827;padding:32px;line-height:1.6;">
  <p style="font-size:13px;font-weight:700;color:#7c3aed;">Trigger Mail AI</p>
  <h1 style="font-size:28px;line-height:1.2;">${template.subject || template.name}</h1>
  <p>This template has no saved HTML yet.</p>
</div>`.trim();

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; background: #eef2ff; }
      img { max-width: 100%; height: auto; }
    </style>
    ${customHead}
  </head>
  <body>
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${template.preheader || ""}</div>
    ${html}
  </body>
</html>`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "PGRST202"
  ) {
    return "Supabase has not loaded the ensure_workspace function yet. Run supabase/ensure_workspace_rpc.sql in the Supabase SQL Editor, then refresh this page.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const errorRecord = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [errorRecord.message, errorRecord.details, errorRecord.hint, errorRecord.code]
      .filter(Boolean)
      .map(String)
      .join(" ");
  }

  return fallback;
}

async function getAccessToken() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error("Sign in before managing templates.");
  }

  return data.session.access_token;
}

export function TemplatesManager() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [folders, setFolders] = useState<TemplateFolder[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [folderFilter, setFolderFilter] = useState("all");
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabaseReady = hasSupabaseConfig();

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();

    return templates.filter((template) => {
      const categoryMatches = categoryFilter === "all" || template.category === categoryFilter;
      const folderMatches = folderFilter === "all"
        || (folderFilter === "unfiled" ? !template.folder_id : template.folder_id === folderFilter);
      const queryMatches = !query || [template.name, template.subject, template.description, template.category, template.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));

      return categoryMatches && folderMatches && queryMatches;
    });
  }, [categoryFilter, folderFilter, search, templates]);

  const getOrCreateWorkspace = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!sessionData.session) {
      throw new Error("Sign in before managing templates.");
    }

    const response = await fetch("/api/workspace/ensure", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    });

    const payload = (await response.json()) as { workspaceId?: string; error?: string };

    if (!response.ok || !payload.workspaceId) {
      throw new Error(payload.error || "Workspace could not be prepared.");
    }

    return payload.workspaceId;
  }, []);

  const loadTemplates = useCallback(async () => {
    if (!supabaseReady) {
      setLoading(false);
      setError("Supabase keys are missing, so templates cannot be loaded yet.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const nextWorkspaceId = await getOrCreateWorkspace();

      const { data, error: templatesError } = await supabase
        .from("email_templates")
        .select("*")
        .eq("workspace_id", nextWorkspaceId)
        .order("updated_at", { ascending: false });

      if (templatesError) {
        throw templatesError;
      }

      setTemplates(data || []);

      const token = await getAccessToken();
      const foldersResponse = await fetch("/api/template-folders", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const foldersPayload = (await foldersResponse.json()) as { folders?: TemplateFolder[]; error?: string };

      if (!foldersResponse.ok) {
        if (/template_folders|PGRST205|schema cache/i.test(foldersPayload.error || "")) {
          setFolders([]);
          return;
        }

        throw new Error(foldersPayload.error || "Template files could not be loaded.");
      }

      setFolders(foldersPayload.folders || []);
    } catch (templatesError) {
      setError(getErrorMessage(templatesError, "Templates could not be loaded."));
      setTemplates([]);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [getOrCreateWorkspace, supabaseReady]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  async function moveTemplateToFolder(template: EmailTemplate, nextFolderId: string) {
    setError(null);

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/templates/${template.id}/folder`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderId: nextFolderId === "none" ? null : nextFolderId,
        }),
      });
      const payload = (await response.json()) as { template?: EmailTemplate; error?: string };

      if (!response.ok || !payload.template) {
        throw new Error(payload.error || "Template file could not be updated.");
      }

      setTemplates((currentTemplates) => currentTemplates.map((item) => item.id === template.id ? payload.template as EmailTemplate : item));
    } catch (moveError) {
      setError(getErrorMessage(moveError, "Template file could not be updated."));
    }
  }

  async function handleCreateFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newFolderName.trim();

    if (!name) {
      setError("Add a folder name first.");
      return;
    }

    setCreatingFolder(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/template-folders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json()) as { folder?: TemplateFolder; error?: string };

      if (!response.ok || !payload.folder) {
        throw new Error(payload.error || "Template folder could not be created.");
      }

      setFolders((currentFolders) => [...currentFolders, payload.folder as TemplateFolder]);
      setNewFolderName("");
      setFolderFilter("all");
    } catch (createFolderError) {
      setError(getErrorMessage(createFolderError, "Template folder could not be created."));
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleDeleteTemplate(template: EmailTemplate) {
    const confirmed = window.confirm(`Delete "${template.name}"? This will remove the template and its versions.`);
    if (!confirmed) {
      return;
    }

    setDeletingId(template.id);
    setError(null);

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "The template could not be deleted.");
      }

      setTemplates((current) => current.filter((item) => item.id !== template.id));
    } catch (deleteTemplateError) {
      setError(getErrorMessage(deleteTemplateError, "The template could not be deleted."));
    } finally {
      setDeletingId(null);
    }
  }

  const signedOut = error === "Sign in before managing templates.";

  return (
    <AppShell
      eyebrow="Templates"
      title="Templates"
      description="Create and manage the email templates saved in your Supabase project."
      primaryAction="New Template"
      secondaryAction="All Categories"
      primaryActionHref="/templates/welcome-email"
      secondaryActionHref="#template-filters"
    >
      <section className="mt-4">
        <Panel>
          <div id="template-filters" className="flex scroll-mt-28 flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                className="h-10 w-full rounded-[8px] border border-white/10 bg-white/[0.04] pl-9 pr-3 text-[13px] text-white outline-none placeholder:text-slate-500"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search templates..."
                value={search}
              />
            </div>
            <select
              aria-label="Filter by category"
              className="h-10 rounded-[8px] border border-white/10 bg-[#111827] px-3 text-[13px] text-white outline-none"
              onChange={(event) => setCategoryFilter(event.target.value)}
              value={categoryFilter}
            >
              <option value="all">All Categories</option>
              {categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] font-semibold text-slate-100 transition hover:bg-white/10"
              onClick={loadTemplates}
              type="button"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
            <form className="flex min-w-[250px] flex-1 items-center gap-2 sm:flex-none" onSubmit={handleCreateFolder}>
              <input
                aria-label="New folder name"
                className="h-10 min-w-0 flex-1 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none placeholder:text-slate-500 sm:w-[180px]"
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="New folder name"
                value={newFolderName}
              />
              <button
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[8px] bg-fuchsia-600 px-3 text-[13px] font-semibold text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={creatingFolder}
                type="submit"
              >
                {creatingFolder ? <Loader2 className="animate-spin" size={15} /> : <FolderPlus size={15} />}
                Folder
              </button>
            </form>
          </div>

          {error && (
            <div className="mt-4 rounded-[8px] border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[13px] text-amber-200">
              {error} {signedOut && <Link className="font-semibold underline" href="/login">Go to sign in</Link>}
            </div>
          )}

          {folders.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <Folder size={13} />
                Folders
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={`inline-flex h-9 items-center gap-2 rounded-[8px] border px-3 text-[13px] font-semibold transition ${folderFilter === "all" ? "border-fuchsia-400/50 bg-fuchsia-400/10 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"}`}
                  onClick={() => setFolderFilter("all")}
                  type="button"
                >
                  All templates
                  <span className="text-xs text-slate-500">{templates.length}</span>
                </button>
                <button
                  className={`inline-flex h-9 items-center gap-2 rounded-[8px] border px-3 text-[13px] font-semibold transition ${folderFilter === "unfiled" ? "border-fuchsia-400/50 bg-fuchsia-400/10 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"}`}
                  onClick={() => setFolderFilter("unfiled")}
                  type="button"
                >
                  Unfiled
                  <span className="text-xs text-slate-500">{templates.filter((template) => !template.folder_id).length}</span>
                </button>
                {folders.map((folder) => {
                  const count = templates.filter((template) => template.folder_id === folder.id).length;
                  return (
                    <button
                      key={folder.id}
                      className={`inline-flex h-9 max-w-full items-center gap-2 rounded-[8px] border px-3 text-[13px] font-semibold transition ${folderFilter === folder.id ? "border-fuchsia-400/50 bg-fuchsia-400/10 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"}`}
                      onClick={() => setFolderFilter(folder.id)}
                      type="button"
                    >
                      <span className="max-w-[180px] truncate">{folder.name}</span>
                      <span className="text-xs text-slate-500">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-5 overflow-hidden rounded-[10px] border border-white/10 bg-white/[0.02]">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-400">
                <Loader2 className="animate-spin" size={17} />
                Loading your templates...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <div className="mx-auto grid size-11 place-items-center rounded-[9px] bg-violet-brand/15 text-fuchsia-300">
                  <FileText size={20} />
                </div>
                <h2 className="mt-4 text-base font-semibold text-white">No templates yet</h2>
                <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-slate-400">
                  Create a template to start building your reusable email library.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {filteredTemplates.map((template) => (
                  <article key={template.id} className="grid gap-3 p-3 transition hover:bg-white/[0.04] lg:grid-cols-[112px_minmax(0,1fr)_150px_170px_130px] lg:items-center">
                    <div className="relative h-[76px] overflow-hidden rounded-[8px] border border-white/10 bg-slate-100 shadow-inner">
                      <iframe
                        className="pointer-events-none h-[520px] w-[620px] origin-top-left scale-[0.18] bg-white"
                        loading="lazy"
                        sandbox=""
                        srcDoc={buildTemplatePreviewDocument(template)}
                        title={`${template.name} preview`}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">{template.name}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${template.status === "published" ? "bg-emerald-400/10 text-emerald-300" : "bg-violet-400/10 text-violet-300"}`}>
                          {formatStatus(template.status)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">{template.subject}</p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Filter size={13} className="text-slate-500" />
                      {formatStatus(template.category)}
                    </div>

                    <div className="flex items-center gap-2">
                      <Folder size={13} className="shrink-0 text-slate-500" />
                      <select
                        aria-label={`Move ${template.name} to file`}
                        className="h-8 min-w-0 flex-1 rounded-[7px] border border-white/10 bg-[#111827] px-2 text-xs font-semibold text-slate-200 outline-none"
                        onChange={(event) => { void moveTemplateToFolder(template, event.target.value); }}
                        value={template.folder_id || "none"}
                      >
                        <option value="none">No file</option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 lg:justify-end">
                      <span className="hidden text-xs text-slate-500 xl:inline">{formatDate(template.updated_at)}</span>
                      <Link href={`/templates/welcome-email?template=${template.id}`} className="inline-flex h-9 items-center justify-center rounded-[7px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-100 transition hover:bg-white/10">
                        Open
                      </Link>
                      <button
                        aria-label={`Delete ${template.name}`}
                        className="grid size-9 place-items-center rounded-[7px] border border-red-danger/30 bg-red-danger/10 text-red-200 transition hover:bg-red-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={deletingId === template.id}
                        onClick={() => handleDeleteTemplate(template)}
                        type="button"
                      >
                        {deletingId === template.id ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
