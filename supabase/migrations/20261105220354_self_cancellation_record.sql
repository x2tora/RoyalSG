alter table public.bookings add column cancelled_by_self boolean not null default false;

create or replace function private.cancel_pending_booking(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid; cancelled_id uuid;
begin
 perform pg_advisory_xact_lock(783021);
 uid:=private.require_user();
 perform private.expire_bookings();
 update public.bookings set status='cancelled', active=false, cancelled_by_self=true
 where id=p_id and user_id=uid and status='pending' and active
 returning id into cancelled_id;
 if cancelled_id is null then
  raise exception '본인의 진행 중인 승인 대기 예약만 취소할 수 있습니다.';
 end if;
end $$;

create or replace function private.admin_dashboard() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_user();
 if not public.is_admin() then raise exception '관리자 권한이 필요합니다.'; end if;
 return jsonb_build_object('bookings',coalesce((select jsonb_agg(row_to_json(t)) from (
  select b.id,b.rental_date,b.machine,b.people,b.price,b.status,b.created_at,b.confirmed_at,b.cancelled_at,b.rejected_at,b.cancelled_by_self,p.name,p.phone
  from public.bookings b left join public.profiles p on p.id=b.user_id
  where b.rental_date>=(now() at time zone 'Asia/Seoul')::date-90 order by b.rental_date desc
 )t),'[]'::jsonb),'blocks',coalesce((select jsonb_agg(rental_date) from public.date_blocks where rental_date>=(now() at time zone 'Asia/Seoul')::date),'[]'::jsonb));
end $$;
