-- Administrator membership is maintained explicitly in private.admins.
-- Preserve existing members; profile updates never restore removed privileges.
create or replace function private.save_profile(p_name text,p_phone text,p_consent boolean,p_version text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 perform pg_advisory_xact_lock(783021);
 uid:=private.require_user();
 if p_name is null or char_length(trim(p_name)) not between 1 and 30 or p_phone is null or p_phone !~ '^010-[0-9]{4}-[0-9]{4}$' then raise exception '이름과 010 전화번호를 확인해 주세요.'; end if;
 if not exists(select 1 from public.profiles where id=uid) then
  if p_consent is distinct from true or p_version is distinct from '2026-11-05' then raise exception '개인정보 처리방침에 동의해 주세요.'; end if;
  insert into public.profiles(id,name,phone,consent_version) values(uid,trim(p_name),p_phone,p_version);
 else update public.profiles set name=trim(p_name),phone=p_phone where id=uid; end if;
end $$;
