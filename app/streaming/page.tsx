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

type LiveEntry = {
  id: string;
  week_name: string;
  teacher_name: string;
  file_name: string;
  title: string;
  file_extension: string | null;
  mime_type: string | null;
  webdav_path: string;
  file_size_bytes: number | null;
  created_at: string;
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

export default function StreamingPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<LiveEntry[]>([]);
  const [selectedWeekName, setSelectedWeekName] = useState("");
  const [selectedTeacherName, setSelectedTeacherName] = useState("");

  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const currentProfile = await loadProfile();

    if (!currentProfile) {
      return;
    }

    if (!hasActiveProFromProfile(currentProfile)) {
      setBlocked(true);
      return;
    }

    await loadEntries();
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
      .select("id, email, name, role, status, pro_until")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      setErrorMessage("사용자 프로필을 찾을 수 없습니다.");
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

  async function loadEntries() {
    setEntriesLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.rpc("get_my_live_streaming_entries");

    setEntriesLoading(false);

    if (error) {
      setErrorMessage(error.message || "스트리밍 목록을 불러오지 못했습니다.");
      setEntries([]);
      return;
    }

    setEntries((data ?? []) as LiveEntry[]);
  }

  function hasActiveProFromProfile(targetProfile: Profile) {
    if (!targetProfile.pro_until) {
      return false;
    }

    return new Date(targetProfile.pro_until).getTime() > Date.now();
  }

  function hasActivePro() {
    if (!profile) {
      return false;
    }

    return hasActiveProFromProfile(profile);
  }

  function getProLabel() {
    if (!profile?.pro_until) {
      return "일반 등급";
    }

    const proUntilDate = new Date(profile.pro_until);

    if (proUntilDate.getTime() <= Date.now()) {
      return "일반 등급";
    }

    return `Pro · ${getDateTimeLabel(profile.pro_until)}까지`;
  }

  function getDateTimeLabel(dateText: string | null) {
    if (!dateText) {
      return "-";
    }

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

  function getFileSizeLabel(bytes: number | null) {
    if (!bytes || bytes <= 0) {
      return "";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size = size / 1024;
      unitIndex += 1;
    }

    return `${size.toFixed(size >= 10 ? 0 : 1)}${units[unitIndex]}`;
  }

  const weekNames = useMemo(() => {
    return Array.from(new Set(entries.map((entry) => entry.week_name))).sort(
      (a, b) => a.localeCompare(b, "ko-KR", { numeric: true })
    );
  }, [entries]);

  const teacherNames = useMemo(() => {
    const filtered = selectedWeekName
      ? entries.filter((entry) => entry.week_name === selectedWeekName)
      : entries;

    return Array.from(new Set(filtered.map((entry) => entry.teacher_name))).sort(
      (a, b) => a.localeCompare(b, "ko-KR", { numeric: true })
    );
  }, [entries, selectedWeekName]);

  const visibleEntries = useMemo(() => {
    return entries
      .filter((entry) => {
        if (selectedWeekName && entry.week_name !== selectedWeekName) {
          return false;
        }

        if (selectedTeacherName && entry.teacher_name !== selectedTeacherName) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const weekCompare = a.week_name.localeCompare(b.week_name, "ko-KR", {
          numeric: true,
        });

        if (weekCompare !== 0) return weekCompare;

        const teacherCompare = a.teacher_name.localeCompare(
          b.teacher_name,
          "ko-KR",
          {
            numeric: true,
          }
        );

        if (teacherCompare !== 0) return teacherCompare;

        return a.file_name.localeCompare(b.file_name, "ko-KR", {
          numeric: true,
        });
      });
  }, [entries, selectedWeekName, selectedTeacherName]);

  function clearFilters() {
    setSelectedWeekName("");
    setSelectedTeacherName("");
  }

  function selectWeek(weekName: string) {
    setSelectedWeekName(weekName);
    setSelectedTeacherName("");
  }

  function openEntry(entry: LiveEntry) {
    router.push(`/streaming/${entry.id}`);
  }

  if (loading) {
    return (
      <main style={centerStyle}>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          스트리밍 자료를 불러오는 중입니다...
        </p>
      </main>
    );
  }

  if (blocked || !hasActivePro()) {
    return (
      <main style={centerStyle}>
        <section
          style={{
            width: "100%",
            maxWidth: "460px",
            border: "1px solid #fde68a",
            borderRadius: "20px",
            padding: "28px",
            background: "#fffbeb",
            boxSizing: "border-box",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 900,
              color: "#92400e",
            }}
          >
            Pro 권한이 필요합니다
          </h1>

          <p
            style={{
              marginTop: "12px",
              fontSize: "14px",
              color: "#78350f",
              lineHeight: 1.7,
            }}
          >
            스트리밍 보기는 Pro 기간이 활성화된 계정만 이용할 수 있습니다.
            시리얼키를 등록한 뒤 다시 접속해 주세요.
          </p>

          <div
            style={{
              marginTop: "20px",
              display: "grid",
              gap: "10px",
            }}
          >
            <button
              type="button"
              onClick={() => router.push("/serial-key")}
              style={{
                border: "none",
                borderRadius: "10px",
                background: "#92400e",
                color: "#ffffff",
                padding: "12px",
                fontSize: "14px",
                fontWeight: 800,
              }}
            >
              시리얼키 등록하기
            </button>

            <button
              type="button"
              onClick={() => router.push("/home")}
              style={{
                border: "1px solid #fbbf24",
                borderRadius: "10px",
                background: "#ffffff",
                color: "#92400e",
                padding: "12px",
                fontSize: "14px",
                fontWeight: 800,
              }}
            >
              홈으로 돌아가기
            </button>
          </div>
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
            스트리밍 보기
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            권한이 부여된 주차/강사별 영상을 확인합니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => router.push("/streaming/schedule")}
            style={buttonStyle}
          >
            일정표
          </button>

          <button
            type="button"
            onClick={() => router.push("/chat")}
            style={buttonStyle}
          >
            커뮤니티
          </button>

          <button
            type="button"
            onClick={() => router.push("/home")}
            style={buttonStyle}
          >
            홈
          </button>
        </div>
      </header>

      <section
        style={{
          maxWidth: "1120px",
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
              gap: "12px",
              alignItems: "center",
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
                내 스트리밍
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                {profile?.name} · {profile?.email} · {getProLabel()}
              </p>
            </div>

            <button
              type="button"
              onClick={loadEntries}
              disabled={entriesLoading}
              style={{
                ...buttonStyle,
                opacity: entriesLoading ? 0.6 : 1,
              }}
            >
              {entriesLoading ? "새로고침 중..." : "새로고침"}
            </button>
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

          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gap: "12px",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "13px",
                  color: "#374151",
                  fontWeight: 800,
                }}
              >
                주차
              </label>

              <select
                value={selectedWeekName}
                onChange={(event) => selectWeek(event.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid #d1d5db",
                  borderRadius: "10px",
                  padding: "11px",
                  fontSize: "14px",
                  background: "#ffffff",
                  color: "#111827",
                  boxSizing: "border-box",
                }}
              >
                <option value="">전체 주차</option>
                {weekNames.map((weekName) => (
                  <option key={weekName} value={weekName}>
                    {weekName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "13px",
                  color: "#374151",
                  fontWeight: 800,
                }}
              >
                강사명
              </label>

              <select
                value={selectedTeacherName}
                onChange={(event) => setSelectedTeacherName(event.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid #d1d5db",
                  borderRadius: "10px",
                  padding: "11px",
                  fontSize: "14px",
                  background: "#ffffff",
                  color: "#111827",
                  boxSizing: "border-box",
                }}
              >
                <option value="">전체 강사</option>
                {teacherNames.map((teacherName) => (
                  <option key={teacherName} value={teacherName}>
                    {teacherName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              marginTop: "14px",
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button type="button" onClick={clearFilters} style={buttonStyle}>
              전체 보기
            </button>

            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#6b7280",
                lineHeight: 1.5,
              }}
            >
              표시 중: {visibleEntries.length}개 / 전체 {entries.length}개
            </p>
          </div>
        </div>

        <div
          style={{
            marginTop: "20px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
          }}
        >
          {visibleEntries.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                border: "1px solid #e5e7eb",
                borderRadius: "18px",
                background: "#ffffff",
                padding: "28px",
                textAlign: "center",
                color: "#6b7280",
                fontSize: "14px",
                lineHeight: 1.6,
                boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
              }}
            >
              표시할 영상이 없습니다. 관리자에게 LIVE 권한이 부여되어 있는지
              확인해 주세요.
            </div>
          ) : (
            visibleEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => openEntry(entry)}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "18px",
                  background: "#ffffff",
                  color: "#111827",
                  padding: "18px",
                  textAlign: "left",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    borderRadius: "14px",
                    background: "#f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "14px",
                    fontSize: "34px",
                  }}
                >
                  🎬
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "#2563eb",
                    fontWeight: 900,
                  }}
                >
                  {entry.week_name} · {entry.teacher_name}
                </p>

                <h3
                  style={{
                    margin: "8px 0 0",
                    fontSize: "18px",
                    fontWeight: 900,
                    color: "#111827",
                    lineHeight: 1.4,
                    wordBreak: "break-word",
                  }}
                >
                  {entry.title}
                </h3>

                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: "12px",
                    color: "#6b7280",
                    lineHeight: 1.5,
                    wordBreak: "break-all",
                  }}
                >
                  {entry.file_name}
                </p>

                {getFileSizeLabel(entry.file_size_bytes) && (
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "12px",
                      color: "#6b7280",
                    }}
                  >
                    {getFileSizeLabel(entry.file_size_bytes)}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
