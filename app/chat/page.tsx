"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Profile = {
  email: string;
  name: string;
  status: "ACTIVE" | "DISABLED" | "HIDDEN";
};

export default function ChatPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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
      .select("email, name, status")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
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

  const buttonStyle = {
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#111827",
    padding: "9px 12px",
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
          채팅 페이지를 불러오는 중입니다...
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800 }}>
            전체 채팅
          </h1>

          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
            모든 유저가 함께 사용하는 서버 채팅입니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/streaming")} style={buttonStyle}>
            스트리밍
          </button>

          <button onClick={() => router.push("/home")} style={buttonStyle}>
            홈
          </button>
        </div>
      </header>

      <section
        style={{
          maxWidth: "860px",
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
            채팅 준비 중
          </h2>

          <p
            style={{
              marginTop: "10px",
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: 1.7,
            }}
          >
            이 페이지는 전체 채팅 기능을 붙이기 위한 기본 페이지입니다. 다음
            단계에서 메시지 DB, 말풍선 UI, 수정, 보내기 취소, 링크 자동 인식을
            구현하면 됩니다.
          </p>

          <div
            style={{
              marginTop: "20px",
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
                fontWeight: 800,
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
              gap: "12px",
            }}
          >
            <div
              style={{
                alignSelf: "start",
                display: "grid",
                gap: "6px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#374151",
                }}
              >
                예시 메시지
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
                    background: "#2563eb",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: 800,
                    flex: "0 0 auto",
                  }}
                >
                  문
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
                    문문 · user@test.com
                  </p>

                  <div
                    style={{
                      maxWidth: "520px",
                      borderRadius: "16px",
                      background: "#dbeafe",
                      color: "#111827",
                      padding: "12px 14px",
                      fontSize: "14px",
                      lineHeight: 1.6,
                    }}
                  >
                    카카오톡처럼 말풍선으로 표시될 예정입니다.
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
                display: "grid",
                justifyItems: "end",
                gap: "6px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#6b7280",
                  fontWeight: 700,
                }}
              >
                {profile?.name} · 나
              </p>

              <div
                style={{
                  maxWidth: "520px",
                  borderRadius: "16px",
                  background: "#dcfce7",
                  color: "#111827",
                  padding: "12px 14px",
                  fontSize: "14px",
                  lineHeight: 1.6,
                }}
              >
                내 메시지는 오른쪽에 표시되고, 수정/보내기 취소 버튼이 붙습니다.
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#9ca3af",
                }}
              >
                오전 03:25
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
