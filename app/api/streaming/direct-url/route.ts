import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EntryKind = "LIVE" | "DOCS";

type DirectUrlRequestBody = {
  entryId?: string;
  playbackMode?: "DIRECT" | "EXTERNAL_DIRECT";
};

type ActorProfile = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN" | "SUPER_USER";
  status: "ACTIVE" | "DISABLED" | "HIDDEN";
  pro_until: string | null;
};

type StreamingEntry = {
  id: string;
  entry_kind: EntryKind;
  week_name: string;
  teacher_name: string;
  file_name: string;
  title: string;
  mime_type: string | null;
  webdav_path: string;
  is_hidden: boolean;
  direct_play_url: string | null;
  direct_play_url_expires_at: string | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WEBDAV_URL = process.env.PIKPAK_WEBDAV_URL;
const WEBDAV_USERNAME = process.env.PIKPAK_WEBDAV_USERNAME;
const WEBDAV_PASSWORD = process.env.PIKPAK_WEBDAV_PASSWORD;

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
    directUrl?: string | null;
    sourceUrl?: string | null;
    sourceType?: "CACHE" | "DIRECT_ALREADY" | "WEBDAV_RANGE_LOCATION" | "NONE";
    rangeStatus?: number | null;
    rangeLocation?: string | null;
    savedToCache?: boolean;
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

function decodeRepeatedly(value: string) {
  let current = value;

  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(current);

      if (decoded === current) {
        return decoded;
      }

      current = decoded;
    } catch {
      return current;
    }
  }

  return current;
}

function normalizePath(path: string) {
  if (!path) return "/";

  let nextPath = path.trim();

  nextPath = decodeRepeatedly(nextPath);

  if (!nextPath.startsWith("/")) {
    nextPath = `/${nextPath}`;
  }

  nextPath = nextPath.replace(/\/+/g, "/");

  if (nextPath.length > 1 && nextPath.endsWith("/")) {
    nextPath = nextPath.slice(0, -1);
  }

  return nextPath;
}

function isAbsoluteHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function getWebDavBaseUrl() {
  if (!WEBDAV_URL) {
    throw new Error("PIKPAK_WEBDAV_URL 환경변수가 설정되지 않았습니다.");
  }

  return WEBDAV_URL.replace(/\/+$/, "");
}

function encodePathForUrl(path: string) {
  const normalizedPath = normalizePath(path);

  return normalizedPath
    .split("/")
    .map((part, index) => {
      if (index === 0) return "";
      return encodeURIComponent(part);
    })
    .join("/");
}

function buildWebDavUrl(path: string) {
  return `${getWebDavBaseUrl()}${encodePathForUrl(path)}`;
}

function getAuthorizationHeader() {
  if (!WEBDAV_USERNAME || !WEBDAV_PASSWORD) {
    throw new Error("PikPak WebDAV 계정 환경변수가 설정되지 않았습니다.");
  }

  const token = Buffer.from(`${WEBDAV_USERNAME}:${WEBDAV_PASSWORD}`).toString(
    "base64"
  );

  return `Basic ${token}`;
}

function resolveLocationUrl(location: string | null, baseUrl: string) {
  if (!location) {
    return null;
  }

  try {
    return new URL(location, baseUrl).toString();
  } catch {
    return location;
  }
}

function looksLikeDirectVideoUrl(url: string | null) {
  if (!url) return false;

  const lower = url.toLowerCase();

  return (
    lower.startsWith("http") &&
    (lower.includes("mypikpak") ||
      lower.includes("download") ||
      lower.includes("dl-") ||
      lower.includes("/download/") ||
      lower.includes("/download?"))
  );
}

function isValidCachedDirectUrl(entry: StreamingEntry) {
  if (!entry.direct_play_url) {
    return false;
  }

  if (!isAbsoluteHttpUrl(entry.direct_play_url)) {
    return false;
  }

  if (!entry.direct_play_url_expires_at) {
    return true;
  }

  return new Date(entry.direct_play_url_expires_at).getTime() > Date.now();
}

function getDirectUrlExpiresAtFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const expire = parsed.searchParams.get("expire");

    if (!expire) {
      const fallback = new Date();
      fallback.setHours(fallback.getHours() + 6);
      return fallback.toISOString();
    }

    const expireSeconds = Number(expire);

    if (!Number.isFinite(expireSeconds)) {
      const fallback = new Date();
      fallback.setHours(fallback.getHours() + 6);
      return fallback.toISOString();
    }

    return new Date(expireSeconds * 1000).toISOString();
  } catch {
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 6);
    return fallback.toISOString();
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

  const actor = profile as unknown as ActorProfile;

  if (actor.status !== "ACTIVE") {
    throw new Error("활성 상태의 계정만 이용할 수 있습니다.");
  }

  if (!actor.pro_until || new Date(actor.pro_until).getTime() <= Date.now()) {
    throw new Error("Pro 권한이 필요합니다.");
  }

  return actor;
}

async function getLiveEntry(entryId: string) {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("streaming_entries")
    .select(
      [
        "id",
        "entry_kind",
        "week_name",
        "teacher_name",
        "file_name",
        "title",
        "mime_type",
        "webdav_path",
        "is_hidden",
        "direct_play_url",
        "direct_play_url_expires_at",
      ].join(", ")
    )
    .eq("id", entryId)
    .eq("entry_kind", "LIVE")
    .eq("is_hidden", false)
    .single();

  if (error || !data) {
    throw new Error("영상을 찾을 수 없습니다.");
  }

  return data as unknown as StreamingEntry;
}

