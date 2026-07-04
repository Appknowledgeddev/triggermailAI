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
