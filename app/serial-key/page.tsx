"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";
type UserStatus = "ACTIVE" | "DISABLED" | "HIDDEN";

type Profile = {
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  pro_until: string | null;
};

type RedeemResult = {
  new_pro_until: string;
  entitlement_starts_at: string;
  entitlement_ends_at: string;
  redeemed_duration_days: number;
};

type MyEntitlement = {
  entitlement_id: string;
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

export default function SerialKeyPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [entitlements, setEntitlements] = useState<MyEntitlement[]>([]);
  const [serialKeyInput, setSerialKeyInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [redeemResult, setRedeemResult] = useState<RedeemResult | null>(null);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    await loadProfile();
    await loadEntitlements();
  }

  async function loadProfile() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session || !session.user.email) {
      router.push("/");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("email, name, role, status, pro_until")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      setErrorMessage("사용자 프로필을 찾을 수 없습니다. 관리자에게 문의하세요.");
      setLoading(false);
      return;
    }

    if (data.status !== "ACTIVE") {
      await supabase.auth.signOut();
      router.push("/");
      return;
    }

    setProfile(data as Profile);
    setLoading(false);
  }

  async function loadEntitlements() {
    setRecordsLoading(true);

    const { data, error } = await supabase.rpc("get_my_entitlements");

    setRecordsLoading(false);

    if (error) {
      setErrorMessage(error.message || "시리얼키 사용권 목록을 불러오지 못했습니다.");
      return;
    }

    setEntitlements((data ?? []) as MyEntitlement[]);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function formatSerialKeyInput(value: string) {
    const raw = value.replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
    const groups = raw.match(/.{1,4}/g) ?? [];
    return groups.join("-");
  }

  function handleSerialKeyChange(value: string) {
    setSerialKeyInput(formatSerialKeyInput(value));
  }

  async function handleRedeemSerialKey() {
    setErrorMessage("");
    setSuccessMessage("");
    setRedeemResult(null);

    const code = serialKeyInput.trim();

    if (!code) {
      setErrorMessage("시리얼키를 입력해야 합니다.");
      return;
    }

    if (!/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(code)) {
      setErrorMessage("시리얼키 형식이 올바르지 않습니다.");
      return;
    }

    setRedeeming(true);

    const { data, error } = await supabase.rpc("redeem_serial_key", {
      input_code: code,
    });

    setRedeeming(false);

    if (error) {
      setErrorMessage(error.message || "시리얼키를 등록하지 못했습니다.");
      return;
    }

    const result = Array.isArray(data) && data.length > 0 ? data[0] : null;

    if (!result) {
      setErrorMessage("시리얼키 등록 결과를 확인하지 못했습니다.");
      return;
    }

    const nextResult = result as RedeemResult;

    setRedeemResult(nextResult);
    setSerialKeyInput("");
    setSuccessMessage("시리얼키가 등록되었습니다. Pro 기간이 적용되었습니다.");

    await loadProfile();
    await loadEntitlements();
  }

  function getRoleLabel(role: UserRole) {
    if (role === "SUPER_USER") return "슈퍼 유저";
    if (role === "ADMIN") return "관리자";
    return "일반 사용자";
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

  function getProStatusLabel() {
    if (!profile?.pro_until) return "일반 등급";

    const proUntilDate = new Date(profile.pro_until);
    const now = new Date();

    if (proUntilDate <= now) return "일반 등급";

    return `Pro 등급 · ${getDateTimeLabel(profile.pro_until)}까지`;
  }

  function getDisplayStatusLabel(status: string) {
    if (status === "IN_USE") return "사용 중";
    if (status === "QUEUED") return "대기 중";
    if (status === "FORFEITED") return "몰수됨";
    if (status === "EXPIRED") return "만료됨";
    return status;
  }

  function getDisplayStatusColor(status: string) {
    if (status === "IN_USE") return "#15803d";
    if (status === "QUEUED") return "#2563eb";
    if (status === "FORFEITED") return "#dc2626";
    if (status === "EXPIRED") return "#6b7280";
    return "#111827";
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    padding: "12px",
    fontSize: "15px",
    background: "#ffffff",
  };

  const buttonStyle = {
    width: "100%",
    border: "none",
    borderRadius: "12px",
    background: "#111827",
    color: "#ffffff",
    padding: "14px",
    fontSize: "14px",
    fontWeight: 800,
  };

  const outlineButtonStyle = {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#111827",
    padding: "14px",
    fontSize: "14px",
    fontWeight: 800,
  };

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
          계정 정보를 확인하는 중입니다...
        </p>
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#111827" }}>
            시리얼키 등록
          </h1>

          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
            Moonmoon Archive Pro 등록
          </p>
        </div>

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
      </header>

      <section
        style={{
          maxWidth: "980px",
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
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#111827" }}>
            Pro 시리얼키 등록
          </h2>

          <p style={{ marginTop: "10px", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
            시리얼키를 입력하면 Pro 기간이 적용됩니다. 여러 개를 등록하면 등록 순서대로 이어서 사용됩니다.
          </p>

          <div style={{ marginTop: "20px", borderRadius: "14px", background: "#f9fafb", padding: "18px" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>현재 계정</p>

            <p style={{ margin: "6px 0 0", fontSize: "16px", fontWeight: 700, color: "#111827", wordBreak: "break-all" }}>
              {profile?.name} · {profile?.email}
            </p>

            <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#6b7280", lineHeight: 1.6 }}>
              {profile ? getRoleLabel(profile.role) : "-"} · {getProStatusLabel()}
            </p>
          </div>

          {errorMessage && (
            <div style={{ marginTop: "18px", border: "1px solid #fecaca", borderRadius: "14px", background: "#fff1f2", padding: "14px", color: "#991b1b", fontSize: "14px", lineHeight: 1.5 }}>
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div style={{ marginTop: "18px", border: "1px solid #bbf7d0", borderRadius: "14px", background: "#f0fdf4", padding: "14px", color: "#166534", fontSize: "14px", lineHeight: 1.5 }}>
              {successMessage}
            </div>
          )}

          {redeemResult && (
            <div style={{ marginTop: "18px", border: "1px solid #e5e7eb", borderRadius: "14px", background: "#f9fafb", padding: "18px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#111827" }}>
                등록 결과
              </h3>

              <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
                <p style={{ margin: 0, fontSize: "14px", color: "#374151" }}>
                  적용 기간: {redeemResult.redeemed_duration_days}일
                </p>

                <p style={{ margin: 0, fontSize: "14px", color: "#374151" }}>
                  시작 시각: {getDateTimeLabel(redeemResult.entitlement_starts_at)}
                </p>

                <p style={{ margin: 0, fontSize: "14px", color: "#374151" }}>
                  만료 시각: {getDateTimeLabel(redeemResult.entitlement_ends_at)}
                </p>
              </div>
            </div>
          )}

          <div style={{ marginTop: "24px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 800, color: "#374151" }}>
              시리얼키
            </label>

            <input
              value={serialKeyInput}
              onChange={(event) => handleSerialKeyChange(event.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              style={{
                ...inputStyle,
                letterSpacing: "0.5px",
                fontWeight: 700,
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleRedeemSerialKey}
            disabled={redeeming}
            style={{
              ...buttonStyle,
              marginTop: "14px",
              opacity: redeeming ? 0.6 : 1,
            }}
          >
            {redeeming ? "등록 중..." : "시리얼키 등록"}
          </button>

          <div style={{ marginTop: "24px", display: "grid", gap: "12px" }}>
            <button type="button" onClick={() => router.push("/home")} style={outlineButtonStyle}>
              홈으로 돌아가기
            </button>

            {(profile?.role === "ADMIN" || profile?.role === "SUPER_USER") && (
              <button
                type="button"
                onClick={() => router.push("/admin/serial-keys")}
                style={{ ...outlineButtonStyle, border: "1px solid #111827" }}
              >
                시리얼키 관리로 이동
              </button>
            )}
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
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#111827" }}>
                내 Pro 사용권 목록
              </h2>

              <p style={{ marginTop: "8px", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
                등록한 시리얼키의 사용 상태를 확인할 수 있습니다.
              </p>
            </div>

            <button
              type="button"
              onClick={loadEntitlements}
              disabled={recordsLoading}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "10px",
                background: "#ffffff",
                color: "#111827",
                padding: "10px 12px",
                fontSize: "13px",
                fontWeight: 800,
                whiteSpace: "nowrap",
                opacity: recordsLoading ? 0.6 : 1,
              }}
            >
              {recordsLoading ? "새로고침 중..." : "새로고침"}
            </button>
          </div>

          <div style={{ marginTop: "18px", overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "14px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "980px" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["시리얼키", "기간", "상태", "시작 시각", "만료 시각", "등록 시각"].map((title) => (
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
                {entitlements.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "18px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>
                      등록한 시리얼키가 없습니다.
                    </td>
                  </tr>
                ) : (
                  entitlements.map((item) => (
                    <tr key={item.entitlement_id}>
                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", fontWeight: 800, color: "#111827", whiteSpace: "nowrap" }}>
                        {item.serial_key_code}
                      </td>

                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#111827", whiteSpace: "nowrap" }}>
                        {item.duration_days}일
                      </td>

                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: getDisplayStatusColor(item.display_status), fontWeight: 800, whiteSpace: "nowrap" }}>
                        {getDisplayStatusLabel(item.display_status)}
                      </td>

                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#6b7280", whiteSpace: "nowrap" }}>
                        {getDateTimeLabel(item.starts_at)}
                      </td>

                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#6b7280", whiteSpace: "nowrap" }}>
                        {getDateTimeLabel(item.ends_at)}
                      </td>

                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#6b7280", whiteSpace: "nowrap" }}>
                        {getDateTimeLabel(item.created_at)}
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
