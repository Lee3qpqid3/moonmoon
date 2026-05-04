"use client";

import { useEffect, useMemo, useState } from "react";
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

type StreamingFolder = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
};

type StreamingItem = {
  id: string;
  folder_id: string | null;
  title: string;
  description: string | null;
  item_type: "VIDEO" | "DOCUMENT" | "LINK" | "FOLDER_LINK";
  source_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  file_size_text: string | null;
  sort_order: number;
  pro_required: boolean;
  created_at: string;
};

type ItemType = "VIDEO" | "DOCUMENT" | "LINK" | "FOLDER_LINK";
type ScheduleStatus = "PLANNED" | "LIVE" | "DONE" | "CANCELED";

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
  fontWeight: 700,
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

export default function AdminStreamingSourcePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [folders, setFolders] = useState<StreamingFolder[]>([]);
  const [items, setItems] = useState<StreamingItem[]>([]);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<StreamingFolder[]>([]);

  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [folderSortOrder, setFolderSortOrder] = useState("0");

  const [itemTitle, setItemTitle] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemType, setItemType] = useState<ItemType>("VIDEO");
  const [itemSourceUrl, setItemSourceUrl] = useState("");
  const [itemThumbnailUrl, setItemThumbnailUrl] = useState("");
  const [itemDurationSeconds, setItemDurationSeconds] = useState("");
  const [itemFileSizeText, setItemFileSizeText] = useState("");
  const [itemSortOrder, setItemSortOrder] = useState("0");
  const [itemProRequired, setItemProRequired] = useState(true);

  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDescription, setScheduleDescription] = useState("");
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [scheduleStatus, setScheduleStatus] =
    useState<ScheduleStatus>("PLANNED");
  const [scheduleLinkedFolderId, setScheduleLinkedFolderId] = useState("");
  const [scheduleLinkedItemId, setScheduleLinkedItemId] = useState("");

  const [loading, setLoading] = useState(true);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [denied, setDenied] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    checkSuperUserAndLoadSource();
  }, []);

  async function checkSuperUserAndLoadSource() {
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

    if (data.role !== "SUPER_USER") {
      setDenied(true);
      setLoading(false);
      return;
    }

    setProfile(data as AdminProfile);
    setLoading(false);

    await loadSource(null, []);
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

  async function createFolder() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!folderName.trim()) {
      setErrorMessage("폴더 이름을 입력해야 합니다.");
      return;
    }

    setCreatingFolder(true);

    const { error } = await supabase.rpc("super_create_streaming_folder", {
      new_parent_id: currentFolderId,
      new_name: folderName.trim(),
      new_description: folderDescription.trim(),
      new_sort_order: Number(folderSortOrder) || 0,
    });

    setCreatingFolder(false);

    if (error) {
      setErrorMessage(error.message || "폴더를 생성하지 못했습니다.");
      return;
    }

    setFolderName("");
    setFolderDescription("");
    setFolderSortOrder("0");
    setSuccessMessage("폴더가 생성되었습니다.");
    await loadSource();
  }

  async function createItem() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!itemTitle.trim()) {
      setErrorMessage("자료 제목을 입력해야 합니다.");
      return;
    }

    if (!itemSourceUrl.trim()) {
      setErrorMessage("자료 링크를 입력해야 합니다.");
      return;
    }

    setCreatingItem(true);

    const parsedDuration = itemDurationSeconds.trim()
      ? Number(itemDurationSeconds)
      : null;

    const { error } = await supabase.rpc("super_create_streaming_item", {
      new_folder_id: currentFolderId,
      new_title: itemTitle.trim(),
      new_description: itemDescription.trim(),
      new_item_type: itemType,
      new_source_url: itemSourceUrl.trim(),
      new_thumbnail_url: itemThumbnailUrl.trim(),
      new_duration_seconds:
        parsedDuration !== null && Number.isFinite(parsedDuration)
          ? parsedDuration
          : null,
      new_file_size_text: itemFileSizeText.trim(),
      new_sort_order: Number(itemSortOrder) || 0,
      new_pro_required: itemProRequired,
    });

    setCreatingItem(false);

    if (error) {
      setErrorMessage(error.message || "자료를 등록하지 못했습니다.");
      return;
    }

    setItemTitle("");
    setItemDescription("");
    setItemType("VIDEO");
    setItemSourceUrl("");
    setItemThumbnailUrl("");
    setItemDurationSeconds("");
    setItemFileSizeText("");
    setItemSortOrder("0");
    setItemProRequired(true);
    setSuccessMessage("자료가 등록되었습니다.");
    await loadSource();
  }

  async function createSchedule() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!scheduleTitle.trim()) {
      setErrorMessage("일정 제목을 입력해야 합니다.");
      return;
    }

    if (!scheduleDateTime) {
      setErrorMessage("일정 시각을 입력해야 합니다.");
      return;
    }

    setCreatingSchedule(true);

    const scheduledAt = new Date(scheduleDateTime).toISOString();

    const { error } = await supabase.rpc("super_create_streaming_schedule", {
      new_title: scheduleTitle.trim(),
      new_description: scheduleDescription.trim(),
      new_scheduled_at: scheduledAt,
      new_status: scheduleStatus,
      new_linked_folder_id: scheduleLinkedFolderId || null,
      new_linked_item_id: scheduleLinkedItemId || null,
    });

    setCreatingSchedule(false);

    if (error) {
      setErrorMessage(error.message || "스트리밍 일정을 생성하지 못했습니다.");
      return;
    }

    setScheduleTitle("");
    setScheduleDescription("");
    setScheduleDateTime("");
    setScheduleStatus("PLANNED");
    setScheduleLinkedFolderId("");
    setScheduleLinkedItemId("");
    setSuccessMessage("스트리밍 일정이 생성되었습니다.");
  }

  function getItemTypeLabel(type: ItemType) {
    if (type === "VIDEO") return "영상";
    if (type === "DOCUMENT") return "문서";
    if (type === "LINK") return "링크";
    return "폴더 링크";
  }

  function getScheduleStatusLabel(status: ScheduleStatus) {
    if (status === "PLANNED") return "예정";
    if (status === "LIVE") return "진행 중";
    if (status === "DONE") return "완료";
    return "취소";
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

  const allFolderOptions = useMemo(() => {
    const current = currentFolderId
      ? [
          {
            id: currentFolderId,
            name:
              folderPath.length > 0
                ? `현재 폴더 · ${folderPath[folderPath.length - 1].name}`
                : "현재 폴더",
          },
        ]
      : [];

    const children = folders.map((folder) => ({
      id: folder.id,
      name: `현재 위치의 하위 폴더 · ${folder.name}`,
    }));

    return [...current, ...children];
  }, [currentFolderId, folderPath, folders]);

  if (loading) {
    return (
      <main style={centerStyle}>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          슈퍼유저 권한을 확인하는 중입니다...
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
            스트리밍 소스 관리는 슈퍼유저 계정만 접근할 수 있습니다.
          </p>

          <button
            onClick={() => router.push("/admin")}
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
            관리자 페이지로 돌아가기
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
            스트리밍 소스 관리
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            실제 스트리밍 폴더, 영상, 문서, 링크, 일정을 등록합니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/streaming")} style={buttonStyle}>
            스트리밍 보기
          </button>

          <button onClick={() => router.push("/admin")} style={buttonStyle}>
            관리자
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
              현재 슈퍼유저
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
              {profile?.name} · {profile?.email}
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
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>
                현재 위치
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                폴더를 눌러 하위 위치로 이동하고, 해당 위치에 폴더나 자료를
                등록할 수 있습니다.
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

          <div
            style={{
              marginTop: "16px",
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

          <div
            style={{
              marginTop: "20px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "14px",
            }}
          >
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "16px",
                padding: "16px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 900 }}>
                하위 폴더
              </h3>

              <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                {folders.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
                    하위 폴더가 없습니다.
                  </p>
                ) : (
                  folders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => openFolder(folder)}
                      style={{
                        border: "1px solid #d1d5db",
                        borderRadius: "12px",
                        background: "#ffffff",
                        color: "#111827",
                        padding: "12px",
                        textAlign: "left",
                        fontSize: "14px",
                        fontWeight: 800,
                      }}
                    >
                      📁 {folder.name}
                      {folder.description && (
                        <p
                          style={{
                            margin: "6px 0 0",
                            fontSize: "12px",
                            color: "#6b7280",
                            lineHeight: 1.5,
                            fontWeight: 400,
                          }}
                        >
                          {folder.description}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "16px",
                padding: "16px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 900 }}>
                등록된 자료
              </h3>

              <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                {items.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
                    등록된 자료가 없습니다.
                  </p>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px",
                        background: "#ffffff",
                        color: "#111827",
                        padding: "12px",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "14px",
                          fontWeight: 900,
                        }}
                      >
                        {getItemTypeLabel(item.item_type)} · {item.title}
                      </p>

                      {item.description && (
                        <p
                          style={{
                            margin: "6px 0 0",
                            fontSize: "12px",
                            color: "#6b7280",
                            lineHeight: 1.5,
                          }}
                        >
                          {item.description}
                        </p>
                      )}

                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: "12px",
                          color: "#6b7280",
                          wordBreak: "break-all",
                        }}
                      >
                        {item.source_url}
                      </p>

                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: "12px",
                          color: item.pro_required ? "#dc2626" : "#15803d",
                          fontWeight: 800,
                        }}
                      >
                        {item.pro_required ? "Pro 필요" : "전체 공개"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "20px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "20px",
          }}
        >
          <div style={cardStyle}>
            <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>
              폴더 생성
            </h2>

            <p
              style={{
                marginTop: "8px",
                fontSize: "14px",
                color: "#6b7280",
                lineHeight: 1.6,
              }}
            >
              현재 위치 아래에 새 폴더를 생성합니다.
            </p>

            <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
              <div>
                <label style={labelStyle}>폴더 이름</label>
                <input
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>설명</label>
                <textarea
                  value={folderDescription}
                  onChange={(event) =>
                    setFolderDescription(event.target.value)
                  }
                  style={{
                    ...inputStyle,
                    minHeight: "90px",
                    resize: "vertical",
                    fontFamily: "Arial, sans-serif",
                  }}
                />
              </div>

              <div>
                <label style={labelStyle}>정렬 순서</label>
                <input
                  type="number"
                  value={folderSortOrder}
                  onChange={(event) => setFolderSortOrder(event.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={createFolder}
              disabled={creatingFolder}
              style={{
                marginTop: "14px",
                border: "none",
                borderRadius: "10px",
                background: "#111827",
                color: "#ffffff",
                padding: "12px 14px",
                fontSize: "14px",
                fontWeight: 800,
                opacity: creatingFolder ? 0.6 : 1,
              }}
            >
              {creatingFolder ? "생성 중..." : "폴더 생성"}
            </button>
          </div>

          <div style={cardStyle}>
            <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>
              자료 등록
            </h2>

            <p
              style={{
                marginTop: "8px",
                fontSize: "14px",
                color: "#6b7280",
                lineHeight: 1.6,
              }}
            >
              현재 위치에 영상, 문서, 외부 링크를 등록합니다.
            </p>

            <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
              <div>
                <label style={labelStyle}>자료 제목</label>
                <input
                  value={itemTitle}
                  onChange={(event) => setItemTitle(event.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>자료 유형</label>
                <select
                  value={itemType}
                  onChange={(event) => setItemType(event.target.value as ItemType)}
                  style={inputStyle}
                >
                  <option value="VIDEO">영상</option>
                  <option value="DOCUMENT">문서</option>
                  <option value="LINK">외부 링크</option>
                  <option value="FOLDER_LINK">폴더 링크</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>자료 링크</label>
                <input
                  value={itemSourceUrl}
                  onChange={(event) => setItemSourceUrl(event.target.value)}
                  placeholder="PikPak/WebDAV/외부 링크"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>설명</label>
                <textarea
                  value={itemDescription}
                  onChange={(event) => setItemDescription(event.target.value)}
                  style={{
                    ...inputStyle,
                    minHeight: "90px",
                    resize: "vertical",
                    fontFamily: "Arial, sans-serif",
                  }}
                />
              </div>

              <div>
                <label style={labelStyle}>썸네일 링크</label>
                <input
                  value={itemThumbnailUrl}
                  onChange={(event) => setItemThumbnailUrl(event.target.value)}
                  style={inputStyle}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: "10px",
                }}
              >
                <div>
                  <label style={labelStyle}>영상 길이 초</label>
                  <input
                    type="number"
                    value={itemDurationSeconds}
                    onChange={(event) =>
                      setItemDurationSeconds(event.target.value)
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>파일 크기</label>
                  <input
                    value={itemFileSizeText}
                    onChange={(event) =>
                      setItemFileSizeText(event.target.value)
                    }
                    placeholder="예: 1.2GB"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>정렬 순서</label>
                  <input
                    type="number"
                    value={itemSortOrder}
                    onChange={(event) => setItemSortOrder(event.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#374151",
                }}
              >
                <input
                  type="checkbox"
                  checked={itemProRequired}
                  onChange={(event) => setItemProRequired(event.target.checked)}
                />
                Pro 권한 필요
              </label>
            </div>

            <button
              type="button"
              onClick={createItem}
              disabled={creatingItem}
              style={{
                marginTop: "14px",
                border: "none",
                borderRadius: "10px",
                background: "#111827",
                color: "#ffffff",
                padding: "12px 14px",
                fontSize: "14px",
                fontWeight: 800,
                opacity: creatingItem ? 0.6 : 1,
              }}
            >
              {creatingItem ? "등록 중..." : "자료 등록"}
            </button>
          </div>
        </div>

        <div style={{ ...cardStyle, marginTop: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>
            스트리밍 일정 생성
          </h2>

          <p
            style={{
              marginTop: "8px",
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: 1.6,
            }}
          >
            일정표에 표시할 스트리밍 일정을 생성합니다. 현재 위치나 현재 위치의
            자료를 연결할 수 있습니다.
          </p>

          <div
            style={{
              marginTop: "16px",
              display: "grid",
              gap: "12px",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div>
              <label style={labelStyle}>일정 제목</label>
              <input
                value={scheduleTitle}
                onChange={(event) => setScheduleTitle(event.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>일정 시각</label>
              <input
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(event) => setScheduleDateTime(event.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>상태</label>
              <select
                value={scheduleStatus}
                onChange={(event) =>
                  setScheduleStatus(event.target.value as ScheduleStatus)
                }
                style={inputStyle}
              >
                <option value="PLANNED">예정</option>
                <option value="LIVE">진행 중</option>
                <option value="DONE">완료</option>
                <option value="CANCELED">취소</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>연결 폴더</label>
              <select
                value={scheduleLinkedFolderId}
                onChange={(event) =>
                  setScheduleLinkedFolderId(event.target.value)
                }
                style={inputStyle}
              >
                <option value="">연결 안 함</option>
                {allFolderOptions.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>연결 자료</label>
              <select
                value={scheduleLinkedItemId}
                onChange={(event) => setScheduleLinkedItemId(event.target.value)}
                style={inputStyle}
              >
                <option value="">연결 안 함</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getItemTypeLabel(item.item_type)} · {item.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: "12px" }}>
            <label style={labelStyle}>설명</label>
            <textarea
              value={scheduleDescription}
              onChange={(event) => setScheduleDescription(event.target.value)}
              style={{
                ...inputStyle,
                minHeight: "90px",
                resize: "vertical",
                fontFamily: "Arial, sans-serif",
              }}
            />
          </div>

          <button
            type="button"
            onClick={createSchedule}
            disabled={creatingSchedule}
            style={{
              marginTop: "14px",
              border: "none",
              borderRadius: "10px",
              background: "#111827",
              color: "#ffffff",
              padding: "12px 14px",
              fontSize: "14px",
              fontWeight: 800,
              opacity: creatingSchedule ? 0.6 : 1,
            }}
          >
            {creatingSchedule ? "생성 중..." : "일정 생성"}
          </button>
        </div>
      </section>
    </main>
  );
}
