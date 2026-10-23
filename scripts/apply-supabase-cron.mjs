// Supabase의 정기 실행(pg_cron)에 자동 실행 일정을 적용하는 도구다 (내 컴퓨터에서만 실행).
//
// 사용법: node scripts/apply-supabase-cron.mjs https://배포주소.vercel.app
//  - supabase/cron.sql 의 __APP_URL__ 과 __CRON_SECRET__ 을 바꿔 넣어 Supabase에 적용한다.
//  - CRON_SECRET 과 SUPABASE_ACCESS_TOKEN 은 .env 에서 읽고, 값은 화면에 출력하지 않는다.
//  - 여러 번 실행해도 일정이 중복되지 않는다 (mof- 로 시작하는 일정은 먼저 지우고 다시 만든다).
import { readFileSync } from "node:fs";

const PROJECT_REF = "svntxgfcyhcbmtbvvkzm";
const ENV_PATH = new URL("../.env", import.meta.url);
const SQL_PATH = new URL("../supabase/cron.sql", import.meta.url);

const appUrl = (process.argv[2] ?? "").replace(/\/+$/, "");
if (!/^https:\/\/[a-z0-9.-]+$/i.test(appUrl)) {
  console.error("배포 주소를 https://... 형태로 넣어 주세요. 예: node scripts/apply-supabase-cron.mjs https://mof-youtube-monitor.vercel.app");
  process.exit(1);
}

const env = readFileSync(ENV_PATH, "utf8");
const get = (name) => (new RegExp(`^${name}=(.*)$`, "m").exec(env)?.[1] ?? "").replace(/\r/g, "").trim();
const token = get("SUPABASE_ACCESS_TOKEN");
const cronSecret = get("CRON_SECRET");
if (!token || !cronSecret) {
  console.error(".env에 SUPABASE_ACCESS_TOKEN과 CRON_SECRET이 있어야 합니다.");
  process.exit(1);
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    // 오류 메시지에 비밀 값이 섞여 나오지 않도록 가려서 보여 준다
    console.error(`실패 (${res.status}):`, body.replaceAll(cronSecret, "***").slice(0, 400));
    process.exit(1);
  }
  return JSON.parse(body);
}

const sql = readFileSync(SQL_PATH, "utf8").replaceAll("__APP_URL__", appUrl).replaceAll("__CRON_SECRET__", cronSecret);
await query(sql);

// 적용 결과 확인: 일정 이름과 시각만 보여 준다 (명령 안의 비밀 값은 읽지 않는다)
const jobs = await query("select jobname, schedule, active from cron.job where jobname like 'mof-%' order by jobname");
console.log(`적용 완료: ${appUrl}`);
for (const j of jobs) console.log(` - ${j.jobname}  ${j.schedule}  ${j.active ? "켜짐" : "꺼짐"}`);
