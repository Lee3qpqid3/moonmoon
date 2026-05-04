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

const chatLengthOptions = [
  1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500,
];

export default function AdminChatSettingsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [chatMaxLength, setChatMaxLength] = useState(2000);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

    const { data: settingsData, error: settingsError } = await supabase.rpc(
      "get_chat_settings"
    );

    if (settingsError) {
      setErrorMessage("채팅 설정을 불러오지 못했습니다.");
      setLoading(false);
      return;
    }

    const nextSettings =
      Array.isArray(settingsData) && settingsData.length > 0
        ? settingsData[0]
        : null;

    if (nextSettings?.chat_max_length) {
      setChatMaxLength(Number(nextSettings.chat_max_length));
    }

    setLoading(false);
  }

  async function saveSettings() {
    setErrorMessage("");
    setSuccessMessage("");
    setSaving(true);

    const { error } = await supabase.rpc("admin_update_chat_max_length", {
      new_chat_max_length: chatMaxLength,
    });

    setSaving(false);

    if (error) {
      setErrorMessage(error.message || "채팅 설정을 저장하지 못했습니다.");
      return;
    }

    setSuccessMessage("채팅 설정이 저장되었습니다.");
  }

  function getRoleLabel(role: UserRole) {
    if (role === "SUPER_USER") return "슈퍼 유저";
    if (role === "ADMIN") return "관리자";
    return "일반 사용자";
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
            커뮤니티 채팅의 기본 설정을 관리합니다.
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
          maxWidth: "720px",
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
            유저가 메시지를 보낼 때 허용할 최대 글자수입니다. 초과한 내용은
            전송 시 자동으로 잘립니다.
          </p>

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
              onChange={(event) => setChatMaxLength(Number(event.target.value))}
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
        </div>
      </section>
    </main>
  );
}
