-- Run this if the app cannot create email templates because of permissions/RLS.
-- It does not delete data. It refreshes grants and the policies needed by the app.

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.email_templates to authenticated;
grant select, insert, update, delete on public.email_template_versions to authenticated;

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

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_template_versions enable row level security;

drop policy if exists "Authenticated users can create workspaces" on public.workspaces;
create policy "Authenticated users can create workspaces"
on public.workspaces
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Workspace members can read workspaces" on public.workspaces;
create policy "Workspace members can read workspaces"
on public.workspaces
for select
to authenticated
using (public.is_workspace_member(id) or created_by = auth.uid());

drop policy if exists "Users can read own membership" on public.workspace_members;
create policy "Users can read own membership"
on public.workspace_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create membership for themselves" on public.workspace_members;
create policy "Users can create membership for themselves"
on public.workspace_members
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Workspace members can manage templates" on public.email_templates;
create policy "Workspace members can manage templates"
on public.email_templates
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can manage template versions" on public.email_template_versions;
create policy "Workspace members can manage template versions"
on public.email_template_versions
for all
to authenticated
using (
  exists (
    select 1
    from public.email_templates
    where email_templates.id = email_template_versions.template_id
      and public.is_workspace_member(email_templates.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.email_templates
    where email_templates.id = email_template_versions.template_id
      and public.is_workspace_member(email_templates.workspace_id)
  )
);
