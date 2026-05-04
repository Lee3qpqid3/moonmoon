"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

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

type StreamingItemType = "VIDEO" | "DOCUMENT" | "LINK" | "FOLDER_LINK";

type StreamingItem = {
  id: string;
  folder_id: string | null;
  title: string;
  description: string | null;
  item_type: StreamingItemType;
  source_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  file_size_text: string | null;
  sort_order: number;
  pro_required: boolean;
  created_at: string;
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

export default function StreamingItemPage() {
  const router = useRouter();
  const params = useParams();

  const itemId =
    typeof params.itemId === "string"
      ? params.itemId
      : Array.isArray(params.itemId)
        ? params.itemId[0]
        : "";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [item, setItem] = useState<StreamingItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [itemLoading, setItemLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, [itemId]);

  async function loadPage() {
    const currentProfile = await loadProfile();

    if (!currentProfile) {
      return;
    }

    await loadItem();
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

  async function loadItem() {
    if (!itemId) {
      setErrorMessage("자료 ID를 확인할 수 없습니다.");
      setLoading(false);
      return;
    }

    setItemLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.rpc("get_streaming_item_detail", {
      target_item_id: itemId,
    });

    setItemLoading(false);

    if (error) {
      setErrorMessage(error.message || "자료를 불러오지 못했습니다.");
      return;
    }

    const rows = (data ?? []) as StreamingItem[];

    if (rows.length === 0) {
      setErrorMessage(
        "자료를 찾을 수 없거나, 현재 계정으로 접근할 수 없는 자료입니다."
      );
      setItem(null);
      return;
    }

    setItem(rows[0]);
  }

  function hasActivePro() {
    if (!profile?.pro_until) {
      return false;
    }

    return new Date(profile.pro_until).getTime() > Date.now();
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

  function getItemTypeLabel(type: StreamingItemType) {
    if (type === "VIDEO") {
      return "영상";
    }

    if (type === "DOCUMENT") {
      return "문서";
    }

    if (type === "LINK") {
      return "링크";
    }

    return "폴더 링크";
  }

  function getDurationLabel(seconds: number | null) {
    if (!seconds || seconds <= 0) {
      return "";
    }

    const hour = Math.floor(seconds / 3600);
    const minute = Math.floor((seconds % 3600) / 60);
    const second = seconds % 60;

    if (hour > 0) {
      return `${hour}시간 ${minute}분 ${second}초`;
    }

    if (minute > 0) {
      return `${minute}분 ${second}초`;
    }

    return `${second}초`;
  }

  function openSourceUrl() {
    if (!item) {
      return;
    }

    window.open(item.source_url, "_blank", "noopener,noreferrer");
  }

  function renderContent() {
    if (!item) {
      return null;
    }

    if (item.item_type === "VIDEO") {
      return (
        <div
          style={{
            marginTop: "20px",
            borderRadius: "20px",
            background: "#111827",
            padding: "14px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              borderRadius: "14px",
              background: "#000000",
              overflow: "hidden",
            }}
          >
            <video
              src={item.source_url}
              controls
              playsInline
              preload="metadata"
              poster={item.thumbnail_url ?? undefined}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                background: "#000000",
              }}
            />
          </div>

          <p
            style={{
              margin: "12px 0 0",
              fontSize: "12px",
              color: "#d1d5db",
              lineHeight: 1.5,
            }}
          >
            영상 비율이 달라도 화면 안에서 잘리지 않도록 표시됩니다.
          </p>
        </div>
      );
    }

    return (
      <div
        style={{
          marginTop: "20px",
          border: "1px solid #e5e7eb",
          borderRadius: "18px",
          background: "#f9fafb",
          padding: "22px",
          boxSizing: "border-box",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: 900,
            color: "#111827",
          }}
        >
          {getItemTypeLabel(item.item_type)} 자료
        </h2>

        <p
          style={{
            margin: "10px 0 0",
            fontSize: "14px",
            color: "#6b7280",
            lineHeight: 1.6,
          }}
        >
          이 자료는 새 탭에서 열 수 있습니다. 문서 파일인 경우 브라우저에서 바로
          열리거나 다운로드됩니다.
        </p>

        <button
          type="button"
          onClick={openSourceUrl}
          style={{
            marginTop: "16px",
            border: "none",
            borderRadius: "12px",
            background: "#111827",
            color: "#ffffff",
            padding: "12px 16px",
            fontSize: "14px",
            fontWeight: 900,
          }}
        >
          자료 열기
        </button>

        <p
          style={{
            margin: "14px 0 0",
            fontSize: "12px",
            color: "#6b7280",
            wordBreak: "break-all",
            lineHeight: 1.5,
          }}
        >
          {item.source_url}
        </p>
      </div>
    );
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
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 800,
              color: "#111827",
            }}
          >
            스트리밍 자료
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            영상과 자료를 확인합니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => router.push("/streaming")}
            style={buttonStyle}
          >
            목록
          </button>

          <button
            type="button"
            onClick={() => router.push("/streaming/schedule")}
            style={buttonStyle}
          >
            일정표
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
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color:
                    item?.pro_required === true
                      ? hasActivePro()
                        ? "#15803d"
                        : "#dc2626"
                      : "#15803d",
                  fontWeight: 900,
                }}
              >
                {item
                  ? `${getItemTypeLabel(item.item_type)} · ${
                      item.pro_required ? "Pro 필요" : "전체 공개"
                    }`
                  : "자료"}
              </p>

              <h2
                style={{
                  margin: "8px 0 0",
                  fontSize: "26px",
                  fontWeight: 900,
                  color: "#111827",
                  lineHeight: 1.35,
                }}
              >
                {item?.title ?? "자료를 불러오지 못했습니다"}
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
              onClick={loadItem}
              disabled={itemLoading}
              style={{
                ...buttonStyle,
                opacity: itemLoading ? 0.6 : 1,
              }}
            >
              {itemLoading ? "새로고침 중..." : "새로고침"}
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

          {item && (
            <>
              {item.description && (
                <p
                  style={{
                    margin: "18px 0 0",
                    fontSize: "15px",
                    color: "#374151",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {item.description}
                </p>
              )}

              {(item.duration_seconds || item.file_size_text) && (
                <div
                  style={{
                    marginTop: "16px",
                    borderRadius: "14px",
                    background: "#f9fafb",
                    padding: "14px",
                    fontSize: "13px",
                    color: "#6b7280",
                    lineHeight: 1.6,
                  }}
                >
                  {item.duration_seconds && (
                    <p style={{ margin: 0 }}>
                      영상 길이: {getDurationLabel(item.duration_seconds)}
                    </p>
                  )}

                  {item.file_size_text && (
                    <p style={{ margin: item.duration_seconds ? "6px 0 0" : 0 }}>
                      파일 크기: {item.file_size_text}
                    </p>
                  )}

                  <p
                    style={{
                      margin:
                        item.duration_seconds || item.file_size_text
                          ? "6px 0 0"
                          : 0,
                    }}
                  >
                    등록일: {getDateTimeLabel(item.created_at)}
                  </p>
                </div>
              )}

              {renderContent()}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
