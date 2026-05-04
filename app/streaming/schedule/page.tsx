"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Profile = {
  email: string;
  name: string;
  status: "ACTIVE" | "DISABLED" | "HIDDEN";
};

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
};

export default function StreamingSchedulePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("email, name, status")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
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

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    const days: CalendarDay[] = [];

    for (let index = 0; index < 42; index += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);

      days.push({
        date,
        isCurrentMonth: date.getMonth() === month,
      });
    }

    return days;
  }, [currentMonth]);

  function moveMonth(offset: number) {
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(currentMonth.getMonth() + offset);
    setCurrentMonth(nextMonth);
  }

  function getMonthLabel() {
    return currentMonth.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
    });
  }

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

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          일정표를 불러오는 중입니다...
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800 }}>
            스트리밍 일정표
          </h1>

          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
            예정된 스트리밍과 작업 현황을 확인합니다.
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
          maxWidth: "1100px",
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "24px",
                  fontWeight: 800,
                  color: "#111827",
                }}
              >
                {getMonthLabel()}
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                아직 DB 일정은 연결하지 않았고, 다음 단계에서 관리자 일정 등록
                기능을 붙이면 이 달력에 표시됩니다.
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => moveMonth(-1)} style={buttonStyle}>
                이전 달
              </button>

              <button onClick={() => setCurrentMonth(new Date())} style={buttonStyle}>
                이번 달
              </button>

              <button onClick={() => moveMonth(1)} style={buttonStyle}>
                다음 달
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: "24px",
              overflowX: "auto",
            }}
          >
            <div
              style={{
                minWidth: "760px",
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                border: "1px solid #e5e7eb",
                borderRadius: "14px",
                overflow: "hidden",
              }}
            >
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <div
                  key={day}
                  style={{
                    padding: "12px",
                    background: "#f9fafb",
                    borderBottom: "1px solid #e5e7eb",
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "#6b7280",
                    textAlign: "center",
                  }}
                >
                  {day}
                </div>
              ))}

              {calendarDays.map((day) => (
                <div
                  key={day.date.toISOString()}
                  style={{
                    minHeight: "110px",
                    padding: "10px",
                    borderRight: "1px solid #f3f4f6",
                    borderBottom: "1px solid #f3f4f6",
                    background: day.isCurrentMonth ? "#ffffff" : "#f9fafb",
                    color: day.isCurrentMonth ? "#111827" : "#9ca3af",
                    boxSizing: "border-box",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      fontWeight: 800,
                    }}
                  >
                    {day.date.getDate()}
                  </p>

                  {day.isCurrentMonth && (
                    <div
                      style={{
                        marginTop: "10px",
                        borderRadius: "10px",
                        background: "#f3f4f6",
                        padding: "8px",
                        fontSize: "12px",
                        color: "#6b7280",
                        lineHeight: 1.4,
                      }}
                    >
                      일정 없음
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
