// 새 댓글 수집과 분류 (서버 전용). 수집 5분 뒤 실행에서 부른다.
import { listActiveVideos } from "../db/videos";
import { existingCommentIds, insertComments, listUnclassified, saveClassification } from "../db/comments";
import { getVideoTexts, listDraftTargets, saveDraft } from "../db/drafts";
import { generateDraft } from "./draft";
import { fetchReferenceTexts } from "./references";
import { isWithinVideoWindow } from "../time";
import { fetchCommentPage } from "../youtube/comments";
import { classifyBatch } from "./classify";
import { hasPersonalInfo } from "./pii";

const MAX_PAGES_PER_VIDEO = 5; // 영상 하나에서 한 번에 읽는 최대 페이지 (한 페이지 100개)
const BATCH_SIZE = 20;
const PARALLEL_BATCHES = 3;

export type CommentRunResult = { collected: number; classified: number; personalInfo: number; pending: number };

// 14일 이내 영상의 새 최상위 댓글을 저장한다. 이미 저장한 댓글을 만나면 그 영상은 거기서 멈춘다.
export async function collectNewComments(now: Date, deadline: number): Promise<number> {
  const videos = (await listActiveVideos()).filter((v) => isWithinVideoWindow(new Date(v.uploadedAt), now));
  let collected = 0;
  for (const video of videos) {
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES_PER_VIDEO && Date.now() < deadline; page++) {
      const res = await fetchCommentPage(video.id, pageToken);
      if (res.commentsDisabled) break;
      const known = await existingCommentIds(res.comments.map((c) => c.id));
      const fresh = res.comments.filter((c) => !known.has(c.id));
      await insertComments(fresh.map((c) => ({ ...c, collectedAt: now.toISOString() })));
      collected += fresh.length;
      if (known.size > 0 || !res.nextPageToken) break;
      pageToken = res.nextPageToken;
    }
  }
  return collected;
}

// 초안 대상 댓글에 답글 초안을 만든다. 만들지 못한 댓글은 초안 없이 남겨 다음 실행에서 다시 시도한다.
export async function draftPending(deadline: number, limit = 50): Promise<{ drafted: number; needsCheck: number; pending: number }> {
  const targets = await listDraftTargets(limit);
  if (targets.length === 0) return { drafted: 0, needsCheck: 0, pending: 0 };
  const [videos, references] = await Promise.all([
    getVideoTexts([...new Set(targets.map((t) => t.videoId))]),
    fetchReferenceTexts(),
  ]);

  let drafted = 0;
  let needsCheck = 0;
  for (let i = 0; i < targets.length && Date.now() < deadline; i += PARALLEL_BATCHES) {
    const group = targets.slice(i, i + PARALLEL_BATCHES);
    const results = await Promise.allSettled(
      group.map(async (t) => {
        const video = videos.get(t.videoId);
        const draft = await generateDraft({
          comment: t.body,
          videoTitle: video?.title ?? "",
          videoDescription: video?.description ?? "",
          references,
        });
        await saveDraft(t.commentId, draft.text, draft.needsCheck);
        return draft;
      }),
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      drafted++;
      if (r.value.needsCheck) needsCheck++;
    }
  }
  return { drafted, needsCheck, pending: targets.length - drafted };
}

// 분류하지 않은 댓글을 분류한다. 개인정보는 AI에 보내지 않고 바로 "개인정보 포함"으로 표시한다.
// AI 호출이 실패한 댓글은 분류하지 않은 채로 남겨 다음 실행에서 다시 시도한다.
export async function classifyPending(deadline: number, limit = 200): Promise<Omit<CommentRunResult, "collected">> {
  const pending = await listUnclassified(limit);
  let personalInfo = 0;
  const forAi: { id: string; body: string }[] = [];
  for (const c of pending) {
    if (hasPersonalInfo(c.body)) {
      await saveClassification(c.id, { kind: "excluded", reason: "personal_info" });
      personalInfo++;
    } else {
      forAi.push(c);
    }
  }

  let classified = 0;
  const batches: { id: string; body: string }[][] = [];
  for (let i = 0; i < forAi.length; i += BATCH_SIZE) batches.push(forAi.slice(i, i + BATCH_SIZE));
  for (let i = 0; i < batches.length && Date.now() < deadline; i += PARALLEL_BATCHES) {
    const group = batches.slice(i, i + PARALLEL_BATCHES);
    const results = await Promise.allSettled(group.map((b) => classifyBatch(b)));
    for (const r of results) {
      if (r.status !== "fulfilled") continue; // 실패한 묶음은 다음 실행에서 다시
      for (const [id, cls] of r.value) {
        await saveClassification(id, cls);
        classified++;
      }
    }
  }
  return { classified, personalInfo, pending: pending.length - personalInfo - classified };
}
