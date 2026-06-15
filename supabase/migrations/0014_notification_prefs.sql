-- Notification preferences for the settings page (owner-writable via existing RLS).
alter table public.profiles
  add column notification_prefs jsonb not null
  default '{"product": true, "security": true, "transfers": true}'::jsonb;
