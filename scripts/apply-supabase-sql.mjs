// Supabase 저장소에 SQL 파일을 적용하는 도구다 (내 컴퓨터에서만 실행).
//
// 사용법: node scripts/apply-supabase-sql.mjs supabase/schema.sql
//  - SUPABASE_ACCESS_TOKEN 은 .env 에서 읽고, 값은 화면에 출력하지 않는다.
//  - schema.sql 은 여러 번 실행해도 안전하게 쓰여 있다 (이미 있으면 건너뛰거나 같은 값으로 다시 만든다).
import { readFileSync } from "node:fs";

const PROJECT_REF = "svntxgfcyhcbmtbvvkzm";
const file = process.argv[2];
if (!file) {
  console.error("적용할 SQL 파일 경로를 넣어 주세요. 예: node scripts/apply-supabase-sql.mjs supabase/schema.sql");
  process.exit(1);
}

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const token = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(env)?.[1] ?? "").replace(/\r/g, "").trim();
if (!token) {
  console.error(".env에 SUPABASE_ACCESS_TOKEN이 있어야 합니다.");
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: readFileSync(file, "utf8") }),
});
const body = await res.text();
console.log(res.ok ? "적용했습니다." : `실패 (${res.status}):`, res.ok ? "" : body.replaceAll(token, "***").slice(0, 400));
process.exit(res.ok ? 0 : 1);
