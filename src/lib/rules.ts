export const CONTACT = "https://open.kakao.com/o/sB03cxii";
export const POLICY_VERSION = "2026-11-05";
export const DELETION_BLOCKED =
  "이용일 5일 전이 지나 회원탈퇴가 제한됩니다. 예약 관련 사항은 운영자에게 문의해 주세요.";
export type Booking = {
  id: string;
  rental_date: string;
  machine: "A" | "B" | "C";
  people: number;
  price: number;
  status: "pending" | "confirmed" | "rejected" | "cancelled";
  created_at?: string;
  confirmed_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by_self?: boolean;
  rejected_at?: string | null;
  user_id?: string;
  name?: string;
  phone?: string;
};
export type Slot = {
  rental_date: string;
  machine: string | null;
  people: number | null;
  status: string;
};
export function kst(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600000);
}
export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
export function addDays(day: string, amount: number) {
  return dateKey(new Date(Date.parse(day + "T00:00:00Z") + amount * 86400000));
}
export function windowFor(now = new Date()) {
  const local = kst(now),
    today = dateKey(local);
  return {
    today,
    min: addDays(today, 1),
    max: addDays(today, local.getUTCHours() >= 21 ? 14 : 13),
  };
}
export function available(day: string, now = new Date()) {
  const range = windowFor(now);
  return (
    day >= range.min &&
    day <= range.max &&
    new Date(day + "T00:00:00Z").getUTCDay() <= 4
  );
}
export function endsAt(day: string) {
  return new Date(addDays(day, 1) + "T05:00:00+09:00");
}
export function blocksDeletion(day: string, status: string, now = new Date()) {
  return (
    ["pending", "confirmed"].includes(status) &&
    endsAt(day) > now &&
    (Date.parse(day) - Date.parse(windowFor(now).today)) / 86400000 < 5
  );
}
export function phoneFormat(value: string) {
  const n = value.replace(/\D/g, "").slice(0, 11);
  return [n.slice(0, 3), n.slice(3, 7), n.slice(7)].filter(Boolean).join("-");
}
