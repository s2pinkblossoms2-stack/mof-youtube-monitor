// 숫자 화면의 내용 (서버 컴포넌트). 한 날짜의 보고 시각 값(2026-10-30부터 16:00 하나, 그 전은 10:00 / 14:00 / 17:00)을 한 화면에 모아 보여 주고,
// 전날 마지막 보고 시각 대비 하루 증감과 구독자 수 그래프를 함께 보여 준다. 저장된 값을 읽어 보여주기만 하고 고치지 않는다.
import { LABEL_COLLECT_FAILED, LABEL_DELTA_NEW, LABEL_DELTA_UNAVAILABLE } from "@/lib/constants";
import type { Delta } from "@/lib/delta";
import { listChannelSnapshotsUpTo } from "@/lib/db/channel";
import { getLatestReportSlot, listReportDates } from "@/lib/db/report";
import { buildDayReport, type DayDelta, type DayReport, type DayRow, type SlotCell } from "@/lib/day-report";
import { shownSubscribers } from "@/lib/report";
import { formatKstDateTime, formatKstTime } from "@/lib/time";
import SubscriberChart from "./subscriber-chart";
import SubscriberEdit from "./subscriber-edit";
import VideoEdit, { type VideoEditOption } from "./video-edit";

type Params = Record<string, string | string[] | undefined>;

const number = new Intl.NumberFormat("ko-KR");

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function signed(v: number): string {
  return v > 0 ? `+${number.format(v)}` : number.format(v); // 줄었으면 음수 그대로
}

// 한눈에 보이도록 증가는 빨강 ▲, 감소는 파랑 ▼ (한국 금융 화면의 관례). 색만으로 구분하지 않도록 화살표와 부호(+/-)를 함께 쓴다.
// 화살표는 화면에만 그리는 장식(CSS)이라, 보고서에 복사해 붙여넣어도 "(+320)"처럼 숫자만 복사된다.
function DeltaText({ delta }: { delta: Delta }) {
  if (delta.kind === "new") return <span className="text-muted">({LABEL_DELTA_NEW})</span>;
  if (delta.kind === "unavailable") return <span className="text-muted">({LABEL_DELTA_UNAVAILABLE})</span>;
  const v = delta.value;
  if (v > 0) {
    return (
      <span className="font-medium text-red-700">
        (<span className="before:content-['▲_']">{signed(v)}</span>)
      </span>
    );
  }
  if (v < 0) {
    return (
      <span className="font-medium text-blue-700">
        (<span className="before:content-['▼_']">{signed(v)}</span>)
      </span>
    );
  }
  return <span className="text-muted">({signed(v)})</span>;
}

function Failed() {
  return <span className="font-medium text-red-600">{LABEL_COLLECT_FAILED}</span>;
}

function SlotCellView({ cell }: { cell: SlotCell }) {
  if (cell.state === "none") return <span className="text-muted">—</span>;
  if (cell.state === "failed") return <Failed />;
  return (
    <span>
      {number.format(cell.value)}
      {cell.manual && (
        <span className="text-amber-800" title={`관리자가 고친 값 (${cell.manual.by})`}>
          *
        </span>
      )}{" "}
      <DeltaText delta={cell.delta} />
    </span>
  );
}

// 하루 증감 칸: 전날 마지막 보고 시각 → 오늘 마지막 보고 시각 (증감량과 증감률)
function DayDeltaView({ delta, finalHour }: { delta: DayDelta; finalHour: string }) {
  if (delta.kind === "pending") return <span className="text-muted">{finalHour} 수집 후 표시</span>;
  if (delta.kind === "new") return <span className="text-muted">{LABEL_DELTA_NEW}</span>;
  if (delta.kind === "unavailable") return <span className="text-muted">{LABEL_DELTA_UNAVAILABLE}</span>;
  const v = delta.value;
  // 아주 작은 변화(0.1% 미만)가 "-0.0%"로 보이지 않도록 소수 둘째 자리까지 보여 준다
  const pctText = (p: number) => p === 0 ? "0%" : `${p > 0 ? "+" : ""}${Math.abs(p) < 0.1 ? p.toFixed(2) : p.toFixed(1)}%`;
  const pct = delta.percent === null ? "" : ` (${pctText(delta.percent)})`;
  if (v === 0) return <span className="text-muted">0{pct}</span>;
  const up = v > 0;
  return (
    <span className={`font-bold ${up ? "text-red-700" : "text-blue-700"}`}>
      <span className={up ? "before:content-['▲_']" : "before:content-['▼_']"}>{signed(v)}</span>
      {pct}
    </span>
  );
}

