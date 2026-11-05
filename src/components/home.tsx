"use client";
/* eslint-disable @next/next/no-img-element */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  addDays,
  blocksDeletion,
  CONTACT,
  endsAt,
  phoneFormat,
  type Booking,
  type Slot,
} from "@/lib/rules";
import { MaterialLoader, Md } from "./material";
import Theme from "./theme";
import Calendar from "./calendar";
type State = {
  configured: boolean;
  user: null | {
    avatar: string | null;
    profile: null | { name: string; phone: string };
  };
  slots: Slot[];
  bookings?: Booking[];
  admin?: boolean;
  dashboard?: { bookings: Booking[]; blocks: string[] };
  now: string;
  message?: string;
};
const statusText: Record<string, string> = {
  pending: "승인 대기",
  confirmed: "예약 확정",
  rejected: "거절",
  cancelled: "취소",
};
async function command(action: string, args: Record<string, unknown> = {}) {
  const response = await fetch("/api/service", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...args }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="dialog-heading">
        <h2 id="modal-title">{title}</h2>
        <button aria-label="닫기" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Guide() {
  return (
    <details className="guide">
      <summary>
        이용 전 꼭 확인해 주세요 <span>＋</span>
      </summary>
      <ul>
        <li>운영: 일·월·화·수·목 예약 / 다음날 00:00~05:00 이용</li>
        <li>하루 한 기체를 FREE PLAY 모드로 운영합니다.</li>
        <li>1인 25,000원 · 2인 35,000원 / 온라인 결제 없음</li>
        <li>대기·확정을 포함해 1인당 예약 1건만 보유할 수 있습니다.</li>
        <li>당일 예약 불가, 매일 21시에 14일 뒤 날짜를 공개합니다.</li>
        <li>
          취소는 예약일 5일 전까지{" "}
          <a href={CONTACT} target="_blank" rel="noreferrer">
            카카오 문의
          </a>
          로 가능합니다.
        </li>
        <li>예약일 5일 전을 지난 진행 예약이 있으면 탈퇴할 수 없습니다.</li>
        <li>예: 3월 9일 예약 → 3월 10일 00:00~05:00 이용</li>
        <li>시범 운영 중으로 세부 내용은 변경될 수 있습니다.</li>
      </ul>
    </details>
  );
}
export default function Home() {
  const [data, setData] = useState<State | null>(null),
    [pane, setPane] = useState("home"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [intro, setIntro] = useState("loading"),
    [selected, setSelected] = useState<string | null>(null),
    [deleting, setDeleting] = useState(false),
    [deleteConfirm, setDeleteConfirm] = useState(false),
    [deletePhone, setDeletePhone] = useState(""),
    [phone, setPhone] = useState(""),
    [name, setName] = useState(""),
    [consent, setConsent] = useState(false),
    [clock, setClock] = useState<Date | null>(null);
  const serverClock = useRef({ time: 0, received: 0 });
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/service", { cache: "no-store" }),
        result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
      serverClock.current = {
        time: Date.parse(result.now),
        received: Date.now(),
      };
      setClock(new Date(result.now));
    } catch (e) {
      setError(e instanceof Error ? e.message : "연결에 실패했습니다.");
    }
  }, []);
  useEffect(() => {
    const initial = requestAnimationFrame(() => void refresh());
    const ticker = setInterval(() => {
      if (serverClock.current.time)
        setClock(
          new Date(
            serverClock.current.time +
              Date.now() -
              serverClock.current.received,
          ),
        );
    }, 1000);
    const polling = setInterval(() => void refresh(), 30000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      cancelAnimationFrame(initial);
      clearInterval(ticker);
      clearInterval(polling);
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  useEffect(() => {
    const initial = requestAnimationFrame(() => {
      let seen = false;
      try {
        seen = !!sessionStorage.getItem("royalsg-intro");
        sessionStorage.setItem("royalsg-intro", "1");
      } catch {}
      setIntro(seen ? "done" : "play");
      if (new URLSearchParams(location.search).has("error"))
        setError("Google 로그인에 실패했습니다. 다시 시도해 주세요.");
    });
    return () => cancelAnimationFrame(initial);
  }, []);
  async function run(
    action: string,
    args: Record<string, unknown> = {},
    after?: () => void,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await command(action, args);
      if (result.url) {
        location.assign(result.url);
        return;
      }
      await refresh();
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }
  const now = clock ?? new Date("2000-01-01T00:00:00Z"),
    user = data?.user,
    signup = !!user && !user.profile,
    active = data?.bookings?.find(
      (b) =>
        ["pending", "confirmed"].includes(b.status) &&
        endsAt(b.rental_date) > now,
    ),
    restricted = active
      ? blocksDeletion(active.rental_date, active.status, now)
      : false;
  const navigate = (next: string) => {
    if (next === "profile" && user?.profile) {
      setName(user.profile.name);
      setPhone(user.profile.phone);
    }
    setError("");
    setPane(next);
  };
  function profileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void run("profile", { name, phone, consent }, () => navigate("home"));
  }
  return (
    <main className={`shell intro-${intro}`}>
      <MaterialLoader />
      <header className="topbar">
        <Theme />
      </header>
      <div className="brand">
        <img
          className="logo"
          src="/logo.png"
          width="210"
          height="210"
          alt="로얄상구"
        />
        <h1>로얄상구</h1>
        <p className="service-title">로얄상구 기기 예약 서비스</p>
      </div>
      <div
        className="content"
        onAnimationEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.animationName === "content-enter"
          )
            setIntro("done");
        }}
      >
        {error ? (
          <div className="notice error" role="alert">
            {error}
            <button
              onClick={() => {
                setError("");
                void refresh();
              }}
            >
              다시 확인
            </button>
          </div>
        ) : null}
        {!data && !error ? (
          <p className="loading" role="status">
            서비스를 불러오고 있어요…
          </p>
        ) : null}
        {data && !data.configured ? (
          <p className="notice">{data.message}</p>
        ) : null}
        {signup || pane === "profile" ? (
          <section className="card">
            <div className="section-heading">
              <div>
                <h2>{signup ? "회원가입" : "마이페이지"}</h2>
              </div>
              {!signup ? (
                <Md kind="text-button" onClick={() => navigate("home")}>
                  홈으로
                </Md>
              ) : null}
            </div>
            {user?.avatar ? (
              <img
                className="avatar"
                src={user.avatar}
                width="64"
                height="64"
                alt="Google 프로필"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <p>
              {user?.profile?.name ?? "예약에 사용할 정보를 입력해 주세요."}
            </p>
            <form onSubmit={profileSubmit}>
              <label>
                이름 또는 닉네임
                <input
                  required
                  maxLength={30}
                  autoComplete="nickname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                연락처
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  pattern="010-[0-9]{4}-[0-9]{4}"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(phoneFormat(e.target.value))}
                  placeholder="010-0000-0000"
                />
              </label>
              {signup ? (
                <label className="check">
                  <input
                    required
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    <a href="/privacy" target="_blank">
                      개인정보 처리방침
                    </a>
                    에 동의합니다. (필수)
                  </span>
                </label>
              ) : null}
              <Md type="submit" disabled={busy}>
                {signup ? "동의하고 시작하기" : "변경사항 저장"}
              </Md>
            </form>
            {!signup ? (
              <div className="withdraw">
                <p>
                  {restricted
                    ? "이용일 5일 전이 지나 회원탈퇴가 제한됩니다. 예약 관련 사항은 운영자에게 문의해 주세요."
                    : "탈퇴하면 계정 정보가 삭제되고 진행 중인 예약은 자동 취소됩니다."}
                </p>
                <Md
                  kind="text-button"
                  disabled={busy || restricted}
                  onClick={() => {
                    setDeleting(true);
                    setDeleteConfirm(false);
                    setDeletePhone("");
                  }}
                >
                  회원탈퇴
                </Md>
              </div>
            ) : null}
          </section>
        ) : null}
        {!signup && pane === "home" ? (
          <>
            <section className="welcome">
              {user ? (
                <>
                  <div className="profile">
                    {user.avatar ? (
                      <img
                        className="avatar"
                        src={user.avatar}
                        width="64"
                        height="64"
                        alt="Google 프로필"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="avatar fallback">
                        {user.profile?.name.slice(0, 1)}
                      </span>
                    )}
                    <h2>{user.profile?.name}님</h2>
                  </div>
                  <div className="account-actions">
                    <Md kind="text-button" onClick={() => navigate("profile")}>
                      마이페이지
                    </Md>
                    <Md
                      kind="text-button"
                      disabled={busy}
                      onClick={() =>
                        void run("logout", {}, () => navigate("home"))
                      }
                    >
                      로그아웃
                    </Md>
                    {data?.admin ? (
                      <Md kind="text-button" onClick={() => navigate("admin")}>
                        관리자
                      </Md>
                    ) : null}
                  </div>
                  {active ? <BookingCard booking={active} /> : null}
                  <div className="actions">
                    <Md
                      disabled={busy || !!active}
                      onClick={() => navigate("book")}
                    >
                      기기 예약
                    </Md>
                    <Md
                      kind="outlined-button"
                      onClick={() => navigate("calendar")}
                    >
                      예약 조회
                    </Md>
                    <a
                      className="contact-link"
                      href={CONTACT}
                      target="_blank"
                      rel="noreferrer"
                    >
                      1:1 문의
                    </a>
                  </div>
                  <details className="history">
                    <summary>나의 예약 내역</summary>
                    {data?.bookings?.length ? (
                      data.bookings.map((b) => (
                        <BookingCard key={b.id} booking={b} />
                      ))
                    ) : (
                      <p>아직 예약 내역이 없습니다.</p>
                    )}
                  </details>
                </>
              ) : (
                <>
                  <div className="actions">
                    <button
                      className="google"
                      disabled={busy || !data?.configured}
                      onClick={() => void run("login")}
                    >
                      <GoogleIcon />
                      Google로 로그인
                    </button>
                    <Md
                      kind="outlined-button"
                      onClick={() => navigate("calendar")}
                    >
                      예약 조회
                    </Md>
                  </div>
                </>
              )}
            </section>
            <Guide />
          </>
        ) : null}
        {!signup && (pane === "book" || pane === "calendar") ? (
          <section key={pane}>
            <div className="section-heading">
              <div>
                <h2>{pane === "book" ? "기기 예약" : "예약 조회"}</h2>
              </div>
              <Md kind="text-button" onClick={() => navigate("home")}>
                홈으로
              </Md>
            </div>
            <Calendar
              slots={data?.slots ?? []}
              now={now}
              readonly={
                pane === "calendar" || !user || !!active || !data?.configured
              }
              onSelect={setSelected}
            />
            {pane === "calendar" && user ? (
              <Md disabled={!!active} onClick={() => navigate("book")}>
                기기 예약하기
              </Md>
            ) : null}
            <Guide />
          </section>
        ) : null}
        {!signup && pane === "admin" && data?.admin ? (
          <Admin
            data={data.dashboard}
            now={now}
            busy={busy}
            run={run}
            back={() => navigate("home")}
          />
        ) : null}
        <footer>
          <a href="/privacy">개인정보 처리방침</a>
          <p>
            © 2026{" "}
            <a
              href="https://x.com/Royalsanggu_Mai"
              target="_blank"
              rel="noreferrer"
            >
              RoyalSangGu
            </a>
            <span> · </span>Made with ❤️ by{" "}
            <a href="https://x.com/xit0ra" target="_blank" rel="noreferrer">
              xitora
            </a>
          </p>
        </footer>
      </div>
      {selected ? (
        <Modal
          title="기기 대여 신청"
          onClose={() => !busy && setSelected(null)}
        >
          <p className="date-display">{selected}</p>
          <p className="caption">
            실제 이용: {addDays(selected, 1)} 00:00~05:00
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const values = new FormData(e.currentTarget);
              void run(
                "book",
                {
                  date: selected,
                  machine: values.get("machine"),
                  people: Number(values.get("people")),
                },
                () => {
                  setSelected(null);
                  navigate("home");
                },
              );
            }}
          >
            <label>
              대여 기체
              <select name="machine" defaultValue="A">
                {["A", "B", "C"].map((m) => (
                  <option key={m} value={m}>
                    {m} 기체
                  </option>
                ))}
              </select>
            </label>
            <label>
              이용 인원
              <select name="people" defaultValue="1">
                <option value="1">1인 · 25,000원</option>
                <option value="2">2인 · 35,000원</option>
              </select>
            </label>
            <p className="notice">
              관리자 승인 후 예약이 확정됩니다. 승인 대기 중에도 다른 예약은
              신청할 수 없습니다.
            </p>
            <label className="check">
              <input type="checkbox" required />
              <span>이용일·가격·취소 및 탈퇴 제한을 확인했습니다.</span>
            </label>
            {error ? (
              <p role="alert" className="error">
                {error}
              </p>
            ) : null}
            <Md type="submit" disabled={busy}>
              예약 신청
            </Md>
          </form>
        </Modal>
      ) : null}
      {deleting ? (
        <Modal
          title={deleteConfirm ? "정말 탈퇴하시겠습니까?" : "회원탈퇴"}
          onClose={() => !busy && setDeleting(false)}
        >
          <p>개인정보는 삭제되고 진행 중인 예약은 자동 취소됩니다.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!deleteConfirm) {
                if (deletePhone !== user?.profile?.phone) {
                  setError("등록된 전화번호와 일치하지 않습니다.");
                  return;
                }
                setError("");
                setDeleteConfirm(true);
              } else
                void run("delete", { phone: deletePhone }, () => {
                  setDeleting(false);
                  navigate("home");
                });
            }}
          >
            <label>
              본인의 등록 전화번호
              <input
                required
                type="tel"
                pattern="010-[0-9]{4}-[0-9]{4}"
                value={deletePhone}
                readOnly={deleteConfirm}
                onChange={(e) => setDeletePhone(phoneFormat(e.target.value))}
              />
            </label>
            {error ? (
              <p role="alert" className="error">
                {error}
              </p>
            ) : null}
            <Md disabled={busy || restricted} type="submit">
              {deleteConfirm ? "확인, 탈퇴합니다" : "전화번호 확인"}
            </Md>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
