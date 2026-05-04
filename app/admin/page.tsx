"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type AdminProfile = {
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
};

export default function AdminPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
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
        .select("email, name, role, status")
        .eq("id", session.user.id)
        .single();

      if (error || !data) {
        setDenied(true);
        setLoading(false);
        return;
      }

      if (data.status === "DISABLED") {
        await supabase.auth.signOut();
        router.push("/");
        return;
      }

      if (data.role !== "ADMIN") {
        setDenied(true);
        setLoading(false);
        return;
      }

      setProfile(data as AdminProfile);
      setLoading(false);
    }

    checkAdmin();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

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
          관리자 권한을 확인하는 중입니다...
        </p>
      </main>
    );
  }

  if (denied) {
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

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => router.push("/home")}
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
            홈
          </button>

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
        </div>
      </header>

      <section
        style={{
          maxWidth: "1000px",
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
            현재 관리자 계정으로 로그인되어 있습니다. 다음 단계에서 사용자
            생성, 사용자 비활성화, 시리얼키 발급, 영상 관리 기능을 이곳에
            추가합니다.
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
              현재 관리자
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

          <div
            style={{
              marginTop: "24px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            <button
              type="button"
              style={{
                border: "none",
                borderRadius: "14px",
                background: "#111827",
                color: "#ffffff",
                padding: "18px",
                fontSize: "14px",
                fontWeight: 800,
                textAlign: "left",
              }}
            >
              사용자 관리
            </button>

            <button
              type="button"
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "14px",
                background: "#ffffff",
                color: "#111827",
                padding: "18px",
                fontSize: "14px",
                fontWeight: 800,
                textAlign: "left",
              }}
            >
              시리얼키 관리
            </button>

            <button
              type="button"
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "14px",
                background: "#ffffff",
                color: "#111827",
                padding: "18px",
                fontSize: "14px",
                fontWeight: 800,
                textAlign: "left",
              }}
            >
              영상 관리
            </button>

            <button
              type="button"
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "14px",
                background: "#ffffff",
                color: "#111827",
                padding: "18px",
                fontSize: "14px",
                fontWeight: 800,
                textAlign: "left",
              }}
            >
              재생 기록
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
