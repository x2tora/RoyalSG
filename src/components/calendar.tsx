"use client";
import { Md } from "./material";
import { useEffect, useRef, useState } from "react";
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
  const viewport = useRef<HTMLDivElement>(null);
  const currentOffset = useRef(offset);
  useEffect(() => {
    currentOffset.current = offset;
  }, [offset]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const resize = new ResizeObserver(() => {
      element.scrollLeft = element.clientWidth * (currentOffset.current + 1);
    });
    resize.observe(element);
    return () => resize.disconnect();
  }, []);
  function changeMonth(step: number) {
    const next = offset + step;
    if (next < -1 || next > 2) return;
    const element = viewport.current;
    element?.scrollTo({
      left: element.clientWidth * (next + 1),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  const first = new Date(range.today.slice(0, 7) + "-01T00:00:00Z");
  first.setUTCMonth(first.getUTCMonth() + offset);
  const start = dateKey(first);
  return (
    <section className="calendar" aria-label="예약 캘린더">
      <div className="calendar-title">
        <Md
          kind="outlined-icon-button"
          type="button"
          aria-label="이전 달"
          disabled={offset <= -1}
          onClick={() => changeMonth(-1)}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m14 6-6 6 6 6" />
          </svg>
        </Md>
        <h2 key={start}>
          {first.getUTCFullYear()}년 {first.getUTCMonth() + 1}월
        </h2>
        <Md
          kind="outlined-icon-button"
          type="button"
          aria-label="다음 달"
          disabled={offset >= 2}
          onClick={() => changeMonth(1)}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m10 6 6 6-6 6" />
          </svg>
        </Md>
      </div>
      <div className="weekdays">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div
        className="calendar-months"
        ref={viewport}
        onScroll={(event) => {
          const element = event.currentTarget;
          setOffset(
            Math.max(
              -1,
              Math.min(
                2,
                Math.round(element.scrollLeft / element.clientWidth) - 1,
              ),
            ),
          );
        }}
      >
        {[-1, 0, 1, 2].map((monthOffset) => {
          const month = new Date(range.today.slice(0, 7) + "-01T00:00:00Z");
          month.setUTCMonth(month.getUTCMonth() + monthOffset);
          const monthStart = dateKey(month);
          const count = new Date(
            Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
          ).getUTCDate();
          return (
            <div
              className="calendar-grid"
              key={monthStart}
              aria-hidden={offset !== monthOffset}
              inert={offset !== monthOffset}
            >
              {Array.from({ length: month.getUTCDay() }, (_, i) => (
                <span key={"empty" + i} />
              ))}
              {Array.from({ length: count }, (_, i) => {
                const day = addDays(monthStart, i),
                  slot = slots.find((s) => s.rental_date === day),
                  can = available(day, now) && !slot;
                const state =
                  slot?.status === "pending"
                    ? "pending"
                    : slot?.status === "confirmed"
                      ? "confirmed"
                      : can
                        ? "available"
                        : "restricted";
                const status = {
                  available: "예약 가능",
                  restricted: "예약 제한",
                  pending: "대기",
                  confirmed: "확정",
                }[state];
                const detail = slot?.machine
                  ? `${slot.machine} 기체 · ${slot.people}인`
                  : null;
                return (
                  <button
                    key={day}
                    data-calendar-date={day}
                    className={`day ${state} ${day === range.today ? "today" : ""}`}
                    disabled={readonly || !can}
                    aria-label={`${day} ${status}${detail ? ` ${detail}` : ""}`}
                    onClick={() => onSelect(day)}
                  >
                    <Md kind="ripple" disabled={readonly || !can} />
                    <span>{i + 1}</span>
                    <span className="day-status">{status}</span>
                    {detail ? (
                      <span className="day-detail">{detail}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="legend" aria-label="캘린더 상태 안내">
        {[
          ["available", "예약 가능", "예약 가능한 날짜입니다."],
          ["restricted", "예약 제한", "운영일·신청 범위 외 날짜입니다."],
          ["pending", "대기", "승인 대기 상태입니다."],
          ["confirmed", "확정", "승인 완료 상태입니다."],
        ].map(([state, title, description]) => (
          <div className={`legend-item ${state}`} key={state}>
            <span className="legend-swatch" aria-hidden="true" />
            <div>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
          </div>
        ))}
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
