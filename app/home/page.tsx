"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";
type UserStatus = "ACTIVE" | "DISABLED";

type Profile = {
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  pro_until: string | null;
};

export default function HomePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

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
      .select("email, name, role, status, pro_until")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      setErrorMessage("사용자 프로필을 찾을 수 없습니다. 관리자에게 문의하세요.");
      setLoading(false);
      return;
    }

    if (data.status === "DISABLED") {
      await supabase.auth.signOut();
      router.push("/");
      return;
    }

    const nextProfile = data as Profile;

    setProfile(nextProfile);
    setNameInput(nextProfile.name);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleUpdateName() {
    if (!nameInput.trim()) {
      setErrorMessage("이름을 입력해야 합니다.");
      setSuccessMessage("");
      return;
    }

    setSavingName(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc("update_own_profile_name", {
      new_name: nameInput.trim(),
    });

    setSavingName(false);

    if (error) {
      setErrorMessage(error.message || "이름을 변경하지 못했습니다.");
      return;
    }

    setSuccessMessage("이름이 변경되었습니다.");
    await loadProfile();
  }

  async function handleUpdatePassword() {
    setErrorMessage("");
    setSuccessMessage("");

    if (newPassword.length < 6) {
      setErrorMessage("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setErrorMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setSavingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSavingPassword(false);

    if (error) {
      setErrorMessage("비밀번호를 변경하지 못했습니다.");
      return;
    }

    setNewPassword("");
    setNewPasswordConfirm("");
    setSuccessMessage("비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.");
  }

  function getRoleLabel(role: UserRole) {
    if (role === "SUPER_USER") {
      return "슈퍼 유저";
    }

    if (role === "ADMIN") {
      return "관리자";
    }

    return "일반 사용자";
  }

  function getProStatus() {
    if (!profile?.pro_until) {
      return "일반 등급";
    }

    const proUntilDate = new Date(profile.pro_until);
    const now = new Date();

    if (proUntilDate <= now) {
      return "일반 등급";
    }

    return `Pro 등급 · ${proUntilDate.toLocaleDateString("ko-KR")}까지`;
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
          로그인 정보를 확인하는 중입니다...
        </p>
      </main>
    );
  }

  if (errorMessage && !profile) {
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
          padding: "20px",
          boxSizing: "border-box",
        }}
      >
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
            프로필 오류
          </h1>

          <p
            style={{
              marginTop: "12px",
              fontSize: "14px",
              color: "#7f1d1d",
              lineHeight: 1.6,
            }}
          >
            {errorMessage}
          </p>

          <button
            onClick={handleLogout}
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
            로그인 화면으로 돌아가기
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
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 800,
              color: "#111827",
            }}
          >
            Moonmoon Archive
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            비공개 스트리밍 아카이브
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
          maxWidth: "900px",
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
            홈
          </h2>

          <p
            style={{
              marginTop: "10px",
              fontSize: "14px",
              color: "#6b7280",
            }}
          >
            로그인에 성공했습니다.
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
              display: "grid",
              gap: "12px",
            }}
          >
            <div
              style={{
                borderRadius: "14px",
                background: "#f9fafb",
                padding: "18px",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                이름
              </p>

              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {profile?.name}
              </p>
            </div>

            <div
              style={{
                borderRadius: "14px",
                background: "#f9fafb",
                padding: "18px",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                이메일
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
                {profile?.email}
              </p>
            </div>

            <div
              style={{
                borderRadius: "14px",
                background: "#f9fafb",
                padding: "18px",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                역할
              </p>

              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {profile ? getRoleLabel(profile.role) : "-"}
              </p>
            </div>

            <div
              style={{
                borderRadius: "14px",
                background: "#f9fafb",
                padding: "18px",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                등급
              </p>

              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {getProStatus()}
              </p>
            </div>
          </div>

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
              내 정보 수정
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
                이름
              </label>

              <input
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                style={inputStyle}
              />
            </div>

            <button
              type="button"
              onClick={handleUpdateName}
              disabled={savingName}
              style={{
                ...buttonStyle,
                marginTop: "12px",
                opacity: savingName ? 0.6 : 1,
              }}
            >
              {savingName ? "저장 중..." : "이름 저장"}
            </button>
          </div>

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
                marginTop: "12px",
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
            <button type="button" style={buttonStyle}>
              스트리밍으로 이동
            </button>

            <button type="button" style={outlineButtonStyle}>
              시리얼키 등록
            </button>

            {(profile?.role === "ADMIN" || profile?.role === "SUPER_USER") && (
              <button
                type="button"
                onClick={() => router.push("/admin")}
                style={{
                  ...outlineButtonStyle,
                  border: "1px solid #111827",
                }}
              >
                관리자 페이지
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
