create function private.session_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
 where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function private.session_active() from public,anon,authenticated;
grant execute on function private.session_active() to authenticated;
create or replace function private.require_user() returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not private.session_active() then raise exception '로그인이 필요합니다.'; end if;
 return auth.uid();
end $$;
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select private.session_active() and exists(select 1 from private.admins where user_id=auth.uid());
$$;
alter policy own_profile on public.profiles using(id=(select auth.uid()) and (select private.session_active()));
alter policy own_bookings on public.bookings using(user_id=(select auth.uid()) and (select private.session_active()));
