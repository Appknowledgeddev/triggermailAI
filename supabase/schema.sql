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

create table if not exists public.audiences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  contact_count integer not null default 0,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  audience_id uuid references public.audiences(id) on delete set null,
  name text not null,
  email text not null,
  company text,
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed', 'bounced', 'complained')),
  source text,
  tags text[] not null default '{}',
  custom_fields jsonb not null default '{}'::jsonb,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  category text not null default 'general',
  description text,
  subject text not null,
  preheader text,
  from_name text,
  from_email text,
  reply_to text,
  html text,
  text text,
  design jsonb not null default '{}'::jsonb,
  variables text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  thumbnail_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

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

create table if not exists public.triggers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  type text not null check (type in ('webhook', 'mailhook', 'schedule', 'api', 'form', 'manual')),
  endpoint_slug text not null,
  event_name text,
  source text,
  status text not null default 'active' check (status in ('active', 'disabled', 'testing')),
  auth_mode text not null default 'none' check (auth_mode in ('none', 'secret', 'signature')),
  schedule_cron text,
  sample_payload jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  last_received_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, endpoint_slug)
);

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

create index if not exists workspace_members_user_id_idx on public.workspace_members(user_id);
create index if not exists audiences_workspace_id_idx on public.audiences(workspace_id);
create index if not exists contacts_workspace_id_idx on public.contacts(workspace_id);
create index if not exists contacts_audience_id_idx on public.contacts(audience_id);
create index if not exists email_templates_workspace_status_idx on public.email_templates(workspace_id, status);
create index if not exists triggers_workspace_type_idx on public.triggers(workspace_id, type);
create index if not exists triggers_workspace_status_idx on public.triggers(workspace_id, status);
create index if not exists flows_workspace_status_idx on public.flows(workspace_id, status);
create index if not exists flows_trigger_id_idx on public.flows(trigger_id);
create index if not exists flow_steps_flow_id_position_idx on public.flow_steps(flow_id, position);
create index if not exists flow_runs_flow_id_created_at_idx on public.flow_runs(flow_id, created_at desc);
create index if not exists run_events_created_at_idx on public.run_events(created_at desc);
create index if not exists trigger_events_trigger_id_created_at_idx on public.trigger_events(trigger_id, created_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at before update on public.workspaces for each row execute function public.set_updated_at();

drop trigger if exists set_audiences_updated_at on public.audiences;
create trigger set_audiences_updated_at before update on public.audiences for each row execute function public.set_updated_at();

drop trigger if exists set_contacts_updated_at on public.contacts;
create trigger set_contacts_updated_at before update on public.contacts for each row execute function public.set_updated_at();

drop trigger if exists set_email_templates_updated_at on public.email_templates;
create trigger set_email_templates_updated_at before update on public.email_templates for each row execute function public.set_updated_at();

drop trigger if exists set_triggers_updated_at on public.triggers;
create trigger set_triggers_updated_at before update on public.triggers for each row execute function public.set_updated_at();

drop trigger if exists set_flows_updated_at on public.flows;
create trigger set_flows_updated_at before update on public.flows for each row execute function public.set_updated_at();

drop trigger if exists set_flow_steps_updated_at on public.flow_steps;
create trigger set_flow_steps_updated_at before update on public.flow_steps for each row execute function public.set_updated_at();

drop trigger if exists set_mailhooks_updated_at on public.mailhooks;
create trigger set_mailhooks_updated_at before update on public.mailhooks for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.flows enable row level security;
alter table public.flow_steps enable row level security;
alter table public.flow_runs enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_template_versions enable row level security;
alter table public.triggers enable row level security;
alter table public.trigger_events enable row level security;
alter table public.mailhooks enable row level security;
alter table public.audiences enable row level security;
alter table public.contacts enable row level security;
alter table public.run_events enable row level security;

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

drop policy if exists "Authenticated users can read flows" on public.flows;
drop policy if exists "Authenticated users can manage flows" on public.flows;
drop policy if exists "Authenticated users can read email templates" on public.email_templates;
drop policy if exists "Authenticated users can manage email templates" on public.email_templates;
drop policy if exists "Authenticated users can read triggers" on public.triggers;
drop policy if exists "Authenticated users can manage triggers" on public.triggers;
drop policy if exists "Authenticated users can read mailhooks" on public.mailhooks;
drop policy if exists "Authenticated users can manage mailhooks" on public.mailhooks;
drop policy if exists "Authenticated users can read audiences" on public.audiences;
drop policy if exists "Authenticated users can manage audiences" on public.audiences;
drop policy if exists "Authenticated users can read contacts" on public.contacts;
drop policy if exists "Authenticated users can manage contacts" on public.contacts;
drop policy if exists "Authenticated users can read run events" on public.run_events;
drop policy if exists "Authenticated users can manage run events" on public.run_events;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Workspace members can read workspaces" on public.workspaces;
create policy "Workspace members can read workspaces" on public.workspaces for select to authenticated using (public.is_workspace_member(id));
drop policy if exists "Authenticated users can create workspaces" on public.workspaces;
create policy "Authenticated users can create workspaces" on public.workspaces for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "Workspace members can update workspaces" on public.workspaces;
create policy "Workspace members can update workspaces" on public.workspaces for update to authenticated using (public.is_workspace_member(id)) with check (public.is_workspace_member(id));

drop policy if exists "Workspace members can read members" on public.workspace_members;
create policy "Workspace members can read members" on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "Users can create membership for themselves" on public.workspace_members;
create policy "Users can create membership for themselves" on public.workspace_members for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Workspace members can manage audiences" on public.audiences;
create policy "Workspace members can manage audiences" on public.audiences for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "Workspace members can manage contacts" on public.contacts;
create policy "Workspace members can manage contacts" on public.contacts for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "Workspace members can manage templates" on public.email_templates;
create policy "Workspace members can manage templates" on public.email_templates for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "Workspace members can manage triggers" on public.triggers;
create policy "Workspace members can manage triggers" on public.triggers for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "Workspace members can manage flows" on public.flows;
create policy "Workspace members can manage flows" on public.flows for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "Workspace members can manage flow runs" on public.flow_runs;
create policy "Workspace members can manage flow runs" on public.flow_runs for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "Workspace members can manage run events" on public.run_events;
create policy "Workspace members can manage run events" on public.run_events for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "Workspace members can manage trigger events" on public.trigger_events;
create policy "Workspace members can manage trigger events" on public.trigger_events for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "Workspace members can manage mailhooks" on public.mailhooks;
create policy "Workspace members can manage mailhooks" on public.mailhooks for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can manage flow steps" on public.flow_steps;
create policy "Workspace members can manage flow steps" on public.flow_steps for all to authenticated
using (
  exists (
    select 1 from public.flows
    where flows.id = flow_steps.flow_id
      and public.is_workspace_member(flows.workspace_id)
  )
)
with check (
  exists (
    select 1 from public.flows
    where flows.id = flow_steps.flow_id
      and public.is_workspace_member(flows.workspace_id)
  )
);

drop policy if exists "Workspace members can manage template versions" on public.email_template_versions;
create policy "Workspace members can manage template versions" on public.email_template_versions for all to authenticated
using (
  exists (
    select 1 from public.email_templates
    where email_templates.id = email_template_versions.template_id
      and public.is_workspace_member(email_templates.workspace_id)
  )
)
with check (
  exists (
    select 1 from public.email_templates
    where email_templates.id = email_template_versions.template_id
      and public.is_workspace_member(email_templates.workspace_id)
  )
);
