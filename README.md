# 로얄상구 기기 예약

Next.js 16 · React 19 · TypeScript · Material Web · Supabase.

## 로컬 실행

```powershell
npm ci
Copy-Item .env.example .env.local
# .env.local에 해당 환경의 Supabase URL·publishable key·사이트 URL 입력
npm run dev
```

데이터베이스가 연결되지 않으면 연결 준비 상태를 표시합니다. 예시 예약을 실제 데이터처럼 표시하지 않습니다.

## 예약 규칙

- 시간대: Asia/Seoul. 예약 날짜 기준 일~목 운영, 다음날 00:00~05:00 이용.
- 당일 신청 불가. 21시 전 내일~13일 뒤, 21시부터 내일~14일 뒤 신청 가능.
- A/B/C 중 하루 한 기체. 승인 대기와 확정 모두 날짜 전체와 개인 1건 한도를 선점.
- 1인 25,000원 / 2인 35,000원. 결제는 서비스 밖에서 처리.
- 승인 대기 예약은 본인이 직접 취소할 수 있으며 5일 전 제한을 적용하지 않습니다. 취소 즉시 날짜와 개인 예약 한도를 해제합니다. 확정 예약은 예약일 5일 전까지 카카오 문의로 취소를 요청합니다.
- 예약일 5일 전까지 탈퇴 가능. 4일 전부터 실제 이용 종료 전까지 진행 예약이 있으면 탈퇴 차단.
- 탈퇴 시 전화번호 재입력·최종 확인, 진행 예약 자동 취소, Auth 사용자·세션·프로필·예약 개인 연결정보 삭제.
- 회원가입 완료 전에는 가입 취소 확인 후 가입 대기 계정과 세션을 삭제하고 비로그인 홈으로 돌아갑니다. 가입 완료 계정은 이 기능을 사용할 수 없습니다.

## Supabase

신규 운영 프로젝트: `ugmoisarxveuyuvhnhqi` / 서울(`ap-northeast-2`).

`supabase/migrations`를 순서대로 적용합니다. 운영 프로젝트에는 적용되어 있습니다. 공개 API는 `public` 스키마의 invoker RPC이며, 권한이 필요한 구현은 미노출 `private` 스키마에 있습니다. 클라이언트의 테이블 직접 쓰기는 허용하지 않습니다.

예약 생성·관리자 처리·탈퇴·만료 처리에 같은 PostgreSQL 트랜잭션 advisory lock을 사용합니다. `active` 예약의 날짜·회원 유일 인덱스로 중복을 추가 방지합니다. 이용 완료는 다음날 05시 기준으로, 새 요청과 일일 작업에서 한도를 해제합니다.

관리자 권한은 `private.admins` 테이블로 관리합니다. 기존 관리자는 유지하며, 회원정보 저장으로 권한이 자동 부여되거나 복구되지 않습니다. 추가 대상은 먼저 Google 로그인과 회원가입을 완료해야 합니다. 아래 SQL은 Supabase SQL Editor에서 실행합니다. 일반 회원의 API에는 관리자 변경 권한을 부여하지 않습니다.

현재 관리자 조회:

```sql
select u.id, u.email
from private.admins a join auth.users u on u.id = a.user_id
order by u.email;
```

관리자 추가 (`admin@example.com`을 대상 Google 이메일로 변경):

```sql
insert into private.admins (user_id)
select u.id
from auth.users u
join public.profiles p on p.id = u.id
where lower(u.email) = lower('admin@example.com')
  and u.email_confirmed_at is not null
  and exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'google'
      and lower(i.identity_data->>'email') = lower(u.email)
      and i.identity_data->>'email_verified' = 'true'
  )
on conflict (user_id) do nothing;
```

관리자 제거 (계정·예약은 유지):

```sql
delete from private.admins a
using auth.users u
where a.user_id = u.id and lower(u.email) = lower('admin@example.com');
```

변경 후 조회 SQL로 반영 여부를 확인합니다. 권한은 DB에서 요청마다 검사하므로 제거 즉시 관리자 작업이 차단되며, 화면은 새로고침 또는 다음 자동 조회에 반영됩니다.

`pg_cron`은 매일 한국 시간 03시에 실제 이용 종료 후 90일이 지난 예약의 `user_id`를 제거합니다. `private.admins`·`date_blocks`의 RLS 무정책 안내는 직접 접근을 차단하려는 의도입니다.

### Google 로그인 활성화

