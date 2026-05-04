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

export default function StreamingPage() {
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

    if (!session) {
      router.push("/");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("email, name, role, status, pro_until")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      setErrorMessage("사용자 프로필을 찾을 수 없습니다.");
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

  function hasActivePro() {
    if (!profile?.pro_until) return false;

    const proUntilDate = new Date(profile.pro_until);
    const now = new Date();

    return proUntilDate > now;
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

  const buttonStyle = {
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#111827",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 800,
    whiteSpace: "nowrap" as const,
  };

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          스트리밍 접근 권한을 확인하는 중입니다...
        </p>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main
        style={{
          minHeight: "100dvh",
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
          <h1 style={{ margin: 0, fontSize: "22px", color: "#991b1b" }}>
            접근 오류
          </h1>

          <p style={{ marginTop: "12px", fontSize: "14px", color: "#7f1d1d" }}>
            {errorMessage}
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
              fontWeight: 800,
            }}
          >
            홈으로 돌아가기
          </button>
        </section>
      </main>
    );
  }

  if (!hasActivePro()) {
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
              스트리밍 보기
            </h1>

            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
              Moonmoon Archive 스트리밍
            </p>
          </div>

          <button onClick={() => router.push("/home")} style={buttonStyle}>
            홈
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
              border: "1px solid #fde68a",
              borderRadius: "20px",
              padding: "28px",
              background: "#fffbeb",
              boxSizing: "border-box",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: 800,
                color: "#92400e",
              }}
            >
              Pro 등급이 필요합니다
            </h2>

            <p
              style={{
                marginTop: "12px",
                fontSize: "14px",
                color: "#78350f",
                lineHeight: 1.7,
              }}
            >
              스트리밍 영상은 Pro 등급 계정만 시청할 수 있습니다. 시리얼키를
              등록하면 등록 시각을 기준으로 Pro 기간이 적용됩니다.
            </p>

            <div
              style={{
                marginTop: "20px",
                display: "grid",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={() => router.push("/serial-key")}
                style={{
                  border: "none",
                  borderRadius: "12px",
                  background: "#92400e",
                  color: "#ffffff",
                  padding: "13px",
                  fontSize: "14px",
                  fontWeight: 800,
                }}
              >
                시리얼키 등록하기
              </button>

              <button
                type="button"
                onClick={() => router.push("/streaming/schedule")}
                style={{
                  border: "1px solid #f59e0b",
                  borderRadius: "12px",
                  background: "#ffffff",
                  color: "#92400e",
                  padding: "13px",
                  fontSize: "14px",
                  fontWeight: 800,
                }}
              >
                스트리밍 일정표 보기
              </button>
            </div>
          </div>
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
            스트리밍 보기
          </h1>

          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
            Pro 만료: {getDateTimeLabel(profile?.pro_until ?? null)}
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/streaming/schedule")} style={buttonStyle}>
            일정표
          </button>

          <button onClick={() => router.push("/chat")} style={buttonStyle}>
            채팅
          </button>

          <button onClick={() => router.push("/home")} style={buttonStyle}>
            홈
          </button>
        </div>
      </header>

      <section
        style={{
          maxWidth: "980px",
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
            스트리밍 준비 중
          </h2>

          <p
            style={{
              marginTop: "10px",
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: 1.7,
            }}
          >
            이 페이지는 Pro 권한 확인까지 연결된 스트리밍 기본 페이지입니다.
            다음 단계에서 영상 목록과 재생기를 붙이면 됩니다.
          </p>

          <div
            style={{
              marginTop: "24px",
              borderRadius: "18px",
              background: "#111827",
              color: "#ffffff",
              padding: "48px 20px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 800,
              }}
            >
              영상 플레이어 영역
            </p>

            <p
              style={{
                margin: "10px 0 0",
                fontSize: "13px",
                color: "#d1d5db",
              }}
            >
              영상 관리 기능을 붙이면 이 영역에 재생기가 들어갑니다.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
