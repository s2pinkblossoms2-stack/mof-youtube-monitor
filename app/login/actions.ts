"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkLoginThrottle, clientKeyFrom, resetLoginThrottle } from "@/lib/login-throttle";
import { safeNext } from "@/lib/safe-next";
import { checkPassword, createSessionToken, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

export type LoginState = { error: string };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  // 시도 횟수 제한: 비밀번호를 확인하기 전에 이번 시도를 기록하고, 너무 많으면 맞는 비밀번호여도 막는다
  let clientKey: string;
  try {
    clientKey = clientKeyFrom(await headers());
    if ((await checkLoginThrottle(clientKey)).blocked) {
      await wait(1000);
      return { error: "로그인 시도가 너무 많습니다. 15분 뒤에 다시 시도해 주세요." };
    }
  } catch (error) {
    // 횟수를 세지 못하면 안전하게 막는다 (저장소가 안 되면 서비스도 안 되는 상태라 사용에 큰 차이 없음)
    console.error("로그인 횟수 제한 오류:", error instanceof Error ? error.message : error);
    return { error: "지금은 로그인할 수 없습니다. 잠시 뒤 다시 시도해 주세요." };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || !checkPassword(password)) {
    // 비밀번호를 계속 바꿔 넣어 보는 시도를 늦춘다
    await wait(1000);
    return { error: "비밀번호가 맞지 않습니다." };
  }
  await resetLoginThrottle(clientKey).catch(() => undefined); // 성공하면 이 접속의 실패 기록을 지운다
  let token: string;
  try {
    token = createSessionToken();
  } catch {
    return { error: "서버 설정이 완료되지 않았습니다. 관리자에게 알려 주세요." };
  }
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // 화면 속 코드가 읽을 수 없게 한다
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
