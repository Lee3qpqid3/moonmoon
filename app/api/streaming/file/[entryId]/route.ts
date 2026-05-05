import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WEBDAV_URL = process.env.PIKPAK_WEBDAV_URL;
const WEBDAV_USERNAME = process.env.PIKPAK_WEBDAV_USERNAME;
const WEBDAV_PASSWORD = process.env.PIKPAK_WEBDAV_PASSWORD;

type TokenPurpose = "LIVE" | "DOCS";

type EntryAndToken = {
  tokenRow: {
    id: string;
    user_id: string;
    entry_id: string;
    purpose: TokenPurpose;
    expires_at: string;
  };
  entry: {
    id: string;
    entry_kind: TokenPurpose;
    week_name: string;
    teacher_name: string;
    file_name: string;
    title: string;
    mime_type: string | null;
    webdav_path: string;
    is_hidden: boolean;
  };
};

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

function normalizePath(path: string) {
  if (!path) return "/";

  let nextPath = path.trim();

  if (!nextPath.startsWith("/")) {
    nextPath = `/${nextPath}`;
  }

  nextPath = nextPath.replace(/\/+/g, "/");

  if (nextPath.length > 1 && nextPath.endsWith("/")) {
    nextPath = nextPath.slice(0, -1);
  }

  return nextPath;
}

function getWebDavBaseUrl() {
  if (!WEBDAV_URL) {
    throw new Error("PIKPAK_WEBDAV_URL 환경변수가 설정되지 않았습니다.");
  }

  return WEBDAV_URL.replace(/\/+$/, "");
}

function encodePathForUrl(path: string) {
  return normalizePath(path)
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

function sanitizeFileName(fileName: string) {
  return fileName.replace(/["\\\r\n]/g, "_");
}

function getAsciiFallbackFileName(fileName: string) {
  const sanitized = sanitizeFileName(fileName);
  const ascii = sanitized.replace(/[^\x20-\x7E]/g, "_");

  return ascii || "download";
}

function getContentDisposition(fileName: string) {
  const sanitized = sanitizeFileName(fileName);
  const fallback = getAsciiFallbackFileName(sanitized);
  const encoded = encodeURIComponent(sanitized);

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function getFallbackContentType(fileName: string) {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".m4v")) return "video/x-m4v";
  if (lower.endsWith(".mkv")) return "video/x-matroska";
  if (lower.endsWith(".avi")) return "video/x-msvideo";

  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".7z")) return "application/x-7z-compressed";
  if (lower.endsWith(".rar")) return "application/vnd.rar";

  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lower.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }

  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }

  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";

  return "application/octet-stream";
}

function getJsonError(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}

async function getEntryAndToken(entryId: string, token: string): Promise<EntryAndToken> {
  const supabase = getAdminSupabase();

  const { data: tokenRow, error: tokenError } = await supabase
    .from("streaming_file_access_tokens")
    .select("id, user_id, entry_id, purpose, expires_at")
    .eq("id", token)
    .eq("entry_id", entryId)
    .single();

  if (tokenError || !tokenRow) {
    throw new Error("TOKEN_INVALID");
  }

  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    throw new Error("TOKEN_EXPIRED");
  }

  const { data: entry, error: entryError } = await supabase
    .from("streaming_entries")
    .select(
      "id, entry_kind, week_name, teacher_name, file_name, title, mime_type, webdav_path, is_hidden"
    )
    .eq("id", entryId)
    .eq("is_hidden", false)
    .single();

  if (entryError || !entry) {
    throw new Error("ENTRY_NOT_FOUND");
  }

  if (entry.entry_kind !== tokenRow.purpose) {
    throw new Error("TOKEN_PURPOSE_MISMATCH");
  }

  return {
    tokenRow: tokenRow as EntryAndToken["tokenRow"],
    entry: entry as EntryAndToken["entry"],
  };
}

