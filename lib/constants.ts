// 서비스 전체에서 쓰는 고정값이다 (기준: PRD.md, DESIGN.md).
// 시각은 모두 한국 시간(KST) 기준이다.

export const TIME_ZONE = "Asia/Seoul";

// 집계 대상 영상: 업로드일 기준 최근 14일 (오늘 포함, 14일이 지난 영상은 뺀다)
export const VIDEO_WINDOW_DAYS = 14;

// 댓글 저장 기간: 수집한 시각부터 14일 (삭제 기록의 원문도 같은 기간)
export const COMMENT_RETENTION_DAYS = 14;

// 보고 시각: 지금은 하루 한 번, 15:30에 수집해 16:00으로 기록한다 (2026-10-30부터).
export const REPORT_SLOTS = ["16:00"] as const;

// 2026-10-29까지는 하루 3회(10:00 / 14:00 / 17:00)로 기록했다. 이미 저장된 기록을 계속 보여 주기 위해 남겨 둔다.
export const LEGACY_REPORT_SLOTS = ["10:00", "14:00", "17:00"] as const;

// 저장하거나 보여 줄 수 있는 모든 보고 시각 (시간순)
export const ALL_REPORT_SLOTS = ["10:00", "14:00", "16:00", "17:00"] as const;

// 하루 한 번 기록으로 바뀐 첫 날 (이 날부터 REPORT_SLOTS, 그 전 날짜는 LEGACY_REPORT_SLOTS를 쓴다)
export const SINGLE_SLOT_FROM = "2026-10-30";

// 수집 시각 창: 이 시간 안에 실행된 수집은 해당 보고 시각의 값으로 저장한다. (끝 시각은 포함하지 않음)
// Vercel의 자동 실행은 정시보다 한 시간 가까이 늦어질 수 있어서(요금제에 따라), 창을 보고 시각 이후 30분까지 넉넉히 잡는다.
// 5분 뒤 재시도가 돌아도 같은 보고 시각으로 묶인다.
export const COLLECT_WINDOWS = [{ start: "15:30", end: "16:30", slot: "16:00" }] as const;

// 실패한 수집을 다시 시도하기까지의 분 (자동 실행은 수집 +5분에 돈다)
export const RETRY_DELAY_MINUTES = 5;

// 답글 초안의 근거로 쓸 공식 자료 링크. 비어 있으면 영상 설명만 근거로 쓴다.
// 자료를 추가하려면 주소를 여기에 적는다 (페이지의 글자를 읽어 AI에 함께 넘긴다).
export const REFERENCE_LINKS: readonly string[] = [];

// 쇼츠 후보 기준: 영상 길이가 이 초를 넘으면 롱폼, 이하이면 쇼츠 전용 주소로 한 번 더 확인한다
// (길이만으로는 구분되지 않음: lib/youtube/shorts.ts)
export const SHORTS_MAX_SECONDS = 180;

// 댓글 분류: 초안을 만드는 댓글은 "draft", 나머지는 제외 사유를 하나 붙인다.
// 개인정보 포함은 AI에 보내지 않고 표시만 한다.
export const EXCLUDE_REASONS = [
  "personal_info", // 개인정보 포함
  "abuse", // 욕설·비방
  "political_attack", // 정치적 공격
  "simple_comment", // 단순 감상평
  "event_entry", // 이벤트 참여
  "other", // 기타(질문 없음)
] as const;

// 화면에 보여줄 한국어 이름
export const EXCLUDE_REASON_LABELS: Record<(typeof EXCLUDE_REASONS)[number], string> = {
  personal_info: "개인정보 포함",
  abuse: "욕설·비방",
  political_attack: "정치적 공격",
  simple_comment: "단순 감상평",
  event_entry: "이벤트 참여",
  other: "기타(질문 없음)",
};

// 표시 문구 (PRD 규칙: 실패는 추측하거나 채우지 않고 그대로 표시한다)
export const LABEL_COLLECT_FAILED = "수집 실패";
export const LABEL_DELTA_UNAVAILABLE = "비교 불가";
export const LABEL_DELTA_NEW = "신규";
export const LABEL_NEEDS_CHECK = "담당자 확인 필요";
