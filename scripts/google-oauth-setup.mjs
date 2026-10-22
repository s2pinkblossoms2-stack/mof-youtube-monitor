// 채널 관리자 인증(OAuth)을 처음 한 번 받아서 .env에 저장하는 도구다 (내 컴퓨터에서만 실행).
//
// 사용법: 프로젝트 폴더에서  node scripts/google-oauth-setup.mjs
//  1) 터미널에 나오는 주소를 크롬에 붙여넣어 연다.
//  2) 재정경제부 채널 관리 권한이 있는 구글 계정으로 로그인하고, 채널을 고른 뒤 권한을 허용한다.
//  3) 끝나면 GOOGLE_OAUTH_REFRESH_TOKEN이 .env에 저장된다. 토큰 값은 화면에 출력하지 않는다.
//
// 필요한 .env 값: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET (구글 클라우드 "데스크톱 앱" 인증 정보)
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const ENV_PATH = new URL("../.env", import.meta.url);
// youtube.force-ssl: 댓글 읽기·삭제 / yt-analytics.readonly: 구독자 정확값 계산에 쓰는 보고서 읽기
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];
const TIMEOUT_MS = 10 * 60 * 1000;

function readEnv() {
  return readFileSync(ENV_PATH, "utf8");
}
function getVar(env, name) {
  const m = new RegExp(`^${name}=(.*)$`, "m").exec(env);
  return m ? m[1].replace(/\r/g, "").trim() : "";
}
function setVar(env, name, value) {
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, "m");
  if (re.test(env)) return env.replace(re, line);
  return (env.endsWith("\n") || env === "" ? env : env + "\n") + line + "\n";
}
const base64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const env = readEnv();
const clientId = getVar(env, "GOOGLE_OAUTH_CLIENT_ID");
const clientSecret = getVar(env, "GOOGLE_OAUTH_CLIENT_SECRET");
if (!clientId || !clientSecret) {
  console.error(".env에 GOOGLE_OAUTH_CLIENT_ID와 GOOGLE_OAUTH_CLIENT_SECRET을 먼저 넣어 주세요.");
  process.exit(1);
}

const state = base64url(randomBytes(16));
const verifier = base64url(randomBytes(32));
const challenge = base64url(createHash("sha256").update(verifier).digest());

const server = createServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const redirectUri = `http://127.0.0.1:${server.address().port}`;

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: SCOPES.join(" "),
  access_type: "offline", // 오래 쓰는 열쇠(refresh token)를 받는다
  prompt: "consent",
  state,
  code_challenge: challenge,
  code_challenge_method: "S256",
}).toString();

console.log("\n아래 주소를 크롬에 붙여넣어 여세요 (재정경제부 채널 관리 권한이 있는 계정으로 로그인):\n");
console.log(authUrl.toString());
console.log("\n허용이 끝날 때까지 이 창을 닫지 마세요. (최대 10분)\n");

const code = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("10분이 지나 중단했습니다. 다시 실행해 주세요.")), TIMEOUT_MS);
  server.on("request", (req, res) => {
    const url = new URL(req.url, redirectUri);
    if (url.searchParams.get("state") !== state) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("잘못된 요청입니다.");
      return;
    }
    const error = url.searchParams.get("error");
    const got = url.searchParams.get("code");
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error ? "허용하지 않아 중단했습니다. 터미널을 확인하세요." : "완료되었습니다. 이 창을 닫고 터미널로 돌아가세요.");
    clearTimeout(timer);
    if (error) reject(new Error(`허용하지 않았습니다 (${error}).`));
    else resolve(got);
  });
}).finally(() => server.close());

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  }),
});
const token = await tokenRes.json();
if (!tokenRes.ok || !token.refresh_token) {
  console.error("열쇠를 받지 못했습니다:", token.error_description || token.error || "refresh token 없음");
  console.error("이미 같은 앱을 허용한 적이 있으면 구글 계정의 '서드 파티 앱 연결'에서 이 앱을 지운 뒤 다시 실행해 보세요.");
  process.exit(1);
}

// 받은 열쇠를 .env에 저장한다 (화면에는 출력하지 않는다)
writeFileSync(ENV_PATH, setVar(readEnv(), "GOOGLE_OAUTH_REFRESH_TOKEN", token.refresh_token));

// 어느 채널로 허용했는지 확인하려고 채널 이름만 읽어 보여 준다
const me = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
  headers: { Authorization: `Bearer ${token.access_token}` },
});
const meBody = await me.json();
const channel = meBody.items?.[0];
console.log("저장했습니다: .env의 GOOGLE_OAUTH_REFRESH_TOKEN");
console.log("허용된 권한:", token.scope);
console.log(
  channel
    ? `연결된 채널: ${channel.snippet.title} (${channel.id})`
    : "연결된 채널을 읽지 못했습니다. 채널 선택 단계에서 재정경제부 채널을 골랐는지 확인하세요.",
);
