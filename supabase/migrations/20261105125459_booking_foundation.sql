create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 name text not null check (char_length(name) between 1 and 30),
 phone text not null check (phone ~ '^010-[0-9]{4}-[0-9]{4}$'),
 consent_version text not null,
 consent_at timestamptz not null default now()
);
create table private.admins (user_id uuid primary key references auth.users on delete cascade);
create table public.bookings (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users on delete set null,
 rental_date date not null,
 machine text not null check (machine in ('A','B','C')),
 people integer not null check (people in (1,2)),
 price integer not null check (price in (25000,35000)),
 status text not null default 'pending' check (status in ('pending','confirmed','rejected','cancelled')),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 check (extract(dow from rental_date) between 0 and 4)
);
create unique index one_active_date on public.bookings(rental_date) where active;
create unique index one_active_user on public.bookings(user_id) where active;
create index bookings_user on public.bookings(user_id);
create table public.date_blocks (rental_date date primary key);
alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.date_blocks enable row level security;
alter table private.admins enable row level security;
revoke all on public.profiles, public.bookings, public.date_blocks from anon,authenticated;
grant select on public.profiles, public.bookings to authenticated;

create function private.require_user() returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
 if uid is null or not exists(select 1 from auth.users where id=uid) or not exists(
  select 1 from auth.sessions where user_id=uid and id::text=auth.jwt()->>'session_id'
 ) then raise exception '로그인이 필요합니다.'; end if;
 return uid;
end $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.admins where user_id=auth.uid()) and exists(select 1 from auth.sessions where user_id=auth.uid() and id::text=auth.jwt()->>'session_id');
$$;
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy own_bookings on public.bookings for select to authenticated using(user_id=(select auth.uid()));

-- All mutations share one transaction lock: reservations, administration and deletion cannot race.
create function private.expire_bookings() returns void language sql security definer set search_path='' as $$
 update public.bookings set active=false where active and ((rental_date+1+time '05:00') at time zone 'Asia/Seoul')<=now();
