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

type EditingStep = {
  id: string;
  step_name: string;
  sort_order: string;
  is_active: boolean;
};

type CreateStepForm = {
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

export default function AdminProgressStepsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [editingStep, setEditingStep] = useState<EditingStep | null>(null);

  const [createForm, setCreateForm] = useState<CreateStepForm>({
    step_name: "",
    sort_order: "10",
    is_active: true,
  });

  const [loading, setLoading] = useState(true);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingStepId, setDeletingStepId] = useState("");
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

    const { data, error } = await supabase
      .from("streaming_progress_steps")
      .select("id, step_name, sort_order, is_active, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("step_name", { ascending: true });

    setStepsLoading(false);

    if (error) {
      setErrorMessage(error.message || "진행도 단계 목록을 불러오지 못했습니다.");
      setSteps([]);
      return;
    }

    setSteps((data ?? []) as ProgressStep[]);
  }

  async function createStep() {
    setErrorMessage("");
    setSuccessMessage("");

    const stepName = createForm.step_name.trim();
    const sortOrder = Number(createForm.sort_order);

    if (!stepName) {
      setErrorMessage("단계 이름을 입력해야 합니다.");
      return;
    }

    if (!Number.isFinite(sortOrder)) {
      setErrorMessage("정렬 순서는 숫자로 입력해야 합니다.");
      return;
    }

    setCreating(true);

    const { error } = await supabase.from("streaming_progress_steps").insert({
      step_name: stepName,
      sort_order: sortOrder,
      is_active: createForm.is_active,
    });

    setCreating(false);

    if (error) {
      setErrorMessage(error.message || "진행도 단계를 추가하지 못했습니다.");
      return;
    }

    setCreateForm({
      step_name: "",
      sort_order: String(sortOrder + 10),
      is_active: true,
    });
    setSuccessMessage("진행도 단계가 추가되었습니다.");
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
    if (!editingStep) return;

    setErrorMessage("");
    setSuccessMessage("");

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

    const { error } = await supabase
      .from("streaming_progress_steps")
      .update({
        step_name: stepName,
        sort_order: sortOrder,
        is_active: editingStep.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingStep.id);

    setSaving(false);

    if (error) {
      setErrorMessage(error.message || "진행도 단계를 저장하지 못했습니다.");
      return;
    }

    setEditingStep(null);
    setSuccessMessage("진행도 단계가 저장되었습니다.");
    await loadSteps();
  }

  async function deleteStep(step: ProgressStep) {
    setErrorMessage("");
    setSuccessMessage("");

    const confirmed = window.confirm(
      `"${step.step_name}" 단계를 삭제할까요?\n\n이 단계와 연결된 주차별 진행도 체크 데이터도 함께 삭제됩니다.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingStepId(step.id);

    const { error } = await supabase.rpc("admin_delete_streaming_progress_step", {
      target_step_id: step.id,
    });

    setDeletingStepId("");

    if (error) {
      setErrorMessage(error.message || "진행도 단계를 삭제하지 못했습니다.");
      return;
    }

    if (editingStep?.id === step.id) {
      setEditingStep(null);
    }

    setSuccessMessage("진행도 단계가 삭제되었습니다.");
    await loadSteps();
  }

  function getRoleLabel(role: UserRole) {
    if (role === "SUPER_USER") return "슈퍼 유저";
    if (role === "ADMIN") return "관리자";
    return "일반 사용자";
  }

  function getDateTimeLabel(value: string) {
    return new Date(value).toLocaleString("ko-KR", {
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
            관리자 권한이 있는 계정만 진행도 단계를 관리할 수 있습니다.
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
            일정표와 주차별 진행도 체크에 사용할 단계 목록을 관리합니다.
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
          maxWidth: "1080px",
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
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 900,
              color: "#111827",
            }}
          >
            진행도 단계 추가
          </h2>

          <p
            style={{
              margin: "8px 0 0",
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: 1.6,
            }}
          >
            예시는 녹화대기, 녹화중, 인코딩대기, 인코딩중, 업로드대기,
            업로드완료입니다.
          </p>

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
              <label style={labelStyle}>단계 이름</label>
              <input
                value={createForm.step_name}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    step_name: event.target.value,
                  })
                }
                placeholder="예: 녹화대기"
                style={inputStyle}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>정렬 순서</label>
              <input
                value={createForm.sort_order}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    sort_order: event.target.value,
                  })
                }
                inputMode="numeric"
                placeholder="예: 10"
                style={inputStyle}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>상태</label>
              <select
                value={createForm.is_active ? "ACTIVE" : "INACTIVE"}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    is_active: event.target.value === "ACTIVE",
                  })
                }
                style={inputStyle}
              >
                <option value="ACTIVE">사용</option>
                <option value="INACTIVE">비활성화</option>
              </select>
            </div>

            <button
              type="button"
              onClick={createStep}
              disabled={creating}
              style={{
                border: "none",
                borderRadius: "10px",
                background: "#111827",
                color: "#ffffff",
                padding: "12px",
                fontSize: "14px",
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
            <h2
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 900,
                color: "#111827",
              }}
            >
              진행도 단계 수정
            </h2>

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

              <div style={{ minWidth: 0 }}>
                <label style={labelStyle}>정렬 순서</label>
                <input
                  value={editingStep.sort_order}
                  onChange={(event) =>
                    setEditingStep({
                      ...editingStep,
                      sort_order: event.target.value,
                    })
                  }
                  inputMode="numeric"
                  style={inputStyle}
                />
              </div>

              <div style={{ minWidth: 0 }}>
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
                  <option value="ACTIVE">사용</option>
                  <option value="INACTIVE">비활성화</option>
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
              <h2
                style={{
                  margin: 0,
                  fontSize: "22px",
                  fontWeight: 900,
                  color: "#111827",
                }}
              >
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
                삭제 버튼을 누르면 해당 단계와 연결된 주차별 진행도 체크 데이터도
                함께 삭제됩니다.
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
                minWidth: "860px",
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["정렬", "단계 이름", "상태", "생성일", "수정일", "관리"].map(
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
                          fontSize: "13px",
                          color: "#111827",
                          fontWeight: 800,
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
                          fontSize: "13px",
                          color: step.is_active ? "#15803d" : "#dc2626",
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {step.is_active ? "사용" : "비활성화"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "12px",
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
                          fontSize: "12px",
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
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => startEditStep(step)}
                            disabled={deletingStepId === step.id}
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
                            onClick={() => deleteStep(step)}
                            disabled={deletingStepId === step.id}
                            style={{
                              border: "1px solid #fecaca",
                              borderRadius: "9px",
                              background: "#ffffff",
                              color: "#dc2626",
                              padding: "8px 10px",
                              fontSize: "12px",
                              fontWeight: 800,
                              opacity: deletingStepId === step.id ? 0.6 : 1,
                            }}
                          >
                            {deletingStepId === step.id ? "삭제 중..." : "삭제"}
                          </button>
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
