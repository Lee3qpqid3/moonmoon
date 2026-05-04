"use client";

import { useEffect, useState } from "react";
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

type ChatAuditLog = {
  log_id: string;
  message_id: string | null;
  action: string;
  before_content: string | null;
  after_content: string | null;
  log_created_at: string;

  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;

  message_user_id: string | null;
  message_user_name: string | null;
  message_user_email: string | null;

  message_current_content: string | null;
  message_is_deleted: boolean;
  message_created_at: string | null;
  message_edited_at: string | null;
  message_deleted_at: string | null;
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
  fontWeight: 700,
  whiteSpace: "nowrap" as const,
};

export default function AdminChatLogsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [logs, setLogs] = useState<ChatAuditLog[]>([]);

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

    const { data, error } = await supabase.rpc("get_chat_audit_logs", {
      log_limit: 300,
    });

    setLogsLoading(false);

    if (error) {
      setErrorMessage(error.message || "채팅 로그를 불러오지 못했습니다.");
      return;
    }

    setLogs((data ?? []) as ChatAuditLog[]);
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

  function getActionLabel(action: string) {
    if (action === "CREATE") return "생성";
    if (action === "EDIT") return "수정";
    if (action === "DELETE") return "삭제";
    if (action === "ANNOUNCE") return "공지 지정";
    if (action === "CLEAR_ANNOUNCEMENT") return "공지 해제";
    return action;
  }

  function getActionColor(action: string) {
    if (action === "CREATE") return "#15803d";
    if (action === "EDIT") return "#2563eb";
    if (action === "DELETE") return "#dc2626";
    if (action === "ANNOUNCE") return "#854d0e";
    if (action === "CLEAR_ANNOUNCEMENT") return "#6b7280";
    return "#111827";
  }

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
            채팅 로그는 관리자 이상 계정만 접근할 수 있습니다.
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800 }}>
            채팅 로그
          </h1>

          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
            메시지 생성, 수정, 삭제, 공지 지정 기록을 확인합니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/chat")} style={buttonStyle}>
            커뮤니티
          </button>

          <button onClick={() => router.push("/admin")} style={buttonStyle}>
            관리자
          </button>
        </div>
      </header>

      <section
        style={{
          maxWidth: "1200px",
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
              borderRadius: "14px",
              background: "#f9fafb",
              padding: "16px",
              marginBottom: "18px",
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
              {profile?.name} · {profile?.email}
            </p>
          </div>

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
                감사 로그
              </h2>

              <p
                style={{
                  marginTop: "8px",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                수정 전/후 메시지, 삭제 전 메시지, 공지 지정 기록, 작성자 UUID를
                확인할 수 있습니다.
              </p>
            </div>

            <button
              type="button"
              onClick={loadLogs}
              disabled={logsLoading}
              style={{
                ...buttonStyle,
                padding: "10px 12px",
                opacity: logsLoading ? 0.6 : 1,
              }}
            >
              {logsLoading ? "새로고침 중..." : "새로고침"}
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
              }}
            >
              {errorMessage}
            </div>
          )}

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
                minWidth: "1500px",
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {[
                    "상태",
                    "로그 시각",
                    "행위자",
                    "작성자",
                    "메시지 ID",
                    "수정/삭제 전",
                    "수정/생성/공지 후",
                    "현재 메시지",
                    "메시지 생성",
                    "수정",
                    "삭제",
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
                {logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      style={{
                        padding: "18px",
                        textAlign: "center",
                        color: "#6b7280",
                        fontSize: "14px",
                      }}
                    >
                      채팅 로그가 없습니다.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.log_id}>
                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          fontWeight: 900,
                          color: getActionColor(log.action),
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
                          color: "#6b7280",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getDateTimeLabel(log.log_created_at)}
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
                        <strong>{log.actor_name ?? "이름 없음"}</strong>
                        <br />
                        {log.actor_email ?? "이메일 없음"}
                        <br />
                        <span style={{ color: "#6b7280", fontFamily: "monospace" }}>
                          {log.actor_id ?? "-"}
                        </span>
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
                        <strong>{log.message_user_name ?? "이름 없음"}</strong>
                        <br />
                        {log.message_user_email ?? "이메일 없음"}
                        <br />
                        <span style={{ color: "#6b7280", fontFamily: "monospace" }}>
                          {log.message_user_id ?? "-"}
                        </span>
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
                        {log.message_id ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          minWidth: "220px",
                          maxWidth: "320px",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {log.before_content ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          minWidth: "220px",
                          maxWidth: "320px",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {log.after_content ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: log.message_is_deleted ? "#dc2626" : "#111827",
                          minWidth: "220px",
                          maxWidth: "320px",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {log.message_is_deleted
                          ? "삭제된 메시지입니다."
                          : log.message_current_content ?? "-"}
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
                        {getDateTimeLabel(log.message_created_at)}
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
                        {getDateTimeLabel(log.message_edited_at)}
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
                        {getDateTimeLabel(log.message_deleted_at)}
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
