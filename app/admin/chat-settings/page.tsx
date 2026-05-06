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

type AppSettings = {
  id: number;
  chat_max_length: number;
  updated_at: string | null;
};

type ResetChatResult = {
  deleted_messages: number;
  deleted_logs: number;
};

const chatLengthOptions = [
  1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500,
];

export default function AdminChatSettingsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [chatMaxLength, setChatMaxLength] = useState(2000);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingChat, setResettingChat] = useState(false);
  const [denied, setDenied] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    checkAdminAndLoadSettings();
  }, []);

  async function checkAdminAndLoadSettings() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, name, role, status")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profileData) {
      setDenied(true);
      setLoading(false);
      return;
    }

    if (profileData.status !== "ACTIVE") {
      await supabase.auth.signOut();
      router.push("/");
      return;
    }

    if (profileData.role !== "ADMIN" && profileData.role !== "SUPER_USER") {
      setDenied(true);
      setLoading(false);
      return;
    }

    setProfile(profileData as AdminProfile);

    await loadSettings();

    setLoading(false);
  }

  async function loadSettings() {
    setErrorMessage("");

    const { data, error } = await supabase
      .from("app_settings")
      .select("id, chat_max_length, updated_at")
      .eq("id", 1)
      .single();

    if (error || !data) {
      setErrorMessage(
        "채팅 설정을 불러오지 못했습니다. app_settings 설정값을 확인해 주세요."
      );
      return;
    }

    const settings = data as AppSettings;

    if (
      Number.isInteger(settings.chat_max_length) &&
      settings.chat_max_length >= 100
    ) {
      setChatMaxLength(settings.chat_max_length);
    }

    setLastUpdatedAt(settings.updated_at);
  }

  async function saveSettings() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!Number.isInteger(chatMaxLength)) {
      setErrorMessage("최대 글자수 값이 올바르지 않습니다.");
      return;
    }

    if (chatMaxLength < 100 || chatMaxLength > 10000) {
      setErrorMessage("최대 글자수는 100자 이상 10000자 이하로 설정해야 합니다.");
      return;
    }

    setSaving(true);

    const nextUpdatedAt = new Date().toISOString();

    const { error } = await supabase
      .from("app_settings")
      .update({
        chat_max_length: chatMaxLength,
        updated_at: nextUpdatedAt,
      })
      .eq("id", 1);

    setSaving(false);

    if (error) {
      setErrorMessage(error.message || "채팅 설정을 저장하지 못했습니다.");
      return;
    }

    setLastUpdatedAt(nextUpdatedAt);
    setSuccessMessage(`채팅 최대 글자수를 ${chatMaxLength}자로 저장했습니다.`);
  }

  async function resetChat() {
    setErrorMessage("");
    setSuccessMessage("");

    const confirmed = window.confirm(
      "커뮤니티 채팅을 초기화할까요?\n\n모든 채팅 메시지와 채팅 로그가 삭제됩니다. 이 작업은 되돌릴 수 없습니다."
    );

    if (!confirmed) {
      return;
    }

    const doubleConfirmed = window.confirm(
      "정말 초기화할까요?\n\n현재 채팅방의 모든 대화가 사라집니다."
    );

    if (!doubleConfirmed) {
      return;
    }

    setResettingChat(true);

    const { data, error } = await supabase.rpc("admin_reset_chat");

    setResettingChat(false);

    if (error) {
      setErrorMessage(error.message || "채팅을 초기화하지 못했습니다.");
      return;
    }

    const result =
      Array.isArray(data) && data.length > 0
        ? (data[0] as ResetChatResult)
        : null;

    if (result) {
      setSuccessMessage(
        `채팅이 초기화되었습니다. 삭제된 메시지 ${result.deleted_messages}개, 삭제된 로그 ${result.deleted_logs}개입니다.`
      );
      return;
    }

    setSuccessMessage("채팅이 초기화되었습니다.");
  }

  function getRoleLabel(role: UserRole) {
    if (role === "SUPER_USER") return "슈퍼 유저";
    if (role === "ADMIN") return "관리자";
    return "일반 사용자";
  }

  function getUpdatedAtLabel(value: string | null) {
    if (!value) return "-";

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
            채팅 설정은 관리자 이상 계정만 접근할 수 있습니다.
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
            채팅 설정
          </h1>

          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
            커뮤니티 채팅의 기본 설정과 초기화를 관리합니다.
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
          maxWidth: "760px",
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
              marginBottom: "20px",
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

          <section style={{ marginTop: "20px" }}>
            <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>
              메시지 최대 글자수
            </h2>

            <p
              style={{
                marginTop: "8px",
                fontSize: "14px",
                color: "#6b7280",
                lineHeight: 1.6,
              }}
            >
              유저가 메시지를 보낼 때 허용할 최대 글자수입니다. 이 값은
              app_settings의 chat_max_length에 저장됩니다.
            </p>

            <div style={{ marginTop: "18px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "7px",
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#374151",
                }}
              >
                최대 글자수
              </label>

              <select
                value={chatMaxLength}
                onChange={(event) =>
                  setChatMaxLength(Number(event.target.value))
                }
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid #d1d5db",
                  borderRadius: "10px",
                  padding: "12px",
                  fontSize: "14px",
                  background: "#ffffff",
                  color: "#111827",
                }}
              >
                {chatLengthOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}자
                  </option>
                ))}
              </select>
            </div>

            <p
              style={{
                margin: "10px 0 0",
                fontSize: "12px",
                color: "#9ca3af",
                lineHeight: 1.5,
              }}
            >
              마지막 저장 시각: {getUpdatedAtLabel(lastUpdatedAt)}
            </p>

            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              style={{
                marginTop: "16px",
                border: "none",
                borderRadius: "10px",
                background: "#111827",
                color: "#ffffff",
                padding: "12px 14px",
                fontSize: "14px",
                fontWeight: 800,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "저장 중..." : "채팅 설정 저장"}
            </button>
          </section>

          <section
            style={{
              marginTop: "28px",
              borderTop: "1px solid #e5e7eb",
              paddingTop: "24px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 800,
                color: "#111827",
              }}
            >
              채팅 초기화
            </h2>

            <p
              style={{
                marginTop: "8px",
                fontSize: "14px",
                color: "#6b7280",
                lineHeight: 1.6,
              }}
            >
              커뮤니티의 모든 채팅 메시지와 채팅 로그를 삭제합니다. 초기화 후
              채팅방은 빈 상태가 되며, 이 작업은 되돌릴 수 없습니다.
            </p>

            <div
              style={{
                marginTop: "16px",
                border: "1px solid #fecaca",
                borderRadius: "14px",
                background: "#fff1f2",
                padding: "14px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#991b1b",
                  lineHeight: 1.6,
                  fontWeight: 700,
                }}
              >
                주의: 채팅 초기화는 되돌릴 수 없습니다. 테스트 채팅이나 운영 전
                데이터 정리 목적일 때만 사용하세요.
              </p>
            </div>

            <button
              type="button"
              onClick={resetChat}
              disabled={resettingChat}
              style={{
                marginTop: "16px",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                background: "#ffffff",
                color: "#dc2626",
                padding: "12px 14px",
                fontSize: "14px",
                fontWeight: 900,
                opacity: resettingChat ? 0.6 : 1,
              }}
            >
              {resettingChat ? "초기화 중..." : "채팅 전체 초기화"}
            </button>
          </section>
        </div>
      </section>
    </main>
  );
}
