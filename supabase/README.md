# Supabase Database Setup

Run these files in the Supabase SQL editor:

1. `00_bootstrap_workspaces.sql` only if Supabase says `relation "public.workspaces" does not exist`
2. `schema.sql`
3. `seed.sql` optional demo data
4. `waitlist_signups.sql` if you want the public waiting-list form to store new access requests

If Supabase gives `syntax error at end of input`, the SQL editor likely received an incomplete paste. Use the smaller files in `chunks/` instead:

1. `chunks/01_foundation.sql`
2. `chunks/02_contacts_templates_triggers.sql`
3. `chunks/03_flows_events_mailhooks.sql`
4. `chunks/04_indexes_triggers.sql`
5. `chunks/05_rls_policies.sql`
6. `seed.sql` optional demo data
7. `waitlist_signups.sql` if you want the public waiting-list form to store new access requests

## Core Tables

- `workspaces`: account/team container for the app.
- `workspace_members`: users and roles inside a workspace.
- `profiles`: app profile data linked to Supabase Auth users.
- `flows`: automation records such as Welcome Series.
- `flow_steps`: ordered nodes inside a flow, including email, wait, condition, AI, and end steps.
- `flow_runs`: each execution of a flow.
- `run_events`: activity log records for flows, emails, and contacts.
- `email_templates`: editable email builder templates.
- `email_template_versions`: saved template versions.
- `triggers`: form, webhook, mailhook, schedule, API, and manual trigger definitions.
- `trigger_events`: received trigger payloads and processing status.
- `mailhooks`: inbound email addresses tied to triggers/flows.
- `audiences`: contact groups or segments.
- `contacts`: subscriber/contact records.

The schema includes row-level security. App data is scoped by `workspace_id` and readable/manageable by authenticated workspace members.
