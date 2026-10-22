// 엑셀 내려받기: /api/export?date=YYYY-MM-DD (보고 시각 10:00 / 14:00 / 17:00 시트 3개)
import { buildReportWorkbook } from "@/lib/export";

export const maxDuration = 60;

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ ok: false, message: "날짜를 YYYY-MM-DD 형식으로 입력해 주세요." }, { status: 400 });
  }
  try {
    const file = await buildReportWorkbook(date);
    if (!file) return Response.json({ ok: false, message: "해당 날짜의 기록이 없습니다." }, { status: 404 });
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="report-${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("엑셀 만들기 오류:", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, message: "엑셀 파일을 만들지 못했습니다." }, { status: 500 });
  }
}
