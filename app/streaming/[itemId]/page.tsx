"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";
type UserStatus = "ACTIVE" | "DISABLED" | "HIDDEN";
type PlaybackMode = "SERVER" | "DIRECT" | "EXTERNAL";

type Profile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  pro_until: string | null;
};

type StreamingEntry = {
  id: string;
  week_name: string;
  teacher_name: string;
  file_name: string;
  title: string;
  file_extension: string | null;
  mime_type: string | null;
  webdav_path: string;
  file_size_bytes: number | null;
  created_at: string;
};

type FileTokenResponse = {
  ok?: boolean;
  fileUrl?: string;
  error?: string;
};

type DirectUrlResponse = {
  ok?: boolean;
  directUrl?: string | null;
  sourceUrl?: string | null;
  headStatus?: number | null;
  headLocation?: string | null;
  rangeStatus?: number | null;
  rangeLocation?: string | null;
  error?: string;
};

const centerStyle = {
  minHeight: "100dvh",
  height: "100dvh",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#ffffff",
  fontFamily: "Arial, sans-serif",
  padding: "20px",
  boxSizing: "border-box" as const,
};

const buttonStyle = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#111827",
  padding: "9px 12px",
  fontSize: "13px",
  fontWeight: 800,
  whiteSpace: "nowrap" as const,
};

