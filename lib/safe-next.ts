// 로그인 뒤 돌아갈 주소 검사. 이 서비스의 화면 주소만 허용한다 (다른 사이트로 보내는 주소 방지).
// 허용 목록 방식이라 "/\evil.com", "/%09/evil.com", "//evil.com" 같은 값은 모두 기본 화면(/report)으로 바뀐다.

const ALLOWED_PATHS = new Set(["/", "/report", "/comments"]);
const DEFAULT_PATH = "/report"; // 로그인 뒤 기본으로 가는 곳: 숫자 화면
// 백슬래시, 탭·줄바꿈 같은 제어문자, 공백은 브라우저가 다른 글자로 해석할 수 있어 아예 거절한다
const FORBIDDEN = /[\\\u0000- \u007f-\u009f]/;

export function safeNext(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return DEFAULT_PATH;
  if (!value.startsWith("/") || value.startsWith("//") || FORBIDDEN.test(value)) return DEFAULT_PATH;

  let url: URL;
  try {
    // 가짜 주소를 기준으로 풀어 봐서, 결과가 같은 곳(origin)에 머무는지 확인한다
    url = new URL(value, "http://internal.invalid");
  } catch {
    return DEFAULT_PATH;
  }
  if (url.origin !== "http://internal.invalid") return DEFAULT_PATH;
  if (!ALLOWED_PATHS.has(url.pathname)) return DEFAULT_PATH;
  return `${url.pathname}${url.search}`;
}
