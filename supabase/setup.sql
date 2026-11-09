-- =====================================================================
-- Arch3 · live flat availability (Riddhi Siddhi Apartment)
-- Run ONCE in Supabase: SQL Editor → New query → paste all of this → Run.
-- Safe to run again: it won't duplicate anything.
--
-- Who can do what
--   • Anyone (the public website):  read each flat's status. Nothing else.
--   • Signed-in staff of a project:  change status, read and write remarks,
--                                    see the change history.
--   Remarks and history are never readable by the public.
-- =====================================================================

-- Flats and their public status
create table if not exists public.units (
  project_id  text not null,
  unit_id     text not null,                       -- e.g. 'A-506'
  status      text not null default 'available'
              check (status in ('available', 'hold', 'booked', 'sold')),
  seed_status text not null default 'available',   -- used by "Reset demo"
  updated_at  timestamptz,
  primary key (project_id, unit_id)
);

-- Internal remarks (staff only)
create table if not exists public.unit_notes (
  project_id text not null,
  unit_id    text not null,
  remarks    text not null default '',
  primary key (project_id, unit_id)
);

-- Change history (staff only)
create table if not exists public.activity (
  id          bigint generated always as identity primary key,
  project_id  text not null,
  unit_id     text not null,
  from_status text,
  to_status   text not null,
  remarks     text not null default '',
  by_name     text,
  at          timestamptz not null default now()
);
create index if not exists activity_project_at on public.activity (project_id, at desc);

-- Which signed-in users are staff on which project
create table if not exists public.staff (
  user_id    uuid not null references auth.users (id) on delete cascade,
  project_id text not null,
  name       text,
  role       text not null default 'manager',
  primary key (user_id, project_id)
);

create or replace function public.is_staff(p_project text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and project_id = p_project);
$$;

-- Row level security: nothing is readable or writable unless a policy allows it
alter table public.units      enable row level security;
alter table public.unit_notes enable row level security;
alter table public.activity   enable row level security;
alter table public.staff      enable row level security;

drop policy if exists "anyone reads availability" on public.units;
create policy "anyone reads availability" on public.units for select using (true);
drop policy if exists "staff read remarks" on public.unit_notes;
create policy "staff read remarks" on public.unit_notes for select using (public.is_staff(project_id));
drop policy if exists "staff read history" on public.activity;
create policy "staff read history" on public.activity for select using (public.is_staff(project_id));
drop policy if exists "users read own staff row" on public.staff;
create policy "users read own staff row" on public.staff for select using (user_id = auth.uid());
-- There are deliberately no insert/update/delete policies: every change goes
-- through the two functions below, which check that the caller is staff.

