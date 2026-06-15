-- Allow users to insert their own notifications (needed by the per-user demo seed;
-- in production the service role / system creates notifications).
create policy "notifications insert own" on public.notifications
  for insert with check (auth.uid() = user_id);
