// 한국 시간(KST)과 보고 시각 변환 (DESIGN.md 4장).
// 서버(Vercel)는 세계 표준시로 돌기 때문에, 날짜와 시각은 항상 여기서 한국 시간으로 바꿔 쓴다.
import {
  COLLECT_WINDOWS,
  REPORT_SLOTS,
  TIME_ZONE,
  VIDEO_WINDOW_DAYS,
} from "./constants";
import type { ReportSlot } from "./types";

const kstParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// 한국 시간 기준 날짜(YYYY-MM-DD)와 하루 중 분(0~1439)
function toKst(date: Date): { day: string; minutes: number } {
  const p = Object.fromEntries(kstParts.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// "YYYY-MM-DD"에 일수를 더한 날짜 (달력 계산만 하므로 시간대 영향 없음)
export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayIndex(day: string): number {
  return Math.round(new Date(`${day}T00:00:00Z`).getTime() / 86_400_000);
}

// 한국 시간 기준 날짜 (YYYY-MM-DD)
export function toKstDate(date: Date): string {
  return toKst(date).day;
}

// 수집한 시각이 어느 보고 시각에 속하는지. 수집 시각 창 밖이면 null.
// 예: 09:30~09:59 → "10:00" (09:35 재시도도 같은 보고 시각)
export function reportSlotFor(collectedAt: Date): { date: string; slot: ReportSlot } | null {
  const { day, minutes } = toKst(collectedAt);
  const win = COLLECT_WINDOWS.find(
    (w) => minutes >= toMinutes(w.start) && minutes < toMinutes(w.end),
  );
  return win ? { date: day, slot: win.slot } : null;
}

// 직전 보고 시각: 10:00은 전날 17:00, 14:00은 10:00, 17:00은 14:00
export function previousReportSlot(date: string, slot: ReportSlot): { date: string; slot: ReportSlot } {
  const i = REPORT_SLOTS.indexOf(slot);
  if (i === 0) return { date: addDays(date, -1), slot: REPORT_SLOTS[REPORT_SLOTS.length - 1] };
  return { date, slot: REPORT_SLOTS[i - 1] };
}

// 업로드일 기준 최근 14일(오늘 포함) 안의 영상인지. 업로드한 지 14일이 되면 대상에서 뺀다.
export function isWithinVideoWindow(uploadedAt: Date, now: Date): boolean {
  const age = dayIndex(toKst(now).day) - dayIndex(toKst(uploadedAt).day);
  return age >= 0 && age < VIDEO_WINDOW_DAYS;
}
