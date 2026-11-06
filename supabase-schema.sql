-- Titan Game and Hobby: database setup for Supabase
-- Paste this whole file into Supabase > SQL Editor and click Run.

-- ---------- Tables ----------
create table products (
  sku        text primary key,
  name       text not null,
  category   text not null check (category in ('dnd','tcg','models','board','collectibles','accessories')),
  price      numeric(10,2) not null default 0,
  qty        int not null default 0 check (qty >= 0),
  updated_at timestamptz not null default now()
);

create table events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  game       text not null check (game in ('tcg','dnd')),
  date       date not null,
  time       time not null,
  seats      int not null default 8 check (seats > 0),
  fee        text not null default 'Free',
  notes      text,
  created_at timestamptz not null default now()
);

create table signups (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  contact    text check (char_length(contact) <= 80),
  created_at timestamptz not null default now()
);

create table announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);

-- Staff accounts. After a staff member signs up, add their user id here.
create table staff (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ---------- Helpers ----------
create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid());
$$;

-- Public seat counts without exposing names or phone numbers
create or replace function signup_counts()
returns table (event_id uuid, taken bigint)
language sql stable security definer set search_path = public as $$
  select event_id, count(*) from signups group by event_id;
$$;

-- Stop sign-ups once a game night is full
create or replace function check_seats() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from signups where event_id = new.event_id)
     >= (select seats from events where id = new.event_id) then
    raise exception 'This game night is full';
  end if;
  return new;
end $$;

create trigger signups_seat_limit
before insert on signups
for each row execute function check_seats();

-- ---------- Security (Row Level Security) ----------
alter table products      enable row level security;
alter table events        enable row level security;
alter table signups       enable row level security;
alter table announcements enable row level security;
alter table staff         enable row level security;

-- Anyone can read the store's public info
create policy "public read products"      on products      for select using (true);
create policy "public read events"        on events        for select using (true);
create policy "public read announcements" on announcements for select using (true);

-- Only staff can add, change, or delete it
create policy "staff manage products"      on products      for all using (is_staff()) with check (is_staff());
create policy "staff manage events"        on events        for all using (is_staff()) with check (is_staff());
create policy "staff manage announcements" on announcements for all using (is_staff()) with check (is_staff());

-- Anyone can sign up. Only staff can see or remove the roster.
create policy "public sign up"        on signups for insert with check (true);
create policy "staff read signups"    on signups for select using (is_staff());
create policy "staff delete signups"  on signups for delete using (is_staff());

-- Staff can check their own staff row (used to show the Staff tab)
create policy "staff see self" on staff for select using (user_id = auth.uid());
