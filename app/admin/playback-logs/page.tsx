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

type PlaybackMode =
  | "SERVER"
  | "DIRECT"
  | "EXTERNAL_SERVER"
  | "EXTERNAL_DIRECT"
  | string
  | null;

type PlaybackLog = {
  id: string;
  user_id: string;
  entry_id: string | null;
  week_name: string | null;
  teacher_name: string | null;
  file_name: string | null;
  webdav_path: string | null;
  playback_mode: PlaybackMode;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
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
  maxWidth: "100%",
  minWidth: 0,
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

export default function AdminPlaybackLogsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [logs, setLogs] = useState<PlaybackLog[]>([]);

  const [searchText, setSearchText] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [limitCount, setLimitCount] = useState("100");

  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [denied, setDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    checkAdminAndLoadLogs();
  }, []);

  async function checkAdminAndLoadLogs() {
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

    if (data.role !== "ADMIN" && data.role !== "SUPER_USER") {
      setDenied(true);
      setLoading(false);
      return;
    }

    setProfile(data as AdminProfile);
    setLoading(false);

    await loadLogs();
  }

  async function loadLogs() {
    setLogsLoading(true);
    setErrorMessage("");

    const limit = Number(limitCount) || 100;

    const { data, error } = await supabase
      .from("streaming_play_logs")
      .select(
        `
        id,
        user_id,
        entry_id,
        week_name,
        teacher_name,
        file_name,
        webdav_path,
        playback_mode,
        created_at,
        profiles:user_id (
          email,
          name
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 20), 500));

    setLogsLoading(false);

    if (error) {
      setErrorMessage(error.message || "재생기록을 불러오지 못했습니다.");
      setLogs([]);
      return;
    }

    const mappedLogs = (data ?? []).map((row: any) => {
      const profileRow = Array.isArray(row.profiles)
        ? row.profiles[0]
        : row.profiles;

      return {
        id: row.id,
        user_id: row.user_id,
        entry_id: row.entry_id,
        week_name: row.week_name,
        teacher_name: row.teacher_name,
        file_name: row.file_name,
        webdav_path: row.webdav_path,
        playback_mode: row.playback_mode ?? "SERVER",
        created_at: row.created_at,
        user_email: profileRow?.email ?? null,
        user_name: profileRow?.name ?? null,
      } as PlaybackLog;
    });

    setLogs(mappedLogs);
  }

  function getRoleLabel(role: UserRole) {
    if (role === "SUPER_USER") return "슈퍼 유저";
    if (role === "ADMIN") return "관리자";
    return "일반 사용자";
  }

  function getPlaybackModeLabel(mode: PlaybackMode) {
    if (mode === "DIRECT") return "직접 링크 재생";
    if (mode === "EXTERNAL_SERVER") return "외부 플레이어 서버 URL";
    if (mode === "EXTERNAL_DIRECT") return "외부 플레이어 직접 URL";
    return "서버 재생";
  }

  function getPlaybackModeColor(mode: PlaybackMode) {
    if (mode === "DIRECT") return "#15803d";
    if (mode === "EXTERNAL_DIRECT") return "#047857";
    if (mode === "EXTERNAL_SERVER") return "#7c3aed";
    return "#2563eb";
  }

  function getDateTimeLabel(value: string) {
    return new Date(value).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  const filteredLogs = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase();

    return logs.filter((log) => {
      if (modeFilter && log.playback_mode !== modeFilter) {
        return false;
      }

      if (!normalizedSearchText) {
        return true;
      }

      const combined = [
        log.user_name,
        log.user_email,
        log.user_id,
        log.week_name,
        log.teacher_name,
        log.file_name,
        log.webdav_path,
        getPlaybackModeLabel(log.playback_mode),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return combined.includes(normalizedSearchText);
    });
  }, [logs, searchText, modeFilter]);

  const modeCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const log of logs) {
      const mode = log.playback_mode || "SERVER";
      counts.set(mode, (counts.get(mode) ?? 0) + 1);
    }

    return {
      server: counts.get("SERVER") ?? 0,
      direct: counts.get("DIRECT") ?? 0,
      externalServer: counts.get("EXTERNAL_SERVER") ?? 0,
      externalDirect: counts.get("EXTERNAL_DIRECT") ?? 0,
    };
  }, [logs]);

  if (loading) {
    return (
      <main style={centerStyle}>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          관리자 권한을 확인하는 중입니다...
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
            관리자 권한이 있는 계정만 재생기록을 볼 수 있습니다.
          </p>

          <button
            onClick={() => router.push("/home")}
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
            홈으로 돌아가기
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
            재생기록
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            누가 언제 어떤 영상을 어떤 방식으로 재생했는지 확인합니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/admin")} style={buttonStyle}>
            관리자
          </button>

          <button onClick={() => router.push("/home")} style={buttonStyle}>
            홈
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
              현재 관리자
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
              {profile?.name} · {profile?.email} ·{" "}
              {profile ? getRoleLabel(profile.role) : "-"}
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

          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "10px",
            }}
          >
            <div
              style={{
                border: "1px solid #dbeafe",
                borderRadius: "14px",
                padding: "14px",
                background: "#eff6ff",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "#1d4ed8" }}>
                서버 재생
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "22px",
                  fontWeight: 900,
                  color: "#1e3a8a",
                }}
              >
                {modeCounts.server}
              </p>
            </div>

            <div
              style={{
                border: "1px solid #bbf7d0",
                borderRadius: "14px",
                padding: "14px",
                background: "#f0fdf4",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "#15803d" }}>
                직접 링크 재생
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "22px",
                  fontWeight: 900,
                  color: "#14532d",
                }}
              >
                {modeCounts.direct}
              </p>
            </div>

            <div
              style={{
                border: "1px solid #ddd6fe",
                borderRadius: "14px",
                padding: "14px",
                background: "#f5f3ff",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "#7c3aed" }}>
                외부 서버 URL
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "22px",
                  fontWeight: 900,
                  color: "#4c1d95",
                }}
              >
                {modeCounts.externalServer}
              </p>
            </div>

            <div
              style={{
                border: "1px solid #a7f3d0",
                borderRadius: "14px",
                padding: "14px",
                background: "#ecfdf5",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "#047857" }}>
                외부 직접 URL
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "22px",
                  fontWeight: 900,
                  color: "#064e3b",
                }}
              >
                {modeCounts.externalDirect}
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
              <h2
                style={{
                  margin: 0,
                  fontSize: "22px",
                  fontWeight: 900,
                  color: "#111827",
                }}
              >
                재생기록 목록
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                최근 기록을 기준으로 표시합니다. 시청률이나 몇 분 봤는지는
                추적하지 않습니다.
              </p>
            </div>

            <button
              type="button"
              onClick={loadLogs}
              disabled={logsLoading}
              style={{
                ...buttonStyle,
                opacity: logsLoading ? 0.6 : 1,
              }}
            >
              {logsLoading ? "새로고침 중..." : "새로고침"}
            </button>
          </div>

          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              alignItems: "end",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>검색</label>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="이름, 이메일, 파일명, 주차, 강사 검색"
                style={inputStyle}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>재생 방식</label>
              <select
                value={modeFilter}
                onChange={(event) => setModeFilter(event.target.value)}
                style={inputStyle}
              >
                <option value="">전체</option>
                <option value="SERVER">서버 재생</option>
                <option value="DIRECT">직접 링크 재생</option>
                <option value="EXTERNAL_SERVER">외부 플레이어 서버 URL</option>
                <option value="EXTERNAL_DIRECT">외부 플레이어 직접 URL</option>
              </select>
            </div>

            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>표시 개수</label>
              <select
                value={limitCount}
                onChange={(event) => setLimitCount(event.target.value)}
                style={inputStyle}
              >
                <option value="50">최근 50개</option>
                <option value="100">최근 100개</option>
                <option value="200">최근 200개</option>
                <option value="500">최근 500개</option>
              </select>
            </div>
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
                    "재생 시각",
                    "재생 방식",
                    "이름",
                    "이메일",
                    "UUID",
                    "주차",
                    "강사",
                    "파일명",
                    "경로",
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
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        padding: "18px",
                        textAlign: "center",
                        color: "#6b7280",
                        fontSize: "14px",
                      }}
                    >
                      표시할 재생기록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getDateTimeLabel(log.created_at)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: getPlaybackModeColor(log.playback_mode),
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getPlaybackModeLabel(log.playback_mode)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          color: "#111827",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.user_name ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          wordBreak: "break-all",
                        }}
                      >
                        {log.user_email ?? "-"}
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
                        {log.user_id}
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
                          wordBreak: "break-word",
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
                          wordBreak: "break-all",
                          maxWidth: "360px",
                        }}
                      >
                        {log.webdav_path ?? "-"}
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
