import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";
type UserStatus = "ACTIVE" | "DISABLED" | "HIDDEN";

type ActorProfile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
};

type StreamingEntry = {
  id: string;
  entry_kind: "LIVE" | "DOCS";
  week_name: string;
  teacher_name: string;
  file_name: string;
  title: string;
  mime_type: string | null;
  webdav_path: string;
  is_hidden: boolean;
};

type ResolveRequestBody = {
  entryId?: string;
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
    isDirectAlready?: boolean;
    headStatus?: number | null;
    headRedirected?: boolean;
    headFinalUrl?: string | null;
    headLocation?: string | null;
    rangeStatus?: number | null;
    rangeRedirected?: boolean;
    rangeFinalUrl?: string | null;
    rangeLocation?: string | null;
    entry?: {
      id: string;
      entry_kind: string;
      week_name: string;
      teacher_name: string;
      file_name: string;
      webdav_path: string;
    };
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

function looksLikePikPakDirectUrl(url: string | null) {
  if (!url) return false;

  const lower = url.toLowerCase();

  return (
    lower.includes("mypikpak") &&
    (lower.includes("/download") ||
      lower.includes("dl-") ||
      lower.includes("dl.") ||
      lower.includes("dl_") ||
      lower.includes("download"))
  );
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
    .select("id, email, name, role, status")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("사용자 프로필을 찾을 수 없습니다.");
  }

  const actor = profile as ActorProfile;

  if (actor.status !== "ACTIVE") {
    throw new Error("활성 상태의 계정만 이용할 수 있습니다.");
  }

  if (actor.role !== "SUPER_USER") {
    throw new Error("슈퍼유저 권한이 필요합니다.");
  }

  return actor;
}

async function getEntry(entryId: string) {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("streaming_entries")
    .select(
      "id, entry_kind, week_name, teacher_name, file_name, title, mime_type, webdav_path, is_hidden"
    )
    .eq("id", entryId)
    .eq("is_hidden", false)
    .single();

  if (error || !data) {
    throw new Error("스트리밍 항목을 찾을 수 없습니다.");
  }

  return data as StreamingEntry;
}

async function requestHead(sourceUrl: string, useAuth: boolean) {
  const headers: Record<string, string> = {};

  if (useAuth) {
    headers.Authorization = getAuthorizationHeader();
  }

  const response = await fetch(sourceUrl, {
    method: "HEAD",
    headers,
    redirect: "manual",
    cache: "no-store",
  });

  const location = resolveLocationUrl(response.headers.get("location"), sourceUrl);

  return {
    status: response.status,
    redirected: response.redirected,
    finalUrl: response.url || null,
    location,
  };
}

async function requestRange(sourceUrl: string, useAuth: boolean) {
  const headers: Record<string, string> = {
    Range: "bytes=0-0",
  };

  if (useAuth) {
    headers.Authorization = getAuthorizationHeader();
  }

  const response = await fetch(sourceUrl, {
    method: "GET",
    headers,
    redirect: "manual",
    cache: "no-store",
  });

  const location = resolveLocationUrl(response.headers.get("location"), sourceUrl);

  await response.body?.cancel().catch(() => undefined);

  return {
    status: response.status,
    redirected: response.redirected,
    finalUrl: response.url || null,
    location,
  };
}

export async function POST(request: NextRequest) {
  try {
    await getActorProfile(request);

    const body = (await request.json()) as ResolveRequestBody;
    const entryId = body.entryId?.trim();

    if (!entryId) {
      return getJsonResponse(
        {
          ok: false,
          error: "entryId가 필요합니다.",
        },
        400
      );
    }

    const entry = await getEntry(entryId);

    const isDirectAlready = isAbsoluteHttpUrl(entry.webdav_path);
    const sourceUrl = isDirectAlready
      ? entry.webdav_path
      : buildWebDavUrl(entry.webdav_path);

    if (isDirectAlready) {
      return getJsonResponse({
        ok: true,
        directUrl: sourceUrl,
        sourceUrl,
        isDirectAlready: true,
        headStatus: null,
        headRedirected: false,
        headFinalUrl: null,
        headLocation: null,
        rangeStatus: null,
        rangeRedirected: false,
        rangeFinalUrl: null,
        rangeLocation: null,
        entry: {
          id: entry.id,
          entry_kind: entry.entry_kind,
          week_name: entry.week_name,
          teacher_name: entry.teacher_name,
          file_name: entry.file_name,
          webdav_path: entry.webdav_path,
        },
      });
    }

    const headResult = await requestHead(sourceUrl, true).catch((error) => ({
      status: -1,
      redirected: false,
      finalUrl: null,
      location:
        error instanceof Error
          ? `HEAD 요청 실패: ${error.message}`
          : "HEAD 요청 실패",
    }));

    const rangeResult = await requestRange(sourceUrl, true).catch((error) => ({
      status: -1,
      redirected: false,
      finalUrl: null,
      location:
        error instanceof Error
          ? `Range 요청 실패: ${error.message}`
          : "Range 요청 실패",
    }));

    const candidates = [
      headResult.location,
      headResult.finalUrl,
      rangeResult.location,
      rangeResult.finalUrl,
    ];

    const directUrl =
      candidates.find((candidate) => looksLikePikPakDirectUrl(candidate)) ?? null;

    return getJsonResponse({
      ok: Boolean(directUrl),
      directUrl,
      sourceUrl,
      isDirectAlready: false,
      headStatus: headResult.status,
      headRedirected: headResult.redirected,
      headFinalUrl: headResult.finalUrl,
      headLocation: headResult.location,
      rangeStatus: rangeResult.status,
      rangeRedirected: rangeResult.redirected,
      rangeFinalUrl: rangeResult.finalUrl,
      rangeLocation: rangeResult.location,
      entry: {
        id: entry.id,
        entry_kind: entry.entry_kind,
        week_name: entry.week_name,
        teacher_name: entry.teacher_name,
        file_name: entry.file_name,
        webdav_path: entry.webdav_path,
      },
      error: directUrl
        ? undefined
        : "WebDAV 경로에서 dlab 직접 링크를 찾지 못했습니다.",
    });
  } catch (error) {
    return getJsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "직접 재생 URL을 확인하지 못했습니다.",
      },
      500
    );
  }
}
