import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SerialKeyAction = "DISABLE" | "HIDE" | "RESTORE" | "DELETE";
type SerialKeyStatus = "ACTIVE" | "USED" | "DISABLED" | "HIDDEN";

type SerialKeyRow = {
  id: string;
  status: string;
  previous_status: string | null;
  used_by: string | null;
};

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "서버 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const accessToken = authorization.replace("Bearer ", "");

  let body: {
    serialKeyId?: string;
    action?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 데이터를 읽지 못했습니다." },
      { status: 400 }
    );
  }

  const serialKeyId = String(body.serialKeyId ?? "");
  const action = String(body.action ?? "") as SerialKeyAction;

  if (!serialKeyId) {
    return NextResponse.json(
      { error: "시리얼키 ID가 필요합니다." },
      { status: 400 }
    );
  }

  if (!["DISABLE", "HIDE", "RESTORE", "DELETE"].includes(action)) {
    return NextResponse.json(
      { error: "올바르지 않은 작업입니다." },
      { status: 400 }
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user: actorUser },
    error: actorError,
  } = await adminClient.auth.getUser(accessToken);

  if (actorError || !actorUser) {
    return NextResponse.json(
      { error: "로그인 정보를 확인할 수 없습니다." },
      { status: 401 }
    );
  }

  const { data: actorProfile, error: actorProfileError } = await adminClient
    .from("profiles")
    .select("id, role, status")
    .eq("id", actorUser.id)
    .single();

  if (actorProfileError || !actorProfile) {
    return NextResponse.json(
      { error: "관리자 프로필을 찾을 수 없습니다." },
      { status: 403 }
    );
  }

  if (
    actorProfile.status !== "ACTIVE" ||
    (actorProfile.role !== "ADMIN" && actorProfile.role !== "SUPER_USER")
  ) {
    return NextResponse.json(
      { error: "관리자 권한이 필요합니다." },
      { status: 403 }
    );
  }

  const { data: serialKeyData, error: serialKeyError } = await adminClient
    .from("serial_keys")
    .select("id, status, previous_status, used_by")
    .eq("id", serialKeyId)
    .single();

  if (serialKeyError || !serialKeyData) {
    return NextResponse.json(
      { error: "시리얼키를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const serialKey = serialKeyData as SerialKeyRow;
  const currentStatus = serialKey.status as SerialKeyStatus;
  const previousStatus = serialKey.previous_status as
    | "ACTIVE"
    | "USED"
    | "DISABLED"
    | null;
  const usedBy = serialKey.used_by;

  async function forfeitIfUsed() {
    if (currentStatus !== "USED" && !usedBy) {
      return null;
    }

    const { error: forfeitError } = await adminClient.rpc(
      "forfeit_serial_key_entitlement",
      {
        target_key_id: serialKeyId,
      }
    );

    return forfeitError;
  }

  if (action === "DELETE") {
    const { error } = await adminClient
      .from("serial_keys")
      .delete()
      .eq("id", serialKeyId);

    if (error) {
      return NextResponse.json(
        { error: `시리얼키를 완전 삭제하지 못했습니다. ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "DISABLE") {
    const { error } = await adminClient
      .from("serial_keys")
      .update({
        status: "DISABLED",
        previous_status: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", serialKeyId);

    if (error) {
      return NextResponse.json(
        { error: `시리얼키를 비활성화하지 못했습니다. ${error.message}` },
        { status: 500 }
      );
    }

    const forfeitError = await forfeitIfUsed();

    if (forfeitError) {
      return NextResponse.json(
        {
          error: `시리얼키는 비활성화되었지만 기간 몰수 처리에 실패했습니다. ${forfeitError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "HIDE") {
    if (currentStatus === "HIDDEN") {
      return NextResponse.json({ ok: true });
    }

    const safePreviousStatus = currentStatus === "USED" ? "USED" : "DISABLED";

    const { error } = await adminClient
      .from("serial_keys")
      .update({
        status: "HIDDEN",
        previous_status: safePreviousStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", serialKeyId);

    if (error) {
      return NextResponse.json(
        { error: `시리얼키를 숨김 처리하지 못했습니다. ${error.message}` },
        { status: 500 }
      );
    }

    const forfeitError = await forfeitIfUsed();

    if (forfeitError) {
      return NextResponse.json(
        {
          error: `시리얼키는 숨김 처리되었지만 기간 몰수 처리에 실패했습니다. ${forfeitError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "RESTORE") {
    if (currentStatus !== "HIDDEN") {
      return NextResponse.json(
        { error: "숨김 상태의 시리얼키만 복구할 수 있습니다." },
        { status: 400 }
      );
    }

    const restoredStatus = previousStatus === "USED" ? "USED" : "DISABLED";

    const { error } = await adminClient
      .from("serial_keys")
      .update({
        status: restoredStatus,
        previous_status: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", serialKeyId);

    if (error) {
      return NextResponse.json(
        { error: `시리얼키를 복구하지 못했습니다. ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: "처리할 수 없는 작업입니다." },
    { status: 400 }
  );
}
