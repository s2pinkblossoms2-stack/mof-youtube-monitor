// 서버 동작·API가 스스로 로그인 여부를 확인할 때 쓴다 (서버 전용).
// proxy.ts가 1차로 막지만, 설정이 바뀌어도 보호가 조용히 풀리지 않도록 각 동작 맨 앞에서 한 번 더 확인한다.
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export async function isLoggedIn(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}
