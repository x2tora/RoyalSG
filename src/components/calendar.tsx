"use client";
import { useRef, useState } from "react";
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
  const [direction, setDirection] = useState(0);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  function changeMonth(step: number) {
    const next = offset + step;
    if (next < -1 || next > 2) return;
    setDirection(step);
    setOffset(next);
  }
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
        </button>
        <h2 key={start}>
          {first.getUTCFullYear()}년 {first.getUTCMonth() + 1}월
        </h2>
        <button
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
        </button>
      </div>
      <div className="weekdays">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div
        key={start}
        className={`calendar-grid month-${direction > 0 ? "next" : direction < 0 ? "previous" : "initial"}`}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          suppressClick.current = false;
          gesture.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          const from = gesture.current;
          if (!from) return;
          const dx = event.clientX - from.x;
          const dy = event.clientY - from.y;
          if (Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            suppressClick.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        }}
        onPointerUp={(event) => {
          const from = gesture.current;
          gesture.current = null;
          if (!from) return;
          const dx = event.clientX - from.x;
          if (
            Math.abs(dx) >= 48 &&
            Math.abs(dx) > Math.abs(event.clientY - from.y) * 1.5
          )
            changeMonth(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          gesture.current = null;
        }}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {Array.from({ length: first.getUTCDay() }, (_, i) => (
          <span key={"empty" + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const day = addDays(start, i),
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
              className={`day ${state} ${day === range.today ? "today" : ""}`}
              disabled={readonly || !can}
              aria-label={`${day} ${status}${detail ? ` ${detail}` : ""}`}
              onClick={() => onSelect(day)}
            >
              <span>{i + 1}</span>
              <span className="day-status">{status}</span>
              {detail ? <span className="day-detail">{detail}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="legend" aria-label="캘린더 상태 안내">
        {[
          ["available", "예약 가능", "날짜를 선택해 신청"],
          ["restricted", "예약 제한", "운영일·신청 범위 외 또는 차단"],
          ["pending", "대기", "신청 접수 · 관리자 승인 전"],
          ["confirmed", "확정", "관리자 승인 완료"],
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
