// 주간 누적 보고서를 PDF로 만든다 (서버 전용). 화면과 같은 저장 값을 쓰며, 값은 유튜브가 준 그대로 적는다.
// 한글이 깨지지 않도록 Noto Sans KR 글꼴 파일(assets/fonts)을 PDF 안에 넣는다.
import path from "node:path";
import PDFDocument from "pdfkit";
import { LABEL_COLLECT_FAILED, LABEL_DELTA_NEW, LABEL_DELTA_UNAVAILABLE, REPORT_SLOTS } from "./constants";
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
function dayDeltaParts(d: DayDelta | null, withPercent: boolean): Part[] {
  if (d === null) return [{ text: "-", color: MUTED }];
  if (d.kind === "pending") return [{ text: "17시 수집 전", color: MUTED }];
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

function drawHeader(doc: PDFKit.PDFDocument, cols: Col[], x: number, y: number): number {
  const lines = Math.max(...cols.map((c) => c.header.split("\n").length));
  const h = 10 + lines * 12;
  let cx = x;
  for (const c of cols) {
    doc.rect(cx, y, c.width, h).fill(BRAND_SOFT);
    doc.fillColor(BRAND).fontSize(SIZE);
    setFont(doc, true);
    c.header.split("\n").forEach((line, i) => {
      doc.text(line, cx + PAD, y + 5 + i * 12, { width: c.width - PAD * 2, align: c.align ?? "left", lineBreak: false });
    });
    cx += c.width;
  }
  return y + h;
}

// 표 그리기: 쪽이 모자라면 다음 쪽으로 넘기고 머리글을 다시 그린다
function drawTable(doc: PDFKit.PDFDocument, cols: Col[], rows: Cell[][]): void {
  const x = doc.page.margins.left;
  let y = drawHeader(doc, cols, x, doc.y);
  rows.forEach((row, ri) => {
    if (y + ROW_H > bottomLimit(doc)) {
      doc.addPage();
      y = drawHeader(doc, cols, x, doc.page.margins.top);
    }
    if (ri % 2 === 1) doc.rect(x, y, cols.reduce((s, c) => s + c.width, 0), ROW_H).fill(BRAND_WASH);
    let cx = x;
    row.forEach((cell, ci) => {
      const col = cols[ci];
      const inner = col.width - PAD * 2;
      let parts = asParts(cell);
      // 긴 제목은 칸에 맞게 줄임표로 줄인다
      if (parts.length === 1 && !parts[0].bold && doc.fontSize(SIZE) && ellipsize(doc, parts[0].text, inner, SIZE) !== parts[0].text) {
        parts = [{ ...parts[0], text: ellipsize(doc, parts[0].text, inner, SIZE) }];
      }
      doc.fontSize(SIZE);
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
        doc.fillColor(p.color ?? INK).text(p.text, tx, y + 6, { lineBreak: false });
        tx += widths[pi];
      });
      cx += col.width;
    });
    doc.moveTo(x, y + ROW_H).lineTo(x + cols.reduce((s, c) => s + c.width, 0), y + ROW_H).strokeColor(LINE).lineWidth(0.4).stroke();
    y += ROW_H;
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

function subscriberRows(week: WeekReport): Cell[][] {
  const rows: Cell[][] = [];
  week.days.forEach((day, i) => {
    if (!day) return;
    const cells: Cell[] = [dayLabel(week.dates[i])];
    for (const slot of REPORT_SLOTS) {
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

export async function buildWeeklyPdf(date: string): Promise<Buffer | null> {
  const week = await buildWeekReport(date);
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

  // ── 1쪽: 주간 요약 ──
  doc.fillColor(BRAND).fontSize(20);
  setFont(doc, true);
  doc.text("재정경제부 유튜브 주간 누적 보고", doc.page.margins.left, 36, { lineBreak: false });
  doc.y = 66;
  doc.fillColor(INK).fontSize(10);
  setFont(doc, false);
  doc.text(`기간: ${dayLabel(week.monday)} ~ ${dayLabel(week.upTo)} (월요일부터 누적)    기록 시각: 10:00 / 14:00 / 17:00`, doc.page.margins.left, doc.y);
  doc.moveDown(0.3);
  note(doc, "숫자는 유튜브가 제공한 값 그대로이며, 수집에 실패한 값은 추측하거나 채우지 않고 '수집 실패'로 표시합니다. 증감은 저장된 값에서 계산합니다. ▲ 증가(빨강), ▼ 감소(파랑).");
  doc.moveDown(0.4);

  const subRows = subscriberRows(week);
  if (subRows.length > 0) {
    heading(doc, "구독자 수 (수집할 때마다)");
    drawTable(
      doc,
      [
        { header: "날짜", width: 100 },
        ...REPORT_SLOTS.map((s) => ({ header: s, width: 150, align: "right" as const })),
      ],
      subRows,
    );
    note(doc, "* 관리자가 고친 값입니다. 구독자 수는 유튜브 집계 보고서 기준이라 스튜디오와 몇 명 다를 수 있습니다.");
  }

  if (week.videos.length > 0) {
    heading(doc, "조회수: 하루 증감 (전날 17시 대비 오늘 17시) 과 주간 누적");
    drawTable(doc, weekMatrixCols(week, "조회수"), weekMatrixRows(week, "viewDays", "latestViews"));
    heading(doc, "댓글 수: 하루 증감 (전날 17시 대비 오늘 17시) 과 주간 누적");
    drawTable(doc, weekMatrixCols(week, "댓글 수"), weekMatrixRows(week, "commentDays", "latestComments"));
  }

  // ── 날짜별 쪽: 10:00 / 14:00 / 17:00 값과 하루 증감 ──
  week.days.forEach((day, i) => {
    if (!day || day.rows.length === 0) return;
    doc.addPage();
    doc.y = doc.page.margins.top;
    heading(doc, `${dayLabel(week.dates[i])} 보고 시각별 숫자`, 16);
    const cols: Col[] = [
      { header: "구분", width: 34 },
      { header: "제목", width: 220 },
      ...REPORT_SLOTS.map((s) => ({ header: s, width: 120, align: "right" as const })),
      { header: "하루 증감\n(전날 17시 대비)", width: 136, align: "right" as const },
    ];
    for (const [title, pick, dayKey] of [
      ["조회수", "views", "viewDay"],
      ["댓글 수", "comments", "commentDay"],
    ] as const) {
      heading(doc, title, 12);
      drawTable(
        doc,
        cols,
        day.rows.map((row) => [
          row.video.kind === "short" ? "쇼츠" : "롱폼",
          clean(row.video.title),
          ...REPORT_SLOTS.map((s) => slotParts(row[pick][s])),
          dayDeltaParts(row[dayKey], true),
        ]),
      );
    }
    const status = day.slots.map((s) => `${s.slot} ${s.videoCount === 0 ? "기록 없음" : `${s.videoCount}개${s.failedCount > 0 ? ` (수집 실패 ${s.failedCount}개)` : ""}`}`).join("   ");
    note(doc, `수집 상태: ${status}`);
  });

  doc.end();
  return done;
}
