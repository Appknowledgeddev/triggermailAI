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
