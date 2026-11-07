-- Restore booking functionality while retaining the service notice in the UI.
create or replace function private.create_booking(p_date date,p_machine text,p_people integer) returns uuid language plpgsql security definer set search_path='' as $$
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
