insert into public.workspaces (id, name, slug, default_from_name, default_from_email, timezone)
values (
  '00000000-0000-4000-8000-000000000001',
  'Trigger Mail AI Demo',
  'trigger-mail-ai-demo',
  'Trigger Mail AI',
  'hello@triggermail.ai',
  'Europe/London'
)
on conflict (slug) do nothing;

insert into public.audiences (id, workspace_id, name, description, contact_count, tags)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'SaaS founders', 'Trial and product-led growth contacts.', 8420, array['trial', 'product-led']),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Recruitment agencies', 'Agency teams exploring automation.', 3160, array['agency', 'hiring'])
on conflict do nothing;

insert into public.contacts (workspace_id, audience_id, name, email, company, source, tags, custom_fields, last_activity_at)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'Johnny Example', 'johnny@example.com', 'Acme Inc.', 'web_form', array['trial'], '{"plan":"pro"}', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'Alex Morgan', 'alex@example.com', 'Northstar Talent', 'import', array['agency'], '{"team_size":12}', now())
on conflict do nothing;

insert into public.email_templates (id, workspace_id, name, slug, category, description, subject, preheader, from_name, from_email, html, text, variables, status, design)
values
  (
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000001',
    'Welcome Email',
    'welcome-email',
    'onboarding',
    'First email sent to new subscribers.',
    'Welcome to Trigger Mail AI, {{first_name}}',
    'Here is what you can do next.',
    'Trigger Mail AI',
    'hello@triggermail.ai',
    '<h1>Welcome to Trigger Mail AI</h1><p>We are excited to have you here.</p>',
    'Welcome to Trigger Mail AI. We are excited to have you here.',
    array['first_name'],
    'published',
    '{"layout":"single-column","theme":"brand"}'
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000001',
    'Product Launch',
    'product-launch',
    'launch',
    'Announcement email for new product updates.',
    'New from {{company}}',
    'A quick look at what is new.',
    'Trigger Mail AI',
    'hello@triggermail.ai',
    '<h1>New from {{company}}</h1>',
    'New from {{company}}.',
    array['company'],
    'draft',
    '{"layout":"announcement","theme":"brand"}'
  )
on conflict (workspace_id, slug) do nothing;

insert into public.email_template_versions (template_id, version_number, subject, preheader, html, text, design)
values
  ('00000000-0000-4000-8000-000000000201', 1, 'Welcome to Trigger Mail AI, {{first_name}}', 'Here is what you can do next.', '<h1>Welcome to Trigger Mail AI</h1>', 'Welcome to Trigger Mail AI.', '{"layout":"single-column"}'),
  ('00000000-0000-4000-8000-000000000202', 1, 'New from {{company}}', 'A quick look at what is new.', '<h1>New from {{company}}</h1>', 'New from {{company}}.', '{"layout":"announcement"}')
on conflict (template_id, version_number) do nothing;

insert into public.triggers (id, workspace_id, name, type, endpoint_slug, event_name, source, status, auth_mode, sample_payload, config)
values
  (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000001',
    'New subscriber',
    'form',
    'new-subscriber',
    'subscriber.created',
    'web_form',
    'active',
    'none',
    '{"first_name":"Johnny","email":"johnny@example.com"}',
    '{"form_id":"newsletter"}'
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000001',
    'Inbound lead webhook',
    'webhook',
    'inbound-lead',
    'lead.created',
    'api',
    'testing',
    'secret',
    '{"name":"Alex","email":"alex@example.com","company":"Northstar Talent"}',
    '{"secret_header":"x-trigger-secret"}'
  )
on conflict (workspace_id, endpoint_slug) do nothing;

insert into public.flows (id, workspace_id, trigger_id, audience_id, name, slug, description, status, trigger_type, stats, settings, published_at)
values
  (
    '00000000-0000-4000-8000-000000000401',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000101',
    'Welcome Series',
    'welcome-series',
    'New subscriber onboarding with email, wait, and branch logic.',
    'running',
    'form',
    '{"sent":12643,"open_rate":42.7,"click_rate":18.3}',
    '{"track_opens":true,"track_clicks":true}',
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000402',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000302',
    null,
    'Inbound Lead Nurture',
    'inbound-lead-nurture',
    'Follow up when a new lead arrives from a webhook.',
    'draft',
    'webhook',
    '{"sent":0,"open_rate":0,"click_rate":0}',
    '{"track_opens":true,"track_clicks":true}',
    null
  )
on conflict (workspace_id, slug) do nothing;

insert into public.flow_steps (flow_id, type, name, position, template_id, config)
values
  ('00000000-0000-4000-8000-000000000401', 'trigger', 'New subscriber', 1, null, '{"trigger_id":"00000000-0000-4000-8000-000000000301"}'),
  ('00000000-0000-4000-8000-000000000401', 'email', 'Welcome Email', 2, '00000000-0000-4000-8000-000000000201', '{"subject":"Welcome to Trigger Mail AI"}'),
  ('00000000-0000-4000-8000-000000000401', 'wait', 'Wait 2 days', 3, null, '{"duration":2,"unit":"days"}'),
  ('00000000-0000-4000-8000-000000000401', 'condition', 'Opened email?', 4, null, '{"event":"email.opened"}'),
  ('00000000-0000-4000-8000-000000000401', 'email', 'Follow-up email', 5, '00000000-0000-4000-8000-000000000202', '{}')
on conflict do nothing;

insert into public.run_events (workspace_id, flow_id, event_type, title, metadata)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000401', 'flow.executed', 'Welcome Series executed', '{"count":128}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000401', 'email.sent', 'Welcome email sent', '{"template":"welcome-email"}')
on conflict do nothing;
