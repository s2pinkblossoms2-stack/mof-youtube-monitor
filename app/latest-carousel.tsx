"use client";

// 재정경제부 최신 영상 썸네일을 둥근 통 안쪽처럼 휘어 보이게 늘어놓은 가로 캐러셀.
// - 오른쪽에서 왼쪽으로 천천히 계속 흐르고(초당 50), 마우스·터치로 끌면 손가락을 따라가다가 놓으면 관성으로 멈춘다.
// - 카드의 크기·높이·기울기는 화면 가운데에서 얼마나 떨어졌는지(d)로 매 프레임 계산한다.
// - 카드를 누르면 해당 유튜브 영상이 새 창에서 열린다 (끌고 난 직후의 클릭은 무시).
import { useEffect, useLayoutEffect, useRef } from "react";
import type { LatestVideo } from "@/lib/youtube/latest";

type Props = {
  videos: LatestVideo[];
  mode: "desktop" | "phone"; // desktop: 1440 단위 화면 안에 들어가는 모양, phone: 640 단위를 화면 너비에 맞춰 줄인 모양
};

const CARD_COUNT = 10;
const PITCH = 196; // 카드 사이 간격 (단위)
const LOOP = CARD_COUNT * PITCH;
const AUTO_SPEED = 50; // 자동으로 흐르는 속도 (단위/초)
const MOMENTUM_KEEP_PER_SECOND = 0.05; // 놓은 뒤 1초에 속도가 95% 줄어든다
const RADIUS = 15; // 카드 모서리 둥글기

const SIZES = {
  desktop: { width: 1440, height: 420, centerY: 687 - 480 }, // 띠(위에서 480 떨어진 곳)에 놓이므로 세로 중심을 그만큼 올린다
  phone: { width: 640, height: 0, centerY: 0 }, // 높이는 화면 너비에 맞춰 계산한다
} as const;

// 모서리를 둥글게 깎은 사각형 경로 (꼭짓점 4개, 각 모서리를 반지름 r로 깎는다)
function roundedQuadPath(points: [number, number][], r: number): string {
  const n = points.length;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i + n - 1) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const toPrev = [prev[0] - cur[0], prev[1] - cur[1]];
    const toNext = [next[0] - cur[0], next[1] - cur[1]];
    const lp = Math.hypot(toPrev[0], toPrev[1]) || 1;
    const ln = Math.hypot(toNext[0], toNext[1]) || 1;
    const rp = Math.min(r, lp * 0.45);
    const rn = Math.min(r, ln * 0.45);
    const a: [number, number] = [cur[0] + (toPrev[0] / lp) * rp, cur[1] + (toPrev[1] / lp) * rp];
    const b: [number, number] = [cur[0] + (toNext[0] / ln) * rn, cur[1] + (toNext[1] / ln) * rn];
    parts.push(`${i === 0 ? "M" : "L"}${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${cur[0].toFixed(1)} ${cur[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`);
  }
  return `${parts.join("")}Z`;
}

