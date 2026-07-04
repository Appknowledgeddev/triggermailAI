-- Run this in Supabase SQL Editor.
-- It creates a safe server-side function the app can call to find or create
-- the signed-in user's workspace without the browser inserting into workspaces directly.

create extension if not exists pgcrypto;

create or replace function public.ensure_workspace(
  workspace_name text default 'My Workspace',
  default_from_name text default 'Trigger Mail AI',
  default_from_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_workspace_id uuid;
  new_workspace_id uuid;
  base_slug text;
  candidate_slug text;
  attempt integer := 0;
begin
  if current_user_id is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select workspace_id
  into existing_workspace_id
  from public.workspace_members
  where user_id = current_user_id
  limit 1;

  if existing_workspace_id is not null then
    return existing_workspace_id;
  end if;

  base_slug := lower(regexp_replace(coalesce(split_part(default_from_email, '@', 1), 'workspace'), '[^a-z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);

  if base_slug = '' then
    base_slug := 'workspace';
  end if;

  loop
    candidate_slug := base_slug || '-' || substr(replace(current_user_id::text, '-', ''), 1, 8);

    if attempt > 0 then
      candidate_slug := candidate_slug || '-' || attempt::text;
    end if;

    begin
      insert into public.workspaces (
        name,
        slug,
        created_by,
        default_from_name,
        default_from_email
      )
      values (
        workspace_name,
        candidate_slug,
        current_user_id,
        ensure_workspace.default_from_name,
        ensure_workspace.default_from_email
      )
      returning id into new_workspace_id;

      exit;
    exception
      when unique_violation then
        attempt := attempt + 1;
    end;
  end loop;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  return new_workspace_id;
end;
$$;

grant execute on function public.ensure_workspace(text, text, text) to authenticated;

-- Tell Supabase/PostgREST to refresh its function list immediately.
notify pgrst, 'reload schema';

-- Optional check: this should return one row after the function is created.
select
  routine_schema,
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'ensure_workspace';
