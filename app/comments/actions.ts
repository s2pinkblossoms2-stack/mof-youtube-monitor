"use server";

import { isLoggedIn } from "@/lib/auth";
import { markCopied } from "@/lib/db/drafts";

const MAX_LENGTH = 5000;

// 담당자가 초안을 [복사]했을 때 고친 글과 사용 시각을 남긴다. 유튜브에는 아무것도 올리지 않는다.
export async function markDraftCopied(
  commentId: string,
  finalText: string,
): Promise<{ ok: boolean; message?: string }> {
  // 서버 동작은 누구든 부를 수 있는 주소이므로 로그인 여부와 입력을 먼저 검사한다
  if (!(await isLoggedIn())) return { ok: false, message: "로그인이 필요합니다." };
  if (typeof commentId !== "string" || commentId.length === 0 || commentId.length > 100) {
    return { ok: false, message: "잘못된 요청입니다." };
  }
  if (typeof finalText !== "string" || finalText.trim() === "" || finalText.length > MAX_LENGTH) {
    return { ok: false, message: "답글 내용이 비어 있거나 너무 깁니다." };
  }
  try {
    const saved = await markCopied(commentId, finalText);
    return saved > 0 ? { ok: true } : { ok: false, message: "초안을 찾지 못했습니다." };
  } catch (error) {
    console.error("복사 기록 오류:", error instanceof Error ? error.message : error);
    return { ok: false, message: "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}
