create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notifications_user_read_idx on public.notifications(user_id, is_read);

create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();
