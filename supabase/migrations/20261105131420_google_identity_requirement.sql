create or replace function private.require_user() returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not private.session_active() then raise exception '로그인이 필요합니다.'; end if;
 if not exists(select 1 from auth.identities where user_id=auth.uid() and provider='google' and identity_data->>'email_verified'='true') then
  raise exception '인증된 Google 계정으로 로그인해 주세요.';
 end if;
 return auth.uid();
end $$;
