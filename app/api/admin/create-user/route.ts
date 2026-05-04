import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  const passwordConfirm = String(body.passwordConfirm ?? "");
  const role = String(body.role ?? "USER");

  if (!email || !name || !password || !passwordConfirm) {
    return NextResponse.json(
      { error: "이메일, 이름, 비밀번호를 모두 입력해야 합니다." },
      { status: 400 }
    );
  }

  if (!email.includes("@")) {
    return NextResponse.json(
      { error: "올바른 이메일 형식이 아닙니다." },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "비밀번호는 최소 6자 이상이어야 합니다." },
      { status: 400 }
    );
  }

  if (password !== passwordConfirm) {
    return NextResponse.json(
      { error: "비밀번호 확인이 일치하지 않습니다." },
      { status: 400 }
    );
  }

  if (role !== "USER" && role !== "ADMIN") {
    return NextResponse.json(
      { error: "역할은 USER 또는 ADMIN만 선택할 수 있습니다." },
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

  const { data: existingProfiles } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (existingProfiles && existingProfiles.length > 0) {
    return NextResponse.json(
      { error: "이미 등록된 이메일입니다." },
      { status: 409 }
    );
  }

  const { data: createdUserData, error: createUserError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createUserError || !createdUserData.user) {
    return NextResponse.json(
      { error: createUserError?.message || "계정을 생성하지 못했습니다." },
      { status: 500 }
    );
  }

  const createdUser = createdUserData.user;

  const { error: profileInsertError } = await adminClient
    .from("profiles")
    .insert({
      id: createdUser.id,
      email,
      name,
      role,
      status: "ACTIVE",
      pro_until: null,
    });

  if (profileInsertError) {
    await adminClient.auth.admin.deleteUser(createdUser.id);

    return NextResponse.json(
      { error: "프로필 생성에 실패하여 계정 생성을 취소했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: createdUser.id,
      email,
      name,
      role,
      status: "ACTIVE",
    },
  });
}
