-- Privileged implementation stays outside the exposed API schema.
alter function public.is_admin() set schema private;
alter function public.save_profile(text,text,boolean,text) set schema private;
alter function public.calendar_slots() set schema private;
alter function public.create_booking(date,text,integer) set schema private;
alter function public.admin_dashboard() set schema private;
alter function public.review_booking(uuid,text) set schema private;
alter function public.set_date_block(date,boolean) set schema private;
alter function public.delete_account(text) set schema private;

create function public.is_admin() returns boolean language sql stable security invoker set search_path='' as $$ select private.is_admin() $$;
create function public.save_profile(p_name text,p_phone text,p_consent boolean,p_version text) returns void language sql security invoker set search_path='' as $$ select private.save_profile(p_name,p_phone,p_consent,p_version) $$;
create function public.calendar_slots() returns table(rental_date date,machine text,people integer,status text) language sql stable security invoker set search_path='' as $$ select * from private.calendar_slots() $$;
create function public.create_booking(p_date date,p_machine text,p_people integer) returns uuid language sql security invoker set search_path='' as $$ select private.create_booking(p_date,p_machine,p_people) $$;
create function public.admin_dashboard() returns jsonb language sql security invoker set search_path='' as $$ select private.admin_dashboard() $$;
create function public.review_booking(p_id uuid,p_status text) returns void language sql security invoker set search_path='' as $$ select private.review_booking(p_id,p_status) $$;
create function public.set_date_block(p_date date,p_blocked boolean) returns void language sql security invoker set search_path='' as $$ select private.set_date_block(p_date,p_blocked) $$;
create function public.delete_account(p_phone text) returns void language sql security invoker set search_path='' as $$ select private.delete_account(p_phone) $$;
revoke all on function public.is_admin(),public.save_profile(text,text,boolean,text),public.calendar_slots(),public.create_booking(date,text,integer),public.admin_dashboard(),public.review_booking(uuid,text),public.set_date_block(date,boolean),public.delete_account(text) from public,anon,authenticated;
grant usage on schema private to anon,authenticated;
grant execute on function public.calendar_slots() to anon,authenticated;
grant execute on function public.is_admin(),public.save_profile(text,text,boolean,text),public.create_booking(date,text,integer),public.admin_dashboard(),public.review_booking(uuid,text),public.set_date_block(date,boolean),public.delete_account(text) to authenticated;
