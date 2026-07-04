# Trigger Mail AI

AI-powered email automation platform for flows, templates, triggers, mailhooks, audiences, insights, and AI drafts.

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run `supabase/schema.sql`.
4. Optionally run `supabase/seed.sql` for starter data.
5. Copy `.env.example` to `.env.local`.
6. Add your Supabase URL and anon key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

Use `SUPABASE_SERVICE_ROLE_KEY` only for server-only jobs or secure backend routes.

### Auth setup

In Supabase Auth settings, add these redirect URLs for local development:

```text
http://127.0.0.1:3001/auth/callback
http://localhost:3001/auth/callback
```

The app now uses Supabase for sign in, sign up, password reset, auth callback handling, and logout. During this initial setup, app pages remain freely accessible while the auth flow is being wired in.

The browser client currently uses Supabase's implicit auth flow for local setup. If you see a PKCE verifier error after changing auth settings, request a fresh confirmation/reset email because older links may have been generated under the previous PKCE flow.

## Local preview

```bash
npm install
npm run dev
```

The app will show a Supabase status pill near the page title. It changes once the public Supabase URL and anon key are present.
