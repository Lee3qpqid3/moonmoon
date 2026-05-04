"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";
type UserStatus = "ACTIVE" | "DISABLED" | "HIDDEN";

type ChatColorThemeId =
  | "blue"
  | "green"
  | "purple"
  | "pink"
  | "orange"
  | "mint"
  | "indigo"
  | "slate";

type Profile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  pro_until: string | null;
  chat_color_theme: ChatColorThemeId | null;
};

type ChatColorTheme = {
  id: ChatColorThemeId;
  name: string;
  dotColor: string;
  lightBubble: string;
  darkBubble: string;
};

const chatColorThemes: ChatColorTheme[] = [
  {
    id: "blue",
    name: "블루",
    dotColor: "#2563EB",
    lightBubble: "#DBEAFE",
    darkBubble: "#1E3A8A",
  },
  {
    id: "green",
    name: "그린",
    dotColor: "#16A34A",
    lightBubble: "#DCFCE7",
    darkBubble: "#14532D",
  },
  {
    id: "purple",
    name: "퍼플",
    dotColor: "#9333EA",
    lightBubble: "#F3E8FF",
    darkBubble: "#581C87",
  },
  {
    id: "pink",
    name: "핑크",
    dotColor: "#DB2777",
    lightBubble: "#FCE7F3",
    darkBubble: "#831843",
  },
  {
    id: "orange",
    name: "오렌지",
    dotColor: "#EA580C",
    lightBubble: "#FFEDD5",
    darkBubble: "#7C2D12",
  },
  {
    id: "mint",
    name: "민트",
    dotColor: "#0D9488",
    lightBubble: "#CCFBF1",
    darkBubble: "#134E4A",
  },
  {
    id: "indigo",
    name: "인디고",
    dotColor: "#4F46E5",
    lightBubble: "#E0E7FF",
    darkBubble: "#312E81",
  },
  {
    id: "slate",
    name: "슬레이트",
    dotColor: "#475569",
    lightBubble: "#F1F5F9",
    darkBubble: "#334155",
  },
];

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
  fontWeight: 700,
  whiteSpace: "nowrap" as const,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "12px",
  fontSize: "14px",
  background: "#ffffff",
  color: "#111827",
};

const labelStyle = {
  display: "block",
  marginBottom: "7px",
  fontSize: "13px",
  fontWeight: 800,
  color: "#374151",
};

