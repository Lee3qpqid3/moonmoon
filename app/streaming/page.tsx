"use client";

import { useEffect, useState } from "react";
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

type StreamingFolder = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
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
  const [folders, setFolders] = useState<StreamingFolder[]>([]);
  const [items, setItems] = useState<StreamingItem[]>([]);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<StreamingFolder[]>([]);

  const [loading, setLoading] = useState(true);
  const [sourceLoading, setSourceLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const currentProfile = await loadProfile();

    if (!currentProfile) {
      return;
    }

    await loadSource(null, []);
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

  async function loadSource(
    targetFolderId: string | null = currentFolderId,
    nextPath: StreamingFolder[] = folderPath
  ) {
    setSourceLoading(true);
    setErrorMessage("");

    const { data: folderData, error: folderError } = await supabase.rpc(
      "get_streaming_folders",
      {
        target_parent_id: targetFolderId,
      }
    );

    const { data: itemData, error: itemError } = await supabase.rpc(
      "get_streaming_items",
      {
        target_folder_id: targetFolderId,
      }
    );

    setSourceLoading(false);

    if (folderError) {
      setErrorMessage(folderError.message || "폴더 목록을 불러오지 못했습니다.");
      return;
    }

    if (itemError) {
      setErrorMessage(itemError.message || "자료 목록을 불러오지 못했습니다.");
      return;
    }

    setCurrentFolderId(targetFolderId);
    setFolderPath(nextPath);
    setFolders((folderData ?? []) as StreamingFolder[]);
    setItems((itemData ?? []) as StreamingItem[]);
  }

  async function openFolder(folder: StreamingFolder) {
    await loadSource(folder.id, [...folderPath, folder]);
  }

  async function goRoot() {
    await loadSource(null, []);
  }

  async function goPath(index: number) {
    const nextPath = folderPath.slice(0, index + 1);
    const targetFolder = nextPath[nextPath.length - 1];

    await loadSource(targetFolder.id, nextPath);
  }

  async function goUp() {
    if (folderPath.length === 0) {
      await goRoot();
      return;
    }

    const nextPath = folderPath.slice(0, -1);
    const targetFolder = nextPath[nextPath.length - 1];

    await loadSource(targetFolder ? targetFolder.id : null, nextPath);
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

  function getItemIcon(type: StreamingItemType) {
    if (type === "VIDEO") {
      return "🎬";
    }

    if (type === "DOCUMENT") {
      return "📄";
    }

    if (type === "LINK") {
      return "🔗";
    }

    return "📁";
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

  function openItem(item: StreamingItem) {
    if (item.item_type === "VIDEO") {
      router.push(`/streaming/${item.id}`);
      return;
    }

    window.open(item.source_url, "_blank", "noopener,noreferrer");
  }

  function getCurrentFolderName() {
    if (folderPath.length === 0) {
      return "루트";
    }

    return folderPath[folderPath.length - 1].name;
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
            폴더식으로 영상, 문서, 링크 자료를 탐색합니다.
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
                {getCurrentFolderName()}
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
              onClick={() => loadSource()}
              disabled={sourceLoading}
              style={{
                ...buttonStyle,
                opacity: sourceLoading ? 0.6 : 1,
              }}
            >
              {sourceLoading ? "새로고침 중..." : "새로고침"}
            </button>
          </div>

          {!hasActivePro() && (
            <div
              style={{
                marginTop: "18px",
                border: "1px solid #fde68a",
                borderRadius: "14px",
                background: "#fffbeb",
                padding: "14px",
                color: "#92400e",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              현재 일반 등급입니다. Pro 권한이 필요한 영상과 자료는 목록에서
              표시되지 않습니다. 시리얼키를 등록하면 Pro 자료를 볼 수 있습니다.
            </div>
          )}

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
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button type="button" onClick={goRoot} style={buttonStyle}>
              루트
            </button>

            {folderPath.map((folder, index) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => goPath(index)}
                style={buttonStyle}
              >
                {folder.name}
              </button>
            ))}

            {folderPath.length > 0 && (
              <button type="button" onClick={goUp} style={buttonStyle}>
                상위 폴더
              </button>
            )}
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
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => openFolder(folder)}
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
              <p
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: 900,
                  color: "#111827",
                }}
              >
                📁 {folder.name}
              </p>

              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                {folder.description || "하위 폴더와 자료를 확인합니다."}
              </p>
            </button>
          ))}

          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openItem(item)}
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
              {item.thumbnail_url ? (
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    borderRadius: "14px",
                    background: "#f3f4f6",
                    overflow: "hidden",
                    marginBottom: "14px",
                  }}
                >
                  <img
                    src={item.thumbnail_url}
                    alt={item.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
              ) : (
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
                    fontSize: "32px",
                  }}
                >
                  {getItemIcon(item.item_type)}
                </div>
              )}

              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: item.pro_required ? "#dc2626" : "#15803d",
                  fontWeight: 900,
                }}
              >
                {getItemTypeLabel(item.item_type)} ·{" "}
                {item.pro_required ? "Pro 필요" : "전체 공개"}
              </p>

              <h3
                style={{
                  margin: "8px 0 0",
                  fontSize: "18px",
                  fontWeight: 900,
                  color: "#111827",
                  lineHeight: 1.4,
                }}
              >
                {item.title}
              </h3>

              {item.description && (
                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: "14px",
                    color: "#6b7280",
                    lineHeight: 1.6,
                  }}
                >
                  {item.description}
                </p>
              )}

              {(item.duration_seconds || item.file_size_text) && (
                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: "12px",
                    color: "#6b7280",
                    lineHeight: 1.5,
                  }}
                >
                  {getDurationLabel(item.duration_seconds)}
                  {item.duration_seconds && item.file_size_text ? " · " : ""}
                  {item.file_size_text ?? ""}
                </p>
              )}
            </button>
          ))}

          {folders.length === 0 && items.length === 0 && (
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
                boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
              }}
            >
              이 위치에 표시할 폴더나 자료가 없습니다.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
