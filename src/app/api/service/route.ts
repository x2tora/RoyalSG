import { NextRequest, NextResponse } from "next/server";
import { configured, supabase } from "@/lib/supabase";
import { POLICY_VERSION } from "@/lib/rules";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!configured())
    return NextResponse.json({
      configured: false,
      user: null,
      slots: [],
      message: "서비스 연결을 준비 중입니다.",
      now: new Date().toISOString(),
    });
  try {
    const db = await supabase();
    const [
      {
        data: { user },
      },
      calendar,
    ] = await Promise.all([db.auth.getUser(), db.rpc("calendar_slots")]);
    if (calendar.error) throw calendar.error;
    if (!user)
      return NextResponse.json({
        configured: true,
        user: null,
        slots: calendar.data,
        now: new Date().toISOString(),
      });
    const [profile, bookings, admin] = await Promise.all([
      db.from("profiles").select("name,phone").eq("id", user.id).maybeSingle(),
      db
        .from("bookings")
        .select("id,rental_date,machine,people,price,status")
        .eq("user_id", user.id)
        .order("rental_date", { ascending: false }),
      db.rpc("is_admin"),
    ]);
    if (profile.error || bookings.error || admin.error)
      throw profile.error || bookings.error || admin.error;
    const adminData = admin.data ? await db.rpc("admin_dashboard") : null;
    if (adminData?.error) throw adminData.error;
    return NextResponse.json(
      {
        configured: true,
        user: {
          avatar: user.user_metadata.avatar_url ?? null,
          profile: profile.data,
        },
        bookings: bookings.data,
        slots: calendar.data,
        admin: !!admin.data,
        dashboard: adminData?.data,
        now: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error: "서비스 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin)
    return NextResponse.json(
      { error: "허용되지 않은 요청입니다." },
      { status: 403 },
    );
  try {
    const db = await supabase(),
      body = await request.json();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (body.action === "login") {
      if (process.env.PRIVACY_READY !== "true")
        throw new Error("개인정보 처리방침 및 로그인 설정을 준비 중입니다.");
      const base = process.env.NEXT_PUBLIC_SITE_URL;
      if (!base) throw new Error("로그인 주소를 설정 중입니다.");
      const { data, error } = await db.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: new URL("/auth/callback", base).href },
      });
      if (error) throw new Error("Google 로그인을 시작하지 못했습니다.");
      return NextResponse.json({ url: data.url });
    }
    if (!user)
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    if (body.action === "logout") {
      const { error } = await db.auth.signOut();
      if (error) throw new Error("로그아웃에 실패했습니다.");
      return NextResponse.json({ ok: true });
    }
    const commands: Record<
      string,
      { name: string; args: Record<string, unknown> }
    > = {
      profile: {
        name: "save_profile",
        args: {
          p_name: body.name,
          p_phone: body.phone,
          p_consent: body.consent === true,
          p_version: POLICY_VERSION,
        },
      },
      book: {
        name: "create_booking",
        args: {
          p_date: body.date,
          p_machine: body.machine,
          p_people: body.people,
        },
      },
      delete: { name: "delete_account", args: { p_phone: body.phone } },
      review: {
        name: "review_booking",
        args: { p_id: body.id, p_status: body.status },
      },
      block: {
        name: "set_date_block",
        args: { p_date: body.date, p_blocked: body.blocked },
      },
    };
    const command = commands[body.action];
    if (!command) throw new Error("지원하지 않는 요청입니다.");
    const { error } = await db.rpc(command.name, command.args);
    if (error) {
      if (error.code === "P0001") throw new Error(error.message);
      throw new Error(
        "요청을 처리하지 못했습니다. 입력 내용과 예약 현황을 확인해 주세요.",
      );
    }
    if (body.action === "delete") await db.auth.signOut({ scope: "local" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "요청에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}
