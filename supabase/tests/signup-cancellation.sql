-- All test users and changes are rolled back; existing users are not touched.
begin;
select set_config('test.user',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at)
values(current_setting('test.user')::uuid,'signup-cancel-test@example.invalid',now(),now(),now());
insert into auth.sessions(id,user_id) values(current_setting('test.user')::uuid,current_setting('test.user')::uuid);
insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
values(current_setting('test.user'),current_setting('test.user')::uuid,jsonb_build_object('sub',current_setting('test.user'),'email','signup-cancel-test@example.invalid','email_verified',true),'google',now(),now());
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.user'),'session_id',current_setting('test.user'))::text,true);
set local role authenticated;
select public.cancel_signup();
reset role;
do $$ begin
 if exists(select 1 from auth.users where id=current_setting('test.user')::uuid)
 or exists(select 1 from auth.sessions where user_id=current_setting('test.user')::uuid)
 or exists(select 1 from auth.identities where user_id=current_setting('test.user')::uuid) then
  raise exception 'FAILED: incomplete account was not removed';
 end if;
end $$;

insert into auth.users(id,email,email_confirmed_at,created_at,updated_at)
values(current_setting('test.user')::uuid,'signup-cancel-test@example.invalid',now(),now(),now());
insert into auth.sessions(id,user_id) values(current_setting('test.user')::uuid,current_setting('test.user')::uuid);
insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
values(current_setting('test.user'),current_setting('test.user')::uuid,jsonb_build_object('sub',current_setting('test.user'),'email','signup-cancel-test@example.invalid','email_verified',true),'google',now(),now());
set local role authenticated;
select public.save_profile('가입 취소 테스트','010-0000-0000',true,'2026-11-05');
do $$ begin
 begin
  perform public.cancel_signup();
  raise exception 'FAILED: completed account was removed';
 exception when raise_exception then
  if sqlerrm not like '%이미 가입이 완료%' then raise; end if;
 end;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from auth.users where id=current_setting('test.user')::uuid)
 or not exists(select 1 from public.profiles where id=current_setting('test.user')::uuid) then
  raise exception 'FAILED: completed account was changed';
 end if;
end $$;
select 'signup cancellation and completed-account protection passed' as result;
rollback;
