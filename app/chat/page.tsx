"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type ChatColorThemeId =
  | "blue"
  | "green"
  | "purple"
  | "pink"
  | "orange"
  | "mint"
  | "indigo"
  | "slate";

type Profile = {
  id: string;
  email: string;
  name: string;
  status: "ACTIVE" | "DISABLED" | "HIDDEN";
  role: "USER" | "ADMIN" | "SUPER_USER";
  chat_color_theme: ChatColorThemeId | null;
};

type ChatMessage = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  chat_color_theme: ChatColorThemeId | null;
  content: string | null;
  is_deleted: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

type ChatColorTheme = {
  id: ChatColorThemeId;
  name: string;
  dotColor: string;
  lightBubble: string;
  darkBubble: string;
};

const chatColorThemes: ChatColorTheme[] = [
  {
    id: "blue",
    name: "블루",
    dotColor: "#2563EB",
    lightBubble: "#DBEAFE",
    darkBubble: "#1E3A8A",
  },
  {
    id: "green",
    name: "그린",
    dotColor: "#16A34A",
    lightBubble: "#DCFCE7",
    darkBubble: "#14532D",
  },
  {
    id: "purple",
    name: "퍼플",
    dotColor: "#9333EA",
    lightBubble: "#F3E8FF",
    darkBubble: "#581C87",
  },
  {
    id: "pink",
    name: "핑크",
    dotColor: "#DB2777",
    lightBubble: "#FCE7F3",
    darkBubble: "#831843",
  },
  {
    id: "orange",
    name: "오렌지",
    dotColor: "#EA580C",
    lightBubble: "#FFEDD5",
    darkBubble: "#7C2D12",
  },
  {
    id: "mint",
    name: "민트",
    dotColor: "#0D9488",
    lightBubble: "#CCFBF1",
    darkBubble: "#134E4A",
  },
  {
    id: "indigo",
    name: "인디고",
    dotColor: "#4F46E5",
    lightBubble: "#E0E7FF",
    darkBubble: "#312E81",
  },
  {
    id: "slate",
    name: "슬레이트",
    dotColor: "#475569",
    lightBubble: "#F1F5F9",
    darkBubble: "#334155",
  },
];

function getTheme(themeId: ChatColorThemeId | null | undefined) {
  return (
    chatColorThemes.find((theme) => theme.id === themeId) ?? chatColorThemes[0]
  );
}

function getInitialLetter(name: string) {
  return (name || "?").slice(0, 1);
}

