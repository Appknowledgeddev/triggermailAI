create table if not exists public.flows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  trigger_id uuid references public.triggers(id) on delete set null,
  audience_id uuid references public.audiences(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'running', 'paused', 'failed', 'archived')),
  trigger_type text,
  timezone text not null default 'Europe/London',
  settings jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

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

create table if not exists public.run_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  flow_id uuid references public.flows(id) on delete set null,
  flow_run_id uuid references public.flow_runs(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  event_type text not null,
  title text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

create table if not exists public.mailhooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  trigger_id uuid references public.triggers(id) on delete set null,
  address text not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'disabled', 'testing')),
  flow_id uuid references public.flows(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, address)
);
