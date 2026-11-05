create function private.cancel_signup() returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 perform pg_advisory_xact_lock(783021);
 uid:=private.require_user();
 if exists(select 1 from public.profiles where id=uid)
    or exists(select 1 from public.bookings where user_id=uid) then
  raise exception '이미 가입이 완료된 계정입니다. 마이페이지에서 회원탈퇴를 진행해 주세요.';
 end if;
 delete from auth.sessions where user_id=uid;
 delete from auth.users where id=uid;
end $$;
create function public.cancel_signup() returns void
language sql security invoker set search_path='' as $$ select private.cancel_signup() $$;
revoke all on function private.cancel_signup(), public.cancel_signup() from public,anon,authenticated;
grant execute on function private.cancel_signup(), public.cancel_signup() to authenticated;
