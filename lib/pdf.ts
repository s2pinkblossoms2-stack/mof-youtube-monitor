// 주간 누적 보고서를 PDF로 만든다 (서버 전용). 화면과 같은 저장 값을 쓰며, 값은 유튜브가 준 그대로 적는다.
// 한글이 깨지지 않도록 Noto Sans KR 글꼴 파일(assets/fonts)을 PDF 안에 넣는다.
import path from "node:path";
import PDFDocument from "pdfkit";
import { ALL_REPORT_SLOTS, LABEL_COLLECT_FAILED, LABEL_DELTA_NEW, LABEL_DELTA_UNAVAILABLE } from "./constants";
import type { ReportSlot } from "./types";
import type { DayDelta, SlotCell } from "./day-report";
import { shownSubscribers } from "./report";
import { buildWeekReport, weekSum, type WeekReport } from "./week-report";

const BRAND = "#083891";
const BRAND_SOFT = "#d8e5fd";
const BRAND_WASH = "#f3f7ff";
const LINE = "#b1cefb";
const INK = "#1e2124";
const MUTED = "#464c53";
const UP = "#b91c1c"; // 증가: 빨강 ▲ (화면과 같은 색)
const DOWN = "#1d4ed8"; // 감소: 파랑 ▼

const number = new Intl.NumberFormat("ko-KR");
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

type Part = { text: string; color?: string; bold?: boolean };
type Cell = string | Part | Part[];
type Col = { header: string; width: number; align?: "left" | "right" | "center" };

const FONT_REGULAR = "regular";
const FONT_BOLD = "bold";

function signed(v: number): string {
  return v > 0 ? `+${number.format(v)}` : number.format(v);
}

// 제목에 들어 있는 이모지처럼 글꼴에 없는 글자는 빼서 네모(□)로 깨지지 않게 한다
function clean(text: string): string {
  return text.replace(/[\p{Extended_Pictographic}️‍]/gu, "").replace(/\s+/g, " ").trim();
}

function dayLabel(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return `${date.slice(5).replace("-", "/")}(${WEEKDAY[dow]})`;
}

function pctText(p: number): string {
  if (p === 0) return "0%";
  return `${p > 0 ? "+" : ""}${Math.abs(p) < 0.1 ? p.toFixed(2) : p.toFixed(1)}%`;
}

// 하루 증감 칸 (withPercent: 증감률도 함께)
function dayDeltaParts(d: DayDelta | null, withPercent: boolean, finalHour = ""): Part[] {
  if (d === null) return [{ text: "-", color: MUTED }];
  if (d.kind === "pending") return [{ text: `${finalHour} 수집 전`.trim(), color: MUTED }];
  if (d.kind === "new") return [{ text: LABEL_DELTA_NEW, color: MUTED }];
  if (d.kind === "unavailable") return [{ text: LABEL_DELTA_UNAVAILABLE, color: MUTED }];
  const color = d.value > 0 ? UP : d.value < 0 ? DOWN : MUTED;
  const arrow = d.value > 0 ? "▲ " : d.value < 0 ? "▼ " : "";
  const parts: Part[] = [{ text: `${arrow}${signed(d.value)}`, color, bold: d.value !== 0 }];
  if (withPercent && d.percent !== null) parts.push({ text: ` (${pctText(d.percent)})`, color });
  return parts;
}

// 보고 시각 칸: 값과 직전 보고 시각 대비 증가량
function slotParts(cell: SlotCell): Part[] {
  if (cell.state === "none") return [{ text: "—", color: MUTED }];
  if (cell.state === "failed") return [{ text: LABEL_COLLECT_FAILED, color: UP, bold: true }];
  const parts: Part[] = [{ text: number.format(cell.value) }];
  // 관리자가 고친 값에는 *를 붙인다
  if (cell.manual) parts.push({ text: "*", color: "#92400e", bold: true });
  const d = cell.delta;
  if (d.kind === "new") parts.push({ text: ` (${LABEL_DELTA_NEW})`, color: MUTED });
  else if (d.kind === "unavailable") parts.push({ text: ` (${LABEL_DELTA_UNAVAILABLE})`, color: MUTED });
  else {
    const color = d.value > 0 ? UP : d.value < 0 ? DOWN : MUTED;
    parts.push({ text: ` (${d.value > 0 ? "▲ " : d.value < 0 ? "▼ " : ""}${signed(d.value)})`, color });
  }
  return parts;
}

