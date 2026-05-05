"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";
type UserStatus = "ACTIVE" | "DISABLED" | "HIDDEN";

type Profile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
};

type CalendarEventStatus = "SCHEDULED" | "IN_PROGRESS" | "DONE" | "CANCELED";

type CalendarEvent = {
  id: string;
  week_name: string;
  teacher_name: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  status: CalendarEventStatus;
  created_at: string;
  updated_at: string;
};

type ProgressStep = {
  id: string;
  step_name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ProgressBoardRow = {
  week_name: string;
  teacher_name: string;
  step_id: string;
  step_name: string;
  sort_order: number;
  is_checked: boolean;
  checked_at: string | null;
};

type EventForm = {
  id: string | null;
  week_name: string;
  teacher_name: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  status: CalendarEventStatus;
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

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getCalendarGridDays(targetMonth: Date) {
  const start = getMonthStart(targetMonth);
  const end = getMonthEnd(targetMonth);

  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - start.getDay());

  const gridEnd = new Date(end);
  gridEnd.setDate(end.getDate() + (6 - end.getDay()));

  const days: Date[] = [];
  const current = new Date(gridStart);

  while (current <= gridEnd) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export default function StreamingSchedulePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [progressRows, setProgressRows] = useState<ProgressBoardRow[]>([]);

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(getDateKey(new Date()));
  const [selectedWeekFilter, setSelectedWeekFilter] = useState("");

  const [eventForm, setEventForm] = useState<EventForm>({
    id: null,
    week_name: "",
    teacher_name: "",
    title: "",
    description: "",
    event_date: getDateKey(new Date()),
    event_time: "",
    status: "SCHEDULED",
  });

  const [showEventForm, setShowEventForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState("");
  const [checkingKey, setCheckingKey] = useState("");
  const [denied, setDenied] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (!loading && !denied) {
      loadMonthEvents();
    }
  }, [currentMonth]);

  async function loadPage() {
    const currentProfile = await loadProfile();

    if (!currentProfile) {
      return;
    }

    await Promise.all([loadMonthEvents(), loadProgressData()]);
  }

  async function loadProfile() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/");
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, name, role, status")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      setDenied(true);
      setLoading(false);
      return null;
    }

    if (data.status !== "ACTIVE") {
      await supabase.auth.signOut();
      router.push("/");
      return null;
    }

    const nextProfile = data as Profile;

    setProfile(nextProfile);
    setLoading(false);

    return nextProfile;
  }

  async function loadMonthEvents() {
    setEventsLoading(true);
    setErrorMessage("");

    const start = getMonthStart(currentMonth);
    const end = getMonthEnd(currentMonth);

    const { data, error } = await supabase.rpc("get_streaming_calendar_events", {
      start_date: getDateKey(start),
      end_date: getDateKey(end),
    });

    setEventsLoading(false);

    if (error) {
      setErrorMessage(error.message || "일정을 불러오지 못했습니다.");
      setEvents([]);
      return;
    }

    setEvents((data ?? []) as CalendarEvent[]);
  }

  async function loadProgressData() {
    setProgressLoading(true);
    setErrorMessage("");

    const [stepsResult, boardResult] = await Promise.all([
      supabase.rpc("get_streaming_progress_steps"),
      supabase.rpc("get_streaming_progress_board"),
    ]);

    setProgressLoading(false);

    if (stepsResult.error) {
      setErrorMessage(
        stepsResult.error.message || "진행도 단계를 불러오지 못했습니다."
      );
      setProgressSteps([]);
      return;
    }

    if (boardResult.error) {
      setErrorMessage(
        boardResult.error.message || "진행도 현황을 불러오지 못했습니다."
      );
      setProgressRows([]);
      return;
    }

    setProgressSteps((stepsResult.data ?? []) as ProgressStep[]);
    setProgressRows((boardResult.data ?? []) as ProgressBoardRow[]);
  }

  function isAdmin() {
    return profile?.role === "ADMIN" || profile?.role === "SUPER_USER";
  }

  function openCreateForm(dateKey: string) {
    setSelectedDate(dateKey);

    if (!isAdmin()) {
      return;
    }

    setEventForm({
      id: null,
      week_name: "",
      teacher_name: "",
      title: "",
      description: "",
      event_date: dateKey,
      event_time: "",
      status: "SCHEDULED",
    });

    setShowEventForm(true);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function openEditForm(event: CalendarEvent) {
    if (!isAdmin()) {
      return;
    }

    setSelectedDate(event.event_date);
    setEventForm({
      id: event.id,
      week_name: event.week_name,
      teacher_name: event.teacher_name,
      title: event.title,
      description: event.description ?? "",
      event_date: event.event_date,
      event_time: event.event_time ? event.event_time.slice(0, 5) : "",
      status: event.status,
    });

    setShowEventForm(true);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeEventForm() {
    setShowEventForm(false);
    setEventForm({
      id: null,
      week_name: "",
      teacher_name: "",
      title: "",
      description: "",
      event_date: selectedDate,
      event_time: "",
      status: "SCHEDULED",
    });
  }

  async function saveEvent() {
    if (!isAdmin()) {
      setErrorMessage("관리자 권한이 필요합니다.");
      return;
    }

    if (!eventForm.week_name.trim()) {
      setErrorMessage("주차를 입력해야 합니다.");
      return;
    }

    if (!eventForm.teacher_name.trim()) {
      setErrorMessage("강사명을 입력해야 합니다.");
      return;
    }

    if (!eventForm.title.trim()) {
      setErrorMessage("일정 제목을 입력해야 합니다.");
      return;
    }

    setSavingEvent(true);
    setErrorMessage("");
    setSuccessMessage("");

    const payload = {
      target_week_name: eventForm.week_name.trim(),
      target_teacher_name: eventForm.teacher_name.trim(),
      target_title: eventForm.title.trim(),
      target_description: eventForm.description.trim(),
      target_event_date: eventForm.event_date,
      target_event_time: eventForm.event_time || null,
      target_status: eventForm.status,
    };

    const result = eventForm.id
      ? await supabase.rpc("admin_update_streaming_calendar_event", {
          target_event_id: eventForm.id,
          ...payload,
        })
      : await supabase.rpc("admin_create_streaming_calendar_event", payload);

    setSavingEvent(false);

    if (result.error) {
      setErrorMessage(result.error.message || "일정을 저장하지 못했습니다.");
      return;
    }

    setSuccessMessage(eventForm.id ? "일정이 수정되었습니다." : "일정이 추가되었습니다.");
    closeEventForm();
    await Promise.all([loadMonthEvents(), loadProgressData()]);
  }

  async function deleteEvent(event: CalendarEvent) {
    if (!isAdmin()) {
      setErrorMessage("관리자 권한이 필요합니다.");
      return;
    }

    const confirmed = window.confirm("이 일정을 삭제할까요?");

    if (!confirmed) {
      return;
    }

    setDeletingEventId(event.id);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc("admin_delete_streaming_calendar_event", {
      target_event_id: event.id,
    });

    setDeletingEventId("");

    if (error) {
      setErrorMessage(error.message || "일정을 삭제하지 못했습니다.");
      return;
    }

    setSuccessMessage("일정이 삭제되었습니다.");
    await loadMonthEvents();
  }

  async function toggleProgress(row: ProgressBoardRow) {
    if (!isAdmin()) {
      setErrorMessage("관리자 권한이 필요합니다.");
      return;
    }

    const key = `${row.week_name}-${row.teacher_name}-${row.step_id}`;
    setCheckingKey(key);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc("admin_set_streaming_progress_checked", {
      target_week_name: row.week_name,
      target_teacher_name: row.teacher_name,
      target_step_id: row.step_id,
      target_is_checked: !row.is_checked,
    });

    setCheckingKey("");

    if (error) {
      setErrorMessage(error.message || "진행도를 저장하지 못했습니다.");
      return;
    }

    await loadProgressData();
  }

  function moveMonth(delta: number) {
    const next = new Date(currentMonth);
    next.setMonth(currentMonth.getMonth() + delta);
    setCurrentMonth(next);
  }

  function goToday() {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(getDateKey(today));
  }

  function getStatusLabel(status: CalendarEventStatus) {
    if (status === "IN_PROGRESS") return "진행중";
    if (status === "DONE") return "완료";
    if (status === "CANCELED") return "취소";
    return "예정";
  }

  function getStatusColor(status: CalendarEventStatus) {
    if (status === "IN_PROGRESS") return "#2563eb";
    if (status === "DONE") return "#15803d";
    if (status === "CANCELED") return "#dc2626";
    return "#6b7280";
  }

  function getTimeLabel(time: string | null) {
    if (!time) {
      return "";
    }

    const [hourText, minuteText] = time.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const period = hour >= 12 ? "오후" : "오전";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;

    return `${period} ${String(displayHour).padStart(2, "0")}:${String(
      minute
    ).padStart(2, "0")}`;
  }

  const calendarDays = useMemo(
    () => getCalendarGridDays(currentMonth),
    [currentMonth]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      const list = map.get(event.event_date) ?? [];
      list.push(event);
      map.set(event.event_date, list);
    }

    for (const [key, list] of map.entries()) {
      map.set(
        key,
        list.sort((a, b) => {
          const aTime = a.event_time ?? "99:99";
          const bTime = b.event_time ?? "99:99";
          return aTime.localeCompare(bTime);
        })
      );
    }

    return map;
  }, [events]);

  const selectedDateEvents = eventsByDate.get(selectedDate) ?? [];

  const progressGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        week_name: string;
        teacher_name: string;
        steps: ProgressBoardRow[];
      }
    >();

    for (const row of progressRows) {
      if (selectedWeekFilter && row.week_name !== selectedWeekFilter) {
        continue;
      }

      const key = `${row.week_name}__${row.teacher_name}`;
      const group =
        map.get(key) ??
        ({
          week_name: row.week_name,
          teacher_name: row.teacher_name,
          steps: [],
        } as {
          week_name: string;
          teacher_name: string;
          steps: ProgressBoardRow[];
        });

      group.steps.push(row);
      map.set(key, group);
    }

    return Array.from(map.values()).sort((a, b) => {
      const weekCompare = a.week_name.localeCompare(b.week_name, "ko-KR", {
        numeric: true,
      });

      if (weekCompare !== 0) return weekCompare;

      return a.teacher_name.localeCompare(b.teacher_name, "ko-KR", {
        numeric: true,
      });
    });
  }, [progressRows, selectedWeekFilter]);

  const progressWeekOptions = useMemo(() => {
    return Array.from(new Set(progressRows.map((row) => row.week_name))).sort(
      (a, b) => a.localeCompare(b, "ko-KR", { numeric: true })
    );
  }, [progressRows]);

  const monthTitle = `${currentMonth.getFullYear()}년 ${
    currentMonth.getMonth() + 1
  }월`;

  if (loading) {
    return (
      <main style={centerStyle}>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          일정표를 불러오는 중입니다...
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
            활성 상태의 계정만 일정표를 볼 수 있습니다.
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
            스트리밍 일정표
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            달력 일정과 주차별 작업 진행도를 확인합니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/streaming")} style={buttonStyle}>
            스트리밍 보기
          </button>

          <button onClick={() => router.push("/home")} style={buttonStyle}>
            홈
          </button>
        </div>
      </header>

      <section
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "28px 20px",
          boxSizing: "border-box",
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "16px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 900 }}>
                {monthTitle}
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                {isAdmin()
                  ? "날짜 칸을 클릭하면 해당 날짜에 일정을 추가할 수 있습니다."
                  : "등록된 스트리밍 일정을 확인할 수 있습니다."}
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" onClick={() => moveMonth(-1)} style={buttonStyle}>
                이전 달
              </button>

              <button type="button" onClick={goToday} style={buttonStyle}>
                오늘
              </button>

              <button type="button" onClick={() => moveMonth(1)} style={buttonStyle}>
                다음 달
              </button>

              <button
                type="button"
                onClick={() => Promise.all([loadMonthEvents(), loadProgressData()])}
                disabled={eventsLoading || progressLoading}
                style={{
                  ...buttonStyle,
                  opacity: eventsLoading || progressLoading ? 0.6 : 1,
                }}
              >
                {eventsLoading || progressLoading ? "새로고침 중..." : "새로고침"}
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
                lineHeight: 1.6,
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
                lineHeight: 1.6,
              }}
            >
              {successMessage}
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, marginTop: "20px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(120px, 1fr))",
              gap: "8px",
              overflowX: "auto",
            }}
          >
            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
              <div
                key={day}
                style={{
                  minWidth: "120px",
                  padding: "10px",
                  textAlign: "center",
                  fontSize: "13px",
                  fontWeight: 900,
                  color: day === "일" ? "#dc2626" : day === "토" ? "#2563eb" : "#6b7280",
                }}
              >
                {day}
              </div>
            ))}

            {calendarDays.map((day) => {
              const dateKey = getDateKey(day);
              const dayEvents = eventsByDate.get(dateKey) ?? [];
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isSelected = selectedDate === dateKey;
              const isToday = dateKey === getDateKey(new Date());

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => openCreateForm(dateKey)}
                  style={{
                    minWidth: "120px",
                    minHeight: "132px",
                    border: isSelected
                      ? "2px solid #111827"
                      : isToday
                        ? "1px solid #2563eb"
                        : "1px solid #e5e7eb",
                    borderRadius: "14px",
                    background: isCurrentMonth ? "#ffffff" : "#f9fafb",
                    padding: "10px",
                    textAlign: "left",
                    cursor: "pointer",
                    color: "#111827",
                    boxSizing: "border-box",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      fontWeight: 900,
                      color: isCurrentMonth ? "#111827" : "#9ca3af",
                    }}
                  >
                    {day.getDate()}
                  </p>

                  <div
                    style={{
                      marginTop: "8px",
                      display: "grid",
                      gap: "6px",
                    }}
                  >
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          openEditForm(event);
                        }}
                        style={{
                          borderRadius: "8px",
                          background: "#f3f4f6",
                          padding: "6px",
                          fontSize: "11px",
                          color: "#111827",
                          lineHeight: 1.35,
                        }}
                      >
                        <strong style={{ color: getStatusColor(event.status) }}>
                          {getStatusLabel(event.status)}
                        </strong>{" "}
                        {getTimeLabel(event.event_time)} {event.teacher_name}
                      </div>
                    ))}

                    {dayEvents.length > 3 && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: "11px",
                          color: "#6b7280",
                          fontWeight: 800,
                        }}
                      >
                        +{dayEvents.length - 3}개 더
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {showEventForm && isAdmin() && (
          <div style={{ ...cardStyle, marginTop: "20px" }}>
            <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>
              {eventForm.id ? "일정 수정" : "일정 추가"}
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
                <label style={labelStyle}>주차</label>
                <input
                  value={eventForm.week_name}
                  onChange={(event) =>
                    setEventForm({ ...eventForm, week_name: event.target.value })
                  }
                  placeholder="예: 16주차"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>강사명</label>
                <input
                  value={eventForm.teacher_name}
                  onChange={(event) =>
                    setEventForm({ ...eventForm, teacher_name: event.target.value })
                  }
                  placeholder="예: 강기원"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>제목</label>
                <input
                  value={eventForm.title}
                  onChange={(event) =>
                    setEventForm({ ...eventForm, title: event.target.value })
                  }
                  placeholder="예: 16주차 강기원"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>날짜</label>
                <input
                  type="date"
                  value={eventForm.event_date}
                  onChange={(event) =>
                    setEventForm({ ...eventForm, event_date: event.target.value })
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>시각</label>
                <input
                  type="time"
                  value={eventForm.event_time}
                  onChange={(event) =>
                    setEventForm({ ...eventForm, event_time: event.target.value })
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>상태</label>
                <select
                  value={eventForm.status}
                  onChange={(event) =>
                    setEventForm({
                      ...eventForm,
                      status: event.target.value as CalendarEventStatus,
                    })
                  }
                  style={inputStyle}
                >
                  <option value="SCHEDULED">예정</option>
                  <option value="IN_PROGRESS">진행중</option>
                  <option value="DONE">완료</option>
                  <option value="CANCELED">취소</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: "12px" }}>
              <label style={labelStyle}>설명</label>
              <textarea
                value={eventForm.description}
                onChange={(event) =>
                  setEventForm({ ...eventForm, description: event.target.value })
                }
                rows={3}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  lineHeight: 1.6,
                }}
              />
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
                onClick={saveEvent}
                disabled={savingEvent}
                style={{
                  border: "none",
                  borderRadius: "10px",
                  background: "#111827",
                  color: "#ffffff",
                  padding: "11px 14px",
                  fontSize: "13px",
                  fontWeight: 900,
                  opacity: savingEvent ? 0.6 : 1,
                }}
              >
                {savingEvent ? "저장 중..." : "저장"}
              </button>

              <button type="button" onClick={closeEventForm} style={buttonStyle}>
                취소
              </button>
            </div>
          </div>
        )}

        <div style={{ ...cardStyle, marginTop: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>
            {selectedDate} 일정
          </h2>

          <div style={{ marginTop: "14px", display: "grid", gap: "10px" }}>
            {selectedDateEvents.length === 0 ? (
              <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
                선택한 날짜에 등록된 일정이 없습니다.
              </p>
            ) : (
              selectedDateEvents.map((event) => (
                <div
                  key={event.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "14px",
                    padding: "14px",
                    background: "#ffffff",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: getStatusColor(event.status),
                      fontWeight: 900,
                    }}
                  >
                    {getStatusLabel(event.status)} · {getTimeLabel(event.event_time)}
                  </p>

                  <h3
                    style={{
                      margin: "6px 0 0",
                      fontSize: "17px",
                      fontWeight: 900,
                      color: "#111827",
                    }}
                  >
                    {event.title}
                  </h3>

                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: "13px",
                      color: "#6b7280",
                      lineHeight: 1.6,
                    }}
                  >
                    {event.week_name} · {event.teacher_name}
                  </p>

                  {event.description && (
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: "14px",
                        color: "#374151",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {event.description}
                    </p>
                  )}

                  {isAdmin() && (
                    <div
                      style={{
                        marginTop: "12px",
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openEditForm(event)}
                        style={buttonStyle}
                      >
                        수정
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteEvent(event)}
                        disabled={deletingEventId === event.id}
                        style={{
                          border: "1px solid #fecaca",
                          borderRadius: "10px",
                          background: "#ffffff",
                          color: "#dc2626",
                          padding: "9px 12px",
                          fontSize: "13px",
                          fontWeight: 800,
                          opacity: deletingEventId === event.id ? 0.6 : 1,
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
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
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>
                주차별 진행도
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                주차와 강사별 작업 단계를 확인합니다. 관리자는 체크 상태를 변경할 수 있습니다.
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <select
                value={selectedWeekFilter}
                onChange={(event) => setSelectedWeekFilter(event.target.value)}
                style={{
                  ...inputStyle,
                  width: "180px",
                }}
              >
                <option value="">전체 주차</option>
                {progressWeekOptions.map((weekName) => (
                  <option key={weekName} value={weekName}>
                    {weekName}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={loadProgressData}
                disabled={progressLoading}
                style={{
                  ...buttonStyle,
                  opacity: progressLoading ? 0.6 : 1,
                }}
              >
                진행도 새로고침
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
                minWidth: `${Math.max(720, 220 + progressSteps.length * 150)}px`,
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      fontSize: "13px",
                      color: "#6b7280",
                      borderBottom: "1px solid #e5e7eb",
                      whiteSpace: "nowrap",
                    }}
                  >
                    이름
                  </th>

                  {progressSteps
                    .filter((step) => step.is_active)
                    .map((step) => (
                      <th
                        key={step.id}
                        style={{
                          padding: "12px",
                          textAlign: "center",
                          fontSize: "13px",
                          color: "#6b7280",
                          borderBottom: "1px solid #e5e7eb",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {step.step_name}
                      </th>
                    ))}
                </tr>
              </thead>

              <tbody>
                {progressGroups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={progressSteps.length + 1}
                      style={{
                        padding: "18px",
                        textAlign: "center",
                        color: "#6b7280",
                        fontSize: "14px",
                      }}
                    >
                      표시할 진행도 항목이 없습니다. WebDAV 스캔 결과나 일정이 먼저 필요합니다.
                    </td>
                  </tr>
                ) : (
                  progressGroups.map((group) => (
                    <tr key={`${group.week_name}-${group.teacher_name}`}>
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
                        {group.week_name} · {group.teacher_name}
                      </td>

                      {progressSteps
                        .filter((step) => step.is_active)
                        .map((step) => {
                          const row = group.steps.find(
                            (item) => item.step_id === step.id
                          );

                          const key = `${group.week_name}-${group.teacher_name}-${step.id}`;

                          return (
                            <td
                              key={step.id}
                              style={{
                                padding: "12px",
                                borderBottom: "1px solid #f3f4f6",
                                textAlign: "center",
                              }}
                            >
                              {row ? (
                                <label
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px",
                                    fontSize: "13px",
                                    fontWeight: 800,
                                    color: row.is_checked ? "#15803d" : "#6b7280",
                                    cursor: isAdmin() ? "pointer" : "default",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={row.is_checked}
                                    disabled={!isAdmin() || checkingKey === key}
                                    onChange={() => toggleProgress(row)}
                                  />
                                  {checkingKey === key
                                    ? "저장 중"
                                    : row.is_checked
                                      ? "완료"
                                      : "대기"}
                                </label>
                              ) : (
                                "-"
                              )}
                            </td>
                          );
                        })}
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
