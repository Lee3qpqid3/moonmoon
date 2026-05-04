"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";
type EditableRole = "USER" | "ADMIN";
type UserStatus = "ACTIVE" | "DISABLED" | "HIDDEN";

type AdminProfile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
};

type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  pro_until: string | null;
  created_at: string;
};

type EditingUser = {
  id: string;
  email: string;
  currentRole: UserRole;
  name: string;
  role: EditableRole;
  status: UserStatus;
};

type AdminMenuItem = {
  title: string;
  description: string;
  href?: string;
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

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "11px",
  fontSize: "14px",
  background: "#ffffff",
  color: "#111827",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontSize: "13px",
  fontWeight: 700,
  color: "#374151",
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

  const adminMenuItems: AdminMenuItem[] = useMemo(
    () => [
      {
        title: "사용자 관리",
        description: "계정 이름, 역할, 상태를 관리합니다.",
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
      .neq("status", "HIDDEN")
      .order("created_at", { ascending: false });

    setUsersLoading(false);

    if (error) {
      setErrorMessage("사용자 목록을 불러오지 못했습니다.");
      return;
    }

    setUsers((data ?? []) as UserProfile[]);
  }

  function canEditUser(user: UserProfile) {
    if (!profile) {
      return false;
    }

    if (user.id === profile.id) {
      return false;
    }

    if (profile.role === "SUPER_USER") {
      return user.role === "USER" || user.role === "ADMIN";
    }

    if (profile.role === "ADMIN") {
      return user.role === "USER";
    }

    return false;
  }

  function getCannotEditReason(user: UserProfile) {
    if (!profile) {
      return "수정 불가";
    }

    if (user.id === profile.id) {
      return "본인 수정 불가";
    }

    if (user.role === "SUPER_USER") {
      return "슈퍼 유저 수정 불가";
    }

    if (profile.role === "ADMIN" && user.role === "ADMIN") {
      return "관리자는 관리자 수정 불가";
    }

    return "수정 불가";
  }

  function startEditUser(user: UserProfile) {
    if (!canEditUser(user)) {
      setErrorMessage("이 사용자는 현재 계정으로 수정할 수 없습니다.");
      setSuccessMessage("");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    setEditingUser({
      id: user.id,
      email: user.email,
      currentRole: user.role,
      name: user.name,
      role: user.role === "ADMIN" ? "ADMIN" : "USER",
      status: user.status === "HIDDEN" ? "DISABLED" : user.status,
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

    const { error } = await supabase.rpc("admin_update_profile", {
      target_user_id: editingUser.id,
      new_name: editingUser.name.trim(),
      new_role: editingUser.role,
      new_status: editingUser.status,
    });

    setSaving(false);

    if (error) {
      setErrorMessage(error.message || "사용자 정보를 저장하지 못했습니다.");
      return;
    }

    setSuccessMessage("사용자 정보가 저장되었습니다.");
    setEditingUser(null);
    await loadUsers();
  }

  async function hideUser(user: UserProfile) {
    if (!canEditUser(user)) {
      setErrorMessage("이 사용자는 현재 계정으로 숨김 처리할 수 없습니다.");
      setSuccessMessage("");
      return;
    }

    const confirmed = window.confirm(
      "이 계정을 숨김 처리할까요? 숨김 처리된 계정은 로그인할 수 없습니다."
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc("admin_update_profile", {
      target_user_id: user.id,
      new_name: user.name,
      new_role: user.role === "ADMIN" ? "ADMIN" : "USER",
      new_status: "HIDDEN",
    });

    if (error) {
      setErrorMessage(error.message || "계정을 숨김 처리하지 못했습니다.");
      return;
    }

    if (editingUser?.id === user.id) {
      setEditingUser(null);
    }

    setSuccessMessage("계정이 숨김 처리되었습니다.");
    await loadUsers();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function getRoleLabel(role: UserRole) {
    if (role === "SUPER_USER") {
      return "슈퍼 유저";
    }

    if (role === "ADMIN") {
      return "관리자";
    }

    return "일반 사용자";
  }

  function getStatusLabel(status: UserStatus) {
    if (status === "HIDDEN") {
      return "숨김";
    }

    return status === "DISABLED" ? "비활성화" : "활성";
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
      cursor: item.href ? "pointer" : "default",
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
            입니다. 관리자는 운영 정보를 관리하고, 슈퍼유저는 원본 스트리밍
            소스와 발급 로그까지 관리할 수 있습니다.
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
                  onClick={() => {
                    if (item.href) {
                      router.push(item.href);
                    }
                  }}
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

        <div
          style={{
            ...cardStyle,
            marginTop: "20px",
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
                  lineHeight: 1.6,
                }}
              >
                이름, 역할, 상태를 수정할 수 있습니다. 자기 자신과 같은 등급
                이상의 계정은 수정할 수 없습니다.
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => router.push("/admin/hidden-users")}
                style={buttonStyle}
              >
                숨김 계정 목록
              </button>

              <button
                type="button"
                onClick={loadUsers}
                disabled={usersLoading}
                style={{
                  ...buttonStyle,
                  padding: "10px 12px",
                  opacity: usersLoading ? 0.6 : 1,
                }}
              >
                {usersLoading ? "새로고침 중..." : "새로고침"}
              </button>
            </div>
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

              <p
                style={{
                  marginTop: "8px",
                  fontSize: "13px",
                  color: "#6b7280",
                  wordBreak: "break-all",
                }}
              >
                {editingUser.email}
              </p>

              <div
                style={{
                  marginTop: "16px",
                  display: "grid",
                  gap: "12px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
              >
                <div>
                  <label style={labelStyle}>이름</label>

                  <input
                    value={editingUser.name}
                    onChange={(event) =>
                      setEditingUser({
                        ...editingUser,
                        name: event.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>역할</label>

                  <select
                    value={editingUser.role}
                    onChange={(event) =>
                      setEditingUser({
                        ...editingUser,
                        role: event.target.value as EditableRole,
                      })
                    }
                    style={inputStyle}
                  >
                    <option value="USER">일반 사용자</option>
                    <option value="ADMIN">관리자</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>상태</label>

                  <select
                    value={editingUser.status}
                    onChange={(event) =>
                      setEditingUser({
                        ...editingUser,
                        status: event.target.value as UserStatus,
                      })
                    }
                    style={inputStyle}
                  >
                    <option value="ACTIVE">활성</option>
                    <option value="DISABLED">비활성화</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  marginTop: "16px",
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={saveUser}
                  disabled={saving}
                  style={{
                    border: "none",
                    borderRadius: "10px",
                    background: "#111827",
                    color: "#ffffff",
                    padding: "11px 14px",
                    fontSize: "13px",
                    fontWeight: 800,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? "저장 중..." : "저장"}
                </button>

                <button
                  type="button"
                  onClick={cancelEditUser}
                  disabled={saving}
                  style={{
                    ...buttonStyle,
                    padding: "11px 14px",
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: "20px",
              overflowX: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: "14px",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1120px",
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {[
                    "이름",
                    "이메일",
                    "UUID",
                    "역할",
                    "상태",
                    "등급",
                    "생성일",
                    "관리",
                  ].map((title) => (
                    <th
                      key={title}
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        fontSize: "13px",
                        color: "#6b7280",
                        borderBottom: "1px solid #e5e7eb",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: "18px",
                        textAlign: "center",
                        color: "#6b7280",
                        fontSize: "14px",
                      }}
                    >
                      등록된 사용자가 없습니다.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "#111827",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {user.name}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          color: "#111827",
                          wordBreak: "break-all",
                        }}
                      >
                        {user.email}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "12px",
                          color: "#6b7280",
                          fontFamily: "monospace",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {user.id}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getRoleLabel(user.role)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          color:
                            user.status === "ACTIVE"
                              ? "#15803d"
                              : user.status === "HIDDEN"
                                ? "#6b7280"
                                : "#dc2626",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getStatusLabel(user.status)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getProLabel(user.pro_until)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          color: "#6b7280",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getCreatedAtLabel(user.created_at)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {canEditUser(user) ? (
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => startEditUser(user)}
                              style={{
                                border: "1px solid #d1d5db",
                                borderRadius: "9px",
                                background: "#ffffff",
                                color: "#111827",
                                padding: "8px 10px",
                                fontSize: "12px",
                                fontWeight: 800,
                              }}
                            >
                              수정
                            </button>

                            <button
                              type="button"
                              onClick={() => hideUser(user)}
                              style={{
                                border: "1px solid #fecaca",
                                borderRadius: "9px",
                                background: "#ffffff",
                                color: "#dc2626",
                                padding: "8px 10px",
                                fontSize: "12px",
                                fontWeight: 800,
                              }}
                            >
                              숨김
                            </button>
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#9ca3af",
                              fontWeight: 700,
                            }}
                          >
                            {getCannotEditReason(user)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
