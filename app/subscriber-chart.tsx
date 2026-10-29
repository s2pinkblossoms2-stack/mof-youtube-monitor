// 구독자 수 그래프 (서버 컴포넌트, 순수 SVG): 수집할 때마다 점을 하나씩 찍고 값을 그대로 적는다.
// 값 글자는 위·아래로 번갈아 놓아 서로 겹치지 않게 하고, 값은 반올림 없이 저장된 숫자 그대로 보여 준다.
// 수집 실패인 시각은 점을 찍지 않고 "실패"로 표시하며, 선도 잇지 않는다 (값을 추측해 채우지 않음).
import { shownSubscribers } from "@/lib/report";
import { slotsForDate } from "@/lib/time";
import type { ChannelSnapshot, ReportSlot } from "@/lib/types";

const number = new Intl.NumberFormat("ko-KR");

const STEP = 62; // 점 사이 가로 간격
const LEFT = 76;
const RIGHT = 28;
const TOP = 44;
const PLOT_H = 190;
const BOTTOM = 62;

type Point = {
  date: string;
  slot: ReportSlot;
  state: "none" | "failed" | "ok";
  value: number; // state가 ok일 때만 의미 있음
  manual: boolean;
};

function toPoints(snapshots: ChannelSnapshot[]): Point[] {
  const dates = [...new Set(snapshots.map((s) => s.reportDate))].sort();
  const bySlot = new Map(snapshots.map((s) => [`${s.reportDate} ${s.reportSlot}`, s]));
  const points: Point[] = [];
  for (const date of dates) {
    // 날짜마다 그 날짜에 쓰는 보고 시각만 점으로 찍는다 (2026-10-30부터 16:00 하나, 그 전은 10:00 / 14:00 / 17:00)
    for (const slot of slotsForDate(date)) {
      const shown = shownSubscribers(bySlot.get(`${date} ${slot}`) ?? null);
      if (shown.kind === "none") points.push({ date, slot, state: "none", value: 0, manual: false });
      else if (shown.kind === "failed") points.push({ date, slot, state: "failed", value: 0, manual: false });
      else points.push({ date, slot, state: "ok", value: shown.value, manual: shown.kind === "manual" });
    }
  }
  return points;
}

// 눈금: 값이 모두 정수이므로 정수 눈금만 쓴다
function ticks(min: number, max: number): number[] {
  const span = Math.max(1, max - min);
  const count = Math.min(4, span);
  const out: number[] = [];
  for (let i = 0; i <= count; i++) out.push(Math.round(min + (span * i) / count));
  return [...new Set(out)];
}

export default function SubscriberChart({ snapshots }: { snapshots: ChannelSnapshot[] }) {
  const points = toPoints(snapshots);
  const okValues = points.filter((p) => p.state === "ok").map((p) => p.value);

  if (points.length === 0 || okValues.length === 0) {
    return <p className="text-sm text-muted">그래프로 보여줄 구독자 수 기록이 아직 없습니다.</p>;
  }

  const lo = Math.min(...okValues);
  const hi = Math.max(...okValues);
  // 값이 조금씩만 달라도 변화가 보이도록 위아래 여유를 두고 범위를 좁게 잡는다
  const pad = Math.max(3, Math.ceil((hi - lo) * 0.3));
  const min = lo - pad;
  const max = hi + pad;

  const width = LEFT + RIGHT + STEP * (points.length - 1) + 20;
  const height = TOP + PLOT_H + BOTTOM;
  const x = (i: number) => LEFT + 10 + i * STEP;
  const y = (v: number) => TOP + PLOT_H - ((v - min) / (max - min)) * PLOT_H;

  // 이어지는 점끼리만 선을 긋는다 (실패·기록 없음에서는 끊김)
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((p, i) => {
    if (p.state === "ok") current.push(`${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
    else if (current.length) {
      segments.push(current.join(" "));
      current = [];
    }
  });
  if (current.length) segments.push(current.join(" "));

  const dates = [...new Set(points.map((p) => p.date))];

  return (
    <figure>
      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`구독자 수 변화 그래프. ${points
            .filter((p) => p.state === "ok")
            .map((p) => `${p.date} ${p.slot} ${number.format(p.value)}명`)
            .join(", ")}`}
          className="block"
        >
          {/* 가로 눈금선과 구독자 수 눈금 */}
          {ticks(min, max).map((t) => (
            <g key={t}>
              <line x1={LEFT} x2={width - RIGHT} y1={y(t)} y2={y(t)} stroke="#b1cefb" strokeOpacity="0.55" strokeDasharray="3 4" />
              <text x={LEFT - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#464c53">
                {number.format(t)}
              </text>
            </g>
          ))}

          {/* 날짜가 바뀌는 곳의 세로 구분선 */}
          {dates.slice(1).map((d) => {
            const i = points.findIndex((p) => p.date === d);
            const gx = (x(i) + x(i - 1)) / 2;
            return <line key={d} x1={gx} x2={gx} y1={TOP - 10} y2={TOP + PLOT_H + 26} stroke="#b1cefb" />;
          })}

          {segments.map((s) => (
            <polyline key={s} points={s} fill="none" stroke="#083891" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {points.map((p, i) => {
            const cx = x(i);
            const slotLabel = `${p.slot.slice(0, 2)}시`;
            return (
              <g key={`${p.date} ${p.slot}`}>
                {p.state === "ok" && (
                  <>
                    <circle cx={cx} cy={y(p.value)} r="5" fill={p.manual ? "#ffffff" : "#083891"} stroke="#083891" strokeWidth="2.5" />
                    <text
                      x={cx}
                      y={i % 2 === 0 ? y(p.value) - 12 : y(p.value) + 21}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="600"
                      fill="#1e2124"
                      stroke="#ffffff"
                      strokeWidth="4"
                      paintOrder="stroke"
                    >
                      {number.format(p.value)}
                    </text>
                  </>
                )}
                {p.state === "failed" && (
                  <text x={cx} y={TOP + PLOT_H / 2} textAnchor="middle" fontSize="11" fontWeight="600" fill="#b91c1c">
                    실패
                  </text>
                )}
                <text x={cx} y={TOP + PLOT_H + 20} textAnchor="middle" fontSize="11" fill="#464c53">
                  {slotLabel}
                </text>
              </g>
            );
          })}

          {/* 날짜 이름 */}
          {dates.map((d) => {
            const idx = points.map((p, i) => (p.date === d ? i : -1)).filter((i) => i >= 0);
            const cx = (x(idx[0]) + x(idx[idx.length - 1])) / 2;
            return (
              <text key={d} x={cx} y={TOP + PLOT_H + 44} textAnchor="middle" fontSize="12" fontWeight="600" fill="#083891">
                {d.slice(5).replace("-", "/")}
              </text>
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>● 자동 수집한 값</span>
        <span>○ 관리자가 고친 값</span>
        <span>값은 유튜브 집계 보고서 기준이라 스튜디오와 몇 명 다를 수 있습니다.</span>
      </figcaption>
    </figure>
  );
}
