"use client";
import { useEffect, useRef, useState } from "react";
import { addDays, CONTACT } from "@/lib/rules";
import { Md, Select, Checkbox } from "./material";

export default function BookingForm({
  date,
  busy,
  error,
  onSubmit,
}: {
  date: string;
  busy: boolean;
  error: string;
  onSubmit: (machine: string, people: number) => void;
}) {
  const [machine, setMachine] = useState("A");
  const [people, setPeople] = useState(1);
  const toggling = useRef(false);
  const [selectionChanged, setSelectionChanged] = useState(false);
  const agreementsRef = useRef<HTMLDetailsElement>(null);
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [agreed, setAgreed] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);
  const items = [
    {
      title: "이용일 및 시간",
      description: `예약 날짜는 ${date}이며, 실제 이용은 ${addDays(date, 1)} 00:00~05:00입니다.\n예약 날짜에서 다음날로 넘어가는 자정에 시작합니다.`,
    },
    {
      title: "기체·인원 및 가격",
      description: `${machine}기체 · ${people}인 · ${(people === 1 ? 25000 : 35000).toLocaleString()}원입니다.\n온라인 결제는 없으며, 결제 관련 사항은 운영자에게 문의해 주세요.`,
    },
    {
      title: "취소 제한",
      description: `승인 대기 중에는 직접 취소할 수 있습니다.\n확정 후에는 예약 날짜 5일 전인 ${addDays(date, -5)}까지 카카오 1:1 문의로 취소를 요청해 주세요.`,
    },
    {
      title: "회원탈퇴 제한",
      description: `${addDays(date, -4)}부터 실제 이용이 끝나는 ${addDays(date, 1)} 05:00 전까지 승인 대기·확정 예약이 있으면 탈퇴할 수 없습니다.\n탈퇴 가능한 기간에 탈퇴하면 진행 예약은 자동 취소됩니다.`,
    },
    {
      title: "예약 승인 및 운영 방식",
      description:
        "관리자 승인 후 확정되며, 승인 대기 중에도 해당 날짜와 1인 1건 한도를 차지합니다.\n하루 한 기체를 FREE PLAY로 운영합니다.\n시범 운영 중으로 세부 내용이 변경될 수 있습니다.",
    },
  ];
  const allAgreed = agreed.every(Boolean);
  function resetAgreements() {
    setAgreed(agreed.map(() => false));
    setSelectionChanged(true);
    clearTimeout(autoCloseTimer.current);
    const details = agreementsRef.current;
    if (details && !details.open) details.querySelector("summary")?.click();
  }
  useEffect(() => {
    if (!allAgreed) return;
    autoCloseTimer.current = setTimeout(() => {
      const details = agreementsRef.current;
      if (!details?.open) return;
      const summary = details.querySelector("summary");
      if (details.contains(document.activeElement))
        summary?.focus({ preventScroll: true });
      summary?.click();
    }, 400);
    return () => clearTimeout(autoCloseTimer.current);
  }, [allAgreed]);
  return (
    <>
      <p className="date-display">{date}</p>
      <p className="caption">실제 이용: {addDays(date, 1)} 00:00~05:00</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (allAgreed && !busy) onSubmit(machine, people);
        }}
      >
        <Select
          label="대여 기체"
          value={machine}
          disabled={busy}
          onValue={(value) => {
            setMachine(value);
            resetAgreements();
          }}
          options={["A", "B", "C"].map((value) => ({
            value,
            label: `${value} 기체`,
          }))}
        />
        <Select
          label="이용 인원"
          value={String(people)}
          disabled={busy}
          onValue={(value) => {
            setPeople(Number(value));
            resetAgreements();
          }}
          options={[
            { value: "1", label: "1인 · 25,000원" },
            { value: "2", label: "2인 · 35,000원" },
          ]}
        />
        <details className="booking-agreements" ref={agreementsRef}>
          <summary
            onClick={async (event) => {
              event.preventDefault();
              clearTimeout(autoCloseTimer.current);
              if (toggling.current) return;
              const details = event.currentTarget
                .parentElement as HTMLDetailsElement;
              const list =
                details.querySelector<HTMLElement>(".agreement-list")!;
              const opening = !details.open;
              if (
                matchMedia("(prefers-reduced-motion: reduce)").matches ||
                document.documentElement.dataset.lowVision === "true"
              ) {
                details.open = opening;
                return;
              }
              toggling.current = true;
              const startHeight = details.getBoundingClientRect().height;
              if (opening) details.open = true;
              const endHeight = opening
                ? details.getBoundingClientRect().height
                : event.currentTarget.getBoundingClientRect().height +
                  details.offsetHeight -
                  details.clientHeight;
              details.style.overflow = "hidden";
              const expansion = details.animate(
                [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
                {
                  duration: 360,
                  easing: "cubic-bezier(0.2, 0, 0, 1)",
                  fill: "forwards",
                },
              );
              const animation = list.animate(
                [{ opacity: opening ? 0 : 1 }, { opacity: opening ? 1 : 0 }],
                {
                  duration: opening ? 300 : 180,
                  easing: "ease",
                  fill: "forwards",
                },
              );
              try {
                await Promise.all([expansion.finished, animation.finished]);
              } catch {}
              if (!opening) details.open = false;
              expansion.cancel();
              animation.cancel();
              details.style.removeProperty("overflow");
              toggling.current = false;
            }}
          >
            {allAgreed ? "이용 안내 동의 완료" : "이용 안내 확인 및 동의"}{" "}
            <span>
              {agreed.filter(Boolean).length}/{items.length}
            </span>
          </summary>
          <div className="agreement-list" style={{ animation: "none" }}>
            {items.map((item, index) => (
              <label className="agreement-item" key={item.title}>
                <Checkbox
                  label={`${item.title} 동의`}
                  required
                  checked={agreed[index]}
                  disabled={busy}
                  onChecked={(checked) =>
                    setAgreed(
                      agreed.map((value, position) =>
                        position === index ? checked : value,
                      ),
                    )
                  }
                />
                <span>
                  <strong>{item.title} 동의</strong>
                  <span className="agreement-description">
                    {item.description.split("\n").map((paragraph) => (
                      <span key={paragraph}>{paragraph}</span>
                    ))}
                  </span>
                </span>
              </label>
            ))}
            <a href={CONTACT} target="_blank" rel="noreferrer">
              카카오 1:1 문의
            </a>
          </div>
        </details>
        <p className="caption agreement-status" role="status">
          {allAgreed
            ? "모든 이용 안내에 동의했습니다."
            : selectionChanged
              ? "선택이 변경되어 이용 안내를 다시 확인해 주세요."
              : "이용 안내를 펼쳐 모든 항목에 동의해 주세요."}
        </p>
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
        <Md type="submit" disabled={busy || !allAgreed}>
          {busy ? "신청 중…" : "예약 신청"}
        </Md>
      </form>
    </>
  );
}
