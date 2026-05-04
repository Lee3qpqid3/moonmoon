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

type WeatherState = {
  status: "idle" | "loading" | "success" | "denied" | "error";
  temperature: number | null;
  windSpeed: number | null;
  weatherCode: number | null;
  message: string;
};

export default function HomePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [announcement, setAnnouncement] = useState<ChatAnnouncement | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [weather, setWeather] = useState<WeatherState>({
    status: "idle",
    temperature: null,
    windSpeed: null,
    weatherCode: null,
    message: "위치 권한을 허용하면 현재 날씨를 확인할 수 있습니다.",
  });

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    await loadProfile();
    await loadRecentAnnouncement();
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

  async function loadRecentAnnouncement() {
    setAnnouncementLoading(true);

    const { data, error } = await supabase.rpc(
      "get_active_chat_announcements"
    );

    setAnnouncementLoading(false);

    if (error) {
      setAnnouncement(null);
      return;
    }

    const announcements = (data ?? []) as ChatAnnouncement[];

    if (announcements.length === 0) {
      setAnnouncement(null);
      return;
    }

    setAnnouncement(announcements[announcements.length - 1]);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
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

  function getProStatusText() {
    if (!profile?.pro_until) return "현재 일반 등급입니다.";

    const proUntilDate = new Date(profile.pro_until);
    const now = new Date();

    if (proUntilDate <= now) {
      return "Pro 기간이 만료되어 현재 일반 등급입니다.";
    }

    const diffMs = proUntilDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );

    if (diffDays > 0) {
      return `Pro 등급 사용 중 · 약 ${diffDays}일 ${diffHours}시간 남음`;
    }

    return `Pro 등급 사용 중 · 약 ${diffHours}시간 남음`;
  }

  function getProStatusDetail() {
    if (!profile?.pro_until) return "시리얼키를 등록하면 Pro 기간이 적용됩니다.";

    const proUntilDate = new Date(profile.pro_until);
    const now = new Date();

    if (proUntilDate <= now) {
      return "시리얼키 등록 페이지에서 새 Pro 사용권을 등록할 수 있습니다.";
    }

    return `만료 시각: ${getDateTimeLabel(profile.pro_until)}`;
  }

  function getTodayScheduleText() {
    return "오늘 등록된 스트리밍 일정은 아직 없습니다.";
  }

  function shortenText(text: string, maxLength = 86) {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  }

  function getWeatherLabel(code: number | null) {
    if (code === null) return "날씨 정보 없음";

    if (code === 0) return "맑음";
    if ([1, 2, 3].includes(code)) return "대체로 맑거나 구름 있음";
    if ([45, 48].includes(code)) return "안개";
    if ([51, 53, 55, 56, 57].includes(code)) return "이슬비";
    if ([61, 63, 65, 66, 67].includes(code)) return "비";
    if ([71, 73, 75, 77].includes(code)) return "눈";
    if ([80, 81, 82].includes(code)) return "소나기";
    if ([95, 96, 99].includes(code)) return "뇌우";

    return "날씨 정보 확인됨";
  }

  async function loadWeather() {
    if (!navigator.geolocation) {
      setWeather({
        status: "error",
        temperature: null,
        windSpeed: null,
        weatherCode: null,
        message: "이 브라우저에서는 위치 기반 날씨를 사용할 수 없습니다.",
      });
      return;
    }

    setWeather({
      status: "loading",
      temperature: null,
      windSpeed: null,
      weatherCode: null,
      message: "현재 위치와 날씨를 확인하는 중입니다...",
    });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;

          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`
          );

          if (!response.ok) {
            throw new Error("날씨 응답을 불러오지 못했습니다.");
          }

          const result = await response.json();

          const currentWeather = result.current_weather as
            | {
                temperature?: number;
                windspeed?: number;
                weathercode?: number;
              }
            | undefined;

          if (!currentWeather) {
            throw new Error("현재 날씨 데이터가 없습니다.");
          }

          setWeather({
            status: "success",
            temperature:
              typeof currentWeather.temperature === "number"
                ? currentWeather.temperature
                : null,
            windSpeed:
              typeof currentWeather.windspeed === "number"
                ? currentWeather.windspeed
                : null,
            weatherCode:
              typeof currentWeather.weathercode === "number"
                ? currentWeather.weathercode
                : null,
            message: "현재 위치 기준 날씨입니다.",
          });
        } catch {
          setWeather({
            status: "error",
            temperature: null,
            windSpeed: null,
            weatherCode: null,
            message: "날씨 정보를 불러오지 못했습니다.",
          });
        }
      },
      () => {
        setWeather({
          status: "denied",
          temperature: null,
          windSpeed: null,
          weatherCode: null,
          message: "위치 권한이 허용되지 않아 날씨를 표시할 수 없습니다.",
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 7000,
        maximumAge: 1000 * 60 * 10,
      }
    );
  }

  const pageStyle = {
    minHeight: "100dvh",
    background: "#ffffff",
    fontFamily: "Arial, sans-serif",
  };

  const primaryButtonStyle = {
    width: "100%",
    border: "none",
    borderRadius: "14px",
    background: "#111827",
    color: "#ffffff",
    padding: "16px",
    fontSize: "14px",
    fontWeight: 800,
    textAlign: "left" as const,
  };

  const outlineButtonStyle = {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: "14px",
    background: "#ffffff",
    color: "#111827",
    padding: "16px",
    fontSize: "14px",
    fontWeight: 800,
    textAlign: "left" as const,
  };

  const smallTextStyle = {
    margin: "6px 0 0",
    fontSize: "12px",
    color: "#6b7280",
    lineHeight: 1.5,
    fontWeight: 400,
  };

  const summaryCardStyle = {
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    background: "#f9fafb",
    padding: "16px",
    boxSizing: "border-box" as const,
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
            }}
          >
            오늘의 Pro 상태, 커뮤니티 공지, 스트리밍 일정, 현재 날씨를 한눈에
            확인하세요.
          </p>

          <div
            style={{
              marginTop: "22px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            <div style={summaryCardStyle}>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#6b7280",
                  fontWeight: 800,
                }}
              >
                Pro 상태
              </p>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "15px",
                  color: "#111827",
                  fontWeight: 900,
                  lineHeight: 1.5,
                }}
              >
                {getProStatusText()}
              </p>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "12px",
                  color: "#6b7280",
                  lineHeight: 1.5,
                }}
              >
                {getProStatusDetail()}
              </p>
            </div>

            <div style={summaryCardStyle}>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#6b7280",
                  fontWeight: 800,
                }}
              >
                오늘 일정
              </p>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "15px",
                  color: "#111827",
                  fontWeight: 900,
                  lineHeight: 1.5,
                }}
              >
                {getTodayScheduleText()}
              </p>

              <button
                type="button"
                onClick={() => router.push("/streaming/schedule")}
                style={{
                  marginTop: "10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "10px",
                  background: "#ffffff",
                  color: "#111827",
                  padding: "8px 10px",
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                일정표 보기
              </button>
            </div>

            <div style={summaryCardStyle}>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#6b7280",
                  fontWeight: 800,
                }}
              >
                최근 공지
              </p>

              {announcementLoading ? (
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: "15px",
                    color: "#111827",
                    fontWeight: 900,
                  }}
                >
                  공지를 확인하는 중입니다...
                </p>
              ) : announcement ? (
                <>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "15px",
                      color: "#111827",
                      fontWeight: 900,
                      lineHeight: 1.5,
                    }}
                  >
                    {shortenText(announcement.message_content)}
                  </p>

                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "12px",
                      color: "#6b7280",
                      lineHeight: 1.5,
                    }}
                  >
                    공지자: {announcement.announcer_name ?? "관리자"} ·{" "}
                    {getDateTimeLabel(announcement.announced_at)}
                  </p>
                </>
              ) : (
                <>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "15px",
                      color: "#111827",
                      fontWeight: 900,
                      lineHeight: 1.5,
                    }}
                  >
                    현재 등록된 커뮤니티 공지가 없습니다.
                  </p>

                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "12px",
                      color: "#6b7280",
                      lineHeight: 1.5,
                    }}
                  >
                    공지가 생기면 이곳에 가장 최근 공지가 표시됩니다.
                  </p>
                </>
              )}

              <button
                type="button"
                onClick={() => router.push("/chat")}
                style={{
                  marginTop: "10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "10px",
                  background: "#ffffff",
                  color: "#111827",
                  padding: "8px 10px",
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                커뮤니티 보기
              </button>
            </div>

            <div style={summaryCardStyle}>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#6b7280",
                  fontWeight: 800,
                }}
              >
                현재 날씨
              </p>

              {weather.status === "success" ? (
                <>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "15px",
                      color: "#111827",
                      fontWeight: 900,
                      lineHeight: 1.5,
                    }}
                  >
                    {weather.temperature !== null
                      ? `${weather.temperature}℃`
                      : "기온 정보 없음"}{" "}
                    · {getWeatherLabel(weather.weatherCode)}
                  </p>

                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "12px",
                      color: "#6b7280",
                      lineHeight: 1.5,
                    }}
                  >
                    {weather.windSpeed !== null
                      ? `풍속 ${weather.windSpeed}km/h`
                      : "풍속 정보 없음"}{" "}
                    · {weather.message}
                  </p>
                </>
              ) : (
                <>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "15px",
                      color: "#111827",
                      fontWeight: 900,
                      lineHeight: 1.5,
                    }}
                  >
                    {weather.message}
                  </p>

                  <button
                    type="button"
                    onClick={loadWeather}
                    disabled={weather.status === "loading"}
                    style={{
                      marginTop: "10px",
                      border: "1px solid #d1d5db",
                      borderRadius: "10px",
                      background: "#ffffff",
                      color: "#111827",
                      padding: "8px 10px",
                      fontSize: "12px",
                      fontWeight: 800,
                      opacity: weather.status === "loading" ? 0.6 : 1,
                    }}
                  >
                    {weather.status === "loading"
                      ? "날씨 확인 중..."
                      : "현재 날씨 보기"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: "24px",
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
              onClick={() => router.push("/streaming")}
              style={primaryButtonStyle}
            >
              스트리밍 보기
              <p style={smallTextStyle}>
                Pro 권한으로 영상과 자료를 탐색합니다.
              </p>
            </button>

            <button
              type="button"
              onClick={() => router.push("/streaming/schedule")}
              style={outlineButtonStyle}
            >
              스트리밍 일정표
              <p style={smallTextStyle}>
                달력에서 예정된 스트리밍과 작업 현황을 확인합니다.
              </p>
            </button>

            <button
              type="button"
              onClick={() => router.push("/chat")}
              style={outlineButtonStyle}
            >
              커뮤니티
              <p style={smallTextStyle}>
                모든 유저가 함께 사용하는 서버 채팅입니다.
              </p>
            </button>

            <button
              type="button"
              onClick={() => router.push("/serial-key")}
              style={outlineButtonStyle}
            >
              시리얼키 등록
              <p style={smallTextStyle}>
                Pro 사용권을 등록하고 남은 기간을 확인합니다.
              </p>
            </button>

            <button
              type="button"
              onClick={() => router.push("/account")}
              style={outlineButtonStyle}
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
                style={{
                  ...outlineButtonStyle,
                  border: "1px solid #111827",
                }}
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
