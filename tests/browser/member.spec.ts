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
  await page.route("**/api/service", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: state });
      return;
    }
    const body = route.request().postDataJSON();
    commands.push(body);
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
  await expect(
    page.getByRole("heading", { name: "처음 오셨군요" }),
  ).toBeVisible();
  await page.getByLabel("이름 또는 닉네임").fill("플레이어");
  await page.getByLabel("연락처").fill("01012345678");
  await expect(page.getByLabel("연락처")).toHaveValue("010-1234-5678");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "동의하고 시작하기" }).click();
  await expect(page.getByRole("heading", { name: "플레이어님" })).toBeVisible();
  expect(commands[0]).toMatchObject({ action: "profile", consent: true });
});
test("기체·인원을 선택해 예약 신청", async ({ page }) => {
  const commands = await mock(page, initial());
  await page.getByRole("button", { name: /기기 예약/ }).click();
  await page.getByRole("button", { name: "2026-11-10 예약 가능" }).click();
  await page.getByLabel("대여 기체").selectOption("B");
  await page.getByLabel("이용 인원").selectOption("2");
  await page.getByRole("checkbox").check();
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
