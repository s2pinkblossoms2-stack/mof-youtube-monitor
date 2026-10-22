// 답글 초안 대상 읽기와 초안 저장 (서버 전용).
import { dbError, getDb } from "./client";

export type DraftTarget = { commentId: string; body: string; videoId: string };

// 초안 대상("draft")으로 분류됐는데 아직 초안이 없는 댓글 (오래된 것부터)
export async function listDraftTargets(limit: number): Promise<DraftTarget[]> {
  const { data, error } = await getDb()
    .from("comments")
    .select("id, body, video_id, reply_drafts(comment_id)")
    .eq("class_kind", "draft")
    .order("collected_at", { ascending: true })
    .limit(limit * 4); // 이미 초안이 있는 댓글이 앞에 섞여 있을 수 있어 넉넉히 읽는다
  if (error) throw dbError("초안 대상 읽기", error);
  // 댓글 하나에 초안은 하나라 연결된 초안이 배열이 아닌 객체로 올 수 있다 (없으면 null)
  const hasDraft = (d: unknown) => (Array.isArray(d) ? d.length > 0 : d !== null && d !== undefined);
  return (data ?? [])
    .filter((r) => !hasDraft(r.reply_drafts))
    .slice(0, limit)
    .map((r) => ({ commentId: r.id as string, body: r.body as string, videoId: r.video_id as string }));
}

export async function getVideoTexts(
  ids: string[],
): Promise<Map<string, { title: string; description: string }>> {
  const map = new Map<string, { title: string; description: string }>();
  if (ids.length === 0) return map;
  const { data, error } = await getDb().from("videos").select("id, title, description").in("id", ids);
  if (error) throw dbError("영상 설명 읽기", error);
  for (const r of data ?? []) map.set(r.id as string, { title: r.title as string, description: r.description as string });
  return map;
}

// 담당자가 [복사]할 때 고친 글과 사용 시각을 저장한다 ("초안 활용 90%" 측정용).
// 초안이 있는 댓글만 대상이고, 저장된 줄 수를 돌려준다 (0이면 초안이 없는 댓글).
export async function markCopied(commentId: string, finalText: string): Promise<number> {
  const { data, error } = await getDb()
    .from("reply_drafts")
    .update({ final_text: finalText, used_at: new Date().toISOString() })
    .eq("comment_id", commentId)
    .select("comment_id");
  if (error) throw dbError("복사 기록 저장", error);
  return data?.length ?? 0;
}

// 초안 저장 (이미 있으면 건드리지 않는다: 담당자가 고친 글을 덮어쓰지 않기 위해)
export async function saveDraft(commentId: string, text: string, needsCheck: boolean): Promise<void> {
  const { error } = await getDb()
    .from("reply_drafts")
    .upsert({ comment_id: commentId, text, needs_check: needsCheck }, { onConflict: "comment_id", ignoreDuplicates: true });
  if (error) throw dbError("초안 저장", error);
}
