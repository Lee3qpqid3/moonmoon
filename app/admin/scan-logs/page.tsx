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

type ScanStatus = "SUCCESS" | "FAILED" | "PARTIAL" | string | null;

type RawScanLog = {
  id: string;
  scanned_by: string | null;
  created_by: string | null;
  scan_type: string | null;
  live_root_path: string | null;
  docs_root_path: string | null;
  found_live_count: number | null;
  found_docs_count: number | null;
  inserted_count: number | null;
  updated_count: number | null;
  hidden_missing_count: number | null;
  status: string | null;
  scan_status: ScanStatus;
  error_message: string | null;
  created_at: string;
};

type ScanLog = RawScanLog & {
  user_email: string | null;
  user_name: string | null;
};

type ProfileLite = {
  id: string;
  email: string;
  name: string;
};

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

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

export default function AdminScanLogsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(0);

  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [denied, setDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    checkAdminAndLoadLogs();
  }, []);

  useEffect(() => {
    if (!loading && !denied) {
      loadLogs();
    }
  }, [currentPage, pageSize]);

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

    const safePageSize = Math.min(Math.max(pageSize, 20), 200);
    const from = currentPage * safePageSize;
    const to = from + safePageSize - 1;

    const { data, error, count } = await supabase
      .from("streaming_scan_logs")
      .select(
        `
        id,
        scanned_by,
        created_by,
        scan_type,
        live_root_path,
        docs_root_path,
        found_live_count,
        found_docs_count,
        inserted_count,
        updated_count,
        hidden_missing_count,
        status,
        scan_status,
        error_message,
        created_at
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      setLogsLoading(false);
      setErrorMessage(error.message || "스캔 로그를 불러오지 못했습니다.");
      setLogs([]);
      setTotalCount(0);
      return;
    }

    const rawLogs = (data ?? []) as RawScanLog[];

    const userIds = Array.from(
      new Set(
        rawLogs
          .map((log) => log.created_by || log.scanned_by)
          .filter((userId): userId is string => Boolean(userId))
      )
    );

    let profileMap = new Map<string, ProfileLite>();

    if (userIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, name")
        .in("id", userIds);

      if (profileError) {
        setLogsLoading(false);
        setErrorMessage(
          profileError.message || "스캔 실행자 정보를 불러오지 못했습니다."
        );
        setLogs([]);
        setTotalCount(0);
        return;
      }

      profileMap = new Map(
        ((profileRows ?? []) as ProfileLite[]).map((item) => [item.id, item])
      );
    }

    const mappedLogs: ScanLog[] = rawLogs.map((log) => {
      const userId = log.created_by || log.scanned_by;
      const user = userId ? profileMap.get(userId) : null;

      return {
        ...log,
        user_email: user?.email ?? null,
        user_name: user?.name ?? null,
      };
    });

    setLogsLoading(false);
    setLogs(mappedLogs);
    setTotalCount(count ?? 0);
  }

  function resetAndLoadFirstPage() {
    if (currentPage === 0) {
      loadLogs();
      return;
    }

    setCurrentPage(0);
  }

  function movePage(delta: number) {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const nextPage = currentPage + delta;

    if (nextPage < 0) return;
    if (nextPage >= totalPages) return;

    setCurrentPage(nextPage);
  }

  function getRoleLabel(role: UserRole) {
    if (role === "SUPER_USER") return "슈퍼 유저";
    if (role === "ADMIN") return "관리자";
    return "일반 사용자";
  }

  function normalizeStatus(log: ScanLog) {
    return log.scan_status || log.status || "UNKNOWN";
  }

  function getStatusLabel(status: ScanStatus) {
    if (status === "SUCCESS") return "성공";
    if (status === "PARTIAL") return "부분 성공";
    if (status === "FAILED") return "실패";
    if (status === "UNKNOWN") return "기록";
    return status || "기록";
  }

  function getStatusColor(status: ScanStatus) {
    if (status === "SUCCESS") return "#15803d";
    if (status === "PARTIAL") return "#ea580c";
    if (status === "FAILED") return "#dc2626";
    return "#6b7280";
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

  function getPreview(value: string | null) {
    if (!value) return "-";

    if (value.length <= 180) {
      return value;
    }

    return `${value.slice(0, 180)}...`;
  }

  const filteredLogs = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase();

    return logs.filter((log) => {
      const normalizedStatus = normalizeStatus(log);

      if (statusFilter && normalizedStatus !== statusFilter) {
        return false;
      }

      if (!normalizedSearchText) {
        return true;
      }

      const combined = [
        log.user_name,
        log.user_email,
        log.created_by,
        log.scanned_by,
        normalizedStatus,
        getStatusLabel(normalizedStatus),
        log.scan_type,
        log.live_root_path,
        log.docs_root_path,
        log.error_message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return combined.includes(normalizedSearchText);
    });
  }, [logs, searchText, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const log of logs) {
      const status = normalizeStatus(log);
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }

    return {
      success: counts.get("SUCCESS") ?? 0,
      partial: counts.get("PARTIAL") ?? 0,
      failed: counts.get("FAILED") ?? 0,
    };
  }, [logs]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageStart = totalCount === 0 ? 0 : currentPage * pageSize + 1;
  const pageEnd = Math.min((currentPage + 1) * pageSize, totalCount);

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
            관리자 권한이 있는 계정만 스캔 로그를 볼 수 있습니다.
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
            스캔 로그
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            WebDAV 스캔 실행 결과와 실패 원인을 확인합니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/admin")} style={buttonStyle}>
            관리자
          </button>

          <button
            onClick={() => router.push("/admin/streaming-source")}
            style={buttonStyle}
          >
            스트리밍 소스 관리
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
            <SummaryCard
              label="현재 페이지 성공"
              value={statusCounts.success}
              color="#15803d"
              background="#f0fdf4"
              border="#bbf7d0"
            />

            <SummaryCard
              label="현재 페이지 부분 성공"
              value={statusCounts.partial}
              color="#ea580c"
              background="#fff7ed"
              border="#fed7aa"
            />

            <SummaryCard
              label="현재 페이지 실패"
              value={statusCounts.failed}
              color="#dc2626"
              background="#fff1f2"
              border="#fecaca"
            />
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
                스캔 로그 목록
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                기본 50개씩 표시하며, 이전/다음 버튼으로 페이지를 넘깁니다.
              </p>
            </div>

            <button
              type="button"
              onClick={resetAndLoadFirstPage}
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
              <label style={labelStyle}>현재 페이지 검색</label>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="관리자, 이메일, 오류 메시지 검색"
                style={inputStyle}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>상태</label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                style={inputStyle}
              >
                <option value="">전체</option>
                <option value="SUCCESS">성공</option>
                <option value="PARTIAL">부분 성공</option>
                <option value="FAILED">실패</option>
              </select>
            </div>

            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>표시 개수</label>
              <select
                value={String(pageSize)}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(0);
                }}
                style={inputStyle}
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}개씩 보기
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              marginTop: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              border: "1px solid #e5e7eb",
              borderRadius: "14px",
              padding: "12px",
              background: "#f9fafb",
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
              전체 {totalCount}개 중 {pageStart}~{pageEnd}개 표시 ·{" "}
              {currentPage + 1}/{totalPages}페이지
            </p>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => movePage(-1)}
                disabled={logsLoading || currentPage <= 0}
                style={{
                  ...buttonStyle,
                  opacity: logsLoading || currentPage <= 0 ? 0.45 : 1,
                }}
              >
                ← 이전
              </button>

              <button
                type="button"
                onClick={() => movePage(1)}
                disabled={logsLoading || currentPage >= totalPages - 1}
                style={{
                  ...buttonStyle,
                  opacity:
                    logsLoading || currentPage >= totalPages - 1 ? 0.45 : 1,
                }}
              >
                다음 →
              </button>
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
                    "스캔 시각",
                    "상태",
                    "LIVE 발견",
                    "DOCS 발견",
                    "등록",
                    "수정",
                    "숨김",
                    "실행자",
                    "이메일",
                    "오류 메시지",
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
                      colSpan={10}
                      style={{
                        padding: "18px",
                        textAlign: "center",
                        color: "#6b7280",
                        fontSize: "14px",
                      }}
                    >
                      표시할 스캔 로그가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const status = normalizeStatus(log);

                    return (
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
                            color: getStatusColor(status),
                            fontWeight: 900,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {getStatusLabel(status)}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #f3f4f6",
                            fontSize: "13px",
                            color: "#111827",
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {log.found_live_count ?? 0}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #f3f4f6",
                            fontSize: "13px",
                            color: "#111827",
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {log.found_docs_count ?? 0}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #f3f4f6",
                            fontSize: "13px",
                            color: "#111827",
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {log.inserted_count ?? 0}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #f3f4f6",
                            fontSize: "13px",
                            color: "#111827",
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {log.updated_count ?? 0}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #f3f4f6",
                            fontSize: "13px",
                            color: "#111827",
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {log.hidden_missing_count ?? 0}
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
                            color: log.error_message ? "#991b1b" : "#6b7280",
                            wordBreak: "break-word",
                            maxWidth: "480px",
                            lineHeight: 1.5,
                          }}
                        >
                          {getPreview(log.error_message)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  color,
  background,
  border,
}: {
  label: string;
  value: number;
  color: string;
  background: string;
  border: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: "14px",
        padding: "14px",
        background,
      }}
    >
      <p style={{ margin: 0, fontSize: "12px", color }}>{label}</p>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: "22px",
          fontWeight: 900,
          color,
        }}
      >
        {value}
      </p>
    </div>
  );
}
