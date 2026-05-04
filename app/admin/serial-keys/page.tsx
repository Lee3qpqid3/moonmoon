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

type SerialKeyStatus = "ACTIVE" | "USED" | "DISABLED" | "HIDDEN";

type SerialKey = {
  id: string;
  code: string;
  duration_days: number;
  status: SerialKeyStatus;
  issued_by: string | null;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
};

type SerialKeyAction = "DISABLE" | "HIDE" | "RESTORE" | "DELETE";

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

export default function SerialKeysAdminPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [serialKeys, setSerialKeys] = useState<SerialKey[]>([]);

  const [durationDays, setDurationDays] = useState("30");
  const [count, setCount] = useState("1");
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

  const [showHidden, setShowHidden] = useState(false);

  const [loading, setLoading] = useState(true);
  const [keysLoading, setKeysLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actingKeyId, setActingKeyId] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function checkAdminAndLoadKeys() {
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

      await loadSerialKeys(false);
    }

    checkAdminAndLoadKeys();
  }, [router]);

  async function loadSerialKeys(nextShowHidden = showHidden) {
    setKeysLoading(true);
    setErrorMessage("");

    let query = supabase
      .from("serial_keys")
      .select(
        "id, code, duration_days, status, issued_by, used_by, used_at, created_at"
      )
      .order("created_at", { ascending: false });

    if (nextShowHidden) {
      query = query.eq("status", "HIDDEN");
    } else {
      query = query.neq("status", "HIDDEN");
    }

    const { data, error } = await query;

    setKeysLoading(false);

    if (error) {
      setErrorMessage("시리얼키 목록을 불러오지 못했습니다.");
      return;
    }

    setSerialKeys((data ?? []) as SerialKey[]);
  }

  async function switchHiddenView(nextShowHidden: boolean) {
    setShowHidden(nextShowHidden);
    setGeneratedCodes([]);
    setSuccessMessage("");
    setErrorMessage("");
    await loadSerialKeys(nextShowHidden);
  }

  async function handleGenerateSerialKeys() {
    setErrorMessage("");
    setSuccessMessage("");
    setGeneratedCodes([]);

    const nextDurationDays = Number(durationDays);
    const nextCount = Number(count);

    if (!Number.isInteger(nextDurationDays) || nextDurationDays <= 0) {
      setErrorMessage("기간은 1일 이상이어야 합니다.");
      return;
    }

    if (!Number.isInteger(nextCount) || nextCount <= 0) {
      setErrorMessage("발급 개수는 1개 이상이어야 합니다.");
      return;
    }

    if (nextCount > 50) {
      setErrorMessage("한 번에 최대 50개까지 발급할 수 있습니다.");
      return;
    }

    setGenerating(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setErrorMessage("로그인이 필요합니다.");
        return;
      }

      const response = await fetch("/api/admin/serial-keys/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          durationDays: nextDurationDays,
          count: nextCount,
        }),
      });

      const text = await response.text();

      let result: {
        ok?: boolean;
        codes?: string[];
        error?: string;
      } = {};

      try {
        result = text ? JSON.parse(text) : {};
      } catch {
        setErrorMessage(
          `서버 응답을 읽지 못했습니다. 상태 코드: ${response.status}`
        );
        return;
      }

      if (!response.ok) {
        setErrorMessage(result.error || "시리얼키를 발급하지 못했습니다.");
        return;
      }

      setGeneratedCodes(result.codes ?? []);
      setSuccessMessage("시리얼키가 발급되었습니다.");

      if (showHidden) {
        setShowHidden(false);
        await loadSerialKeys(false);
      } else {
        await loadSerialKeys(false);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "시리얼키 발급 중 오류가 발생했습니다."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleSerialKeyAction(
    serialKey: SerialKey,
    action: SerialKeyAction
  ) {
    setErrorMessage("");
    setSuccessMessage("");

    if (action === "DELETE") {
      const confirmed = window.confirm(
        "정말 이 시리얼키를 완전 삭제할까요? 완전 삭제하면 목록과 DB에서 사라지며, 같은 코드가 나중에 다시 발급될 수 있습니다."
      );

      if (!confirmed) {
        return;
      }
    }

    if (action === "DISABLE") {
      const confirmed = window.confirm(
        "이 시리얼키를 비활성화할까요? 비활성화된 시리얼키는 사용할 수 없습니다."
      );

      if (!confirmed) {
        return;
      }
    }

    if (action === "HIDE") {
      const confirmed = window.confirm(
        "이 시리얼키를 숨김 처리할까요? 숨김 처리된 시리얼키는 자동으로 사용 불가 상태가 되며 기본 목록에서 보이지 않습니다."
      );

      if (!confirmed) {
        return;
      }
    }

    setActingKeyId(serialKey.id);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setErrorMessage("로그인이 필요합니다.");
        return;
      }

      const response = await fetch("/api/admin/serial-keys/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          serialKeyId: serialKey.id,
          action,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.error || "시리얼키 작업에 실패했습니다.");
        return;
      }

      if (action === "DISABLE") {
        setSuccessMessage("시리얼키가 비활성화되었습니다.");
      }

      if (action === "HIDE") {
        setSuccessMessage("시리얼키가 숨김 처리되었습니다.");
      }

      if (action === "RESTORE") {
        setSuccessMessage("시리얼키가 복구되었습니다.");
      }

      if (action === "DELETE") {
        setSuccessMessage("시리얼키가 완전 삭제되었습니다.");
      }

      await loadSerialKeys(showHidden);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "시리얼키 작업 중 오류가 발생했습니다."
      );
    } finally {
      setActingKeyId(null);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setSuccessMessage("시리얼키가 복사되었습니다.");
    } catch {
      setErrorMessage("복사에 실패했습니다. 시리얼키를 직접 선택해 복사해 주세요.");
    }
  }

  function getRoleLabel(role: UserRole) {
    if (role === "SUPER_USER") return "슈퍼 유저";
    if (role === "ADMIN") return "관리자";
    return "일반 사용자";
  }

  function getStatusLabel(status: SerialKeyStatus) {
    if (status === "ACTIVE") return "사용 가능";
    if (status === "USED") return "사용됨";
    if (status === "DISABLED") return "비활성화";
    return "숨김";
  }

  function getStatusColor(status: SerialKeyStatus) {
    if (status === "ACTIVE") return "#15803d";
    if (status === "USED") return "#2563eb";
    if (status === "DISABLED") return "#dc2626";
    return "#6b7280";
  }

  function getDateLabel(dateText: string | null) {
    if (!dateText) return "-";
    return new Date(dateText).toLocaleDateString("ko-KR");
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
            시리얼키 관리
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            Moonmoon Archive Pro 코드 발급
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
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
            시리얼키 발급
          </h2>

          <p
            style={{
              marginTop: "8px",
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: 1.6,
            }}
          >
            형식은 XXXX-XXXX-XXXX-XXXX이며, 영어 대문자·소문자·숫자로
            생성됩니다. 중복 검사는 DB에 남아 있는 모든 시리얼키를 기준으로
            수행합니다.
          </p>

          <div
            style={{
              marginTop: "18px",
              borderRadius: "14px",
              background: "#f9fafb",
              padding: "18px",
            }}
          >
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
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

          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gap: "12px",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <div>
              <label style={labelStyle}>기간</label>
              <select
                value={durationDays}
                onChange={(event) => setDurationDays(event.target.value)}
                style={inputStyle}
              >
                <option value="1">1일</option>
                <option value="7">7일</option>
                <option value="30">30일</option>
                <option value="90">90일</option>
                <option value="180">180일</option>
                <option value="365">365일</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>발급 개수</label>
              <input
                type="number"
                min="1"
                max="50"
                value={count}
                onChange={(event) => setCount(event.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateSerialKeys}
            disabled={generating}
            style={{
              marginTop: "16px",
              border: "none",
              borderRadius: "10px",
              background: "#111827",
              color: "#ffffff",
              padding: "11px 14px",
              fontSize: "13px",
              fontWeight: 800,
              opacity: generating ? 0.6 : 1,
            }}
          >
            {generating ? "발급 중..." : "시리얼키 발급"}
          </button>

          {generatedCodes.length > 0 && (
            <div
              style={{
                marginTop: "20px",
                border: "1px solid #e5e7eb",
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
                방금 발급된 시리얼키
              </h3>

              <div
                style={{
                  marginTop: "14px",
                  display: "grid",
                  gap: "10px",
                }}
              >
                {generatedCodes.map((code) => (
                  <div
                    key={code}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "12px",
                      background: "#ffffff",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => copyCode(code)}
                      title="클릭하면 시리얼키가 복사됩니다."
                      style={{
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        margin: 0,
                        fontSize: "14px",
                        fontWeight: 800,
                        color: "#111827",
                        textAlign: "left",
                        cursor: "pointer",
                        wordBreak: "break-all",
                      }}
                    >
                      {code}
                    </button>

                    <button
                      type="button"
                      onClick={() => copyCode(code)}
                      style={buttonStyle}
                    >
                      복사
                    </button>
                  </div>
                ))}
              </div>
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
                {showHidden ? "숨긴 시리얼키 목록" : "시리얼키 목록"}
              </h2>

              <p
                style={{
                  marginTop: "8px",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                {showHidden
                  ? "숨김 처리된 시리얼키입니다. 복구하거나 완전 삭제할 수 있습니다."
                  : "발급된 Pro 코드 목록입니다. 숨김 처리된 시리얼키는 이 목록에 표시되지 않습니다."}
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => switchHiddenView(!showHidden)}
                style={buttonStyle}
              >
                {showHidden ? "기본 목록 보기" : "숨긴 시리얼키 목록"}
              </button>

              <button
                type="button"
                onClick={() => loadSerialKeys(showHidden)}
                disabled={keysLoading}
                style={{
                  ...buttonStyle,
                  padding: "10px 12px",
                  opacity: keysLoading ? 0.6 : 1,
                }}
              >
                {keysLoading ? "새로고침 중..." : "새로고침"}
              </button>
            </div>
          </div>

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
                minWidth: "980px",
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {[
                    "시리얼키",
                    "기간",
                    "상태",
                    "사용자",
                    "사용일",
                    "발급일",
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
                {serialKeys.length === 0 ? (
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
                      표시할 시리얼키가 없습니다.
                    </td>
                  </tr>
                ) : (
                  serialKeys.map((serialKey) => (
                    <tr key={serialKey.id}>
                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          fontWeight: 800,
                          color: "#111827",
                          wordBreak: "break-all",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => copyCode(serialKey.code)}
                          title="클릭하면 시리얼키가 복사됩니다."
                          style={{
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            margin: 0,
                            fontSize: "14px",
                            fontWeight: 800,
                            color: "#111827",
                            textAlign: "left",
                            cursor: "pointer",
                            wordBreak: "break-all",
                          }}
                        >
                          {serialKey.code}
                        </button>
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          color: "#111827",
                        }}
                      >
                        {serialKey.duration_days}일
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          color: getStatusColor(serialKey.status),
                          fontWeight: 800,
                        }}
                      >
                        {getStatusLabel(serialKey.status)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          color: "#6b7280",
                        }}
                      >
                        {serialKey.used_by ? serialKey.used_by : "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          color: "#6b7280",
                        }}
                      >
                        {getDateLabel(serialKey.used_at)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          color: "#6b7280",
                        }}
                      >
                        {getDateLabel(serialKey.created_at)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
{showHidden ? (
  <>
    <button
      type="button"
      disabled={actingKeyId === serialKey.id}
      onClick={() => handleSerialKeyAction(serialKey, "RESTORE")}
      style={buttonStyle}
    >
      복구
    </button>

    <button
      type="button"
      disabled={actingKeyId === serialKey.id}
      onClick={() => handleSerialKeyAction(serialKey, "DELETE")}
      style={dangerButtonStyle}
    >
      완전 삭제
    </button>
  </>
) : (
  <>
    {serialKey.status !== "DISABLED" && (
      <button
        type="button"
        disabled={actingKeyId === serialKey.id}
        onClick={() => handleSerialKeyAction(serialKey, "DISABLE")}
        style={buttonStyle}
      >
        비활성화
      </button>
    )}

    <button
      type="button"
      disabled={actingKeyId === serialKey.id}
      onClick={() => handleSerialKeyAction(serialKey, "HIDE")}
      style={buttonStyle}
    >
      숨김
    </button>
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
