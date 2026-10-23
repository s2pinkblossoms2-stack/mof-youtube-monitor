"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { checkPassword, createSessionToken, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

export type LoginState = { error: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  if (typeof password !== "string" || !checkPassword(password)) {
    // 비밀번호를 계속 바꿔 넣어 보는 시도를 늦춘다
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { error: "비밀번호가 맞지 않습니다." };
  }
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
