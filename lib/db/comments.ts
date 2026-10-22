// comments 표 읽기·쓰기 (서버 전용).
import type { CommentClass } from "../types";
import { dbError, getDb } from "./client";

export type NewCommentRow = {
  id: string;
  videoId: string;
  authorName: string;
  body: string;
  publishedAt: string;
  collectedAt: string;
};

// 주어진 댓글 ID 중 이미 저장된 것
export async function existingCommentIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await getDb().from("comments").select("id").in("id", ids);
  if (error) throw dbError("저장된 댓글 확인", error);
  return new Set((data ?? []).map((r) => r.id as string));
}

// 새 댓글 저장 (같은 ID는 건너뛴다)
export async function insertComments(rows: NewCommentRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await getDb()
    .from("comments")
    .upsert(
      rows.map((r) => ({
        id: r.id,
        video_id: r.videoId,
        author_name: r.authorName,
        body: r.body,
        published_at: r.publishedAt,
        collected_at: r.collectedAt,
      })),
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (error) throw dbError("새 댓글 저장", error);
}

// 아직 분류하지 않은 댓글 (오래된 것부터)
export async function listUnclassified(limit: number): Promise<{ id: string; body: string }[]> {
  const { data, error } = await getDb()
    .from("comments")
    .select("id, body")
    .is("class_kind", null)
    .order("collected_at", { ascending: true })
    .limit(limit);
  if (error) throw dbError("분류 전 댓글 읽기", error);
  return (data ?? []) as { id: string; body: string }[];
}

export async function saveClassification(id: string, cls: CommentClass): Promise<void> {
  const { error } = await getDb()
    .from("comments")
    .update({
      class_kind: cls.kind,
      exclude_reason: cls.kind === "excluded" ? cls.reason : null,
    })
    .eq("id", id);
  if (error) throw dbError("댓글 분류 저장", error);
}
