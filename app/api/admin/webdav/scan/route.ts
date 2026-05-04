import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type EntryKind = "LIVE" | "DOCS";

type WebDavFile = {
  path: string;
  fileName: string;
  size: number | null;
  mimeType: string | null;
};

type ParsedEntry = {
  entry_kind: EntryKind;
  week_name: string;
  teacher_name: string;
  file_name: string;
  title: string;
  file_extension: string | null;
  mime_type: string | null;
  webdav_path: string;
  file_size_bytes: number | null;
  is_hidden: boolean;
  last_seen_at: string;
  updated_at: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WEBDAV_URL = process.env.PIKPAK_WEBDAV_URL;
const WEBDAV_USERNAME = process.env.PIKPAK_WEBDAV_USERNAME;
const WEBDAV_PASSWORD = process.env.PIKPAK_WEBDAV_PASSWORD;
const LIVE_ROOT = process.env.PIKPAK_WEBDAV_LIVE_ROOT || "/moonmoon/live";
const DOCS_ROOT = process.env.PIKPAK_WEBDAV_DOCS_ROOT || "/moonmoon/docs";

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

function buildWebDavUrl(path: string) {
  const baseUrl = getWebDavBaseUrl();
  const normalizedPath = normalizePath(path);

  return `${baseUrl}${normalizedPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
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

function stripXmlTags(value: string) {
  return value.replace(/<[^>]+>/g, "").trim();
}

function decodeXmlText(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function getTagValue(xml: string, tagName: string) {
  const regex = new RegExp(`<[^:>]*:?${tagName}[^>]*>([\\s\\S]*?)<\\/[^:>]*:?${tagName}>`, "i");
  const match = xml.match(regex);

  if (!match) {
    return null;
  }

  return decodeXmlText(stripXmlTags(match[1]));
}

function isDirectoryResponse(xml: string) {
  return /<[^:>]*:?collection\s*\/?>/i.test(xml);
}

function isProbablyDirectoryPath(path: string) {
  return path.endsWith("/");
}

function removeQueryAndHash(path: string) {
  return path.split("?")[0].split("#")[0];
}

function hrefToPath(href: string) {
  try {
    const decodedHref = decodeURIComponent(decodeXmlText(href));
    const url = new URL(decodedHref, getWebDavBaseUrl());

    return normalizePath(removeQueryAndHash(url.pathname));
  } catch {
    return normalizePath(removeQueryAndHash(decodeXmlText(href)));
  }
}

function getRelativePath(rootPath: string, fullPath: string) {
  const normalizedRoot = normalizePath(rootPath);
  const normalizedFullPath = normalizePath(fullPath);

  if (!normalizedFullPath.startsWith(normalizedRoot)) {
    return "";
  }

  return normalizedFullPath.slice(normalizedRoot.length).replace(/^\/+/, "");
}

function getFileNameFromPath(path: string) {
  const normalized = normalizePath(path);
  const parts = normalized.split("/").filter(Boolean);

  return parts[parts.length - 1] || "";
}

function getTitleFromFileName(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex <= 0) {
    return fileName;
  }

  return fileName.slice(0, lastDotIndex);
}

function getExtensionFromFileName(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return null;
  }

  return fileName.slice(lastDotIndex + 1).toLowerCase();
}

function isHiddenSystemFile(fileName: string) {
  const lower = fileName.toLowerCase();

  return (
    lower === ".ds_store" ||
    lower === "thumbs.db" ||
    lower.startsWith("._") ||
    lower === "desktop.ini"
  );
}

function shouldUseAsFile(fileName: string, kind: EntryKind) {
  if (!fileName || isHiddenSystemFile(fileName)) {
    return false;
  }

  const extension = getExtensionFromFileName(fileName);

  if (!extension) {
    return false;
  }

  if (kind === "LIVE") {
    return ["mp4", "mkv", "mov", "webm", "m4v", "avi"].includes(extension);
  }

  return [
    "pdf",
    "zip",
    "7z",
    "rar",
    "doc",
    "docx",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "hwp",
    "hwpx",
    "txt",
    "png",
    "jpg",
    "jpeg",
  ].includes(extension);
}

async function propfind(path: string) {
  const response = await fetch(buildWebDavUrl(path), {
    method: "PROPFIND",
    headers: {
      Authorization: getAuthorizationHeader(),
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8",
    },
    body: `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:resourcetype />
    <d:getcontentlength />
    <d:getcontenttype />
  </d:prop>
</d:propfind>`,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `WebDAV PROPFIND 실패: ${path} / 상태 코드 ${response.status}`
    );
  }

  return response.text();
}

function parsePropfindResponses(xml: string) {
  const responseRegex = /<[^:>]*:?response[^>]*>([\s\S]*?)<\/[^:>]*:?response>/gi;
  const responses: Array<{
    href: string;
    path: string;
    isDirectory: boolean;
    size: number | null;
    mimeType: string | null;
  }> = [];

  let match: RegExpExecArray | null;

  while ((match = responseRegex.exec(xml)) !== null) {
    const responseXml = match[1];
    const href = getTagValue(responseXml, "href");

    if (!href) {
      continue;
    }

    const path = hrefToPath(href);
    const sizeText = getTagValue(responseXml, "getcontentlength");
    const mimeType = getTagValue(responseXml, "getcontenttype");
    const size = sizeText && /^\d+$/.test(sizeText) ? Number(sizeText) : null;

    responses.push({
      href,
      path,
      isDirectory: isDirectoryResponse(responseXml) || isProbablyDirectoryPath(href),
      size,
      mimeType,
    });
  }

  return responses;
}

async function scanRecursive(rootPath: string, kind: EntryKind) {
  const normalizedRoot = normalizePath(rootPath);
  const queue = [normalizedRoot];
  const visited = new Set<string>();
  const files: WebDavFile[] = [];

  while (queue.length > 0) {
    const currentPath = queue.shift();

    if (!currentPath || visited.has(currentPath)) {
      continue;
    }

    visited.add(currentPath);

    const xml = await propfind(currentPath);
    const responses = parsePropfindResponses(xml);

    for (const response of responses) {
      const responsePath = normalizePath(response.path);

      if (responsePath === currentPath) {
        continue;
      }

      if (!responsePath.startsWith(normalizedRoot)) {
        continue;
      }

      if (response.isDirectory) {
        queue.push(responsePath);
        continue;
      }

      const fileName = getFileNameFromPath(responsePath);

      if (!shouldUseAsFile(fileName, kind)) {
        continue;
      }

      files.push({
        path: responsePath,
        fileName,
        size: response.size,
        mimeType: response.mimeType,
      });
    }
  }

  return files;
}

function parseEntry(kind: EntryKind, rootPath: string, file: WebDavFile): ParsedEntry | null {
  const relativePath = getRelativePath(rootPath, file.path);
  const parts = relativePath.split("/").filter(Boolean);

  if (parts.length < 3) {
    return null;
  }

  const weekName = parts[0]?.trim();
  const teacherName = parts[1]?.trim();
  const fileName = parts.slice(2).join("/").trim();

  if (!weekName || !teacherName || !fileName) {
    return null;
  }

  const pureFileName = getFileNameFromPath(fileName);

  if (!pureFileName) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    entry_kind: kind,
    week_name: weekName,
    teacher_name: teacherName,
    file_name: pureFileName,
    title: getTitleFromFileName(pureFileName),
    file_extension: getExtensionFromFileName(pureFileName),
    mime_type: file.mimeType,
    webdav_path: normalizePath(file.path),
    file_size_bytes: file.size,
    is_hidden: false,
    last_seen_at: now,
    updated_at: now,
  };
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

  if (profile.role !== "SUPER_USER") {
    throw new Error("슈퍼유저 권한이 필요합니다.");
  }

  return profile as {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
  };
}

async function insertScanLog(params: {
  scannedBy: string | null;
  scanType: "ALL" | "LIVE" | "DOCS";
  foundLiveCount: number;
  foundDocsCount: number;
  insertedCount: number;
  updatedCount: number;
  hiddenMissingCount: number;
  status: "SUCCESS" | "FAILED" | "PARTIAL";
  errorMessage?: string | null;
}) {
  const supabase = getAdminSupabase();

  await supabase.from("streaming_scan_logs").insert({
    scanned_by: params.scannedBy,
    scan_type: params.scanType,
    live_root_path: normalizePath(LIVE_ROOT),
    docs_root_path: normalizePath(DOCS_ROOT),
    found_live_count: params.foundLiveCount,
    found_docs_count: params.foundDocsCount,
    inserted_count: params.insertedCount,
    updated_count: params.updatedCount,
    hidden_missing_count: params.hiddenMissingCount,
    status: params.status,
    error_message: params.errorMessage ?? null,
  });
}

export async function POST(request: NextRequest) {
  let actorId: string | null = null;

  try {
    const actor = await getActorProfile(request);
    actorId = actor.id;

    const supabase = getAdminSupabase();

    const normalizedLiveRoot = normalizePath(LIVE_ROOT);
    const normalizedDocsRoot = normalizePath(DOCS_ROOT);

    const [liveFiles, docsFiles] = await Promise.all([
      scanRecursive(normalizedLiveRoot, "LIVE"),
      scanRecursive(normalizedDocsRoot, "DOCS"),
    ]);

    const liveEntries = liveFiles
      .map((file) => parseEntry("LIVE", normalizedLiveRoot, file))
      .filter((entry): entry is ParsedEntry => Boolean(entry));

    const docsEntries = docsFiles
      .map((file) => parseEntry("DOCS", normalizedDocsRoot, file))
      .filter((entry): entry is ParsedEntry => Boolean(entry));

    const entries = [...liveEntries, ...docsEntries];
    const scannedPaths = entries.map((entry) => entry.webdav_path);

    let insertedCount = 0;
    let updatedCount = 0;
    let hiddenMissingCount = 0;

    if (entries.length > 0) {
      const { data: existingRows, error: existingError } = await supabase
        .from("streaming_entries")
        .select("webdav_path")
        .in("webdav_path", scannedPaths);

      if (existingError) {
        throw new Error(existingError.message);
      }

      const existingPathSet = new Set(
        (existingRows ?? []).map((row) => row.webdav_path as string)
      );

      insertedCount = entries.filter(
        (entry) => !existingPathSet.has(entry.webdav_path)
      ).length;

      updatedCount = entries.length - insertedCount;

      const { error: upsertError } = await supabase
        .from("streaming_entries")
        .upsert(entries, {
          onConflict: "webdav_path",
        });

      if (upsertError) {
        throw new Error(upsertError.message);
      }
    }

    const roots = [normalizedLiveRoot, normalizedDocsRoot];

    for (const rootPath of roots) {
      const { data: previousRows, error: previousError } = await supabase
        .from("streaming_entries")
        .select("id, webdav_path")
        .like("webdav_path", `${rootPath}/%`)
        .eq("is_hidden", false);

      if (previousError) {
        throw new Error(previousError.message);
      }

      const missingRows = (previousRows ?? []).filter(
        (row) => !scannedPaths.includes(row.webdav_path as string)
      );

      if (missingRows.length > 0) {
        const missingIds = missingRows.map((row) => row.id as string);

        const { error: hideError } = await supabase
          .from("streaming_entries")
          .update({
            is_hidden: true,
            updated_at: new Date().toISOString(),
          })
          .in("id", missingIds);

        if (hideError) {
          throw new Error(hideError.message);
        }

        hiddenMissingCount += missingRows.length;
      }
    }

    await insertScanLog({
      scannedBy: actor.id,
      scanType: "ALL",
      foundLiveCount: liveEntries.length,
      foundDocsCount: docsEntries.length,
      insertedCount,
      updatedCount,
      hiddenMissingCount,
      status: "SUCCESS",
    });

    return NextResponse.json({
      ok: true,
      foundLiveCount: liveEntries.length,
      foundDocsCount: docsEntries.length,
      insertedCount,
      updatedCount,
      hiddenMissingCount,
    });
  } catch (error) {
    await insertScanLog({
      scannedBy: actorId,
      scanType: "ALL",
      foundLiveCount: 0,
      foundDocsCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      hiddenMissingCount: 0,
      status: "FAILED",
      errorMessage:
        error instanceof Error
          ? error.message
          : "WebDAV 스캔 중 오류가 발생했습니다.",
    }).catch(() => undefined);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "WebDAV 스캔 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
