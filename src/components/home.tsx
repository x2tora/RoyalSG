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
  available,
  type Booking,
  type Slot,
} from "@/lib/rules";
import { MaterialLoader, Md, TextField, Checkbox } from "./material";
import Theme from "./theme";
import Calendar from "./calendar";
import BookingForm from "./booking-form";
import Modal from "./dialog";
import InstallApp from "./install-app";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LowVision from "./low-vision";
type Pane =
  "home" | "signup" | "profile" | "book" | "calendar" | "admin" | "privacy";
const pagePaths: Record<Pane, string> = {
  home: "/",
  signup: "/signup",
  profile: "/mypage",
  book: "/reserve",
  calendar: "/calendar",
  admin: "/admin",
  privacy: "/privacy",
};
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
const CONNECTION_ERROR =
  "인터넷 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.";
async function serviceFetch(
  options: RequestInit,
  retry = false,
): Promise<Response> {
  try {
    return await fetch("/api/service", options);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    if (retry) return serviceFetch(options);
    throw new Error(CONNECTION_ERROR);
  }
}
async function command(action: string, args: Record<string, unknown> = {}) {
  const response = await serviceFetch({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...args }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
function Guide() {
  return (
    <section className="guide" aria-labelledby="guide-title">
      <h2 id="guide-title">이용 전 꼭 확인해 주세요!</h2>
      <ul>
        <li>운영: 일·월·화·수·목 다음날 00:00~05:00</li>
        <li>예: 10월 9일 예약 → 10월 10일 00:00~05:00 이용 가능</li>
      </ul>
      <ul>
        <li>대여 기체는 FREE PLAY 모드로 운영됩니다.</li>
        <li>요금: 1인 25,000원 · 2인 35,000원</li>
        <li>대여 시작 전 현장 결제 부탁드립니다.</li>
      </ul>
      <ul>
        <li>대기·확정을 포함해 1인당 예약 1건만 보유 가능합니다.</li>
        <li>당일·현장 대여 불가능합니다.</li>
      </ul>
      <ul>
        <li>대기 상태의 예약은 직접 취소가 가능합니다.</li>
        <li>
          확정 대여의 취소는 대여일 5일 전까지{" "}
          <a href={CONTACT} target="_blank" rel="noreferrer">
            카카오 1:1 문의
          </a>
          로 가능합니다.
        </li>
        <li>취소 불가능한 대여 내역 보유 시, 회원 탈퇴가 불가능합니다.</li>
      </ul>
      <ul>
        <li>시범 운영 중으로 세부 내용은 언제든 변경될 수 있습니다.</li>
      </ul>
    </section>
  );
}
export default function Home({
  pane = "home",
  reservationDate,
  children,
}: {
  pane?: Pane;
  reservationDate?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [data, setData] = useState<State | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [intro, setIntro] = useState("loading"),
    [deleting, setDeleting] = useState(false),
    [cancellingSignup, setCancellingSignup] = useState(false),
    [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null),
    [deleteConfirm, setDeleteConfirm] = useState(false),
    [deletePhone, setDeletePhone] = useState(""),
    [phone, setPhone] = useState(""),
    [name, setName] = useState(""),
    [consent, setConsent] = useState(false),
    [clock, setClock] = useState<Date | null>(null);
  const serverClock = useRef({ time: 0, received: 0 });
  const profileInitialized = useRef(false);
  const refreshing = useRef(false);
  const selected = reservationDate ?? null;
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const response = await serviceFetch({ cache: "no-store" }, true),
        result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
      setError((previous) => (previous === CONNECTION_ERROR ? "" : previous));
      if (result.user?.profile && !profileInitialized.current) {
        profileInitialized.current = true;
        setName(result.user.profile.name);
        setPhone(result.user.profile.phone);
      }
      serverClock.current = {
        time: Date.parse(result.now),
        received: Date.now(),
      };
      setClock(new Date(result.now));
    } catch (e) {
      setError(e instanceof Error ? e.message : "연결에 실패했습니다.");
    } finally {
      refreshing.current = false;
    }
  }, []);
  useEffect(() => {
    if (!data?.configured) return;
    if (
      data.user &&
      !data.user.profile &&
      pane !== "signup" &&
      pane !== "privacy"
    )
      router.replace("/signup");
    else if (pane === "signup" && (!data.user || data.user.profile))
      router.replace("/");
    else if (
      (pane === "profile" || pane === "book" || pane === "admin") &&
      (!data.user || (pane === "admin" && !data.admin))
    )
      router.replace("/");
  }, [data, pane, router]);
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
    if ((!data && !error) || intro !== "loading") return;
    let cancelled = false;
    let initial = 0;
    async function startIntro() {
      let seen = false;
      try {
        seen = !!sessionStorage.getItem("royalsg-intro");
      } catch {}
      const skip =
        seen ||
        matchMedia("(prefers-reduced-motion: reduce)").matches ||
        document.documentElement.dataset.lowVision === "true";
      if (!skip) {
        const logo = document.querySelector<HTMLImageElement>(".brand .logo");
        await Promise.allSettled([document.fonts.ready, logo?.decode()]);
      }
      if (cancelled) return;
      initial = requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          sessionStorage.setItem("royalsg-intro", "1");
        } catch {}
        setIntro(skip ? "done" : "play");
        if (new URLSearchParams(location.search).has("error"))
          setError("Google 로그인에 실패했습니다. 다시 시도해 주세요.");
      });
    }
    void startIntro();
    return () => {
      cancelled = true;
      cancelAnimationFrame(initial);
    };
  }, [data, error, intro]);
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
  const navigate = (next: Pane, replace = false) => {
    setError("");
    if (replace) router.replace(pagePaths[next]);
    else router.push(pagePaths[next]);
  };
  const back = () => {
    if (window.history.length > 1) router.back();
    else router.replace(selected ? "/reserve" : "/");
  };
  function profileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void run("profile", { name, phone, consent }, () => navigate("home", true));
  }
  return (
    <main
      className={`shell ${pane !== "home" ? "compact-header" : ""} intro-${intro}`}
    >
      <MaterialLoader />
      <header className="topbar">
        <span className="low-vision-label">저시력자용 화면</span>
        <LowVision />
        <Theme />
      </header>
      <div className="brand">
        <Link href="/" className="brand-link" aria-label="로얄상구 홈으로">
          <img
            className="logo"
            src="/logo.png"
            width="210"
            height="210"
            fetchPriority="high"
            alt="로얄상구"
          />
          <h1>로얄상구</h1>
          <p className="service-title">로얄상구 기기 예약 서비스</p>
        </Link>
      </div>
      <div
        className="content"
        onAnimationEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.animationName === "content-enter"
          ) {
            document.documentElement.dataset.introSeen = "true";
            setIntro("done");
          }
        }}
      >
        {error ? (
          <div className="notice error" role="alert">
            {error}
            <Md
              kind="text-button"
              onClick={() => {
                setError("");
                void refresh();
              }}
            >
              다시 확인
            </Md>
          </div>
        ) : null}
        {data && !data.configured ? (
          <p className="notice">{data.message}</p>
        ) : null}
        {(signup && pane === "signup") ||
        (pane === "profile" && user?.profile) ? (
          <section className="card">
            <div className="section-heading">
              <div>
                <h2>{signup ? "회원가입" : "마이페이지"}</h2>
              </div>
              {!signup ? (
                <Md kind="text-button" onClick={back}>
                  뒤로가기
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
              <TextField
                label="이름 또는 닉네임"
                required
                maxLength={30}
                autoComplete="nickname"
                value={name}
                onValue={setName}
              />
              <TextField
                label="연락처"
                required
                type="tel"
                inputMode="numeric"
                pattern="010-[0-9]{4}-[0-9]{4}"
                autoComplete="tel-national"
                value={phone}
                onValue={(value) => setPhone(phoneFormat(value))}
                placeholder="010-0000-0000"
              />
              {signup ? (
                <label className="check">
                  <Checkbox
                    label="개인정보 처리방침 동의 (필수)"
                    required
                    checked={consent}
                    onChecked={setConsent}
                  />
                  <span>
                    <Link href="/privacy">개인정보 처리방침</Link>에 동의합니다.
                    (필수)
                  </span>
                </label>
              ) : null}
              <Md type="submit" disabled={busy}>
                {signup ? "동의하고 시작하기" : "변경사항 저장"}
              </Md>
            </form>
            {signup ? (
              <Md
                kind="text-button"
                className="signup-cancel"
                type="button"
                disabled={busy}
                onClick={() => {
                  setError("");
                  setCancellingSignup(true);
                }}
              >
                가입 취소
              </Md>
            ) : null}
            {!signup ? (
              <div className="withdraw">
                <p>
                  {restricted
                    ? "이용일 5일 전이 지나 회원탈퇴가 제한됩니다.\n예약 관련 사항은 운영자에게 문의해 주세요."
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
                        void run("logout", {}, () => navigate("home", true))
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
                  {active?.status === "pending" ? (
                    <Md
                      className="pending-cancel"
                      kind="text-button"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setError("");
                        setCancellingBooking(active);
                      }}
                    >
                      예약 취소
                    </Md>
                  ) : null}
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
                </>
              ) : (
                <>
                  <div className="actions">
                    <button
                      className="google"
                      disabled={busy || !data?.configured}
                      onClick={() => void run("login")}
                    >
                      <Md kind="ripple" disabled={busy || !data?.configured} />
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
          </>
        ) : null}
        {!signup && (pane === "book" || pane === "calendar") ? (
          <section key={pane}>
            <div className="section-heading">
              <div>
                <h2>{pane === "book" ? "기기 예약" : "예약 조회"}</h2>
              </div>
              <Md kind="text-button" onClick={back}>
                뒤로가기
              </Md>
            </div>
            {selected &&
            data &&
            user?.profile &&
            (active ||
              !available(selected, now) ||
              data.slots.some((slot) => slot.rental_date === selected)) ? (
              <p className="notice" role="status">
                {active
                  ? "진행 중인 예약이 있어 새로 신청할 수 없습니다."
                  : "선택한 날짜는 현재 예약할 수 없습니다. 다른 날짜를 선택해 주세요."}
              </p>
            ) : null}
            <Calendar
              slots={data?.slots ?? []}
              now={now}
              readonly={
                pane === "calendar" || !user || !!active || !data?.configured
              }
              onSelect={(date) => router.push(`/reserve/${date}`)}
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
            back={back}
          />
        ) : null}
        {pane === "privacy" ? (
          <section key="privacy">
            <div className="section-heading">
              <h2>개인정보 처리방침</h2>
              <Md kind="text-button" onClick={back}>
                뒤로가기
              </Md>
            </div>
            {children}
          </section>
        ) : (
          children
        )}
        <footer>
          <InstallApp ready={intro === "done"} />
          <Link href="/privacy">개인정보 처리방침</Link>
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
      {selected &&
      data &&
      user?.profile &&
      !active &&
      available(selected, now) &&
      !data.slots.some((slot) => slot.rental_date === selected) ? (
        <Modal title="기기 대여 신청" onClose={() => !busy && back()}>
          <BookingForm
            date={selected}
            busy={busy}
            error={error}
            onSubmit={(machine, people) =>
              void run("book", { date: selected, machine, people }, () => {
                navigate("home", true);
              })
            }
          />
        </Modal>
      ) : null}
      {cancellingBooking ? (
        <Modal
          title="예약을 취소하시겠습니까?"
          onClose={() => !busy && setCancellingBooking(null)}
        >
          <p>
            {cancellingBooking.rental_date} · {cancellingBooking.machine}기체 ·{" "}
            {cancellingBooking.people}인 예약을 취소합니다. 취소 후 다른 날짜로
            다시 신청할 수 있습니다.
          </p>
          {error ? (
            <p role="alert" className="error">
              {error}
            </p>
          ) : null}
          <div className="dialog-actions">
            <Md
              kind="text-button"
              type="button"
              disabled={busy}
              onClick={() => setCancellingBooking(null)}
            >
              유지하기
            </Md>
            <Md
              type="button"
              disabled={busy}
              onClick={() =>
                void run("cancelBooking", { id: cancellingBooking.id }, () =>
                  setCancellingBooking(null),
                )
              }
            >
              예약 취소
            </Md>
          </div>
        </Modal>
      ) : null}
      {cancellingSignup ? (
        <Modal
          title="가입을 취소하시겠습니까?"
          onClose={() => !busy && setCancellingSignup(false)}
        >
          <p>
            입력한 내용은 저장되지 않습니다.
            <br />이 서비스의 가입 대기 계정과 로그인 세션을 삭제하고 비로그인
            홈으로 돌아갑니다.
          </p>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="review-actions">
            <Md
              kind="outlined-button"
              type="button"
              disabled={busy}
              onClick={() => setCancellingSignup(false)}
            >
              계속 가입하기
            </Md>
            <Md
              type="button"
              disabled={busy}
              onClick={() =>
                void run("cancelSignup", {}, () => {
                  setCancellingSignup(false);
                  setName("");
                  setPhone("");
                  setConsent(false);
                  navigate("home", true);
                })
              }
            >
              가입 취소
            </Md>
          </div>
        </Modal>
      ) : null}
      {deleting ? (
        <Modal
          title={deleteConfirm ? "정말 탈퇴하시겠습니까?" : "회원탈퇴"}
          onClose={() => !busy && setDeleting(false)}
        >
          <p>
            개인정보는 삭제됩니다.
            <br />
            진행 중인 예약은 자동 취소됩니다.
          </p>
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
                  navigate("home", true);
                });
            }}
          >
            <TextField
              label="본인의 등록 전화번호"
              required
              type="tel"
              pattern="010-[0-9]{4}-[0-9]{4}"
              value={deletePhone}
              readOnly={deleteConfirm}
              onValue={(value) => setDeletePhone(phoneFormat(value))}
            />
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
      <span className={"badge " + b.status}>
        {b.status === "cancelled" && b.cancelled_by_self
          ? "본인 취소"
          : statusText[b.status]}
      </span>
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
  const [showHistory, setShowHistory] = useState(false);
  const bookings =
    data?.bookings.filter((b) => {
      const current =
        ["pending", "confirmed"].includes(b.status) &&
        endsAt(b.rental_date) > now;
      return showHistory ? !current : current;
    }) ?? [];
  if (showHistory) {
    bookings.sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    );
  }
  return (
    <section>
      <div className="section-heading">
        <h2>예약 관리</h2>
        <Md kind="text-button" onClick={back}>
          뒤로가기
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
      <Md kind="outlined-button" onClick={() => setShowHistory(!showHistory)}>
        {showHistory ? "현재 예약 보기" : "이전 내역 보기"}
      </Md>
      <h3>{showHistory ? "이전 예약 내역" : "현재 예약"}</h3>
      {bookings.length ? (
        bookings.map((b) => (
          <div className="card" key={b.id}>
            <BookingCard booking={b} />
            <p>
              {b.name ?? "탈퇴/보유기간 종료"}{" "}
              {b.phone ? <a href={"tel:" + b.phone}>{b.phone}</a> : null}
            </p>
            <dl className="booking-times">
              {[
                ["신청", b.created_at],
                ["승인", b.confirmed_at],
                [b.cancelled_by_self ? "본인 취소" : "취소", b.cancelled_at],
                ["거절", b.rejected_at],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {value
                      ? new Intl.DateTimeFormat("ko-KR", {
                          timeZone: "Asia/Seoul",
                          dateStyle: "medium",
                          timeStyle: "short",
                          hour12: false,
                        }).format(new Date(value))
                      : "기록 없음"}
                  </dd>
                </div>
              ))}
            </dl>
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
