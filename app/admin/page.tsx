"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type AdminProfile = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
};

type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
  pro_until: string | null;
  created_at: string;
};

type EditingUser = {
  id: string;
  name: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
};

export default function AdminPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [editingUser, setEditingUser] = useState<EditingUser | null>(null);

  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function checkAdminAndLoadUsers() {
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

      await loadUsers();
    }

    checkAdminAndLoadUsers();
  }, [router]);

  async function loadUsers() {
    setUsersLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, name, role, status, pro_until, created_at")
      .order("created_at", { ascending: false });

    setUsersLoading(false);

    if (error) {
      setErrorMessage("사용자 목록을 불러오지 못했습니다.");
      return;
    }

    setUsers((data ?? []) as UserProfile[]);
  }

  function startEditUser(user: UserProfile) {
    setErrorMessage("");
    setSuccessMessage("");

    setEditingUser({
      id: user.id,
      name: user.name,
      role: user.role,
      status: user.status,
    });
  }

  function cancelEditUser() {
    setEditingUser(null);
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function saveUser() {
    if (!editingUser) {
      return;
    }

    if (!editingUser.name.trim()) {
      setErrorMessage("이름을 입력해야 합니다.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        name: editingUser.name.trim(),
        role: editingUser.role,
        status: editingUser.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingUser.id);

    setSaving(false);

    if (error) {
      setErrorMessage("사용자 정보를 저장하지 못했습니다.");
      return;
    }

    setSuccessMessage("사용자 정보가 저장되었습니다.");
    setEditingUser(null);
    await loadUsers();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function getRoleLabel(role: UserProfile["role"]) {
    if (role === "ADMIN") {
      return "관리자";
    }

    return "일반 사용자";
  }

  function getStatusLabel(status: UserProfile["status"]) {
    if (status === "DISABLED") {
      return "비활성화";
    }

    return "활성";
  }

  function getProLabel(proUntil: string | null) {
    if (!proUntil) {
      return "일반";
    }

    const proDate = new Date(proUntil);
    const now = new Date();

    if (proDate <= now) {
      return "만료";
    }

    return `Pro · ${proDate.toLocaleDateString("ko-KR")}까지`;
  }

  function getCreatedAtLabel(createdAt: string) {
    return new Date(createdAt).toLocaleDateString("ko-KR");
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
          maxWidth: "1100px",
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
            현재 관리자 계정으로 로그인되어 있습니다. 사용자 정보를 수정할 수
            있습니다.
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

        <div
          style={{
            marginTop: "20px",
            border: "1px solid #e5e7eb",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "#111827",
                }}
              >
                사용자 목록
              </h2>

              <p
                style={{
                  marginTop: "8px",
                  fontSize: "14px",
                  color: "#6b7280",
                }}
              >
                이름, 역할, 상태를 수정할 수 있습니다.
              </p>
            </div>

            <button
              type="button"
              onClick={loadUsers}
              disabled={usersLoading}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "10px",
                background: "#ffffff",
                color: "#111827",
                padding: "10px 12px",
                fontSize: "13px",
                fontWeight: 700,
                whiteSpace: "nowrap",
                opacity: usersLoading ? 0.6 : 1,
              }}
            >
              {usersLoading ? "새로고침 중..." : "새로고침"}
            </button>
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
              }}
            >
              {successMessage}
            </div>
          )}

          {editingUser && (
            <div
              style={{
                marginTop: "20px",
                border: "1px solid #d1d5db",
                borderRadius: "16px",
                padding: "18px",
                background: "#f9fafb",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: 800,
                  color: "#111827",
                }}
              >
                사용자 수정
              </h3>

              <div
                style={{
                  marginTop: "16px",
                  display: "grid",
                  gap: "12px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#374151",
                    }}
                  >
                    이름
                  </label>

                  <input
                    value={editingUser.name}
                    onChange={(event) =>
                      setEditingUser({
                        ...editingUser,
                        name: event.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      border: "1px solid #d1d5db",
                      borderRadius: "10px",
                      padding: "11px",
                      fontSize: "14px",
                      background: "#ffffff",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#374151",
                    }}
                  >
                    역할
                  </label>

                  <select
                    value={editingUser.role}
                    onChange={(event) =>
                      setEditingUser({
                        ...editingUser,
                        role: event.target.value as "USER" | "ADMIN",
                      })
                    }
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      border: "1px solid #d1d5db",
                      borderRadius: "10px",
                      padding: "11px",
                      fontSize: "14px",
                      background: "#ffffff",
                    }}
                  >
                    <option value="USER">일반 사용자</option>
                    <option value="ADMIN">관리자</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#374151",
                    }}
                  >
                    상태
                  </label>

                  <select
                    value={editingUser.status}
                    onChange={(event) =>
                      setEditingUser({
                        ...editingUser,
                        status: event.target.value as "ACTIVE" | "DIS
