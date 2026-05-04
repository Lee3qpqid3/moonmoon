"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  pro_until: string | null;
};

type UserEntitlement = {
  entitlement_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  serial_key_id: string;
  serial_key_code: string;
  duration_days: number;
  serial_key_status: string;
  entitlement_status: string;
  display_status: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
};

export default function AdminUserEntitlementsPage() {
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [records, setRecords] = useState<UserEntitlement[]>([]);

  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setErrorMessage("");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, name, role, status, pro_until")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      setErrorMessage("사용자 목록을 불러오지 못했습니다.");
      return;
    }

    setUsers((data ?? []) as UserProfile[]);
  }

  async function loadUserEntitlements(userId = selectedUserId) {
    if (!userId) {
      setErrorMessage("사용자를 선택해야 합니다.");
      return;
    }

    setRecordsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.rpc("admin_get_user_entitlements", {
      target_profile_id: userId,
    });

    setRecordsLoading(false);

    if (error) {
      setErrorMessage(error.message || "사용권 기록을 불러오지 못했습니다.");
      return;
    }

    setRecords((data ?? []) as UserEntitlement[]);
  }

  function getDateTimeLabel(dateText: string | null) {
    if (!dateText) return "-";

    return new Date(dateText).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function getStatusLabel(status: string) {
    if (status === "IN_USE") return "사용 중";
    if (status === "QUEUED") return "대기 중";
    if (status === "FORFEITED") return "몰수됨";
    if (status === "EXPIRED") return "만료됨";
    return status;
  }

  function getStatusColor(status: string) {
    if (status === "IN_USE") return "#15803d";
    if (status === "QUEUED") return "#2563eb";
    if (status === "FORFEITED") return "#dc2626";
    if (status === "EXPIRED") return "#6b7280";
    return "#111827";
  }

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

  if (loading) {
    return (
      <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff", fontFamily: "Arial, sans-serif" }}>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>사용자 목록을 불러오는 중입니다...</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100dvh", background: "#ffffff", fontFamily: "Arial, sans-serif" }}>
      <header style={{ borderBottom: "1px solid #e5e7eb", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", boxSizing: "border-box" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#111827" }}>
            유저 사용권 기록
          </h1>

          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
            특정 유저가 등록한 시리얼키와 Pro 사용권 기록을 확인합니다.
          </p>
        </div>

        <button onClick={() => router.push("/admin")} style={{ border: "1px solid #d1d5db", borderRadius: "10px", background: "#ffffff", color: "#111827", padding: "9px 12px", fontSize: "13px", fontWeight: 700 }}>
          관리자
        </button>
      </header>

      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "28px 20px", boxSizing: "border-box" }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "20px", padding: "24px", boxShadow: "0 10px 30px rgba(0,0,0,0.04)" }}>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#111827" }}>
            사용자 선택
          </h2>

          <p style={{ marginTop: "8px", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
            사용자 목록에서 계정을 선택하면 해당 계정의 사용권 기록을 볼 수 있습니다.
          </p>

          {errorMessage && (
            <div style={{ marginTop: "18px", border: "1px solid #fecaca", borderRadius: "14px", background: "#fff1f2", padding: "14px", color: "#991b1b", fontSize: "14px" }}>
              {errorMessage}
            </div>
          )}

          <div style={{ marginTop: "18px", display: "grid", gap: "12px", gridTemplateColumns: "1fr auto" }}>
            <select
              value={selectedUserId}
              onChange={(event) => {
                setSelectedUserId(event.target.value);
                setRecords([]);
              }}
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: "10px", padding: "12px", fontSize: "14px", background: "#ffffff" }}
            >
              <option value="">사용자 선택</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.email} · {user.id}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => loadUserEntitlements()}
              disabled={recordsLoading}
              style={{ border: "none", borderRadius: "10px", background: "#111827", color: "#ffffff", padding: "12px 16px", fontSize: "14px", fontWeight: 800, opacity: recordsLoading ? 0.6 : 1, whiteSpace: "nowrap" }}
            >
              {recordsLoading ? "조회 중..." : "조회"}
            </button>
          </div>

          {selectedUser && (
            <div style={{ marginTop: "18px", borderRadius: "14px", background: "#f9fafb", padding: "16px" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>선택한 사용자</p>

              <p style={{ margin: "6px 0 0", fontSize: "15px", fontWeight: 800, color: "#111827", wordBreak: "break-all" }}>
                {selectedUser.name} · {selectedUser.email}
              </p>

              <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#6b7280", wordBreak: "break-all" }}>
                UUID: {selectedUser.id}
              </p>

              <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#6b7280" }}>
                상태: {selectedUser.status} · Pro 만료: {getDateTimeLabel(selectedUser.pro_until)}
              </p>
            </div>
          )}
        </div>

        <div style={{ marginTop: "20px", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "24px", boxShadow: "0 10px 30px rgba(0,0,0,0.04)" }}>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#111827" }}>
            사용권 기록
          </h2>

          <div style={{ marginTop: "20px", overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "14px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1100px" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["시리얼키", "기간", "상태", "시리얼키 상태", "시작", "만료", "등록"].map((title) => (
                    <th key={title} style={{ padding: "12px", textAlign: "left", fontSize: "13px", color: "#6b7280", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "18px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>
                      표시할 사용권 기록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.entitlement_id}>
                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", fontWeight: 800, color: "#111827", whiteSpace: "nowrap" }}>
                        {record.serial_key_code}
                      </td>

                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#111827", whiteSpace: "nowrap" }}>
                        {record.duration_days}일
                      </td>

                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: getStatusColor(record.display_status), fontWeight: 800, whiteSpace: "nowrap" }}>
                        {getStatusLabel(record.display_status)}
                      </td>

                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#6b7280", whiteSpace: "nowrap" }}>
                        {record.serial_key_status}
                      </td>

                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#6b7280", whiteSpace: "nowrap" }}>
                        {getDateTimeLabel(record.starts_at)}
                      </td>

                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#6b7280", whiteSpace: "nowrap" }}>
                        {getDateTimeLabel(record.ends_at)}
                      </td>

                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#6b7280", whiteSpace: "nowrap" }}>
                        {getDateTimeLabel(record.created_at)}
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
