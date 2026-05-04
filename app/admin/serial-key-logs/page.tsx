"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type IssueLog = {
  id: string;
  issued_by: string | null;
  issuer_email: string | null;
  issuer_name: string | null;
  issuer_role: string | null;
  duration_days: number;
  issued_count: number;
  created_at: string;
};

export default function SerialKeyLogsPage() {
  const router = useRouter();

  const [logs, setLogs] = useState<IssueLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLogsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.rpc("get_serial_key_issue_logs");

    setLogsLoading(false);
    setLoading(false);

    if (error) {
      setErrorMessage(error.message || "시리얼키 발급 로그를 불러오지 못했습니다.");
      return;
    }

    setLogs((data ?? []) as IssueLog[]);
  }

  function getDateTimeLabel(dateText: string) {
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

  if (loading) {
    return (
      <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff", fontFamily: "Arial, sans-serif" }}>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>발급 로그를 불러오는 중입니다...</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100dvh", background: "#ffffff", fontFamily: "Arial, sans-serif" }}>
      <header style={{ borderBottom: "1px solid #e5e7eb", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", boxSizing: "border-box" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#111827" }}>
            시리얼키 발급 로그
          </h1>

          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
            슈퍼유저 전용 로그입니다. 실제 시리얼키 코드는 표시하지 않습니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => router.push("/admin/serial-keys")} style={{ border: "1px solid #d1d5db", borderRadius: "10px", background: "#ffffff", color: "#111827", padding: "9px 12px", fontSize: "13px", fontWeight: 700 }}>
            시리얼키 관리
          </button>

          <button onClick={() => router.push("/admin")} style={{ border: "1px solid #d1d5db", borderRadius: "10px", background: "#ffffff", color: "#111827", padding: "9px 12px", fontSize: "13px", fontWeight: 700 }}>
            관리자
          </button>
        </div>
      </header>

      <section style={{ maxWidth: "1000px", margin: "0 auto", padding: "28px 20px", boxSizing: "border-box" }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "20px", padding: "24px", boxShadow: "0 10px 30px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#111827" }}>
                발급 로그
              </h2>

              <p style={{ marginTop: "8px", fontSize: "14px", color: "#6b7280" }}>
                누가 몇 일권을 몇 개 발급했는지만 표시합니다.
              </p>
            </div>

            <button onClick={loadLogs} disabled={logsLoading} style={{ border: "1px solid #d1d5db", borderRadius: "10px", background: "#ffffff", color: "#111827", padding: "10px 12px", fontSize: "13px", fontWeight: 800, opacity: logsLoading ? 0.6 : 1 }}>
              {logsLoading ? "새로고침 중..." : "새로고침"}
            </button>
          </div>

          {errorMessage && (
            <div style={{ marginTop: "18px", border: "1px solid #fecaca", borderRadius: "14px", background: "#fff1f2", padding: "14px", color: "#991b1b", fontSize: "14px" }}>
              {errorMessage}
            </div>
          )}

          <div style={{ marginTop: "20px", overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "14px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["발급자", "발급 내용", "발급 시각"].map((title) => (
                    <th key={title} style={{ padding: "12px", textAlign: "left", fontSize: "13px", color: "#6b7280", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: "18px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>
                      발급 로그가 없습니다.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#111827", whiteSpace: "nowrap" }}>
                        {log.issuer_name ?? "이름 없음"} · {log.issuer_email ?? "이메일 없음"}
                      </td>

                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#111827", fontWeight: 800, whiteSpace: "nowrap" }}>
                        {log.duration_days}일권 {log.issued_count}개 발급
                      </td>

                      <td style={{ padding: "12px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", color: "#6b7280", whiteSpace: "nowrap" }}>
                        {getDateTimeLabel(log.created_at)}
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
