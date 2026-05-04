"use client";

import { useEffect, useState } from "react";
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
  isSelf: boolean;
  name: string;
  role: EditableRole;
  status: "ACTIVE" | "DISABLED";
};

type UserAction = "HIDE" | "RESTORE" | "DELETE";

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

const dangerButtonStyle = {
  border: "1px solid #fecaca",
  borderRadius: "10px",
  background: "#fff1f2",
  color: "#991b1b",
  padding: "9px 12px",
  fontSize: "13px",
  fontWeight: 800,
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

  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState("");
  const [createRole, setCreateRole] = useState<EditableRole>("USER");

  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");

  const [showHiddenUsers, setShowHiddenUsers] = useState(false);

  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [actingUserId, setActingUserId] = useState<string | null>(null);
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

      await loadUsers(false);
    }

    checkAdminAndLoadUsers();
  }, [router]);

  async function loadUsers(nextShowHidden = showHiddenUsers) {
    setUsersLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    let query = supabase
      .from("profiles")
      .select("id, email, name, role, status, pro_until, created_at")
      .order("created_at", { ascending: false });

    if (nextShowHidden) {
      query = query.eq("status", "HIDDEN");
    } else {
      query = query.neq("status", "HIDDEN");
    }

    const { data, error } = await query;

    setUsersLoading(false);

    if (error) {
      setErrorMessage("사용자 목록을 불러오지 못했습니다.");
      return;
    }

    setUsers((data ?? []) as UserProfile[]);
  }

  async function switchHiddenUsersView(nextShowHidden: boolean) {
    setShowHiddenUsers(nextShowHidden);
    setEditingUser(null);
    setResetPassword("");
    setResetPasswordConfirm("");
    setErrorMessage("");
    setSuccessMessage("");
    await loadUsers(nextShowHidden);
  }

  function canEditUser(user: UserProfile) {
    if (!profile) return false;
    if (showHiddenUsers) return false;
    if (user.role === "SUPER_USER" && user.id !== profile.id) return false;
    if (profile.role === "ADMIN" || profile.role === "SUPER_USER") return true;
    return false;
  }

  function canHideUser(user: UserProfile) {
    if (!profile) return false;
    if (showHiddenUsers) return false;
    if (user.id === profile.id) return false;
    if (user.role === "SUPER_USER") return false;
    return profile.role === "ADMIN" || profile.role === "SUPER_USER";
  }

  function canRestoreOrDeleteUser(user: UserProfile) {
    if (!profile) return false;
    if (!showHiddenUsers) return false;
    if (user.id === profile.id) return false;
    if (user.role === "SUPER_USER") return false;
    return profile.role === "ADMIN" || profile.role === "SUPER_USER";
  }

  function getCannotEditReason(user: UserProfile) {
    if (!profile) return "수정 불가";

    if (user.role === "SUPER_USER" && user.id !== profile.id) {
      return "슈퍼 유저 수정 불가";
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
    setResetPassword("");
    setResetPasswordConfirm("");

    setEditingUser({
      id: user.id,
      email: user.email,
      isSelf: profile?.id === user.id,
      name: user.name,
      role: user.role === "ADMIN" ? "ADMIN" : "USER",
      status: user.status === "DISABLED" ? "DISABLED" : "ACTIVE",
    });
  }

  function cancelEditUser() {
    setEditingUser(null);
    setResetPassword("");
    setResetPasswordConfirm("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function saveUser() {
    if (!editingUser) return;

    if (!editingUser.name.trim()) {
      setErrorMessage("이름을 입력해야 합니다.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    if (editingUser.isSelf) {
      const { error } = await supabase.rpc("update_own_profile_name", {
        new_name: editingUser.name.trim(),
      });

      setSaving(false);

      if (error) {
        setErrorMessage(error.message || "이름을 저장하지 못했습니다.");
        return;
      }

      setSuccessMessage("이름이 저장되었습니다.");
      setEditingUser(null);
      setResetPassword("");
      setResetPasswordConfirm("");
      await loadUsers(showHiddenUsers);
      return;
    }

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
    setResetPassword("");
    setResetPasswordConfirm("");
    await loadUsers(showHiddenUsers);
  }

  async function handleCreateUser() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!createEmail.trim() || !createName.trim()) {
      setErrorMessage("이메일과 이름을 입력해야 합니다.");
      return;
    }

    if (createPassword.length < 6) {
      setErrorMessage("초기 비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    if (createPassword !== createPasswordConfirm) {
      setErrorMessage("초기 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setCreatingUser(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setCreatingUser(false);
      setErrorMessage("로그인이 필요합니다.");
      return;
    }

    const response = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email: createEmail,
        name: createName,
        password: createPassword,
        passwordConfirm: createPasswordConfirm,
        role: createRole,
      }),
    });

    const result = await response.json();

    setCreatingUser(false);

    if (!response.ok) {
      setErrorMessage(result.error || "계정을 생성하지 못했습니다.");
      return;
    }

    setCreateEmail("");
    setCreateName("");
    setCreatePassword("");
    setCreatePasswordConfirm("");
    setCreateRole("USER");

    setSuccessMessage("새 계정이 생성되었습니다.");

    if (showHiddenUsers) {
      setShowHiddenUsers(false);
      await loadUsers(false);
    } else {
      await loadUsers(false);
    }
  }

  async function handleAdminResetPassword() {
    if (!editingUser) return;

    setErrorMessage("");
    setSuccessMessage("");

    if (editingUser.isSelf) {
      setErrorMessage("본인 비밀번호는 계정 설정에서 변경해야 합니다.");
      return;
    }

    if (resetPassword.length < 6) {
      setErrorMessage("새 비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    if (resetPassword !== resetPasswordConfirm) {
      setErrorMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setResettingPassword(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setResettingPassword(false);
      setErrorMessage("로그인이 필요합니다.");
      return;
    }

    const response = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        targetUserId: editingUser.id,
        newPassword: resetPassword,
        newPasswordConfirm: resetPasswordConfirm,
      }),
    });

    const result = await response.json();

    setResettingPassword(false);

    if (!response.ok) {
      setErrorMessage(result.error || "비밀번호를 재설정하지 못했습니다.");
      return;
    }

    setResetPassword("");
    setResetPasswordConfirm("");
    setSuccessMessage("사용자 비밀번호가 재설정되었습니다.");
  }

  async function handleUserAction(user: UserProfile, action: UserAction) {
    setErrorMessage("");
    setSuccessMessage("");

    if (action === "HIDE") {
      const confirmed = window.confirm(
        "이 계정을 숨김 처리할까요? 숨김 처리된 계정은 자동으로 비활성화되며 기본 목록에서 보이지 않습니다."
      );

      if (!confirmed) return;
    }

    if (action === "RESTORE") {
      const confirmed = window.confirm(
        "이 계정을 복구할까요? 복구하면 계정 상태는 비활성화로 돌아옵니다."
      );

      if (!confirmed) return;
    }

    if (action === "DELETE") {
      const confirmed = window.confirm(
        "정말 이 계정을 완전 삭제할까요? 완전 삭제하면 Auth 계정도 삭제되며 되돌릴 수 없습니다."
      );

      if (!confirmed) return;
    }

    setActingUserId(user.id);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setErrorMessage("로그인이 필요합니다.");
        return;
      }

      const response = await fetch("/api/admin/users/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          targetUserId: user.id,
          action,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.error || "계정 작업에 실패했습니다.");
        return;
      }

      if (action === "HIDE") {
        setSuccessMessage("계정이 숨김 처리되었습니다.");
      }

      if (action === "RESTORE") {
        setSuccessMessage("계정이 복구되었습니다.");
      }

      if (action === "DELETE") {
        setSuccessMessage("계정이 완전 삭제되었습니다.");
      }

      setEditingUser(null);
      setResetPassword("");
      setResetPasswordConfirm("");

      await loadUsers(showHiddenUsers);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "계정 작업 중 오류가 발생했습니다."
      );
    } finally {
      setActingUserId(null);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function getRoleLabel(role: UserRole) {
    if (role === "SUPER_USER") return "슈퍼 유저";
    if (role === "ADMIN") return "관리자";
    return "일반 사용자";
  }

  function getStatusLabel(status: UserStatus) {
    if (status === "ACTIVE") return "활성";
    if (status === "DISABLED") return "비활성화";
    return "숨김";
  }

  function getStatusColor(status: UserStatus) {
    if (status === "ACTIVE") return "#15803d";
    if (status === "DISABLED") return "#dc2626";
    return "#6b7280";
  }

  function getProLabel(proUntil: string | null) {
    if (!proUntil) return "일반";

    const proDate = new Date(proUntil);
    const now = new Date();

    if (proDate <= now) return "만료";

    return `Pro · ${proDate.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })}까지`;
  }

  function getCreatedAtLabel(createdAt: string) {
    return new Date(createdAt).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
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
            관리자 페이지에서는 사용자 생성, 정보 수정, 비밀번호 재설정, 숨김,
            복구, 완전 삭제를 할 수 있습니다.
          </p>

          <div
            style={{
              marginTop: "24px",
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
              onClick={() => router.push("/admin")}
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
              onClick={() => router.push("/admin/serial-keys")}
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
  onClick={() => router.push("/admin/user-entitlements")}
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
  유저 사용권 기록
</button>

{profile?.role === "SUPER_USER" && (
  <button
    type="button"
    onClick={() => router.push("/admin/serial-key-logs")}
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
    시리얼키 발급 로그
  </button>
)}

            <button
              type="button"
              onClick={() => router.push("/admin/videos")}
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
              onClick={() => router.push("/admin/play-logs")}
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

        {!showHiddenUsers && (
          <div style={{ ...cardStyle, marginTop: "20px" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 800,
                color: "#111827",
              }}
            >
              새 사용자 생성
            </h2>

            <p
              style={{
                marginTop: "8px",
                fontSize: "14px",
                color: "#6b7280",
              }}
            >
              사이트 회원가입은 막혀 있으므로, 계정은 관리자 페이지에서만
              생성합니다.
            </p>

            <div
              style={{
                marginTop: "18px",
                display: "grid",
                gap: "12px",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <div>
                <label style={labelStyle}>이메일</label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(event) => setCreateEmail(event.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>이름</label>
                <input
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>역할</label>
                <select
                  value={createRole}
                  onChange={(event) =>
                    setCreateRole(event.target.value as EditableRole)
                  }
                  style={inputStyle}
                >
                  <option value="USER">일반 사용자</option>
                  <option value="ADMIN">관리자</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>초기 비밀번호</label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(event) => setCreatePassword(event.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>초기 비밀번호 확인</label>
                <input
                  type="password"
                  value={createPasswordConfirm}
                  onChange={(event) =>
                    setCreatePasswordConfirm(event.target.value)
                  }
                  style={inputStyle}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateUser}
              disabled={creatingUser}
              style={{
                marginTop: "16px",
                border: "none",
                borderRadius: "10px",
                background: "#111827",
                color: "#ffffff",
                padding: "11px 14px",
                fontSize: "13px",
                fontWeight: 800,
                opacity: creatingUser ? 0.6 : 1,
              }}
            >
              {creatingUser ? "생성 중..." : "계정 생성"}
            </button>
          </div>
        )}

        <div style={{ ...cardStyle, marginTop: "20px" }}>
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
                {showHiddenUsers ? "숨긴 계정 목록" : "사용자 목록"}
              </h2>

              <p
                style={{
                  marginTop: "8px",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                {showHiddenUsers
                  ? "숨김 처리된 계정입니다. 복구하거나 완전 삭제할 수 있습니다."
                  : "사용자 정보를 수정하거나 비밀번호를 재설정할 수 있습니다. 기본 목록에서는 수정과 숨김만 표시됩니다."}
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => switchHiddenUsersView(!showHiddenUsers)}
                style={buttonStyle}
              >
                {showHiddenUsers ? "기본 목록 보기" : "숨긴 계정 목록"}
              </button>

              <button
                type="button"
                onClick={() => loadUsers(showHiddenUsers)}
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

          {editingUser && !showHiddenUsers && (
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
                    disabled={editingUser.isSelf}
                    style={{
                      ...inputStyle,
                      background: editingUser.isSelf ? "#f3f4f6" : "#ffffff",
                    }}
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
                        status: event.target.value as "ACTIVE" | "DISABLED",
                      })
                    }
                    disabled={editingUser.isSelf}
                    style={{
                      ...inputStyle,
                      background: editingUser.isSelf ? "#f3f4f6" : "#ffffff",
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
                  style={{ ...buttonStyle, padding: "11px 14px" }}
                >
                  취소
                </button>
              </div>

              {!editingUser.isSelf && (
                <div
                  style={{
                    marginTop: "20px",
                    borderTop: "1px solid #e5e7eb",
                    paddingTop: "18px",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      fontSize: "16px",
                      fontWeight: 800,
                      color: "#111827",
                    }}
                  >
                    관리자 비밀번호 재설정
                  </h4>

                  <div style={{ marginTop: "12px" }}>
                    <label style={labelStyle}>새 비밀번호</label>

                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(event) =>
                        setResetPassword(event.target.value)
                      }
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ marginTop: "12px" }}>
                    <label style={labelStyle}>새 비밀번호 확인</label>

                    <input
                      type="password"
                      value={resetPasswordConfirm}
                      onChange={(event) =>
                        setResetPasswordConfirm(event.target.value)
                      }
                      style={inputStyle}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAdminResetPassword}
                    disabled={resettingPassword}
                    style={{
                      marginTop: "12px",
                      border: "1px solid #111827",
                      borderRadius: "10px",
                      background: "#ffffff",
                      color: "#111827",
                      padding: "11px 14px",
                      fontSize: "13px",
                      fontWeight: 800,
                      opacity: resettingPassword ? 0.6 : 1,
                    }}
                  >
                    {resettingPassword ? "재설정 중..." : "비밀번호 재설정"}
                  </button>
                </div>
              )}
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
                minWidth: "1280px",
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
                      표시할 계정이 없습니다.
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
                          whiteSpace: "nowrap",
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
                          color: getStatusColor(user.status),
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
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "nowrap",
                          }}
                        >
                          {showHiddenUsers ? (
                            canRestoreOrDeleteUser(user) ? (
                              <>
                                <button
                                  type="button"
                                  disabled={actingUserId === user.id}
                                  onClick={() =>
                                    handleUserAction(user, "RESTORE")
                                  }
                                  style={buttonStyle}
                                >
                                  복구
                                </button>

                                <button
                                  type="button"
                                  disabled={actingUserId === user.id}
                                  onClick={() =>
                                    handleUserAction(user, "DELETE")
                                  }
                                  style={dangerButtonStyle}
                                >
                                  완전 삭제
                                </button>
                              </>
                            ) : (
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "#9ca3af",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                작업 불가
                              </span>
                            )
                          ) : (
                            <>
                              {canEditUser(user) ? (
                                <button
                                  type="button"
                                  onClick={() => startEditUser(user)}
                                  style={buttonStyle}
                                >
                                  수정
                                </button>
                              ) : (
                                <span
                                  style={{
                                    fontSize: "12px",
                                    color: "#9ca3af",
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {getCannotEditReason(user)}
                                </span>
                              )}

                              {canHideUser(user) && (
                                <button
                                  type="button"
                                  disabled={actingUserId === user.id}
                                  onClick={() => handleUserAction(user, "HIDE")}
                                  style={buttonStyle}
                                >
                                  숨김
                                </button>
                              )}
                            </>
                          )}
                        </div>
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
