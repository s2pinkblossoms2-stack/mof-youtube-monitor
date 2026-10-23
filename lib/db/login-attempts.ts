// login_attempts 표 읽기·쓰기 (서버 전용). 로그인 시도 횟수를 세어 비밀번호 대입을 막는다.
import { dbError, getDb } from "./client";

export type AttemptCounts = { client: number; total: number };

// 시도를 먼저 기록한 뒤 최근 시간 안의 횟수를 센다 (동시에 여러 요청이 와도 서로의 기록이 함께 세어지게).
export async function recordAndCount(clientKey: string, windowMs: number, now = new Date()): Promise<AttemptCounts> {
  const db = getDb();
  const since = new Date(now.getTime() - windowMs).toISOString();

  const inserted = await db.from("login_attempts").insert({ client_key: clientKey, attempted_at: now.toISOString() });
  if (inserted.error) throw dbError("로그인 시도 기록", inserted.error);

  const [client, total] = await Promise.all([
    db.from("login_attempts").select("id", { count: "exact", head: true }).eq("client_key", clientKey).gte("attempted_at", since),
    db.from("login_attempts").select("id", { count: "exact", head: true }).gte("attempted_at", since),
  ]);
  if (client.error) throw dbError("로그인 시도 횟수 읽기", client.error);
  if (total.error) throw dbError("로그인 시도 횟수 읽기", total.error);
  return { client: client.count ?? 0, total: total.count ?? 0 };
}

// 로그인에 성공하면 그 접속의 시도 기록을 지운다 (오타 몇 번이 다음 로그인을 막지 않게)
export async function clearAttempts(clientKey: string): Promise<void> {
  const { error } = await getDb().from("login_attempts").delete().eq("client_key", clientKey);
  if (error) throw dbError("로그인 시도 기록 지우기", error);
}

// 하루가 지난 시도 기록을 지운다 (정리 실행에서 부른다)
export async function purgeOldAttempts(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - 86_400_000).toISOString();
  const { data, error } = await getDb().from("login_attempts").delete().lt("attempted_at", cutoff).select("id");
  if (error) throw dbError("지난 로그인 시도 정리", error);
  return data?.length ?? 0;
}
