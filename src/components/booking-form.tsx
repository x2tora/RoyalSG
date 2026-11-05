"use client";
import { useState } from "react";
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
      description: `예약 날짜는 ${date}이며, 실제 이용은 ${addDays(date, 1)} 00:00~05:00입니다. 예약 날짜에서 다음날로 넘어가는 자정에 시작합니다.`,
    },
    {
      title: "기체·인원 및 가격",
      description: `${machine}기체 · ${people}인 · ${(people === 1 ? 25000 : 35000).toLocaleString()}원입니다. 온라인 결제는 없으며, 결제 관련 사항은 운영자에게 문의해 주세요.`,
    },
    {
      title: "취소 제한",
      description: `승인 대기 중에는 직접 취소할 수 있습니다. 확정 후에는 예약 날짜 5일 전인 ${addDays(date, -5)}까지 카카오 1:1 문의로 취소를 요청해 주세요.`,
    },
    {
      title: "회원탈퇴 제한",
      description: `${addDays(date, -4)}부터 실제 이용이 끝나는 ${addDays(date, 1)} 05:00 전까지 승인 대기·확정 예약이 있으면 탈퇴할 수 없습니다. 탈퇴 가능한 기간에 탈퇴하면 진행 예약은 자동 취소됩니다.`,
    },
    {
      title: "예약 승인 및 운영 방식",
      description:
        "관리자 승인 후 확정되며, 승인 대기 중에도 해당 날짜와 1인 1건 한도를 차지합니다. 하루 한 기체를 FREE PLAY로 운영합니다. 시범 운영 중으로 세부 내용이 변경될 수 있습니다.",
    },
  ];
  const allAgreed = agreed.every(Boolean);
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
            setAgreed(agreed.map(() => false));
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
            setAgreed(agreed.map(() => false));
          }}
          options={[
            { value: "1", label: "1인 · 25,000원" },
            { value: "2", label: "2인 · 35,000원" },
          ]}
        />
        <details className="booking-agreements">
          <summary>
            이용 안내 확인 및 동의{" "}
            <span>
              {agreed.filter(Boolean).length}/{items.length}
            </span>
          </summary>
          <div className="agreement-list">
            {items.map((item, index) => (
              <label className="agreement-item" key={item.title}>
                <Checkbox
                  label={`${item.title} 동의 (필수)`}
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
                  <strong>{item.title} 동의 (필수)</strong>
                  <span>{item.description}</span>
                </span>
              </label>
            ))}
            <a href={CONTACT} target="_blank" rel="noreferrer">
              카카오 1:1 문의
            </a>
          </div>
        </details>
        {!allAgreed ? (
          <p className="caption">이용 안내를 펼쳐 모든 항목에 동의해 주세요.</p>
        ) : null}
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
        <Md type="submit" disabled={busy || !allAgreed}>
          예약 신청
        </Md>
      </form>
    </>
  );
}