async function checkLiveAccess(params: {
  userId: string;
  weekName: string;
  teacherName: string;
}) {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("streaming_access_grants")
    .select("id")
    .eq("user_id", params.userId)
    .eq("week_name", params.weekName)
    .eq("teacher_name", params.teacherName)
    .eq("access_type", "LIVE")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("이 영상의 LIVE 권한이 없습니다.");
  }
}

async function insertDirectPlayLog(params: {
  userId: string;
  entry: StreamingEntry;
  playbackMode: "DIRECT" | "EXTERNAL_DIRECT";
}) {
  const supabase = getAdminSupabase();

  await supabase.from("streaming_play_logs").insert({
    user_id: params.userId,
    entry_id: params.entry.id,
    week_name: params.entry.week_name,
    teacher_name: params.entry.teacher_name,
    file_name: params.entry.file_name,
    webdav_path: params.entry.webdav_path,
    playback_mode: params.playbackMode,
  });
}

async function saveDirectUrl(params: {
  entryId: string;
  directUrl: string;
  actorId: string;
}) {
  const supabase = getAdminSupabase();
  const expiresAt = getDirectUrlExpiresAtFromUrl(params.directUrl);

  const { error } = await supabase
    .from("streaming_entries")
    .update({
      direct_play_url: params.directUrl,
      direct_play_url_expires_at: expiresAt,
      direct_play_url_updated_at: new Date().toISOString(),
      direct_play_url_updated_by: params.actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.entryId);

  if (error) {
    return false;
  }

  return true;
}

async function requestRangeLocation(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    method: "GET",
    headers: {
      Authorization: getAuthorizationHeader(),
      Range: "bytes=0-0",
      "User-Agent": "curl/8.20.0",
      Accept: "*/*",
    },
    redirect: "manual",
    cache: "no-store",
  });

  const location = resolveLocationUrl(response.headers.get("location"), sourceUrl);

  await response.body?.cancel().catch(() => undefined);

  return {
    status: response.status,
    location,
  };
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getActorProfile(request);

    const body = (await request.json()) as DirectUrlRequestBody;
    const entryId = body.entryId?.trim();
    const playbackMode =
      body.playbackMode === "EXTERNAL_DIRECT" ? "EXTERNAL_DIRECT" : "DIRECT";

    if (!entryId) {
      return getJsonResponse(
        {
          ok: false,
          sourceType: "NONE",
          error: "entryId가 필요합니다.",
        },
        400
      );
    }

    const entry = await getLiveEntry(entryId);

    await checkLiveAccess({
      userId: actor.id,
      weekName: entry.week_name,
      teacherName: entry.teacher_name,
    });

    if (isValidCachedDirectUrl(entry)) {
      await insertDirectPlayLog({
        userId: actor.id,
        entry,
        playbackMode,
      }).catch(() => undefined);

      return getJsonResponse({
        ok: true,
        directUrl: entry.direct_play_url,
        sourceUrl: entry.direct_play_url,
        sourceType: "CACHE",
        rangeStatus: null,
        rangeLocation: null,
        savedToCache: false,
      });
    }

    const isDirectAlready = isAbsoluteHttpUrl(entry.webdav_path);
    const sourceUrl = isDirectAlready
      ? entry.webdav_path
      : buildWebDavUrl(entry.webdav_path);

    if (isDirectAlready) {
      const savedToCache = await saveDirectUrl({
        entryId: entry.id,
        directUrl: sourceUrl,
        actorId: actor.id,
      });

      await insertDirectPlayLog({
        userId: actor.id,
        entry,
        playbackMode,
      }).catch(() => undefined);

      return getJsonResponse({
        ok: true,
        directUrl: sourceUrl,
        sourceUrl,
        sourceType: "DIRECT_ALREADY",
        rangeStatus: null,
        rangeLocation: null,
        savedToCache,
      });
    }

    const rangeResult = await requestRangeLocation(sourceUrl);
    const directUrl = looksLikeDirectVideoUrl(rangeResult.location)
      ? rangeResult.location
      : null;

    if (!directUrl) {
      return getJsonResponse({
        ok: false,
        directUrl: null,
        sourceUrl,
        sourceType: "NONE",
        rangeStatus: rangeResult.status,
        rangeLocation: rangeResult.location,
        savedToCache: false,
        error:
          "직접 재생 링크를 찾지 못했습니다. 서버 재생 방식을 사용해 주세요.",
      });
    }

    const savedToCache = await saveDirectUrl({
      entryId: entry.id,
      directUrl,
      actorId: actor.id,
    });

    await insertDirectPlayLog({
      userId: actor.id,
      entry,
      playbackMode,
    }).catch(() => undefined);

    return getJsonResponse({
      ok: true,
      directUrl,
      sourceUrl,
      sourceType: "WEBDAV_RANGE_LOCATION",
      rangeStatus: rangeResult.status,
      rangeLocation: rangeResult.location,
      savedToCache,
    });
  } catch (error) {
    return getJsonResponse(
      {
        ok: false,
        sourceType: "NONE",
        error:
          error instanceof Error
            ? error.message
            : "직접 재생 URL을 발급하지 못했습니다.",
      },
      500
    );
  }
}
