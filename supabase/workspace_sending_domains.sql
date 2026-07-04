create table if not exists public.workspace_sending_domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  resend_domain_id text not null,
  name text not null,
  status text not null default 'not_started',
  region text,
  records jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name),
  unique (resend_domain_id)
);

create index if not exists workspace_sending_domains_workspace_idx on public.workspace_sending_domains(workspace_id);

drop trigger if exists set_workspace_sending_domains_updated_at on public.workspace_sending_domains;
create trigger set_workspace_sending_domains_updated_at
before update on public.workspace_sending_domains
for each row execute function public.set_updated_at();

alter table public.workspace_sending_domains enable row level security;

drop policy if exists "Workspace members can manage sending domains" on public.workspace_sending_domains;
create policy "Workspace members can manage sending domains"
on public.workspace_sending_domains
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
