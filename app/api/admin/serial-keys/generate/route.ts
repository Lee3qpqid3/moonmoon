import { randomInt } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SERIAL_KEY_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateRawCode() {
  let result = "";

  for (let index = 0; index < 16; index += 1) {
    const randomIndex = randomInt(0, SERIAL_KEY_ALPHABET.length);
    result += SERIAL_KEY_ALPHABET[randomIndex];
  }

  return result;
}

function formatSerialKey(rawCode: string) {
  return [
    rawCode.slice(0, 4),
    rawCode.slice(4, 8),
    rawCode.slice(8, 12),
    rawCode.slice(12, 16),
  ].join("-");
}

function generateSerialKey() {
  return formatSerialKey(generateRawCode());
}

export async function POST(request: Request) {
  try {
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

    const body = await request.json();

    const durationDays = Number(body.durationDays);
    const count = Number(body.count);

    if (!Number.isInteger(durationDays) || durationDays <= 0) {
      return NextResponse.json(
        { error: "기간은 1일 이상이어야 합니다." },
        { status: 400 }
      );
    }

    if (durationDays > 3650) {
      return NextResponse.json(
        { error: "기간은 최대 3650일까지 설정할 수 있습니다." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(count) || count <= 0) {
      return NextResponse.json(
        { error: "발급 개수는 1개 이상이어야 합니다." },
        { status: 400 }
      );
    }

    if (count > 50) {
      return NextResponse.json(
        { error: "한 번에 최대 50개까지 발급할 수 있습니다." },
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

    const createdCodes: string[] = [];

    for (let index = 0; index < count; index += 1) {
      let created = false;

      for (let attempt = 0; attempt < 30; attempt += 1) {
        const code = generateSerialKey();

        const { data: existingKey, error: existingError } = await adminClient
          .from("serial_keys")
          .select("id")
          .eq("code", code)
          .maybeSingle();

        if (existingError) {
          return NextResponse.json(
            { error: "시리얼키 중복 검사 중 오류가 발생했습니다." },
            { status: 500 }
          );
        }

        if (existingKey) {
          continue;
        }

        const { error: insertError } = await adminClient
          .from("serial_keys")
          .insert({
            code,
            duration_days: durationDays,
            status: "ACTIVE",
            issued_by: actorProfile.id,
          });

        if (insertError) {
          continue;
        }

        createdCodes.push(code);
        created = true;
        break;
      }

      if (!created) {
        return NextResponse.json(
          {
            error: "시리얼키 생성에 실패했습니다. 다시 시도해 주세요.",
            createdCodes,
          },
          { status: 500 }
        );
      }
    }

    const { error: logError } = await adminClient
      .from("serial_key_issue_logs")
      .insert({
        issued_by: actorProfile.id,
        duration_days: durationDays,
        issued_count: count,
      });

    if (logError) {
      return NextResponse.json(
        {
          error: `시리얼키는 발급되었지만 발급 로그 저장에 실패했습니다. ${logError.message}`,
          codes: createdCodes,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      codes: createdCodes,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "알 수 없는 서버 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