function asParts(cell: Cell): Part[] {
  if (typeof cell === "string") return [{ text: cell }];
  return Array.isArray(cell) ? cell : [cell];
}

function setFont(doc: PDFKit.PDFDocument, bold?: boolean) {
  doc.font(bold ? FONT_BOLD : FONT_REGULAR);
}

function ellipsize(doc: PDFKit.PDFDocument, text: string, width: number, size: number): string {
  doc.fontSize(size);
  setFont(doc, false);
  if (doc.widthOfString(text) <= width) return text;
  let out = text;
  while (out.length > 1 && doc.widthOfString(`${out}…`) > width) out = out.slice(0, -1);
  return `${out}…`;
}

const ROW_H = 20;
const SIZE = 9;
const PAD = 5;

function bottomLimit(doc: PDFKit.PDFDocument): number {
  return doc.page.height - doc.page.margins.bottom - 14;
}

function drawHeader(doc: PDFKit.PDFDocument, cols: Col[], x: number, y: number, size = SIZE): number {
  const lines = Math.max(...cols.map((c) => c.header.split("\n").length));
  const h = 10 + lines * 12;
  let cx = x;
  for (const c of cols) {
    doc.rect(cx, y, c.width, h).fill(BRAND_SOFT);
    doc.fillColor(BRAND).fontSize(size);
    setFont(doc, true);
    c.header.split("\n").forEach((line, i) => {
      doc.text(line, cx + PAD, y + 5 + i * 12, { width: c.width - PAD * 2, align: c.align ?? "left", lineBreak: false });
    });
    cx += c.width;
  }
  return y + h;
}

