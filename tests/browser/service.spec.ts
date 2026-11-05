import { test, expect } from "@playwright/test";
test("공개 홈, 테마 저장, 인트로 및 캘린더", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Google로 로그인" }),
  ).toBeVisible();
  await expect(page.locator(".shell")).toHaveClass(/intro-play/);
  await page.getByLabel("테마 설정").click();
  await page.getByLabel("화면 모드").selectOption("dark");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.colorScheme))
    .toBe("dark");
  await page.reload();
  await expect(page.locator(".shell")).toHaveClass(/intro-done/);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.colorScheme))
    .toBe("dark");
  await page.getByRole("button", { name: /예약 조회/ }).click();
  await expect(page.getByRole("region", { name: "예약 캘린더" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /\d{4}-\d{2}-\d{2}/ }).first(),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("서버에서 외부 출처 및 비로그인 요청을 차단한다", async ({ request }) => {
  const state = await (await request.get("/api/service")).json();
  expect(
    (
      await request.post("/api/service", {
        headers: { origin: "https://invalid.example" },
        data: { action: "delete", phone: "010-1234-5678" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/service", {
        headers: { origin: "http://localhost:3000" },
        data: { action: "delete", phone: "010-1234-5678" },
      })
    ).status(),
  ).toBe(state.configured ? 401 : 503);
});
test("개인정보 처리방침과 외부 링크", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "RoyalSangGu", exact: true }),
  ).toHaveAttribute("href", "https://x.com/Royalsanggu_Mai");
  await page
    .getByRole("link", { name: "개인정보 처리방침", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "개인정보 처리방침", exact: true }),
  ).toBeVisible();
});
test("시스템 명암 변경과 수동 테마를 표면 색상까지 반영", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.getByLabel("테마 설정").click();
  await page.getByLabel("화면 모드").selectOption("light");
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--md-sys-color-surface-container")
          .trim(),
      ),
    )
    .toMatch(/^#/);
  const light = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--md-sys-color-surface-container")
      .trim(),
  );
  await page.getByLabel("화면 모드").selectOption("system");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.colorScheme))
    .toBe("dark");
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--md-sys-color-surface-container")
        .trim(),
    ),
  ).not.toBe(light);
  await page.emulateMedia({ colorScheme: "light" });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.colorScheme))
    .toBe("light");
});
