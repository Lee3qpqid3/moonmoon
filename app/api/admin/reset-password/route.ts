import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";

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
  const targetUserId = body.targetUserId as string | undefined;
  const newPassword = body.newPassword as string | undefined;
  const newPasswordConfirm = body.newPasswordConfirm as string | undefined;

  if (!targetUserId || !newPassword || !newPasswordConfirm) {
    return NextResponse.json(
      { error: "필수 정보가 누락되었습니다." },
      { status: 400 }
    );
  }

  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "비밀번호는 최소 6자 이상이어야 합니다." },
      { status: 400 }
    );
  }

  if (newPassword !== newPasswordConfirm) {
    return NextResponse.json(
      { error: "비밀번호 확인이 일치하지 않습니다." },
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
      { error: "관리자 페이지에서는 자기 자신의 비밀번호를 재설정할 수 없습니다." },
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

  if ((targetProfile.role as UserRole) === "SUPER_USER") {
    return NextResponse.json(
      { error: "슈퍼 유저의 비밀번호는 웹에서 재설정할 수 없습니다." },
      { status: 403 }
    );
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    targetUserId,
    {
      password: newPassword,
    }
  );

  if (updateError) {
    return NextResponse.json(
      { error: "비밀번호를 재설정하지 못했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