// 표 그리기: 쪽이 모자라면 다음 쪽으로 넘기고 머리글을 다시 그린다
function drawTable(doc: PDFKit.PDFDocument, cols: Col[], rows: Cell[][], opts: { rowH?: number; size?: number } = {}): void {
  const rowH = opts.rowH ?? ROW_H;
  const size = opts.size ?? SIZE;
  const x = doc.page.margins.left;
  let y = drawHeader(doc, cols, x, doc.y, size);
  rows.forEach((row, ri) => {
    if (y + rowH > bottomLimit(doc)) {
      doc.addPage();
      y = drawHeader(doc, cols, x, doc.page.margins.top, size);
    }
    if (ri % 2 === 1) doc.rect(x, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill(BRAND_WASH);
    let cx = x;
    row.forEach((cell, ci) => {
      const col = cols[ci];
      const inner = col.width - PAD * 2;
      let parts = asParts(cell);
      // 긴 제목은 칸에 맞게 줄임표로 줄인다
      if (parts.length === 1 && !parts[0].bold && doc.fontSize(size) && ellipsize(doc, parts[0].text, inner, size) !== parts[0].text) {
        parts = [{ ...parts[0], text: ellipsize(doc, parts[0].text, inner, size) }];
      }
      doc.fontSize(size);
      const widths = parts.map((p) => {
        setFont(doc, p.bold);
        return doc.widthOfString(p.text);
      });
      const total = widths.reduce((s, w) => s + w, 0);
      let tx = cx + PAD;
      if (col.align === "right") tx = cx + col.width - PAD - total;
      else if (col.align === "center") tx = cx + (col.width - total) / 2;
      parts.forEach((p, pi) => {
        setFont(doc, p.bold);
        doc.fillColor(p.color ?? INK).text(p.text, tx, y + (rowH - size) / 2 - 0.5, { lineBreak: false });
        tx += widths[pi];
      });
      cx += col.width;
    });
    doc.moveTo(x, y + rowH).lineTo(x + cols.reduce((s, c) => s + c.width, 0), y + rowH).strokeColor(LINE).lineWidth(0.4).stroke();
    y += rowH;
  });
  doc.y = y + 14;
  doc.x = x;
}

function heading(doc: PDFKit.PDFDocument, text: string, size = 14) {
  if (doc.y + 60 > bottomLimit(doc)) doc.addPage();
  doc.fillColor(BRAND).fontSize(size);
  setFont(doc, true);
  doc.text(text, doc.page.margins.left, doc.y, { lineBreak: false });
  doc.y += size + 8;
}

function note(doc: PDFKit.PDFDocument, text: string) {
  doc.fillColor(MUTED).fontSize(8);
  setFont(doc, false);
  doc.text(text, doc.page.margins.left, doc.y, { width: doc.page.width - doc.page.margins.left * 2 });
  doc.moveDown(0.6);
}

// 이 기간에 쓰인 보고 시각들 (예전 3회 기록과 새 16:00 기록이 한 기간에 섞여 있을 수 있다)
function weekSlotColumns(week: WeekReport): ReportSlot[] {
  return ALL_REPORT_SLOTS.filter((s) => week.days.some((d) => d && d.slotNames.includes(s)));
}

function subscriberRows(week: WeekReport): Cell[][] {
  const rows: Cell[][] = [];
  const columns = weekSlotColumns(week);
  week.days.forEach((day, i) => {
    if (!day) return;
    const cells: Cell[] = [dayLabel(week.dates[i])];
    for (const slot of columns) {
      if (!day.slotNames.includes(slot)) {
        cells.push({ text: "—", color: MUTED }); // 그 날짜에는 쓰지 않는 보고 시각
        continue;
      }
      const shown = shownSubscribers(day.channels[slot]);
      if (shown.kind === "none") cells.push({ text: "수집 전", color: MUTED });
      else if (shown.kind === "failed") cells.push({ text: LABEL_COLLECT_FAILED, color: UP, bold: true });
      // 관리자가 고친 값에는 *를 붙여 구분한다
      else cells.push(`${number.format(shown.value)}명${shown.kind === "manual" ? " *" : ""}`);
    }
    rows.push(cells);
  });
  return rows;
}

function weekMatrixRows(week: WeekReport, pick: "viewDays" | "commentDays", latest: "latestViews" | "latestComments"): Cell[][] {
  return week.videos.map((v) => {
    const sum = weekSum(v[pick]);
    const sumParts: Part[] = !sum
      ? [{ text: LABEL_DELTA_UNAVAILABLE, color: MUTED }]
      : [
          {
            text: `${sum.sum > 0 ? "▲ " : sum.sum < 0 ? "▼ " : ""}${signed(sum.sum)}`,
            color: sum.sum > 0 ? UP : sum.sum < 0 ? DOWN : MUTED,
            bold: true,
          },
        ];
    return [
      v.video.kind === "short" ? "쇼츠" : "롱폼",
      clean(v.video.title),
      ...week.dates.map((_, i) => dayDeltaParts(v[pick][i], false)),
      sumParts,
      v[latest] === null ? { text: "—", color: MUTED } : number.format(v[latest] as number),
    ];
  });
}

function weekMatrixCols(week: WeekReport, metricName: string): Col[] {
  return [
    { header: "구분", width: 34 },
    { header: "제목", width: 200 },
    ...week.dates.map((d) => ({ header: dayLabel(d), width: 50, align: "right" as const })),
    { header: `주간 누적 증감\n(하루 증감의 합)`, width: 86, align: "right" as const },
    { header: `현재 ${metricName}`, width: 60, align: "right" as const },
  ];
}

// 저장소에서 그 주의 값을 읽어 PDF로 만든다
export async function buildWeeklyPdf(date: string): Promise<Buffer | null> {
  return renderWeeklyPdf(await buildWeekReport(date));
}

// 모아 둔 주간 자료를 PDF로 그린다 (저장소를 읽지 않으므로 견본 자료로도 모양을 볼 수 있다)
export async function renderWeeklyPdf(week: WeekReport): Promise<Buffer | null> {
  if (week.videos.length === 0 && week.days.every((d) => d === null)) return null;

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: false, info: { Title: `주간 누적 보고 ${week.monday}~${week.upTo}`, Author: "재정경제부 유튜브 모니터링" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const fonts = path.join(process.cwd(), "assets", "fonts");
  doc.registerFont(FONT_REGULAR, path.join(fonts, "NotoSansKR_400Regular.ttf"));
  doc.registerFont(FONT_BOLD, path.join(fonts, "NotoSansKR_700Bold.ttf"));

  const left = doc.page.margins.left;

  // ── 날짜별 쪽: 월요일 한 장, 화요일 한 장 … (선택한 날짜까지). 한 장에 조회수·댓글 수의 10:00 / 14:00 / 17:00 값과 하루 증감 ──
  const dayColsFor = (slots: ReportSlot[], compareLabel: string): Col[] => [
    { header: "구분", width: 34 },
    { header: "제목", width: 770 - 34 - 136 - slots.length * 120 },
    ...slots.map((s) => ({ header: s, width: 120, align: "right" as const })),
    { header: `하루 증감\n(${compareLabel})`, width: 136, align: "right" as const },
  ];
  let firstPage = true;
  week.dates.forEach((date, i) => {
    if (date > week.upTo) return; // 선택한 날짜 이후는 아직 오지 않은 날
    if (!firstPage) doc.addPage();
    firstPage = false;
    doc.x = left;
    doc.y = doc.page.margins.top;
    const day = week.days[i];

    doc.fillColor(BRAND).fontSize(18);
    setFont(doc, true);
    doc.text(`${dayLabel(date)} 보고 시각별 숫자`, left, doc.y, { lineBreak: false });
    doc.fillColor(MUTED).fontSize(9);
    setFont(doc, false);
    doc.text(`재정경제부 유튜브 주간 누적 보고  ${dayLabel(week.monday)} ~ ${dayLabel(week.upTo)}`, left, doc.page.margins.top + 6, {
      width: doc.page.width - left * 2,
      align: "right",
      lineBreak: false,
    });
    doc.y = doc.page.margins.top + 28;

    if (!day || day.rows.length === 0) {
      doc.fillColor(MUTED).fontSize(12);
      setFont(doc, false);
      doc.text("이 날은 수집된 영상 기록이 없습니다. (자동 수집이 돌지 않았거나 수집에 실패했습니다)", left, doc.y);
      return;
    }

    // 그날의 구독자 수 한 줄
    const subs = day.slotNames.map((slot) => {
      const shown = shownSubscribers(day.channels[slot]);
      const text =
        shown.kind === "none" ? "수집 전" : shown.kind === "failed" ? LABEL_COLLECT_FAILED : `${number.format(shown.value)}명${shown.kind === "manual" ? " *" : ""}`;
      return `${slot} ${text}`;
    }).join("      ");
    doc.fillColor(INK).fontSize(10);
    setFont(doc, true);
    doc.text(`구독자 수   ${subs}`, left, doc.y, { lineBreak: false });
    doc.y += 22;

    // 영상이 많아도 한 장에 들어가도록 줄 높이와 글자 크기를 줄인다
    const n = day.rows.length;
    const available = doc.page.height - doc.page.margins.bottom - 14 - doc.y - 190;
    const rowH = Math.max(11, Math.min(ROW_H, Math.floor(available / (2 * n))));
    const size = rowH >= 17 ? SIZE : rowH >= 13 ? 8 : 7;

    for (const [title, pick, dayKey] of [
      ["조회수", "views", "viewDay"],
      ["댓글 수", "comments", "commentDay"],
    ] as const) {
      heading(doc, title, 12);
      drawTable(
        doc,
        dayColsFor(day.slotNames, day.compareLabel),
        day.rows.map((row) => [
          row.video.kind === "short" ? "쇼츠" : "롱폼",
          clean(row.video.title),
          ...day.slotNames.map((s) => slotParts(row[pick][s])),
          dayDeltaParts(row[dayKey], true, day.finalHour),
        ]),
        { rowH, size },
      );
    }
    const status = day.slots
      .map((s) => `${s.slot} ${s.videoCount === 0 ? "기록 없음" : `${s.videoCount}개${s.failedCount > 0 ? ` (수집 실패 ${s.failedCount}개)` : ""}`}`)
      .join("   ");
    note(doc, `수집 상태: ${status}    * 관리자가 고친 값(구독자 수·조회수·댓글 수)    ▲ 증가(빨강), ▼ 감소(파랑)`);
  });

  // ── 구독자 수 그래프: 월요일부터 수집할 때마다 누적 ──
  doc.addPage();
  doc.x = left;
  doc.y = doc.page.margins.top;
  doc.fillColor(BRAND).fontSize(18);
  setFont(doc, true);
  doc.text("구독자 수 변화 (수집할 때마다 누적)", left, doc.y, { lineBreak: false });
  doc.y += 30;
  drawSubscriberChart(doc, week);

  // 구독자 수 표(정확한 값): 그래프 아래에 작게 둔다
  const subRows = subscriberRows(week);
  if (subRows.length > 0) {
    heading(doc, "구독자 수 (수집할 때마다)", 12);
    drawTable(
      doc,
      [
        { header: "날짜", width: 100 },
        ...weekSlotColumns(week).map((s) => ({ header: s, width: 150, align: "right" as const })),
      ],
      subRows,
      { rowH: 14, size: 8 },
    );
    note(doc, "* 관리자가 고친 값입니다.");
  }

  // ── 주간 요약: 조회수와 댓글 수를 각각 다른 장에 ──
  for (const [title, pick, latest] of [
    ["조회수", "viewDays", "latestViews"],
    ["댓글 수", "commentDays", "latestComments"],
  ] as const) {
    doc.addPage();
    doc.x = left;
    doc.y = doc.page.margins.top;
    doc.fillColor(BRAND).fontSize(18);
    setFont(doc, true);
    doc.text(`주간 요약: ${title}`, left, doc.y, { lineBreak: false });
    doc.y += 28;
    note(doc, "하루 증감은 전날 마지막 보고 시각 대비 오늘 마지막 보고 시각(예: 전날 16시 대비 오늘 16시)이고, 주간 누적 증감은 이 주에 계산된 하루 증감의 합입니다. 수집에 실패한 값은 추측하거나 채우지 않고 '수집 실패'·'비교 불가'로 표시합니다.");
    if (week.videos.length === 0) {
      doc.fillColor(MUTED).fontSize(12);
      setFont(doc, false);
      doc.text("이 주에는 수집된 영상 기록이 없습니다.", left, doc.y);
    } else {
      drawTable(doc, weekMatrixCols(week, title), weekMatrixRows(week, pick, latest));
    }
  }

  doc.end();
  return done;
}

// 구독자 수 그래프 (순수 도형): 수집할 때마다 점을 하나씩 찍고 값을 반올림 없이 적는다.
// 값 글자는 위·아래로 번갈아 놓아 겹치지 않게 하고, 수집 실패는 점을 찍지 않고 "실패"로 표시한다 (선도 잇지 않음).
function drawSubscriberChart(doc: PDFKit.PDFDocument, week: WeekReport): void {
  type P = { date: string; slot: string; state: "none" | "failed" | "ok"; value: number; manual: boolean };
  const points: P[] = [];
  week.dates.forEach((date, i) => {
    const day = week.days[i];
    if (date > week.upTo || !day) return;
    for (const slot of day.slotNames) {
      const shown = shownSubscribers(day.channels[slot]);
      if (shown.kind === "none") points.push({ date, slot, state: "none", value: 0, manual: false });
      else if (shown.kind === "failed") points.push({ date, slot, state: "failed", value: 0, manual: false });
      else points.push({ date, slot, state: "ok", value: shown.value, manual: shown.kind === "manual" });
    }
  });
  const ok = points.filter((p) => p.state === "ok");
  const left = doc.page.margins.left;
  if (ok.length === 0) {
    doc.fillColor(MUTED).fontSize(12);
    setFont(doc, false);
    doc.text("그래프로 보여줄 구독자 수 기록이 아직 없습니다.", left, doc.y);
    return;
  }

  const lo = Math.min(...ok.map((p) => p.value));
  const hi = Math.max(...ok.map((p) => p.value));
  const pad = Math.max(3, Math.ceil((hi - lo) * 0.3));
  const min = lo - pad;
  const max = hi + pad;

  const plotX = left + 62;
  const plotW = doc.page.width - left * 2 - 62 - 10;
  const plotY = doc.y + 30;
  const plotH = 200;
  const step = points.length > 1 ? plotW / (points.length - 1) : 0;
  const x = (i: number) => (points.length > 1 ? plotX + i * step : plotX + plotW / 2);
  const y = (v: number) => plotY + plotH - ((v - min) / (max - min)) * plotH;

  // 가로 눈금선과 구독자 수 눈금 (정수만)
  const span = Math.max(1, max - min);
  const tickCount = Math.min(5, span);
  const ticks = [...new Set(Array.from({ length: tickCount + 1 }, (_, k) => Math.round(min + (span * k) / tickCount)))];
  doc.lineWidth(0.5).strokeColor(LINE);
  for (const t of ticks) {
    doc.moveTo(plotX, y(t)).lineTo(plotX + plotW, y(t)).dash(2, { space: 3 }).stroke().undash();
    doc.fillColor(MUTED).fontSize(8);
    setFont(doc, false);
    doc.text(number.format(t), left, y(t) - 4, { width: 54, align: "right", lineBreak: false });
  }

  // 날짜가 바뀌는 곳의 세로 구분선과 날짜 이름
  const dates = [...new Set(points.map((p) => p.date))];
  for (const d of dates) {
    const idx = points.map((p, i) => (p.date === d ? i : -1)).filter((i) => i >= 0);
    if (idx[0] > 0) {
      const gx = (x(idx[0]) + x(idx[0] - 1)) / 2;
      doc.moveTo(gx, plotY - 8).lineTo(gx, plotY + plotH + 30).strokeColor(LINE).lineWidth(0.8).stroke();
    }
    doc.fillColor(BRAND).fontSize(9);
    setFont(doc, true);
    const cx = (x(idx[0]) + x(idx[idx.length - 1])) / 2;
    doc.text(dayLabel(d), cx - 40, plotY + plotH + 24, { width: 80, align: "center", lineBreak: false });
  }

  // 이어지는 점끼리만 선을 긋는다 (실패·기록 없음에서는 끊김)
  doc.lineWidth(2).strokeColor(BRAND).lineJoin("round").lineCap("round");
  let drawing = false;
  points.forEach((p, i) => {
    if (p.state === "ok") {
      if (drawing) doc.lineTo(x(i), y(p.value));
      else doc.moveTo(x(i), y(p.value));
      drawing = true;
    } else if (drawing) {
      doc.stroke();
      drawing = false;
    }
  });
  if (drawing) doc.stroke();

  points.forEach((p, i) => {
    const cx = x(i);
    doc.fillColor(MUTED).fontSize(7);
    setFont(doc, false);
    doc.text(`${p.slot.slice(0, 2)}시`, cx - 14, plotY + plotH + 10, { width: 28, align: "center", lineBreak: false });
    if (p.state === "ok") {
      doc.circle(cx, y(p.value), 3.2).lineWidth(1.6).fillAndStroke(p.manual ? "#ffffff" : BRAND, BRAND);
      doc.fillColor(INK).fontSize(8);
      setFont(doc, true);
      doc.text(number.format(p.value), cx - 24, i % 2 === 0 ? y(p.value) - 15 : y(p.value) + 7, { width: 48, align: "center", lineBreak: false });
    } else if (p.state === "failed") {
      doc.fillColor(UP).fontSize(8);
      setFont(doc, true);
      doc.text("실패", cx - 14, plotY + plotH / 2, { width: 28, align: "center", lineBreak: false });
    }
  });

  doc.y = plotY + plotH + 52;
  doc.x = left;
  note(doc, "● 자동 수집한 값   ○ 관리자가 고친 값   값은 반올림 없이 저장된 숫자 그대로입니다. 구독자 수는 유튜브 집계 보고서 기준이라 스튜디오와 몇 명 다를 수 있습니다.");
}
