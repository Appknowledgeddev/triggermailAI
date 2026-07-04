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
