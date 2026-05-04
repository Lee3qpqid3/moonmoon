"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";
type UserStatus = "ACTIVE" | "DISABLED" | "HIDDEN";

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
  const playRecordedRef = useRef(false);

  const itemId =
    typeof params.itemId === "string"
      ? params.itemId
      : Array.isArray(params.itemId)
        ? params.itemId[0]
        : "";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [entry, setEntry] = useState<StreamingEntry | null>(null);
  const [docs, setDocs] = useState<StreamingEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [entryLoading, setEntryLoading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, [itemId]);

  async function loadPage() {
    playRecordedRef.current = false;

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
    setErrorMessage("");
    setNoticeMessage("");

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
      setDocsLoading(false);
      return;
    }

    const nextEntry = entryRows[0];

    setEntry(nextEntry);

    await recordPlay(nextEntry.id);

    const { data: docsData, error: docsError } = await supabase.rpc(
      "get_my_docs_for_live_entry",
      {
        target_live_entry_id: nextEntry.id,
      }
    );

    setDocsLoading(false);

    if (docsError) {
      setDocs([]);
      return;
    }

    setDocs((docsData ?? []) as StreamingEntry[]);
  }

  async function recordPlay(entryId: string) {
    if (playRecordedRef.current) {
      return;
    }

    playRecordedRef.current = true;

    await supabase.rpc("record_streaming_play", {
      target_entry_id: entryId,
    });
  }

  async function handleDownload(docEntry: StreamingEntry) {
    setNoticeMessage("");

    const { error } = await supabase.rpc("record_streaming_download", {
      target_entry_id: docEntry.id,
    });

    if (error) {
      setNoticeMessage(error.message || "다운로드 기록을 저장하지 못했습니다.");
      return;
    }

    setNoticeMessage("다운로드 기록이 저장되었습니다.");

    window.setTimeout(() => {
      setNoticeMessage("");
    }, 1500);

    /*
      실제 WebDAV 다운로드 API가 붙으면 아래 경로로 교체하면 됩니다.
      예: window.open(`/api/streaming/file/${docEntry.id}`, "_blank")
    */
    window.open(docEntry.webdav_path, "_blank", "noopener,noreferrer");
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

  function getVideoSourceUrl() {
    if (!entry) {
      return "";
    }

    /*
      실제 WebDAV 스트리밍 API가 붙으면 아래 경로로 교체하면 됩니다.
      예: return `/api/streaming/file/${entry.id}`;
      지금은 구조 확인용으로 webdav_path를 사용합니다.
    */
    return entry.webdav_path;
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

          <button
            type="button"
            onClick={() => router.push("/home")}
            style={buttonStyle}
          >
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
              disabled={entryLoading || docsLoading}
              style={{
                ...buttonStyle,
                opacity: entryLoading || docsLoading ? 0.6 : 1,
              }}
            >
              {entryLoading || docsLoading ? "새로고침 중..." : "새로고침"}
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

                <p
                  style={{
                    margin: "6px 0 0",
                    wordBreak: "break-all",
                    fontFamily: "monospace",
                  }}
                >
                  WebDAV 경로: {entry.webdav_path}
                </p>
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
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    borderRadius: "14px",
                    background: "#000000",
                    overflow: "hidden",
                  }}
                >
                  <video
                    src={getVideoSourceUrl()}
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
                </div>

                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: "12px",
                    color: "#d1d5db",
                    lineHeight: 1.5,
                  }}
                >
                  영상 비율이 달라도 화면 안에서 잘리지 않도록 표시됩니다.
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
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: "12px",
                          background: "#f9fafb",
                          color: "#111827",
                          padding: "12px",
                          textAlign: "left",
                          fontSize: "14px",
                          fontWeight: 800,
                        }}
                      >
                        {docEntry.file_name}

                        {getFileSizeLabel(docEntry.file_size_bytes) && (
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
