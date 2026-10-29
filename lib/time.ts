// 한국 시간(KST)과 보고 시각 변환 (DESIGN.md 4장).
// 서버(Vercel)는 세계 표준시로 돌기 때문에, 날짜와 시각은 항상 여기서 한국 시간으로 바꿔 쓴다.
import {
  COLLECT_WINDOWS,
  LEGACY_REPORT_SLOTS,
  REPORT_SLOTS,
  SINGLE_SLOT_FROM,
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

// 화면에 보여줄 한국 시간 시각 (HH:MM)
export function formatKstTime(iso: string): string {
  const { minutes } = toKst(new Date(iso));
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// 화면에 보여줄 한국 시간 날짜와 시각 (YYYY-MM-DD HH:MM)
export function formatKstDateTime(iso: string): string {
  const d = new Date(iso);
  return `${toKst(d).day} ${formatKstTime(iso)}`;
}

// 수집한 시각이 어느 보고 시각에 속하는지. 수집 시각 창 밖이면 null.
// 예: 15:30~16:29 → "16:00" (15:35 재시도도 같은 보고 시각)
export function reportSlotFor(collectedAt: Date): { date: string; slot: ReportSlot } | null {
  const { day, minutes } = toKst(collectedAt);
  const win = COLLECT_WINDOWS.find(
    (w) => minutes >= toMinutes(w.start) && minutes < toMinutes(w.end),
  );
  return win ? { date: day, slot: win.slot } : null;
}

// 그 날짜에 쓰는 보고 시각들: 2026-10-30부터는 16:00 하나, 그 전은 예전 방식(10:00 / 14:00 / 17:00)
export function slotsForDate(date: string): readonly ReportSlot[] {
  return date >= SINGLE_SLOT_FROM ? REPORT_SLOTS : LEGACY_REPORT_SLOTS;
}

// 직전 보고 시각: 14:00은 10:00, 17:00은 14:00, 하루의 첫 보고 시각(10:00·16:00)은 전날의 마지막 보고 시각.
// 전날의 마지막은 예전 방식이면 17:00, 새 방식이면 16:00이다 (처음 바뀌는 날은 db/report.ts에서 둘 다 살펴본다).
export function previousReportSlot(date: string, slot: ReportSlot): { date: string; slot: ReportSlot } {
  if (slot === "14:00") return { date, slot: "10:00" };
  if (slot === "17:00") return { date, slot: "14:00" };
  return { date: addDays(date, -1), slot: slot === "16:00" ? "16:00" : "17:00" };
}

// 업로드일 기준 최근 14일(오늘 포함) 안의 영상인지. 업로드한 지 14일이 되면 대상에서 뺀다.
export function isWithinVideoWindow(uploadedAt: Date, now: Date): boolean {
  const age = dayIndex(toKst(now).day) - dayIndex(toKst(uploadedAt).day);
  return age >= 0 && age < VIDEO_WINDOW_DAYS;
}
