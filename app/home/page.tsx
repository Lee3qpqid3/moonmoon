"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Profile = {
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
  pro_until: string | null;
};

export default function HomePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
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
        setErrorMessage(
          "사용자 프로필을 찾을 수 없습니다. 관리자에게 문의하세요."
        );
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

    loadProfile();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function getRoleLabel(role: Profile["role"]) {
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

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
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

  if (errorMessage) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          fontFamily: "Arial, sans-serif",
          padding: "20px",
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
        minHeight: "100vh",
        background: "#ffffff",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid #e5e7eb",
          padding: "18px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
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
          }}
        >
          로그아웃
        </button>
      </header>

      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "32px 20px",
        }}
      >
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
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
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
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
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
                이메일
              </p>

              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#111827",
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
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
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
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
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
              display: "grid",
              gap: "12px",
            }}
          >
            <button
              type="button"
              style={{
                width: "100%",
                border: "none",
                borderRadius: "12px",
                background: "#111827",
                color: "#ffffff",
                padding: "14px",
                fontSize: "14px",
                fontWeight: 800,
              }}
            >
              스트리밍으로 이동
            </button>

            <button
              type="button"
              style={{
                width: "100%",
                border: "1px solid #d1d5db",
                borderRadius: "12px",
                background: "#ffffff",
                color: "#111827",
                padding: "14px",
                fontSize: "14px",
                fontWeight: 800,
              }}
            >
              시리얼키 등록
            </button>

            {profile?.role === "ADMIN" && (
              <button
                type="button"
                style={{
                  width: "100%",
                  border: "1px solid #111827",
                  borderRadius: "12px",
                  background: "#ffffff",
                  color: "#111827",
                  padding: "14px",
                  fontSize: "14px",
                  fontWeight: 800,
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
