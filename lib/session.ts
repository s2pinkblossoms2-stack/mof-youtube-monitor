// 공유 비밀번호 접근 제한: 로그인 상태를 담는 쿠키 값 만들기와 확인 (서버 전용).
// 쿠키에는 "만료 시각.서명"만 담고, 서명은 SESSION_SECRET으로 만든다. 서명이 맞지 않으면 로그인으로 보지 않는다.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "./env";

export const SESSION_COOKIE = "mof_session";
export const SESSION_DAYS = 7;

function sign(expiresAt: string, secret: string): string {
  return createHmac("sha256", secret).update(expiresAt).digest("hex");
}

export function createSessionToken(now = Date.now()): string {
  const expiresAt = String(now + SESSION_DAYS * 86_400_000);
  return `${expiresAt}.${sign(expiresAt, requireEnv("SESSION_SECRET"))}`;
}

// 설정이 빠졌거나 값이 이상하면 언제나 false (접근을 열어 두지 않는다)
export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature || !/^\d+$/.test(expiresAt)) return false;
  if (Number(expiresAt) <= now) return false;
  let secret: string;
  try {
    secret = requireEnv("SESSION_SECRET");
  } catch {
    return false;
  }
  const given = Buffer.from(signature);
  const expected = Buffer.from(sign(expiresAt, secret));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// 입력한 비밀번호가 맞는지. 길이가 달라도 같은 시간이 걸리도록 해시로 바꿔 비교한다.
export function checkPassword(input: string): boolean {
  let password: string;
  try {
    password = requireEnv("APP_ACCESS_PASSWORD");
  } catch {
    return false;
  }
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(input), hash(password));
}
