import { describe, it, expect } from "vitest";
import {
  windowFor,
  available,
  blocksDeletion,
  endsAt,
  phoneFormat,
} from "../src/lib/rules";
describe("한국 시간 예약 범위", () => {
  it("21시 정각에 14일 뒤 날짜를 공개한다", () => {
    expect(windowFor(new Date("2026-11-05T20:59:59+09:00"))).toEqual({
      today: "2026-11-05",
      min: "2026-11-06",
      max: "2026-11-18",
    });
    expect(windowFor(new Date("2026-11-05T21:00:00+09:00")).max).toBe(
      "2026-11-19",
    );
  });
  it("한국 자정에 당일을 제외하고 최대 날짜를 유지한다", () => {
    expect(windowFor(new Date("2026-11-06T00:00:00+09:00"))).toEqual({
      today: "2026-11-06",
      min: "2026-11-07",
      max: "2026-11-19",
    });
  });
  it("연말과 윤년 월말을 계산한다", () => {
    expect(windowFor(new Date("2026-12-31T21:00:00+09:00")).max).toBe(
      "2027-01-14",
    );
    expect(windowFor(new Date("2028-02-28T21:00:00+09:00")).min).toBe(
      "2028-02-29",
    );
  });
  it("금토와 당일을 제외하고 예약 날짜 기준 목요일을 허용한다", () => {
    const now = new Date("2026-11-05T21:00:00+09:00");
    expect(available("2026-11-05", now)).toBe(false);
    expect(available("2026-11-06", now)).toBe(false);
    expect(available("2026-11-07", now)).toBe(false);
    expect(available("2026-11-19", now)).toBe(true);
  });
});
describe("탈퇴 경계", () => {
  it.each(["pending", "confirmed"])(
    "5일 전 허용, 4일 전 차단: %s",
    (status) => {
      expect(
        blocksDeletion(
          "2026-11-10",
          status,
          new Date("2026-11-05T23:59:59+09:00"),
        ),
      ).toBe(false);
      expect(
        blocksDeletion(
          "2026-11-10",
          status,
          new Date("2026-11-06T00:00:00+09:00"),
        ),
      ).toBe(true);
    },
  );
  it("이용 중에는 차단하고 05시에 해제한다", () => {
    expect(
      blocksDeletion(
        "2026-11-10",
        "confirmed",
        new Date("2026-11-11T04:59:59+09:00"),
      ),
    ).toBe(true);
    expect(
      blocksDeletion("2026-11-10", "confirmed", endsAt("2026-11-10")),
    ).toBe(false);
  });
  it.each(["cancelled", "rejected"])("%s 예약은 차단하지 않는다", (status) =>
    expect(
      blocksDeletion(
        "2026-11-10",
        status,
        new Date("2026-11-09T12:00:00+09:00"),
      ),
    ).toBe(false),
  );
  it("전화번호 숫자 입력을 서식화한다", () =>
    expect(phoneFormat("01012345678")).toBe("010-1234-5678"));
});
