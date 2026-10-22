// 직전 보고 시각 대비 증가량 계산 (PRD 5장 must 1).
// 저장된 값에서 계산만 하고, 실패하거나 없는 값은 추측하거나 채우지 않는다.

// 한 시각의 값: 성공(ok), 수집 실패(failed), 그 시각 기록 자체가 없음(undefined)
export type Metric = { status: "ok"; value: number } | { status: "failed" } | undefined;

export type Delta =
  | { kind: "change"; value: number } // 증가(+)·감소(-) 모두 그대로
  | { kind: "unavailable" } // 비교 불가
  | { kind: "new" }; // 직전 시각에 없던 새 영상

// previousSlotCollected: 직전 보고 시각에 수집이 실제로 있었는지
// (있었는데 이 영상 기록만 없으면 새 영상, 수집 자체가 없었으면 비교 불가)
export function calcDelta(
  current: Metric,
  previous: Metric,
  previousSlotCollected: boolean,
): Delta {
  if (current === undefined || current.status === "failed") return { kind: "unavailable" };
  if (previous === undefined) {
    return previousSlotCollected ? { kind: "new" } : { kind: "unavailable" };
  }
  if (previous.status === "failed") return { kind: "unavailable" };
  return { kind: "change", value: current.value - previous.value };
}
