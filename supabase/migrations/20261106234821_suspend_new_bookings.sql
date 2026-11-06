-- Pause new reservations without altering existing booking records.
create or replace function private.create_booking(p_date date,p_machine text,p_people integer)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform private.require_user();
 raise exception '대여 시스템이 잠정 중단되어 현재 실제 예약을 받지 않습니다.';
end $$;
