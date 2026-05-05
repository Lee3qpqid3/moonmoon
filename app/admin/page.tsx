"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";
type UserStatus = "ACTIVE" | "DISABLED" | "HIDDEN";

type AdminProfile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
};

type AdminMenuItem = {
  title: string;
  description: string;
  href: string;
  superOnly?: boolean;
};

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

export default function AdminPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const adminMenuItems: AdminMenuItem[] = useMemo(
    () => [
      {
        title: "사용자 관리",
        description: "계정 추가, 수정, 숨김, 복구, 삭제를 관리합니다.",
        href: "/admin/users",
      },
      {
        title: "시리얼키 관리",
        description: "Pro 시리얼키를 발급하고 상태를 관리합니다.",
        href: "/admin/serial-keys",
      },
      {
        title: "유저 사용권 기록",
        description: "특정 유저의 Pro 사용권 기록을 조회합니다.",
        href: "/admin/user-entitlements",
      },
      {
        title: "시리얼키 발급 로그",
        description: "누가 며칠짜리 키를 몇 개 발급했는지 확인합니다.",
        href: "/admin/serial-key-logs",
        superOnly: true,
      },
      {
        title: "채팅 로그",
        description: "커뮤니티 메시지 생성, 수정, 삭제, 공지 기록을 확인합니다.",
        href: "/admin/chat-logs",
      },
      {
        title: "채팅 설정",
        description: "커뮤니티 채팅의 글자수 등 기본 설정을 관리합니다.",
        href: "/admin/chat-settings",
      },
      {
        title: "진행도 단계 관리",
        description: "스트리밍 일정표의 진행도 단계 이름과 순서를 관리합니다.",
        href: "/admin/progress-steps",
      },
      {
        title: "영상 관리",
        description: "사용자별 주차/강사 LIVE, DOCS 권한을 배부합니다.",
        href: "/admin/video-management",
      },
      {
        title: "스트리밍 소스 관리",
        description: "WebDAV live/docs 소스를 스캔하고 원본 파일을 관리합니다.",
        href: "/admin/streaming-source",
        superOnly: true,
      },
      {
        title: "재생 기록",
        description: "누가 언제 어떤 영상을 재생했는지 확인합니다.",
        href: "/admin/playback-logs",
      },
    ],
    []
  );

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
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

  function getMenuButtonStyle(item: AdminMenuItem) {
    return {
      border: item.superOnly ? "1px solid #111827" : "1px solid #d1d5db",
      borderRadius: "14px",
      background: "#ffffff",
      color: "#111827",
      padding: "16px",
      fontSize: "14px",
      fontWeight: 800,
      textAlign: "left" as const,
      boxShadow: "0 6px 18px rgba(0,0,0,0.025)",
      minHeight: "96px",
      cursor: "pointer",
    };
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
            관리자 권한이 있는 계정만 이 페이지에 접근할 수 있습니다.
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
            관리자 페이지
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            Moonmoon Archive 관리 도구
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
          maxWidth: "1180px",
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
            관리 메뉴
          </h2>

          <p
            style={{
              marginTop: "10px",
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: 1.6,
            }}
          >
            현재 계정의 권한은 {profile ? getRoleLabel(profile.role) : "-"}
            입니다. 필요한 관리 항목을 선택하세요.
          </p>

          <div
            style={{
              marginTop: "24px",
              borderRadius: "14px",
              background: "#f9fafb",
              padding: "18px",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#6b7280",
              }}
            >
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
              {profile?.name} · {profile?.email} ·{" "}
              {profile ? getRoleLabel(profile.role) : "-"}
            </p>
          </div>

          <div
            style={{
              marginTop: "24px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "12px",
            }}
          >
            {adminMenuItems
              .filter((item) => !item.superOnly || profile?.role === "SUPER_USER")
              .map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => router.push(item.href)}
                  style={getMenuButtonStyle(item)}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <span>{item.title}</span>

                    {item.superOnly && (
                      <span
                        style={{
                          border: "1px solid #111827",
                          borderRadius: "999px",
                          padding: "3px 7px",
                          fontSize: "10px",
                          fontWeight: 900,
                          color: "#111827",
                          background: "#ffffff",
                        }}
                      >
                        SUPER
                      </span>
                    )}
                  </span>

                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "12px",
                      color: "#6b7280",
                      lineHeight: 1.5,
                      fontWeight: 400,
                    }}
                  >
                    {item.description}
                  </p>
                </button>
              ))}
          </div>
        </div>
      </section>
    </main>
  );
}
