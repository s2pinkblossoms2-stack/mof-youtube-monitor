// 숫자 화면의 내용 (서버 컴포넌트). 저장된 값을 읽어 보여주기만 하고 고치지 않는다.
import Link from "next/link";
import { REPORT_SLOTS, LABEL_COLLECT_FAILED, LABEL_DELTA_NEW, LABEL_DELTA_UNAVAILABLE } from "@/lib/constants";
import type { Delta } from "@/lib/delta";
import { getLatestReportSlot, getReportData, listReportDates } from "@/lib/db/report";
import { buildReport, type ReportRow } from "@/lib/report";
import { formatKstTime } from "@/lib/time";
import type { ReportSlot } from "@/lib/types";

type Params = Record<string, string | string[] | undefined>;

const number = new Intl.NumberFormat("ko-KR");

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function DeltaText({ delta }: { delta: Delta }) {
  if (delta.kind === "new") return <span className="text-zinc-500">({LABEL_DELTA_NEW})</span>;
  if (delta.kind === "unavailable") return <span className="text-zinc-500">({LABEL_DELTA_UNAVAILABLE})</span>;
  const v = delta.value;
  const text = v > 0 ? `+${number.format(v)}` : number.format(v); // 줄었으면 음수 그대로
  return <span className="text-zinc-600 dark:text-zinc-400">({text})</span>;
}

function Failed() {
  return <span className="font-medium text-red-600 dark:text-red-400">{LABEL_COLLECT_FAILED}</span>;
}

function Cell({ value, delta, failed }: { value: number | null; delta: Delta; failed: boolean }) {
  if (failed || value === null) return <Failed />;
  return (
    <span>
      {number.format(value)} <DeltaText delta={delta} />
    </span>
  );
}

function VideoRowView({ row }: { row: ReportRow }) {
  return (
    <tr className="border-t border-zinc-200 dark:border-zinc-800">
      <td className="px-3 py-2 whitespace-nowrap">{row.video.kind === "short" ? "쇼츠" : "롱폼"}</td>
      <td className="min-w-[16rem] px-3 py-2">
        <a
          href={`https://www.youtube.com/watch?v=${row.video.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {row.video.title}
        </a>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">{row.video.uploadedAt.slice(0, 10)}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <Cell value={row.viewCount} delta={row.viewDelta} failed={row.failed} />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <Cell value={row.commentCount} delta={row.commentDelta} failed={row.failed} />
      </td>
    </tr>
  );
}

export default async function ReportView({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const [dates, latest] = await Promise.all([listReportDates(), getLatestReportSlot()]);

  if (!latest) {
    return (
      <p className="rounded-lg border border-zinc-200 p-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        아직 수집된 기록이 없습니다. 첫 자동 수집(한국 시간 09:30) 이후에 이곳에 표시됩니다.
      </p>
    );
  }

  // 주소의 날짜·보고 시각이 올바르지 않으면 가장 최근 기록을 보여준다
  const askedDate = first(params.date);
  const askedSlot = first(params.slot);
  const date = askedDate && dates.includes(askedDate) ? askedDate : latest.date;
  const slot: ReportSlot =
    (REPORT_SLOTS as readonly string[]).includes(askedSlot ?? "") ? (askedSlot as ReportSlot) : latest.slot;

  const data = await getReportData(date, slot);
  const report = buildReport(data);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <form action="/" className="flex items-center gap-2">
          <label htmlFor="date" className="text-sm text-zinc-600 dark:text-zinc-400">
            날짜
          </label>
          <select
            id="date"
            name="date"
            defaultValue={date}
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <input type="hidden" name="slot" value={slot} />
          <button type="submit" className="rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            보기
          </button>
        </form>
        <nav aria-label="보고 시각" className="flex gap-2">
          {REPORT_SLOTS.map((s) => (
            <Link
              key={s}
              href={`/?date=${date}&slot=${s}`}
              aria-current={s === slot ? "page" : undefined}
              className={
                s === slot
                  ? "rounded bg-foreground px-3 py-1 text-background"
                  : "rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }
            >
              {s}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm text-zinc-600 dark:text-zinc-400">구독자 수</h2>
          <p className="mt-1 text-2xl font-semibold">
            {data.channel === null ? (
              <span className="text-base font-normal text-zinc-500">아직 수집되지 않았습니다</span>
            ) : data.channel.status === "failed" || data.channel.subscriberCount === null ? (
              <Failed />
            ) : (
              `${number.format(data.channel.subscriberCount)}명`
            )}
          </p>
        </section>
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm text-zinc-600 dark:text-zinc-400">수집 상태</h2>
          <p className="mt-1">
            {report.collectedAt ? `${formatKstTime(report.collectedAt)} 수집` : "기록 없음"} · 영상 {report.rows.length}개
            {report.failedCount > 0 ? (
              <>
                {" "}
                / <Failed /> {report.failedCount}개
              </>
            ) : (
              " / 실패 0개"
            )}
          </p>
        </section>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">
            {date} {slot} 영상별 조회수와 댓글 수 (괄호는 직전 보고 시각 대비 증가량)
          </caption>
          <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">구분</th>
              <th className="px-3 py-2 font-medium">제목</th>
              <th className="px-3 py-2 font-medium">업로드일</th>
              <th className="px-3 py-2 text-right font-medium">조회수 (증가)</th>
              <th className="px-3 py-2 text-right font-medium">댓글 수 (증가)</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <VideoRowView key={row.video.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
