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

type SerialKeyLogAction =
  | "CREATE"
  | "ISSUE"
  | "USE"
  | "DELETE"
  | "DISABLE"
  | "ENABLE"
  | string
  | null;

type SerialKeyLog = {
  id: string;
  serial_key_id: string | null;
  serial_code: string | null;
  action: SerialKeyLogAction;
  target_user_id: string | null;
  target_user_email: string | null;
  target_user_name: string | null;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  memo: string | null;
  created_at: string;
};

const DEFAULT_PAGE_SIZE = 30;
const PAGE_SIZE_OPTIONS = [20, 30, 50, 100];

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

export default function AdminSerialKeyLogsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [logs, setLogs] = useState<SerialKeyLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [searchText, setSearchText] = useState("");
  const [actionFilter, setActionFilter] = useState("");
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

    const safePageSize = Math.min(Math.max(pageSize, 20), 100);
    const from = currentPage * safePageSize;
    const to = from + safePageSize - 1;

    const { data, error, count } = await supabase
      .from("serial_key_logs")
      .select(
        `
        id,
        serial_key_id,
        serial_code,
        action,
        target_user_id,
        actor_id,
        memo,
        created_at,
        target_profile:target_user_id (
          email,
          name
        ),
        actor_profile:actor_id (
          email,
          name
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    setLogsLoading(false);

    if (error) {
      setErrorMessage(error.message || "시리얼키 발급 로그를 불러오지 못했습니다.");
      setLogs([]);
      setTotalCount(0);
      return;
    }

    const mappedLogs = (data ?? []).map((row: any) => {
      const targetProfile = Array.isArray(row.target_profile)
        ? row.target_profile[0]
        : row.target_profile;

      const actorProfile = Array.isArray(row.actor_profile)
        ? row.actor_profile[0]
        : row.actor_profile;

      return {
        id: row.id,
        serial_key_id: row.serial_key_id,
        serial_code: row.serial_code,
        action: row.action,
        target_user_id: row.target_user_id,
        target_user_email: targetProfile?.email ?? null,
        target_user_name: targetProfile?.name ?? null,
        actor_id: row.actor_id,
        actor_email: actorProfile?.email ?? null,
        actor_name: actorProfile?.name ?? null,
        memo: row.memo,
        created_at: row.created_at,
      } as SerialKeyLog;
    });

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

  function getActionLabel(action: SerialKeyLogAction) {
    if (action === "CREATE") return "생성";
    if (action === "ISSUE") return "발급";
    if (action === "USE") return "사용";
    if (action === "DELETE") return "삭제";
    if (action === "DISABLE") return "비활성화";
    if (action === "ENABLE") return "활성화";
    return action || "기록";
  }

  function getActionColor(action: SerialKeyLogAction) {
    if (action === "CREATE") return "#2563eb";
    if (action === "ISSUE") return "#7c3aed";
    if (action === "USE") return "#15803d";
    if (action === "DELETE") return "#dc2626";
    if (action === "DISABLE") return "#ea580c";
    if (action === "ENABLE") return "#047857";
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

    if (value.length <= 120) {
      return value;
    }

    return `${value.slice(0, 120)}...`;
  }

  function maskSerialCode(code: string | null) {
    if (!code) return "-";

    if (code.length <= 10) {
      return code;
    }

    return `${code.slice(0, 6)}...${code.slice(-4)}`;
  }

  const filteredLogs = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase();

    return logs.filter((log) => {
      if (actionFilter && log.action !== actionFilter) {
        return false;
      }

      if (!normalizedSearchText) {
        return true;
      }

      const combined = [
        log.serial_code,
        log.serial_key_id,
        log.action,
        getActionLabel(log.action),
        log.target_user_id,
        log.target_user_email,
        log.target_user_name,
        log.actor_id,
        log.actor_email,
        log.actor_name,
        log.memo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return combined.includes(normalizedSearchText);
    });
  }, [logs, searchText, actionFilter]);

  const actionCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const log of logs) {
      const action = log.action || "UNKNOWN";
      counts.set(action, (counts.get(action) ?? 0) + 1);
    }

    return {
      create: counts.get("CREATE") ?? 0,
      issue: counts.get("ISSUE") ?? 0,
      use: counts.get("USE") ?? 0,
      delete: counts.get("DELETE") ?? 0,
      disable: counts.get("DISABLE") ?? 0,
      enable: counts.get("ENABLE") ?? 0,
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
            관리자 권한이 있는 계정만 시리얼키 발급 로그를 볼 수 있습니다.
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
            시리얼키 발급 로그
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            시리얼키 생성, 발급, 사용, 비활성화 기록을 확인합니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/admin")} style={buttonStyle}>
            관리자
          </button>

          <button onClick={() => router.push("/admin/serial-keys")} style={buttonStyle}>
            시리얼키 관리
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
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "10px",
            }}
          >
            <SummaryCard label="현재 페이지 생성" value={actionCounts.create} />
            <SummaryCard label="현재 페이지 발급" value={actionCounts.issue} />
            <SummaryCard label="현재 페이지 사용" value={actionCounts.use} />
            <SummaryCard label="현재 페이지 삭제" value={actionCounts.delete} />
            <SummaryCard label="현재 페이지 비활성화" value={actionCounts.disable} />
            <SummaryCard label="현재 페이지 활성화" value={actionCounts.enable} />
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
                시리얼키 발급 로그 목록
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                기본 30개씩 표시하며, 이전/다음 버튼으로 페이지를 넘깁니다.
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
                placeholder="시리얼코드, 사용자, 관리자, 메모 검색"
                style={inputStyle}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>기록 유형</label>
              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                style={inputStyle}
              >
                <option value="">전체</option>
                <option value="CREATE">생성</option>
                <option value="ISSUE">발급</option>
                <option value="USE">사용</option>
                <option value="DELETE">삭제</option>
                <option value="DISABLE">비활성화</option>
                <option value="ENABLE">활성화</option>
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
                minWidth: "1280px",
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {[
                    "기록 시각",
                    "유형",
                    "시리얼코드",
                    "대상 이름",
                    "대상 이메일",
                    "대상 UUID",
                    "처리자",
                    "처리자 이메일",
                    "메모",
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
                      표시할 시리얼키 발급 로그가 없습니다.
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
                          color: getActionColor(log.action),
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getActionLabel(log.action)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          fontFamily: "monospace",
                          whiteSpace: "nowrap",
                        }}
                        title={log.serial_code ?? ""}
                      >
                        {maskSerialCode(log.serial_code)}
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
                        {log.target_user_name ?? "-"}
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
                        {log.target_user_email ?? "-"}
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
                        {log.target_user_id ?? "-"}
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
                        {log.actor_name ?? "-"}
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
                        {log.actor_email ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#6b7280",
                          wordBreak: "break-word",
                          maxWidth: "320px",
                          lineHeight: 1.5,
                        }}
                      >
                        {getPreview(log.memo)}
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

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        padding: "14px",
        background: "#f9fafb",
      }}
    >
      <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>{label}</p>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: "22px",
          fontWeight: 900,
          color: "#111827",
        }}
      >
        {value}
      </p>
    </div>
  );
}
