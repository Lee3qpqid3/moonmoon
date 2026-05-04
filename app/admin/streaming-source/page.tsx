"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";
type UserStatus = "ACTIVE" | "DISABLED" | "HIDDEN";

type AdminProfile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
};

type StreamingEntryKind = "LIVE" | "DOCS";

type StreamingEntry = {
  id: string;
  entry_kind: StreamingEntryKind;
  week_name: string;
  teacher_name: string;
  file_name: string;
  title: string;
  file_extension: string | null;
  mime_type: string | null;
  webdav_path: string;
  file_size_bytes: number | null;
  is_hidden: boolean;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

type DownloadLog = {
  log_id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  entry_id: string | null;
  week_name: string | null;
  teacher_name: string | null;
  file_name: string | null;
  webdav_path: string | null;
  downloaded_at: string;
};

const pageStyle = {
  minHeight: "100dvh",
  background: "#ffffff",
  fontFamily: "Arial, sans-serif",
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

const cardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: "20px",
  padding: "24px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
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

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "11px",
  fontSize: "14px",
  background: "#ffffff",
  color: "#111827",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontSize: "13px",
  fontWeight: 800,
  color: "#374151",
};

export default function AdminStreamingSourcePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [entries, setEntries] = useState<StreamingEntry[]>([]);
  const [downloadLogs, setDownloadLogs] = useState<DownloadLog[]>([]);

  const [entryKindFilter, setEntryKindFilter] = useState<"ALL" | StreamingEntryKind>(
    "ALL"
  );
  const [weekFilter, setWeekFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [downloadLogsLoading, setDownloadLogsLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [denied, setDenied] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    checkSuperUserAndLoadSource();
  }, []);

  async function checkSuperUserAndLoadSource() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, name, role, status")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      setDenied(true);
      setLoading(false);
      return;
    }

    if (data.status !== "ACTIVE") {
      await supabase.auth.signOut();
      router.push("/");
      return;
    }

    if (data.role !== "SUPER_USER") {
      setDenied(true);
      setLoading(false);
      return;
    }

    setProfile(data as AdminProfile);
    setLoading(false);

    await Promise.all([loadEntries(), loadDownloadLogs()]);
  }

  async function loadEntries() {
    setEntriesLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("streaming_entries")
      .select(
        "id, entry_kind, week_name, teacher_name, file_name, title, file_extension, mime_type, webdav_path, file_size_bytes, is_hidden, first_seen_at, last_seen_at, created_at, updated_at"
      )
      .eq("is_hidden", false)
      .order("week_name", { ascending: true })
      .order("teacher_name", { ascending: true })
      .order("file_name", { ascending: true });

    setEntriesLoading(false);

    if (error) {
      setErrorMessage(error.message || "스캔 결과를 불러오지 못했습니다.");
      setEntries([]);
      return;
    }

    setEntries((data ?? []) as StreamingEntry[]);
  }

  async function loadDownloadLogs() {
    setDownloadLogsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.rpc(
      "super_get_streaming_download_logs",
      {
        log_limit: 300,
      }
    );

    setDownloadLogsLoading(false);

    if (error) {
      setErrorMessage(error.message || "다운로드 기록을 불러오지 못했습니다.");
      setDownloadLogs([]);
      return;
    }

    setDownloadLogs((data ?? []) as DownloadLog[]);
  }

  async function handleWebDavScan() {
    setErrorMessage("");
    setSuccessMessage("");

    const confirmed = window.confirm(
      "PikPak WebDAV의 /moonmoon/live, /moonmoon/docs 폴더를 스캔할까요?"
    );

    if (!confirmed) {
      return;
    }

    setScanning(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setErrorMessage("로그인이 필요합니다.");
        return;
      }

      const response = await fetch("/api/admin/webdav/scan", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = (await response.json()) as {
        ok?: boolean;
        foundLiveCount?: number;
        foundDocsCount?: number;
        insertedCount?: number;
        updatedCount?: number;
        hiddenMissingCount?: number;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        setErrorMessage(result.error || "WebDAV 스캔에 실패했습니다.");
        return;
      }

      setSuccessMessage(
        `WebDAV 스캔이 완료되었습니다. LIVE ${
          result.foundLiveCount ?? 0
        }개, DOCS ${result.foundDocsCount ?? 0}개, 신규 ${
          result.insertedCount ?? 0
        }개, 갱신 ${result.updatedCount ?? 0}개, 제외 ${
          result.hiddenMissingCount ?? 0
        }개`
      );

      await Promise.all([loadEntries(), loadDownloadLogs()]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "WebDAV 스캔 중 오류가 발생했습니다."
      );
    } finally {
      setScanning(false);
    }
  }

  function getDateTimeLabel(dateText: string | null) {
    if (!dateText) return "-";

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
      return "-";
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

  function getKindLabel(kind: StreamingEntryKind) {
    if (kind === "LIVE") return "영상";
    return "자료";
  }

  function getKindColor(kind: StreamingEntryKind) {
    if (kind === "LIVE") return "#2563eb";
    return "#15803d";
  }

  const weekOptions = useMemo(() => {
    return Array.from(new Set(entries.map((entry) => entry.week_name))).sort(
      (a, b) => a.localeCompare(b, "ko-KR", { numeric: true })
    );
  }, [entries]);

  const teacherOptions = useMemo(() => {
    const filtered = weekFilter
      ? entries.filter((entry) => entry.week_name === weekFilter)
      : entries;

    return Array.from(new Set(filtered.map((entry) => entry.teacher_name))).sort(
      (a, b) => a.localeCompare(b, "ko-KR", { numeric: true })
    );
  }, [entries, weekFilter]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (entryKindFilter !== "ALL" && entry.entry_kind !== entryKindFilter) {
        return false;
      }

      if (weekFilter && entry.week_name !== weekFilter) {
        return false;
      }

      if (teacherFilter && entry.teacher_name !== teacherFilter) {
        return false;
      }

      return true;
    });
  }, [entries, entryKindFilter, weekFilter, teacherFilter]);

  const liveCount = entries.filter((entry) => entry.entry_kind === "LIVE").length;
  const docsCount = entries.filter((entry) => entry.entry_kind === "DOCS").length;

  function resetFilters() {
    setEntryKindFilter("ALL");
    setWeekFilter("");
    setTeacherFilter("");
  }

  if (loading) {
    return (
      <main style={centerStyle}>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          슈퍼유저 권한을 확인하는 중입니다...
        </p>
      </main>
    );
  }

  if (denied) {
    return (
      <main style={centerStyle}>
        <section
          style={{
            width: "100%",
            maxWidth: "420px",
            border: "1px solid #fecaca",
            borderRadius: "20px",
            padding: "28px",
            background: "#fff1f2",
            boxSizing: "border-box",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 800,
              color: "#991b1b",
            }}
          >
            접근할 수 없습니다
          </h1>

          <p
            style={{
              marginTop: "12px",
              fontSize: "14px",
              color: "#7f1d1d",
              lineHeight: 1.6,
            }}
          >
            스트리밍 소스 관리는 슈퍼유저 계정만 접근할 수 있습니다.
          </p>

          <button
            onClick={() => router.push("/admin")}
            style={{
              width: "100%",
              marginTop: "20px",
              border: "none",
              borderRadius: "10px",
              background: "#991b1b",
              color: "#ffffff",
              padding: "12px",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            관리자 페이지로 돌아가기
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
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
            스트리밍 소스 관리
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            PikPak WebDAV의 live/docs 폴더를 스캔해 스트리밍 소스를 관리합니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/streaming")} style={buttonStyle}>
            스트리밍 보기
          </button>

          <button onClick={() => router.push("/admin")} style={buttonStyle}>
            관리자
          </button>
        </div>
      </header>

      <section
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "28px 20px",
          boxSizing: "border-box",
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              borderRadius: "14px",
              background: "#f9fafb",
              padding: "16px",
            }}
          >
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
              현재 슈퍼유저
            </p>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "15px",
                fontWeight: 800,
                color: "#111827",
                wordBreak: "break-all",
              }}
            >
              {profile?.name} · {profile?.email}
            </p>
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
                lineHeight: 1.5,
              }}
            >
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div
              style={{
                marginTop: "18px",
                border: "1px solid #bbf7d0",
                borderRadius: "14px",
                background: "#f0fdf4",
                padding: "14px",
                color: "#166534",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              {successMessage}
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, marginTop: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>
                WebDAV 스캔
              </h2>

              <p
                style={{
                  marginTop: "8px",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                `/moonmoon/live/주차/강사명/영상파일`, `/moonmoon/docs/주차/강사명/자료파일`
                구조를 스캔해 자동 등록합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={handleWebDavScan}
              disabled={scanning}
              style={{
                border: "none",
                borderRadius: "10px",
                background: "#111827",
                color: "#ffffff",
                padding: "12px 14px",
                fontSize: "14px",
                fontWeight: 800,
                opacity: scanning ? 0.6 : 1,
              }}
            >
              {scanning ? "스캔 중..." : "WebDAV 스캔 실행"}
            </button>
          </div>

          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "16px",
                background: "#f9fafb",
                padding: "16px",
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
                전체 파일
              </p>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "22px",
                  color: "#111827",
                  fontWeight: 900,
                }}
              >
                {entries.length}개
              </p>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "16px",
                background: "#f9fafb",
                padding: "16px",
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
                LIVE
              </p>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "22px",
                  color: "#2563eb",
                  fontWeight: 900,
                }}
              >
                {liveCount}개
              </p>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "16px",
                background: "#f9fafb",
                padding: "16px",
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
                DOCS
              </p>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "22px",
                  color: "#15803d",
                  fontWeight: 900,
                }}
              >
                {docsCount}개
              </p>
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, marginTop: "20px" }}>
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
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>
                스캔 결과
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                WebDAV에서 발견된 영상과 자료 목록입니다. 파일명 기준 가나다순으로
                정렬됩니다.
              </p>
            </div>

            <button
              type="button"
              onClick={loadEntries}
              disabled={entriesLoading}
              style={{
                ...buttonStyle,
                opacity: entriesLoading ? 0.6 : 1,
              }}
            >
              {entriesLoading ? "새로고침 중..." : "스캔 결과 새로고침"}
            </button>
          </div>

          <div
            style={{
              marginTop: "16px",
              display: "grid",
              gap: "12px",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <div>
              <label style={labelStyle}>유형</label>

              <select
                value={entryKindFilter}
                onChange={(event) =>
                  setEntryKindFilter(event.target.value as "ALL" | StreamingEntryKind)
                }
                style={inputStyle}
              >
                <option value="ALL">전체</option>
                <option value="LIVE">LIVE</option>
                <option value="DOCS">DOCS</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>주차</label>

              <select
                value={weekFilter}
                onChange={(event) => {
                  setWeekFilter(event.target.value);
                  setTeacherFilter("");
                }}
                style={inputStyle}
              >
                <option value="">전체 주차</option>
                {weekOptions.map((weekName) => (
                  <option key={weekName} value={weekName}>
                    {weekName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>강사명</label>

              <select
                value={teacherFilter}
                onChange={(event) => setTeacherFilter(event.target.value)}
                style={inputStyle}
              >
                <option value="">전체 강사</option>
                {teacherOptions.map((teacherName) => (
                  <option key={teacherName} value={teacherName}>
                    {teacherName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              marginTop: "14px",
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button type="button" onClick={resetFilters} style={buttonStyle}>
              필터 초기화
            </button>

            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#6b7280",
              }}
            >
              표시 중: {filteredEntries.length}개
            </p>
          </div>

          <div
            style={{
              marginTop: "20px",
              overflowX: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: "14px",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1180px",
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {[
                    "유형",
                    "주차",
                    "강사명",
                    "파일명",
                    "크기",
                    "확장자",
                    "WebDAV 경로",
                    "최근 확인",
                  ].map((title) => (
                    <th
                      key={title}
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        fontSize: "13px",
                        color: "#6b7280",
                        borderBottom: "1px solid #e5e7eb",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: "18px",
                        textAlign: "center",
                        color: "#6b7280",
                        fontSize: "14px",
                      }}
                    >
                      표시할 스캔 결과가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: getKindColor(entry.entry_kind),
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getKindLabel(entry.entry_kind)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                          fontWeight: 800,
                        }}
                      >
                        {entry.week_name}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.teacher_name}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                          fontWeight: 800,
                        }}
                      >
                        {entry.file_name}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#6b7280",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getFileSizeLabel(entry.file_size_bytes)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#6b7280",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.file_extension ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "12px",
                          color: "#6b7280",
                          fontFamily: "monospace",
                          minWidth: "320px",
                          wordBreak: "break-all",
                        }}
                      >
                        {entry.webdav_path}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#6b7280",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getDateTimeLabel(entry.last_seen_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ ...cardStyle, marginTop: "20px" }}>
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
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>
                자료 다운로드 기록
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                누가 언제 어떤 docs 자료를 다운로드했는지 확인합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={loadDownloadLogs}
              disabled={downloadLogsLoading}
              style={{
                ...buttonStyle,
                opacity: downloadLogsLoading ? 0.6 : 1,
              }}
            >
              {downloadLogsLoading ? "새로고침 중..." : "다운로드 기록 새로고침"}
            </button>
          </div>

          <div
            style={{
              marginTop: "20px",
              overflowX: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: "14px",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1180px",
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {[
                    "다운로드 시각",
                    "사용자",
                    "사용자 UUID",
                    "주차",
                    "강사명",
                    "파일명",
                    "WebDAV 경로",
                    "Entry ID",
                  ].map((title) => (
                    <th
                      key={title}
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        fontSize: "13px",
                        color: "#6b7280",
                        borderBottom: "1px solid #e5e7eb",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {downloadLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: "18px",
                        textAlign: "center",
                        color: "#6b7280",
                        fontSize: "14px",
                      }}
                    >
                      다운로드 기록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  downloadLogs.map((log) => (
                    <tr key={log.log_id}>
                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                          fontWeight: 800,
                        }}
                      >
                        {getDateTimeLabel(log.downloaded_at)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <strong>{log.user_name ?? "이름 없음"}</strong>
                        <br />
                        {log.user_email ?? "이메일 없음"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "12px",
                          color: "#6b7280",
                          fontFamily: "monospace",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.user_id ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.week_name ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.teacher_name ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                          fontWeight: 700,
                        }}
                      >
                        {log.file_name ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "12px",
                          color: "#6b7280",
                          fontFamily: "monospace",
                          wordBreak: "break-all",
                          minWidth: "280px",
                        }}
                      >
                        {log.webdav_path ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "12px",
                          color: "#6b7280",
                          fontFamily: "monospace",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.entry_id ?? "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
