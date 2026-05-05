import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EntryKind = "LIVE" | "DOCS";
type ScanStatus = "SUCCESS" | "FAILED" | "PARTIAL";

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

type ActorProfile = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN" | "SUPER_USER";
  status: "ACTIVE" | "DISABLED" | "HIDDEN";
};

type SingleScanResult = {
  kind: EntryKind;
  rootPath: string;
  ok: boolean;
  files: WebDavFile[];
  entries: ParsedEntry[];
  errorMessage: string | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WEBDAV_URL = process.env.PIKPAK_WEBDAV_URL;
const WEBDAV_USERNAME = process.env.PIKPAK_WEBDAV_USERNAME;
const WEBDAV_PASSWORD = process.env.PIKPAK_WEBDAV_PASSWORD;
const LIVE_ROOT = process.env.PIKPAK_WEBDAV_LIVE_ROOT || "/moonmoon/live";
const DOCS_ROOT = process.env.PIKPAK_WEBDAV_DOCS_ROOT || "/moonmoon/docs";

const MAX_DIRECTORIES_PER_ROOT = 1500;
const MAX_FILES_PER_ROOT = 5000;

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
  const baseUrl = getWebDavBaseUrl();
  const encodedPath = encodePathForUrl(path);

  return `${baseUrl}${encodedPath}`;
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
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function getTagValue(xml: string, tagName: string) {
  const regex = new RegExp(
    `<[^:>]*:?${tagName}[^>]*>([\\s\\S]*?)<\\/[^:>]*:?${tagName}>`,
    "i"
  );

  const match = xml.match(regex);

  if (!match) {
    return null;
  }

  return decodeXmlText(stripXmlTags(match[1]));
}

function isDirectoryResponse(xml: string) {
  return /<[^:>]*:?collection\s*\/?>/i.test(xml);
}

function removeQueryAndHash(path: string) {
  return path.split("?")[0].split("#")[0];
}

function hrefToPath(href: string) {
  const xmlDecodedHref = decodeXmlText(href);

  try {
    const url = new URL(xmlDecodedHref, getWebDavBaseUrl());
    return normalizePath(removeQueryAndHash(url.pathname));
  } catch {
    return normalizePath(removeQueryAndHash(xmlDecodedHref));
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
    lower === "desktop.ini" ||
    lower.startsWith("._")
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

function parseNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

async function propfind(path: string) {
  const normalizedPath = normalizePath(path);
  const requestUrl = buildWebDavUrl(normalizedPath);

  const response = await fetch(requestUrl, {
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
    const errorText = await response.text().catch(() => "");

    throw new Error(
      `WebDAV PROPFIND 실패: ${normalizedPath} / 요청 URL ${requestUrl} / 상태 코드 ${response.status}${
        errorText ? ` / ${errorText.slice(0, 300)}` : ""
      }`
    );
  }

  return response.text();
}

function parsePropfindResponses(xml: string) {
  const responseRegex =
    /<[^:>]*:?response(?:\s[^>]*)?>([\s\S]*?)<\/[^:>]*:?response>/gi;

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
    const size = parseNumber(sizeText);

    responses.push({
      href,
      path,
      isDirectory: isDirectoryResponse(responseXml) || href.endsWith("/"),
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
  const filePathSet = new Set<string>();
  const files: WebDavFile[] = [];

  while (queue.length > 0) {
    if (visited.size > MAX_DIRECTORIES_PER_ROOT) {
      throw new Error(
        `${kind} 스캔 중 폴더 수가 너무 많습니다. 최대 ${MAX_DIRECTORIES_PER_ROOT}개까지만 허용합니다.`
      );
    }

    if (files.length > MAX_FILES_PER_ROOT) {
      throw new Error(
        `${kind} 스캔 중 파일 수가 너무 많습니다. 최대 ${MAX_FILES_PER_ROOT}개까지만 허용합니다.`
      );
    }

    const currentPath = queue.shift();

    if (!currentPath) {
      continue;
    }

    const normalizedCurrentPath = normalizePath(currentPath);

    if (visited.has(normalizedCurrentPath)) {
      continue;
    }

    visited.add(normalizedCurrentPath);

    const xml = await propfind(normalizedCurrentPath);
    const responses = parsePropfindResponses(xml);

    for (const response of responses) {
      const responsePath = normalizePath(response.path);

      if (responsePath === normalizedCurrentPath) {
        continue;
      }

      if (!responsePath.startsWith(normalizedRoot)) {
        continue;
      }

      if (response.isDirectory) {
        if (!visited.has(responsePath)) {
          queue.push(responsePath);
        }

        continue;
      }

      const fileName = getFileNameFromPath(responsePath);

      if (!shouldUseAsFile(fileName, kind)) {
        continue;
      }

      if (filePathSet.has(responsePath)) {
        continue;
      }

      filePathSet.add(responsePath);

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

function parseEntry(
  kind: EntryKind,
  rootPath: string,
  file: WebDavFile
): ParsedEntry | null {
  const relativePath = getRelativePath(rootPath, file.path);
  const parts = relativePath.split("/").filter(Boolean);

  if (parts.length < 3) {
    return null;
  }

  const weekName = parts[0]?.trim();
  const teacherName = parts[1]?.trim();
  const pureFileName = getFileNameFromPath(parts.slice(2).join("/"));

  if (!weekName || !teacherName || !pureFileName) {
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

async function scanRoot(
  kind: EntryKind,
  rootPath: string
): Promise<SingleScanResult> {
  const normalizedRoot = normalizePath(rootPath);

  try {
    const files = await scanRecursive(normalizedRoot, kind);
    const entries = files
      .map((file) => parseEntry(kind, normalizedRoot, file))
      .filter((entry): entry is ParsedEntry => Boolean(entry));

    return {
      kind,
      rootPath: normalizedRoot,
      ok: true,
      files,
      entries,
      errorMessage: null,
    };
  } catch (error) {
    return {
      kind,
      rootPath: normalizedRoot,
      ok: false,
      files: [],
      entries: [],
      errorMessage:
        error instanceof Error
          ? error.message
          : `${kind} 스캔 중 알 수 없는 오류가 발생했습니다.`,
    };
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

async function insertScanLog(params: {
  scannedBy: string | null;
  scanType: "ALL" | "LIVE" | "DOCS";
  liveRootPath: string;
  docsRootPath: string;
  foundLiveCount: number;
  foundDocsCount: number;
  insertedCount: number;
  updatedCount: number;
  hiddenMissingCount: number;
  status: ScanStatus;
  errorMessage?: string | null;
}) {
  const supabase = getAdminSupabase();

  await supabase.from("streaming_scan_logs").insert({
    scanned_by: params.scannedBy,
    scan_type: params.scanType,
    live_root_path: params.liveRootPath,
    docs_root_path: params.docsRootPath,
    found_live_count: params.foundLiveCount,
    found_docs_count: params.foundDocsCount,
    inserted_count: params.insertedCount,
    updated_count: params.updatedCount,
    hidden_missing_count: params.hiddenMissingCount,
    status: params.status,
    error_message: params.errorMessage ?? null,
  });
}

async function upsertEntries(entries: ParsedEntry[]) {
  if (entries.length === 0) {
    return {
      insertedCount: 0,
      updatedCount: 0,
    };
  }

  const supabase = getAdminSupabase();
  const scannedPaths = entries.map((entry) => entry.webdav_path);

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

  const insertedCount = entries.filter(
    (entry) => !existingPathSet.has(entry.webdav_path)
  ).length;

  const updatedCount = entries.length - insertedCount;

  for (const entry of entries) {
    const { error } = await supabase.from("streaming_entries").upsert(entry, {
      onConflict: "webdav_path",
    });

    if (error) {
      const { error: fallbackError } = await supabase
        .from("streaming_entries")
        .update({
          entry_kind: entry.entry_kind,
          week_name: entry.week_name,
          teacher_name: entry.teacher_name,
          file_name: entry.file_name,
          title: entry.title,
          file_extension: entry.file_extension,
          mime_type: entry.mime_type,
          file_size_bytes: entry.file_size_bytes,
          is_hidden: false,
          last_seen_at: entry.last_seen_at,
          updated_at: entry.updated_at,
        })
        .eq("webdav_path", entry.webdav_path);

      if (fallbackError) {
        const { error: insertError } = await supabase
          .from("streaming_entries")
          .insert(entry);

        if (insertError) {
          throw new Error(insertError.message);
        }
      }
    }
  }

  return {
    insertedCount,
    updatedCount,
  };
}

async function hideMissingEntries(params: {
  successfulRoots: string[];
  scannedPaths: string[];
}) {
  if (params.successfulRoots.length === 0) {
    return 0;
  }

  const supabase = getAdminSupabase();
  const scannedPathSet = new Set(params.scannedPaths);
  let hiddenMissingCount = 0;

  for (const rootPath of params.successfulRoots) {
    const normalizedRootPath = normalizePath(rootPath);

    const { data: previousRows, error: previousError } = await supabase
      .from("streaming_entries")
      .select("id, webdav_path")
      .like("webdav_path", `${normalizedRootPath}/%`)
      .eq("is_hidden", false);

    if (previousError) {
      throw new Error(previousError.message);
    }

    const missingRows = (previousRows ?? []).filter(
      (row) => !scannedPathSet.has(row.webdav_path as string)
    );

    if (missingRows.length === 0) {
      continue;
    }

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

  return hiddenMissingCount;
}

function getScanStatus(results: SingleScanResult[]): ScanStatus {
  const successCount = results.filter((result) => result.ok).length;

  if (successCount === results.length) {
    return "SUCCESS";
  }

  if (successCount === 0) {
    return "FAILED";
  }

  return "PARTIAL";
}

function getCombinedErrorMessage(results: SingleScanResult[]) {
  const messages = results
    .filter((result) => !result.ok && result.errorMessage)
    .map((result) => `${result.kind}: ${result.errorMessage}`);

  if (messages.length === 0) {
    return null;
  }

  return messages.join("\n");
}

export async function POST(request: NextRequest) {
  let actorId: string | null = null;

  const normalizedLiveRoot = normalizePath(LIVE_ROOT);
  const normalizedDocsRoot = normalizePath(DOCS_ROOT);

  try {
    const actor = await getActorProfile(request);
    actorId = actor.id;

    const [liveResult, docsResult] = await Promise.all([
      scanRoot("LIVE", normalizedLiveRoot),
      scanRoot("DOCS", normalizedDocsRoot),
    ]);

    const results = [liveResult, docsResult];
    const status = getScanStatus(results);
    const errorMessage = getCombinedErrorMessage(results);

    const successfulResults = results.filter((result) => result.ok);
    const entries = successfulResults.flatMap((result) => result.entries);
    const scannedPaths = entries.map((entry) => entry.webdav_path);
    const successfulRoots = successfulResults.map((result) => result.rootPath);

    let insertedCount = 0;
    let updatedCount = 0;
    let hiddenMissingCount = 0;

    if (entries.length > 0) {
      const upsertResult = await upsertEntries(entries);
      insertedCount = upsertResult.insertedCount;
      updatedCount = upsertResult.updatedCount;
    }

    if (successfulRoots.length > 0) {
      hiddenMissingCount = await hideMissingEntries({
        successfulRoots,
        scannedPaths,
      });
    }

    await insertScanLog({
      scannedBy: actor.id,
      scanType: "ALL",
      liveRootPath: normalizedLiveRoot,
      docsRootPath: normalizedDocsRoot,
      foundLiveCount: liveResult.entries.length,
      foundDocsCount: docsResult.entries.length,
      insertedCount,
      updatedCount,
      hiddenMissingCount,
      status,
      errorMessage,
    });

    const httpStatus = status === "FAILED" ? 500 : 200;

    return NextResponse.json(
      {
        ok: status !== "FAILED",
        status,
        foundLiveCount: liveResult.entries.length,
        foundDocsCount: docsResult.entries.length,
        insertedCount,
        updatedCount,
        hiddenMissingCount,
        error: errorMessage,
      },
      {
        status: httpStatus,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "WebDAV 스캔 중 오류가 발생했습니다.";

    await insertScanLog({
      scannedBy: actorId,
      scanType: "ALL",
      liveRootPath: normalizedLiveRoot,
      docsRootPath: normalizedDocsRoot,
      foundLiveCount: 0,
      foundDocsCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      hiddenMissingCount: 0,
      status: "FAILED",
      errorMessage,
    }).catch(() => undefined);

    return NextResponse.json(
      {
        ok: false,
        status: "FAILED",
        error: errorMessage,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  }
}
