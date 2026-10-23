// 로그인 시도 횟수 제한 (서버 전용). 비밀번호를 계속 바꿔 넣어 보는 공격(대입)을 막는다.
// 서버가 여러 개로 나뉘는 Vercel에서는 서버 안에 횟수를 기억할 수 없어서 저장소(Supabase)에 시도를 기록한다.
import { createHmac } from "node:crypto";
import { clearAttempts, recordAndCount } from "./db/login-attempts";
import { requireEnv } from "./env";

export const THROTTLE_WINDOW_MS = 15 * 60_000; // 최근 15분
export const MAX_ATTEMPTS_PER_CLIENT = 10; // 같은 접속(IP)에서 15분에 10번까지
export const MAX_ATTEMPTS_TOTAL = 100; // 모든 접속을 합쳐 15분에 100번까지 (여러 곳에서 나눠 시도하는 공격 대비)

// 접속 주소를 구한다. Vercel은 x-forwarded-for 맨 앞에 실제 접속 주소를 붙여 준다.
// 주소를 그대로 저장하지 않고 비밀 열쇠(SESSION_SECRET)로 섞은 값만 저장한다 (개인정보 최소화).
export function clientKeyFrom(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return createHmac("sha256", requireEnv("SESSION_SECRET")).update(`login:${ip}`).digest("hex").slice(0, 32);
}

export type ThrottleResult = { blocked: boolean };

// 이번 시도를 기록하고, 제한을 넘었으면 비밀번호를 확인하지 않고 막는다 (맞는 비밀번호여도 막는다).
export async function checkLoginThrottle(clientKey: string, now = new Date()): Promise<ThrottleResult> {
  const counts = await recordAndCount(clientKey, THROTTLE_WINDOW_MS, now);
  return { blocked: counts.client > MAX_ATTEMPTS_PER_CLIENT || counts.total > MAX_ATTEMPTS_TOTAL };
}

export async function resetLoginThrottle(clientKey: string): Promise<void> {
  await clearAttempts(clientKey);
}
