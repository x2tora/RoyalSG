import { test, expect, type Page } from "@playwright/test";
const booking = {
  id: "test-booking",
  rental_date: "2026-11-10",
  machine: "B",
  people: 2,
  price: 35000,
  status: "pending",
};
type Snapshot = {
  configured: boolean;
  user: { avatar: null; profile: null | { name: string; phone: string } };
  slots: unknown[];
  bookings: (typeof booking)[];
  admin: boolean;
  now: string;
  dashboard?: { bookings: (typeof booking)[]; blocks: string[] };
};
function initial(): Snapshot {
  return {
    configured: true,
    user: { avatar: null, profile: { name: "상구", phone: "010-1234-5678" } },
    slots: [],
    bookings: [],
    admin: false,
    now: "2026-11-05T21:00:00+09:00",
  };
}
async function mock(page: Page, state: Snapshot) {
  const commands: Record<string, unknown>[] = [];
  let cancelledSignup = false;
  await page.route("**/api/service", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: cancelledSignup
          ? { ...state, user: null, bookings: [], admin: false }
          : state,
      });
      return;
    }
    const body = route.request().postDataJSON();
    commands.push(body);
    if (body.action === "cancelSignup") cancelledSignup = true;
    if (body.action === "profile")
      state.user.profile = { name: body.name, phone: body.phone };
    if (body.action === "book") {
      state.bookings = [
        {
          ...booking,
          rental_date: body.date,
          machine: body.machine,
          people: body.people,
        },
      ];
    }
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/");
  return commands;
}
test("최초 가입 시 필수 입력 후 홈 이동", async ({ page }) => {
  const state = initial();
  state.user.profile = null;
  const commands = await mock(page, state);
  await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible();
  await page.getByLabel("이름 또는 닉네임").fill("플레이어");
  await page.getByLabel("연락처").fill("01012345678");
  await expect(page.getByLabel("연락처")).toHaveValue("010-1234-5678");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "동의하고 시작하기" }).click();
  await expect(page.getByRole("heading", { name: "플레이어님" })).toBeVisible();
  expect(commands[0]).toMatchObject({ action: "profile", consent: true });
});
test("가입 취소 확인·계속 가입 및 비로그인 홈 복귀", async ({ page }) => {
  const state = initial();
  state.user.profile = null;
  const commands = await mock(page, state);
  await page.getByLabel("이름 또는 닉네임").fill("작성 중");
  await page.getByRole("button", { name: "가입 취소", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "가입을 취소하시겠습니까?" }),
  ).toBeVisible();
  expect(commands).toHaveLength(0);
  await dialog.getByRole("button", { name: "계속 가입하기" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("이름 또는 닉네임")).toHaveValue("작성 중");
  await page.getByRole("button", { name: "가입 취소", exact: true }).click();
  await dialog.getByRole("button", { name: "가입 취소", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Google로 로그인" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "회원가입", exact: true }),
  ).not.toBeVisible();
  expect(commands).toEqual([{ action: "cancelSignup" }]);
});
test("가입 취소 실패 시 확인창과 입력 내용 유지", async ({ page }) => {
  const state = initial();
  state.user.profile = null;
  await page.route("**/api/service", (route) =>
    route.fulfill(
      route.request().method() === "GET"
        ? { json: state }
        : { status: 400, json: { error: "가입 취소에 실패했습니다." } },
    ),
  );
  await page.goto("/");
  await page.getByLabel("이름 또는 닉네임").fill("작성 중");
  await page.getByRole("button", { name: "가입 취소", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "가입 취소", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "가입 취소에 실패했습니다.",
  );
  await dialog.getByRole("button", { name: "계속 가입하기" }).click();
  await expect(page.getByLabel("이름 또는 닉네임")).toHaveValue("작성 중");
});
test("기체·인원을 선택해 예약 신청", async ({ page }) => {
  const commands = await mock(page, initial());
  await page.getByRole("button", { name: /기기 예약/ }).click();
  await page.getByRole("button", { name: "2026-11-10 예약 가능" }).click();
  await page.getByRole("combobox", { name: "대여 기체" }).click();
  await page.getByRole("option", { name: "B 기체", exact: true }).click();
  await page.getByRole("combobox", { name: "이용 인원" }).click();
  await page
    .getByRole("option", { name: "2인 · 35,000원", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "예약 신청", exact: true }),
  ).toBeDisabled();
  await page.locator(".booking-agreements > summary").click();
  await expect(
    page.getByText("예약 날짜는 2026-11-10이며", { exact: false }),
  ).toBeVisible();
  await page.getByRole("checkbox").first().check();
  await expect(
    page.getByRole("button", { name: "예약 신청", exact: true }),
  ).toBeDisabled();
  for (const checkbox of await page.getByRole("checkbox").all())
    await checkbox.check();
  await expect(
    page.getByRole("button", { name: "예약 신청", exact: true }),
  ).toBeEnabled();
  await page.getByRole("combobox", { name: "이용 인원" }).click();
  await page
    .getByRole("option", { name: "1인 · 25,000원", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "예약 신청", exact: true }),
  ).toBeDisabled();
  await page.getByRole("combobox", { name: "이용 인원" }).click();
  await page
    .getByRole("option", { name: "2인 · 35,000원", exact: true })
    .click();
  for (const checkbox of await page.getByRole("checkbox").all())
    await checkbox.check();
  await page.getByRole("button", { name: "예약 신청", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(commands[0]).toMatchObject({
    action: "book",
    date: "2026-11-10",
    machine: "B",
    people: 2,
  });
  await expect(page.getByRole("button", { name: /기기 예약/ })).toBeDisabled();
});
test("예약 내역은 바로 표시하고 더보기로 나머지를 표시", async ({ page }) => {
  const state = initial();
  state.bookings = Array.from({ length: 7 }, (_, index) => ({
    ...booking,
    id: `history-${index}`,
    rental_date: `2026-11-0${4 - (index % 4)}`,
    status: "cancelled",
  }));
  await mock(page, state);
  await expect(page.locator(".history .booking-card")).toHaveCount(5);
  await expect(page.locator(".history .booking-card").first()).toBeVisible();
  await page.getByRole("button", { name: "더 보기 (2건)" }).click();
  await expect(page.locator(".history .booking-card")).toHaveCount(7);
  await expect(page.getByRole("button", { name: /더 보기/ })).toHaveCount(0);
});
test("4일 전 마이페이지에서 탈퇴 차단", async ({ page }) => {
  const state = initial();
  state.now = "2026-11-06T00:00:00+09:00";
  state.bookings = [booking];
  await mock(page, state);
  await page.getByRole("button", { name: "마이페이지" }).click();
  await expect(
    page.getByRole("button", { name: "회원탈퇴", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/이용일 5일 전이 지나/)).toBeVisible();
});
test("5일 전 전화번호와 최종 확인 후 탈퇴 요청", async ({ page }) => {
  const state = initial();
  state.bookings = [booking];
  const commands = await mock(page, state);
  await page.getByRole("button", { name: "마이페이지" }).click();
  await page.getByRole("button", { name: "회원탈퇴", exact: true }).click();
  await page.getByLabel("본인의 등록 전화번호").fill("01012345678");
  await page.getByRole("button", { name: "전화번호 확인" }).click();
  await expect(
    page.getByRole("heading", { name: "정말 탈퇴하시겠습니까?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "확인, 탈퇴합니다" }).click();
  await expect.poll(() => commands.length).toBe(1);
  expect(commands[0]).toMatchObject({
    action: "delete",
    phone: "010-1234-5678",
  });
});
test("관리자 승인 확인과 날짜 차단 처리", async ({ page }) => {
  const state = initial();
  state.admin = true;
  state.dashboard = { bookings: [booking], blocks: [] };
  const commands = await mock(page, state);
  await page.getByRole("button", { name: "관리자", exact: true }).click();
  await page.getByRole("button", { name: "승인", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(commands[0]).toMatchObject({
    action: "review",
    id: booking.id,
    status: "confirmed",
  });
  await page.getByLabel("차단할 예약 날짜").fill("2026-11-12");
  await page.getByRole("button", { name: "차단", exact: true }).click();
  await expect.poll(() => commands.length).toBe(2);
  expect(commands[1]).toMatchObject({
    action: "block",
    date: "2026-11-12",
    blocked: true,
  });
});