-- Change one or many flats. p_remarks = null keeps the existing remarks.
create or replace function public.set_units(p_project text, p_units text[], p_status text, p_remarks text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer := 0; u text; prev text; prev_r text; who text; new_r text;
begin
  if not public.is_staff(p_project) then raise exception 'Not allowed: you are not staff on this project'; end if;
  if p_status not in ('available', 'hold', 'booked', 'sold') then raise exception 'Unknown status %', p_status; end if;
  select coalesce(s.name, au.email) into who
    from public.staff s join auth.users au on au.id = s.user_id
   where s.user_id = auth.uid() and s.project_id = p_project;
  foreach u in array p_units loop
    select status into prev from public.units where project_id = p_project and unit_id = u for update;
    if prev is null then continue; end if;                       -- unknown flat id
    select remarks into prev_r from public.unit_notes where project_id = p_project and unit_id = u;
    prev_r := coalesce(prev_r, '');
    new_r := coalesce(left(p_remarks, 300), prev_r);
    if prev = p_status and new_r = prev_r then continue; end if; -- nothing changed
    if prev <> p_status then
      update public.units set status = p_status, updated_at = now()
       where project_id = p_project and unit_id = u;
    end if;
    if new_r <> prev_r then
      insert into public.unit_notes (project_id, unit_id, remarks) values (p_project, u, new_r)
      on conflict (project_id, unit_id) do update set remarks = excluded.remarks;
    end if;
    insert into public.activity (project_id, unit_id, from_status, to_status, remarks, by_name)
    values (p_project, u, prev, p_status, case when p_remarks is null then '' else new_r end, who);
    n := n + 1;
  end loop;
  return n;
end $$;

-- "Reset demo" in the sales console: back to the starting statuses, no remarks, no history.
create or replace function public.reset_demo(p_project text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(p_project) then raise exception 'Not allowed: you are not staff on this project'; end if;
  update public.units set status = seed_status, updated_at = now() where project_id = p_project;
  delete from public.unit_notes where project_id = p_project;
  delete from public.activity where project_id = p_project;
end $$;

-- only signed-in users may call them (and the functions themselves check for staff)
revoke execute on function public.set_units(text, text[], text, text) from public, anon;
revoke execute on function public.reset_demo(text) from public, anon;
grant execute on function public.set_units(text, text[], text, text) to authenticated;
grant execute on function public.reset_demo(text) to authenticated;

-- Live updates: the website and the console hear about changes within a second
do $$ begin
  begin alter publication supabase_realtime add table public.units;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.activity; exception when duplicate_object then null; end;
end $$;

-- The 112 flats of Riddhi Siddhi Apartment with the demo's starting statuses
insert into public.units (project_id, unit_id, status, seed_status) values
  ('riddhi-siddhi', 'A-101', 'available', 'available'),
  ('riddhi-siddhi', 'A-102', 'available', 'available'),
  ('riddhi-siddhi', 'A-103', 'available', 'available'),
  ('riddhi-siddhi', 'A-104', 'booked', 'booked'),
  ('riddhi-siddhi', 'A-105', 'available', 'available'),
  ('riddhi-siddhi', 'A-106', 'sold', 'sold'),
  ('riddhi-siddhi', 'A-107', 'available', 'available'),
  ('riddhi-siddhi', 'A-108', 'available', 'available'),
  ('riddhi-siddhi', 'A-201', 'available', 'available'),
  ('riddhi-siddhi', 'A-202', 'booked', 'booked'),
  ('riddhi-siddhi', 'A-203', 'available', 'available'),
  ('riddhi-siddhi', 'A-204', 'available', 'available'),
  ('riddhi-siddhi', 'A-205', 'hold', 'hold'),
  ('riddhi-siddhi', 'A-206', 'available', 'available'),
  ('riddhi-siddhi', 'A-207', 'sold', 'sold'),
  ('riddhi-siddhi', 'A-208', 'available', 'available'),
  ('riddhi-siddhi', 'A-301', 'available', 'available'),
  ('riddhi-siddhi', 'A-302', 'sold', 'sold'),
  ('riddhi-siddhi', 'A-303', 'available', 'available'),
  ('riddhi-siddhi', 'A-304', 'booked', 'booked'),
  ('riddhi-siddhi', 'A-305', 'hold', 'hold'),
  ('riddhi-siddhi', 'A-306', 'available', 'available'),
  ('riddhi-siddhi', 'A-307', 'sold', 'sold'),
  ('riddhi-siddhi', 'A-308', 'available', 'available'),
  ('riddhi-siddhi', 'A-401', 'sold', 'sold'),
  ('riddhi-siddhi', 'A-402', 'available', 'available'),
  ('riddhi-siddhi', 'A-403', 'hold', 'hold'),
  ('riddhi-siddhi', 'A-404', 'booked', 'booked'),
  ('riddhi-siddhi', 'A-405', 'available', 'available'),
  ('riddhi-siddhi', 'A-406', 'booked', 'booked'),
  ('riddhi-siddhi', 'A-407', 'available', 'available'),
  ('riddhi-siddhi', 'A-408', 'sold', 'sold'),
  ('riddhi-siddhi', 'A-501', 'booked', 'booked'),
  ('riddhi-siddhi', 'A-502', 'available', 'available'),
  ('riddhi-siddhi', 'A-503', 'sold', 'sold'),
  ('riddhi-siddhi', 'A-504', 'booked', 'booked'),
  ('riddhi-siddhi', 'A-505', 'hold', 'hold'),
  ('riddhi-siddhi', 'A-506', 'available', 'available'),
  ('riddhi-siddhi', 'A-507', 'available', 'available'),
  ('riddhi-siddhi', 'A-508', 'booked', 'booked'),
  ('riddhi-siddhi', 'A-601', 'booked', 'booked'),
  ('riddhi-siddhi', 'A-602', 'hold', 'hold'),
  ('riddhi-siddhi', 'A-603', 'available', 'available'),
  ('riddhi-siddhi', 'A-604', 'available', 'available'),
  ('riddhi-siddhi', 'A-605', 'hold', 'hold'),
  ('riddhi-siddhi', 'A-606', 'available', 'available'),
  ('riddhi-siddhi', 'A-607', 'sold', 'sold'),
  ('riddhi-siddhi', 'A-608', 'booked', 'booked'),
  ('riddhi-siddhi', 'A-701', 'booked', 'booked'),
  ('riddhi-siddhi', 'A-702', 'hold', 'hold'),
  ('riddhi-siddhi', 'A-703', 'available', 'available'),
  ('riddhi-siddhi', 'A-704', 'available', 'available'),
  ('riddhi-siddhi', 'A-705', 'sold', 'sold'),
  ('riddhi-siddhi', 'A-706', 'available', 'available'),
  ('riddhi-siddhi', 'A-707', 'booked', 'booked'),
  ('riddhi-siddhi', 'A-708', 'booked', 'booked'),
  ('riddhi-siddhi', 'B-101', 'available', 'available'),
  ('riddhi-siddhi', 'B-102', 'booked', 'booked'),
  ('riddhi-siddhi', 'B-103', 'available', 'available'),
  ('riddhi-siddhi', 'B-104', 'available', 'available'),
  ('riddhi-siddhi', 'B-105', 'available', 'available'),
  ('riddhi-siddhi', 'B-106', 'available', 'available'),
  ('riddhi-siddhi', 'B-107', 'sold', 'sold'),
  ('riddhi-siddhi', 'B-108', 'available', 'available'),
  ('riddhi-siddhi', 'B-201', 'available', 'available'),
  ('riddhi-siddhi', 'B-202', 'sold', 'sold'),
  ('riddhi-siddhi', 'B-203', 'available', 'available'),
  ('riddhi-siddhi', 'B-204', 'available', 'available'),
  ('riddhi-siddhi', 'B-205', 'sold', 'sold'),
  ('riddhi-siddhi', 'B-206', 'available', 'available'),
  ('riddhi-siddhi', 'B-207', 'hold', 'hold'),
  ('riddhi-siddhi', 'B-208', 'available', 'available'),
  ('riddhi-siddhi', 'B-301', 'available', 'available'),
  ('riddhi-siddhi', 'B-302', 'booked', 'booked'),
  ('riddhi-siddhi', 'B-303', 'available', 'available'),
  ('riddhi-siddhi', 'B-304', 'available', 'available'),
  ('riddhi-siddhi', 'B-305', 'booked', 'booked'),
  ('riddhi-siddhi', 'B-306', 'available', 'available'),
  ('riddhi-siddhi', 'B-307', 'hold', 'hold'),
  ('riddhi-siddhi', 'B-308', 'sold', 'sold'),
  ('riddhi-siddhi', 'B-401', 'sold', 'sold'),
  ('riddhi-siddhi', 'B-402', 'available', 'available'),
  ('riddhi-siddhi', 'B-403', 'booked', 'booked'),
  ('riddhi-siddhi', 'B-404', 'booked', 'booked'),
  ('riddhi-siddhi', 'B-405', 'available', 'available'),
  ('riddhi-siddhi', 'B-406', 'available', 'available'),
  ('riddhi-siddhi', 'B-407', 'hold', 'hold'),
  ('riddhi-siddhi', 'B-408', 'hold', 'hold'),
  ('riddhi-siddhi', 'B-501', 'booked', 'booked'),
  ('riddhi-siddhi', 'B-502', 'sold', 'sold'),
  ('riddhi-siddhi', 'B-503', 'available', 'available'),
  ('riddhi-siddhi', 'B-504', 'available', 'available'),
  ('riddhi-siddhi', 'B-505', 'hold', 'hold'),
  ('riddhi-siddhi', 'B-506', 'hold', 'hold'),
  ('riddhi-siddhi', 'B-507', 'sold', 'sold'),
  ('riddhi-siddhi', 'B-508', 'available', 'available'),
  ('riddhi-siddhi', 'B-601', 'available', 'available'),
  ('riddhi-siddhi', 'B-602', 'available', 'available'),
  ('riddhi-siddhi', 'B-603', 'booked', 'booked'),
  ('riddhi-siddhi', 'B-604', 'available', 'available'),
  ('riddhi-siddhi', 'B-605', 'booked', 'booked'),
  ('riddhi-siddhi', 'B-606', 'available', 'available'),
  ('riddhi-siddhi', 'B-607', 'sold', 'sold'),
  ('riddhi-siddhi', 'B-608', 'booked', 'booked'),
  ('riddhi-siddhi', 'B-701', 'sold', 'sold'),
  ('riddhi-siddhi', 'B-702', 'available', 'available'),
  ('riddhi-siddhi', 'B-703', 'hold', 'hold'),
  ('riddhi-siddhi', 'B-704', 'available', 'available'),
  ('riddhi-siddhi', 'B-705', 'available', 'available'),
  ('riddhi-siddhi', 'B-706', 'booked', 'booked'),
  ('riddhi-siddhi', 'B-707', 'available', 'available'),
  ('riddhi-siddhi', 'B-708', 'booked', 'booked')
on conflict (project_id, unit_id) do nothing;

-- Check: should show 112
select count(*) as flats from public.units where project_id = 'riddhi-siddhi';
