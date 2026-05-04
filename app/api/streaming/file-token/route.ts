import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type EntryKind = "LIVE" | "DOCS";

type FileTokenRequestBody = {
  entryId?: string;
  purpose?: EntryKind;
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
    .select("id, email, name, role, status, pro_until")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("사용자 프로필을 찾을 수 없습니다.");
  }

  if (profile.status !== "ACTIVE") {
    throw new Error("활성 상태의 계정만 이용할 수 있습니다.");
  }

  if (!profile.pro_until || new Date(profile.pro_until).getTime() <= Date.now()) {
    throw new Error("Pro 권한이 필요합니다.");
  }

  return profile as {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    pro_until: string | null;
  };
}

function isValidPurpose(value: unknown): value is EntryKind {
  return value === "LIVE" || value === "DOCS";
}

function getExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);
  return expiresAt.toISOString();
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getActorProfile(request);
    const supabase = getAdminSupabase();

    const body = (await request.json()) as FileTokenRequestBody;
    const entryId = body.entryId;
    const purpose = body.purpose;

    if (!entryId) {
      return NextResponse.json(
        {
          ok: false,
          error: "entryId가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (!isValidPurpose(purpose)) {
      return NextResponse.json(
        {
          ok: false,
          error: "purpose는 LIVE 또는 DOCS여야 합니다.",
        },
        {
          status: 400,
        }
      );
    }

    const { data: entry, error: entryError } = await supabase
      .from("streaming_entries")
      .select(
        "id, entry_kind, week_name, teacher_name, file_name, webdav_path, is_hidden"
      )
      .eq("id", entryId)
      .eq("is_hidden", false)
      .single();

    if (entryError || !entry) {
      return NextResponse.json(
        {
          ok: false,
          error: "파일을 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    if (entry.entry_kind !== purpose) {
      return NextResponse.json(
        {
          ok: false,
          error: "요청한 파일 유형이 올바르지 않습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const { data: grant, error: grantError } = await supabase
      .from("streaming_access_grants")
      .select("id")
      .eq("user_id", actor.id)
      .eq("week_name", entry.week_name)
      .eq("teacher_name", entry.teacher_name)
      .eq("access_type", purpose)
      .eq("is_active", true)
      .maybeSingle();

    if (grantError) {
      throw new Error(grantError.message);
    }

    if (!grant) {
      return NextResponse.json(
        {
          ok: false,
          error:
            purpose === "LIVE"
              ? "이 영상의 LIVE 권한이 없습니다."
              : "이 자료의 DOCS 권한이 없습니다.",
        },
        {
          status: 403,
        }
      );
    }

    const { data: tokenRow, error: tokenError } = await supabase
      .from("streaming_file_access_tokens")
      .insert({
        user_id: actor.id,
        entry_id: entry.id,
        purpose,
        expires_at: getExpiresAt(),
      })
      .select("id")
      .single();

    if (tokenError || !tokenRow) {
      throw new Error(tokenError?.message || "파일 접근 토큰을 만들지 못했습니다.");
    }

    if (purpose === "LIVE") {
      await supabase.from("streaming_play_logs").insert({
        user_id: actor.id,
        entry_id: entry.id,
        week_name: entry.week_name,
        teacher_name: entry.teacher_name,
        file_name: entry.file_name,
        webdav_path: entry.webdav_path,
      });
    }

    if (purpose === "DOCS") {
      await supabase.from("streaming_download_logs").insert({
        user_id: actor.id,
        entry_id: entry.id,
        week_name: entry.week_name,
        teacher_name: entry.teacher_name,
        file_name: entry.file_name,
        webdav_path: entry.webdav_path,
      });
    }

    return NextResponse.json({
      ok: true,
      fileUrl: `/api/streaming/file/${entry.id}?token=${tokenRow.id}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "파일 접근 토큰을 발급하지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
