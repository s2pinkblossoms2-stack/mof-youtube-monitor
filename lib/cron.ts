// 자동 실행 주소 공통 코드 (서버 전용).
// Vercel은 CRON_SECRET이 설정돼 있으면 자동 실행 때 "Authorization: Bearer <CRON_SECRET>" 헤더를 붙여 부른다.
import { timingSafeEqual } from "node:crypto";
import { requireEnv } from "./env";

// 비밀 값이 맞지 않으면 바로 돌려줄 응답을 만든다. 맞으면 null (이어서 일을 하면 된다).
export function checkCronAuth(request: Request): Response | null {
  let secret: string;
  try {
    secret = requireEnv("CRON_SECRET");
  } catch {
    // 설정이 빠진 경우: 누구든 부를 수 있게 열어 두지 않고 거절한다
    return Response.json({ ok: false, message: "서버 설정이 완료되지 않았습니다." }, { status: 500 });
  }
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ ok: false, message: "권한이 없습니다." }, { status: 401 });
  }
  return null;
}

// 실행 결과를 응답으로 바꾼다. 실패(failed)나 오류는 500으로 알려 Vercel 기록에 남게 한다.
// 구독자 수 수집(channel)이 실패한 경우도 오류로 알려 Vercel 기록에서 바로 보이게 한다.
// 수집 시각 창 밖에서 실행돼 아무것도 저장하지 못한 경우(skipped)도 오류로 알린다: 그 보고 시각이 조용히 비지 않게.
export function resultResponse(result: { status: string; channel?: string }): Response {
  const ok = result.status !== "failed" && result.status !== "skipped" && result.channel !== "failed";
  return Response.json({ ok, ...result }, { status: ok ? 200 : 500 });
}

export function errorResponse(error: unknown): Response {
  // 오류 내용은 서버 기록에만 남기고, 응답에는 일반적인 문구만 담는다
  console.error("자동 실행 오류:", error instanceof Error ? error.message : error);
  return Response.json({ ok: false, message: "실행 중 오류가 발생했습니다." }, { status: 500 });
}
