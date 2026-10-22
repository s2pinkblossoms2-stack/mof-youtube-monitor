// 서버에서만 읽는 환경변수 모음이다.
// NEXT_PUBLIC_ 접두사를 쓰지 않으므로 값이 브라우저로 나가지 않는다 (서버 코드에서만 import할 것).
// 값은 로그나 오류 메시지에 절대 출력하지 않고, 빠진 변수의 이름만 알린다.

// 기능별로 필요한 환경변수 이름 (용도는 DESIGN.md 4장 참고)
export const ENV_GROUPS = {
  // 유튜브 공개 정보 읽기
  youtube: ["YOUTUBE_API_KEY", "YOUTUBE_CHANNEL_ID"],
  // 채널 관리자 권한 (구독자 정확값, 댓글 삭제)
  googleOAuth: [
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "GOOGLE_OAUTH_REFRESH_TOKEN",
  ],
  // 저장소 (서비스 실행 중 접속용)
  supabase: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  // 댓글 분류와 답글 초안
  openai: ["OPENAI_API_KEY"],
  // 자동 실행 주소 보호
  cron: ["CRON_SECRET"],
  // 공유 비밀번호 접근 제한
  access: ["APP_ACCESS_PASSWORD", "SESSION_SECRET"],
} as const;

export type EnvGroup = keyof typeof ENV_GROUPS;
export type EnvName = (typeof ENV_GROUPS)[EnvGroup][number];

// 비어 있지 않은 값만 "있는 것"으로 본다.
function readEnv(name: EnvName): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : undefined;
}

// 필요한 값을 읽는다. 없으면 이름만 담아 오류를 던진다 (값은 출력하지 않음).
export function requireEnv(name: EnvName): string {
  const value = readEnv(name);
  if (value === undefined) {
    throw new Error(`환경변수 ${name}이(가) 설정되지 않았습니다. .env 또는 Vercel 환경변수를 확인하세요.`);
  }
  return value;
}

// 기능 묶음에서 빠진 변수 이름 목록 (모두 있으면 빈 배열)
export function missingEnvNames(group: EnvGroup): EnvName[] {
  return ENV_GROUPS[group].filter((name) => readEnv(name) === undefined);
}