function BookingCard({ booking: b }: { booking: Booking }) {
  return (
    <article className="booking-card">
      <div>
        <h3>{b.rental_date}</h3>
        <p>
          {b.machine}기체 · {b.people}인 · {b.price.toLocaleString()}원
        </p>
        <small>이용 {addDays(b.rental_date, 1)} 00:00~05:00</small>
      </div>
      <span className={"badge " + b.status}>{statusText[b.status]}</span>
    </article>
  );
}
function Admin({
  data,
  now,
  busy,
  run,
  back,
}: {
  data: State["dashboard"];
  now: Date;
  busy: boolean;
  run: (
    action: string,
    args: Record<string, unknown>,
    after?: () => void,
  ) => Promise<void>;
  back: () => void;
}) {
  const [review, setReview] = useState<{ id: string; status: string } | null>(
    null,
  );
  return (
    <section>
      <div className="section-heading">
        <h2>예약 관리</h2>
        <Md kind="text-button" onClick={back}>
          홈으로
        </Md>
      </div>
      <div className="card">
        <h3>운영 날짜 차단</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const values = new FormData(e.currentTarget);
            void run("block", { date: values.get("date"), blocked: true });
          }}
        >
          <label>
            차단할 예약 날짜
            <input type="date" name="date" required />
          </label>
          <Md type="submit" disabled={busy}>
            차단
          </Md>
        </form>
        {data?.blocks.map((day) => (
          <div className="block-row" key={day}>
            {day}
            <Md
              kind="text-button"
              disabled={busy}
              onClick={() => void run("block", { date: day, blocked: false })}
            >
              차단 해제
            </Md>
          </div>
        ))}
      </div>
      {data?.bookings.length ? (
        data.bookings.map((b) => (
          <div className="card" key={b.id}>
            <BookingCard booking={b} />
            <p>
              {b.name ?? "탈퇴/보유기간 종료"}{" "}
              {b.phone ? <a href={"tel:" + b.phone}>{b.phone}</a> : null}
            </p>
            {["pending", "confirmed"].includes(b.status) &&
            endsAt(b.rental_date) > now ? (
              <div className="review-actions">
                {b.status === "pending" ? (
                  <>
                    <Md
                      disabled={busy}
                      onClick={() =>
                        setReview({ id: b.id, status: "confirmed" })
                      }
                    >
                      승인
                    </Md>
                    <Md
                      kind="outlined-button"
                      disabled={busy}
                      onClick={() =>
                        setReview({ id: b.id, status: "rejected" })
                      }
                    >
                      거절
                    </Md>
                  </>
                ) : null}
                <Md
                  kind="text-button"
                  disabled={busy}
                  onClick={() => setReview({ id: b.id, status: "cancelled" })}
                >
                  문의 취소 처리
                </Md>
              </div>
            ) : null}
          </div>
        ))
      ) : (
        <p className="notice">예약 내역이 없습니다.</p>
      )}
      {review ? (
        <Modal
          title={`예약 ${statusText[review.status]} 처리`}
          onClose={() => !busy && setReview(null)}
        >
          <p>
            선택한 예약을 {statusText[review.status]} 상태로 변경하시겠습니까?
          </p>
          <Md
            disabled={busy}
            onClick={() => void run("review", review, () => setReview(null))}
          >
            확인
          </Md>
        </Modal>
      ) : null}
    </section>
  );
}
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.9h11c-.5 2.6-1.9 4.8-4.1 6.3v5.2h6.7c3.9-3.6 6-8.9 6-15.3Z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.2c-1.8 1.2-4.1 1.9-6.8 1.9-5.3 0-9.8-3.6-11.4-8.4H5.7v5.4A20.4 20.4 0 0 0 24 44Z"
      />
      <path
        fill="#FBBC05"
        d="M12.6 27.4a12.3 12.3 0 0 1 0-7.8v-5.4H5.7a20.4 20.4 0 0 0 0 18.6l6.9-5.4Z"
      />
      <path
        fill="#EA4335"
        d="M24 11.2c3 0 5.6 1 7.7 3l5.8-5.8A19.6 19.6 0 0 0 24 3a20.4 20.4 0 0 0-18.3 11.2l6.9 5.4c1.6-4.8 6.1-8.4 11.4-8.4Z"
      />
    </svg>
  );
}
