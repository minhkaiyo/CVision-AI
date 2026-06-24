# CVisionAI Supabase Setup

## 1. Environment Variables

Frontend local env:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_your_publishable_key
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

Backend local env:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_your_server_only_secret_key
APP_ENV=development
FRONTEND_BASE_URL=http://localhost:3000
```

## 2. Run Database Schema

Open Supabase Dashboard, then go to `SQL Editor`.

Run these files in order:

```text
supabase/migrations/20260623000000_init_schema.sql
supabase/migrations/20260624000000_rls_and_profiles.sql
```

## 3. Enable Auth Providers

Go to `Authentication` > `Providers`.

Enable:

```text
Email
Google, optional
```

## 4. Promote First Admin

After creating the first user from the app, run this in Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin', plan = 'premium'
where email = 'your-admin-email@example.com';
```

## 5. Security Notes

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` / publishable key can be used in the browser.
- `SUPABASE_SERVICE_ROLE_KEY` / secret key must only exist in backend env.
- If the secret key is ever pasted into a chat, screenshot, or public place, rotate it before production.

## 6. Smoke Test

1. Start backend.
2. Start frontend.
3. Register with email/password.
4. Confirm a row exists in `profiles`.
5. Promote that email to admin.
6. Visit `/admin`.
7. Upload a CV from `/dashboard/upload`.
