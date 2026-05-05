import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EntryKind = "LIVE" | "DOCS";

type FileTokenRequestBody = {
  entryId?: string;
  purpose?: EntryKind;
  playbackMode?: "SERVER" | "EXTERNAL_SERVER";
};

type ActorProfile = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN" | "SUPER_USER";
  status: "ACTIVE" | "DISABLED" | "HIDDEN";
  pro_until: string | null;
};

type StreamingEntryRow = {
  id: string;
  entry_kind: EntryKind;
  week_name: string;
  teacher_name: string;
  file_name: string;
  webdav_path: string;
  is_hidden: boolean;
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
      autoRefreshToken: false,
    },
  });
}

function getJsonResponse(
  body: {
    ok: boolean;
    fileUrl?: string;
    error?: string;
  },
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

function isValidPurpose(value: unknown): value is EntryKind {
  return value === "LIVE" || value === "DOCS";
}

function getExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);
  return expiresAt.toISOString();
}

async function cleanupExpiredTokens() {
  try {
    const supabase = getAdminSupabase();

    await supabase.rpc("cleanup_expired_streaming_file_access_tokens");
  } catch {
    // 토큰 정리는 실패해도 새 토큰 발급 자체를 막지 않는다.
  }
}

async function getActorProfile(request: NextRequest): Promise<ActorProfile> {
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

  const actorProfile = profile as ActorProfile;

  if (actorProfile.status !== "ACTIVE") {
    throw new Error("활성 상태의 계정만 이용할 수 있습니다.");
  }

  if (
    !actorProfile.pro_until ||
    new Date(actorProfile.pro_until).getTime() <= Date.now()
  ) {
    throw new Error("Pro 권한이 필요합니다.");
  }

  return actorProfile;
}

async function getStreamingEntry(entryId: string) {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("streaming_entries")
    .select(
      "id, entry_kind, week_name, teacher_name, file_name, webdav_path, is_hidden"
    )
    .eq("id", entryId)
    .eq("is_hidden", false)
    .single();

  if (error || !data) {
    return null;
  }

  return data as StreamingEntryRow;
}

async function hasStreamingAccess(params: {
  userId: string;
  weekName: string;
  teacherName: string;
  accessType: EntryKind;
}) {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("streaming_access_grants")
    .select("id")
    .eq("user_id", params.userId)
    .eq("week_name", params.weekName)
    .eq("teacher_name", params.teacherName)
    .eq("access_type", params.accessType)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

async function createAccessToken(params: {
  userId: string;
  entryId: string;
  purpose: EntryKind;
}) {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("streaming_file_access_tokens")
    .insert({
      user_id: params.userId,
      entry_id: params.entryId,
      purpose: params.purpose,
      expires_at: getExpiresAt(),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "파일 접근 토큰을 만들지 못했습니다.");
  }

  return data.id as string;
}

async function insertPlayOrDownloadLog(params: {
  userId: string;
  entry: StreamingEntryRow;
  purpose: EntryKind;
  playbackMode: "SERVER" | "EXTERNAL_SERVER";
}) {
  const supabase = getAdminSupabase();

  if (params.purpose === "LIVE") {
    await supabase.from("streaming_play_logs").insert({
      user_id: params.userId,
      entry_id: params.entry.id,
      week_name: params.entry.week_name,
      teacher_name: params.entry.teacher_name,
      file_name: params.entry.file_name,
      webdav_path: params.entry.webdav_path,
      playback_mode: params.playbackMode,
    });

    return;
  }

  await supabase.from("streaming_download_logs").insert({
    user_id: params.userId,
    entry_id: params.entry.id,
    week_name: params.entry.week_name,
    teacher_name: params.entry.teacher_name,
    file_name: params.entry.file_name,
    webdav_path: params.entry.webdav_path,
  });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getActorProfile(request);

    await cleanupExpiredTokens();

    const body = (await request.json()) as FileTokenRequestBody;
    const entryId = body.entryId;
    const purpose = body.purpose;
    const playbackMode =
      body.playbackMode === "EXTERNAL_SERVER" ? "EXTERNAL_SERVER" : "SERVER";

    if (!entryId) {
      return getJsonResponse(
        {
          ok: false,
          error: "entryId가 필요합니다.",
        },
        400
      );
    }

    if (!isValidPurpose(purpose)) {
      return getJsonResponse(
        {
          ok: false,
          error: "purpose는 LIVE 또는 DOCS여야 합니다.",
        },
        400
      );
    }

    const entry = await getStreamingEntry(entryId);

    if (!entry) {
      return getJsonResponse(
        {
          ok: false,
          error: "파일을 찾을 수 없습니다.",
        },
        404
      );
    }

    if (entry.entry_kind !== purpose) {
      return getJsonResponse(
        {
          ok: false,
          error: "요청한 파일 유형이 올바르지 않습니다.",
        },
        400
      );
    }

    const allowed = await hasStreamingAccess({
      userId: actor.id,
      weekName: entry.week_name,
      teacherName: entry.teacher_name,
      accessType: purpose,
    });

    if (!allowed) {
      return getJsonResponse(
        {
          ok: false,
          error:
            purpose === "LIVE"
              ? "이 영상의 LIVE 권한이 없습니다."
              : "이 자료의 DOCS 권한이 없습니다.",
        },
        403
      );
    }

    const tokenId = await createAccessToken({
      userId: actor.id,
      entryId: entry.id,
      purpose,
    });

    await insertPlayOrDownloadLog({
      userId: actor.id,
      entry,
      purpose,
      playbackMode,
    });

    return getJsonResponse({
      ok: true,
      fileUrl: `/api/streaming/file/${entry.id}?token=${tokenId}`,
    });
  } catch (error) {
    return getJsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "파일 접근 토큰을 발급하지 못했습니다.",
      },
      500
    );
  }
}
