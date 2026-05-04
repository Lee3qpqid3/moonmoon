"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage("로그인에 실패했습니다. 이메일과 비밀번호를 확인하세요.");
      return;
    }

    setMessage("로그인 성공!");
  }

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
      <section
        style={{
          width: "100%",
          maxWidth: "380px",
          border: "1px solid #e5e7eb",
          borderRadius: "20px",
          padding: "32px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
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
              color: message === "로그인 성공!" ? "#15803d" : "#dc2626",
              textAlign: "center",
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
