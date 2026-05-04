"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Profile = {
  email: string;
  name: string;
  status: "ACTIVE" | "DISABLED";
};

export default function AccountPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const [savingPassword, setSavingPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session || !session.user.email) {
      router.push("/");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("email, name, status")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      setErrorMessage("사용자 프로필을 찾을 수 없습니다.");
      setLoading(false);
      return;
    }

    if (data.status === "DISABLED") {
      await supabase.auth.signOut();
      router.push("/");
      return;
    }

    setProfile(data as Profile);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleUpdatePassword() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!profile?.email) {
      setErrorMessage("로그인 정보를 확인할 수 없습니다.");
      return;
    }

    if (!currentPassword) {
      setErrorMessage("현재 비밀번호를 입력해야 합니다.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("새 비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setErrorMessage("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMessage("새 비밀번호는 현재 비밀번호와 달라야 합니다.");
      return;
    }

    setSavingPassword(true);

    const { error: checkError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

    if (checkError) {
      setSavingPassword(false);
      setErrorMessage("현재 비밀번호가 올바르지 않습니다.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSavingPassword(false);

    if (updateError) {
      setErrorMessage("비밀번호를 변경하지 못했습니다.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setSuccessMessage("비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.");
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    padding: "11px",
    fontSize: "14px",
    background: "#ffffff",
  };

  const buttonStyle = {
    width: "100%",
    border: "none",
    borderRadius: "12px",
    background: "#111827",
    color: "#ffffff",
    padding: "14px",
    fontSize: "14px",
    fontWeight: 800,
  };

  const outlineButtonStyle = {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#111827",
    padding: "14px",
    fontSize: "14px",
    fontWeight: 800,
  };

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          height: "100dvh",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          계정 정보를 확인하는 중입니다...
        </p>
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
            계정 설정
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            비밀번호 변경
          </p>
        </div>

        <button
          onClick={handleLogout}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "10px",
            background: "#ffffff",
            padding: "9px 12px",
            fontSize: "13px",
            fontWeight: 700,
            color: "#111827",
            whiteSpace: "nowrap",
          }}
        >
          로그아웃
        </button>
      </header>

      <section
        style={{
          maxWidth: "620px",
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
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 800,
              color: "#111827",
            }}
          >
            내 계정
          </h2>

          <div
            style={{
              marginTop: "18px",
              borderRadius: "14px",
              background: "#f9fafb",
              padding: "18px",
            }}
          >
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
              로그인 계정
            </p>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "16px",
                fontWeight: 700,
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
              }}
            >
              {successMessage}
            </div>
          )}

          <div
            style={{
              marginTop: "24px",
              borderTop: "1px solid #e5e7eb",
              paddingTop: "24px",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 800,
                color: "#111827",
              }}
            >
              비밀번호 변경
            </h3>

            <div style={{ marginTop: "14px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#374151",
                }}
              >
                현재 비밀번호
              </label>

              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginTop: "12px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#374151",
                }}
              >
                새 비밀번호
              </label>

              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginTop: "12px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#374151",
                }}
              >
                새 비밀번호 확인
              </label>

              <input
                type="password"
                value={newPasswordConfirm}
                onChange={(event) => setNewPasswordConfirm(event.target.value)}
                style={inputStyle}
              />
            </div>

            <button
              type="button"
              onClick={handleUpdatePassword}
              disabled={savingPassword}
              style={{
                ...buttonStyle,
                marginTop: "14px",
                opacity: savingPassword ? 0.6 : 1,
              }}
            >
              {savingPassword ? "변경 중..." : "비밀번호 변경"}
            </button>
          </div>

          <div
            style={{
              marginTop: "24px",
              display: "grid",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={() => router.push("/home")}
              style={outlineButtonStyle}
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
