create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;

drop policy if exists "Service role can manage waitlist signups" on public.waitlist_signups;

create policy "Service role can manage waitlist signups"
  on public.waitlist_signups
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
