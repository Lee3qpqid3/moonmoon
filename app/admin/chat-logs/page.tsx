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

type ViewMode = "MESSAGE" | "TIMELINE";

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

function makePreview(text: string | null, limit = 120) {
  if (!text) return "-";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

export default function AdminChatLogsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [logs, setLogs] = useState<ChatAuditLog[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("MESSAGE");
  const [editIndexes, setEditIndexes] = useState<Record<string, number>>({});

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
      log_limit: 500,
    });

    setLogsLoading(false);

    if (error) {
      setErrorMessage(error.message || "채팅 로그를 불러오지 못했습니다.");
      return;
    }

    setLogs((data ?? []) as ChatAuditLog[]);
  }

  const messageGroups = useMemo(() => {
    const map = new Map<string, ChatAuditLog[]>();

    for (const log of logs) {
      const key = log.message_id ?? log.log_id;

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)?.push(log);
    }

    return Array.from(map.entries())
      .map(([messageId, groupLogs]) => {
        const sortedLogs = [...groupLogs].sort(
          (a, b) =>
            new Date(a.log_created_at).getTime() -
            new Date(b.log_created_at).getTime()
        );

        const createLog = sortedLogs.find((log) => log.action === "CREATE");
        const editLogs = sortedLogs.filter((log) => log.action === "EDIT");
        const deleteLog = sortedLogs.find((log) => log.action === "DELETE");
        const announceLogs = sortedLogs.filter(
          (log) =>
            log.action === "ANNOUNCE" ||
            log.action === "CLEAR_ANNOUNCEMENT"
        );

        const latestLog = sortedLogs[sortedLogs.length - 1];

        return {
          messageId,
          logs: sortedLogs,
          createLog,
          editLogs,
          deleteLog,
          announceLogs,
          latestLog,
        };
      })
      .sort((a, b) => {
        const aTime = new Date(a.latestLog.log_created_at).getTime();
        const bTime = new Date(b.latestLog.log_created_at).getTime();
        return bTime - aTime;
      });
  }, [logs]);

  function changeEditIndex(messageId: string, direction: number, max: number) {
    setEditIndexes((current) => {
      const nowIndex = current[messageId] ?? 0;
      const nextIndex =
        nowIndex + direction < 0
          ? max - 1
          : nowIndex + direction >= max
            ? 0
            : nowIndex + direction;

      return {
        ...current,
        [messageId]: nextIndex,
      };
    });
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
                기본은 메시지 기준 상세 이력입니다. 시간순 로그로 바꾸면 기존처럼
                모든 이벤트가 발생 순서대로 보입니다.
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setViewMode("MESSAGE")}
                style={{
                  ...buttonStyle,
                  border:
                    viewMode === "MESSAGE"
                      ? "2px solid #111827"
                      : "1px solid #d1d5db",
                }}
              >
                메시지 기준
              </button>

              <button
                type="button"
                onClick={() => setViewMode("TIMELINE")}
                style={{
                  ...buttonStyle,
                  border:
                    viewMode === "TIMELINE"
                      ? "2px solid #111827"
                      : "1px solid #d1d5db",
                }}
              >
                시간순 로그
              </button>

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

          {viewMode === "MESSAGE" ? (
            <div
              style={{
                marginTop: "20px",
                display: "grid",
                gap: "16px",
              }}
            >
              {messageGroups.length === 0 ? (
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "14px",
                    padding: "18px",
                    textAlign: "center",
                    color: "#6b7280",
                    fontSize: "14px",
                  }}
                >
                  채팅 로그가 없습니다.
                </div>
              ) : (
                messageGroups.map((group) => {
                  const latest = group.latestLog;
                  const editIndex = editIndexes[group.messageId] ?? 0;
                  const selectedEdit = group.editLogs[editIndex] ?? null;
                  const originalContent =
                    group.createLog?.after_content ??
                    group.editLogs[0]?.before_content ??
                    latest.before_content ??
                    latest.after_content ??
                    "-";

                  return (
                    <div
                      key={group.messageId}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "18px",
                        padding: "18px",
                        background: "#ffffff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "15px",
                              fontWeight: 900,
                              color: "#111827",
                            }}
                          >
                            {latest.message_user_name ?? "이름 없음"} ·{" "}
                            {latest.message_user_email ?? "이메일 없음"}
                          </p>

                          <p
                            style={{
                              margin: "6px 0 0",
                              fontSize: "12px",
                              color: "#6b7280",
                              fontFamily: "monospace",
                              wordBreak: "break-all",
                            }}
                          >
                            UUID: {latest.message_user_id ?? "-"}
                          </p>

                          <p
                            style={{
                              margin: "6px 0 0",
                              fontSize: "12px",
                              color: "#6b7280",
                              fontFamily: "monospace",
                              wordBreak: "break-all",
                            }}
                          >
                            메시지 ID: {latest.message_id ?? "-"}
                          </p>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: "6px",
                            justifyItems: "end",
                          }}
                        >
                          <span
                            style={{
                              borderRadius: "999px",
                              background: latest.message_is_deleted
                                ? "#fee2e2"
                                : "#dcfce7",
                              color: latest.message_is_deleted
                                ? "#991b1b"
                                : "#166534",
                              padding: "6px 10px",
                              fontSize: "12px",
                              fontWeight: 900,
                            }}
                          >
                            {latest.message_is_deleted ? "삭제됨" : "유지 중"}
                          </span>

                          <span
                            style={{
                              borderRadius: "999px",
                              background: group.editLogs.length > 0
                                ? "#dbeafe"
                                : "#f3f4f6",
                              color: group.editLogs.length > 0
                                ? "#1d4ed8"
                                : "#6b7280",
                              padding: "6px 10px",
                              fontSize: "12px",
                              fontWeight: 900,
                            }}
                          >
                            수정 {group.editLogs.length}회
                          </span>

                          <span
                            style={{
                              borderRadius: "999px",
                              background: group.announceLogs.length > 0
                                ? "#fef3c7"
                                : "#f3f4f6",
                              color: group.announceLogs.length > 0
                                ? "#92400e"
                                : "#6b7280",
                              padding: "6px 10px",
                              fontSize: "12px",
                              fontWeight: 900,
                            }}
                          >
                            공지 기록 {group.announceLogs.length}회
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: "16px",
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(240px, 1fr))",
                          gap: "12px",
                        }}
                      >
                        <div
                          style={{
                            borderRadius: "14px",
                            background: "#f9fafb",
                            padding: "14px",
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              fontSize: "13px",
                              fontWeight: 900,
                              color: "#374151",
                            }}
                          >
                            최초 메시지
                          </p>

                          <p
                            style={{
                              margin: "8px 0 0",
                              fontSize: "13px",
                              color: "#111827",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              lineHeight: 1.6,
                            }}
                          >
                            {originalContent}
                          </p>

                          <p
                            style={{
                              margin: "10px 0 0",
                              fontSize: "12px",
                              color: "#6b7280",
                            }}
                          >
                            생성: {getDateTimeLabel(latest.message_created_at)}
                          </p>
                        </div>

                        <div
                          style={{
                            borderRadius: "14px",
                            background: "#f9fafb",
                            padding: "14px",
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              fontSize: "13px",
                              fontWeight: 900,
                              color: "#374151",
                            }}
                          >
                            현재 메시지
                          </p>

                          <p
                            style={{
                              margin: "8px 0 0",
                              fontSize: "13px",
                              color: latest.message_is_deleted
                                ? "#dc2626"
                                : "#111827",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              lineHeight: 1.6,
                            }}
                          >
                            {latest.message_is_deleted
                              ? "삭제된 메시지입니다."
                              : latest.message_current_content ?? "-"}
                          </p>

                          <p
                            style={{
                              margin: "10px 0 0",
                              fontSize: "12px",
                              color: "#6b7280",
                            }}
                          >
                            마지막 수정: {getDateTimeLabel(latest.message_edited_at)}
                            <br />
                            삭제: {getDateTimeLabel(latest.message_deleted_at)}
                          </p>
                        </div>
                      </div>

                      {group.editLogs.length > 0 && selectedEdit && (
                        <div
                          style={{
                            marginTop: "14px",
                            border: "1px solid #dbeafe",
                            borderRadius: "14px",
                            padding: "14px",
                            background: "#eff6ff",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "10px",
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            <p
                              style={{
                                margin: 0,
                                fontSize: "13px",
                                fontWeight: 900,
                                color: "#1d4ed8",
                              }}
                            >
                              수정 이력 {editIndex + 1}/{group.editLogs.length}
                            </p>

                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() =>
                                  changeEditIndex(
                                    group.messageId,
                                    -1,
                                    group.editLogs.length
                                  )
                                }
                                style={buttonStyle}
                              >
                                이전 수정
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  changeEditIndex(
                                    group.messageId,
                                    1,
                                    group.editLogs.length
                                  )
                                }
                                style={buttonStyle}
                              >
                                다음 수정
                              </button>
                            </div>
                          </div>

                          <div
                            style={{
                              marginTop: "12px",
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(240px, 1fr))",
                              gap: "12px",
                            }}
                          >
                            <div>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "12px",
                                  fontWeight: 900,
                                  color: "#1e40af",
                                }}
                              >
                                수정 전
                              </p>

                              <p
                                style={{
                                  margin: "8px 0 0",
                                  fontSize: "13px",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  lineHeight: 1.6,
                                  color: "#111827",
                                }}
                              >
                                {selectedEdit.before_content ?? "-"}
                              </p>
                            </div>

                            <div>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "12px",
                                  fontWeight: 900,
                                  color: "#1e40af",
                                }}
                              >
                                수정 후
                              </p>

                              <p
                                style={{
                                  margin: "8px 0 0",
                                  fontSize: "13px",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  lineHeight: 1.6,
                                  color: "#111827",
                                }}
                              >
                                {selectedEdit.after_content ?? "-"}
                              </p>
                            </div>
                          </div>

                          <p
                            style={{
                              margin: "12px 0 0",
                              fontSize: "12px",
                              color: "#1d4ed8",
                              lineHeight: 1.5,
                            }}
                          >
                            수정 시각: {getDateTimeLabel(selectedEdit.log_created_at)}
                            <br />
                            수정 행위자: {selectedEdit.actor_name ?? "이름 없음"} ·{" "}
                            {selectedEdit.actor_email ?? "이메일 없음"} ·{" "}
                            <span style={{ fontFamily: "monospace" }}>
                              {selectedEdit.actor_id ?? "-"}
                            </span>
                          </p>
                        </div>
                      )}

                      {group.deleteLog && (
                        <div
                          style={{
                            marginTop: "14px",
                            border: "1px solid #fecaca",
                            borderRadius: "14px",
                            padding: "14px",
                            background: "#fff1f2",
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              fontSize: "13px",
                              fontWeight: 900,
                              color: "#991b1b",
                            }}
                          >
                            삭제 이력
                          </p>

                          <p
                            style={{
                              margin: "8px 0 0",
                              fontSize: "13px",
                              color: "#7f1d1d",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              lineHeight: 1.6,
                            }}
                          >
                            {group.deleteLog.before_content ?? "-"}
                          </p>

                          <p
                            style={{
                              margin: "10px 0 0",
                              fontSize: "12px",
                              color: "#991b1b",
                            }}
                          >
                            삭제 시각: {getDateTimeLabel(group.deleteLog.log_created_at)}
                            <br />
                            삭제 행위자: {group.deleteLog.actor_name ?? "이름 없음"} ·{" "}
                            {group.deleteLog.actor_email ?? "이메일 없음"} ·{" "}
                            <span style={{ fontFamily: "monospace" }}>
                              {group.deleteLog.actor_id ?? "-"}
                            </span>
                          </p>
                        </div>
                      )}

                      {group.announceLogs.length > 0 && (
                        <div
                          style={{
                            marginTop: "14px",
                            border: "1px solid #fde68a",
                            borderRadius: "14px",
                            padding: "14px",
                            background: "#fffbeb",
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              fontSize: "13px",
                              fontWeight: 900,
                              color: "#92400e",
                            }}
                          >
                            공지 이력
                          </p>

                          <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
                            {group.announceLogs.map((log) => (
                              <div
                                key={log.log_id}
                                style={{
                                  borderRadius: "10px",
                                  background: "#ffffff",
                                  padding: "10px",
                                  fontSize: "12px",
                                  color: "#713f12",
                                  lineHeight: 1.5,
                                }}
                              >
                                <strong>{getActionLabel(log.action)}</strong> ·{" "}
                                {getDateTimeLabel(log.log_created_at)}
                                <br />
                                행위자: {log.actor_name ?? "이름 없음"} ·{" "}
                                {log.actor_email ?? "이메일 없음"} ·{" "}
                                <span style={{ fontFamily: "monospace" }}>
                                  {log.actor_id ?? "-"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
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
                      "전",
                      "후",
                      "현재",
                      "생성",
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

                        <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "13px", color: "#6b7280", whiteSpace: "nowrap" }}>
                          {getDateTimeLabel(log.log_created_at)}
                        </td>

                        <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "13px", color: "#111827", whiteSpace: "nowrap" }}>
                          <strong>{log.actor_name ?? "이름 없음"}</strong>
                          <br />
                          {log.actor_email ?? "이메일 없음"}
                          <br />
                          <span style={{ color: "#6b7280", fontFamily: "monospace" }}>
                            {log.actor_id ?? "-"}
                          </span>
                        </td>

                        <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "13px", color: "#111827", whiteSpace: "nowrap" }}>
                          <strong>{log.message_user_name ?? "이름 없음"}</strong>
                          <br />
                          {log.message_user_email ?? "이메일 없음"}
                          <br />
                          <span style={{ color: "#6b7280", fontFamily: "monospace" }}>
                            {log.message_user_id ?? "-"}
                          </span>
                        </td>

                        <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "12px", color: "#6b7280", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                          {log.message_id ?? "-"}
                        </td>

                        <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "13px", minWidth: "220px", maxWidth: "320px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {makePreview(log.before_content)}
                        </td>

                        <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "13px", minWidth: "220px", maxWidth: "320px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {makePreview(log.after_content)}
                        </td>

                        <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "13px", color: log.message_is_deleted ? "#dc2626" : "#111827", minWidth: "220px", maxWidth: "320px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {log.message_is_deleted
                            ? "삭제된 메시지입니다."
                            : makePreview(log.message_current_content)}
                        </td>

                        <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "13px", color: "#6b7280", whiteSpace: "nowrap" }}>
                          {getDateTimeLabel(log.message_created_at)}
                        </td>

                        <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "13px", color: "#6b7280", whiteSpace: "nowrap" }}>
                          {getDateTimeLabel(log.message_edited_at)}
                        </td>

                        <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "13px", color: "#6b7280", whiteSpace: "nowrap" }}>
                          {getDateTimeLabel(log.message_deleted_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
