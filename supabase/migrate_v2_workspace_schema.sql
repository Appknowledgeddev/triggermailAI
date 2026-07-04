-- Use this if you already ran the earlier starter schema.
-- For a brand-new Supabase project, run schema.sql instead.

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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  company text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  default_from_name text,
  default_from_email text,
  timezone text not null default 'Europe/London',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

alter table public.audiences add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.audiences add column if not exists updated_at timestamptz not null default now();

alter table public.contacts add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.contacts add column if not exists status text not null default 'subscribed';
alter table public.contacts add column if not exists source text;
alter table public.contacts add column if not exists updated_at timestamptz not null default now();

alter table public.email_templates add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.email_templates add column if not exists slug text;
alter table public.email_templates add column if not exists category text not null default 'general';
alter table public.email_templates add column if not exists description text;
alter table public.email_templates add column if not exists preheader text;
alter table public.email_templates add column if not exists from_name text;
alter table public.email_templates add column if not exists from_email text;
alter table public.email_templates add column if not exists reply_to text;
alter table public.email_templates add column if not exists text text;
alter table public.email_templates add column if not exists design jsonb not null default '{}'::jsonb;
alter table public.email_templates add column if not exists thumbnail_url text;
alter table public.email_templates add column if not exists created_by uuid references auth.users(id) on delete set null;
update public.email_templates set slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g') where slug is null;
alter table public.email_templates alter column slug set not null;

create table if not exists public.email_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.email_templates(id) on delete cascade,
  version_number integer not null,
  subject text not null,
  preheader text,
  html text,
  text text,
  design jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version_number)
);

alter table public.triggers add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.triggers add column if not exists event_name text;
alter table public.triggers add column if not exists source text;
alter table public.triggers add column if not exists auth_mode text not null default 'none';
alter table public.triggers add column if not exists schedule_cron text;
alter table public.triggers add column if not exists config jsonb not null default '{}'::jsonb;
alter table public.triggers add column if not exists last_received_at timestamptz;
alter table public.triggers add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.triggers add column if not exists updated_at timestamptz not null default now();

alter table public.flows add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.flows add column if not exists trigger_id uuid references public.triggers(id) on delete set null;
alter table public.flows add column if not exists audience_id uuid references public.audiences(id) on delete set null;
alter table public.flows add column if not exists slug text;
alter table public.flows add column if not exists timezone text not null default 'Europe/London';
alter table public.flows add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.flows add column if not exists stats jsonb not null default '{}'::jsonb;
alter table public.flows add column if not exists published_at timestamptz;
alter table public.flows add column if not exists created_by uuid references auth.users(id) on delete set null;
update public.flows set slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g') where slug is null;
alter table public.flows alter column slug set not null;

create table if not exists public.flow_steps (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.flows(id) on delete cascade,
  parent_step_id uuid references public.flow_steps(id) on delete set null,
  type text not null check (type in ('trigger', 'email', 'wait', 'condition', 'webhook', 'ai_generate', 'tag_contact', 'end')),
  name text not null,
  position integer not null default 0,
  branch_key text,
  template_id uuid references public.email_templates(id) on delete set null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flow_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  flow_id uuid references public.flows(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  trigger_id uuid references public.triggers(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  payload jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.run_events add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.run_events add column if not exists flow_run_id uuid references public.flow_runs(id) on delete cascade;
alter table public.run_events add column if not exists contact_id uuid references public.contacts(id) on delete set null;

create table if not exists public.trigger_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  trigger_id uuid references public.triggers(id) on delete cascade,
  flow_run_id uuid references public.flow_runs(id) on delete set null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  payload jsonb not null default '{}'::jsonb,
  headers jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.mailhooks add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.mailhooks add column if not exists trigger_id uuid references public.triggers(id) on delete set null;
alter table public.mailhooks add column if not exists updated_at timestamptz not null default now();

create index if not exists workspace_members_user_id_idx on public.workspace_members(user_id);
create index if not exists audiences_workspace_id_idx on public.audiences(workspace_id);
create index if not exists contacts_workspace_id_idx on public.contacts(workspace_id);
create index if not exists email_templates_workspace_status_idx on public.email_templates(workspace_id, status);
create index if not exists triggers_workspace_type_idx on public.triggers(workspace_id, type);
create index if not exists flows_workspace_status_idx on public.flows(workspace_id, status);
create index if not exists flow_steps_flow_id_position_idx on public.flow_steps(flow_id, position);
create index if not exists flow_runs_flow_id_created_at_idx on public.flow_runs(flow_id, created_at desc);
create index if not exists trigger_events_trigger_id_created_at_idx on public.trigger_events(trigger_id, created_at desc);

-- Re-run schema.sql after this migration to refresh triggers and row-level security policies.
