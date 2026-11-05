import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import {
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  describe,
  it,
  expect,
} from "vitest";
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002",
  admin = "10000000-0000-4000-8000-000000000003";
let db: PGlite;
async function login(id = a) {
  await db.exec(
    `reset role; select set_config('request.jwt.claims','{"sub":"${id}","session_id":"${id}"}',false);set role authenticated;`,
  );
}
async function time(value: string) {
  await db.query("select set_config('test.time',$1,false)", [value]);
}
async function scalar(sql: string) {
  return (await db.query<Record<string, unknown>>(sql)).rows[0];
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema test;
 create function test.now() returns timestamptz language sql stable as $$select current_setting('test.time')::timestamptz$$;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade,not_after timestamptz);
 create table auth.identities(user_id uuid references auth.users on delete cascade,provider text,identity_data jsonb);
 create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 grant usage on schema auth to anon,authenticated;grant execute on all functions in schema auth to anon,authenticated;
 select set_config('test.time','2026-11-05T21:00:00+09:00',false);`);
  for (const name of readdirSync("supabase/migrations").sort()) {
    const sql = readFileSync("supabase/migrations/" + name, "utf8")
      .replace(/create extension if not exists pg_cron;/g, "")
      .replace(/select cron.schedule\([^;]+;/g, "")
      .replace(/\bnow\(\)/g, "test.now()");
    await db.exec(sql);
  }
}, 30000);
beforeEach(async () => {
  await db.exec(
    "reset role;truncate public.bookings,public.profiles,public.date_blocks,private.admins,auth.users cascade;",
  );
  await time("2026-11-05T21:00:00+09:00");
  for (const [id, email] of [
    [a, "a@example.com"],
    [b, "b@example.com"],
    [admin, "xitora.works@gmail.com"],
  ]) {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,test.now())",
      [id, email],
    );
    await db.query("insert into auth.sessions(id,user_id) values($1,$1)", [id]);
    await db.query(
      `insert into auth.identities values($1,'google',jsonb_build_object('email',$2::text,'email_verified',true))`,
      [id, email],
    );
    await login(id);
    await db.exec(
      "select public.save_profile('테스트','010-1234-5678',true,'2026-11-05');reset role;",
    );
  }
  await login(a);
});
afterEach(async () => {
  await db.exec("reset role;");
});
afterAll(async () => {
  await db?.close();
});
describe("실제 마이그레이션 PostgreSQL 동작", () => {
  it("승인 대기는 5일 이내에도 취소하고 날짜·개인 한도를 해제", async () => {
    const result = await scalar(
      "select public.create_booking('2026-11-08','A',1) as id",
    );
    await db.query("select public.cancel_pending_booking($1)", [result?.id]);
    expect(await scalar("select status,active from public.bookings")).toEqual({
      status: "cancelled",
      active: false,
    });
    await db.exec("select public.create_booking('2026-11-09','B',2)");
    await login(b);
    await db.exec("select public.create_booking('2026-11-08','C',1)");
  });
  it("타인 및 승인된 예약의 직접 취소를 차단", async () => {
    const result = await scalar(
      "select public.create_booking('2026-11-08','A',1) as id",
    );
    await login(b);
    await expect(
      db.query("select public.cancel_pending_booking($1)", [result?.id]),
    ).rejects.toThrow("본인의 진행 중인 승인 대기");
    await login(admin);
    await db.query("select public.review_booking($1,'confirmed')", [
      result?.id,
    ]);
    await login(a);
    await expect(
      db.query("select public.cancel_pending_booking($1)", [result?.id]),
    ).rejects.toThrow("본인의 진행 중인 승인 대기");
    expect((await scalar("select status from public.bookings"))?.status).toBe(
      "confirmed",
    );
  });
  it("사용자가 먼저 취소한 예약은 관리자 승인으로 되살릴 수 없다", async () => {
    const result = await scalar(
      "select public.create_booking('2026-11-08','A',1) as id",
    );
    await db.query("select public.cancel_pending_booking($1)", [result?.id]);
    await login(admin);
    await expect(
      db.query("select public.review_booking($1,'confirmed')", [result?.id]),
    ).rejects.toThrow("진행 중인 예약이 아닙니다");
  });
  it("가입 미완료 계정 취소 시 본인 계정과 모든 세션을 삭제", async () => {
    await db.exec(
      `reset role; delete from public.profiles where id='${a}'; set role authenticated;`,
    );
    await db.exec("select public.cancel_signup();reset role;");
    expect(
      (
        await scalar(
          `select count(*)::integer as count from auth.users where id='${a}'`,
        )
      )?.count,
    ).toBe(0);
    expect(
      (
        await scalar(
          `select count(*)::integer as count from auth.sessions where user_id='${a}'`,
        )
      )?.count,
    ).toBe(0);
    expect(
      (
        await scalar(
          `select count(*)::integer as count from auth.identities where user_id='${a}'`,
        )
      )?.count,
    ).toBe(0);
    expect(
      (await scalar("select count(*)::integer as count from auth.users"))
        ?.count,
    ).toBe(2);
    await login(a);
    await expect(
      db.exec(
        "select public.save_profile('테스트','010-1234-5678',true,'2026-11-05')",
      ),
    ).rejects.toThrow("로그인이 필요");
  });
  it("기존 회원은 가입 취소로 탈퇴 제한을 우회할 수 없다", async () => {
    await db.exec("select public.create_booking('2026-11-08','A',1)");
    await expect(db.exec("select public.cancel_signup()")).rejects.toThrow(
      "이미 가입이 완료",
    );
    expect(
      (await scalar("select count(*)::integer as count from public.profiles"))
        ?.count,
    ).toBe(1);
    expect(
      (await scalar("select count(*)::integer as count from public.bookings"))
        ?.count,
    ).toBe(1);
  });
  it("Google 이외의 계정과 폐기된 세션 요청을 차단", async () => {
    await db.exec(
      `reset role; delete from auth.identities where user_id='${a}'; set role authenticated;`,
    );
    await expect(
      db.exec("select public.create_booking('2026-11-08','A',1)"),
    ).rejects.toThrow("Google 계정");
    await db.exec(
      `reset role; delete from auth.sessions where user_id='${a}'; set role authenticated;`,
    );
    await expect(
      db.exec("select public.delete_account('010-1234-5678')"),
    ).rejects.toThrow("로그인이 필요");
    expect(
      (await scalar("select count(*)::integer as count from public.profiles"))
        ?.count,
    ).toBe(0);
  });
  it("21시 공개, 요일, 당일 및 범위 검증", async () => {
    await time("2026-11-05T20:59:59+09:00");
    await expect(
      db.exec("select public.create_booking('2026-11-19','A',1)"),
    ).rejects.toThrow("예약 가능한 날짜");
    await time("2026-11-05T21:00:00+09:00");
    for (const day of ["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-22"])
      await expect(
        db.exec(`select public.create_booking('${day}','A',1)`),
      ).rejects.toThrow("예약 가능한 날짜");
    await db.exec("select public.create_booking('2026-11-19','B',2)");
    expect((await scalar("select price from public.bookings"))?.price).toBe(
      35000,
    );
  });
  it("날짜 전체와 사용자 한도를 선점하고 거절 후 해제", async () => {
    const result = await scalar(
      "select public.create_booking('2026-11-08','A',1) as id",
    );
    await expect(
      db.exec("select public.create_booking('2026-11-09','B',2)"),
    ).rejects.toThrow("1인당 1건");
    await login(b);
    await expect(
      db.exec("select public.create_booking('2026-11-08','C',2)"),
    ).rejects.toThrow("이미 신청");
    await login(admin);
    await db.query("select public.review_booking($1,'rejected')", [result?.id]);
    await login(b);
    await db.exec("select public.create_booking('2026-11-08','C',2)");
  });
  it("4일 전 직접 RPC 탈퇴 차단, 전화번호 검증, 5일 전 자동 취소", async () => {
    await db.exec("select public.create_booking('2026-11-10','A',1)");
    await time("2026-11-06T00:00:00+09:00");
    await expect(
      db.exec("select public.delete_account('010-1234-5678')"),
    ).rejects.toThrow("회원탈퇴가 제한");
    await time("2026-11-05T23:59:59+09:00");
    await expect(
      db.exec("select public.delete_account('010-9999-9999')"),
    ).rejects.toThrow("일치하지");
    await db.exec("select public.delete_account('010-1234-5678');reset role;");
    expect(
      (
        await scalar(
          `select count(*)::integer as count from auth.users where id='${a}'`,
        )
      )?.count,
    ).toBe(0);
    expect(
      await scalar("select user_id,status,active from public.bookings"),
    ).toEqual({ user_id: null, status: "cancelled", active: false });
    expect(
      (
        await scalar(
          `select count(*)::integer as count from auth.sessions where user_id='${a}'`,
        )
      )?.count,
    ).toBe(0);
  });
  it("확정 예약도 이용 중 차단, 종료 정각 해제", async () => {
    const result = await scalar(
      "select public.create_booking('2026-11-10','A',1) as id",
    );
    await login(admin);
    await db.query("select public.review_booking($1,'confirmed')", [
      result?.id,
    ]);
    await login(a);
    await time("2026-11-11T04:59:59+09:00");
    await expect(
      db.exec("select public.delete_account('010-1234-5678')"),
    ).rejects.toThrow("회원탈퇴가 제한");
    await time("2026-11-11T05:00:00+09:00");
    await db.exec("select public.delete_account('010-1234-5678')");
  });
  it("관리자·타인 개인정보 접근 및 직접 쓰기를 차단", async () => {
    expect(
      (await scalar("select count(*)::integer as count from public.profiles"))
        ?.count,
    ).toBe(1);
    expect((await scalar("select public.is_admin() as admin"))?.admin).toBe(
      false,
    );
    await expect(db.exec("select public.admin_dashboard()")).rejects.toThrow(
      "관리자 권한",
    );
    await expect(
      db.exec("update public.profiles set name='다른 이름'"),
    ).rejects.toThrow("permission denied");
    await expect(db.exec("select * from private.admins")).rejects.toThrow(
      "permission denied",
    );
  });
  it("운영 차단·해제와 취소 후 탈퇴 제한 해제", async () => {
    await login(admin);
    await db.exec("select public.set_date_block('2026-11-10',true)");
    await login(a);
    await expect(
      db.exec("select public.create_booking('2026-11-10','A',1)"),
    ).rejects.toThrow("운영이 제한");
    await login(admin);
    await db.exec("select public.set_date_block('2026-11-10',false)");
    await login(a);
    const result = await scalar(
      "select public.create_booking('2026-11-10','A',1) as id",
    );
    await login(admin);
    await expect(
      db.exec("select public.set_date_block('2026-11-10',true)"),
    ).rejects.toThrow("기존 예약");
    await time("2026-11-09T12:00:00+09:00");
    await db.query("select public.review_booking($1,'cancelled')", [
      result?.id,
    ]);
    await login(a);
    await db.exec("select public.delete_account('010-1234-5678')");
  });
  it("종료 후 새 예약과 90일 개인정보 연결 파기", async () => {
    await db.exec("select public.create_booking('2026-11-08','A',1)");
    await time("2026-11-09T05:00:00+09:00");
    await db.exec("select public.create_booking('2026-11-10','B',1)");
    await db.exec("reset role;");
    await time("2027-02-09T06:00:00+09:00");
    await db.exec("select private.purge_personal_links()");
    expect(
      (
        await scalar(
          "select count(*)::integer as count from public.bookings where user_id is not null",
        )
      )?.count,
    ).toBe(0);
  });
  it("공개 일정에는 개인정보가 없고 비로그인 쓰기를 차단", async () => {
    await db.exec(
      "select public.create_booking('2026-11-08','A',1);reset role;set role anon;",
    );
    expect(
      Object.keys((await scalar("select * from public.calendar_slots()"))!),
    ).toEqual(["rental_date", "machine", "people", "status"]);
    await expect(db.exec("select * from public.profiles")).rejects.toThrow(
      "permission denied",
    );
    await expect(
      db.exec("select public.delete_account('010-1234-5678')"),
    ).rejects.toThrow("permission denied");
  });
});
