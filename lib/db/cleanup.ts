// 보관 기간(14일)이 지난 데이터 정리 (서버 전용).
import { COMMENT_RETENTION_DAYS } from "../constants";
import { dbError, getDb } from "./client";
import { purgeOldAttempts } from "./login-attempts";

export type PurgeResult = { comments: number; deletionLogBodies: number; loginAttempts: number };

// 수집한 지 14일이 지난 댓글(답글 초안 포함)을 지우고,
// 삭제 기록의 댓글 원문도 14일 뒤 비운다 (누가·언제 기록은 남긴다).
export async function purgeExpired(now: Date): Promise<PurgeResult> {
  const cutoff = new Date(now.getTime() - COMMENT_RETENTION_DAYS * 86_400_000).toISOString();
  const db = getDb();

  const comments = await db.from("comments").delete().lt("collected_at", cutoff).select("id");
  if (comments.error) throw dbError("지난 댓글 삭제", comments.error);

  const logs = await db
    .from("deletion_logs")
    .update({ comment_body: null })
    .lt("deleted_at", cutoff)
    .not("comment_body", "is", null)
    .select("id");
  if (logs.error) throw dbError("삭제 기록 원문 비우기", logs.error);

  const loginAttempts = await purgeOldAttempts(now);

  return { comments: comments.data?.length ?? 0, deletionLogBodies: logs.data?.length ?? 0, loginAttempts };
}
