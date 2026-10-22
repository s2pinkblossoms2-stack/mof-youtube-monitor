// 댓글 화면에 필요한 저장 값 읽기 (서버 전용).
import type { ExcludeReason } from "../types";
import { dbError, getDb } from "./client";

export type CommentTab = "drafts" | "excluded";

export type CommentCard = {
  id: string;
  body: string;
  authorName: string;
  publishedAt: string;
  videoId: string;
  videoTitle: string;
  excludeReason: ExcludeReason | null;
  draft: {
    text: string; // AI가 만든 초안
    needsCheck: boolean;
    finalText: string | null; // [복사] 때 저장한 담당자 수정본
    usedAt: string | null;
  } | null; // 초안 대상인데 아직 만들어지지 않았으면 null
};

export type CommentCounts = { drafts: number; excluded: number; unclassified: number };

// 연결된 표는 한 줄이면 객체, 여러 줄이면 배열, 없으면 null로 온다
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type Row = {
  id: string;
  body: string;
  author_name: string;
  published_at: string;
  video_id: string;
  exclude_reason: ExcludeReason | null;
  videos: { title: string } | { title: string }[] | null;
  reply_drafts:
    | { text: string; needs_check: boolean; final_text: string | null; used_at: string | null }
    | { text: string; needs_check: boolean; final_text: string | null; used_at: string | null }[]
    | null;
};

export async function listCommentCards(tab: CommentTab, limit = 200): Promise<CommentCard[]> {
  const { data, error } = await getDb()
    .from("comments")
    .select(
      "id, body, author_name, published_at, video_id, exclude_reason, videos(title), reply_drafts(text, needs_check, final_text, used_at)",
    )
    .eq("class_kind", tab === "drafts" ? "draft" : "excluded")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw dbError("댓글 읽기", error);

  return ((data ?? []) as unknown as Row[]).map((r) => {
    const d = one(r.reply_drafts);
    return {
      id: r.id,
      body: r.body,
      authorName: r.author_name,
      publishedAt: r.published_at,
      videoId: r.video_id,
      videoTitle: one(r.videos)?.title ?? "",
      excludeReason: r.exclude_reason,
      draft: d ? { text: d.text, needsCheck: d.needs_check, finalText: d.final_text, usedAt: d.used_at } : null,
    };
  });
}

export async function countComments(): Promise<CommentCounts> {
  const db = getDb();
  const head = { count: "exact", head: true } as const;
  const [drafts, excluded, unclassified] = await Promise.all([
    db.from("comments").select("id", head).eq("class_kind", "draft"),
    db.from("comments").select("id", head).eq("class_kind", "excluded"),
    db.from("comments").select("id", head).is("class_kind", null),
  ]);
  for (const r of [drafts, excluded, unclassified]) {
    if (r.error) throw dbError("댓글 수 읽기", r.error);
  }
  return { drafts: drafts.count ?? 0, excluded: excluded.count ?? 0, unclassified: unclassified.count ?? 0 };
}
