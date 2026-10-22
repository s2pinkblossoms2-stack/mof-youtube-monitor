// 보고 날짜 하나를 엑셀 파일로 만든다 (서버 전용). 화면과 같은 저장 값을 쓴다 (DESIGN.md 2-4).
import ExcelJS from "exceljs";
import { LABEL_COLLECT_FAILED, LABEL_DELTA_NEW, LABEL_DELTA_UNAVAILABLE, REPORT_SLOTS } from "./constants";
import type { Delta } from "./delta";
import { getReportData } from "./db/report";
import { buildReport, shownSubscribers } from "./report";
import type { ReportSlot } from "./types";

const COLUMNS = [
  { header: "구분", width: 8 },
  { header: "제목", width: 60 },
  { header: "업로드일", width: 12 },
  { header: "조회수", width: 14 },
  { header: "조회수 증가", width: 14 },
  { header: "댓글 수", width: 12 },
  { header: "댓글 수 증가", width: 14 },
  { header: "수집 상태", width: 12 },
];

// 증가량 칸: 계산된 값은 숫자로, 아닌 경우는 글자로 적는다
function deltaCell(delta: Delta, failed: boolean): ExcelJS.CellValue {
  if (failed) return null;
  if (delta.kind === "new") return LABEL_DELTA_NEW;
  if (delta.kind === "unavailable") return LABEL_DELTA_UNAVAILABLE;
  return delta.value;
}

// 시트 이름에는 ":"를 쓸 수 없어 "10시"처럼 적고, 시트 안에 원래 보고 시각을 적어 둔다
function sheetName(slot: ReportSlot): string {
  return `${slot.slice(0, 2)}시`;
}

// 기록이 하나도 없으면 null
export async function buildReportWorkbook(date: string): Promise<Buffer | null> {
  const workbook = new ExcelJS.Workbook();
  let anyData = false;

  for (const slot of REPORT_SLOTS) {
    const data = await getReportData(date, slot);
    const report = buildReport(data);
    if (report.rows.length > 0) anyData = true;

    const sheet = workbook.addWorksheet(sheetName(slot));
    sheet.getCell("A1").value = `보고 날짜 ${date} · 보고 시각 ${slot}`;
    sheet.getCell("A1").font = { bold: true, size: 13 };

    sheet.getCell("A2").value = "구독자 수";
    const subs = shownSubscribers(data.channel);
    sheet.getCell("B2").value =
      subs.kind === "none" ? "수집 전" : subs.kind === "failed" ? LABEL_COLLECT_FAILED : subs.value;
    sheet.getCell("B2").numFmt = "#,##0";
    sheet.getCell("B2").alignment = { horizontal: "left" };
    // 관리자가 고친 값이면 누가 고쳤는지와 원래 자동 수집값을 함께 적는다
    sheet.getCell("C2").value =
      subs.kind === "manual"
        ? `관리자가 고친 값 (${subs.by || "이름 없음"}) · 자동 수집값 ${subs.autoValue === null ? "없음(수집 실패)" : subs.autoValue.toLocaleString("ko-KR")}`
        : subs.kind === "auto"
          ? "집계 보고서 기준 (스튜디오와 몇 명 다를 수 있음)"
          : "";

    const header = sheet.getRow(4);
    COLUMNS.forEach((c, i) => {
      header.getCell(i + 1).value = c.header;
      sheet.getColumn(i + 1).width = c.width;
    });
    header.font = { bold: true };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EAED" } };

    if (report.rows.length === 0) {
      sheet.getCell("A5").value = "이 보고 시각의 기록이 없습니다.";
      continue;
    }

    report.rows.forEach((row, i) => {
      const r = sheet.getRow(5 + i);
      r.getCell(1).value = row.video.kind === "short" ? "쇼츠" : "롱폼";
      r.getCell(2).value = row.video.title;
      r.getCell(3).value = row.video.uploadedAt.slice(0, 10);
      // 수집에 실패한 값은 비우거나 이전 값으로 채우지 않고 "수집 실패"로 적는다
      r.getCell(4).value = row.failed || row.viewCount === null ? LABEL_COLLECT_FAILED : row.viewCount;
      r.getCell(5).value = deltaCell(row.viewDelta, row.failed);
      r.getCell(6).value = row.failed || row.commentCount === null ? LABEL_COLLECT_FAILED : row.commentCount;
      r.getCell(7).value = deltaCell(row.commentDelta, row.failed);
      r.getCell(8).value = row.failed ? LABEL_COLLECT_FAILED : "성공";
      for (const col of [4, 6]) r.getCell(col).numFmt = "#,##0";
      for (const col of [5, 7]) r.getCell(col).numFmt = "+#,##0;-#,##0;0";
      for (const col of [4, 5, 6, 7]) r.getCell(col).alignment = { horizontal: "right" };
    });
  }

  if (!anyData) return null;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
