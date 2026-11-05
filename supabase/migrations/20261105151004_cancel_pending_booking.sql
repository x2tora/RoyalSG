create function private.cancel_pending_booking(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid; cancelled_id uuid;
begin
 perform pg_advisory_xact_lock(783021);
 uid:=private.require_user();
 perform private.expire_bookings();
 update public.bookings set status='cancelled', active=false
 where id=p_id and user_id=uid and status='pending' and active
 returning id into cancelled_id;
 if cancelled_id is null then
  raise exception '본인의 진행 중인 승인 대기 예약만 취소할 수 있습니다.';
 end if;
end $$;
create function public.cancel_pending_booking(p_id uuid) returns void
language sql security invoker set search_path='' as $$ select private.cancel_pending_booking(p_id) $$;
revoke all on function private.cancel_pending_booking(uuid), public.cancel_pending_booking(uuid) from public,anon,authenticated;
grant execute on function private.cancel_pending_booking(uuid), public.cancel_pending_booking(uuid) to authenticated;
