"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";
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

type StreamingAccessRow = {
  week_name: string;
  teacher_name: string;
  has_live: boolean;
  has_docs: boolean;
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

export default function VideoManagementPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [accessRows, setAccessRows] = useState<StreamingAccessRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [updatingKey, setUpdatingKey] = useState("");
  const [denied, setDenied] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    checkAdminAndLoadUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadUserAccess(selectedUserId);
    } else {
      setAccessRows([]);
    }
  }, [selectedUserId]);

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

  async function loadUserAccess(userId: string) {
    setAccessLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { data, error } = await supabase.rpc("admin_get_user_streaming_access", {
      target_user_id: userId,
    });

    setAccessLoading(false);

    if (error) {
      setErrorMessage(error.message || "영상 권한 목록을 불러오지 못했습니다.");
      setAccessRows([]);
      return;
    }

    setAccessRows((data ?? []) as StreamingAccessRow[]);
  }

  async function grantAccess(row: StreamingAccessRow, accessType: "LIVE" | "DOCS") {
    if (!selectedUserId) return;

    const key = `${row.week_name}-${row.teacher_name}-${accessType}`;
    setUpdatingKey(key);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc("admin_grant_streaming_access", {
      target_user_id: selectedUserId,
      target_week_name: row.week_name,
      target_teacher_name: row.teacher_name,
      target_access_type: accessType,
    });

    setUpdatingKey("");

    if (error) {
      setErrorMessage(error.message || "권한을 부여하지 못했습니다.");
      return;
    }

    if (accessType === "DOCS") {
      setSuccessMessage("DOCS 권한이 부여되었습니다. LIVE 권한도 함께 부여됩니다.");
    } else {
      setSuccessMessage("LIVE 권한이 부여되었습니다.");
    }

    await loadUserAccess(selectedUserId);
  }

  async function revokeAccess(row: StreamingAccessRow, accessType: "LIVE" | "DOCS") {
    if (!selectedUserId) return;

    const confirmed =
      accessType === "LIVE"
        ? window.confirm(
            "LIVE 권한을 해제하면 DOCS 권한도 함께 해제됩니다. 계속할까요?"
          )
        : window.confirm("DOCS 권한을 해제할까요?");

    if (!confirmed) return;

    const key = `${row.week_name}-${row.teacher_name}-${accessType}`;
    setUpdatingKey(key);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc("admin_revoke_streaming_access", {
      target_user_id: selectedUserId,
      target_week_name: row.week_name,
      target_teacher_name: row.teacher_name,
      target_access_type: accessType,
    });

    setUpdatingKey("");

    if (error) {
      setErrorMessage(error.message || "권한을 해제하지 못했습니다.");
      return;
    }

    if (accessType === "LIVE") {
      setSuccessMessage("LIVE 권한이 해제되었습니다. DOCS 권한도 함께 해제됩니다.");
    } else {
      setSuccessMessage("DOCS 권한이 해제되었습니다.");
    }

    await loadUserAccess(selectedUserId);
  }

  async function toggleLive(row: StreamingAccessRow) {
    if (row.has_live) {
      await revokeAccess(row, "LIVE");
    } else {
      await grantAccess(row, "LIVE");
    }
  }

  async function toggleDocs(row: StreamingAccessRow) {
    if (row.has_docs) {
      await revokeAccess(row, "DOCS");
    } else {
      await grantAccess(row, "DOCS");
    }
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

  function getProLabel(proUntil: string | null) {
    if (!proUntil) {
      return "일반";
    }

    const proDate = new Date(proUntil);

    if (proDate.getTime() <= Date.now()) {
      return "만료";
    }

    return `Pro · ${proDate.toLocaleDateString("ko-KR")}까지`;
  }

  function getSelectedUser() {
    return users.find((user) => user.id === selectedUserId) ?? null;
  }

  function getRowKey(row: StreamingAccessRow, accessType: "LIVE" | "DOCS") {
    return `${row.week_name}-${row.teacher_name}-${accessType}`;
  }

  const selectedUser = getSelectedUser();

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
            영상 관리는 관리자 이상 계정만 접근할 수 있습니다.
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
            영상 관리
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            사용자별 주차/강사 LIVE, DOCS 권한을 배부합니다.
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
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>
                사용자 선택
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                전체 계정 중 한 명을 선택해 주차/강사별 LIVE, DOCS 권한을
                부여합니다. Pro가 아니어도 미리 권한을 배정할 수 있습니다.
              </p>
            </div>

            <button
              type="button"
              onClick={loadUsers}
              disabled={usersLoading}
              style={{
                ...buttonStyle,
                opacity: usersLoading ? 0.6 : 1,
              }}
            >
              {usersLoading ? "새로고침 중..." : "사용자 새로고침"}
            </button>
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={labelStyle}>사용자</label>

            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              style={inputStyle}
            >
              <option value="">사용자를 선택하세요</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.email} · {getRoleLabel(user.role)} ·{" "}
                  {getStatusLabel(user.status)} · {getProLabel(user.pro_until)}
                </option>
              ))}
            </select>
          </div>

          {selectedUser && (
            <div
              style={{
                marginTop: "16px",
                borderRadius: "14px",
                background: "#f9fafb",
                padding: "16px",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                선택된 사용자
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
                {selectedUser.name} · {selectedUser.email}
              </p>

              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "12px",
                  color: "#6b7280",
                  fontFamily: "monospace",
                  wordBreak: "break-all",
                }}
              >
                UUID: {selectedUser.id}
              </p>

              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "13px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                {getRoleLabel(selectedUser.role)} ·{" "}
                {getStatusLabel(selectedUser.status)} ·{" "}
                {getProLabel(selectedUser.pro_until)}
              </p>
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, marginTop: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>
                권한 배부
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                DOCS를 체크하면 LIVE도 자동 부여됩니다. LIVE를 해제하면 DOCS도
                함께 해제됩니다.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (selectedUserId) {
                  loadUserAccess(selectedUserId);
                }
              }}
              disabled={!selectedUserId || accessLoading}
              style={{
                ...buttonStyle,
                opacity: !selectedUserId || accessLoading ? 0.6 : 1,
              }}
            >
              {accessLoading ? "새로고침 중..." : "권한 새로고침"}
            </button>
          </div>

          {!selectedUserId ? (
            <div
              style={{
                marginTop: "20px",
                border: "1px solid #e5e7eb",
                borderRadius: "14px",
                padding: "22px",
                textAlign: "center",
                color: "#6b7280",
                fontSize: "14px",
              }}
            >
              먼저 사용자를 선택하세요.
            </div>
          ) : accessRows.length === 0 ? (
            <div
              style={{
                marginTop: "20px",
                border: "1px solid #e5e7eb",
                borderRadius: "14px",
                padding: "22px",
                textAlign: "center",
                color: "#6b7280",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              표시할 주차/강사 항목이 없습니다. SUPER_USER가 WebDAV 스캔을 통해
              live/docs 항목을 먼저 등록해야 합니다.
            </div>
          ) : (
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
                  minWidth: "720px",
                }}
              >
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["주차", "강사명", "LIVE", "DOCS"].map((title) => (
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
                  {accessRows.map((row) => {
                    const liveKey = getRowKey(row, "LIVE");
                    const docsKey = getRowKey(row, "DOCS");

                    return (
                      <tr key={`${row.week_name}-${row.teacher_name}`}>
                        <td
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #f3f4f6",
                            fontSize: "14px",
                            color: "#111827",
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.week_name}
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
                          {row.teacher_name}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #f3f4f6",
                            fontSize: "14px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              fontSize: "13px",
                              fontWeight: 800,
                              color: row.has_live ? "#15803d" : "#6b7280",
                              cursor: updatingKey ? "wait" : "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={row.has_live}
                              disabled={Boolean(updatingKey)}
                              onChange={() => toggleLive(row)}
                            />
                            {updatingKey === liveKey
                              ? "처리 중..."
                              : row.has_live
                                ? "허용"
                                : "미허용"}
                          </label>
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #f3f4f6",
                            fontSize: "14px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              fontSize: "13px",
                              fontWeight: 800,
                              color: row.has_docs ? "#15803d" : "#6b7280",
                              cursor: updatingKey ? "wait" : "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={row.has_docs}
                              disabled={Boolean(updatingKey)}
                              onChange={() => toggleDocs(row)}
                            />
                            {updatingKey === docsKey
                              ? "처리 중..."
                              : row.has_docs
                                ? "허용"
                                : "미허용"}
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
