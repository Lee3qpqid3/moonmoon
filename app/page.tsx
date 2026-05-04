"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type ProfileStatus = "ACTIVE" | "DISABLED" | "HIDDEN";

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

      const { data } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", session.user.id)
        .single();

      const status = data?.status as ProfileStatus | undefined;

      if (status === "DISABLED" || status === "HIDDEN") {
        await supabase.auth.signOut();
        setMessage("계정이 비활성화되었습니다. 관리자에게 문의하세요.");
        setCheckingSession(false);
        return;
      }

      if (status === "ACTIVE") {
        router.push("/home");
        return;
      }

      await supabase.auth.signOut();
      setMessage("사용자 프로필을 찾을 수 없습니다. 관리자에게 문의하세요.");
      setCheckingSession(false);
    }

    checkExistingSession();
  }, [router]);

  async function handleLogin() {
    setLoading(true);
    setMessage("");

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError || !loginData.user) {
      setLoading(false);
      setMessage("로그인에 실패했습니다. 이메일과 비밀번호를 확인하세요.");
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
      setMessage("사용자 프로필을 찾을 수 없습니다. 관리자에게 문의하세요.");
      return;
    }

    const status = profileData.status as ProfileStatus;

    if (status === "DISABLED" || status === "HIDDEN") {
      await supabase.auth.signOut();
      setLoading(false);
      setMessage("계정이 비활성화되었습니다. 관리자에게 문의하세요.");
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
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          로그인 상태를 확인하는 중입니다...
        </p>
      </main>
    );
  }

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
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "380px",
          border: "1px solid #e5e7eb",
          borderRadius: "20px",
          padding: "32px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: 800,
            color: "#111827",
          }}
        >
          Moonmoon Archive
        </h1>

        <p
          style={{
            marginTop: "10px",
            fontSize: "14px",
            color: "#6b7280",
            lineHeight: 1.5,
          }}
        >
          로그인 후 이용할 수 있는 비공개 스트리밍 아카이브입니다.
        </p>

        <div style={{ marginTop: "28px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "6px",
              fontSize: "14px",
              color: "#374151",
            }}
          >
            이메일
          </label>

          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #d1d5db",
              borderRadius: "10px",
              padding: "12px",
              fontSize: "14px",
            }}
          />
        </div>

        <div style={{ marginTop: "16px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "6px",
              fontSize: "14px",
              color: "#374151",
            }}
          >
            비밀번호
          </label>

          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleLogin();
              }
            }}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #d1d5db",
              borderRadius: "10px",
              padding: "12px",
              fontSize: "14px",
            }}
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: "24px",
            border: "none",
            borderRadius: "10px",
            padding: "12px",
            background: "#111827",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: 700,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>

        {message && (
          <p
            style={{
              marginTop: "16px",
              fontSize: "13px",
              color: "#dc2626",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>
        )}

        <p
          style={{
            marginTop: "18px",
            fontSize: "12px",
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          계정은 관리자만 생성할 수 있습니다.
        </p>
      </section>
    </main>
  );
}
