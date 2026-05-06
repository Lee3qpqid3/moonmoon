"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type ProfileStatus = "ACTIVE" | "DISABLED" | "HIDDEN";

const pageStyle = {
  minHeight: "100dvh",
  background:
    "radial-gradient(circle at top left, #eef2ff 0, transparent 32%), linear-gradient(135deg, #f8fafc 0%, #ffffff 42%, #f1f5f9 100%)",
  fontFamily: "Arial, sans-serif",
  padding: "22px",
  boxSizing: "border-box" as const,
};

const shellStyle = {
  minHeight: "calc(100dvh - 44px)",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.1fr) minmax(360px, 430px)",
  gap: "24px",
  alignItems: "stretch",
  maxWidth: "1120px",
  margin: "0 auto",
};

const panelStyle = {
  border: "1px solid rgba(226, 232, 240, 0.9)",
  borderRadius: "28px",
  background: "rgba(255, 255, 255, 0.82)",
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.08)",
  boxSizing: "border-box" as const,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "13px 14px",
  fontSize: "14px",
  background: "#ffffff",
  color: "#111827",
  outline: "none",
};

const labelStyle = {
  display: "block",
  marginBottom: "7px",
  fontSize: "13px",
  color: "#374151",
  fontWeight: 800,
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkExistingSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setCheckingSession(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", session.user.id)
        .single();

      if (error || !data) {
        await supabase.auth.signOut();
        setMessage("사용자 정보를 확인할 수 없습니다. 관리자에게 문의해 주세요.");
        setCheckingSession(false);
        return;
      }

      const status = data.status as ProfileStatus;

      if (status === "DISABLED" || status === "HIDDEN") {
        await supabase.auth.signOut();
        setMessage("현재 이용이 제한된 계정입니다. 관리자에게 문의해 주세요.");
        setCheckingSession(false);
        return;
      }

      if (status === "ACTIVE") {
        router.push("/home");
        return;
      }

      await supabase.auth.signOut();
      setMessage("계정 상태를 확인할 수 없습니다. 관리자에게 문의해 주세요.");
      setCheckingSession(false);
    }

    checkExistingSession();
  }, [router]);

  async function handleLogin() {
    if (loading) return;

    setLoading(true);
    setMessage("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setLoading(false);
      setMessage("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

    if (loginError || !loginData.user) {
      setLoading(false);
      setMessage("로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", loginData.user.id)
      .single();

    if (profileError || !profileData) {
      await supabase.auth.signOut();
      setLoading(false);
      setMessage("사용자 정보를 확인할 수 없습니다. 관리자에게 문의해 주세요.");
      return;
    }

    const status = profileData.status as ProfileStatus;

    if (status === "DISABLED" || status === "HIDDEN") {
      await supabase.auth.signOut();
      setLoading(false);
      setMessage("현재 이용이 제한된 계정입니다. 관리자에게 문의해 주세요.");
      return;
    }

    if (status !== "ACTIVE") {
      await supabase.auth.signOut();
      setLoading(false);
      setMessage("계정 상태를 확인할 수 없습니다. 관리자에게 문의해 주세요.");
      return;
    }

    setLoading(false);
    router.push("/home");
  }

  if (checkingSession) {
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
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "18px 20px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
            background: "#ffffff",
          }}
        >
          <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
            학습관 입장 정보를 확인하는 중입니다...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={shellStyle}>
        <div
          style={{
            ...panelStyle,
            padding: "42px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "620px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: "-80px",
              top: "-80px",
              width: "260px",
              height: "260px",
              borderRadius: "999px",
              background: "rgba(37, 99, 235, 0.08)",
            }}
          />

          <div
            style={{
              position: "absolute",
              right: "56px",
              bottom: "70px",
              width: "140px",
              height: "140px",
              borderRadius: "999px",
              background: "rgba(14, 165, 233, 0.08)",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                border: "1px solid #dbeafe",
                borderRadius: "999px",
                padding: "7px 11px",
                background: "#eff6ff",
                color: "#1d4ed8",
                fontSize: "12px",
                fontWeight: 900,
              }}
            >
              수강생 전용 온라인 학습관
            </div>

            <h1
              style={{
                margin: "24px 0 0",
                fontSize: "44px",
                lineHeight: 1.12,
                letterSpacing: "-1.5px",
                fontWeight: 900,
                color: "#0f172a",
              }}
            >
              Moonmoon
              <br />
              Archive
            </h1>

            <p
              style={{
                margin: "18px 0 0",
                maxWidth: "520px",
                fontSize: "16px",
                color: "#475569",
                lineHeight: 1.75,
                wordBreak: "keep-all",
              }}
            >
              문문아카이브는 등록된 수강생만 이용할 수 있는 비공개 강의
              스트리밍 학습관입니다. 제공받은 계정으로 로그인하면 권한이 부여된
              강의와 자료를 확인할 수 있습니다.
            </p>

            <div
              style={{
                marginTop: "30px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "12px",
                maxWidth: "560px",
              }}
            >
              <InfoCard title="강의 스트리밍" description="권한이 부여된 강의만 안전하게 시청합니다." />
              <InfoCard title="학습 자료" description="강의별 자료를 함께 확인하고 내려받습니다." />
              <InfoCard title="개별 권한" description="계정별 수강 권한과 기간을 관리합니다." />
            </div>
          </div>

          <div
            style={{
              position: "relative",
              zIndex: 1,
              marginTop: "36px",
              borderTop: "1px solid #e5e7eb",
              paddingTop: "20px",
              display: "flex",
              justifyContent: "space-between",
              gap: "14px",
              flexWrap: "wrap",
              color: "#64748b",
              fontSize: "13px",
              lineHeight: 1.6,
            }}
          >
            <span>회원가입은 제공하지 않습니다.</span>
            <span>계정 발급 및 문의는 관리자에게 요청해 주세요.</span>
          </div>
        </div>

        <div
          style={{
            ...panelStyle,
            padding: "32px",
            alignSelf: "center",
            background: "#ffffff",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                fontWeight: 900,
                color: "#2563eb",
              }}
            >
              STUDENT LOGIN
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                fontSize: "28px",
                fontWeight: 900,
                color: "#111827",
                letterSpacing: "-0.6px",
              }}
            >
              학습관 로그인
            </h2>

            <p
              style={{
                margin: "10px 0 0",
                fontSize: "14px",
                color: "#6b7280",
                lineHeight: 1.6,
                wordBreak: "keep-all",
              }}
            >
              발급받은 계정으로 로그인해 주세요. 계정이 없거나 접속이 제한된
              경우 관리자에게 문의해 주세요.
            </p>
          </div>

          <div style={{ marginTop: "28px" }}>
            <label style={labelStyle}>이메일</label>

            <input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              style={inputStyle}
            />
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={labelStyle}>비밀번호</label>

            <input
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !loading) {
                  handleLogin();
                }
              }}
              style={inputStyle}
            />
          </div>

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "24px",
              border: "none",
              borderRadius: "14px",
              padding: "14px",
              background: "#111827",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: 900,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "default" : "pointer",
              boxShadow: "0 12px 24px rgba(17, 24, 39, 0.18)",
            }}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>

          {message && (
            <div
              style={{
                marginTop: "16px",
                border: "1px solid #fecaca",
                borderRadius: "14px",
                background: "#fff1f2",
                padding: "12px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#dc2626",
                  textAlign: "center",
                  lineHeight: 1.5,
                  fontWeight: 700,
                }}
              >
                {message}
              </p>
            </div>
          )}

          <div
            style={{
              marginTop: "20px",
              borderRadius: "16px",
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              padding: "14px",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "#64748b",
                lineHeight: 1.6,
                wordBreak: "keep-all",
              }}
            >
              이 사이트는 수강생 전용 폐쇄형 학습 서비스입니다. 별도 회원가입은
              제공하지 않으며, 관리자가 발급한 계정만 로그인할 수 있습니다.
            </p>
          </div>

          <p
            style={{
              marginTop: "18px",
              fontSize: "12px",
              color: "#9ca3af",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Moonmoon Archive Web
          </p>
        </div>
      </section>

      <style jsx>{`
        @media (max-width: 860px) {
          section {
            grid-template-columns: 1fr !important;
          }

          section > div:first-child {
            min-height: auto !important;
            padding: 28px !important;
          }

          h1 {
            font-size: 36px !important;
          }
        }

        @media (max-width: 520px) {
          main {
            padding: 12px !important;
          }

          section {
            min-height: auto !important;
          }

          section > div {
            border-radius: 22px !important;
            padding: 22px !important;
          }

          h1 {
            font-size: 32px !important;
          }
        }
      `}</style>
    </main>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "18px",
        padding: "16px",
        background: "rgba(255, 255, 255, 0.74)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "14px",
          fontWeight: 900,
          color: "#111827",
        }}
      >
        {title}
      </p>

      <p
        style={{
          margin: "7px 0 0",
          fontSize: "12px",
          color: "#64748b",
          lineHeight: 1.55,
          wordBreak: "keep-all",
        }}
      >
        {description}
      </p>
    </div>
  );
}
