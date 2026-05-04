"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";
type UserStatus = "ACTIVE" | "DISABLED" | "HIDDEN";

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
  const [errorMessage, setErrorMessage] = useState("");

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

    if (data.status !== "ACTIVE") {
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

  function getProStatus() {
    if (!profile?.pro_until) return "일반 등급";

    const proUntilDate = new Date(profile.pro_until);
    const now = new Date();

    if (proUntilDate <= now) return "일반 등급";

    return `Pro 등급 · ${getDateTimeLabel(profile.pro_until)}까지`;
  }

  const pageStyle = {
    minHeight: "100dvh",
    background: "#ffffff",
    fontFamily: "Arial, sans-serif",
  };

  const primaryButtonStyle = {
    width: "100%",
    border: "none",
    borderRadius: "14px",
    background: "#111827",
    color: "#ffffff",
    padding: "16px",
    fontSize: "14px",
    fontWeight: 800,
    textAlign: "left" as const,
  };

  const outlineButtonStyle = {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: "14px",
    background: "#ffffff",
    color: "#111827",
    padding: "16px",
    fontSize: "14px",
    fontWeight: 800,
    textAlign: "left" as const,
  };

  const smallTextStyle = {
    margin: "6px 0 0",
    fontSize: "12px",
    color: "#6b7280",
    lineHeight: 1.5,
    fontWeight: 400,
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
          maxWidth: "960px",
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
              fontSize: "24px",
              fontWeight: 800,
              color: "#111827",
            }}
          >
            {profile?.name}님, 환영합니다.
          </h2>

          <p
            style={{
              marginTop: "10px",
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: 1.6,
            }}
          >
            스트리밍, 일정표, 채팅, 계정 설정을 이곳에서 이동할 수 있습니다.
          </p>

          <div
            style={{
              marginTop: "24px",
              borderRadius: "14px",
              background: "#f9fafb",
              padding: "18px",
            }}
          >
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
              현재 계정
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

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "13px",
                color: "#6b7280",
                lineHeight: 1.6,
              }}
            >
              {profile ? getRoleLabel(profile.role) : "-"} · {getProStatus()}
            </p>
          </div>

          <div
            style={{
              marginTop: "24px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={() => router.push("/streaming")}
              style={primaryButtonStyle}
            >
              스트리밍 보기
              <p style={smallTextStyle}>Pro 유저 전용 영상 시청 페이지입니다.</p>
            </button>

            <button
              type="button"
              onClick={() => router.push("/streaming/schedule")}
              style={outlineButtonStyle}
            >
              스트리밍 일정표
              <p style={smallTextStyle}>예정된 스트리밍과 작업 현황을 확인합니다.</p>
            </button>

            <button
              type="button"
              onClick={() => router.push("/chat")}
              style={outlineButtonStyle}
            >
              전체 채팅
              <p style={smallTextStyle}>모든 유저가 함께 사용하는 서버 채팅입니다.</p>
            </button>

            <button
              type="button"
              onClick={() => router.push("/serial-key")}
              style={outlineButtonStyle}
            >
              시리얼키 등록
              <p style={smallTextStyle}>Pro 시리얼키를 등록하고 사용권을 확인합니다.</p>
            </button>

            <button
              type="button"
              onClick={() => router.push("/account")}
              style={outlineButtonStyle}
            >
              계정 설정
              <p style={smallTextStyle}>이름과 비밀번호를 관리합니다.</p>
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
                <p style={smallTextStyle}>사용자, 시리얼키, 기록을 관리합니다.</p>
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