export default function AccountPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);

  const [chatColorTheme, setChatColorTheme] =
    useState<ChatColorThemeId>("blue");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingTheme, setSavingTheme] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, name, role, status, pro_until, chat_color_theme")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      setErrorMessage("사용자 프로필을 찾을 수 없습니다. 관리자에게 문의하세요.");
      setLoading(false);
      return;
    }

    if (data.status !== "ACTIVE") {
      await supabase.auth.signOut();
      router.push("/");
      return;
    }

    const nextProfile = data as Profile;

    setProfile(nextProfile);
    setChatColorTheme(nextProfile.chat_color_theme ?? "blue");
    setLoading(false);
  }

  async function saveChatTheme() {
    setErrorMessage("");
    setSuccessMessage("");

    setSavingTheme(true);

    const { error } = await supabase.rpc("update_own_chat_color_theme", {
      new_chat_color_theme: chatColorTheme,
    });

    setSavingTheme(false);

    if (error) {
      setErrorMessage(error.message || "채팅 색상 테마를 저장하지 못했습니다.");
      return;
    }

    setSuccessMessage("채팅 색상 테마가 저장되었습니다.");
    await loadProfile();
  }

  async function changePassword() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!profile) {
      setErrorMessage("프로필 정보를 확인할 수 없습니다.");
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

    setChangingPassword(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

    if (signInError) {
      setChangingPassword(false);
      setErrorMessage("현재 비밀번호가 올바르지 않습니다.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setChangingPassword(false);

    if (updateError) {
      setErrorMessage(updateError.message || "비밀번호를 변경하지 못했습니다.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setSuccessMessage("비밀번호가 변경되었습니다.");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function getRoleLabel(role: UserRole) {
    if (role === "SUPER_USER") return "슈퍼 유저";
    if (role === "ADMIN") return "관리자";
    return "일반 사용자";
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

  function getProLabel() {
    if (!profile?.pro_until) return "일반 등급";

    const proUntilDate = new Date(profile.pro_until);
    const now = new Date();

    if (proUntilDate <= now) return "일반 등급";

    return `Pro 등급 · ${getDateTimeLabel(profile.pro_until)}까지`;
  }

  function getInitialLetter() {
    const targetName = profile?.name || "?";
    return targetName.slice(0, 1);
  }

  function getSelectedTheme() {
    return (
      chatColorThemes.find((theme) => theme.id === chatColorTheme) ??
      chatColorThemes[0]
    );
  }

  if (loading) {
    return (
      <main style={centerStyle}>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          계정 정보를 불러오는 중입니다...
        </p>
      </main>
    );
  }

  const selectedTheme = getSelectedTheme();

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
            계정 설정
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            비밀번호와 커뮤니티 채팅 프로필을 관리합니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/home")} style={buttonStyle}>
            홈
          </button>

          <button onClick={handleLogout} style={buttonStyle}>
            로그아웃
          </button>
        </div>
      </header>

      <section
        style={{
          maxWidth: "920px",
          margin: "0 auto",
          padding: "28px 20px",
          boxSizing: "border-box",
        }}
      >
        <div style={cardStyle}>
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 800,
              color: "#111827",
            }}
          >
            현재 계정
          </h2>

          <div
            style={{
              marginTop: "18px",
              borderRadius: "14px",
              background: "#f9fafb",
              padding: "18px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "999px",
                background: selectedTheme.dotColor,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                fontWeight: 900,
                flex: "0 0 auto",
              }}
            >
              {getInitialLetter()}
            </div>

            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: 800,
                  color: "#111827",
                  wordBreak: "break-all",
                }}
              >
                {profile?.name} · {profile?.email}
              </p>

              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "13px",
                  color: "#6b7280",
                  lineHeight: 1.5,
                }}
              >
                {profile ? getRoleLabel(profile.role) : "-"} · {getProLabel()}
              </p>
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
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 800,
              color: "#111827",
            }}
          >
            채팅 프로필 색상
          </h2>

          <p
            style={{
              marginTop: "8px",
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: 1.6,
            }}
          >
            커뮤니티 채팅에서 사용할 프로필 원과 말풍선 색상 세트입니다.
            라이트 모드와 다크 모드 모두에서 잘 보이는 조합만 제공합니다.
          </p>

          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gap: "12px",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            }}
          >
            {chatColorThemes.map((theme) => {
              const selected = theme.id === chatColorTheme;

              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setChatColorTheme(theme.id)}
                  style={{
                    border: selected ? "2px solid #111827" : "1px solid #d1d5db",
                    borderRadius: "16px",
                    background: "#ffffff",
                    padding: "14px",
                    textAlign: "left",
                    boxSizing: "border-box",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "999px",
                        background: theme.dotColor,
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: 900,
                      }}
                    >
                      {getInitialLetter()}
                    </div>

                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "14px",
                          fontWeight: 900,
                          color: "#111827",
                        }}
                      >
                        {theme.name}
                      </p>

                      <p
                        style={{
                          margin: "3px 0 0",
                          fontSize: "11px",
                          color: "#6b7280",
                        }}
                      >
                        {selected ? "선택됨" : "선택 가능"}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "12px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        borderRadius: "10px",
                        background: theme.lightBubble,
                        color: "#111827",
                        padding: "8px",
                        fontSize: "11px",
                        fontWeight: 800,
                      }}
                    >
                      라이트
                    </div>

                    <div
                      style={{
                        borderRadius: "10px",
                        background: theme.darkBubble,
                        color: "#F9FAFB",
                        padding: "8px",
                        fontSize: "11px",
                        fontWeight: 800,
                      }}
                    >
                      다크
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div
            style={{
              marginTop: "22px",
              border: "1px solid #e5e7eb",
              borderRadius: "18px",
              padding: "18px",
              background: "#f9fafb",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 900,
                color: "#111827",
              }}
            >
              채팅 미리보기
            </h3>

            <div
              style={{
                marginTop: "16px",
                display: "grid",
                gap: "16px",
              }}
            >
              <div>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#6b7280",
                  }}
                >
                  라이트 모드
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "999px",
                      background: selectedTheme.dotColor,
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 900,
                      flex: "0 0 auto",
                    }}
                  >
                    {getInitialLetter()}
                  </div>

                  <div>
                    <p
                      style={{
                        margin: "0 0 6px",
                        fontSize: "12px",
                        color: "#6b7280",
                        fontWeight: 700,
                      }}
                    >
                      {profile?.name} · {profile?.email}
                    </p>

                    <div
                      style={{
                        maxWidth: "520px",
                        borderRadius: "16px",
                        background: selectedTheme.lightBubble,
                        color: "#111827",
                        padding: "12px 14px",
                        fontSize: "14px",
                        lineHeight: 1.6,
                      }}
                    >
                      선택한 테마가 라이트 모드에서 이렇게 보입니다.
                    </div>

                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: "12px",
                        color: "#9ca3af",
                      }}
                    >
                      오전 03:24 · 수정됨
                    </p>
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderRadius: "16px",
                  background: "#111827",
                  padding: "16px",
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#d1d5db",
                  }}
                >
                  다크 모드
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "999px",
                      background: selectedTheme.dotColor,
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 900,
                      flex: "0 0 auto",
                    }}
                  >
                    {getInitialLetter()}
                  </div>

                  <div>
                    <p
                      style={{
                        margin: "0 0 6px",
                        fontSize: "12px",
                        color: "#d1d5db",
                        fontWeight: 700,
                      }}
                    >
                      {profile?.name} · {profile?.email}
                    </p>

                    <div
                      style={{
                        maxWidth: "520px",
                        borderRadius: "16px",
                        background: selectedTheme.darkBubble,
                        color: "#F9FAFB",
                        padding: "12px 14px",
                        fontSize: "14px",
                        lineHeight: 1.6,
                      }}
                    >
                      선택한 테마가 다크 모드에서 이렇게 보입니다.
                    </div>

                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: "12px",
                        color: "#9ca3af",
                      }}
                    >
                      오전 03:24 · 수정됨
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={saveChatTheme}
            disabled={savingTheme}
            style={{
              marginTop: "16px",
              border: "none",
              borderRadius: "10px",
              background: "#111827",
              color: "#ffffff",
              padding: "12px 14px",
              fontSize: "14px",
              fontWeight: 800,
              opacity: savingTheme ? 0.6 : 1,
            }}
          >
            {savingTheme ? "저장 중..." : "채팅 색상 저장"}
          </button>
        </div>

        <div style={{ ...cardStyle, marginTop: "20px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 800,
              color: "#111827",
            }}
          >
            비밀번호 변경
          </h2>

          <p
            style={{
              marginTop: "8px",
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: 1.6,
            }}
          >
            보안을 위해 현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.
          </p>

          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gap: "12px",
            }}
          >
            <div>
              <label style={labelStyle}>현재 비밀번호</label>

              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>새 비밀번호</label>

              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>새 비밀번호 확인</label>

              <input
                type="password"
                value={newPasswordConfirm}
                onChange={(event) =>
                  setNewPasswordConfirm(event.target.value)
                }
                style={inputStyle}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={changePassword}
            disabled={changingPassword}
            style={{
              marginTop: "16px",
              border: "none",
              borderRadius: "10px",
              background: "#111827",
              color: "#ffffff",
              padding: "12px 14px",
              fontSize: "14px",
              fontWeight: 800,
              opacity: changingPassword ? 0.6 : 1,
            }}
          >
            {changingPassword ? "변경 중..." : "비밀번호 변경"}
          </button>
        </div>
      </section>
    </main>
  );
}