function getDateDividerLabel(dateText: string) {
  return new Date(dateText).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDateKey(dateText: string) {
  const date = new Date(dateText);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function getTimeLabel(dateText: string) {
  return new Date(dateText).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function linkifyText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "inherit",
            textDecoration: "underline",
            fontWeight: 800,
            wordBreak: "break-all",
          }}
        >
          {part}
        </a>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export default function ChatPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [newMessage, setNewMessage] = useState("");
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [editingContent, setEditingContent] = useState("");

  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [actingMessageId, setActingMessageId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    await loadProfile();
    await loadMessages();
  }

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
      .select("id, email, name, status, role, chat_color_theme")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      setErrorMessage("사용자 프로필을 찾을 수 없습니다.");
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

  async function loadMessages() {
    setMessagesLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.rpc("get_chat_messages", {
      message_limit: 150,
    });

    setMessagesLoading(false);

    if (error) {
      setErrorMessage(error.message || "커뮤니티 메시지를 불러오지 못했습니다.");
      return;
    }

    setMessages((data ?? []) as ChatMessage[]);
  }

  async function sendMessage() {
    setErrorMessage("");
    setSuccessMessage("");

    const content = newMessage.trim();

    if (!content) {
      setErrorMessage("메시지를 입력해야 합니다.");
      return;
    }

    if (content.length > 2000) {
      setErrorMessage("메시지는 2000자 이하로 입력해야 합니다.");
      return;
    }

    setSending(true);

    const { error } = await supabase.rpc("send_chat_message", {
      new_content: content,
    });

    setSending(false);

    if (error) {
      setErrorMessage(error.message || "메시지를 보내지 못했습니다.");
      return;
    }

    setNewMessage("");
    await loadMessages();
  }

  function startEditMessage(message: ChatMessage) {
    if (message.is_deleted) {
      return;
    }

    setEditingMessage(message);
    setEditingContent(message.content ?? "");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function cancelEditMessage() {
    setEditingMessage(null);
    setEditingContent("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function saveEditMessage() {
    if (!editingMessage) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const content = editingContent.trim();

    if (!content) {
      setErrorMessage("수정할 메시지를 입력해야 합니다.");
      return;
    }

    if (content.length > 2000) {
      setErrorMessage("메시지는 2000자 이하로 입력해야 합니다.");
      return;
    }

    setSavingEdit(true);

    const { error } = await supabase.rpc("edit_chat_message", {
      target_message_id: editingMessage.id,
      new_content: content,
    });

    setSavingEdit(false);

    if (error) {
      setErrorMessage(error.message || "메시지를 수정하지 못했습니다.");
      return;
    }

    setEditingMessage(null);
    setEditingContent("");
    setSuccessMessage("메시지가 수정되었습니다.");
    await loadMessages();
  }

  async function cancelMessage(message: ChatMessage) {
    setErrorMessage("");
    setSuccessMessage("");

    const confirmed = window.confirm("이 메시지를 보내기 취소할까요?");

    if (!confirmed) {
      return;
    }

    setActingMessageId(message.id);

    const { error } = await supabase.rpc("cancel_chat_message", {
      target_message_id: message.id,
    });

    setActingMessageId(null);

    if (error) {
      setErrorMessage(error.message || "메시지를 보내기 취소하지 못했습니다.");
      return;
    }

    if (editingMessage?.id === message.id) {
      setEditingMessage(null);
      setEditingContent("");
    }

    setSuccessMessage("메시지가 보내기 취소되었습니다.");
    await loadMessages();
  }

  const profileTheme = useMemo(
    () => getTheme(profile?.chat_color_theme),
    [profile?.chat_color_theme]
  );

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
          커뮤니티를 불러오는 중입니다...
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
            커뮤니티
          </h1>

          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
            모든 유저가 함께 사용하는 서버 채팅입니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/streaming")} style={buttonStyle}>
            스트리밍
          </button>

          <button onClick={() => router.push("/account")} style={buttonStyle}>
            계정 설정
          </button>

          <button onClick={() => router.push("/home")} style={buttonStyle}>
            홈
          </button>
        </div>
      </header>

      <section
        style={{
          maxWidth: "920px",
          margin: "0 auto",
          padding: "24px 20px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "20px",
            padding: "18px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              borderRadius: "14px",
              background: "#f9fafb",
              padding: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "999px",
                  background: profileTheme.dotColor,
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: 900,
                  flex: "0 0 auto",
                }}
              >
                {getInitialLetter(profile?.name ?? "?")}
              </div>

              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: 900,
                    color: "#111827",
                    wordBreak: "break-all",
                  }}
                >
                  {profile?.name} · {profile?.email}
                </p>

                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "12px",
                    color: "#6b7280",
                  }}
                >
                  현재 채팅 프로필
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadMessages}
              disabled={messagesLoading}
              style={{
                ...buttonStyle,
                opacity: messagesLoading ? 0.6 : 1,
              }}
            >
              {messagesLoading ? "새로고침 중..." : "새로고침"}
            </button>
          </div>

          {errorMessage && (
            <div
              style={{
                marginTop: "14px",
                border: "1px solid #fecaca",
                borderRadius: "14px",
                background: "#fff1f2",
                padding: "12px",
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
                marginTop: "14px",
                border: "1px solid #bbf7d0",
                borderRadius: "14px",
                background: "#f0fdf4",
                padding: "12px",
                color: "#166534",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              {successMessage}
            </div>
          )}

          <div
            style={{
              marginTop: "18px",
              border: "1px solid #e5e7eb",
              borderRadius: "18px",
              background: "#f8fafc",
              padding: "16px",
              minHeight: "480px",
              maxHeight: "640px",
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  height: "440px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  color: "#6b7280",
                  fontSize: "14px",
                }}
              >
                아직 메시지가 없습니다. 첫 메시지를 남겨보세요.
              </div>
            ) : (
              messages.map((message, index) => {
                const previousMessage = messages[index - 1];
                const showDateDivider =
                  !previousMessage ||
                  getDateKey(previousMessage.created_at) !==
                    getDateKey(message.created_at);

                const isMine = profile?.id === message.user_id;
                const theme = getTheme(message.chat_color_theme);

                return (
                  <div key={message.id}>
                    {showDateDivider && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          margin: "18px 0",
                        }}
                      >
                        <div
                          style={{
                            height: "1px",
                            background: "#e5e7eb",
                            flex: 1,
                          }}
                        />

                        <div
                          style={{
                            borderRadius: "999px",
                            background: "#ffffff",
                            border: "1px solid #e5e7eb",
                            padding: "6px 12px",
                            fontSize: "12px",
                            fontWeight: 800,
                            color: "#6b7280",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {getDateDividerLabel(message.created_at)}
                        </div>

                        <div
                          style={{
                            height: "1px",
                            background: "#e5e7eb",
                            flex: 1,
                          }}
                        />
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: isMine ? "flex-end" : "flex-start",
                        marginBottom: "14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: isMine ? "row-reverse" : "row",
                          alignItems: "flex-start",
                          gap: "10px",
                          maxWidth: "84%",
                        }}
                      >
                        {!isMine && (
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "999px",
                              background: theme.dotColor,
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "13px",
                              fontWeight: 900,
                              flex: "0 0 auto",
                            }}
                          >
                            {getInitialLetter(message.user_name)}
                          </div>
                        )}

                        <div
                          style={{
                            display: "grid",
                            justifyItems: isMine ? "end" : "start",
                            minWidth: 0,
                          }}
                        >
                          <p
                            style={{
                              margin: "0 0 6px",
                              fontSize: "12px",
                              color: "#6b7280",
                              fontWeight: 800,
                              textAlign: isMine ? "right" : "left",
                              wordBreak: "break-all",
                            }}
                          >
                            {isMine
                              ? `${profile?.name ?? "나"} · 나`
                              : `${message.user_name} · ${message.user_email}`}
                          </p>

                          <div
                            style={{
                              borderRadius: "18px",
                              background: message.is_deleted
                                ? "#e5e7eb"
                                : theme.lightBubble,
                              color: message.is_deleted
                                ? "#6b7280"
                                : "#111827",
                              padding: "12px 14px",
                              fontSize: "14px",
                              lineHeight: 1.6,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              maxWidth: "100%",
                              boxSizing: "border-box",
                              fontStyle: message.is_deleted
                                ? "italic"
                                : "normal",
                            }}
                          >
                            {message.is_deleted
                              ? "삭제된 메시지입니다."
                              : linkifyText(message.content ?? "")}
                          </div>

                          <div
                            style={{
                              marginTop: "6px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: isMine ? "flex-end" : "flex-start",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <p
                              style={{
                                margin: 0,
                                fontSize: "12px",
                                color: "#9ca3af",
                              }}
                            >
                              {getTimeLabel(message.created_at)}
                              {message.edited_at && !message.is_deleted
                                ? " · 수정됨"
                                : ""}
                            </p>

                            {isMine && !message.is_deleted && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEditMessage(message)}
                                  style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "#6b7280",
                                    padding: 0,
                                    fontSize: "12px",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                  }}
                                >
                                  수정
                                </button>

                                <button
                                  type="button"
                                  disabled={actingMessageId === message.id}
                                  onClick={() => cancelMessage(message)}
                                  style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "#dc2626",
                                    padding: 0,
                                    fontSize: "12px",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    opacity:
                                      actingMessageId === message.id ? 0.6 : 1,
                                  }}
                                >
                                  보내기 취소
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {editingMessage && (
            <div
              style={{
                marginTop: "16px",
                border: "1px solid #d1d5db",
                borderRadius: "16px",
                background: "#f9fafb",
                padding: "14px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 900,
                  color: "#111827",
                }}
              >
                메시지 수정
              </p>

              <textarea
                value={editingContent}
                onChange={(event) => setEditingContent(event.target.value)}
                style={{
                  marginTop: "10px",
                  width: "100%",
                  minHeight: "90px",
                  boxSizing: "border-box",
                  border: "1px solid #d1d5db",
                  borderRadius: "12px",
                  padding: "12px",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  resize: "vertical",
                  fontFamily: "Arial, sans-serif",
                }}
              />

              <div
                style={{
                  marginTop: "10px",
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={saveEditMessage}
                  disabled={savingEdit}
                  style={{
                    border: "none",
                    borderRadius: "10px",
                    background: "#111827",
                    color: "#ffffff",
                    padding: "10px 12px",
                    fontSize: "13px",
                    fontWeight: 800,
                    opacity: savingEdit ? 0.6 : 1,
                  }}
                >
                  {savingEdit ? "저장 중..." : "수정 저장"}
                </button>

                <button
                  type="button"
                  onClick={cancelEditMessage}
                  disabled={savingEdit}
                  style={buttonStyle}
                >
                  취소
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: "16px",
              display: "grid",
              gap: "10px",
            }}
          >
            <textarea
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              placeholder="커뮤니티에 메시지를 입력하세요. 링크도 보낼 수 있습니다."
              style={{
                width: "100%",
                minHeight: "96px",
                boxSizing: "border-box",
                border: "1px solid #d1d5db",
                borderRadius: "14px",
                padding: "13px",
                fontSize: "14px",
                lineHeight: 1.6,
                resize: "vertical",
                fontFamily: "Arial, sans-serif",
              }}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: newMessage.length > 2000 ? "#dc2626" : "#9ca3af",
                  fontWeight: 700,
                }}
              >
                {newMessage.length}/2000
              </p>

              <button
                type="button"
                onClick={sendMessage}
                disabled={sending}
                style={{
                  border: "none",
                  borderRadius: "12px",
                  background: "#111827",
                  color: "#ffffff",
                  padding: "12px 18px",
                  fontSize: "14px",
                  fontWeight: 900,
                  opacity: sending ? 0.6 : 1,
                }}
              >
                {sending ? "전송 중..." : "보내기"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
