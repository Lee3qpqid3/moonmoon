"use client";

import { useEffect, useMemo, useState } from "react";
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

type ChatAnnouncement = {
  announcement_id: string;
  message_id: string;
  message_content: string;
  message_user_id: string;
  message_user_name: string;
  message_user_email: string;
  announced_by: string | null;
  announcer_name: string | null;
  announcer_email: string | null;
  announced_at: string;
  message_created_at: string;
};

type ChatMessage = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  chat_color_theme: string | null;
  content: string | null;
  is_deleted: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

type StreamingSchedule = {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  status: string;
  linked_folder_id: string | null;
  linked_item_id: string | null;
  created_at: string;
};

export default function HomePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentAnnouncement, setRecentAnnouncement] =
    useState<ChatAnnouncement | null>(null);
  const [recentMessages, setRecentMessages] = useState<ChatMessage[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<StreamingSchedule[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusIndex, setStatusIndex] = useState(0);
  const [streamingBlockedMessage, setStreamingBlockedMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStatusIndex((current) => current + 1);
    }, 3500);

    return () => window.clearInterval(timer);
  }, []);

  async function loadPage() {
    const currentProfile = await loadProfile();

    if (!currentProfile) {
      return;
    }

    await Promise.all([loadRecentAnnouncement(), loadRecentMessages(), loadTodaySchedules()]);
  }

  async function loadProfile() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session || !session.user.email) {
      router.push("/");
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("email, name, role, status, pro_until")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      setErrorMessage("사용자 프로필을 찾을 수 없습니다. 관리자에게 문의하세요.");
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

  async function loadRecentAnnouncement() {
    const { data, error } = await supabase.rpc("get_active_chat_announcements");

    if (error) {
      setRecentAnnouncement(null);
      return;
    }

    const announcements = (data ?? []) as ChatAnnouncement[];
    const now = Date.now();
    const seventyTwoHoursMs = 1000 * 60 * 60 * 72;

    const recentAnnouncements = announcements.filter((announcement) => {
      const announcedTime = new Date(announcement.announced_at).getTime();
      return now - announcedTime <= seventyTwoHoursMs;
    });

    if (recentAnnouncements.length === 0) {
      setRecentAnnouncement(null);
      return;
    }

    setRecentAnnouncement(recentAnnouncements[recentAnnouncements.length - 1]);
  }

  async function loadRecentMessages() {
    const { data, error } = await supabase.rpc("get_chat_messages", {
      message_limit: 20,
    });

    if (error) {
      setRecentMessages([]);
      return;
    }

    const messages = ((data ?? []) as ChatMessage[])
      .filter((message) => !message.is_deleted && message.content)
      .slice(-3)
      .reverse();

    setRecentMessages(messages);
  }

  async function loadTodaySchedules() {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const { data, error } = await supabase.rpc("get_streaming_schedules", {
      start_at: start.toISOString(),
      end_at: end.toISOString(),
    });

    if (error) {
      setTodaySchedules([]);
      return;
    }

    setTodaySchedules((data ?? []) as StreamingSchedule[]);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function hasActivePro() {
    if (!profile?.pro_until) {
      return false;
    }

    return new Date(profile.pro_until).getTime() > Date.now();
  }

  function handleStreamingClick() {
    setStreamingBlockedMessage("");

    if (!hasActivePro()) {
      setStreamingBlockedMessage(
        "스트리밍 보기는 Pro 기간이 활성화된 계정만 이용할 수 있습니다."
      );

      window.setTimeout(() => {
        setStreamingBlockedMessage("");
      }, 2500);

      return;
    }

    router.push("/streaming");
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

  function getProRemainingText() {
    if (!profile?.pro_until) {
      return "Pro 사용권이 등록되어 있지 않습니다.";
    }

    const proUntilDate = new Date(profile.pro_until);
    const now = new Date();

    if (proUntilDate <= now) {
      return "Pro 기간이 만료되었습니다.";
    }

    const diffMs = proUntilDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );

    if (diffDays > 0) {
      return `Pro 만료까지 약 ${diffDays}일 ${diffHours}시간 남았습니다.`;
    }

    return `Pro 만료까지 약 ${diffHours}시간 남았습니다.`;
  }

  function getRecentChatText() {
    if (recentMessages.length === 0) {
      return "커뮤니티에 최근 메시지가 없습니다.";
    }

    return "커뮤니티에 최근 메시지가 올라왔습니다.";
  }

  function getAnnouncementText() {
    if (!recentAnnouncement) {
      return "최근 72시간 내 등록된 공지가 없습니다.";
    }

    return "최근 72시간 내 등록된 공지가 있습니다.";
  }

  function getScheduleText() {
    if (todaySchedules.length === 0) {
      return "오늘 예정된 스트리밍 일정이 없습니다.";
    }

    if (todaySchedules.length === 1) {
      return `오늘 예정된 스트리밍 일정이 1개 있습니다.`;
    }

    return `오늘 예정된 스트리밍 일정이 ${todaySchedules.length}개 있습니다.`;
  }

  const rotatingStatusMessages = useMemo(() => {
    const messages = [
      getScheduleText(),
      getAnnouncementText(),
      getRecentChatText(),
      getProRemainingText(),
    ];

    return messages.filter(Boolean);
  }, [todaySchedules.length, recentAnnouncement, recentMessages.length, profile?.pro_until]);

  const currentStatusMessage =
    rotatingStatusMessages.length > 0
      ? rotatingStatusMessages[statusIndex % rotatingStatusMessages.length]
      : "오늘 확인할 새 소식이 없습니다.";

  const pageStyle = {
    minHeight: "100dvh",
    background: "#ffffff",
    fontFamily: "Arial, sans-serif",
  };

  const menuButtonStyle = {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: "14px",
    background: "#ffffff",
    color: "#111827",
    padding: "16px",
    fontSize: "14px",
    fontWeight: 800,
    textAlign: "left" as const,
    boxShadow: "0 6px 18px rgba(0,0,0,0.025)",
  };

  const disabledMenuButtonStyle = {
    ...menuButtonStyle,
    color: "#9ca3af",
    background: "#f9fafb",
    cursor: "not-allowed",
  };

  const superMenuButtonStyle = {
    ...menuButtonStyle,
    border: "1px solid #111827",
  };

  const smallTextStyle = {
    margin: "6px 0 0",
    fontSize: "12px",
    color: "#6b7280",
    lineHeight: 1.5,
    fontWeight: 400,
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
          로그인 정보를 확인하는 중입니다...
        </p>
      </main>
    );
  }

  if (errorMessage && !profile) {
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
          padding: "20px",
          boxSizing: "border-box",
        }}
      >
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
            프로필 오류
          </h1>

          <p
            style={{
              marginTop: "12px",
              fontSize: "14px",
              color: "#7f1d1d",
              lineHeight: 1.6,
            }}
          >
            {errorMessage}
          </p>

          <button
            onClick={handleLogout}
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
            로그인 화면으로 돌아가기
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
            Moonmoon Archive
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            비공개 스트리밍 아카이브
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
          maxWidth: "1040px",
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
          <h2
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 800,
              color: "#111827",
            }}
          >
            {profile?.name}님, 환영합니다.
          </h2>

          <p
            style={{
              marginTop: "10px",
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: 1.6,
              minHeight: "22px",
            }}
          >
            {currentStatusMessage}
          </p>

          {streamingBlockedMessage && (
            <div
              style={{
                marginTop: "16px",
                border: "1px solid #fde68a",
                borderRadius: "14px",
                background: "#fffbeb",
                padding: "12px",
                color: "#92400e",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              {streamingBlockedMessage}
            </div>
          )}

          <div
            style={{
              marginTop: "22px",
              borderRadius: "14px",
              background: "#f9fafb",
              padding: "18px",
            }}
          >
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
              현재 계정
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
              {profile?.email}
            </p>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "13px",
                color: "#6b7280",
                lineHeight: 1.6,
              }}
            >
              {profile ? getRoleLabel(profile.role) : "-"} ·{" "}
              {profile?.pro_until &&
              new Date(profile.pro_until).getTime() > Date.now()
                ? `Pro 만료: ${getDateTimeLabel(profile.pro_until)}`
                : "일반 등급"}
            </p>
          </div>

          <div
            style={{
              marginTop: "24px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={handleStreamingClick}
              style={hasActivePro() ? menuButtonStyle : disabledMenuButtonStyle}
            >
              스트리밍 보기
              <p style={smallTextStyle}>
                {hasActivePro()
                  ? "Pro 권한으로 영상과 자료를 탐색합니다."
                  : "Pro 권한이 있어야 스트리밍을 볼 수 있습니다."}
              </p>
            </button>

            <button
              type="button"
              onClick={() => router.push("/streaming/schedule")}
              style={menuButtonStyle}
            >
              스트리밍 일정표
              <p style={smallTextStyle}>
                달력에서 예정된 스트리밍과 작업 현황을 확인합니다.
              </p>
            </button>

            <button
              type="button"
              onClick={() => router.push("/chat")}
              style={menuButtonStyle}
            >
              커뮤니티
              <p style={smallTextStyle}>
                모든 유저가 함께 사용하는 서버 채팅입니다.
              </p>
            </button>

            <button
              type="button"
              onClick={() => router.push("/serial-key")}
              style={menuButtonStyle}
            >
              시리얼키 등록
              <p style={smallTextStyle}>
                Pro 사용권을 등록하고 남은 기간을 확인합니다.
              </p>
            </button>

            <button
              type="button"
              onClick={() => router.push("/account")}
              style={menuButtonStyle}
            >
              계정 설정
              <p style={smallTextStyle}>
                비밀번호 변경과 커뮤니티 채팅 프로필 색상을 관리합니다.
              </p>
            </button>

            {(profile?.role === "ADMIN" || profile?.role === "SUPER_USER") && (
              <button
                type="button"
                onClick={() => router.push("/admin")}
                style={
                  profile.role === "SUPER_USER"
                    ? superMenuButtonStyle
                    : menuButtonStyle
                }
              >
                관리자 페이지
                <p style={smallTextStyle}>
                  사용자, 시리얼키, 채팅 로그와 서비스 설정을 관리합니다.
                </p>
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
