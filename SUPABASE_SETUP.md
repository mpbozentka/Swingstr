# Supabase setup for Swingstr

Use this when you want to log in and store students and videos in the cloud.

## 1. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a project.
2. In **Settings → API**, copy:
   - **Project URL**
   - **anon public** key (under "Project API keys")

## 2. Add env vars

In the project root, copy `.env.example` to `.env` and set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Restart the dev server after changing `.env`.

## 3. Run the database schema

1. In Supabase: **SQL Editor** → New query.
2. Paste and run the contents of `supabase/schema.sql`.
3. That creates `students` and `videos` tables and Row Level Security so each user only sees their own data.

## 4. Create the Storage bucket for videos

1. In Supabase: **Storage** → **New bucket**.
2. Name: `videos`.
3. **Public bucket**: turn ON if you want direct playback via public URLs (simplest).  
   If you leave it OFF, you’ll need to use signed URLs in code (see Supabase Storage docs).
4. **Create bucket**.

Then add a policy so only authenticated users can upload/read/delete their own files:

1. Open the `videos` bucket → **Policies**.
2. **New policy** → “For full customization”.
3. Policy name: `Users can manage own videos`
4. Allowed operations: SELECT, INSERT, DELETE (or All).
5. Target roles: `authenticated`.
6. USING expression:

   ```sql
   (storage.foldername(name))[1] = auth.uid()::text
   ```

7. WITH CHECK (for INSERT/UPDATE): same expression:

   ```sql
   (storage.foldername(name))[1] = auth.uid()::text
   ```

Files are stored as `{user_id}/{student_id}/{uuid}.mp4`, so this restricts access by folder.

## 5. Auth (optional)

- **Authentication → Providers**: Email is enabled by default.
- For email signup, you can turn on “Confirm email” in **Auth → Settings** if you want verification.

## 6. Run the app

- Without `.env`: app runs with **local storage** only (no login).
- With `.env` and Supabase configured: you get the **login/signup** screen; after signing in, students and videos are stored in Supabase and scoped to your user.
