// 주간 누적 자료 모으기 (서버 전용): 선택한 날짜가 속한 주의 월요일부터 그 날짜까지 하루씩의 숫자를 모은다.
// 저장된 값에서 계산만 하며, 없는 값은 추측하거나 채우지 않는다.
import { addDays } from "./time";
import { buildDayReport, type DayDelta, type DayReport, type DayRow } from "./day-report";
import { REPORT_SLOTS } from "./constants";
import type { Video } from "./types";

// 선택한 날짜가 속한 주의 월요일 (달력 계산이라 시간대 영향 없음)
export function mondayOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=일 ... 6=토
  return addDays(date, -((dow + 6) % 7));
}

export type WeekVideo = {
  video: Video;
  // 월요일부터 일요일까지 7칸. 아직 오지 않은 날이나 기록 없는 날은 null
  viewDays: (DayDelta | null)[];
  commentDays: (DayDelta | null)[];
  latestViews: number | null; // 가장 최근 기록의 값 (17시 → 14시 → 10시 순으로 있는 것)
  latestComments: number | null;
};

export type WeekReport = {
  monday: string;
  upTo: string; // 선택한 날짜
  dates: string[]; // 월요일부터 7일
  days: (DayReport | null)[]; // 7칸, 기록이 없는 날은 null
  videos: WeekVideo[];
};

function latestValue(row: DayRow, pick: "views" | "comments"): number | null {
  for (const slot of [...REPORT_SLOTS].reverse()) {
    const cell = row[pick][slot];
    if (cell.state === "ok") return cell.value;
  }
  return null;
}

export async function buildWeekReport(date: string): Promise<WeekReport> {
  const monday = mondayOf(date);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const active = dates.filter((d) => d <= date);
  const built = await Promise.all(active.map((d) => buildDayReport(d)));

  const days: (DayReport | null)[] = dates.map((_, i) => {
    const day = built[i];
    if (!day) return null;
    const hasChannel = Object.values(day.channels).some((c) => c !== null);
    return day.rows.length > 0 || hasChannel ? day : null;
  });

  const videos = new Map<string, WeekVideo>();
  days.forEach((day, i) => {
    if (!day) return;
    for (const row of day.rows) {
      let entry = videos.get(row.video.id);
      if (!entry) {
        entry = {
          video: row.video,
          viewDays: Array(7).fill(null),
          commentDays: Array(7).fill(null),
          latestViews: null,
          latestComments: null,
        };
        videos.set(row.video.id, entry);
      }
      entry.viewDays[i] = row.viewDay;
      entry.commentDays[i] = row.commentDay;
      // 날짜가 앞에서부터 차례로 오므로 값이 있으면 계속 최근 값으로 바꾼다
      entry.latestViews = latestValue(row, "views") ?? entry.latestViews;
      entry.latestComments = latestValue(row, "comments") ?? entry.latestComments;
    }
  });

  return {
    monday,
    upTo: date,
    dates,
    days,
    videos: [...videos.values()].sort((a, b) => b.video.uploadedAt.localeCompare(a.video.uploadedAt)),
  };
}

// 주간 합계: 이 주에 "하루 증감"이 계산된 날들의 합. 하나도 없으면 null (비교 불가)
export function weekSum(days: (DayDelta | null)[]): { sum: number; count: number } | null {
  let sum = 0;
  let count = 0;
  for (const d of days) {
    if (d && d.kind === "change") {
      sum += d.value;
      count += 1;
    }
  }
  return count > 0 ? { sum, count } : null;
}