function VideoLink({ row }: { row: DayRow }) {
  return (
    <a href={`https://www.youtube.com/watch?v=${row.video.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
      {row.video.title}
    </a>
  );
}

// 지표(조회수 또는 댓글 수) 하나의 표: 그 날짜의 보고 시각 칸들 + 하루 증감
function MetricTable({ title, report, pick }: { title: string; report: DayReport; pick: "views" | "comments" }) {
  const { rows, slotNames } = report;
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold text-brand">{title}</h2>
      <div className="overflow-x-auto rounded-2xl border border-brand-line bg-white">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <caption className="sr-only">
            영상별 {title}: 보고 시각 {slotNames.join(", ")} 값(괄호는 직전 보고 시각 대비 증가량)과 {report.compareLabel}의 하루 증감
          </caption>
          <thead className="bg-brand-wash text-brand">
            <tr>
              <th className="px-3 py-2 font-medium">구분</th>
              <th className="px-3 py-2 font-medium">제목</th>
              {slotNames.map((s) => (
                <th key={s} className="px-3 py-2 text-right font-medium">
                  {s}
                </th>
              ))}
              <th className="bg-brand-soft px-3 py-2 text-right font-bold">
                하루 증감
                <br />
                <span className="font-medium">({report.compareLabel})</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.video.id} className="border-t border-brand-line/60 hover:bg-brand-wash/60">
                <td className="px-3 py-2 whitespace-nowrap">{row.video.kind === "short" ? "쇼츠" : "롱폼"}</td>
                <td className="min-w-[16rem] px-3 py-2">
                  <VideoLink row={row} />
                  <span className="block text-xs text-muted">{row.video.uploadedAt.slice(0, 10)} 업로드</span>
                </td>
                {slotNames.map((s) => (
                  <td key={s} className="px-3 py-2 text-right whitespace-nowrap">
                    <SlotCellView cell={row[pick][s]} />
                  </td>
                ))}
                <td className="bg-brand-wash/70 px-3 py-2 text-right whitespace-nowrap">
                  <DayDeltaView delta={pick === "views" ? row.viewDay : row.commentDay} finalHour={report.finalHour} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SubscriberCard({ report }: { report: DayReport }) {
  const shown = report.slotNames.map((slot) => ({ slot, value: shownSubscribers(report.channels[slot]) }));
  const edit = shown.map(({ slot, value }) => ({
    slot,
    hasManual: value.kind === "manual",
    initialCount: value.kind === "auto" || value.kind === "manual" ? String(value.value) : "",
  }));
  return (
    <section className="rounded-2xl border border-brand-line bg-white p-5">
      <h2 className="text-sm font-medium text-brand">구독자 수</h2>
      <ul className="mt-2 space-y-1">
        {shown.map(({ slot, value }) => (
          <li key={slot} className="flex flex-wrap items-baseline gap-x-3">
            <span className="w-12 text-sm text-muted">{slot}</span>
            {value.kind === "none" ? (
              <span className="text-sm text-muted">수집 전</span>
            ) : value.kind === "failed" ? (
              <Failed />
            ) : (
              <span className="text-xl font-bold text-ink">{number.format(value.value)}명</span>
            )}
            {value.kind === "manual" && (
              <span className="text-xs text-amber-800">
                관리자가 고친 값{value.by ? ` (${value.by}` : ""}
                {value.at ? `${value.by ? ", " : " ("}${formatKstDateTime(value.at)}` : ""}
                {value.by || value.at ? ")" : ""}
                {value.autoValue !== null ? ` · 자동 수집값 ${number.format(value.autoValue)}명` : " · 자동 수집값 없음(수집 실패)"}
              </span>
            )}
          </li>
        ))}
      </ul>
      <SubscriberEdit date={report.date} slots={edit} />
    </section>
  );
}

function StatusCard({ report }: { report: DayReport }) {
  return (
    <section className="rounded-2xl border border-brand-line bg-white p-5">
      <h2 className="text-sm font-medium text-brand">수집 상태</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {report.slots.map((s) => (
          <li key={s.slot} className="flex flex-wrap items-baseline gap-x-3">
            <span className="w-12 text-muted">{s.slot}</span>
            {s.videoCount === 0 ? (
              // 영상 기록이 하나도 없는 보고 시각은 "0개 / 실패 0개"로 두지 않고 수집 전·실패로 분명히 알린다
              <span className="text-muted">수집된 영상 기록이 없습니다</span>
            ) : (
              <span>
                {s.collectedAt ? `${formatKstTime(s.collectedAt)} 수집` : "기록 없음"} · 영상 {s.videoCount}개
                {s.failedCount > 0 ? (
                  <>
                    {" / "}
                    <Failed /> {s.failedCount}개
                  </>
                ) : (
                  " / 실패 0개"
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// 고치기 칸에 넘길 영상별·보고 시각별 현재 값
function editOptions(report: DayReport): VideoEditOption[] {
  return report.rows.map((row) => ({
    videoId: row.video.id,
    title: row.video.title,
    slots: Object.fromEntries(
      report.slotNames.map((s) => {
        const v = row.views[s];
        const c = row.comments[s];
        if (v.state === "none" || c.state === "none") return [s, undefined]; // 그 보고 시각 기록이 없음
        // 수집 실패한 칸은 값을 비워 두고, 담당자가 스튜디오 숫자를 직접 넣을 수 있게 한다
        if (v.state === "failed" || c.state === "failed") {
          return [s, { views: null, comments: null, manualBy: null, autoViews: null, autoComments: null }];
        }
        return [
          s,
          {
            views: v.value,
            comments: c.value,
            manualBy: v.manual?.by ?? null,
            autoViews: v.manual?.autoValue ?? null,
            autoComments: c.manual?.autoValue ?? null,
          },
        ];
      }),
    ),
  }));
}

export default async function ReportView({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const [dates, latest] = await Promise.all([listReportDates(), getLatestReportSlot()]);

  if (!latest) {
    return (
      <p className="rounded-2xl border border-brand-line bg-brand-wash p-6 text-muted">
        아직 수집된 기록이 없습니다. 첫 자동 수집(한국 시간 15:30) 이후에 이곳에 표시됩니다.
      </p>
    );
  }

  // 주소의 날짜가 올바르지 않으면 가장 최근 기록의 날짜를 보여준다
  const asked = first(params.date);
  const date = asked && dates.includes(asked) ? asked : latest.date;

  const [report, history] = await Promise.all([buildDayReport(date), listChannelSnapshotsUpTo(date, 7)]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <form action="/report" className="flex items-center gap-2">
          <label htmlFor="date" className="text-sm text-muted">
            날짜
          </label>
          <select id="date" name="date" defaultValue={date} className="rounded-lg border border-brand-line bg-white px-3 py-1.5 text-ink">
            {dates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-full border border-brand-line bg-white px-4 py-1.5 text-ink hover:bg-brand-soft">
            보기
          </button>
        </form>
        <a
          href={`/api/export?date=${date}`}
          className="rounded-full border border-brand-line bg-white px-4 py-1.5 text-ink hover:bg-brand-soft"
        >
          PDF로 내려받기
        </a>
        {!report.dayReady && (
          <p className="text-sm text-muted">
            이 날의 {report.finalHour} 수집이 끝나면 &quot;하루 증감&quot;({report.compareLabel})이 표시됩니다.
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SubscriberCard report={report} />
        <StatusCard report={report} />
      </div>

      <section className="rounded-2xl border border-brand-line bg-white p-5">
        <h2 className="mb-3 text-lg font-bold text-brand">구독자 수 변화 (최근 7일, 수집할 때마다)</h2>
        <SubscriberChart snapshots={history} />
      </section>

      {report.rows.length > 0 && <VideoEdit date={date} slotNames={report.slotNames} videos={editOptions(report)} />}

      {report.rows.length === 0 ? (
        <p className="rounded-2xl border border-brand-line bg-brand-wash p-6 text-muted">
          이 날에는 수집된 영상 기록이 없습니다. 자동 수집이 돌지 않았거나 실패했습니다.
        </p>
      ) : (
        <>
          <MetricTable title="조회수" report={report} pick="views" />
          <MetricTable title="댓글 수" report={report} pick="comments" />
          <p className="text-xs text-muted">* 관리자가 고친 값입니다 (자동 수집한 원래 값은 &quot;조회수·댓글 수 고치기&quot;에서 확인할 수 있습니다).</p>
        </>
      )}
    </div>
  );
}
