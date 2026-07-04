"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Bot, FileClock, Folder, FolderPlus, Loader2, MailCheck, Plus, RefreshCw, Search, Trash2, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panels";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/types";

type Flow = Database["public"]["Tables"]["flows"]["Row"];
type FlowFolder = Database["public"]["Tables"]["flow_folders"]["Row"];
type RunEvent = Database["public"]["Tables"]["run_events"]["Row"];
function getStatNumber(stats: Json, key: string) {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
    return 0;
  }

  const value = (stats as Record<string, Json | undefined>)[key];
  return typeof value === "number" ? value : 0;
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
    throw new Error("Sign in before managing flows.");
  }

  return data.session.access_token;
}

export function FlowsManager() {
  const router = useRouter();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [folders, setFolders] = useState<FlowFolder[]>([]);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderName, setFolderName] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabaseReady = hasSupabaseConfig();

  const filteredFlows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return flows.filter((flow) => {
      const folderMatches = folderFilter === "all" || folderFilter === "all_flows"
        || (folderFilter === "unfiled" ? !flow.folder_id : flow.folder_id === folderFilter);
      const queryMatches = !query || [flow.name, flow.description, flow.status, flow.trigger_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));

      return folderMatches && queryMatches;
    });
  }, [flows, folderFilter, search]);

  const totals = useMemo(() => {
    return flows.reduce(
      (acc, flow) => {
        acc.sent += getStatNumber(flow.stats, "sent");
        if (flow.status === "active" || flow.status === "running") {
          acc.active += 1;
        }
        if (flow.status === "draft") {
          acc.draft += 1;
        }
        return acc;
      },
      { active: 0, draft: 0, sent: 0 },
    );
  }, [flows]);

  const getOrCreateWorkspace = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!sessionData.session) {
      throw new Error("Sign in before managing flows.");
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

  const loadFlows = useCallback(async () => {
    if (!supabaseReady) {
      setLoading(false);
      setError("Supabase keys are missing, so flows cannot be loaded yet.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const nextWorkspaceId = await getOrCreateWorkspace();

      const token = await getAccessToken();
      const [{ data: flowRows, error: flowsError }, { data: eventRows, error: eventsError }, foldersResponse] = await Promise.all([
        supabase
          .from("flows")
          .select("*")
          .eq("workspace_id", nextWorkspaceId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("run_events")
          .select("*")
          .eq("workspace_id", nextWorkspaceId)
          .order("created_at", { ascending: false })
          .limit(6),
        fetch("/api/flow-folders", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      if (flowsError) {
        throw flowsError;
      }

      if (eventsError) {
        throw eventsError;
      }

      const foldersPayload = (await foldersResponse.json()) as { folders?: FlowFolder[]; error?: string };
      if (!foldersResponse.ok) {
        if (/flow_folders|folder_id|PGRST205|schema cache/i.test(foldersPayload.error || "")) {
          setFolders([]);
        } else {
          throw new Error(foldersPayload.error || "Flow folders could not be loaded.");
        }
      } else {
        setFolders(foldersPayload.folders || []);
      }
      setFlows(flowRows || []);
      setEvents(eventRows || []);
    } catch (flowError) {
      setError(getErrorMessage(flowError, "Flows could not be loaded."));
      setFlows([]);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [getOrCreateWorkspace, supabaseReady]);

  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  async function handleCreateFlow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Give the flow a name first.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!sessionData.session) {
        throw new Error("Sign in before managing flows.");
      }

      const response = await fetch("/api/flows", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          folderId: folders.find((folder) => folder.id === folderFilter)?.id || null,
        }),
      });
      const payload = (await response.json()) as { flow?: Flow; error?: string };

      if (!response.ok || !payload.flow) {
        throw new Error(payload.error || "The flow could not be created.");
      }

      setFlows((current) => [payload.flow as Flow, ...current]);
      setName("");
      setDescription("");
      router.push(`/flows/${payload.flow.id}`);
    } catch (createFlowError) {
      setError(getErrorMessage(createFlowError, "The flow could not be created."));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = folderName.trim();

    if (!name) {
      setError("Add a folder name first.");
      return;
    }

    setCreatingFolder(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/flow-folders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json()) as { folder?: FlowFolder; error?: string };

      if (!response.ok || !payload.folder) {
        throw new Error(payload.error || "Flow folder could not be created.");
      }

      setFolders((current) => [...current, payload.folder as FlowFolder]);
      setFolderName("");
      setFolderFilter("all");
    } catch (createFolderError) {
      setError(getErrorMessage(createFolderError, "Flow folder could not be created."));
    } finally {
      setCreatingFolder(false);
    }
  }

  async function moveFlowToFolder(flow: Flow, nextFolderId: string) {
    setError(null);

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/flows/${flow.id}/folder`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderId: nextFolderId === "none" ? null : nextFolderId,
        }),
      });
      const payload = (await response.json()) as { flow?: Flow; error?: string };

      if (!response.ok || !payload.flow) {
        throw new Error(payload.error || "Flow folder could not be updated.");
      }

      setFlows((current) => current.map((item) => item.id === flow.id ? payload.flow as Flow : item));
    } catch (moveError) {
      setError(getErrorMessage(moveError, "Flow folder could not be updated."));
    }
  }

  async function handleDeleteFolder(folder: FlowFolder) {
    const count = flows.filter((flow) => flow.folder_id === folder.id).length;

    if (count > 0) {
      setError("Move or delete the flows inside this folder before deleting it.");
      return;
    }

    const confirmed = window.confirm(`Delete the empty folder "${folder.name}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingFolderId(folder.id);
    setError(null);

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/flow-folders/${folder.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Flow folder could not be deleted.");
      }

      setFolders((current) => current.filter((item) => item.id !== folder.id));
      setFolderFilter((currentFilter) => currentFilter === folder.id ? "all" : currentFilter);
    } catch (deleteFolderError) {
      setError(getErrorMessage(deleteFolderError, "Flow folder could not be deleted."));
    } finally {
      setDeletingFolderId(null);
    }
  }

  async function handleDeleteFlow(flow: Flow) {
    const confirmed = window.confirm(`Delete "${flow.name}"? This will remove the flow and its steps.`);
    if (!confirmed) {
      return;
    }

    setDeletingId(flow.id);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: deleteError } = await supabase.from("flows").delete().eq("id", flow.id);

      if (deleteError) {
        throw deleteError;
      }

      setFlows((current) => current.filter((item) => item.id !== flow.id));
      setEvents((current) => current.filter((item) => item.flow_id !== flow.id));
    } catch (deleteFlowError) {
      setError(getErrorMessage(deleteFlowError, "The flow could not be deleted."));
    } finally {
      setDeletingId(null);
    }
  }

  const signedOut = error === "Sign in before managing flows.";
  const folderOverview = folders.length > 1 && folderFilter === "all" && !search.trim();
  const selectedFolder = folders.find((folder) => folder.id === folderFilter);
  const unfiledCount = flows.filter((flow) => !flow.folder_id).length;

  return (
    <AppShell
      eyebrow="Flows"
      title="Flows"
      description="Create and manage the automation flows saved in your Supabase project."
      primaryAction="New Flow"
      secondaryAction="Import Flow"
      primaryActionHref="#new-flow"
    >
      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_310px]">
        <Panel>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                className="h-10 w-full rounded-[8px] border border-white/10 bg-white/[0.04] pl-9 pr-3 text-[13px] text-white outline-none placeholder:text-slate-500"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search flows..."
                value={search}
              />
            </div>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] font-semibold text-slate-100 transition hover:bg-white/10"
              onClick={loadFlows}
              type="button"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>

          <form id="new-flow" className="mt-4 grid scroll-mt-28 gap-3 rounded-[9px] border border-white/10 bg-white/[0.03] p-3 lg:grid-cols-[1fr_1fr_auto]" onSubmit={handleCreateFlow}>
            <input
              className="h-10 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none placeholder:text-slate-500"
              disabled={saving || loading || signedOut || !supabaseReady}
              onChange={(event) => setName(event.target.value)}
              placeholder="Flow name"
              value={name}
            />
            <input
              className="h-10 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none placeholder:text-slate-500"
              disabled={saving || loading || signedOut || !supabaseReady}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short description"
              value={description}
            />
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-4 text-[13px] font-semibold text-white shadow-lg shadow-fuchsia-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving || loading || signedOut || !supabaseReady}
              type="submit"
            >
              {saving ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
              Add Flow
            </button>
          </form>

          <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={handleCreateFolder}>
            <input
              className="h-10 min-w-[220px] flex-1 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none placeholder:text-slate-500"
              disabled={creatingFolder || loading || signedOut || !supabaseReady}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="New folder name"
              value={folderName}
            />
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-fuchsia-600 px-4 text-[13px] font-semibold text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={creatingFolder || loading || signedOut || !supabaseReady}
              type="submit"
            >
              {creatingFolder ? <Loader2 className="animate-spin" size={15} /> : <FolderPlus size={15} />}
              Folder
            </button>
          </form>

          {error && (
            <div className="mt-4 rounded-[8px] border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[13px] text-amber-200">
              {error} {signedOut && <Link className="font-semibold underline" href="/login">Go to sign in</Link>}
            </div>
          )}

          {loading ? (
            <div className="mt-5 overflow-hidden rounded-[10px] border border-white/10">
              <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-400">
                <Loader2 className="animate-spin" size={17} />
                Loading your flows...
              </div>
            </div>
          ) : folderOverview ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {folders.map((folder) => {
                const count = flows.filter((flow) => flow.folder_id === folder.id).length;
                return (
                  <article key={folder.id} className="rounded-[10px] border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
                    <button className="block w-full text-left" onClick={() => setFolderFilter(folder.id)} type="button">
                      <Folder size={19} className="text-fuchsia-300" />
                      <span className="mt-4 block truncate text-sm font-semibold text-white">{folder.name}</span>
                      <span className="mt-1 block text-xs text-slate-500">{count} flow{count === 1 ? "" : "s"}</span>
                    </button>
                    {count === 0 && (
                      <button
                        className="mt-4 inline-flex h-8 items-center gap-2 rounded-[7px] border border-red-danger/30 bg-red-danger/10 px-2 text-xs font-semibold text-red-200 transition hover:bg-red-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={deletingFolderId === folder.id}
                        onClick={() => { void handleDeleteFolder(folder); }}
                        type="button"
                      >
                        {deletingFolderId === folder.id ? <Loader2 className="animate-spin" size={13} /> : <Trash2 size={13} />}
                        Delete
                      </button>
                    )}
                  </article>
                );
              })}
              {unfiledCount > 0 && (
                <button className="rounded-[10px] border border-white/10 bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.06]" onClick={() => setFolderFilter("unfiled")} type="button">
                  <Zap size={19} className="text-slate-300" />
                  <span className="mt-4 block truncate text-sm font-semibold text-white">Unfiled</span>
                  <span className="mt-1 block text-xs text-slate-500">{unfiledCount} flow{unfiledCount === 1 ? "" : "s"}</span>
                </button>
              )}
            </div>
          ) : (
          <>
          {folders.length > 1 && folderFilter !== "all_flows" && (
            <button className="mt-5 inline-flex h-9 items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] font-semibold text-slate-200 transition hover:bg-white/[0.08]" onClick={() => setFolderFilter("all")} type="button">
              <Folder size={14} />
              Back to folders
            </button>
          )}
          <div className="mt-5 overflow-hidden rounded-[10px] border border-white/10">
            <div className="hidden grid-cols-[1.35fr_120px_120px_95px_145px] border-b border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 md:grid">
              <span>Flow</span>
              <span>Status</span>
              <span>Trigger</span>
              <span>Sent</span>
              <span>Action</span>
            </div>

            {filteredFlows.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <div className="mx-auto grid size-11 place-items-center rounded-[9px] bg-violet-brand/15 text-fuchsia-300">
                  <Zap size={20} />
                </div>
                <h2 className="mt-4 text-base font-semibold text-white">{selectedFolder ? `No flows in ${selectedFolder.name}` : "No flows yet"}</h2>
                <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-slate-400">
                  {selectedFolder ? "Move flows into this folder from the flow row dropdown." : "Create your first flow above. Saved flows will appear here."}
                </p>
              </div>
            ) : (
              filteredFlows.map((flow) => (
                <div
                  key={flow.id}
                  className="grid gap-3 border-b border-white/10 px-4 py-4 text-sm transition last:border-b-0 hover:bg-white/[0.04] md:grid-cols-[1.35fr_120px_120px_95px_145px] md:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-violet-brand/15 text-fuchsia-300">
                      <Zap size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-white">{flow.name}</span>
                      <span className="mt-1 block truncate text-xs text-slate-500">{flow.description || `Updated ${formatDate(flow.updated_at)}`}</span>
                    </span>
                  </div>
                  <span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${flow.status === "active" ? "bg-emerald-400/10 text-emerald-300" : flow.status === "draft" ? "bg-violet-400/10 text-violet-300" : "bg-amber-400/10 text-amber-300"}`}>
                      {formatStatus(flow.status)}
                    </span>
                  </span>
                  <span className="text-slate-300">{flow.trigger_type ? formatStatus(flow.trigger_type) : "Blank"}</span>
                  <span className="font-semibold text-white">{getStatNumber(flow.stats, "sent").toLocaleString("en-GB")}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/flows/${flow.id}`} className="inline-flex h-9 items-center justify-center rounded-[7px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-100 transition hover:bg-white/10">
                      Open
                    </Link>
                    <button
                      aria-label={`Delete ${flow.name}`}
                      className="inline-flex h-9 w-fit items-center gap-2 rounded-[7px] border border-red-danger/30 bg-red-danger/10 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={deletingId === flow.id}
                      onClick={() => handleDeleteFlow(flow)}
                      type="button"
                    >
                      {deletingId === flow.id ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                    </button>
                    <select
                      aria-label={`Move ${flow.name} to folder`}
                      className="h-8 rounded-[7px] border border-white/10 bg-[#111827] px-2 text-xs font-semibold text-slate-200 outline-none"
                      onChange={(event) => { void moveFlowToFolder(flow, event.target.value); }}
                      value={flow.folder_id || "none"}
                    >
                      <option value="none">No folder</option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>
              ))
            )}
          </div>
          </>
          )}
        </Panel>

        <div className="grid gap-4">
          <Panel>
            <h2 className="text-base font-semibold text-white">Flow Summary</h2>
            <div className="mt-4 grid gap-3">
              {[
                ["Total flows", flows.length.toLocaleString("en-GB"), Zap],
                ["Active flows", totals.active.toLocaleString("en-GB"), MailCheck],
                ["Draft flows", totals.draft.toLocaleString("en-GB"), FileClock],
                ["Emails sent", totals.sent.toLocaleString("en-GB"), Bot],
              ].map(([label, value, Icon]) => (
                <div key={label as string} className="flex items-center justify-between rounded-[8px] border border-white/10 bg-white/[0.03] p-3">
                  <span className="flex items-center gap-2.5 text-[13px] text-slate-300">
                    <Icon size={16} className="text-fuchsia-300" />
                    {label as string}
                  </span>
                  <span className="text-base font-semibold text-white">{value as string}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-base font-semibold text-white">Recent Runs</h2>
            {events.length === 0 ? (
              <p className="mt-4 rounded-[8px] border border-white/10 bg-white/[0.03] p-3 text-[13px] leading-5 text-slate-400">
                No run activity yet. Once flows start running, their events will appear here.
              </p>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                {events.map((event) => (
                  <div key={event.id} className="flex items-start justify-between gap-3 rounded-[8px] border border-white/10 bg-white/[0.03] p-3">
                    <span>
                      <span className="block text-[13px] font-semibold text-white">{event.title}</span>
                      <span className="mt-1 block text-xs text-slate-500">{formatStatus(event.event_type)}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{formatDate(event.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </section>
    </AppShell>
  );
}
