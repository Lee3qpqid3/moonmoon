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

type ProgressStep = {
  id: string;
  step_name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type StepForm = {
  step_name: string;
  sort_order: string;
};

type EditingStep = {
  id: string;
  step_name: string;
  sort_order: string;
  is_active: boolean;
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

export default function ProgressStepsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [steps, setSteps] = useState<ProgressStep[]>([]);

  const [form, setForm] = useState<StepForm>({
    step_name: "",
    sort_order: "70",
  });

  const [editingStep, setEditingStep] = useState<EditingStep | null>(null);

  const [loading, setLoading] = useState(true);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    checkAdminAndLoadSteps();
  }, []);

  async function checkAdminAndLoadSteps() {
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

    await loadSteps();
  }

  async function loadSteps() {
    setStepsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { data, error } = await supabase.rpc("get_streaming_progress_steps");

    setStepsLoading(false);

    if (error) {
      setErrorMessage(error.message || "진행도 단계를 불러오지 못했습니다.");
      setSteps([]);
      return;
    }

    setSteps((data ?? []) as ProgressStep[]);
  }

  async function createStep() {
    const stepName = form.step_name.trim();
    const sortOrder = Number(form.sort_order);

    if (!stepName) {
      setErrorMessage("단계 이름을 입력해야 합니다.");
      return;
    }

    if (!Number.isFinite(sortOrder)) {
      setErrorMessage("정렬 순서는 숫자로 입력해야 합니다.");
      return;
    }

    setCreating(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc("admin_create_streaming_progress_step", {
      target_step_name: stepName,
      target_sort_order: sortOrder,
    });

    setCreating(false);

    if (error) {
      setErrorMessage(error.message || "진행도 단계를 추가하지 못했습니다.");
      return;
    }

    setSuccessMessage("진행도 단계가 추가되었습니다.");
    setForm({
      step_name: "",
      sort_order: String(sortOrder + 10),
    });

    await loadSteps();
  }

  function startEditStep(step: ProgressStep) {
    setEditingStep({
      id: step.id,
      step_name: step.step_name,
      sort_order: String(step.sort_order),
      is_active: step.is_active,
    });

    setErrorMessage("");
    setSuccessMessage("");
  }

  function cancelEditStep() {
    setEditingStep(null);
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function saveStep() {
    if (!editingStep) {
      return;
    }

    const stepName = editingStep.step_name.trim();
    const sortOrder = Number(editingStep.sort_order);

    if (!stepName) {
      setErrorMessage("단계 이름을 입력해야 합니다.");
      return;
    }

    if (!Number.isFinite(sortOrder)) {
      setErrorMessage("정렬 순서는 숫자로 입력해야 합니다.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc("admin_update_streaming_progress_step", {
      target_step_id: editingStep.id,
      target_step_name: stepName,
      target_sort_order: sortOrder,
      target_is_active: editingStep.is_active,
    });

    setSaving(false);

    if (error) {
      setErrorMessage(error.message || "진행도 단계를 저장하지 못했습니다.");
      return;
    }

    setSuccessMessage("진행도 단계가 저장되었습니다.");
    setEditingStep(null);
    await loadSteps();
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
            진행도 단계 관리는 관리자 이상 계정만 접근할 수 있습니다.
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
            진행도 단계 관리
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            주차별 진행도 표에 표시될 작업 단계를 관리합니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/admin")} style={buttonStyle}>
            관리자
          </button>

          <button
            onClick={() => router.push("/streaming/schedule")}
            style={buttonStyle}
          >
            일정표
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
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>
            단계 추가
          </h2>

          <p
            style={{
              margin: "8px 0 0",
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: 1.6,
            }}
          >
            정렬 순서가 낮을수록 진행도 표에서 왼쪽에 표시됩니다. 보통 10 단위로
            입력하면 중간에 단계를 추가하기 쉽습니다.
          </p>

          <div
            style={{
              marginTop: "16px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            <div>
              <label style={labelStyle}>단계 이름</label>

              <input
                value={form.step_name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    step_name: event.target.value,
                  })
                }
                placeholder="예: 검수중"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>정렬 순서</label>

              <input
                type="number"
                value={form.sort_order}
                onChange={(event) =>
                  setForm({
                    ...form,
                    sort_order: event.target.value,
                  })
                }
                placeholder="예: 70"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <button
              type="button"
              onClick={createStep}
              disabled={creating}
              style={{
                border: "none",
                borderRadius: "10px",
                background: "#111827",
                color: "#ffffff",
                padding: "11px 14px",
                fontSize: "13px",
                fontWeight: 900,
                opacity: creating ? 0.6 : 1,
              }}
            >
              {creating ? "추가 중..." : "단계 추가"}
            </button>
          </div>
        </div>

        {editingStep && (
          <div style={{ ...cardStyle, marginTop: "20px" }}>
            <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>
              단계 수정
            </h2>

            <div
              style={{
                marginTop: "16px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
              }}
            >
              <div>
                <label style={labelStyle}>단계 이름</label>

                <input
                  value={editingStep.step_name}
                  onChange={(event) =>
                    setEditingStep({
                      ...editingStep,
                      step_name: event.target.value,
                    })
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>정렬 순서</label>

                <input
                  type="number"
                  value={editingStep.sort_order}
                  onChange={(event) =>
                    setEditingStep({
                      ...editingStep,
                      sort_order: event.target.value,
                    })
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>상태</label>

                <select
                  value={editingStep.is_active ? "ACTIVE" : "INACTIVE"}
                  onChange={(event) =>
                    setEditingStep({
                      ...editingStep,
                      is_active: event.target.value === "ACTIVE",
                    })
                  }
                  style={inputStyle}
                >
                  <option value="ACTIVE">활성</option>
                  <option value="INACTIVE">비활성</option>
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
                onClick={saveStep}
                disabled={saving}
                style={{
                  border: "none",
                  borderRadius: "10px",
                  background: "#111827",
                  color: "#ffffff",
                  padding: "11px 14px",
                  fontSize: "13px",
                  fontWeight: 900,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "저장 중..." : "저장"}
              </button>

              <button
                type="button"
                onClick={cancelEditStep}
                disabled={saving}
                style={buttonStyle}
              >
                취소
              </button>
            </div>
          </div>
        )}

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
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>
                진행도 단계 목록
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                비활성 단계는 일정표의 진행도 현황판에서 숨겨집니다. 기존 체크
                기록은 삭제되지 않습니다.
              </p>
            </div>

            <button
              type="button"
              onClick={loadSteps}
              disabled={stepsLoading}
              style={{
                ...buttonStyle,
                opacity: stepsLoading ? 0.6 : 1,
              }}
            >
              {stepsLoading ? "새로고침 중..." : "새로고침"}
            </button>
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
                minWidth: "820px",
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["단계 이름", "정렬 순서", "상태", "생성일", "수정일", "관리"].map(
                    (title) => (
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
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {steps.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: "18px",
                        textAlign: "center",
                        color: "#6b7280",
                        fontSize: "14px",
                      }}
                    >
                      등록된 진행도 단계가 없습니다.
                    </td>
                  </tr>
                ) : (
                  steps.map((step) => (
                    <tr key={step.id}>
                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          color: "#111827",
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {step.step_name}
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
                        {step.sort_order}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          color: step.is_active ? "#15803d" : "#dc2626",
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {step.is_active ? "활성" : "비활성"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#6b7280",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getDateTimeLabel(step.created_at)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#6b7280",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getDateTimeLabel(step.updated_at)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "14px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => startEditStep(step)}
                          style={buttonStyle}
                        >
                          수정
                        </button>
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