1. Google Cloud에서 웹 OAuth 클라이언트를 생성합니다.
2. 승인된 리디렉션 URI: `https://ugmoisarxveuyuvhnhqi.supabase.co/auth/v1/callback`.
3. Supabase Authentication → Providers → Google에 Client ID·Secret을 직접 저장합니다.
4. Supabase URL Configuration의 Site URL은 `https://royalsg.xitora.cc`, Redirect URLs는 `https://royalsg.xitora.cc/auth/callback`으로 설정합니다. 개발은 `http://localhost:3000/auth/callback`을 추가합니다.
5. Google 로그인이 비활성화되어 있으면 로그인 시작 시 설정 안내를 표시합니다.

비밀키는 브라우저·GitHub에 저장하지 않습니다. 앱은 publishable key와 사용자 세션만 사용하며 service role 키가 필요하지 않습니다.

## Vercel·GitHub

화면은 `/`(홈), `/signup`(회원가입), `/mypage`(마이페이지), `/reserve`(기기 예약), `/reserve/YYYY-MM-DD`(해당 날짜 신청), `/calendar`(예약 조회), `/admin`(예약 관리)로 나뉩니다. 화면 이동은 브라우저 방문 기록에 추가되며 뒤로가기로 이전 화면에 돌아갈 수 있습니다. 로그인과 권한이 필요한 페이지는 직접 접속하더라도 계정 상태에 따라 이동합니다.

저장소: `xitora/RoyalSG`, Vercel: `x1t0ra/royalsg`.

루트 레이아웃의 `@vercel/speed-insights/next`로 모든 페이지의 웹 성능을 측정합니다. 수집 결과는 Vercel 프로젝트의 Speed Insights에서 확인합니다.

운영 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.

운영 브랜치는 `main`, 그 외 브랜치는 Preview로 배포합니다. Preview에 운영 DB 환경변수를 복사하지 않습니다. 개발 Supabase를 별도 구성하기 전 Preview는 연결 준비 상태로 표시합니다. 마이그레이션은 웹 배포에서 자동 실행하지 않습니다.

GitHub Actions는 린트·PostgreSQL 규칙 테스트·빌드·타입 검사를 실행합니다. Vercel Git 연동이 배포를 담당합니다.

## 검증

```powershell
npm run lint
npm test
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

`tests/database.test.ts`는 실제 마이그레이션을 PGlite PostgreSQL에 적용하고 Auth 테이블·세션을 최소 형태로 구성해 검증합니다. 시각만 테스트용으로 치환합니다. PGlite는 단일 연결이므로 실제 다중 연결 부하 시험을 대체하지 않습니다.

브라우저 회원 흐름은 API 응답을 모의하여 검증하고, 공개 조회·비로그인 차단은 실제 로컬 API로 검증합니다. 실제 Google 로그인은 Provider 설정 후 별도 검증해야 합니다.

`supabase/tests/live-smoke.sql`은 배포된 데이터베이스에서 예약·탈퇴 제한·권한·실제 계정 삭제를 검증하고 전체 테스트 데이터를 롤백합니다.

폰트는 자체 호스팅하며 라이선스는 `public/fonts`에 포함합니다.

## PWA 설치

- 앱 이름·아이콘·standalone manifest와 서비스 워커를 제공합니다. 서비스 워커는 연결 안내와 로고만 캐시하고 회원정보·예약 API·로그인 콜백은 캐시하지 않습니다.
- 설치 가능한 Chromium 브라우저는 `beforeinstallprompt` 이후 첫 방문 설치 안내를 한 번 표시합니다. 닫아도 하단 앱 설치 버튼으로 다시 설치할 수 있습니다.
- iPhone·iPad Safari는 공유 메뉴의 홈 화면 추가 방법을 안내합니다. 지원 여부가 확인되지 않는 브라우저에는 설치 권장을 띄우지 않습니다.
- 앱 실행 모드, `appinstalled`, 지원 브라우저의 `getInstalledRelatedApps()`로 확인되면 ‘설치됨’을 표시합니다. Safari 일반 탭 등 설치 여부 조회가 지원되지 않는 환경에서는 다른 실행 환경의 설치 여부를 확정할 수 없습니다.

## Material 3 구성

버튼·입력창·선택창·체크박스는 Material Web을 사용합니다. 팝업은 네이티브 dialog의 초점·모달 동작을 유지하며 Material 3 색상·형태·여백을 적용합니다. 자체 캘린더와 운영 날짜 입력은 모바일 및 키보드 사용성을 유지하도록 구성합니다. Google 로그인 버튼은 Google 브랜드 규격의 흰색 배경을 유지합니다.
