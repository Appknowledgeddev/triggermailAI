create table if not exists public.flow_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  color text not null default '#a855f7',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

alter table public.flows
add column if not exists folder_id uuid references public.flow_folders(id) on delete set null;

create index if not exists flow_folders_workspace_idx on public.flow_folders(workspace_id);
create index if not exists flows_folder_idx on public.flows(folder_id);

drop trigger if exists set_flow_folders_updated_at on public.flow_folders;
create trigger set_flow_folders_updated_at before update on public.flow_folders for each row execute function public.set_updated_at();

alter table public.flow_folders enable row level security;

drop policy if exists "Workspace members can manage flow folders" on public.flow_folders;
create policy "Workspace members can manage flow folders" on public.flow_folders for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