export default function LatestCarousel({ videos, mode }: Props) {
  const rootRef = useRef<HTMLDivElement>(null); // 화면에 보이는 띠 (잘라내는 영역)
  const stageRef = useRef<HTMLDivElement>(null); // 단위 좌표를 쓰는 안쪽 판 (phone일 때만 확대·축소됨)
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const iconRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const state = useRef({ offset: 0, velocity: 0, dragging: false, lastX: 0, lastT: 0, dragDistance: 0, scale: 1 });

  // 영상이 10개보다 적으면 되풀이해서 채우고, 하나도 없으면 빈 카드(자리 표시)로 둔다
  const cards: (LatestVideo | null)[] = Array.from({ length: CARD_COUNT }, (_, i) =>
    videos.length > 0 ? videos[i % videos.length] : null,
  );

  const W = SIZES[mode].width;
  const half = W / 2 - 14; // 가운데에서 가장자리까지의 기준 거리 (1440일 때 706)

  // 한 프레임의 카드 배치 (모두 단위 좌표)
  function layout() {
    const stage = stageRef.current;
    if (!stage) return;
    const stageHeight = mode === "desktop" ? SIZES.desktop.height : stage.offsetHeight;
    const centerY = mode === "desktop" ? SIZES.desktop.centerY : stageHeight / 2;
    const center = W / 2;
    for (let i = 0; i < CARD_COUNT; i++) {
      const el = cardRefs.current[i];
      if (!el) continue;
      let raw = (i * PITCH + state.current.offset) % LOOP;
      if (raw < 0) raw += LOOP;
      const t = raw - LOOP / 2; // 가운데를 기준으로 한 위치 (-980 ~ 980)
      if (Math.abs(t) > half + 300) {
        el.style.display = "none";
        continue;
      }
      // 바깥쪽 카드일수록 간격이 벌어지도록 밀어낸다 (통 안쪽을 보는 느낌)
      const x = center + t * (1 + 0.083 * (t / half) ** 2);
      const d = Math.abs(x - center) / half;
      const w = 170 + 48 * d * d;
      const xl = x - w / 2;
      const xr = x + w / 2;
      const ql = Math.abs(xl - center) / half;
      const qr = Math.abs(xr - center) / half;
      const hl = 280 + 92 * ql ** 2.6;
      const hr = 280 + 92 * qr ** 2.6;
      const cy = centerY - 12 * d * d;
      const maxH = Math.max(hl, hr);

      el.style.display = "block";
      el.style.left = `${xl}px`;
      el.style.top = `${cy - maxH / 2}px`;
      el.style.width = `${w}px`;
      el.style.height = `${maxH}px`;
      el.style.clipPath = `path('${roundedQuadPath(
        [
          [0, (maxH - hl) / 2],
          [w, (maxH - hr) / 2],
          [w, (maxH + hr) / 2],
          [0, (maxH + hl) / 2],
        ],
        RADIUS,
      )}')`;
      const icon = iconRefs.current[i];
      if (icon) icon.style.top = `${(maxH + hl) / 2 - 14 - 34}px`; // 카드 왼쪽 아래 모서리 위에 재생 아이콘
    }
  }

  // 판 크기 맞추기: phone일 때 640 단위를 화면 너비에 맞춰 줄이고, 단위당 화면 점(px) 비율을 기억한다
  useLayoutEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;
    const fit = () => {
      if (mode === "phone") {
        const s = root.clientWidth / W;
        stage.style.transform = `scale(${s})`;
        stage.style.height = `${root.clientHeight / (s || 1)}px`;
      }
      const rect = stage.getBoundingClientRect();
      state.current.scale = rect.width > 0 ? rect.width / W : 1;
      layout();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // 시간에 따라 흐르는 움직임
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const root = rootRef.current;
      if (root && root.offsetParent !== null) {
        const s = state.current;
        if (!s.dragging) {
          s.offset += s.velocity * dt; // 놓은 뒤 남은 관성
          s.velocity *= MOMENTUM_KEEP_PER_SECOND ** dt;
          if (!reduce) s.offset -= AUTO_SPEED * dt; // 오른쪽 → 왼쪽으로 천천히 흐름
        }
        layout();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function onPointerDown(e: React.PointerEvent) {
    const s = state.current;
    s.dragging = true;
    s.lastX = e.clientX;
    s.lastT = performance.now();
    s.dragDistance = 0;
    s.velocity = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const s = state.current;
    if (!s.dragging) return;
    const now = performance.now();
    const dx = (e.clientX - s.lastX) / s.scale; // 화면 점(px)을 단위로 바꿔 손가락과 1:1로 따라간다
    const dt = Math.max(0.001, (now - s.lastT) / 1000);
    s.offset += dx;
    s.velocity = 0.6 * s.velocity + 0.4 * (dx / dt); // 놓을 때의 속도를 부드럽게 추정
    s.dragDistance += Math.abs(e.clientX - s.lastX);
    s.lastX = e.clientX;
    s.lastT = now;
  }
  function onPointerUp(e: React.PointerEvent) {
    const s = state.current;
    s.dragging = false;
    if (performance.now() - s.lastT > 80) s.velocity = 0; // 멈췄다가 놓으면 관성 없음
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  const isPhone = mode === "phone";
  return (
    <div
      ref={rootRef}
      className={`relative cursor-grab select-none overflow-hidden active:cursor-grabbing ${isPhone ? "h-[250px] w-full" : ""}`}
      style={isPhone ? { touchAction: "pan-y" } : { width: W, height: SIZES.desktop.height, touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        // 끌고 난 직후에는 카드가 열리지 않게 한다
        if (state.current.dragDistance > 6) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div
        ref={stageRef}
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: W, height: isPhone ? "100%" : SIZES.desktop.height }}
      >
        {cards.map((v, i) =>
          v ? (
            <a
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              href={`https://www.youtube.com/watch?v=${v.id}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${v.title} (유튜브에서 새 창으로 열기)`}
              title={v.title}
              draggable={false}
              className="absolute block overflow-hidden bg-[#DAE7C7]"
              style={{ display: "none" }}
            >
              {/* 유튜브가 공개한 썸네일 이미지를 그대로 쓴다 (크기가 매 프레임 바뀌어 이미지 최적화는 쓰지 않음) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.thumbnail} alt="" draggable={false} loading={i < 5 ? "eager" : "lazy"} className="absolute inset-0 h-full w-full object-cover" />
              <span
                ref={(el) => {
                  iconRefs.current[i] = el;
                }}
                aria-hidden="true"
                className="absolute left-[14px] flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/35 backdrop-blur-sm"
              >
                <svg width="12" height="14" viewBox="0 0 12 14" fill="#fff" aria-hidden="true">
                  <path d="M1 1.2v11.6a.8.8 0 0 0 1.2.7l9-5.8a.8.8 0 0 0 0-1.4L2.2.5A.8.8 0 0 0 1 1.2Z" />
                </svg>
              </span>
            </a>
          ) : (
            // 영상을 불러오지 못했을 때의 빈 카드 (링크 없음)
            <div
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el as unknown as HTMLAnchorElement | null;
              }}
              aria-hidden="true"
              className="absolute bg-gradient-to-b from-[#DAE7C7] to-[#BFD3A5]"
              style={{ display: "none" }}
            />
          ),
        )}
      </div>
    </div>
  );
}
