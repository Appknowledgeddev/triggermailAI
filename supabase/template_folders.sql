create table if not exists public.template_folders (
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

alter table public.email_templates
add column if not exists folder_id uuid references public.template_folders(id) on delete set null;

create index if not exists template_folders_workspace_idx on public.template_folders(workspace_id);
create index if not exists email_templates_folder_idx on public.email_templates(folder_id);

drop trigger if exists set_template_folders_updated_at on public.template_folders;
create trigger set_template_folders_updated_at before update on public.template_folders for each row execute function public.set_updated_at();

alter table public.template_folders enable row level security;

drop policy if exists "Workspace members can manage template folders" on public.template_folders;
create policy "Workspace members can manage template folders" on public.template_folders for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
