// 서비스에서 다루는 데이터의 모양이다 (표 구조는 DESIGN.md 3장과 같다).
import type { EXCLUDE_REASONS, REPORT_SLOTS } from "./constants";

// "10:00" | "14:00" | "17:00"
export type ReportSlot = (typeof REPORT_SLOTS)[number];

export type ExcludeReason = (typeof EXCLUDE_REASONS)[number];

// 수집 결과: 실패하면 값을 채우지 않고 "failed"로 남긴다
export type SnapshotStatus = "ok" | "failed";

export type VideoKind = "long" | "short";

export type Video = {
  id: string; // 유튜브 영상 ID
  title: string;
  description: string; // 답글 초안의 근거 자료로 쓴다
  kind: VideoKind;
  uploadedAt: string; // ISO 8601 (UTC)
  active: boolean; // 집계 대상 여부 (14일이 지나면 false)
};

// 영상별 수집 기록. 값은 유튜브가 준 그대로 저장한다 (반올림·보정 금지).
export type VideoSnapshot = {
  videoId: string;
  collectedAt: string; // 실제 수집한 시각 (ISO 8601)
  reportDate: string; // 보고 날짜 (한국 시간, YYYY-MM-DD)
  reportSlot: ReportSlot;
  status: SnapshotStatus;
  viewCount: number | null; // status가 failed이면 null
  commentCount: number | null;
};

// 채널 전체 구독자 수 기록
export type ChannelSnapshot = {
  collectedAt: string;
  reportDate: string;
  reportSlot: ReportSlot;
  status: SnapshotStatus;
  subscriberCount: number | null; // 자동 수집한 원래 값 (실패면 null)
  manualCount: number | null; // 관리자가 고친 값 (있으면 화면·엑셀에 이 값을 보여준다)
  manualBy: string | null;
  manualAt: string | null;
};

// 댓글의 처리 결과: 초안을 만들거나(draft), 제외 사유를 붙인다
export type CommentClass =
  | { kind: "draft" }
  | { kind: "excluded"; reason: ExcludeReason };

export type Comment = {
  id: string; // 유튜브 댓글 ID
  videoId: string;
  authorName: string; // 닉네임
  body: string;
  publishedAt: string; // 작성 시각
  collectedAt: string; // 수집 시각 (14일 보관의 기준)
  classification: CommentClass | null; // 분류 전이면 null
};

export type ReplyDraft = {
  commentId: string;
  text: string; // AI가 만든 초안
  needsCheck: boolean; // 근거가 없어 "담당자 확인 필요"인지
  createdAt: string; // 초안 생성 시각 ("수집 후 30분 이내" 측정용)
  finalText: string | null; // [복사] 때 저장한 담당자 수정본
  usedAt: string | null; // [복사] 시각
};

export type DeletionLog = {
  deletedBy: string; // 담당자가 입력한 이름
  deletedAt: string;
  commentId: string;
  commentBody: string | null; // 원문은 14일 뒤 지운다 (지우면 null)
};
