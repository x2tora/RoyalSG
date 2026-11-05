"use client";
import { useState } from "react";
import { addDays, available, dateKey, windowFor, type Slot } from "@/lib/rules";
export default function Calendar({
  slots,
  now,
  readonly,
  onSelect,
}: {
  slots: Slot[];
  now: Date;
  readonly: boolean;
  onSelect: (day: string) => void;
}) {
  const range = windowFor(now),
    [offset, setOffset] = useState(0);
  const first = new Date(range.today.slice(0, 7) + "-01T00:00:00Z");
  first.setUTCMonth(first.getUTCMonth() + offset);
  const start = dateKey(first),
    count = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
  return (
    <section className="calendar" aria-label="예약 캘린더">
      <div className="calendar-title">
        <button
          aria-label="이전 달"
          disabled={offset <= -1}
          onClick={() => setOffset(offset - 1)}
        >
          ‹
        </button>
        <h2 key={start}>
          {first.getUTCFullYear()}년 {first.getUTCMonth() + 1}월
        </h2>
        <button
          aria-label="다음 달"
          disabled={offset >= 2}
          onClick={() => setOffset(offset + 1)}
        >
          ›
        </button>
      </div>
      <div className="weekdays">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {Array.from({ length: first.getUTCDay() }, (_, i) => (
          <span key={"empty" + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const day = addDays(start, i),
            slot = slots.find((s) => s.rental_date === day),
            can = available(day, now) && !slot;
          const label = slot
            ? slot.status === "blocked"
              ? "운영 제한"
              : `${slot.machine}기체 ${slot.people}인 · ${slot.status === "pending" ? "대기" : "확정"}`
            : can
              ? "예약 가능"
              : "예약 불가";
          return (
            <button
              key={day}
              className={`day ${slot ? "occupied" : ""} ${day === range.today ? "today" : ""}`}
              disabled={readonly || !can}
              aria-label={`${day} ${label}`}
              onClick={() => onSelect(day)}
            >
              <span>{i + 1}</span>
              {slot ? (
                <small>
                  {slot.status === "blocked" ? (
                    "운영 제한"
                  ) : (
                    <>
                      {slot.machine}기체
                      <br />
                      {slot.people}인{" "}
                      <b>{slot.status === "pending" ? "대기" : "확정"}</b>
                    </>
                  )}
                </small>
              ) : (
                <i aria-hidden="true">{can ? "●" : ""}</i>
              )}
            </button>
          );
        })}
      </div>
      <div className="legend">
        <span>● 예약 가능</span>
        <span>■ 신청·운영 제한</span>
      </div>
      <p className="caption">
        {readonly
          ? "일정 조회 전용입니다."
          : "날짜를 선택해 기체와 인원을 정해 주세요."}
        <br />
        예약 가능 범위 {range.min} ~ {range.max} · 매일 21시 갱신
      </p>
    </section>
  );
}
