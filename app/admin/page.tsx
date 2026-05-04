"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";
type EditableRole = "USER" | "ADMIN";
type UserStatus = "ACTIVE" | "DISABLED";

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

        <div style={{ display: "flex", gap: "8px" }}>
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
          maxWidth: "1100px",
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
            입니다. 자기 자신은 웹에서 수정할 수 없고, 자기보다 낮은 권한의
            계정만 수정할 수 있습니다.
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
                }}
              >
                이름, 역할, 상태를 수정할 수 있습니다. 단, 자기 자신과 같은
                등급 이상의 계정은 수정할 수 없습니다.
              </p>
            </div>

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
                        role: event.target.value as EditableRole,
                      })
                    }
                    disabled={profile?.role === "ADMIN"}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      border: "1px solid #d1d5db",
                      borderRadius: "10px",
                      padding: "11px",
                      fontSize: "14px",
                      background: profile?.role === "ADMIN" ? "#f3f4f6" : "#ffffff",
                    }}
                  >
                    <option value="USER">일반 사용자</option>
                    {profile?.role === "SUPER_USER" && (
                      <option value="ADMIN">관리자</option>
                    )}
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
                        status: event.target.value as UserStatus,
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
                minWidth: "940px",
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {[
                    "이름",
                    "이메일",
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
                      colSpan={7}
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
                          fontSize: "14px",
                          color: "#111827",
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
                            user.status === "ACTIVE" ? "#15803d" : "#dc2626",
                          fontWeight: 700,
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
                        }}
                      >
                        {getCreatedAtLabel(user.created_at)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                        }}
                      >
                        {canEditUser(user) ? (
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
