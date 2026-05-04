import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type UserAction = "HIDE" | "RESTORE" | "DELETE";
type UserStatus = "ACTIVE" | "DISABLED" | "HIDDEN";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "서버 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const accessToken = authorization.replace("Bearer ", "");

  const body = await request.json();
  const targetUserId = String(body.targetUserId ?? "");
  const action = String(body.action ?? "") as UserAction;

  if (!targetUserId) {
    return NextResponse.json(
      { error: "사용자 ID가 필요합니다." },
      { status: 400 }
    );
  }

  if (!["HIDE", "RESTORE", "DELETE"].includes(action)) {
    return NextResponse.json(
      { error: "올바르지 않은 작업입니다." },
      { status: 400 }
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user: actorUser },
    error: actorError,
  } = await adminClient.auth.getUser(accessToken);

  if (actorError || !actorUser) {
    return NextResponse.json(
      { error: "로그인 정보를 확인할 수 없습니다." },
      { status: 401 }
    );
  }

  const { data: actorProfile, error: actorProfileError } = await adminClient
    .from("profiles")
    .select("id, role, status")
    .eq("id", actorUser.id)
    .single();

  if (actorProfileError || !actorProfile) {
    return NextResponse.json(
      { error: "관리자 프로필을 찾을 수 없습니다." },
      { status: 403 }
    );
  }

  if (
    actorProfile.status !== "ACTIVE" ||
    (actorProfile.role !== "ADMIN" && actorProfile.role !== "SUPER_USER")
  ) {
    return NextResponse.json(
      { error: "관리자 권한이 필요합니다." },
      { status: 403 }
    );
  }

  if (actorProfile.id === targetUserId) {
    return NextResponse.json(
      { error: "자기 자신은 숨김/삭제할 수 없습니다." },
      { status: 400 }
    );
  }

  const { data: targetProfile, error: targetProfileError } = await adminClient
    .from("profiles")
    .select("id, role, status")
    .eq("id", targetUserId)
    .single();

  if (targetProfileError || !targetProfile) {
    return NextResponse.json(
      { error: "대상 사용자를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (targetProfile.role === "SUPER_USER") {
    return NextResponse.json(
      { error: "슈퍼 유저는 웹에서 숨김/삭제할 수 없습니다." },
      { status: 403 }
    );
  }

  const currentStatus = targetProfile.status as UserStatus;

  if (action === "DELETE") {
    const { error } = await adminClient.auth.admin.deleteUser(targetUserId);

    if (error) {
      return NextResponse.json(
        { error: "계정을 완전 삭제하지 못했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "HIDE") {
    if (currentStatus === "HIDDEN") {
      return NextResponse.json({ ok: true });
    }

    const { error } = await adminClient
      .from("profiles")
      .update({
        status: "HIDDEN",
        previous_status: currentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (error) {
      return NextResponse.json(
        { error: "계정을 숨김 처리하지 못했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "RESTORE") {
    if (currentStatus !== "HIDDEN") {
      return NextResponse.json(
        { error: "숨김 상태의 계정만 복구할 수 있습니다." },
        { status: 400 }
      );
    }

    const { error } = await adminClient
      .from("profiles")
      .update({
        status: "DISABLED",
        previous_status: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (error) {
      return NextResponse.json(
        { error: "계정을 복구하지 못했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: "처리할 수 없는 작업입니다." },
    { status: 400 }
  );
}
