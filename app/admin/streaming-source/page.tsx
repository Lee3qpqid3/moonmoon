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

type DownloadLog = {
  log_id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  entry_id: string | null;
  week_name: string | null;
  teacher_name: string | null;
  file_name: string | null;
  webdav_path: string | null;
  downloaded_at: string;
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

export default function AdminStreamingSourcePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [folders, setFolders] = useState<StreamingFolder[]>([]);
  const [items, setItems] = useState<StreamingItem[]>([]);
  const [downloadLogs, setDownloadLogs] = useState<DownloadLog[]>([]);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<StreamingFolder[]>([]);

  const [loading, setLoading] = useState(true);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [downloadLogsLoading, setDownloadLogsLoading] = useState(false);
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

    await Promise.all([loadSource(null, []), loadDownloadLogs()]);
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

  async function loadDownloadLogs() {
    setDownloadLogsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.rpc(
      "super_get_streaming_download_logs",
      {
        log_limit: 300,
      }
    );

    setDownloadLogsLoading(false);

    if (error) {
      setErrorMessage(error.message || "다운로드 기록을 불러오지 못했습니다.");
      setDownloadLogs([]);
      return;
    }

    setDownloadLogs((data ?? []) as DownloadLog[]);
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

  function getItemTypeLabel(type: StreamingItem["item_type"]) {
    if (type === "VIDEO") return "영상";
    if (type === "DOCUMENT") return "문서";
    if (type === "LINK") return "링크";
    return "폴더 링크";
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

  function handleScanPlaceholder() {
    setErrorMessage("");
    setSuccessMessage(
      "아직 WebDAV 스캔 API가 연결되지 않았습니다. 다음 단계에서 /moonmoon/live, /moonmoon/docs 스캔 기능을 붙일 예정입니다."
    );
  }

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
            PikPak WebDAV의 live/docs 폴더를 스캔해 스트리밍 소스를 관리합니다.
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
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>
            WebDAV 스캔 구조
          </h2>

          <p
            style={{
              marginTop: "8px",
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: 1.6,
            }}
          >
            스트리밍 소스는 수동으로 제목, 링크, 썸네일, 시간을 입력하지 않고
            WebDAV 폴더를 스캔해서 자동 등록하는 방향으로 관리합니다.
          </p>

          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "12px",
            }}
          >
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "16px",
                background: "#f9fafb",
                padding: "16px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#6b7280",
                  fontWeight: 800,
                }}
              >
                영상 경로
              </p>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#111827",
                  fontWeight: 900,
                  wordBreak: "break-all",
                }}
              >
                /moonmoon/live/주차/강사명/영상파일
              </p>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "16px",
                background: "#f9fafb",
                padding: "16px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#6b7280",
                  fontWeight: 800,
                }}
              >
                자료 경로
              </p>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#111827",
                  fontWeight: 900,
                  wordBreak: "break-all",
                }}
              >
                /moonmoon/docs/주차/강사명/자료파일
              </p>
            </div>
          </div>

          <div
            style={{
              marginTop: "18px",
              border: "1px solid #fde68a",
              borderRadius: "16px",
              background: "#fffbeb",
              padding: "16px",
              color: "#92400e",
              fontSize: "14px",
              lineHeight: 1.6,
            }}
          >
            이 화면의 기존 수동 등록 기능은 제거했습니다. 다음 단계에서
            SUPER_USER 전용 WebDAV 스캔 API를 붙이고, 스캔 결과를 기준으로
            live/docs 파일을 자동 등록하도록 바꿉니다.
          </div>

          <button
            type="button"
            onClick={handleScanPlaceholder}
            style={{
              marginTop: "16px",
              border: "none",
              borderRadius: "10px",
              background: "#111827",
              color: "#ffffff",
              padding: "12px 14px",
              fontSize: "14px",
              fontWeight: 800,
            }}
          >
            WebDAV 스캔 준비 상태 확인
          </button>
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
                기존 임시 등록 데이터
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                이전 수동 등록 구조로 들어간 데이터가 있다면 여기에서 확인만 할 수
                있습니다. 새 자료 등록은 WebDAV 스캔 구조로 전환합니다.
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
                폴더
              </h3>

              <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                {folders.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
                    표시할 폴더가 없습니다.
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
                자료
              </h3>

              <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                {items.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
                    표시할 자료가 없습니다.
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
                          color: "#6b7280",
                        }}
                      >
                        등록일: {getDateTimeLabel(item.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
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
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>
                자료 다운로드 기록
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                누가 언제 어떤 docs 자료를 다운로드했는지 확인합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={loadDownloadLogs}
              disabled={downloadLogsLoading}
              style={{
                ...buttonStyle,
                opacity: downloadLogsLoading ? 0.6 : 1,
              }}
            >
              {downloadLogsLoading ? "새로고침 중..." : "다운로드 기록 새로고침"}
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
                minWidth: "1180px",
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {[
                    "다운로드 시각",
                    "사용자",
                    "사용자 UUID",
                    "주차",
                    "강사명",
                    "파일명",
                    "WebDAV 경로",
                    "Entry ID",
                  ].map((title) => (
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
                  ))}
                </tr>
              </thead>

              <tbody>
                {downloadLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: "18px",
                        textAlign: "center",
                        color: "#6b7280",
                        fontSize: "14px",
                      }}
                    >
                      다운로드 기록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  downloadLogs.map((log) => (
                    <tr key={log.log_id}>
                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                          fontWeight: 800,
                        }}
                      >
                        {getDateTimeLabel(log.downloaded_at)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <strong>{log.user_name ?? "이름 없음"}</strong>
                        <br />
                        {log.user_email ?? "이메일 없음"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "12px",
                          color: "#6b7280",
                          fontFamily: "monospace",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.user_id ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.week_name ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.teacher_name ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "13px",
                          color: "#111827",
                          whiteSpace: "nowrap",
                          fontWeight: 700,
                        }}
                      >
                        {log.file_name ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "12px",
                          color: "#6b7280",
                          fontFamily: "monospace",
                          wordBreak: "break-all",
                          minWidth: "280px",
                        }}
                      >
                        {log.webdav_path ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #f3f4f6",
                          fontSize: "12px",
                          color: "#6b7280",
                          fontFamily: "monospace",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.entry_id ?? "-"}
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
