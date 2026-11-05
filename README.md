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
- 취소는 예약일 5일 전까지 카카오 문의. 관리자가 취소 처리.
- 예약일 5일 전까지 탈퇴 가능. 4일 전부터 실제 이용 종료 전까지 진행 예약이 있으면 탈퇴 차단.
- 탈퇴 시 전화번호 재입력·최종 확인, 진행 예약 자동 취소, Auth 사용자·세션·프로필·예약 개인 연결정보 삭제.
- 회원가입 완료 전에는 가입 취소 확인 후 가입 대기 계정과 세션을 삭제하고 비로그인 홈으로 돌아갑니다. 가입 완료 계정은 이 기능을 사용할 수 없습니다.

## Supabase

신규 운영 프로젝트: `ugmoisarxveuyuvhnhqi` / 서울(`ap-northeast-2`).

`supabase/migrations`를 순서대로 적용합니다. 운영 프로젝트에는 적용되어 있습니다. 공개 API는 `public` 스키마의 invoker RPC이며, 권한이 필요한 구현은 미노출 `private` 스키마에 있습니다. 클라이언트의 테이블 직접 쓰기는 허용하지 않습니다.

예약 생성·관리자 처리·탈퇴·만료 처리에 같은 PostgreSQL 트랜잭션 advisory lock을 사용합니다. `active` 예약의 날짜·회원 유일 인덱스로 중복을 추가 방지합니다. 이용 완료는 다음날 05시 기준으로, 새 요청과 일일 작업에서 한도를 해제합니다.

관리자는 Google이 검증한 identity의 이메일이 `xitora.works@gmail.com`인 계정이 최초 회원정보를 저장할 때 부여됩니다. 사용자 수정 가능 메타데이터는 권한 판정에 사용하지 않습니다.

`pg_cron`은 매일 한국 시간 03시에 실제 이용 종료 후 90일이 지난 예약의 `user_id`를 제거합니다. `private.admins`·`date_blocks`의 RLS 무정책 안내는 직접 접근을 차단하려는 의도입니다.

### Google 로그인 활성화

1. Google Cloud에서 웹 OAuth 클라이언트를 생성합니다.
2. 승인된 리디렉션 URI: `https://ugmoisarxveuyuvhnhqi.supabase.co/auth/v1/callback`.
3. Supabase Authentication → Providers → Google에 Client ID·Secret을 직접 저장합니다.
4. Supabase URL Configuration의 Site URL은 `https://royalsg.xitora.cc`, Redirect URLs는 `https://royalsg.xitora.cc/auth/callback`으로 설정합니다. 개발은 `http://localhost:3000/auth/callback`을 추가합니다.
5. Google 로그인이 비활성화되어 있으면 로그인 시작 시 설정 안내를 표시합니다.

비밀키는 브라우저·GitHub에 저장하지 않습니다. 앱은 publishable key와 사용자 세션만 사용하며 service role 키가 필요하지 않습니다.

## Vercel·GitHub

저장소: `xitora/RoyalSG`, Vercel: `x1t0ra/royalsg`.

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
