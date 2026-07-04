create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  );
$$;

create table if not exists public.connected_email_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook', 'resend', 'smtp')),
  email text not null,
  display_name text,
  status text not null default 'setup_required' check (status in ('setup_required', 'connected', 'expired', 'revoked', 'error')),
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  last_used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, email)
);

create index if not exists connected_email_accounts_workspace_idx on public.connected_email_accounts(workspace_id);
create index if not exists connected_email_accounts_provider_idx on public.connected_email_accounts(provider, status);

drop trigger if exists set_connected_email_accounts_updated_at on public.connected_email_accounts;
create trigger set_connected_email_accounts_updated_at
before update on public.connected_email_accounts
for each row execute function public.set_updated_at();

alter table public.connected_email_accounts enable row level security;

drop policy if exists "Workspace members can manage connected email accounts" on public.connected_email_accounts;
create policy "Workspace members can manage connected email accounts"
on public.connected_email_accounts
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

notify pgrst, 'reload schema';