$$;
create function public.save_profile(p_name text,p_phone text,p_consent boolean,p_version text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 perform pg_advisory_xact_lock(783021);
 uid:=private.require_user();
 if p_name is null or char_length(trim(p_name)) not between 1 and 30 or p_phone is null or p_phone !~ '^010-[0-9]{4}-[0-9]{4}$' then raise exception '이름과 010 전화번호를 확인해 주세요.'; end if;
 if not exists(select 1 from public.profiles where id=uid) then
  if p_consent is distinct from true or p_version is distinct from '2026-11-05' then raise exception '개인정보 처리방침에 동의해 주세요.'; end if;
  insert into public.profiles(id,name,phone,consent_version) values(uid,trim(p_name),p_phone,p_version);
 else update public.profiles set name=trim(p_name),phone=p_phone where id=uid; end if;
 -- Only verified Google identities can bootstrap the designated administrator.
 if exists(select 1 from auth.users u join auth.identities i on i.user_id=u.id
   where u.id=uid and lower(u.email)='xitora.works@gmail.com' and u.email_confirmed_at is not null
   and i.provider='google' and lower(i.identity_data->>'email')='xitora.works@gmail.com'
   and i.identity_data->>'email_verified'='true') then
  insert into private.admins values(uid) on conflict do nothing;
 end if;
end $$;
create function public.calendar_slots() returns table(rental_date date,machine text,people integer,status text) language sql stable security definer set search_path='' as $$
 select b.rental_date,b.machine,b.people,b.status from public.bookings b
 where b.status in ('pending','confirmed') and b.rental_date between (now() at time zone 'Asia/Seoul')::date-31 and (now() at time zone 'Asia/Seoul')::date+62
 union all select d.rental_date,null::text,null::integer,'blocked'::text from public.date_blocks d
 where d.rental_date between (now() at time zone 'Asia/Seoul')::date-31 and (now() at time zone 'Asia/Seoul')::date+62;
$$;
create function public.create_booking(p_date date,p_machine text,p_people integer) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid; local_now timestamp:=now() at time zone 'Asia/Seoul'; last_date date; result uuid;
begin
 perform pg_advisory_xact_lock(783021);
 uid:=private.require_user();
 perform private.expire_bookings();
 last_date:=local_now::date+case when local_now::time>=time '21:00' then 14 else 13 end;
 if not exists(select 1 from public.profiles where id=uid) then raise exception '회원 정보를 먼저 입력해 주세요.'; end if;
 if p_date is null or p_date<=local_now::date or p_date>last_date or extract(dow from p_date)>4 then raise exception '예약 가능한 날짜가 아닙니다.'; end if;
 if p_machine is null or p_machine not in ('A','B','C') or p_people is null or p_people not in (1,2) then raise exception '기체와 이용 인원을 확인해 주세요.'; end if;
 if exists(select 1 from public.date_blocks where rental_date=p_date) then raise exception '운영이 제한된 날짜입니다.'; end if;
 if exists(select 1 from public.bookings where rental_date=p_date and active) then raise exception '이미 신청된 날짜입니다.'; end if;
 if exists(select 1 from public.bookings where user_id=uid and active) then raise exception '예약은 1인당 1건만 보유할 수 있습니다.'; end if;
 insert into public.bookings(user_id,rental_date,machine,people,price) values(uid,p_date,p_machine,p_people,case when p_people=1 then 25000 else 35000 end) returning id into result;
 return result;
end $$;
create function public.admin_dashboard() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_user();
 if not public.is_admin() then raise exception '관리자 권한이 필요합니다.'; end if;
 return jsonb_build_object('bookings',coalesce((select jsonb_agg(row_to_json(t)) from (
  select b.id,b.rental_date,b.machine,b.people,b.price,b.status,p.name,p.phone
  from public.bookings b left join public.profiles p on p.id=b.user_id
  where b.rental_date>=(now() at time zone 'Asia/Seoul')::date-90 order by b.rental_date desc
 )t),'[]'::jsonb),'blocks',coalesce((select jsonb_agg(rental_date) from public.date_blocks where rental_date>=(now() at time zone 'Asia/Seoul')::date),'[]'::jsonb));
end $$;
create function public.review_booking(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare booking public.bookings;
begin
 perform pg_advisory_xact_lock(783021);
 perform private.require_user();
 if not public.is_admin() then raise exception '관리자 권한이 필요합니다.'; end if;
 perform private.expire_bookings();
 select * into booking from public.bookings where id=p_id for update;
 if booking.id is null or not booking.active then raise exception '진행 중인 예약이 아닙니다.'; end if;
 if p_status is null or p_status not in ('confirmed','rejected','cancelled') then raise exception '예약 상태를 확인해 주세요.'; end if;
 if p_status in ('confirmed','rejected') and booking.status<>'pending' then raise exception '대기 중인 예약만 승인 또는 거절할 수 있습니다.'; end if;
 update public.bookings set status=p_status,active=(p_status='confirmed') where id=p_id;
end $$;
create function public.set_date_block(p_date date,p_blocked boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(783021);
 perform private.require_user();
 if not public.is_admin() then raise exception '관리자 권한이 필요합니다.'; end if;
 perform private.expire_bookings();
 if p_date is null or p_date<(now() at time zone 'Asia/Seoul')::date or p_blocked is null then raise exception '날짜를 확인해 주세요.'; end if;
 if p_blocked then
  if exists(select 1 from public.bookings where rental_date=p_date and active) then raise exception '기존 예약을 먼저 정리해 주세요.'; end if;
  insert into public.date_blocks values(p_date) on conflict do nothing;
 else delete from public.date_blocks where rental_date=p_date; end if;
end $$;
create function public.delete_account(p_phone text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 perform pg_advisory_xact_lock(783021);
 uid:=private.require_user();
 perform private.expire_bookings();
 if p_phone is null or not exists(select 1 from public.profiles where id=uid and phone=p_phone) then raise exception '등록된 전화번호와 일치하지 않습니다.'; end if;
 if exists(select 1 from public.bookings where user_id=uid and active and rental_date-(now() at time zone 'Asia/Seoul')::date<5) then
  raise exception '이용일 5일 전이 지나 회원탈퇴가 제한됩니다. 예약 관련 사항은 운영자에게 문의해 주세요.';
 end if;
 update public.bookings set status=case when active then 'cancelled' else status end,active=false,user_id=null where user_id=uid;
 delete from auth.sessions where user_id=uid;
 delete from auth.users where id=uid;
end $$;
create function private.purge_personal_links() returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(783021);
 perform private.expire_bookings();
 update public.bookings set user_id=null where user_id is not null and ((rental_date+1+time '05:00') at time zone 'Asia/Seoul') < now()-interval '90 days';
end $$;

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.is_admin(),public.save_profile(text,text,boolean,text),public.calendar_slots(),public.create_booking(date,text,integer),public.admin_dashboard(),public.review_booking(uuid,text),public.set_date_block(date,boolean),public.delete_account(text) from public,anon,authenticated;
grant execute on function public.calendar_slots() to anon,authenticated;
grant execute on function public.is_admin(),public.save_profile(text,text,boolean,text),public.create_booking(date,text,integer),public.admin_dashboard(),public.review_booking(uuid,text),public.set_date_block(date,boolean),public.delete_account(text) to authenticated;
create extension if not exists pg_cron;
select cron.schedule('royalsg-personal-data-retention','0 18 * * *','select private.purge_personal_links()');
