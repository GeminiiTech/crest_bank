-- Buckets
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('kyc-documents', 'kyc-documents', false),
  ('marketing-assets', 'marketing-assets', true)
on conflict (id) do nothing;

-- avatars: public read, owner-scoped write (path prefix = auth.uid())
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars owner write" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars owner update" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars owner delete" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- kyc-documents: owner-only read/write (no public read)
create policy "kyc owner read" on storage.objects
  for select using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "kyc owner write" on storage.objects
  for insert with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- marketing-assets: public read; writes reserved for service role (no insert policy = denied to anon/auth)
create policy "marketing public read" on storage.objects
  for select using (bucket_id = 'marketing-assets');