function buildProxyHeaders(params: {
  webDavResponse: Response;
  entry: EntryAndToken["entry"];
  purpose: TokenPurpose;
}) {
  const { webDavResponse, entry, purpose } = params;

  const headers = new Headers();

  const contentType =
    webDavResponse.headers.get("content-type") ||
    entry.mime_type ||
    getFallbackContentType(entry.file_name);

  headers.set("Content-Type", contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");

  const contentLength = webDavResponse.headers.get("content-length");
  const contentRange = webDavResponse.headers.get("content-range");
  const lastModified = webDavResponse.headers.get("last-modified");
  const etag = webDavResponse.headers.get("etag");

  if (contentLength) headers.set("Content-Length", contentLength);
  if (contentRange) headers.set("Content-Range", contentRange);
  if (lastModified) headers.set("Last-Modified", lastModified);
  if (etag) headers.set("ETag", etag);

  if (purpose === "DOCS") {
    headers.set("Content-Disposition", getContentDisposition(entry.file_name));
  }

  return headers;
}

async function proxyWebDavFile(request: NextRequest, entryId: string, isHead: boolean) {
  const token = request.nextUrl.searchParams.get("token");

  if (!entryId) {
    return getJsonError("entryId가 필요합니다.", 400);
  }

  if (!token) {
    return getJsonError("파일 접근 토큰이 필요합니다.", 401);
  }

  let entryAndToken: EntryAndToken;

  try {
    entryAndToken = await getEntryAndToken(entryId, token);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "TOKEN_INVALID") {
      return getJsonError("파일 접근 토큰이 올바르지 않습니다.", 401);
    }

    if (message === "TOKEN_EXPIRED") {
      return getJsonError("파일 접근 토큰이 만료되었습니다. 새로고침 후 다시 시도하세요.", 401);
    }

    if (message === "ENTRY_NOT_FOUND") {
      return getJsonError("파일을 찾을 수 없습니다.", 404);
    }

    if (message === "TOKEN_PURPOSE_MISMATCH") {
      return getJsonError("파일 접근 토큰의 유형이 올바르지 않습니다.", 403);
    }

    return getJsonError("파일 접근 정보를 확인하지 못했습니다.", 500);
  }

  const { tokenRow, entry } = entryAndToken;

  const range = request.headers.get("range");
  const ifRange = request.headers.get("if-range");
  const ifNoneMatch = request.headers.get("if-none-match");
  const ifModifiedSince = request.headers.get("if-modified-since");

  const webDavHeaders: Record<string, string> = {
    Authorization: getAuthorizationHeader(),
  };

  if (range) webDavHeaders.Range = range;
  if (ifRange) webDavHeaders["If-Range"] = ifRange;
  if (ifNoneMatch) webDavHeaders["If-None-Match"] = ifNoneMatch;
  if (ifModifiedSince) webDavHeaders["If-Modified-Since"] = ifModifiedSince;

  const webDavResponse = await fetch(buildWebDavUrl(entry.webdav_path), {
    method: isHead ? "HEAD" : "GET",
    headers: webDavHeaders,
    cache: "no-store",
  });

  if (!webDavResponse.ok && webDavResponse.status !== 206 && webDavResponse.status !== 304) {
    return getJsonError(
      `WebDAV 파일을 불러오지 못했습니다. 상태 코드: ${webDavResponse.status}`,
      webDavResponse.status
    );
  }

  const headers = buildProxyHeaders({
    webDavResponse,
    entry,
    purpose: tokenRow.purpose,
  });

  if (isHead || webDavResponse.status === 304) {
    return new NextResponse(null, {
      status: webDavResponse.status,
      headers,
    });
  }

  return new NextResponse(webDavResponse.body, {
    status: webDavResponse.status,
    headers,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await context.params;

  try {
    return await proxyWebDavFile(request, entryId, false);
  } catch (error) {
    return getJsonError(
      error instanceof Error ? error.message : "파일을 불러오지 못했습니다.",
      500
    );
  }
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await context.params;

  try {
    return await proxyWebDavFile(request, entryId, true);
  } catch (error) {
    return getJsonError(
      error instanceof Error ? error.message : "파일 정보를 불러오지 못했습니다.",
      500
    );
  }
}
