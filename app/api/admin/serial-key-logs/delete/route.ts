import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

  let body: {
    logId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 데이터를 읽지 못했습니다." },
      { status: 400 }
    );
  }

  const logId = String(body.logId ?? "");

  if (!logId) {
    return NextResponse.json(
      { error: "삭제할 발급 로그 ID가 필요합니다." },
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
      { error: "슈퍼유저 프로필을 찾을 수 없습니다." },
      { status: 403 }
    );
  }

  if (actorProfile.status !== "ACTIVE" || actorProfile.role !== "SUPER_USER") {
    return NextResponse.json(
      { error: "슈퍼유저 권한이 필요합니다." },
      { status: 403 }
    );
  }

  const { data: existingLog, error: existingLogError } = await adminClient
    .from("serial_key_issue_logs")
    .select("id")
    .eq("id", logId)
    .single();

  if (existingLogError || !existingLog) {
    return NextResponse.json(
      { error: "삭제할 발급 로그를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const { error: deleteError } = await adminClient
    .from("serial_key_issue_logs")
    .delete()
    .eq("id", logId);

  if (deleteError) {
    return NextResponse.json(
      { error: `발급 로그를 삭제하지 못했습니다. ${deleteError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
