-- =====================================================================
-- Arch3 · make a user staff on the project (run AFTER setup.sql)
-- 1. First create the user: Authentication → Users → Add user → Create new user
--    (tick "Auto Confirm User").
-- 2. Replace the email (and the name shown in the change history) below, then Run.
-- =====================================================================
insert into public.staff (user_id, project_id, name)
select id, 'riddhi-siddhi', 'Sumedh'
  from auth.users
 where email = 'REPLACE-WITH-YOUR-EMAIL@example.com'
on conflict (user_id, project_id) do update set name = excluded.name;

-- Check: should show your email
select u.email, s.project_id, s.name from public.staff s join auth.users u on u.id = s.user_id;
