-- Execute on the new project's SQL endpoint. All fixtures are rolled back.
begin;
select set_config('test.user',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at)
values(current_setting('test.user')::uuid,'royalsg-transaction-test@example.invalid',now());
insert into auth.sessions(id,user_id)
values(current_setting('test.user')::uuid,current_setting('test.user')::uuid);
insert into auth.identities(provider_id,user_id,identity_data,provider)
values(current_setting('test.user'),current_setting('test.user')::uuid,jsonb_build_object('sub',current_setting('test.user'),'email','royalsg-transaction-test@example.invalid','email_verified',true),'google');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.user'),'session_id',current_setting('test.user'))::text,true);
set local role authenticated;
select public.save_profile('트랜잭션 테스트','010-1234-5678',true,'2026-11-05');
do $$
declare candidate date; booking_id uuid; blocked boolean:=false;
begin
 select d::date into candidate from generate_series((now() at time zone 'Asia/Seoul')::date+1,(now() at time zone 'Asia/Seoul')::date+4,interval '1 day') d where extract(dow from d)<=4 limit 1;
 booking_id:=public.create_booking(candidate,'A',1);
 begin perform public.delete_account('010-1234-5678'); exception when raise_exception then
  if sqlerrm like '%회원탈퇴가 제한%' then blocked:=true; else raise; end if;
 end;
 if not blocked then raise exception 'FAILED: deletion deadline was bypassed'; end if;
 if (select count(*) from public.profiles)<>1 then raise exception 'FAILED: own profile visibility'; end if;
 begin perform public.admin_dashboard();raise exception 'FAILED: admin access'; exception when raise_exception then
  if sqlerrm not like '%관리자 권한%' then raise; end if;
 end;
end $$;
reset role;
insert into private.admins(user_id) values(current_setting('test.user')::uuid);
set local role authenticated;
select public.review_booking(id,'cancelled') from public.bookings where user_id=auth.uid();
select public.delete_account('010-1234-5678');
reset role;
do $$ begin
 if exists(select 1 from auth.users where id=current_setting('test.user')::uuid) or exists(select 1 from auth.sessions where user_id=current_setting('test.user')::uuid) then raise exception 'FAILED: account/session removal';end if;
end $$;
select 'live booking, deadline, RLS, admin and account deletion checks passed' as result;
rollback;
