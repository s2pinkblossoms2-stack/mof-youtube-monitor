// 접근 제한: 로그인(공유 비밀번호)한 사람만 화면·엑셀·저장 동작을 쓸 수 있다.
// 자동 실행 주소(/api/cron)는 Vercel이 보내는 비밀 값(CRON_SECRET)으로 따로 보호하므로 여기서 제외한다.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();
  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  // 화면이 아닌 요청(API, 저장 동작)은 로그인 화면으로 보내지 않고 거절한다
  if (pathname.startsWith("/api/") || request.method !== "GET") {
    return Response.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // api/cron/ 아래만 제외한다 (끝에 /를 붙여, 나중에 만드는 api/cron-xxx 같은 주소가 로그인 없이 열리지 않게 함)
  matcher: ["/((?!api/cron/|_next/static|_next/image|favicon.ico).*)"],
};
