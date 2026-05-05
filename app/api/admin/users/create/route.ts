import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type UserRole = "USER" | "ADMIN";
type UserStatus = "ACTIVE" | "DISABLED";

type CreateUserBody = {
  email?: string;
  password?: string;
  name?: string;
  role?: UserRole;
  status?: UserStatus;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase 서버 환경변수가 설정되지 않았습니다.");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
  });
}

async function getActorProfile(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("로그인이 필요합니다.");
  }

  const accessToken = authorization.replace("Bearer ", "").trim();
  const supabase = getAdminSupabase();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    throw new Error("로그인 정보를 확인하지 못했습니다.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, name, role, status")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("사용자 프로필을 찾을 수 없습니다.");
  }

  if (profile.status !== "ACTIVE") {
    throw new Error("활성 상태의 계정만 이용할 수 있습니다.");
  }

  if (profile.role !== "ADMIN" && profile.role !== "SUPER_USER") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  return profile as {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "SUPER_USER" | "USER";
    status: string;
  };
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidRole(role: unknown): role is UserRole {
  return role === "USER" || role === "ADMIN";
}

function isValidStatus(status: unknown): status is UserStatus {
  return status === "ACTIVE" || status === "DISABLED";
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getActorProfile(request);
    const supabase = getAdminSupabase();

    const body = (await request.json()) as CreateUserBody;

    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const name = body.name?.trim() ?? "";
    const role = isValidRole(body.role) ? body.role : "USER";
    const status = isValidStatus(body.status) ? body.status : "ACTIVE";

    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          ok: false,
          error: "올바른 이메일을 입력해야 합니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          ok: false,
          error: "비밀번호는 6자 이상이어야 합니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          error: "이름을 입력해야 합니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (actor.role === "ADMIN" && role !== "USER") {
      return NextResponse.json(
        {
          ok: false,
          error: "관리자는 일반 사용자만 추가할 수 있습니다.",
        },
        {
          status: 403,
        }
      );
    }

    const { data: createdUserData, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
        },
      });

    if (createError || !createdUserData.user) {
      return NextResponse.json(
        {
          ok: false,
          error: createError?.message || "계정을 생성하지 못했습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const userId = createdUserData.user.id;

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email,
        name,
        role,
        status,
      },
      {
        onConflict: "id",
      }
    );

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId);

      return NextResponse.json(
        {
          ok: false,
          error: profileError.message || "프로필을 생성하지 못했습니다.",
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      userId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "사용자를 추가하지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
