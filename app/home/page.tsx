"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type UserRole = "USER" | "ADMIN" | "SUPER_USER";
type UserStatus = "ACTIVE" | "DISABLED" | "HIDDEN";

type Profile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  pro_until: string | null;
};

type HomeNotice = {
  id: string;
  content: string;
  created_at: string;
};

type HomeChatMessage = {
  id: string;
  content: string;
  created_at: string;
};

type HomeScheduleEvent = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  week_name: string | null;
  teacher_name: string | null;
};

const WEB_VERSION =
  process.env.NEXT_PUBLIC_MOONMOON_WEB_VERSION || "v1.0.0";

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
  borderRadius: "14px",
  background: "#ffffff",
  color: "#111827",
  padding: "14px 16px",
  fontSize: "14px",
  fontWeight: 900,
  textAlign: "left" as const,
};

const disabledButtonStyle = {
  ...buttonStyle,
  color: "#9ca3af",
  background: "#f9fafb",
  cursor: "not-allowed",
};

export default function HomePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentNotice, setRecentNotice] = useState<HomeNotice | null>(null);
  const [recentChatMessage, setRecentChatMessage] =
    useState<HomeChatMessage | null>(null);
  const [todayEvents, setTodayEvents] = useState<HomeScheduleEvent[]>([]);

  const [statusMessageIndex, setStatusMessageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [noticeLoading, setNoticeLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadHome();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStatusMessageIndex((current) => current + 1);
    }, 3500);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  async function loadHome() {
    setLoading(true);
    setErrorMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, name, role, status, pro_until")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profileData) {
      setErrorMessage("사용자 정보를 불러오지 못했습니다.");
      setLoading(false);
      return;
    }

    const nextProfile = profileData as Profile;

    if (nextProfile.status !== "ACTIVE") {
      await supabase.auth.signOut();
      router.push("/");
      return;
    }

    setProfile(nextProfile);
    setLoading(false);

    await Promise.all([
      loadRecentNotice(),
      loadRecentChatMessage(),
      loadTodayScheduleEvents(),
    ]);
  }

  async function loadRecentNotice() {
    setNoticeLoading(true);

    const since = new Date();
    since.setHours(since.getHours() - 72);

    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, content, created_at")
      .eq("is_notice", true)
      .eq("is_deleted", false)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    setNoticeLoading(false);

    if (error) {
      setRecentNotice(null);
      return;
    }

    setRecentNotice(((data ?? [])[0] as HomeNotice) ?? null);
  }

  async function loadRecentChatMessage() {
    const since = new Date();
    since.setHours(since.getHours() - 72);

    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, content, created_at")
      .eq("is_deleted", false)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      setRecentChatMessage(null);
      return;
    }

    setRecentChatMessage(((data ?? [])[0] as HomeChatMessage) ?? null);
  }

  async function loadTodayScheduleEvents() {
    const today = getTodayDateText();

    const { data, error } = await supabase
      .from("streaming_schedule_events")
      .select("id, title, event_date, event_time, week_name, teacher_name")
      .eq("event_date", today)
      .order("event_time", { ascending: true });

    if (error) {
      setTodayEvents([]);
      return;
    }

    setTodayEvents((data ?? []) as HomeScheduleEvent[]);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function hasAdminAccess() {
    return profile?.role === "ADMIN" || profile?.role === "SUPER_USER";
  }

  function hasSuperUserAccess() {
    return profile?.role === "SUPER_USER";
  }

  function hasActivePro() {
    if (!profile?.pro_until) {
      return false;
    }

    return new Date(profile.pro_until).getTime() > Date.now();
  }

  function getRoleLabel() {
    if (profile?.role === "SUPER_USER") return "슈퍼 유저";
    if (profile?.role === "ADMIN") return "관리자";
    return "일반 사용자";
  }

  function getProLabel() {
    if (!profile?.pro_until) {
      return "일반 등급";
    }

    const proUntilDate = new Date(profile.pro_until);

    if (proUntilDate.getTime() <= Date.now()) {
      return "일반 등급";
    }

    return `Pro · ${proUntilDate.toLocaleDateString("ko-KR")}까지`;
  }

  function getTodayDateText() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getTodayScheduleMessage() {
    if (todayEvents.length === 0) {
      return "오늘 예정된 일정이 없습니다.";
    }

    if (todayEvents.length === 1) {
      const event = todayEvents[0];
      const prefix = event.event_time ? `${event.event_time} ` : "";
      return `오늘 ${prefix}${event.title} 일정이 있습니다.`;
    }

    return `오늘 예정된 일정이 ${todayEvents.length}개 있습니다.`;
  }

  function getRecentNoticeMessage() {
    if (!recentNotice) {
      return "";
    }

    return "최근 공지가 등록되었습니다.";
  }

  function getRecentChatMessageText() {
    if (!recentChatMessage) {
      return "";
    }

    return "커뮤니티에 새 이야기가 올라왔습니다.";
  }

  const statusMessages = useMemo(() => {
    const messages = [
      getTodayScheduleMessage(),
      getRecentNoticeMessage(),
      getRecentChatMessageText(),
      `Moonmoon Archive Web ${WEB_VERSION}`,
    ].filter(Boolean);

    if (messages.length === 0) {
      return [`Moonmoon Archive Web ${WEB_VERSION}`];
    }

    return messages;
  }, [todayEvents, recentNotice, recentChatMessage]);

  const currentStatusMessage =
    statusMessages[statusMessageIndex % statusMessages.length];

  if (loading) {
    return (
      <main style={centerStyle}>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          홈 화면을 불러오는 중입니다...
        </p>
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
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          boxSizing: "border-box",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 900,
              color: "#111827",
            }}
          >
            Moonmoon Archive
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            스트리밍, 일정표, 커뮤니티를 이용합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={signOut}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "10px",
            background: "#ffffff",
            color: "#111827",
            padding: "9px 12px",
            fontSize: "13px",
            fontWeight: 800,
          }}
        >
          로그아웃
        </button>
      </header>

      <section
        style={{
          maxWidth: "1040px",
          margin: "0 auto",
          padding: "28px 20px",
          boxSizing: "border-box",
        }}
      >
        <div style={cardStyle}>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "#6b7280",
              fontWeight: 700,
            }}
          >
            {getRoleLabel()} · {getProLabel()}
          </p>

          <h2
            style={{
              margin: "8px 0 0",
              fontSize: "30px",
              fontWeight: 900,
              color: "#111827",
              lineHeight: 1.35,
              wordBreak: "break-word",
            }}
          >
            {profile?.name}님, 환영합니다.
          </h2>

          <div
            style={{
              marginTop: "12px",
              borderRadius: "14px",
              background: "#f3f4f6",
              padding: "12px 14px",
              color: "#6b7280",
              fontSize: "14px",
              lineHeight: 1.5,
              minHeight: "44px",
              display: "flex",
              alignItems: "center",
            }}
          >
            {noticeLoading ? "상태 문구를 불러오는 중입니다." : currentStatusMessage}
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
        </div>

        <div
          style={{
            marginTop: "20px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/streaming")}
            disabled={!hasActivePro()}
            style={hasActivePro() ? buttonStyle : disabledButtonStyle}
          >
            <div style={{ fontSize: "15px", fontWeight: 900 }}>
              스트리밍 보기
            </div>

            <div
              style={{
                marginTop: "6px",
                fontSize: "12px",
                color: hasActivePro() ? "#6b7280" : "#9ca3af",
                lineHeight: 1.5,
              }}
            >
              {hasActivePro()
                ? "권한이 있는 영상을 시청합니다."
                : "Pro 권한이 필요합니다."}
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push("/streaming/schedule")}
            style={buttonStyle}
          >
            <div style={{ fontSize: "15px", fontWeight: 900 }}>일정표</div>

            <div
              style={{
                marginTop: "6px",
                fontSize: "12px",
                color: "#6b7280",
                lineHeight: 1.5,
              }}
            >
              날짜별 일정과 주차별 진행도를 확인합니다.
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push("/chat")}
            style={buttonStyle}
          >
            <div style={{ fontSize: "15px", fontWeight: 900 }}>커뮤니티</div>

            <div
              style={{
                marginTop: "6px",
                fontSize: "12px",
                color: "#6b7280",
                lineHeight: 1.5,
              }}
            >
              전체 채팅과 공지를 확인합니다.
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push("/serial-key")}
            style={buttonStyle}
          >
            <div style={{ fontSize: "15px", fontWeight: 900 }}>
              시리얼키 등록
            </div>

            <div
              style={{
                marginTop: "6px",
                fontSize: "12px",
                color: "#6b7280",
                lineHeight: 1.5,
              }}
            >
              Pro 시리얼키를 등록합니다.
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push("/account")}
            style={buttonStyle}
          >
            <div style={{ fontSize: "15px", fontWeight: 900 }}>계정 설정</div>

            <div
              style={{
                marginTop: "6px",
                fontSize: "12px",
                color: "#6b7280",
                lineHeight: 1.5,
              }}
            >
              계정 정보와 채팅 프로필 색상을 관리합니다.
            </div>
          </button>

          {hasAdminAccess() && (
            <button
              type="button"
              onClick={() => router.push("/admin")}
              style={buttonStyle}
            >
              <div style={{ fontSize: "15px", fontWeight: 900 }}>
                관리자 페이지
              </div>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "12px",
                  color: "#6b7280",
                  lineHeight: 1.5,
                }}
              >
                사용자, 영상, 일정, 로그를 관리합니다.
              </div>
            </button>
          )}

          {hasSuperUserAccess() && (
            <button
              type="button"
              onClick={() => router.push("/admin/streaming-source")}
              style={{
                ...buttonStyle,
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
              }}
            >
              <div style={{ fontSize: "15px", fontWeight: 900 }}>
                스트리밍 소스 관리
              </div>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "12px",
                  color: "#2563eb",
                  lineHeight: 1.5,
                }}
              >
                WebDAV 스캔과 소스 등록을 관리합니다.
              </div>
            </button>
          )}
        </div>

        <div
          style={{
            ...cardStyle,
            marginTop: "20px",
            padding: "18px",
            background: "#f9fafb",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "17px",
              fontWeight: 900,
              color: "#111827",
            }}
          >
            현재 상태
          </h3>

          <div
            style={{
              marginTop: "12px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "10px",
            }}
          >
            <StatusBox
              label="오늘 일정"
              value={
                todayEvents.length > 0
                  ? `${todayEvents.length}개`
                  : "예정 없음"
              }
            />

            <StatusBox
              label="최근 공지"
              value={recentNotice ? "있음" : "없음"}
            />

            <StatusBox
              label="최근 커뮤니티"
              value={recentChatMessage ? "새 글 있음" : "새 글 없음"}
            />

            <StatusBox label="웹 버전" value={WEB_VERSION} />
          </div>
        </div>
      </section>
    </main>
  );
}

function StatusBox({ label, value }: { label: string; value: string }) {
  return (
    <div
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
          fontSize: "12px",
          color: "#6b7280",
          fontWeight: 800,
        }}
      >
        {label}
      </p>

      <p
        style={{
          margin: "6px 0 0",
          fontSize: "15px",
          color: "#111827",
          fontWeight: 900,
        }}
      >
        {value}
      </p>
    </div>
  );
}
