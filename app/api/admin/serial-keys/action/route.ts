import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SerialKeyAction = "DISABLE" | "HIDE" | "RESTORE" | "DELETE";

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
  const serialKeyId = String(body.serialKeyId ?? "");
  const action = String(body.action ?? "") as SerialKeyAction;

  if (!serialKeyId) {
    return NextResponse.json(
      { error: "시리얼키 ID가 필요합니다." },
      { status: 400 }
    );
  }

  if (!["DISABLE", "HIDE", "RESTORE", "DELETE"].includes(action)) {
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

  const { data: serialKey, error: serialKeyError } = await adminClient
    .from("serial_keys")
    .select("id, status, used_by")
    .eq("id", serialKeyId)
    .single();

  if (serialKeyError || !serialKey) {
    return NextResponse.json(
      { error: "시리얼키를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (action === "DELETE") {
    const { error } = await adminClient
      .from("serial_keys")
      .delete()
      .eq("id", serialKeyId);

    if (error) {
      return NextResponse.json(
        { error: "시리얼키를 완전 삭제하지 못했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  let nextStatus: "ACTIVE" | "USED" | "DISABLED" | "HIDDEN";

  if (action === "DISABLE") {
    nextStatus = "DISABLED";
  } else if (action === "HIDE") {
    nextStatus = "HIDDEN";
  } else {
    nextStatus = serialKey.used_by ? "USED" : "ACTIVE";
  }

  const { error: updateError } = await adminClient
    .from("serial_keys")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", serialKeyId);

  if (updateError) {
    return NextResponse.json(
      { error: "시리얼키 상태를 변경하지 못했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
