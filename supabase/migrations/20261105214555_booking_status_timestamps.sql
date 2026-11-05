alter table public.bookings
 add column confirmed_at timestamptz,
 add column cancelled_at timestamptz,
 add column rejected_at timestamptz;

create function private.record_booking_status_time() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.status is distinct from old.status then
  if new.status='confirmed' then new.confirmed_at:=now();
  elsif new.status='cancelled' then new.cancelled_at:=now();
  elsif new.status='rejected' then new.rejected_at:=now();
  end if;
 end if;
 return new;
end $$;
revoke all on function private.record_booking_status_time() from public,anon,authenticated;
create trigger booking_status_time before update of status on public.bookings
 for each row execute function private.record_booking_status_time();

create or replace function private.admin_dashboard() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_user();
 if not public.is_admin() then raise exception '관리자 권한이 필요합니다.'; end if;
 return jsonb_build_object('bookings',coalesce((select jsonb_agg(row_to_json(t)) from (
  select b.id,b.rental_date,b.machine,b.people,b.price,b.status,b.created_at,b.confirmed_at,b.cancelled_at,b.rejected_at,p.name,p.phone
  from public.bookings b left join public.profiles p on p.id=b.user_id
  where b.rental_date>=(now() at time zone 'Asia/Seoul')::date-90 order by b.rental_date desc
 )t),'[]'::jsonb),'blocks',coalesce((select jsonb_agg(rental_date) from public.date_blocks where rental_date>=(now() at time zone 'Asia/Seoul')::date),'[]'::jsonb));
end $$;
