"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";
type EditableRole = "USER" | "ADMIN";
type UserStatus = "ACTIVE" | "DISABLED" | "HIDDEN";
type UserSortMode = "created_desc" | "name_asc";

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
  name: string;
  role: EditableRole;
  status: Exclude<UserStatus, "HIDDEN">;
};

type CreateUserForm = {
  email: string;
  password: string;
  passwordConfirm: string;
  name: string;
  role: EditableRole;
  status: Exclude<UserStatus, "HIDDEN">;
};

type PasswordResetForm = {
  password: string;
  passwordConfirm: string;
};

type CreateUserResponse = {
  ok?: boolean;
  userId?: string;
  error?: string;
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
  fontWeight: 800,
  whiteSpace: "nowrap" as const,
};

const inputStyle = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
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
  fontWeight: 800,
  color: "#374151",
};

export default function AdminUsersPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [editingUser, setEditingUser] = useState<EditingUser | null>(null);
  const [showHiddenUsers, setShowHiddenUsers] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sortMode, setSortMode] = useState<UserSortMode>("created_desc");

  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: "",
    password: "",
    passwordConfirm: "",
    name: "",
    role: "USER",
    status: "ACTIVE",
  });

  const [passwordResetForm, setPasswordResetForm] = useState<PasswordResetForm>({
    password: "",
    passwordConfirm: "",
  });

  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [denied, setDenied] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    checkAdminAndLoadUsers();
  }, []);

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

  async function loadUsers(nextShowHiddenUsers = showHiddenUsers) {
    setUsersLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    let query = supabase
      .from("profiles")
      .select("id, email, name, role, status, pro_until, created_at")
      .order("created_at", { ascending: false });

    if (nextShowHiddenUsers) {
      query = query.eq("status", "HIDDEN");
    } else {
      query = query.neq("status", "HIDDEN");
    }

    const { data, error } = await query;

    setUsersLoading(false);

    if (error) {
      setErrorMessage("사용자 목록을 불러오지 못했습니다.");
      setUsers([]);
      return;
    }

    setUsers((data ?? []) as UserProfile[]);
  }

  async function toggleHiddenList() {
    const nextShowHiddenUsers = !showHiddenUsers;

    setShowHiddenUsers(nextShowHiddenUsers);
    setEditingUser(null);
    setPasswordResetForm({
      password: "",
      passwordConfirm: "",
    });
    setShowCreateForm(false);
    setErrorMessage("");
    setSuccessMessage("");

    await loadUsers(nextShowHiddenUsers);
  }

  function canEditUser(user: UserProfile) {
    if (!profile) return false;
    if (user.id === profile.id) return false;

    if (profile.role === "SUPER_USER") {
      return user.role === "USER" || user.role === "ADMIN";
    }

    if (profile.role === "ADMIN") {
      return user.role === "USER";
    }

    return false;
  }

  function getCannotEditReason(user: UserProfile) {
    if (!profile) return "수정 불가";
    if (user.id === profile.id) return "본인 수정 불가";
    if (user.role === "SUPER_USER") return "슈퍼 유저 수정 불가";
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

    if (user.status === "HIDDEN") {
      setErrorMessage("숨김 계정은 복구 후 수정할 수 있습니다.");
      setSuccessMessage("");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setShowCreateForm(false);
    setPasswordResetForm({
      password: "",
      passwordConfirm: "",
    });

    setEditingUser({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role === "ADMIN" ? "ADMIN" : "USER",
      status: user.status === "DISABLED" ? "DISABLED" : "ACTIVE",
    });
  }

  function cancelEditUser() {
    setEditingUser(null);
    setPasswordResetForm({
      password: "",
      passwordConfirm: "",
    });
    setErrorMessage("");
    setSuccessMessage("");
  }

  function toggleCreateForm() {
    setShowCreateForm((current) => !current);
    setEditingUser(null);
    setPasswordResetForm({
      password: "",
      passwordConfirm: "",
    });
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function createUser() {
    setErrorMessage("");
    setSuccessMessage("");

    const email = createForm.email.trim().toLowerCase();
    const name = createForm.name.trim();

    if (!email) {
      setErrorMessage("이메일을 입력해야 합니다.");
      return;
    }

    if (!name) {
      setErrorMessage("이름을 입력해야 합니다.");
      return;
    }

    if (createForm.password.length < 6) {
      setErrorMessage("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (createForm.password !== createForm.passwordConfirm) {
      setErrorMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (profile?.role !== "SUPER_USER" && createForm.role !== "USER") {
      setErrorMessage("관리자는 일반 사용자만 추가할 수 있습니다.");
      return;
    }

    setCreating(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setErrorMessage("로그인이 필요합니다.");
        setCreating(false);
        return;
      }

      const response = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email,
          password: createForm.password,
          name,
          role: createForm.role,
          status: createForm.status,
        }),
      });

      const result = (await response.json()) as CreateUserResponse;

      if (!response.ok || !result.ok) {
        setErrorMessage(result.error || "사용자를 추가하지 못했습니다.");
        setCreating(false);
        return;
      }

      setSuccessMessage("사용자가 추가되었습니다.");
      setCreateForm({
        email: "",
        password: "",
        passwordConfirm: "",
        name: "",
        role: "USER",
        status: "ACTIVE",
      });
      setShowCreateForm(false);
      await loadUsers(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "사용자를 추가하지 못했습니다."
      );
    } finally {
      setCreating(false);
    }
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
    setPasswordResetForm({
      password: "",
      passwordConfirm: "",
    });
    await loadUsers(showHiddenUsers);
  }

  async function resetUserPassword() {
    if (!editingUser) return;

    setErrorMessage("");
    setSuccessMessage("");

    if (passwordResetForm.password.length < 6) {
      setErrorMessage("새 비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (passwordResetForm.password !== passwordResetForm.passwordConfirm) {
      setErrorMessage("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    const confirmed = window.confirm(
      `${editingUser.name} 사용자의 비밀번호를 재설정할까요?`
    );

    if (!confirmed) return;

    setResettingPassword(true);

    const { error } = await supabase.rpc("admin_reset_user_password", {
      target_user_id: editingUser.id,
      new_password: passwordResetForm.password,
    });

    setResettingPassword(false);

    if (error) {
      setErrorMessage(error.message || "비밀번호를 재설정하지 못했습니다.");
      return;
    }

    setPasswordResetForm({
      password: "",
      passwordConfirm: "",
    });

    setSuccessMessage("사용자 비밀번호가 재설정되었습니다.");
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

    if (!confirmed) return;

    setActionLoadingId(user.id);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc("admin_update_profile", {
      target_user_id: user.id,
      new_name: user.name,
      new_role: user.role === "ADMIN" ? "ADMIN" : "USER",
      new_status: "HIDDEN",
    });

    setActionLoadingId("");

    if (error) {
      setErrorMessage(error.message || "계정을 숨김 처리하지 못했습니다.");
      return;
    }

    if (editingUser?.id === user.id) {
      setEditingUser(null);
      setPasswordResetForm({
        password: "",
        passwordConfirm: "",
      });
    }

    setSuccessMessage("계정이 숨김 처리되었습니다.");
    await loadUsers(false);
  }

  async function restoreUser(user: UserProfile) {
    if (!canEditUser(user)) {
      setErrorMessage("이 사용자는 현재 계정으로 복구할 수 없습니다.");
      setSuccessMessage("");
      return;
    }

    const confirmed = window.confirm(
      "이 계정을 복구할까요? 복구 후 상태는 비활성화로 유지됩니다."
    );

    if (!confirmed) return;

    setActionLoadingId(user.id);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc("admin_update_profile", {
      target_user_id: user.id,
      new_name: user.name,
      new_role: user.role === "ADMIN" ? "ADMIN" : "USER",
      new_status: "DISABLED",
    });

    setActionLoadingId("");

    if (error) {
      setErrorMessage(error.message || "계정을 복구하지 못했습니다.");
      return;
    }

    setSuccessMessage("계정이 복구되었습니다. 복구된 계정은 비활성화 상태입니다.");
    await loadUsers(true);
  }

  async function deleteUser(user: UserProfile) {
    if (!canEditUser(user)) {
      setErrorMessage("이 사용자는 현재 계정으로 삭제할 수 없습니다.");
      setSuccessMessage("");
      return;
    }

    const confirmed = window.confirm(
      "이 계정을 완전히 삭제할까요? 이 작업은 되돌릴 수 없습니다."
    );

    if (!confirmed) return;

    setActionLoadingId(user.id);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc("admin_delete_profile", {
      target_user_id: user.id,
    });

    setActionLoadingId("");

    if (error) {
      setErrorMessage(error.message || "계정을 삭제하지 못했습니다.");
      return;
    }

    setSuccessMessage("계정이 삭제되었습니다.");
    await loadUsers(true);
  }

  function getRoleLabel(role: UserRole) {
    if (role === "SUPER_USER") return "슈퍼 유저";
    if (role === "ADMIN") return "관리자";
    return "일반 사용자";
  }

  function getStatusLabel(status: UserStatus) {
    if (status === "HIDDEN") return "숨김";
    if (status === "DISABLED") return "비활성화";
    return "활성";
  }

  function getProLabel(proUntil: string | null) {
    if (!proUntil) return "일반";

    const proDate = new Date(proUntil);

    if (proDate.getTime() <= Date.now()) {
      return "만료";
    }

    return `Pro · ${proDate.toLocaleDateString("ko-KR")}까지`;
  }

  function getCreatedAtLabel(createdAt: string) {
    return new Date(createdAt).toLocaleDateString("ko-KR");
  }

  const sortedUsers = useMemo(() => {
    const nextUsers = [...users];

    if (sortMode === "name_asc") {
      nextUsers.sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "ko-KR", {
          sensitivity: "base",
        })
      );

      return nextUsers;
    }

    nextUsers.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return nextUsers;
  }, [users, sortMode]);

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
            사용자 관리
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            계정 추가, 수정, 비밀번호 재설정, 숨김, 복구, 삭제를 관리합니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/admin")} style={buttonStyle}>
            관리자
          </button>

          <button onClick={() => router.push("/home")} style={buttonStyle}>
            홈
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
          <div
            style={{
              borderRadius: "14px",
              background: "#f9fafb",
              padding: "16px",
            }}
          >
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
              현재 관리자
            </p>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "15px",
                fontWeight: 800,
                color: "#111827",
                wordBreak: "break-all",
              }}
            >
              {profile?.name} · {profile?.email} ·{" "}
              {profile ? getRoleLabel(profile.role) : "-"}
            </p>
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
                lineHeight: 1.5,
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
                lineHeight: 1.5,
              }}
            >
              {successMessage}
            </div>
          )}
        </div>

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
                {showHiddenUsers ? "숨김 계정 목록" : "사용자 목록"}
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
                  ? "숨김 처리된 계정을 복구하거나 완전히 삭제할 수 있습니다."
                  : "기본 계정 목록에서는 사용자 추가, 수정, 비밀번호 재설정, 숨김 처리를 할 수 있습니다."}
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {!showHiddenUsers && (
                <button
                  type="button"
                  onClick={toggleCreateForm}
                  style={buttonStyle}
                >
                  {showCreateForm ? "사용자 추가 닫기" : "사용자 추가"}
                </button>
              )}

              <button type="button" onClick={toggleHiddenList} style={buttonStyle}>
                {showHiddenUsers ? "기본 계정 목록" : "숨김 계정 목록"}
              </button>

              <button
                type="button"
                onClick={() => loadUsers(showHiddenUsers)}
                disabled={usersLoading}
                style={{
                  ...buttonStyle,
                  opacity: usersLoading ? 0.6 : 1,
                }}
              >
                {usersLoading ? "새로고침 중..." : "새로고침"}
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              alignItems: "end",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>정렬 기준</label>
              <select
                value={sortMode}
                onChange={(event) =>
                  setSortMode(event.target.value as UserSortMode)
                }
                style={inputStyle}
              >
                <option value="created_desc">등록순</option>
                <option value="name_asc">ㄱㄴㄷ순</option>
              </select>
            </div>
          </div>

          {showCreateForm && !showHiddenUsers && (
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
                사용자 추가
              </h3>

              <div
                style={{
                  marginTop: "16px",
                  display: "grid",
                  gap: "12px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  alignItems: "start",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>이메일</label>
                  <input
                    value={createForm.email}
                    onChange={(event) =>
                      setCreateForm({
                        ...createForm,
                        email: event.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>비밀번호</label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(event) =>
                      setCreateForm({
                        ...createForm,
                        password: event.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>비밀번호 확인</label>
                  <input
                    type="password"
                    value={createForm.passwordConfirm}
                    onChange={(event) =>
                      setCreateForm({
                        ...createForm,
                        passwordConfirm: event.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>이름</label>
                  <input
                    value={createForm.name}
                    onChange={(event) =>
                      setCreateForm({
                        ...createForm,
                        name: event.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>역할</label>
                  <select
                    value={createForm.role}
                    onChange={(event) =>
                      setCreateForm({
                        ...createForm,
                        role: event.target.value as EditableRole,
                      })
                    }
                    disabled={profile?.role !== "SUPER_USER"}
                    style={inputStyle}
                  >
                    <option value="USER">일반 사용자</option>
                    <option value="ADMIN">관리자</option>
                  </select>
                </div>

                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>상태</label>
                  <select
                    value={createForm.status}
                    onChange={(event) =>
                      setCreateForm({
                        ...createForm,
                        status: event.target.value as Exclude<
                          UserStatus,
                          "HIDDEN"
                        >,
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
                  onClick={createUser}
                  disabled={creating}
                  style={{
                    border: "none",
                    borderRadius: "10px",
                    background: "#111827",
                    color: "#ffffff",
                    padding: "11px 14px",
                    fontSize: "13px",
                    fontWeight: 800,
                    opacity: creating ? 0.6 : 1,
                  }}
                >
                  {creating ? "추가 중..." : "추가"}
                </button>

                <button
                  type="button"
                  onClick={toggleCreateForm}
                  disabled={creating}
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
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  alignItems: "start",
                }}
              >
                <div style={{ minWidth: 0 }}>
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

                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>역할</label>
                  <select
                    value={editingUser.role}
                    onChange={(event) =>
                      setEditingUser({
                        ...editingUser,
                        role: event.target.value as EditableRole,
                      })
                    }
                    disabled={profile?.role !== "SUPER_USER"}
                    style={inputStyle}
                  >
                    <option value="USER">일반 사용자</option>
                    <option value="ADMIN">관리자</option>
                  </select>
                </div>

                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>상태</label>
                  <select
                    value={editingUser.status}
                    onChange={(event) =>
                      setEditingUser({
                        ...editingUser,
                        status: event.target.value as Exclude<
                          UserStatus,
                          "HIDDEN"
                        >,
                      })
                    }
                    style={inputStyle}
                  >
                    <option value="ACTIVE">활성</option>
                    <option value="DISABLED">비활성화</option>
                  </select>
                </div>
              </div>

              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: "12px",
                  color: "#6b7280",
                  lineHeight: 1.5,
                }}
              >
                숨김 처리는 상태 선택이 아니라 사용자 목록의 숨김 버튼으로만
                처리합니다.
              </p>

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
                  disabled={saving || resettingPassword}
                  style={{
                    ...buttonStyle,
                    padding: "11px 14px",
                  }}
                >
                  취소
                </button>
              </div>

              <div
                style={{
                  marginTop: "18px",
                  borderTop: "1px solid #e5e7eb",
                  paddingTop: "18px",
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: 900,
                    color: "#111827",
                  }}
                >
                  비밀번호 재설정
                </h4>

                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: "12px",
                    color: "#6b7280",
                    lineHeight: 1.5,
                  }}
                >
                  관리자 이상은 이 사용자의 새 비밀번호를 직접 설정할 수 있습니다.
                </p>

                <div
                  style={{
                    marginTop: "12px",
                    display: "grid",
                    gap: "12px",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    alignItems: "end",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <label style={labelStyle}>새 비밀번호</label>
                    <input
                      type="password"
                      value={passwordResetForm.password}
                      onChange={(event) =>
                        setPasswordResetForm({
                          ...passwordResetForm,
                          password: event.target.value,
                        })
                      }
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <label style={labelStyle}>새 비밀번호 확인</label>
                    <input
                      type="password"
                      value={passwordResetForm.passwordConfirm}
                      onChange={(event) =>
                        setPasswordResetForm({
                          ...passwordResetForm,
                          passwordConfirm: event.target.value,
                        })
                      }
                      style={inputStyle}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={resetUserPassword}
                    disabled={resettingPassword}
                    style={{
                      border: "1px solid #d1d5db",
                      borderRadius: "10px",
                      background: "#ffffff",
                      color: "#111827",
                      padding: "11px 14px",
                      fontSize: "13px",
                      fontWeight: 900,
                      opacity: resettingPassword ? 0.6 : 1,
                    }}
                  >
                    {resettingPassword ? "재설정 중..." : "비밀번호 재설정"}
                  </button>
                </div>
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
                {sortedUsers.length === 0 ? (
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
                      {showHiddenUsers
                        ? "숨김 처리된 계정이 없습니다."
                        : "등록된 사용자가 없습니다."}
                    </td>
                  </tr>
                ) : (
                  sortedUsers.map((user) => (
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
                          showHiddenUsers ? (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                type="button"
                                onClick={() => restoreUser(user)}
                                disabled={actionLoadingId === user.id}
                                style={{
                                  border: "1px solid #bbf7d0",
                                  borderRadius: "9px",
                                  background: "#ffffff",
                                  color: "#15803d",
                                  padding: "8px 10px",
                                  fontSize: "12px",
                                  fontWeight: 800,
                                  opacity:
                                    actionLoadingId === user.id ? 0.6 : 1,
                                }}
                              >
                                복구
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteUser(user)}
                                disabled={actionLoadingId === user.id}
                                style={{
                                  border: "1px solid #fecaca",
                                  borderRadius: "9px",
                                  background: "#ffffff",
                                  color: "#dc2626",
                                  padding: "8px 10px",
                                  fontSize: "12px",
                                  fontWeight: 800,
                                  opacity:
                                    actionLoadingId === user.id ? 0.6 : 1,
                                }}
                              >
                                삭제
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                type="button"
                                onClick={() => startEditUser(user)}
                                disabled={actionLoadingId === user.id}
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
                                disabled={actionLoadingId === user.id}
                                style={{
                                  border: "1px solid #fecaca",
                                  borderRadius: "9px",
                                  background: "#ffffff",
                                  color: "#dc2626",
                                  padding: "8px 10px",
                                  fontSize: "12px",
                                  fontWeight: 800,
                                  opacity:
                                    actionLoadingId === user.id ? 0.6 : 1,
                                }}
                              >
                                숨김
                              </button>
                            </div>
                          )
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