export default function StreamingEntryPage() {
  const router = useRouter();
  const params = useParams();

  const itemId =
    typeof params.itemId === "string"
      ? params.itemId
      : Array.isArray(params.itemId)
        ? params.itemId[0]
        : "";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [entry, setEntry] = useState<StreamingEntry | null>(null);
  const [docs, setDocs] = useState<StreamingEntry[]>([]);

  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("SERVER");
  const [serverVideoUrl, setServerVideoUrl] = useState("");
  const [directVideoUrl, setDirectVideoUrl] = useState("");
  const [directDebugMessage, setDirectDebugMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [entryLoading, setEntryLoading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [serverUrlLoading, setServerUrlLoading] = useState(false);
  const [directUrlLoading, setDirectUrlLoading] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState("");
  const [copyingServerUrl, setCopyingServerUrl] = useState(false);
  const [copyingDirectUrl, setCopyingDirectUrl] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, [itemId]);

  const activeVideoUrl = useMemo(() => {
    if (playbackMode === "DIRECT") {
      return directVideoUrl;
    }

    return serverVideoUrl;
  }, [playbackMode, serverVideoUrl, directVideoUrl]);

  async function loadPage() {
    setServerVideoUrl("");
    setDirectVideoUrl("");
    setDirectDebugMessage("");
    setPlaybackMode("SERVER");

    const currentProfile = await loadProfile();

    if (!currentProfile) {
      return;
    }

    if (!hasActiveProFromProfile(currentProfile)) {
      setErrorMessage("Pro 권한이 필요합니다.");
      setLoading(false);
      return;
    }

    await loadEntryAndDocs();
  }

  async function loadProfile() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/");
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, name, role, status, pro_until")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      setErrorMessage("사용자 프로필을 찾을 수 없습니다.");
      setLoading(false);
      return null;
    }

    if (data.status !== "ACTIVE") {
      await supabase.auth.signOut();
      router.push("/");
      return null;
    }

    const nextProfile = data as Profile;

    setProfile(nextProfile);
    setLoading(false);

    return nextProfile;
  }

  async function loadEntryAndDocs() {
    if (!itemId) {
      setErrorMessage("영상 ID를 확인할 수 없습니다.");
      setLoading(false);
      return;
    }

    setEntryLoading(true);
    setDocsLoading(true);
    setServerUrlLoading(true);
    setErrorMessage("");
    setNoticeMessage("");
    setDirectDebugMessage("");
    setServerVideoUrl("");
    setDirectVideoUrl("");

    const { data: entryData, error: entryError } = await supabase.rpc(
      "get_my_live_entry_detail",
      {
        target_entry_id: itemId,
      }
    );

    setEntryLoading(false);

    if (entryError) {
      setErrorMessage(entryError.message || "영상을 불러오지 못했습니다.");
      setEntry(null);
      setDocs([]);
      setServerUrlLoading(false);
      setDocsLoading(false);
      return;
    }

    const entryRows = (entryData ?? []) as StreamingEntry[];

    if (entryRows.length === 0) {
      setErrorMessage(
        "영상을 찾을 수 없거나, 현재 계정에 이 영상의 LIVE 권한이 없습니다."
      );
      setEntry(null);
      setDocs([]);
      setServerUrlLoading(false);
      setDocsLoading(false);
      return;
    }

    const nextEntry = entryRows[0];

    setEntry(nextEntry);

    await Promise.all([loadServerVideoUrl(nextEntry.id), loadDocs(nextEntry.id)]);
  }

  async function loadDocs(liveEntryId: string) {
    const { data: docsData, error: docsError } = await supabase.rpc(
      "get_my_docs_for_live_entry",
      {
        target_live_entry_id: liveEntryId,
      }
    );

    setDocsLoading(false);

    if (docsError) {
      setDocs([]);
      return;
    }

    const sortedDocs = ((docsData ?? []) as StreamingEntry[]).sort((a, b) => {
      return a.file_name.localeCompare(b.file_name, "ko-KR", {
        numeric: true,
      });
    });

    setDocs(sortedDocs);
  }

  async function createFileToken(
    entryId: string,
    purpose: "LIVE" | "DOCS",
    playbackModeValue?: "SERVER" | "EXTERNAL_SERVER"
  ) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("로그인이 필요합니다.");
    }

    const response = await fetch("/api/streaming/file-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        entryId,
        purpose,
        playbackMode:
          purpose === "LIVE" ? playbackModeValue ?? "SERVER" : undefined,
      }),
    });

    const result = (await response.json()) as FileTokenResponse;

    if (!response.ok || !result.ok || !result.fileUrl) {
      throw new Error(result.error || "파일 접근 URL을 발급하지 못했습니다.");
    }

    return result.fileUrl;
  }

  async function createDirectUrl(
    entryId: string,
    playbackModeValue: "DIRECT" | "EXTERNAL_DIRECT" = "DIRECT"
  ) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("로그인이 필요합니다.");
    }

    const response = await fetch("/api/streaming/direct-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        entryId,
        playbackMode: playbackModeValue,
      }),
    });

    const result = (await response.json()) as DirectUrlResponse;

    if (!response.ok || !result.ok || !result.directUrl) {
      const debugParts = [
        result.error,
        result.headStatus !== undefined && result.headStatus !== null
          ? `HEAD ${result.headStatus}`
          : "",
        result.headLocation ? `HEAD location: ${result.headLocation}` : "",
        result.rangeStatus !== undefined && result.rangeStatus !== null
          ? `Range ${result.rangeStatus}`
          : "",
        result.rangeLocation ? `Range location: ${result.rangeLocation}` : "",
      ].filter(Boolean);

      setDirectDebugMessage(debugParts.join(" / "));

      throw new Error(result.error || "직접 재생 URL을 발급하지 못했습니다.");
    }

    setDirectDebugMessage("");

    return result.directUrl;
  }

  async function createExternalServerUrl(entryId: string) {
    return createFileToken(entryId, "LIVE", "EXTERNAL_SERVER");
  }

  async function createExternalDirectUrl(entryId: string) {
    return createDirectUrl(entryId, "EXTERNAL_DIRECT");
  }

  async function loadServerVideoUrl(entryId: string) {
    setServerUrlLoading(true);

    try {
      const fileUrl = await createFileToken(entryId, "LIVE", "SERVER");
      setServerVideoUrl(fileUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "서버 재생 URL을 발급하지 못했습니다."
      );
      setServerVideoUrl("");
    } finally {
      setServerUrlLoading(false);
    }
  }

  async function ensureServerVideoUrl() {
    if (serverVideoUrl) {
      return serverVideoUrl;
    }

    if (!entry) {
      throw new Error("영상 정보를 찾을 수 없습니다.");
    }

    const fileUrl = await createFileToken(entry.id, "LIVE", "SERVER");
    setServerVideoUrl(fileUrl);

    return fileUrl;
  }

  async function ensureDirectVideoUrl() {
    if (directVideoUrl) {
      return directVideoUrl;
    }

    if (!entry) {
      throw new Error("영상 정보를 찾을 수 없습니다.");
    }

    setDirectUrlLoading(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const fileUrl = await createDirectUrl(entry.id, "DIRECT");
      setDirectVideoUrl(fileUrl);

      return fileUrl;
    } finally {
      setDirectUrlLoading(false);
    }
  }

  async function changePlaybackMode(nextMode: PlaybackMode) {
    setPlaybackMode(nextMode);
    setErrorMessage("");
    setNoticeMessage("");

    if (nextMode === "DIRECT") {
      try {
        await ensureDirectVideoUrl();
      } catch (error) {
        setPlaybackMode("SERVER");
        setErrorMessage(
          error instanceof Error
            ? `${error.message} 서버 재생 방식으로 돌아갑니다.`
            : "직접 재생 URL을 준비하지 못했습니다. 서버 재생 방식으로 돌아갑니다."
        );
      }
    }

    if (nextMode === "SERVER") {
      try {
        await ensureServerVideoUrl();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "서버 재생 URL을 준비하지 못했습니다."
        );
      }
    }
  }

  function getAbsoluteFileUrl(fileUrl: string) {
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      return fileUrl;
    }

    return `${window.location.origin}${fileUrl}`;
  }

  async function copyText(value: string, successMessage: string) {
    await navigator.clipboard.writeText(value);

    setNoticeMessage(successMessage);

    window.setTimeout(() => {
      setNoticeMessage("");
    }, 2500);
  }

  async function handleCopyServerUrl() {
    setCopyingServerUrl(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      if (!entry) {
        throw new Error("영상 정보를 찾을 수 없습니다.");
      }

      const fileUrl = await createExternalServerUrl(entry.id);
      const absoluteUrl = getAbsoluteFileUrl(fileUrl);

      await copyText(
        absoluteUrl,
        "서버 재생 URL을 복사했습니다. 외부 플레이어에서 네트워크 URL로 열 수 있습니다."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "서버 재생 URL을 복사하지 못했습니다."
      );
    } finally {
      setCopyingServerUrl(false);
    }
  }

  async function handleCopyDirectUrl() {
    setCopyingDirectUrl(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      if (!entry) {
        throw new Error("영상 정보를 찾을 수 없습니다.");
      }

      const fileUrl = await createExternalDirectUrl(entry.id);

      await copyText(
        fileUrl,
        "직접 재생 URL을 복사했습니다. PotPlayer나 VLC의 네트워크 URL 열기에 붙여넣으면 됩니다."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "직접 재생 URL을 복사하지 못했습니다."
      );
    } finally {
      setCopyingDirectUrl(false);
    }
  }

  async function handleDownload(docEntry: StreamingEntry) {
    setNoticeMessage("");
    setErrorMessage("");
    setDownloadingDocId(docEntry.id);

    try {
      const fileUrl = await createFileToken(docEntry.id, "DOCS");

      setNoticeMessage("자료 다운로드를 시작합니다.");

      window.setTimeout(() => {
        setNoticeMessage("");
      }, 1500);

      window.open(fileUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "자료 다운로드 URL을 발급하지 못했습니다."
      );
    } finally {
      setDownloadingDocId("");
    }
  }

  function hasActiveProFromProfile(targetProfile: Profile) {
    if (!targetProfile.pro_until) {
      return false;
    }

    return new Date(targetProfile.pro_until).getTime() > Date.now();
  }

  function hasActivePro() {
    if (!profile) {
      return false;
    }

    return hasActiveProFromProfile(profile);
  }

  function getProLabel() {
    if (!profile?.pro_until) {
      return "일반 등급";
    }

    const proUntilDate = new Date(profile.pro_until);

    if (proUntilDate.getTime() <= Date.now()) {
      return "일반 등급";
    }

    return `Pro · ${getDateTimeLabel(profile.pro_until)}까지`;
  }

  function getDateTimeLabel(dateText: string | null) {
    if (!dateText) {
      return "-";
    }

    return new Date(dateText).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function getFileSizeLabel(bytes: number | null) {
    if (!bytes || bytes <= 0) {
      return "";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size = size / 1024;
      unitIndex += 1;
    }

    return `${size.toFixed(size >= 10 ? 0 : 1)}${units[unitIndex]}`;
  }

  function getPlaybackButtonStyle(targetMode: PlaybackMode) {
    const selected = playbackMode === targetMode;

    return {
      border: selected ? "1px solid #111827" : "1px solid #d1d5db",
      borderRadius: "999px",
      background: selected ? "#111827" : "#ffffff",
      color: selected ? "#ffffff" : "#111827",
      padding: "9px 12px",
      fontSize: "13px",
      fontWeight: 900,
      whiteSpace: "nowrap" as const,
    };
  }

  if (loading) {
    return (
      <main style={centerStyle}>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          스트리밍 영상을 불러오는 중입니다...
        </p>
      </main>
    );
  }

  if (!hasActivePro()) {
    return (
      <main style={centerStyle}>
        <section
          style={{
            width: "100%",
            maxWidth: "460px",
            border: "1px solid #fde68a",
            borderRadius: "20px",
            padding: "28px",
            background: "#fffbeb",
            boxSizing: "border-box",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 900,
              color: "#92400e",
            }}
          >
            Pro 권한이 필요합니다
          </h1>

          <p
            style={{
              marginTop: "12px",
              fontSize: "14px",
              color: "#78350f",
              lineHeight: 1.7,
            }}
          >
            스트리밍 영상은 Pro 기간이 활성화된 계정만 이용할 수 있습니다.
            시리얼키를 등록한 뒤 다시 접속해 주세요.
          </p>

          <div style={{ marginTop: "20px", display: "grid", gap: "10px" }}>
            <button
              type="button"
              onClick={() => router.push("/serial-key")}
              style={{
                border: "none",
                borderRadius: "10px",
                background: "#92400e",
                color: "#ffffff",
                padding: "12px",
                fontSize: "14px",
                fontWeight: 800,
              }}
            >
              시리얼키 등록하기
            </button>

            <button
              type="button"
              onClick={() => router.push("/home")}
              style={{
                border: "1px solid #fbbf24",
                borderRadius: "10px",
                background: "#ffffff",
                color: "#92400e",
                padding: "12px",
                fontSize: "14px",
                fontWeight: 800,
              }}
            >
              홈으로 돌아가기
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#ffffff",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid #e5e7eb",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          boxSizing: "border-box",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 800,
              color: "#111827",
            }}
          >
            스트리밍 영상
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            영상과 연결된 자료를 확인합니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => router.push("/streaming")}
            style={buttonStyle}
          >
            목록
          </button>

          <button
            type="button"
            onClick={() => router.push("/streaming/schedule")}
            style={buttonStyle}
          >
            일정표
          </button>

          <button type="button" onClick={() => router.push("/home")} style={buttonStyle}>
            홈
          </button>
        </div>
      </header>

      <section
        style={{
          maxWidth: "1120px",
          margin: "0 auto",
          padding: "28px 20px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#2563eb",
                  fontWeight: 900,
                }}
              >
                {entry ? `${entry.week_name} · ${entry.teacher_name}` : "영상"}
              </p>

              <h2
                style={{
                  margin: "8px 0 0",
                  fontSize: "26px",
                  fontWeight: 900,
                  color: "#111827",
                  lineHeight: 1.35,
                  wordBreak: "break-word",
                }}
              >
                {entry?.title ?? "영상을 불러오지 못했습니다"}
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                {profile?.name} · {profile?.email} · {getProLabel()}
              </p>
            </div>

            <button
              type="button"
              onClick={loadEntryAndDocs}
              disabled={entryLoading || docsLoading || serverUrlLoading}
              style={{
                ...buttonStyle,
                opacity: entryLoading || docsLoading || serverUrlLoading ? 0.6 : 1,
              }}
            >
              {entryLoading || docsLoading || serverUrlLoading
                ? "새로고침 중..."
                : "새로고침"}
            </button>
          </div>

          {errorMessage && (
            <div
              style={{
                marginTop: "18px",
                border: "1px solid #fecaca",
                borderRadius: "14px",
                background: "#fff1f2",
                padding: "14px",
                color: "#991b1b",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              {errorMessage}
            </div>
          )}

          {noticeMessage && (
            <div
              style={{
                marginTop: "18px",
                border: "1px solid #bbf7d0",
                borderRadius: "14px",
                background: "#f0fdf4",
                padding: "14px",
                color: "#166534",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              {noticeMessage}
            </div>
          )}

          {entry && (
            <>
              <div
                style={{
                  marginTop: "18px",
                  borderRadius: "14px",
                  background: "#f9fafb",
                  padding: "14px",
                  fontSize: "13px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                <p style={{ margin: 0 }}>파일명: {entry.file_name}</p>

                {getFileSizeLabel(entry.file_size_bytes) && (
                  <p style={{ margin: "6px 0 0" }}>
                    파일 크기: {getFileSizeLabel(entry.file_size_bytes)}
                  </p>
                )}

                <p style={{ margin: "6px 0 0" }}>
                  등록일: {getDateTimeLabel(entry.created_at)}
                </p>
              </div>

              <div
                style={{
                  marginTop: "18px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "16px",
                  padding: "14px",
                  background: "#ffffff",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "#6b7280",
                    fontWeight: 800,
                  }}
                >
                  재생 방식
                </p>

                <div
                  style={{
                    marginTop: "10px",
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => changePlaybackMode("SERVER")}
                    style={getPlaybackButtonStyle("SERVER")}
                  >
                    서버 재생
                  </button>

                  <button
                    type="button"
                    onClick={() => changePlaybackMode("DIRECT")}
                    disabled={directUrlLoading}
                    style={{
                      ...getPlaybackButtonStyle("DIRECT"),
                      opacity: directUrlLoading ? 0.6 : 1,
                    }}
                  >
                    {directUrlLoading ? "직접 링크 확인 중..." : "직접 링크 재생"}
                  </button>

                  <button
                    type="button"
                    onClick={() => changePlaybackMode("EXTERNAL")}
                    style={getPlaybackButtonStyle("EXTERNAL")}
                  >
                    외부 플레이어
                  </button>
                </div>

                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: "12px",
                    color: "#6b7280",
                    lineHeight: 1.5,
                  }}
                >
                  서버 재생은 안정적이지만 느릴 수 있습니다. 직접 링크 재생은
                  빠를 수 있지만 PikPak 링크가 발급되지 않으면 사용할 수 없습니다.
                </p>

                {directDebugMessage && (
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "11px",
                      color: "#9ca3af",
                      lineHeight: 1.5,
                      wordBreak: "break-word",
                    }}
                  >
                    직접 링크 확인 정보: {directDebugMessage}
                  </p>
                )}
              </div>

              <div
                style={{
                  marginTop: "20px",
                  borderRadius: "20px",
                  background: "#111827",
                  padding: "14px",
                  boxSizing: "border-box",
                }}
              >
                {playbackMode === "EXTERNAL" ? (
                  <div
                    style={{
                      minHeight: "260px",
                      borderRadius: "14px",
                      background: "#000000",
                      color: "#d1d5db",
                      padding: "22px",
                      boxSizing: "border-box",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      gap: "14px",
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "18px",
                        color: "#ffffff",
                        fontWeight: 900,
                      }}
                    >
                      외부 플레이어로 재생
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        lineHeight: 1.6,
                      }}
                    >
                      PotPlayer 또는 VLC에서 네트워크 URL 열기를 선택한 뒤 아래
                      URL을 붙여넣어 재생할 수 있습니다.
                    </p>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        onClick={handleCopyServerUrl}
                        disabled={copyingServerUrl || serverUrlLoading}
                        style={{
                          border: "1px solid #374151",
                          borderRadius: "10px",
                          background: "#ffffff",
                          color: "#111827",
                          padding: "10px 12px",
                          fontSize: "13px",
                          fontWeight: 900,
                          opacity:
                            copyingServerUrl || serverUrlLoading ? 0.6 : 1,
                        }}
                      >
                        {copyingServerUrl ? "복사 중..." : "서버 URL 복사"}
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyDirectUrl}
                        disabled={copyingDirectUrl || directUrlLoading}
                        style={{
                          border: "1px solid #374151",
                          borderRadius: "10px",
                          background: "#ffffff",
                          color: "#111827",
                          padding: "10px 12px",
                          fontSize: "13px",
                          fontWeight: 900,
                          opacity:
                            copyingDirectUrl || directUrlLoading ? 0.6 : 1,
                        }}
                      >
                        {copyingDirectUrl
                          ? "복사 중..."
                          : "직접 링크 URL 복사"}
                      </button>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        fontSize: "12px",
                        color: "#9ca3af",
                        lineHeight: 1.5,
                      }}
                    >
                      서버 URL은 느릴 수 있지만 안정적입니다. 직접 링크 URL은
                      빠를 수 있지만 발급되지 않거나 만료될 수 있습니다.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "16 / 9",
                      borderRadius: "14px",
                      background: "#000000",
                      overflow: "hidden",
                    }}
                  >
                    {serverUrlLoading || directUrlLoading ? (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#d1d5db",
                          fontSize: "14px",
                        }}
                      >
                        영상 접근 URL을 준비하는 중입니다...
                      </div>
                    ) : activeVideoUrl ? (
                      <video
                        key={`${playbackMode}-${activeVideoUrl}`}
                        src={activeVideoUrl}
                        controls
                        playsInline
                        preload="metadata"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          display: "block",
                          background: "#000000",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#d1d5db",
                          fontSize: "14px",
                          textAlign: "center",
                          padding: "18px",
                          boxSizing: "border-box",
                        }}
                      >
                        영상 접근 URL을 발급하지 못했습니다. 새로고침을 눌러 다시
                        시도해 주세요.
                      </div>
                    )}
                  </div>
                )}

                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: "12px",
                    color: "#d1d5db",
                    lineHeight: 1.5,
                  }}
                >
                  현재 선택된 방식:{" "}
                  {playbackMode === "SERVER"
                    ? "서버 재생"
                    : playbackMode === "DIRECT"
                      ? "직접 링크 재생"
                      : "외부 플레이어"}
                </p>
              </div>

              <div
                style={{
                  marginTop: "20px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "18px",
                  padding: "18px",
                  background: "#ffffff",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "20px",
                    fontWeight: 900,
                    color: "#111827",
                  }}
                >
                  자료
                </h3>

                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: "14px",
                    color: "#6b7280",
                    lineHeight: 1.6,
                  }}
                >
                  DOCS 권한이 있는 경우 이 영상과 같은 주차/강사의 자료가
                  표시됩니다.
                </p>

                {docsLoading ? (
                  <p
                    style={{
                      margin: "16px 0 0",
                      fontSize: "14px",
                      color: "#6b7280",
                    }}
                  >
                    자료를 불러오는 중입니다...
                  </p>
                ) : docs.length === 0 ? (
                  <p
                    style={{
                      margin: "16px 0 0",
                      fontSize: "14px",
                      color: "#6b7280",
                    }}
                  >
                    표시할 자료가 없습니다. 자료 권한이 없거나 등록된 자료가
                    없습니다.
                  </p>
                ) : (
                  <div
                    style={{
                      marginTop: "16px",
                      display: "grid",
                      gap: "8px",
                    }}
                  >
                    {docs.map((docEntry) => (
                      <button
                        key={docEntry.id}
                        type="button"
                        onClick={() => handleDownload(docEntry)}
                        disabled={downloadingDocId === docEntry.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: "12px",
                          background: "#f9fafb",
                          color: "#111827",
                          padding: "12px",
                          textAlign: "left",
                          fontSize: "14px",
                          fontWeight: 800,
                          opacity: downloadingDocId === docEntry.id ? 0.6 : 1,
                        }}
                      >
                        {downloadingDocId === docEntry.id
                          ? "다운로드 준비 중..."
                          : docEntry.file_name}

                        {getFileSizeLabel(docEntry.file_size_bytes) &&
                          downloadingDocId !== docEntry.id && (
                            <span
                              style={{
                                marginLeft: "8px",
                                fontSize: "12px",
                                color: "#6b7280",
                                fontWeight: 500,
                              }}
                            >
                              {getFileSizeLabel(docEntry.file_size_bytes)}
                            </span>
                          )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
